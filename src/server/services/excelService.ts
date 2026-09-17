import * as XLSX from 'xlsx';
import { ExcelImportPreview, JobCompany, AnalysisJob, Municipality } from '../../types';
import { normalizeCnpj, isValidCnpj, formatCnpj } from './receitaWsService';

export class ExcelService {
  /**
   * Parse uploaded Excel buffer and detect CNPJ column and statistics
   */
  public static parseExcelForCnpjs(buffer: Buffer, fileName: string, targetCnpjColumn?: string): ExcelImportPreview {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    const jsonRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (jsonRows.length === 0) {
      return {
        fileName,
        totalRows: 0,
        cnpjColumn: '',
        availableColumns: [],
        cnpjsIdentified: 0,
        validCnpjs: 0,
        duplicateCnpjs: 0,
        invalidCnpjs: 0,
        previewRows: [],
        validCleanCnpjs: [],
      };
    }

    const availableColumns = Object.keys(jsonRows[0] || {});

    // Auto-detect CNPJ column if not specified
    let detectedColumn = targetCnpjColumn || '';
    if (!detectedColumn) {
      // Look for common header names
      const headerCandidates = availableColumns.filter(col => {
        const lower = String(col).toLowerCase().trim();
        return lower.includes('cnpj') || lower.includes('cpf_cnpj') || lower.includes('documento') || lower === 'c.n.p.j';
      });

      if (headerCandidates.length > 0) {
        detectedColumn = headerCandidates[0];
      } else {
        // Sample rows to find column with 14 digit values
        for (const col of availableColumns) {
          let matchCount = 0;
          for (let i = 0; i < Math.min(10, jsonRows.length); i++) {
            const val = normalizeCnpj(String(jsonRows[i][col] || ''));
            if (val.length === 14) matchCount++;
          }
          if (matchCount >= 2) {
            detectedColumn = col;
            break;
          }
        }
        if (!detectedColumn && availableColumns.length > 0) {
          detectedColumn = availableColumns[0];
        }
      }
    }

    const seenCnpjs = new Set<string>();
    let cnpjsIdentified = 0;
    let validCnpjs = 0;
    let duplicateCnpjs = 0;
    let invalidCnpjs = 0;
    const validCleanCnpjs: string[] = [];
    const previewRows: ExcelImportPreview['previewRows'] = [];

    for (let i = 0; i < jsonRows.length; i++) {
      const row = jsonRows[i];
      const rawVal = String(row[detectedColumn] || '').trim();
      const clean = normalizeCnpj(rawVal);

      let isValid = false;
      let isDuplicate = false;

      if (clean) {
        cnpjsIdentified++;
        if (clean.length === 14 && isValidCnpj(clean)) {
          isValid = true;
          if (seenCnpjs.has(clean)) {
            isDuplicate = true;
            duplicateCnpjs++;
          } else {
            seenCnpjs.add(clean);
            validCnpjs++;
            validCleanCnpjs.push(clean);
          }
        } else {
          invalidCnpjs++;
        }
      }

      if (i < 20) {
        previewRows.push({
          rawCnpj: rawVal,
          cleanCnpj: clean,
          isValid,
          isDuplicate,
          rowData: row,
        });
      }
    }

    return {
      fileName,
      totalRows: jsonRows.length,
      cnpjColumn: detectedColumn,
      availableColumns,
      cnpjsIdentified,
      validCnpjs,
      duplicateCnpjs,
      invalidCnpjs,
      previewRows,
      validCleanCnpjs,
    };
  }

