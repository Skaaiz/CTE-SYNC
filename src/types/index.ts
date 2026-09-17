export interface PdfAttachment {
  id: string;
  fileName: string;
  fileUrl?: string;
  uploadedAt: string;
  sizeBytes?: number;
  textLength?: number;
  isMainCtm?: boolean;
}

export interface Municipality {
  id: string;
  nome: string;
  uf: string;
  ctmFileName: string | null;
  ctmFileUrl: string | null;
  ctmContentText?: string | null;
  pdfAttachments?: PdfAttachment[];
  openaiVectorStoreId: string | null;
  aiInstructions: string;
  fallbackActivityId: string;
  fallbackActivityDescription: string;
  confidenceThreshold: number; // e.g., 80
  createdAt: string;
  updatedAt: string;
}

export interface MunicipalityRule {
  id: string;
  municipalityId: string;
  name: string;
  condition: string; // e.g., "CNAE == '47.21-1-03'"
  instruction: string;
  priority: number;
  active: boolean;
  createdAt: string;
}

export interface ClassificationMapping {
  id: string;
  municipalityId: string;
  cnae: string;
  cnaeDescription: string;
  ctmActivityCode: string;
  ctmActivityDescription: string;
  validated: boolean;
  source: 'MANUAL_REVIEW' | 'IA_APPROVED' | 'RULE';
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisJob {
  id: string;
  municipalityId: string;
  municipalityName: string;
  fileName: string;
  status: 'WAITING' | 'PROCESSING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
  total: number;
  processed: number;
  success: number;
  errors: number;
  notFound: number;
  requiresReviewCount: number;
  currentProcessingCnpj: string | null;
  currentProcessingName: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdBy: string;
}

export interface ReceitaWsData {
  tipo: string;
  dataAbertura: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacao: string;
  dataSituacao: string;
  motivoSituacao: string;
  cnaePrincipalCode: string;
  cnaePrincipalText: string;
  cnaesSecundarios: Array<{ code: string; text: string }>;
  naturezaJuridica: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  email: string;
  telefone: string;
  capitalSocial: string;
  qsa: Array<{ nome: string; qual: string }>;
  simplesOptante: boolean;
  simplesDataOpcao: string | null;
  simplesDataExclusao: string | null;
  meiOptante: boolean;
  meiDataOpcao: string | null;
  meiDataExclusao: string | null;
  receitaWsLastUpdate: string;
  rawJson: Record<string, any>;
}

export interface CompanyClassification {
  matched: boolean;
  ctmActivityCode: string;
  ctmActivityDescription: string;
  confidence: number;
  sourcePage: string;
  sourceExcerpt: string;
  reasoningSummary: string;
  alternatives: Array<{ ctmActivityCode: string; ctmActivityDescription: string; confidence: number }>;
  requiresReview: boolean;
  classificationSource: 'MAPPING' | 'RULE' | 'OPENAI' | 'FALLBACK' | 'MANUAL';
  reviewedBy?: string;
  reviewedAt?: string;
  aiModelUsed?: string;
  vectorStoreIdUsed?: string;
}

export interface JobCompany {
  id: string;
  jobId: string;
  municipalityId: string;
  cnpj: string; // 14 digits clean
  formattedCnpj: string;
  status: 'PENDING' | 'SUCCESS' | 'NOT_FOUND' | 'ERROR';
  errorDetails?: string;
  receitaWsData?: ReceitaWsData;
  classification?: CompanyClassification;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  municipalityId: string;
  jobId?: string;
  companyCnpj?: string;
  action: string;
  details: string;
  dataSent?: any;
  resultData?: any;
  user: string;
  timestamp: string;
}

export interface ExcelImportPreview {
  fileName: string;
  totalRows: number;
  cnpjColumn: string;
  availableColumns: string[];
  cnpjsIdentified: number;
  validCnpjs: number;
  duplicateCnpjs: number;
  invalidCnpjs: number;
  previewRows: Array<{ rawCnpj: string; cleanCnpj: string; isValid: boolean; isDuplicate: boolean; rowData: Record<string, any> }>;
  validCleanCnpjs: string[];
}
