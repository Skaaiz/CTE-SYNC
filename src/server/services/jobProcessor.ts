import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { AnalysisJob, JobCompany, Municipality, MunicipalityRule, ClassificationMapping } from '../../types';
import { ReceitaWsService, formatCnpj } from './receitaWsService';
import { CnaeClassifierService } from './cnaeClassifier';

export class JobProcessor {
  private static activeJobs = new Set<string>();

  /**
   * Start or resume background processing for a specific AnalysisJob
   */
  public static async processJob(jobId: string): Promise<void> {
    if (this.activeJobs.has(jobId)) {
      console.log(`[JobProcessor] Job ${jobId} is already actively processing.`);
      return;
    }

    this.activeJobs.add(jobId);

    try {
      console.log(`[JobProcessor] Starting background processing for job ${jobId}...`);

      const jobRef = doc(db, 'analysisJobs', jobId);
      const jobSnap = await getDoc(jobRef);

      if (!jobSnap.exists()) {
        console.error(`[JobProcessor] Job ${jobId} not found in Firestore.`);
        this.activeJobs.delete(jobId);
        return;
      }

      const jobData = { id: jobSnap.id, ...jobSnap.data() } as AnalysisJob;

      if (jobData.status === 'PAUSED' || jobData.status === 'COMPLETED') {
        console.log(`[JobProcessor] Job ${jobId} is in status ${jobData.status}. Exiting processor.`);
        this.activeJobs.delete(jobId);
        return;
      }

      // Mark job as PROCESSING if it was WAITING
      if (jobData.status === 'WAITING') {
        await updateDoc(jobRef, {
          status: 'PROCESSING',
          startedAt: new Date().toISOString(),
        });
      }

      // Fetch Municipality, Rules, and Mappings
      const muniRef = doc(db, 'municipalities', jobData.municipalityId);
      const muniSnap = await getDoc(muniRef);
      if (!muniSnap.exists()) {
        console.error(`[JobProcessor] Municipality ${jobData.municipalityId} not found.`);
        await updateDoc(jobRef, { status: 'FAILED' });
        this.activeJobs.delete(jobId);
        return;
      }
      const municipality = { id: muniSnap.id, ...muniSnap.data() } as Municipality;

      // Fetch Rules
      const rulesQuery = query(collection(db, 'municipalityRules'), where('municipalityId', '==', municipality.id));
      const rulesSnap = await getDocs(rulesQuery);
      const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as MunicipalityRule[];

      // Fetch Classification Mappings
      const mappingsQuery = query(collection(db, 'classificationMappings'), where('municipalityId', '==', municipality.id));
      const mappingsSnap = await getDocs(mappingsQuery);
      const mappings = mappingsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as ClassificationMapping[];

      // Fetch all pending companies for this job
      const companiesQuery = query(
        collection(db, 'jobCompanies'),
        where('jobId', '==', jobId),
        where('status', '==', 'PENDING')
      );
      const pendingSnap = await getDocs(companiesQuery);
      const pendingCompanies = pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })) as JobCompany[];

      console.log(`[JobProcessor] Found ${pendingCompanies.length} pending companies for job ${jobId}`);

      let processedCount = jobData.processed || 0;
      let successCount = jobData.success || 0;
      let errorCount = jobData.errors || 0;
      let notFoundCount = jobData.notFound || 0;
      let reviewCount = jobData.requiresReviewCount || 0;

      for (const company of pendingCompanies) {
        // Re-check job status in Firestore before processing next company (support live PAUSE)
        const currentJobSnap = await getDoc(jobRef);
        const currentStatus = currentJobSnap.data()?.status;

        if (currentStatus === 'PAUSED' || currentStatus === 'FAILED') {
          console.log(`[JobProcessor] Job ${jobId} status changed to ${currentStatus}. Halting loop.`);
          this.activeJobs.delete(jobId);
          return;
        }

        // Update active processing state in job doc
        await updateDoc(jobRef, {
          currentProcessingCnpj: company.cnpj,
          currentProcessingName: company.cnpj,
        });

        // 1. Fetch from ReceitaWS
        const receitaWsResult = await ReceitaWsService.fetchCnpjData(company.cnpj);

        const companyRef = doc(db, 'jobCompanies', company.id);

        if (receitaWsResult.status === 'SUCCESS' && receitaWsResult.data) {
          const rData = receitaWsResult.data;

          // Update current company name for live tracking UI
          await updateDoc(jobRef, {
            currentProcessingName: rData.razaoSocial || rData.nomeFantasia || formatCnpj(company.cnpj),
          });

          // 2. Classify via Pipeline (Mappings -> Rules -> OpenAI -> Fallback)
          const classification = await CnaeClassifierService.classify(
            municipality,
            rules,
            mappings,
            rData
          );

          if (classification.requiresReview) {
            reviewCount++;
          }

          successCount++;
          processedCount++;

          // Persist company result
          await updateDoc(companyRef, {
            status: 'SUCCESS',
            receitaWsData: rData,
            classification,
            formattedCnpj: formatCnpj(company.cnpj),
            updatedAt: new Date().toISOString(),
          });
        } else if (receitaWsResult.status === 'NOT_FOUND') {
          notFoundCount++;
          processedCount++;

          await updateDoc(companyRef, {
            status: 'NOT_FOUND',
            errorDetails: receitaWsResult.errorMsg || 'CNPJ não encontrado.',
            formattedCnpj: formatCnpj(company.cnpj),
            updatedAt: new Date().toISOString(),
          });
        } else {
          // ERROR status
          errorCount++;
          processedCount++;

          await updateDoc(companyRef, {
            status: 'ERROR',
            errorDetails: receitaWsResult.errorMsg || 'Erro na consulta ReceitaWS.',
            formattedCnpj: formatCnpj(company.cnpj),
            updatedAt: new Date().toISOString(),
          });
        }

        // Update Job counters in Firestore
        await updateDoc(jobRef, {
          processed: processedCount,
          success: successCount,
          errors: errorCount,
          notFound: notFoundCount,
          requiresReviewCount: reviewCount,
        });
      }

      // Check if all items are processed
      const remainingQuery = query(
        collection(db, 'jobCompanies'),
        where('jobId', '==', jobId),
        where('status', '==', 'PENDING')
      );
      const remainingSnap = await getDocs(remainingQuery);

      if (remainingSnap.empty) {
        console.log(`[JobProcessor] Job ${jobId} COMPLETED successfully!`);
        await updateDoc(jobRef, {
          status: 'COMPLETED',
          currentProcessingCnpj: null,
          currentProcessingName: null,
          finishedAt: new Date().toISOString(),
        });
      }

    } catch (err: any) {
      console.error(`[JobProcessor Exception for ${jobId}]:`, err);
      try {
        const jobRef = doc(db, 'analysisJobs', jobId);
        await updateDoc(jobRef, { status: 'FAILED' });
      } catch (e) {}
    } finally {
      this.activeJobs.delete(jobId);
    }
  }
}