  /**
   * Export job results as a multi-tab Excel file
   */
  public static generateExportWorkbook(
    job: AnalysisJob,
    municipality: Municipality,
    companies: JobCompany[]
  ): Buffer {
    const workbook = XLSX.utils.book_new();

    // ---------------------------------------------------------
    // TAB 1: Empresas (Todas as empresas e enquadramento CTM)
    // ---------------------------------------------------------
    const empresasData = companies.map(c => {
      const rw = c.receitaWsData;
      const cl = c.classification;

      return {
        'Razão Social': rw?.razaoSocial || 'N/A',
        'CNPJ': c.formattedCnpj || formatCnpj(c.cnpj),
        'Nome Fantasia': rw?.nomeFantasia || '',
        'Código Atividade CTM': cl?.ctmActivityCode || 'N/A',
        'Descrição Atividade CTM': cl?.ctmActivityDescription || 'Sem correspondência',
        'CNAE Principal (Código)': rw?.cnaePrincipalCode || '',
        'CNAE Principal (Descrição)': rw?.cnaePrincipalText || '',
        'CNAEs Secundários': rw?.cnaesSecundarios ? rw.cnaesSecundarios.map(s => `${s.code} - ${s.text}`).join('; ') : '',
        'Situação Cadastral': rw?.situacao || c.status,
        'Simples Nacional': rw?.simplesOptante ? 'SIM' : 'NÃO',
        'MEI / SIMEI': rw?.meiOptante ? 'SIM' : 'NÃO',
        'Natureza Jurídica': rw?.naturezaJuridica || '',
        'Data Abertura': rw?.dataAbertura || '',
        'Tipo': rw?.tipo || '',
        'Logradouro': rw ? `${rw.logradouro}, ${rw.numero} ${rw.complemento}` : '',
        'Bairro': rw?.bairro || '',
        'CEP': rw?.cep || '',
        'Município / UF': rw ? `${rw.municipio}/${rw.uf}` : '',
        'Telefone': rw?.telefone || '',
        'E-mail': rw?.email || '',
        'Confiança (%)': cl?.confidence !== undefined ? `${cl.confidence}%` : 'N/A',
        'Status Enquadramento': cl?.requiresReview ? 'REVISÃO NECESSÁRIA' : (cl?.matched ? 'CLASSIFICADO' : 'PENDENTE'),
        'Fonte Enquadramento': cl?.classificationSource || 'N/A',
        'Página CTM': cl?.sourcePage || '',
        'Evidência / Trecho CTM': cl?.sourceExcerpt || '',
        'Justificativa Técnica': cl?.reasoningSummary || '',
        'Data Atualização ReceitaWS': rw?.receitaWsLastUpdate || '',
      };
    });

    const sheetEmpresas = XLSX.utils.json_to_sheet(empresasData);
    // Ensure CNPJ values remain text strings (prevent numeric formatting removing leading zeros)
    XLSX.utils.book_append_sheet(workbook, sheetEmpresas, 'Empresas');

    // ---------------------------------------------------------
    // TAB 2: Revisar (Apenas as empresas que exigem revisão)
    // ---------------------------------------------------------
    const revisarCompanies = companies.filter(c => c.classification?.requiresReview || c.status === 'NOT_FOUND' || c.status === 'ERROR');
    const revisarData = revisarCompanies.map(c => {
      const rw = c.receitaWsData;
      const cl = c.classification;

      return {
        'CNPJ': c.formattedCnpj || formatCnpj(c.cnpj),
        'Razão Social': rw?.razaoSocial || 'N/A',
        'CNAE Principal': rw ? `${rw.cnaePrincipalCode} - ${rw.cnaePrincipalText}` : '',
        'Atividade Sugerida CTM': cl?.ctmActivityCode ? `${cl.ctmActivityCode} - ${cl.ctmActivityDescription}` : 'Sem sugestão',
        'Confiança (%)': cl?.confidence !== undefined ? `${cl.confidence}%` : '0%',
        'Motivo da Revisão': !cl?.matched ? 'Sem correspondência' : (cl.confidence < municipality.confidenceThreshold ? `Confiança abaixo de ${municipality.confidenceThreshold}%` : 'Marcado para revisão'),
        'Alternativas Sugeridas': cl?.alternatives ? cl.alternatives.map(a => `${a.ctmActivityCode} - ${a.ctmActivityDescription} (${a.confidence}%)`).join(' | ') : '',
        'Trecho CTM Evidência': cl?.sourceExcerpt || '',
      };
    });

    const sheetRevisar = XLSX.utils.json_to_sheet(revisarData.length > 0 ? revisarData : [{ 'Aviso': 'Nenhuma empresa exige revisão neste relatório.' }]);
    XLSX.utils.book_append_sheet(workbook, sheetRevisar, 'Revisar');

    // ---------------------------------------------------------
    // TAB 3: Resumo (Estatísticas e indicadores gerais)
    // ---------------------------------------------------------
    const totalProcessed = companies.length;
    const totalClassified = companies.filter(c => c.classification?.matched && !c.classification?.requiresReview).length;
    const totalReviewNeeded = companies.filter(c => c.classification?.requiresReview).length;
    const totalNotFound = companies.filter(c => c.status === 'NOT_FOUND').length;
    const totalErrors = companies.filter(c => c.status === 'ERROR').length;
    const totalSimples = companies.filter(c => c.receitaWsData?.simplesOptante).length;
    const totalMei = companies.filter(c => c.receitaWsData?.meiOptante).length;

    const resumoData = [
      { 'Métrica / Indicador': 'Município Analisado', 'Valor': `${municipality.nome} - ${municipality.uf}` },
      { 'Métrica / Indicador': 'Arquivo Original', 'Valor': job.fileName },
      { 'Métrica / Indicador': 'Data do Processamento', 'Valor': job.finishedAt || new Date().toLocaleString('pt-BR') },
      { 'Métrica / Indicador': 'Total de CNPJs no Lote', 'Valor': job.total },
      { 'Métrica / Indicador': 'Empresas Processadas', 'Valor': totalProcessed },
      { 'Métrica / Indicador': 'Classificações Automáticas Seguras', 'Valor': totalClassified },
      { 'Métrica / Indicador': 'Registros Exigindo Revisão Manual', 'Valor': totalReviewNeeded },
      { 'Métrica / Indicador': 'CNPJs Não Encontrados na ReceitaWS', 'Valor': totalNotFound },
      { 'Métrica / Indicador': 'Erros de Processamento', 'Valor': totalErrors },
      { 'Métrica / Indicador': 'Taxa de Sucesso de Enquadramento Directo', 'Valor': totalProcessed > 0 ? `${((totalClassified / totalProcessed) * 100).toFixed(2)}%` : '0%' },
      { 'Métrica / Indicador': 'Empresas Optantes do Simples Nacional', 'Valor': totalSimples },
      { 'Métrica / Indicador': 'Empresas Optantes do MEI / SIMEI', 'Valor': totalMei },
      { 'Métrica / Indicador': 'Limiar de Confiança Aplicado', 'Valor': `${municipality.confidenceThreshold}%` },
    ];

    const sheetResumo = XLSX.utils.json_to_sheet(resumoData);
    XLSX.utils.book_append_sheet(workbook, sheetResumo, 'Resumo');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }
}
