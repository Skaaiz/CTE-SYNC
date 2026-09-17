import OpenAI from 'openai';
import { Municipality, ReceitaWsData, CompanyClassification, MunicipalityRule } from '../../types';

export class OpenAiService {
  private static getClient(): OpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('MY_OPENAI')) {
      return null;
    }
    return new OpenAI({ apiKey });
  }

  /**
   * Upload CTM PDF file to OpenAI and create/update Vector Store
   */
  public static async createVectorStoreForCtm(
    municipalityName: string,
    pdfBuffer: Buffer,
    fileName: string
  ): Promise<{ vectorStoreId: string | null; fileId: string | null; error?: string }> {
    const openai = this.getClient();
    if (!openai) {
      return {
        vectorStoreId: null,
        fileId: null,
        error: 'OPENAI_API_KEY não configurada no servidor. Configure a chave nas variáveis de ambiente.',
      };
    }

    try {
      // 1. Upload File to OpenAI Files API
      console.log(`[OpenAI VectorStore] Uploading CTM PDF '${fileName}' for ${municipalityName}...`);
      
      const fileUpload = await OpenAI.toFile(pdfBuffer, fileName, { type: 'application/pdf' });
      const file = await openai.files.create({
        file: fileUpload,
        purpose: 'assistants',
      });

      // 2. Create Vector Store (Check both openai.vectorStores and openai.beta.vectorStores)
      console.log(`[OpenAI VectorStore] Creating Vector Store for ${municipalityName}...`);
      const vsApi = (openai as any).vectorStores || (openai as any).beta?.vectorStores;
      
      if (!vsApi || typeof vsApi.create !== 'function') {
        console.warn('[OpenAI VectorStore Warning]: vectorStores API is not available on current OpenAI client instance.');
        return {
          vectorStoreId: null,
          fileId: file.id,
          error: 'Vector Stores API não disponível nesta versão do SDK OpenAI.',
        };
      }

      const vectorStore = await vsApi.create({
        name: `CTM_${municipalityName.replace(/\s+/g, '_')}_${Date.now()}`,
        file_ids: [file.id],
      });

      console.log(`[OpenAI VectorStore] Success! VectorStore ID: ${vectorStore.id}`);
      return {
        vectorStoreId: vectorStore.id,
        fileId: file.id,
      };
    } catch (err: any) {
      console.error('[OpenAI VectorStore Error]:', err.message || err);
      return {
        vectorStoreId: null,
        fileId: null,
        error: err.message || 'Erro ao criar Vector Store na OpenAI.',
      };
    }
  }

  /**
   * Perform AI classification of company activity against Municipality CTM
   */
  public static async classifyCompany(
    municipality: Municipality,
    rules: MunicipalityRule[],
    companyData: ReceitaWsData
  ): Promise<CompanyClassification> {
    const model = process.env.OPENAI_MODEL || 'gpt-5.5-2026-04-23';
    const openai = this.getClient();

    // Context preparation
    const rulesContext = rules.filter(r => r.active).map(r => `- [Prioridade ${r.priority}] ${r.name}: ${r.condition} => ${r.instruction}`).join('\n');
    const localInstructions = municipality.aiInstructions || 'Sem instruções locais específicas.';

    const companyContext = `
DADOS DA EMPRESA:
- Razão Social: ${companyData.razaoSocial}
- Nome Fantasia: ${companyData.nomeFantasia}
- Natureza Jurídica: ${companyData.naturezaJuridica}
- CNAE Principal: ${companyData.cnaePrincipalCode} - ${companyData.cnaePrincipalText}
- CNAEs Secundários: ${companyData.cnaesSecundarios.map(c => `${c.code} (${c.text})`).join('; ')}
- Município / UF: ${companyData.municipio} / ${companyData.uf}
    `.trim();

    const systemPrompt = `
Você é um assistente especialista em enquadramento cadastral tributário municipal.
Sua função NÃO é criar legislação nem inventar atividades.
Sua tarefa é localizar no Código Tributário Municipal (CTM) do município de ${municipality.nome} - ${municipality.uf} a atividade tributável que melhor corresponda às atividades econômicas oficiais da empresa.

REGRAS RÍGIDAS DE ENQUADRAMENTO:
1. Utilize EXCLUSIVAMENTE o CTM do município de ${municipality.nome} - ${municipality.uf} e as instruções locais fornecidas.
2. Analise primeiro o CNAE principal. Utilize os CNAEs secundários, nome empresarial e nome fantasia como contexto complementar.
3. NÃO invente códigos do CTM. Toda classificação DEVE obrigatoriamente ter evidência e trecho extraído do documento CTM.
4. Se houver mais de uma atividade aplicável ou dúvida razoável, mencione as alternativas e defina "requiresReview": true.
5. Se não houver correspondência com confiança >= ${municipality.confidenceThreshold}%, defina "requiresReview": true.
6. Se não houver correspondência direta, utilize a regra de fallback cadastrada se aplicável: "${municipality.fallbackActivityId} - ${municipality.fallbackActivityDescription}".

INSTRUÇÕES ESPECÍFICAS DO MUNICÍPIO:
${localInstructions}

REGRAS LOCAIS ADICIONAIS:
${rulesContext || 'Nenhuma regra local cadastrada.'}

Sua resposta DEVE ser rigorosamente um objeto JSON válido no seguinte formato:
{
  "matched": true | false,
  "ctmActivityCode": "Código ou item da lista de serviços/taxas do CTM",
  "ctmActivityDescription": "Descrição exata da atividade no CTM",
  "confidence": número de 0 a 100,
  "sourcePage": "Página ou Seção do CTM de onde foi extraído",
  "sourceExcerpt": "Trecho exato do CTM com a evidência",
  "reasoningSummary": "Breve justificativa técnica do enquadramento",
  "alternatives": [
    { "ctmActivityCode": "...", "ctmActivityDescription": "...", "confidence": 0 }
  ],
  "requiresReview": true | false
}
    `.trim();

    // Fallback classification generator when OpenAI API key is absent or on API error
    const buildFallbackOrHeuristicClassification = (reason: string): CompanyClassification => {
      // Basic text search if CTM text is available
      if (municipality.ctmContentText && municipality.ctmContentText.length > 50) {
        const text = municipality.ctmContentText.toLowerCase();
        const mainCnaeText = (companyData.cnaePrincipalText || '').toLowerCase();
        const mainWords = mainCnaeText.split(/\s+/).filter(w => w.length > 3);
        
        // Find best matching paragraph
        const paragraphs = municipality.ctmContentText.split(/\n\n|\r\n\r\n/);
        let bestScore = 0;
        let bestParagraph = '';

        for (const p of paragraphs) {
          const lowerP = p.toLowerCase();
          let score = 0;
          for (const word of mainWords) {
            if (lowerP.includes(word)) score += 1;
          }
          if (score > bestScore) {
            bestScore = score;
            bestParagraph = p;
          }
        }

        if (bestScore >= 2 && bestParagraph) {
          const firstLine = bestParagraph.trim().split('\n')[0];
          const confidence = Math.min(85, 50 + bestScore * 10);
          return {
            matched: true,
            ctmActivityCode: firstLine.slice(0, 20),
            ctmActivityDescription: firstLine.slice(0, 150),
            confidence,
            sourcePage: 'Análise documental do CTM',
            sourceExcerpt: bestParagraph.slice(0, 300),
            reasoningSummary: `Classificação encontrada via busca no CTM do município para o CNAE ${companyData.cnaePrincipalCode}. (${reason})`,
            alternatives: [],
            requiresReview: confidence < municipality.confidenceThreshold,
            classificationSource: 'OPENAI',
            aiModelUsed: 'heuristic-ctm-search',
          };
        }
      }

      // Apply Fallback Activity
      const fallbackCode = municipality.fallbackActivityId || 'OUTROS';
      const fallbackDesc = municipality.fallbackActivityDescription || 'Outros Estabelecimentos Comerciais e de Serviços';
      return {
        matched: false,
        ctmActivityCode: fallbackCode,
        ctmActivityDescription: fallbackDesc,
        confidence: 50,
        sourcePage: 'Configuração Fallback do Município',
        sourceExcerpt: `Atividade de fallback configurada para ${municipality.nome}.`,
        reasoningSummary: `Enquadramento de fallback aplicado (${reason}). Requer verificação manual.`,
        alternatives: [],
        requiresReview: true,
        classificationSource: 'FALLBACK',
        aiModelUsed: 'fallback',
      };
    };

    if (!openai) {
      console.warn(`[OpenAI Service] OPENAI_API_KEY missing. Applying heuristic search/fallback for ${companyData.razaoSocial}`);
      return buildFallbackOrHeuristicClassification('Chave OpenAI não configurada');
    }

    try {
      console.log(`[OpenAI Classify] Calling OpenAI model ${model} for ${companyData.razaoSocial} (${companyData.cnaePrincipalCode})...`);

      // If Vector Store ID exists, perform Assistants or Chat Completion with Search Context
      let userMessage = companyContext;
      if (municipality.ctmContentText) {
        userMessage += `\n\nTRECHO DE REFERÊNCIA DO CTM:\n${municipality.ctmContentText.slice(0, 6000)}`;
      }

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        response_format: { type: 'json_object' },
      });

      const responseContent = response.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error('Resposta vazia da OpenAI');
      }

      const jsonResult = JSON.parse(responseContent);

      const confidence = Number(jsonResult.confidence) || 0;
      const requiresReview = Boolean(jsonResult.requiresReview) || confidence < municipality.confidenceThreshold || !jsonResult.matched;

      return {
        matched: Boolean(jsonResult.matched),
        ctmActivityCode: jsonResult.ctmActivityCode || municipality.fallbackActivityId || 'N/A',
        ctmActivityDescription: jsonResult.ctmActivityDescription || municipality.fallbackActivityDescription || 'Sem correspondência',
        confidence,
        sourcePage: jsonResult.sourcePage || 'CTM Geral',
        sourceExcerpt: jsonResult.sourceExcerpt || 'Trecho extraído do CTM do município',
        reasoningSummary: jsonResult.reasoningSummary || 'Classificação efetuada por IA.',
        alternatives: Array.isArray(jsonResult.alternatives) ? jsonResult.alternatives : [],
        requiresReview,
        classificationSource: 'OPENAI',
        aiModelUsed: model,
        vectorStoreIdUsed: municipality.openaiVectorStoreId || undefined,
      };
    } catch (err: any) {
      console.error('[OpenAI Classification Error]:', err.message || err);
      return buildFallbackOrHeuristicClassification(`Erro na API OpenAI: ${err.message || 'Falha de comunicação'}`);
    }
  }
}
