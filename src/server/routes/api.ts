import { Router, Request, Response } from 'express';
import multer from 'multer';
import * as pdfParseModule from 'pdf-parse';

async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    // 1. Try pdf-parse v2 PDFParse class
    const PDFParseClass = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default?.PDFParse;
    if (typeof PDFParseClass === 'function') {
      const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
      const res = await parser.getText();
      const text = res?.text || '';
      if (typeof parser.destroy === 'function') {
        try {
          await parser.destroy();
        } catch (_) {}
      }
      return text;
    }

    // 2. Try pdf-parse v1 function
    const fn = typeof pdfParseModule === 'function' 
      ? pdfParseModule 
      : (pdfParseModule as any).default || (pdfParseModule as any).pdfParse;
    if (typeof fn === 'function') {
      const res = await fn(buffer);
      return res?.text || '';
    }

    // 3. Fallback: extract printable strings from raw buffer
    const str = buffer.toString('utf-8');
    const matches = str.match(/[\x20-\x7E\s]{4,}/g);
    return matches ? matches.join(' ') : '';
  } catch (err) {
    console.warn('[PDF Text Extraction Warning]:', err);
    try {
      const str = buffer.toString('utf-8');
      const matches = str.match(/[\x20-\x7E\s]{4,}/g);
      return matches ? matches.join(' ') : '';
    } catch {
      return '';
    }
  }
}
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Municipality,
  MunicipalityRule,
  ClassificationMapping,
  AnalysisJob,
  JobCompany,
  AuditLog,
} from '../../types';
import { ExcelService } from '../services/excelService';
import { JobProcessor } from '../services/jobProcessor';
import { OpenAiService } from '../services/openaiService';
import { formatCnpj, normalizeCnpj } from '../services/receitaWsService';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

export const apiRouter = Router();

// ============================================================================
// 1. MUNICIPALITIES
// ============================================================================

