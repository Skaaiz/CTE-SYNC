import { ReceitaWsData } from '../../types';

export function normalizeCnpj(rawCnpj: string): string {
  if (!rawCnpj) return '';
  return String(rawCnpj).replace(/[^\d]/g, '').trim();
}

export function formatCnpj(cleanCnpj: string): string {
  const digits = normalizeCnpj(cleanCnpj);
  if (digits.length !== 14) return cleanCnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function isValidCnpj(cleanCnpj: string): boolean {
  const digits = normalizeCnpj(cleanCnpj);
  if (digits.length !== 14) return false;
  // Reject repetitive single-digit sequences (e.g. "00000000000000")
  if (/^(\d)\1{13}$/.test(digits)) return false;
  
  // Standard CNPJ checksum validation
  let size = digits.length - 2;
  let numbers = digits.substring(0, size);
  const digitsCheck = digits.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digitsCheck.charAt(0))) return false;

  size = size + 1;
  numbers = digits.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += Number(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== Number(digitsCheck.charAt(1))) return false;

  return true;
}

// Rate Limiter logic for ReceitaWS
class ReceitaWsRateLimiter {
  private requestQueueWindow: number[] = [];
  private reqsPerMinute: number;

  constructor() {
    const envVal = parseInt(process.env.RECEITAWS_REQUESTS_PER_MINUTE || '3', 10);
    this.reqsPerMinute = isNaN(envVal) || envVal <= 0 ? 3 : envVal;
  }

