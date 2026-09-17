import { Municipality, MunicipalityRule, ClassificationMapping, ReceitaWsData, CompanyClassification } from '../../types';
import { OpenAiService } from './openaiService';
import { normalizeCnaeCode } from './receitaWsService';

export class CnaeClassifierService {
  /**
   * Main classification method applying the prioritized pipeline:
   * 1. Validated Classification Mapping (Memória Operacional)
   * 2. Specific Municipality Rules
   * 3. OpenAI Vector Store / CTM Analysis
   * 4. Fallback Rule
   */
  public static async classify(
    municipality: Municipality,
    rules: MunicipalityRule[],
    mappings: ClassificationMapping[],
    companyData: ReceitaWsData
  ): Promise<CompanyClassification> {
    const cleanCnae = normalizeCnaeCode(companyData.cnaePrincipalCode);

    // -------------------------------------------------------------
    // STEP 1: Check Validated Classification Mapping (Memória Operacional)
    // -------------------------------------------------------------
    const existingMapping = mappings.find(
      m => m.municipalityId === municipality.id &&
           m.validated &&
           normalizeCnaeCode(m.cnae) === cleanCnae
    );

    if (existingMapping) {
      console.log(`[Classification Pipeline] STEP 1 MATCH: Found validated mapping for CNAE ${cleanCnae} in ${municipality.nome}`);
      return {
        matched: true,
        ctmActivityCode: existingMapping.ctmActivityCode,
        ctmActivityDescription: existingMapping.ctmActivityDescription,
        confidence: 100,
        sourcePage: 'Memória Operacional (Mapeamento Validado)',
        sourceExcerpt: `Mapeamento previamente aprovado por usuário para CNAE ${cleanCnae}.`,
        reasoningSummary: `Classificação recuperada da memória operacional de ${municipality.nome}.`,
        alternatives: [],
        requiresReview: false,
        classificationSource: 'MAPPING',
      };
    }

    // -------------------------------------------------------------
    // STEP 2: Check Active Municipality Rules
    // -------------------------------------------------------------
    const activeRules = rules
      .filter(r => r.municipalityId === municipality.id && r.active)
      .sort((a, b) => b.priority - a.priority);

    for (const rule of activeRules) {
      const cond = rule.condition.toUpperCase();
      const cnaeMatch = cond.includes(cleanCnae) || cond.includes(companyData.cnaePrincipalCode) || (cond.includes('CNAE') && (cond.includes(cleanCnae.slice(0, 5)) || cond.includes(cleanCnae.slice(0, 2))));
      
      if (cnaeMatch) {
        console.log(`[Classification Pipeline] STEP 2 MATCH: Rule '${rule.name}' matched for CNAE ${cleanCnae}`);
        // Extract activity code / description if structured in instruction
        let actCode = 'REGRA-LOCAL';
        let actDesc = rule.instruction;

        if (rule.instruction.includes(':')) {
          const parts = rule.instruction.split(':');
          actCode = parts[0].trim();
          actDesc = parts.slice(1).join(':').trim();
        }

        return {
          matched: true,
          ctmActivityCode: actCode,
          ctmActivityDescription: actDesc,
          confidence: 100,
          sourcePage: `Regra Municipal: ${rule.name}`,
          sourceExcerpt: rule.condition,
          reasoningSummary: `Regra municipal aplicada: "${rule.name}" - ${rule.instruction}`,
          alternatives: [],
          requiresReview: false,
          classificationSource: 'RULE',
        };
      }
    }

    // -------------------------------------------------------------
    // STEP 3: Call OpenAI with CTM Context & Instructions
    // -------------------------------------------------------------
    console.log(`[Classification Pipeline] STEP 3: Calling OpenAI for CNAE ${cleanCnae} (${companyData.razaoSocial})`);
    const aiResult = await OpenAiService.classifyCompany(municipality, activeRules, companyData);

    return aiResult;
  }
}