// List all municipalities (Seed default municipalities if empty on initial run)
apiRouter.get('/municipalities', async (req: Request, res: Response) => {
  try {
    const sysConfigRef = doc(db, 'system', 'config');
    const sysConfigSnap = await getDoc(sysConfigRef);
    const isInitialized = sysConfigSnap.exists() && sysConfigSnap.data().initialized;

    const colRef = collection(db, 'municipalities');
    const snap = await getDocs(colRef);

    if (snap.empty && !isInitialized) {
      // Seed initial default municipalities
      const defaults: Omit<Municipality, 'id'>[] = [
        {
          nome: 'Anajatuba',
          uf: 'MA',
          ctmFileName: null,
          ctmFileUrl: null,
          openaiVectorStoreId: null,
          aiInstructions: 'Quando o CNAE representar comércio varejista de alimentos, priorize a atividade Comércio de Gêneros Alimentícios. Quando não existir atividade específica no CTM, utilize a classificação Outros Estabelecimentos Comerciais.',
          fallbackActivityId: 'OUTROS-01',
          fallbackActivityDescription: 'Outros Estabelecimentos Comerciais e de Serviços',
          confidenceThreshold: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          nome: 'Pio XII',
          uf: 'MA',
          ctmFileName: null,
          ctmFileUrl: null,
          openaiVectorStoreId: null,
          aiInstructions: 'Priorizar atividades do setor agropecuário e comércio de insumos rurais quando identificados nos CNAEs primários.',
          fallbackActivityId: 'GERAL-02',
          fallbackActivityDescription: 'Atividades Comerciais Diversas sem Especificação',
          confidenceThreshold: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          nome: 'Morros',
          uf: 'MA',
          ctmFileName: null,
          ctmFileUrl: null,
          openaiVectorStoreId: null,
          aiInstructions: 'Priorizar atividades voltadas a turismo, pousadas e serviços de alimentação e lazer.',
          fallbackActivityId: 'TURISMO-01',
          fallbackActivityDescription: 'Serviços Turísticos e Comerciais Correlatos',
          confidenceThreshold: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          nome: 'Igarapé do Meio',
          uf: 'MA',
          ctmFileName: null,
          ctmFileUrl: null,
          openaiVectorStoreId: null,
          aiInstructions: 'Priorizar serviços de transporte de cargas e comércio geral.',
          fallbackActivityId: 'SERVICOS-01',
          fallbackActivityDescription: 'Outros Serviços Tributáveis de Qualquer Natureza',
          confidenceThreshold: 80,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      const seeded: Municipality[] = [];
      for (const item of defaults) {
        const id = item.nome.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const newDocRef = doc(db, 'municipalities', id);
        const data: Municipality = { id, ...item };
        await setDoc(newDocRef, data);
        seeded.push(data);
      }
      await setDoc(sysConfigRef, { initialized: true, seededAt: new Date().toISOString() }, { merge: true });
      return res.json(seeded);
    }

    const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Municipality[];
    res.json(list);
  } catch (err: any) {
    console.error('[API Error /municipalities]:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar municípios.' });
  }
});

// Dashboard Stats endpoint
apiRouter.get('/dashboard/stats', async (req: Request, res: Response) => {
  try {
    const munisSnap = await getDocs(collection(db, 'municipalities'));
    const totalMunicipalities = munisSnap.size;

    let totalPdfFiles = 0;
    const municipalitiesList: { id: string; nome: string; uf: string; pdfsCount: number }[] = [];
    munisSnap.docs.forEach(docSnap => {
      const data = docSnap.data() as Municipality;
      const pdfsCount = data.pdfAttachments ? data.pdfAttachments.length : (data.ctmFileName ? 1 : 0);
      totalPdfFiles += pdfsCount;
      municipalitiesList.push({
        id: docSnap.id,
        nome: data.nome,
        uf: data.uf,
        pdfsCount,
      });
    });

    const jobsSnap = await getDocs(collection(db, 'analysisJobs'));
    const totalJobs = jobsSnap.size;
    let totalCompaniesAnalyzed = 0;
    let totalErrors = 0;
    let totalRequiresReview = 0;

    const recentJobs: AnalysisJob[] = [];
    jobsSnap.docs.forEach(docSnap => {
      const job = { id: docSnap.id, ...docSnap.data() } as AnalysisJob;
      totalCompaniesAnalyzed += job.processed || 0;
      totalErrors += job.errors || 0;
      totalRequiresReview += job.requiresReviewCount || 0;
      recentJobs.push(job);
    });

    recentJobs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const compSnap = await getDocs(collection(db, 'jobCompanies'));
    const totalJobCompanies = compSnap.size;

    let validatedCount = 0;
    let fallbackCount = 0;
    let highConfidenceCount = 0;
    let manualReviewCount = 0;

    compSnap.docs.forEach(docSnap => {
      const comp = docSnap.data() as JobCompany;
      if (comp.classification) {
        if (comp.classification.classificationSource === 'MANUAL') {
          manualReviewCount++;
          validatedCount++;
        } else if (comp.classification.classificationSource === 'FALLBACK') {
          fallbackCount++;
        } else if (comp.classification.confidence >= 80) {
          highConfidenceCount++;
          validatedCount++;
        }
      }
    });

    res.json({
      totalMunicipalities,
      totalCompanies: Math.max(totalCompaniesAnalyzed, totalJobCompanies),
      totalJobs,
      totalPdfFiles,
      validatedCount,
      pendingReviews: totalRequiresReview,
      fallbackCount,
      highConfidenceCount,
      manualReviewCount,
      totalErrors,
      municipalitiesList,
      recentJobs: recentJobs.slice(0, 8),
    });
  } catch (err: any) {
    console.error('[Dashboard Stats Error]:', err);
    res.status(500).json({ error: err.message || 'Erro ao carregar métricas do dashboard.' });
  }
});

// Create new municipality
apiRouter.post('/municipalities', async (req: Request, res: Response) => {
  try {
    const { nome, uf, aiInstructions, fallbackActivityId, fallbackActivityDescription, confidenceThreshold } = req.body;
    if (!nome || !uf) {
      return res.status(400).json({ error: 'Nome e UF do município são obrigatórios.' });
    }

    const id = `${nome.trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
    const muni: Municipality = {
      id,
      nome: nome.trim(),
      uf: String(uf).trim().toUpperCase(),
      ctmFileName: null,
      ctmFileUrl: null,
      openaiVectorStoreId: null,
      aiInstructions: aiInstructions || '',
      fallbackActivityId: fallbackActivityId || 'OUTROS-01',
      fallbackActivityDescription: fallbackActivityDescription || 'Outras Atividades sem Especificação',
      confidenceThreshold: Number(confidenceThreshold) || 80,
      pdfAttachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const cleanData = JSON.parse(JSON.stringify(muni));
    await setDoc(doc(db, 'municipalities', id), cleanData);
    res.status(201).json(muni);
  } catch (err: any) {
    console.error('[API Error /municipalities POST]:', err);
    res.status(500).json({ error: err.message || 'Erro ao criar município no banco de dados.' });
  }
});

// Update municipality
apiRouter.put('/municipalities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const muniRef = doc(db, 'municipalities', id);
    const snap = await getDoc(muniRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }

    const updateData: Record<string, any> = {
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    await updateDoc(muniRef, updateData);
    const updatedSnap = await getDoc(muniRef);
    res.json({ id: updatedSnap.id, ...updatedSnap.data() });
  } catch (err: any) {
    console.error('[API Error /municipalities PUT]:', err);
    res.status(500).json({ error: err.message || 'Erro ao atualizar município.' });
  }
});

// Delete municipality and all associated data
apiRouter.delete('/municipalities/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const muniRef = doc(db, 'municipalities', id);
    const snap = await getDoc(muniRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }

    // 1. Delete associated rules in 'municipalityRules'
    try {
      const rulesQ = query(collection(db, 'municipalityRules'), where('municipalityId', '==', id));
      const rulesSnap = await getDocs(rulesQ);
      for (const ruleDoc of rulesSnap.docs) {
        await deleteDoc(ruleDoc.ref);
      }
    } catch (e) {
      console.warn('[Delete Cascade Rules Warning]:', e);
    }

    // 2. Delete associated mappings in 'classificationMappings'
    try {
      const mappingsQ = query(collection(db, 'classificationMappings'), where('municipalityId', '==', id));
      const mappingsSnap = await getDocs(mappingsQ);
      for (const mapDoc of mappingsSnap.docs) {
        await deleteDoc(mapDoc.ref);
      }
    } catch (e) {
      console.warn('[Delete Cascade Mappings Warning]:', e);
    }

    // 3. Delete associated analysis jobs in 'analysisJobs' & 'jobCompanies'
    try {
      const jobsQ = query(collection(db, 'analysisJobs'), where('municipalityId', '==', id));
      const jobsSnap = await getDocs(jobsQ);
      for (const jobDoc of jobsSnap.docs) {
        const jobId = jobDoc.id;
        const compQ = query(collection(db, 'jobCompanies'), where('jobId', '==', jobId));
        const compSnap = await getDocs(compQ);
        for (const compDoc of compSnap.docs) {
          await deleteDoc(compDoc.ref);
        }
        await deleteDoc(jobDoc.ref);
      }
    } catch (e) {
      console.warn('[Delete Cascade Jobs Warning]:', e);
    }

    // 4. Delete municipality document itself
    await deleteDoc(muniRef);

    // Ensure system flag stays marked as initialized
    await setDoc(doc(db, 'system', 'config'), { initialized: true }, { merge: true });

    res.json({ message: 'Município e todos os seus dados cadastrais foram excluídos com sucesso.' });
  } catch (err: any) {
    console.error('[API Delete Municipality Error]:', err);
    res.status(500).json({ error: err.message || 'Erro ao excluir município.' });
  }
});

// Upload CTM / Attachment PDF file for a municipality
apiRouter.post('/municipalities/:id/pdf', upload.single('pdfFile'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    const isMainCtm = req.body.isMainCtm === 'true' || req.body.isMainCtm === true;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo PDF não foi enviado.' });
    }

    const muniRef = doc(db, 'municipalities', id);
    const snap = await getDoc(muniRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }

    const muni = snap.data() as Municipality;

    // Parse PDF text
    const extractedText = await extractTextFromPdfBuffer(file.buffer);

    // Try OpenAI Vector Store creation
    const vsResult = await OpenAiService.createVectorStoreForCtm(muni.nome, file.buffer, file.originalname);

    // Build new PdfAttachment
    const newPdfAttachment = {
      id: `pdf_${Date.now()}`,
      fileName: file.originalname,
      uploadedAt: new Date().toISOString(),
      sizeBytes: file.size,
      textLength: extractedText.length,
      isMainCtm,
    };

    const currentPdfAttachments = muni.pdfAttachments || [];
    const updatedPdfAttachments = [...currentPdfAttachments, newPdfAttachment];

    // Combine extracted text with existing text
    const existingText = muni.ctmContentText || '';
    const combinedText = (existingText ? `${existingText}\n\n--- DOCUMENTO: ${file.originalname} ---\n\n` : '') + extractedText;

    const updatePayload: Partial<Municipality> = {
      pdfAttachments: updatedPdfAttachments,
      ctmContentText: combinedText.slice(0, 150000),
      openaiVectorStoreId: vsResult.vectorStoreId || muni.openaiVectorStoreId,
      updatedAt: new Date().toISOString(),
    };

    if (isMainCtm || !muni.ctmFileName) {
      updatePayload.ctmFileName = file.originalname;
      updatePayload.ctmFileUrl = `data:application/pdf;base64,${file.buffer.toString('base64').slice(0, 500)}...`;
    }

    await updateDoc(muniRef, updatePayload);
    const updatedSnap = await getDoc(muniRef);

    res.json({
      message: 'Arquivo PDF adicionado e indexado com sucesso!',
      municipality: { id: updatedSnap.id, ...updatedSnap.data() },
      openaiVectorStoreId: vsResult.vectorStoreId,
      extractedTextLength: extractedText.length,
      openaiError: vsResult.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao processar o arquivo PDF.' });
  }
});

// Delete PDF attachment from municipality
apiRouter.delete('/municipalities/:id/pdf/:pdfId', async (req: Request, res: Response) => {
  try {
    const { id, pdfId } = req.params;
    const muniRef = doc(db, 'municipalities', id);
    const snap = await getDoc(muniRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }

    const muni = snap.data() as Municipality;
    const currentPdfAttachments = muni.pdfAttachments || [];
    const targetPdf = currentPdfAttachments.find(p => p.id === pdfId);

    const updatedPdfAttachments = currentPdfAttachments.filter(p => p.id !== pdfId);

    const updatePayload: Record<string, any> = {
      pdfAttachments: updatedPdfAttachments,
      updatedAt: new Date().toISOString(),
    };

    const isDeletingMain = targetPdf && (muni.ctmFileName === targetPdf.fileName || targetPdf.isMainCtm);

    if (updatedPdfAttachments.length === 0) {
      updatePayload.ctmFileName = null;
      updatePayload.ctmFileUrl = null;
      updatePayload.ctmContentText = '';
      updatePayload.openaiVectorStoreId = null;
    } else if (isDeletingMain) {
      // Promote first remaining PDF as main CTM
      updatedPdfAttachments[0] = { ...updatedPdfAttachments[0], isMainCtm: true };
      updatePayload.ctmFileName = updatedPdfAttachments[0].fileName;
      updatePayload.pdfAttachments = updatedPdfAttachments;
    }

    await updateDoc(muniRef, updatePayload);
    const updatedSnap = await getDoc(muniRef);

    res.json({
      message: 'Arquivo PDF excluído com sucesso.',
      municipality: { id: updatedSnap.id, ...updatedSnap.data() },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao excluir o arquivo PDF.' });
  }
});

// Upload CTM PDF file
apiRouter.post('/municipalities/:id/ctm', upload.single('ctmFile'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Arquivo PDF do CTM não enviado.' });
    }

    const muniRef = doc(db, 'municipalities', id);
    const snap = await getDoc(muniRef);
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }

    const muni = snap.data() as Municipality;

    // Parse PDF text
    const extractedText = await extractTextFromPdfBuffer(file.buffer);

    // Try OpenAI Vector Store creation if configured
    const vsResult = await OpenAiService.createVectorStoreForCtm(muni.nome, file.buffer, file.originalname);

    const newPdfAttachment = {
      id: `pdf_${Date.now()}`,
      fileName: file.originalname,
      uploadedAt: new Date().toISOString(),
      sizeBytes: file.size,
      textLength: extractedText.length,
      isMainCtm: true,
    };

    const currentPdfAttachments = (muni.pdfAttachments || []).filter(p => !p.isMainCtm);
    const updatedPdfAttachments = [newPdfAttachment, ...currentPdfAttachments];

    const updatePayload: Partial<Municipality> = {
      ctmFileName: file.originalname,
      ctmFileUrl: `data:application/pdf;base64,${file.buffer.toString('base64').slice(0, 500)}...`, // Metadata preview
      ctmContentText: extractedText.slice(0, 100000), // Persist extracted text in Firestore for reference
      pdfAttachments: updatedPdfAttachments,
      openaiVectorStoreId: vsResult.vectorStoreId || muni.openaiVectorStoreId,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(muniRef, updatePayload);
    const updatedSnap = await getDoc(muniRef);

    res.json({
      message: 'CTM enviado e indexado com sucesso!',
      municipality: { id: updatedSnap.id, ...updatedSnap.data() },
      ctmFileName: file.originalname,
      openaiVectorStoreId: vsResult.vectorStoreId,
      extractedTextLength: extractedText.length,
      openaiError: vsResult.error,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao processar CTM.' });
  }
});

// ============================================================================
// 2. RULES
// ============================================================================

// List rules for municipality
apiRouter.get('/municipalities/:id/rules', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const q = query(collection(db, 'municipalityRules'), where('municipalityId', '==', id));
    const snap = await getDocs(q);
    const rules = snap.docs.map(d => ({ id: d.id, ...d.data() })) as MunicipalityRule[];
    rules.sort((a, b) => b.priority - a.priority);
    res.json(rules);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create rule
apiRouter.post('/municipalities/:id/rules', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, condition, instruction, priority } = req.body;
    if (!name || !condition || !instruction) {
      return res.status(400).json({ error: 'Nome, condição e instrução da regra são obrigatórios.' });
    }

    const ruleId = `rule_${Date.now()}`;
    const rule: MunicipalityRule = {
      id: ruleId,
      municipalityId: id,
      name,
      condition,
      instruction,
      priority: Number(priority) || 1,
      active: true,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'municipalityRules', ruleId), rule);
    res.status(201).json(rule);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete rule
apiRouter.delete('/rules/:ruleId', async (req: Request, res: Response) => {
  try {
    const { ruleId } = req.params;
    await deleteDoc(doc(db, 'municipalityRules', ruleId));
    res.json({ message: 'Regra excluída com sucesso.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 3. MAPPINGS (MEMÓRIA OPERACIONAL)
// ============================================================================

// List mappings for municipality
apiRouter.get('/municipalities/:id/mappings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const q = query(collection(db, 'classificationMappings'), where('municipalityId', '==', id));
    const snap = await getDocs(q);
    const mappings = snap.docs.map(d => ({ id: d.id, ...d.data() })) as ClassificationMapping[];
    res.json(mappings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update classification mapping
apiRouter.post('/municipalities/:id/mappings', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { cnae, cnaeDescription, ctmActivityCode, ctmActivityDescription, source } = req.body;
    if (!cnae || !ctmActivityCode) {
      return res.status(400).json({ error: 'CNAE e Código CTM são obrigatórios.' });
    }

    const mappingId = `map_${id}_${normalizeCnpj(cnae)}`;
    const mapping: ClassificationMapping = {
      id: mappingId,
      municipalityId: id,
      cnae: normalizeCnpj(cnae),
      cnaeDescription: cnaeDescription || '',
      ctmActivityCode,
      ctmActivityDescription: ctmActivityDescription || '',
      validated: true,
      source: source || 'MANUAL_REVIEW',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(db, 'classificationMappings', mappingId), mapping);
    res.json(mapping);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// 4. JOBS & EXCEL IMPORT
// ============================================================================

// Preview uploaded Excel
apiRouter.post('/jobs/preview-excel', upload.single('excelFile'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Nenhum arquivo Excel enviado.' });
    }

    const targetColumn = req.body.cnpjColumn;
    const preview = ExcelService.parseExcelForCnpjs(file.buffer, file.originalname, targetColumn);
    res.json(preview);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao analisar arquivo Excel.' });
  }
});

// Start Analysis Job
apiRouter.post('/jobs/start', upload.single('excelFile'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    const { municipalityId, cnpjColumn, createdBy } = req.body;

    if (!municipalityId) {
      return res.status(400).json({ error: 'ID do Município é obrigatório.' });
    }
    if (!file) {
      return res.status(400).json({ error: 'Arquivo Excel é obrigatório.' });
    }

    const muniSnap = await getDoc(doc(db, 'municipalities', municipalityId));
    if (!muniSnap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }
    const muni = muniSnap.data() as Municipality;

    const parsed = ExcelService.parseExcelForCnpjs(file.buffer, file.originalname, cnpjColumn);

    if (parsed.validCleanCnpjs.length === 0) {
      return res.status(400).json({ error: 'Nenhum CNPJ válido identificado na planilha enviada.' });
    }

    const jobId = `job_${Date.now()}`;
    const job: AnalysisJob = {
      id: jobId,
      municipalityId,
      municipalityName: `${muni.nome} - ${muni.uf}`,
      fileName: file.originalname,
      status: 'WAITING',
      total: parsed.validCleanCnpjs.length,
      processed: 0,
      success: 0,
      errors: 0,
      notFound: 0,
      requiresReviewCount: 0,
      currentProcessingCnpj: null,
      currentProcessingName: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      createdBy: createdBy || 'Usuário do Sistema',
    };

    // 1. Create AnalysisJob document
    await setDoc(doc(db, 'analysisJobs', jobId), job);

    // 2. Populate JobCompany documents
    for (const cnpj of parsed.validCleanCnpjs) {
      const companyId = `${jobId}_${cnpj}`;
      const company: JobCompany = {
        id: companyId,
        jobId,
        municipalityId,
        cnpj,
        formattedCnpj: formatCnpj(cnpj),
        status: 'PENDING',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'jobCompanies', companyId), company);
    }

    // 3. Trigger Job Processor in background
    JobProcessor.processJob(jobId).catch(err => console.error('[Background Job Error]:', err));

    res.status(201).json(job);
  } catch (err: any) {
    console.error('[API Start Job Error]:', err);
    res.status(500).json({ error: err.message || 'Erro ao iniciar job de análise.' });
  }
});

// Get Analysis Job details
apiRouter.get('/jobs/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const snap = await getDoc(doc(db, 'analysisJobs', id));
    if (!snap.exists()) {
      return res.status(404).json({ error: 'Job não encontrado.' });
    }
    res.json({ id: snap.id, ...snap.data() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List Analysis Jobs for municipality or all
apiRouter.get('/jobs', async (req: Request, res: Response) => {
  try {
    const { municipalityId } = req.query;
    let q = query(collection(db, 'analysisJobs'));
    if (municipalityId) {
      q = query(collection(db, 'analysisJobs'), where('municipalityId', '==', String(municipalityId)));
    }
    const snap = await getDocs(q);
    const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AnalysisJob[];
    jobs.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
    res.json(jobs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pause Job
apiRouter.post('/jobs/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobRef = doc(db, 'analysisJobs', id);
    await updateDoc(jobRef, { status: 'PAUSED' });
    res.json({ message: 'Job pausado com sucesso.', status: 'PAUSED' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Resume Job
apiRouter.post('/jobs/:id/resume', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobRef = doc(db, 'analysisJobs', id);
    await updateDoc(jobRef, { status: 'PROCESSING' });
    
    // Trigger JobProcessor in background
    JobProcessor.processJob(id).catch(err => console.error('[Background Job Error]:', err));
    
    res.json({ message: 'Job retomado com sucesso.', status: 'PROCESSING' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get companies for a job
apiRouter.get('/jobs/:id/companies', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const q = query(collection(db, 'jobCompanies'), where('jobId', '==', id));
    const snap = await getDocs(q);
    const companies = snap.docs.map(d => ({ id: d.id, ...d.data() })) as JobCompany[];
    res.json(companies);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Manual Review override
apiRouter.post('/jobs/:jobId/companies/:companyId/review', async (req: Request, res: Response) => {
  try {
    const { jobId, companyId } = req.params;
    const { ctmActivityCode, ctmActivityDescription, saveAsFutureRule, reviewedBy } = req.body;

    const compRef = doc(db, 'jobCompanies', companyId);
    const compSnap = await getDoc(compRef);
    if (!compSnap.exists()) {
      return res.status(404).json({ error: 'Registro da empresa não encontrado.' });
    }

    const company = compSnap.data() as JobCompany;

    const updatedClassification = {
      ...(company.classification || {
        matched: true,
        confidence: 100,
        sourcePage: 'Revisão Manual',
        sourceExcerpt: 'Definido diretamente por analista tributário',
        reasoningSummary: 'Revisão e enquadramento efetuado manualmente.',
        alternatives: [],
      }),
      matched: true,
      ctmActivityCode,
      ctmActivityDescription,
      confidence: 100,
      requiresReview: false,
      classificationSource: 'MANUAL' as const,
      reviewedBy: reviewedBy || 'Analista Tributário',
      reviewedAt: new Date().toISOString(),
    };

    await updateDoc(compRef, {
      classification: updatedClassification,
      updatedAt: new Date().toISOString(),
    });

    // Optionally save to ClassificationMapping (Memória Operacional)
    if (saveAsFutureRule && company.receitaWsData?.cnaePrincipalCode) {
      const mappingId = `map_${company.municipalityId}_${normalizeCnpj(company.receitaWsData.cnaePrincipalCode)}`;
      const mapping: ClassificationMapping = {
        id: mappingId,
        municipalityId: company.municipalityId,
        cnae: normalizeCnpj(company.receitaWsData.cnaePrincipalCode),
        cnaeDescription: company.receitaWsData.cnaePrincipalText || '',
        ctmActivityCode,
        ctmActivityDescription,
        validated: true,
        source: 'MANUAL_REVIEW',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'classificationMappings', mappingId), mapping);
    }

    res.json({ message: 'Revisão salva com sucesso!', classification: updatedClassification });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Export job results as Excel (.xlsx)
apiRouter.get('/jobs/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const jobSnap = await getDoc(doc(db, 'analysisJobs', id));
    if (!jobSnap.exists()) {
      return res.status(404).json({ error: 'Job não encontrado.' });
    }
    const job = { id: jobSnap.id, ...jobSnap.data() } as AnalysisJob;

    const muniSnap = await getDoc(doc(db, 'municipalities', job.municipalityId));
    if (!muniSnap.exists()) {
      return res.status(404).json({ error: 'Município não encontrado.' });
    }
    const municipality = { id: muniSnap.id, ...muniSnap.data() } as Municipality;

    const compQuery = query(collection(db, 'jobCompanies'), where('jobId', '==', id));
    const compSnap = await getDocs(compQuery);
    const companies = compSnap.docs.map(d => ({ id: d.id, ...d.data() })) as JobCompany[];

    const excelBuffer = ExcelService.generateExportWorkbook(job, municipality, companies);

    const filename = `Analise_Cadastral_${municipality.nome.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (err: any) {
    console.error('[API Export Error]:', err);
    res.status(500).json({ error: err.message || 'Erro ao gerar exportação Excel.' });
  }
});