  public async waitForSlot(): Promise<void> {
    const now = Date.now();
    // Filter timestamps within the last 60 seconds (60000 ms)
    this.requestQueueWindow = this.requestQueueWindow.filter(t => now - t < 60000);

    if (this.requestQueueWindow.length >= this.reqsPerMinute) {
      // Calculate delay required until the oldest request falls outside the 60s window + 1s safety margin
      const oldest = this.requestQueueWindow[0];
      const timeToWait = Math.max(1000, 60000 - (now - oldest) + 1000);
      console.log(`[ReceitaWS Rate Limiter] Limit of ${this.reqsPerMinute}/min reached. Waiting ${Math.round(timeToWait / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, timeToWait));
      return this.waitForSlot();
    }

    // Record timestamp of this request
    this.requestQueueWindow.push(Date.now());
  }
}

const rateLimiter = new ReceitaWsRateLimiter();

export class ReceitaWsService {
  /**
   * Fetch company data from ReceitaWS API with rate limiting and retries
   */
  public static async fetchCnpjData(rawCnpj: string, retries = 2): Promise<{
    status: 'SUCCESS' | 'NOT_FOUND' | 'ERROR';
    data?: ReceitaWsData;
    errorMsg?: string;
  }> {
    const cnpj = normalizeCnpj(rawCnpj);
    if (cnpj.length !== 14) {
      return {
        status: 'ERROR',
        errorMsg: `CNPJ inválido (${rawCnpj}): deve ter exatamente 14 dígitos.`,
      };
    }

    // Wait for rate-limiter slot before issuing request
    await rateLimiter.waitForSlot();

    const url = `https://www.receitaws.com.br/v1/cnpj/${cnpj}`;
    console.log(`[ReceitaWS] Querying CNPJ ${formatCnpj(cnpj)}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'SistemaEnquadramentoCadastral/1.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) {
        return {
          status: 'NOT_FOUND',
          errorMsg: 'CNPJ não encontrado na base da Receita Federal.',
        };
      }

      if (response.status === 429) {
        console.warn(`[ReceitaWS] HTTP 429 (Too Many Requests) for CNPJ ${cnpj}. Retrying...`);
        if (retries > 0) {
          await new Promise(res => setTimeout(res, 20000)); // Wait 20s
          return this.fetchCnpjData(cnpj, retries - 1);
        }
        return {
          status: 'ERROR',
          errorMsg: 'Limite de requisições excedido na ReceitaWS (HTTP 429).',
        };
      }

      if (!response.ok) {
        if (retries > 0) {
          await new Promise(res => setTimeout(res, 5000));
          return this.fetchCnpjData(cnpj, retries - 1);
        }
        return {
          status: 'ERROR',
          errorMsg: `Erro de conexão com ReceitaWS (HTTP ${response.status}).`,
        };
      }

      const json = await response.json();

      if (json.status === 'ERROR') {
        const message = json.message || 'CNPJ não encontrado ou erro no servidor da ReceitaWS.';
        if (message.toLowerCase().includes('não encontrado') || message.toLowerCase().includes('invalido')) {
          return {
            status: 'NOT_FOUND',
            errorMsg: message,
          };
        }
        return {
          status: 'ERROR',
          errorMsg: message,
        };
      }

      // Map response to ReceitaWsData structure
      const cnaePrincipal = Array.isArray(json.atividade_principal) && json.atividade_principal.length > 0
        ? json.atividade_principal[0]
        : { code: json.cnae_fiscal || '', text: json.cnae_fiscal_descricao || '' };

      const cnaesSecundarios = Array.isArray(json.atividades_secundarias)
        ? json.atividades_secundarias.map((a: any) => ({
            code: String(a.code || a.codigo || '').trim(),
            text: String(a.text || a.descricao || '').trim(),
          }))
        : [];

      const qsa = Array.isArray(json.qsa)
        ? json.qsa.map((s: any) => ({
            nome: String(s.nome || s.nome_socio || '').trim(),
            qual: String(s.qual || s.qualificacao_socio || '').trim(),
          }))
        : [];

      const mappedData: ReceitaWsData = {
        tipo: json.tipo || 'MATRIZ',
        dataAbertura: json.abertura || '',
        razaoSocial: json.nome || '',
        nomeFantasia: json.fantasia || json.nome || '',
        situacao: json.situacao || 'ATIVA',
        dataSituacao: json.data_situacao || '',
        motivoSituacao: json.motivo_situacao || '',
        cnaePrincipalCode: normalizeCnaeCode(cnaePrincipal.code || ''),
        cnaePrincipalText: cnaePrincipal.text || '',
        cnaesSecundarios,
        naturezaJuridica: json.natureza_juridica || '',
        logradouro: json.logradouro || '',
        numero: json.numero || '',
        complemento: json.complemento || '',
        bairro: json.bairro || '',
        cep: json.cep || '',
        municipio: json.municipio || '',
        uf: json.uf || '',
        email: json.email || '',
        telefone: json.telefone || '',
        capitalSocial: json.capital_social || '',
        qsa,
        simplesOptante: Boolean(json.simples?.optante),
        simplesDataOpcao: json.simples?.data_opcao || null,
        simplesDataExclusao: json.simples?.data_exclusao || null,
        meiOptante: Boolean(json.simei?.optante),
        meiDataOpcao: json.simei?.data_opcao || null,
        meiDataExclusao: json.simei?.data_exclusao || null,
        receitaWsLastUpdate: json.ultima_atualizacao || new Date().toISOString(),
        rawJson: json,
      };

      return {
        status: 'SUCCESS',
        data: mappedData,
      };
    } catch (err: any) {
      console.error(`[ReceitaWS Exception for ${cnpj}]:`, err.message || err);
      if (retries > 0) {
        await new Promise(res => setTimeout(res, 5000));
        return this.fetchCnpjData(cnpj, retries - 1);
      }
      return {
        status: 'ERROR',
        errorMsg: err.name === 'AbortError' ? 'Tempo limite esgotado ao consultar ReceitaWS.' : (err.message || 'Falha de rede ao acessar ReceitaWS.'),
      };
    }
  }
}

export function normalizeCnaeCode(rawCode: string): string {
  if (!rawCode) return '';
  // Convert "47.21-1-03" or "4721103" to normalized form "47.21-1-03" or clean digits
  const clean = rawCode.replace(/[^\d]/g, '');
  if (clean.length === 7) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 4)}-${clean.slice(4, 5)}-${clean.slice(5, 7)}`;
  }
  return rawCode.trim();
}
