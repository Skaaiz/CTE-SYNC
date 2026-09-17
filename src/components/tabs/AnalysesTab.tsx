import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Play,
  Pause,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
  Filter,
  Eye,
  RefreshCw,
  X,
  FileText,
  Building,
  UserCheck,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { AnalysisJob, JobCompany, Municipality } from '../../types';

interface AnalysesTabProps {
  municipality: Municipality;
  jobs: AnalysisJob[];
  selectedJob: AnalysisJob | null;
  onSelectJob: (job: AnalysisJob | null) => void;
  onOpenReview: (company: JobCompany) => void;
}

export const AnalysesTab: React.FC<AnalysesTabProps> = ({
  municipality,
  jobs,
  selectedJob,
  onSelectJob,
  onOpenReview,
}) => {
  const [liveJob, setLiveJob] = useState<AnalysisJob | null>(selectedJob);
  const [companies, setCompanies] = useState<JobCompany[]>([]);
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [selectedCompanyDetail, setSelectedCompanyDetail] = useState<JobCompany | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Subscribe to real-time updates for selected Job
  useEffect(() => {
    if (!selectedJob) {
      setLiveJob(null);
      setCompanies([]);
      return;
    }

    setLiveJob(selectedJob);

    // 1. Listen to AnalysisJob document
    const jobUnsub = onSnapshot(doc(db, 'analysisJobs', selectedJob.id), snap => {
      if (snap.exists()) {
        setLiveJob({ id: snap.id, ...snap.data() } as AnalysisJob);
      }
    });

    // 2. Listen to JobCompany collection
    setIsLoadingCompanies(true);
    const q = query(collection(db, 'jobCompanies'), where('jobId', '==', selectedJob.id));
    const compUnsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as JobCompany[];
      setCompanies(list);
      setIsLoadingCompanies(false);
    });

    return () => {
      jobUnsub();
      compUnsub();
    };
  }, [selectedJob]);

  const handlePause = async () => {
    if (!liveJob) return;
    try {
      await fetch(`/api/jobs/${liveJob.id}/pause`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleResume = async () => {
    if (!liveJob) return;
    try {
      await fetch(`/api/jobs/${liveJob.id}/resume`, { method: 'POST' });
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportExcel = async () => {
    if (!liveJob) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/jobs/${liveJob.id}/export`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || 'Falha ao gerar planilha.');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Analise_Cadastral_${municipality.nome.replace(/\s+/g, '_')}_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Erro ao baixar planilha');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter logic for results table
  const filteredCompanies = companies.filter(c => {
    const rw = c.receitaWsData;
    const cl = c.classification;

    // Search term matching
    const matchesSearch =
      !searchTerm.trim() ||
      c.cnpj.includes(searchTerm) ||
      c.formattedCnpj?.includes(searchTerm) ||
      rw?.razaoSocial?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rw?.nomeFantasia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rw?.cnaePrincipalCode?.includes(searchTerm) ||
      cl?.ctmActivityCode?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'ATIVA') return rw?.situacao === 'ATIVA';
    if (activeFilter === 'BAIXADA') return rw?.situacao === 'BAIXADA' || rw?.situacao === 'INAPTA';
    if (activeFilter === 'SIMPLES') return Boolean(rw?.simplesOptante);
    if (activeFilter === 'NAO_SIMPLES') return rw && !rw.simplesOptante;
    if (activeFilter === 'MEI') return Boolean(rw?.meiOptante);
    if (activeFilter === 'NAO_MEI') return rw && !rw.meiOptante;
    if (activeFilter === 'CLASSIFIED') return cl?.matched && !cl?.requiresReview;
    if (activeFilter === 'REVIEW') return cl?.requiresReview || c.status === 'ERROR' || c.status === 'NOT_FOUND';
    if (activeFilter === 'NOT_FOUND') return c.status === 'NOT_FOUND';

    return true;
  });

  // Calculate estimated remaining time (ReceitaWS rate limit: 20 seconds per item)
  const remainingItems = Math.max(0, (liveJob?.total || 0) - (liveJob?.processed || 0));
  const estimatedSeconds = remainingItems * 20; // 3 per minute = 20 sec each
  const estMinutes = Math.floor(estimatedSeconds / 60);
  const estHours = (estMinutes / 60).toFixed(1);

  if (!selectedJob || !liveJob) {
    return (
      <div className="space-y-6">
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 flex items-center justify-between shadow-xl">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Análises do Município</h2>
            <p className="text-xs text-gray-400 mt-1">
              Selecione um job de análise para visualizar o progresso e os dados cadastrais enquadrados.
            </p>
          </div>
        </div>

        {jobs.length === 0 ? (
          <div className="bg-[#18181b] border border-white/5 rounded-2xl p-12 text-center text-gray-500 space-y-3 shadow-xl">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-gray-600" />
            <p className="text-sm font-semibold text-gray-400">Nenhum lote analisado ainda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map(job => (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="bg-[#18181b] border border-white/5 hover:border-blue-500/30 rounded-2xl p-5 shadow-md transition-all cursor-pointer space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white truncate">{job.fileName}</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      job.status === 'COMPLETED'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : job.status === 'PROCESSING'
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 animate-pulse'
                        : job.status === 'PAUSED'
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                        : 'bg-gray-800 text-gray-400 border-white/5'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Progresso:</span>
                    <span className="font-semibold font-mono text-gray-200">
                      {job.processed} / {job.total} ({Math.round((job.processed / Math.max(1, job.total)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#121214] rounded-full h-2 overflow-hidden border border-white/5">
                    <div
                      className="bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] h-full transition-all duration-300"
                      style={{ width: `${(job.processed / Math.max(1, job.total)) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-white/5">
                  <span>{new Date(job.startedAt || '').toLocaleDateString('pt-BR')}</span>
                  <span className="text-blue-400 font-bold flex items-center space-x-1">
                    <span>Abrir Resultados</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const progressPercent = Math.round((liveJob.processed / Math.max(1, liveJob.total)) * 100);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <div className="flex items-center space-x-2 text-xs text-gray-400 mb-1">
              <button
                onClick={() => onSelectJob(null)}
                className="hover:text-blue-400 font-bold underline"
              >
                Análises
              </button>
              <span>/</span>
              <span className="text-gray-200 font-semibold">{liveJob.fileName}</span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
              <span>{liveJob.fileName}</span>
              <span
                className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${
                  liveJob.status === 'COMPLETED'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : liveJob.status === 'PROCESSING'
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 animate-pulse'
                    : liveJob.status === 'PAUSED'
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-gray-800 text-gray-400 border-white/5'
                }`}
              >
                {liveJob.status}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Município: <strong className="text-gray-200">{municipality.nome} - {municipality.uf}</strong> | Criado por: {liveJob.createdBy}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {liveJob.status === 'PROCESSING' && (
              <button
                onClick={handlePause}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/20 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center space-x-2"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>PAUSAR JOB</span>
              </button>
            )}

            {liveJob.status === 'PAUSED' && (
              <button
                onClick={handleResume}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>RETOMAR JOB</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleExportExcel}
              disabled={isExporting}
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'Gerando planilha...' : 'Baixar planilha'}</span>
            </button>
          </div>
        </div>

        {/* Real-time Progress Bar Widget */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-gray-300">
            <span className="flex items-center space-x-2">
              <RefreshCw className={`w-3.5 h-3.5 ${liveJob.status === 'PROCESSING' ? 'animate-spin text-blue-400' : 'text-gray-500'}`} />
              <span>
                Processando empresas: {liveJob.processed} / {liveJob.total} ({progressPercent}%)
              </span>
            </span>
            {liveJob.status === 'PROCESSING' && (
              <span className="text-gray-400 font-normal">
                Tempo estimado restante: ~{estMinutes > 60 ? `${estHours}h` : `${estMinutes} min`} (Rate Limit ReceitaWS: 3/min)
              </span>
            )}
          </div>

          {/* Progress Bar Visual */}
          <div className="w-full bg-[#121214] rounded-full h-4 p-0.5 border border-white/5 overflow-hidden">
            <div
              className="bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)] h-full rounded-full transition-all duration-500 relative"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
            </div>
          </div>

          {/* Current Processing Item Indicator */}
          {liveJob.status === 'PROCESSING' && liveJob.currentProcessingCnpj && (
            <div className="bg-[#121214] border border-blue-500/20 rounded-xl p-3 text-xs flex items-center justify-between text-gray-300">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <span className="font-bold text-blue-400">Empresa Atual:</span>
                <span className="font-mono text-gray-200">{liveJob.currentProcessingCnpj}</span>
                {liveJob.currentProcessingName && (
                  <>
                    <span className="text-gray-500">-</span>
                    <span className="text-white font-medium truncate max-w-md">{liveJob.currentProcessingName}</span>
                  </>
                )}
              </div>
              <span className="text-[10px] text-gray-500">Consultando ReceitaWS & CTM IA...</span>
            </div>
          )}
        </div>

        {/* Counter Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Processadas</span>
            <p className="text-xl font-bold font-mono text-white mt-1">{liveJob.processed}</p>
          </div>
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Pendentes</span>
            <p className="text-xl font-bold font-mono text-amber-500 mt-1">{liveJob.total - liveJob.processed}</p>
          </div>
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Sucesso</span>
            <p className="text-xl font-bold font-mono text-green-500 mt-1">{liveJob.success}</p>
          </div>
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Revisão Exigida</span>
            <p className="text-xl font-bold font-mono text-amber-500 mt-1">{liveJob.requiresReviewCount}</p>
          </div>
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Não Encontradas</span>
            <p className="text-xl font-bold font-mono text-red-400 mt-1">{liveJob.notFound}</p>
          </div>
          <div className="bg-[#121214] border border-white/5 p-3 rounded-xl text-center">
            <span className="text-gray-400 text-[11px] font-bold uppercase tracking-wider">Erros</span>
            <p className="text-xl font-bold font-mono text-red-500 mt-1">{liveJob.errors}</p>
          </div>
        </div>
      </div>

      {/* Filterable Table Section */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
        {/* Filters and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Quick Filter Tabs */}
          <div className="flex items-center space-x-1 bg-[#121214] p-1.5 rounded-xl border border-white/5 text-xs overflow-x-auto w-full md:w-auto">
            {[
              { id: 'ALL', label: 'Todas' },
              { id: 'ATIVA', label: 'Ativas' },
              { id: 'BAIXADA', label: 'Inaptas / Baixadas' },
              { id: 'SIMPLES', label: 'Simples Nacional' },
              { id: 'MEI', label: 'MEI' },
              { id: 'CLASSIFIED', label: 'Classificadas' },
              { id: 'REVIEW', label: 'Exigem Revisão' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  activeFilter === tab.id
                    ? 'bg-blue-600 text-white font-bold shadow'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por CNPJ, Razão, CNAE..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#121214] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121214] text-gray-500 font-bold uppercase text-[10px] border-b border-white/5">
              <tr>
                <th className="p-3">CNPJ</th>
                <th className="p-3">Razão Social / Fantasia</th>
                <th className="p-3">Situação</th>
                <th className="p-3">CNAE Principal</th>
                <th className="p-3">Simples / MEI</th>
                <th className="p-3">Atividade CTM Enquadrada</th>
                <th className="p-3">Confiança</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#18181b]">
              {isLoadingCompanies ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Carregando resultados da análise...
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    Nenhuma empresa encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map(comp => {
                  const rw = comp.receitaWsData;
                  const cl = comp.classification;

                  return (
                    <tr key={comp.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono text-gray-300 font-medium">
                        {comp.formattedCnpj}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-gray-200 truncate max-w-xs">
                          {rw?.razaoSocial || comp.cnpj}
                        </p>
                        {rw?.nomeFantasia && rw.nomeFantasia !== rw.razaoSocial && (
                          <p className="text-[11px] text-gray-400 truncate max-w-xs">{rw.nomeFantasia}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                            rw?.situacao === 'ATIVA'
                              ? 'bg-green-500/10 text-green-500 border-green-500/20'
                              : comp.status === 'NOT_FOUND'
                              ? 'bg-red-500/10 text-red-500 border-red-500/20'
                              : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                          }`}
                        >
                          {rw?.situacao || comp.status}
                        </span>
                      </td>
                      <td className="p-3 max-w-xs">
                        <p className="font-mono text-blue-400 font-bold">{rw?.cnaePrincipalCode || '-'}</p>
                        <p className="text-[10px] text-gray-400 truncate">{rw?.cnaePrincipalText || '-'}</p>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col space-y-0.5 text-[10px]">
                          <span className={rw?.simplesOptante ? 'text-green-500 font-bold' : 'text-gray-500'}>
                            Simples: {rw?.simplesOptante ? 'SIM' : 'NÃO'}
                          </span>
                          <span className={rw?.meiOptante ? 'text-amber-500 font-bold' : 'text-gray-500'}>
                            MEI: {rw?.meiOptante ? 'SIM' : 'NÃO'}
                          </span>
                        </div>
                      </td>
                      <td className="p-3 max-w-xs">
                        {cl ? (
                          <>
                            <p className="font-mono text-green-500 font-bold">{cl.ctmActivityCode}</p>
                            <p className="text-[10px] text-gray-300 truncate">{cl.ctmActivityDescription}</p>
                          </>
                        ) : (
                          <span className="text-gray-500">Pendente</span>
                        )}
                      </td>
                      <td className="p-3">
                        {cl ? (
                          <span
                            className={`font-mono font-bold ${
                              cl.confidence >= municipality.confidenceThreshold
                                ? 'text-green-500'
                                : 'text-amber-500'
                            }`}
                          >
                            {cl.confidence}%
                          </span>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-2">
                        <button
                          onClick={() => setSelectedCompanyDetail(comp)}
                          className="bg-[#121214] hover:bg-white/5 text-gray-300 p-1.5 rounded-lg border border-white/10 transition-colors"
                          title="Ver detalhes da ReceitaWS"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {cl?.requiresReview && (
                          <button
                            onClick={() => onOpenReview(comp)}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2.5 py-1 rounded text-[10px] uppercase tracking-wider transition-colors"
                          >
                            Revisar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCompanyDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div>
                <h3 className="font-bold text-lg text-white">
                  {selectedCompanyDetail.receitaWsData?.razaoSocial || selectedCompanyDetail.cnpj}
                </h3>
                <p className="text-xs text-gray-400 font-mono">
                  CNPJ: {selectedCompanyDetail.formattedCnpj}
                </p>
              </div>
              <button
                onClick={() => setSelectedCompanyDetail(null)}
                className="text-gray-400 hover:text-white font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedCompanyDetail.receitaWsData ? (
              <div className="space-y-4 text-xs">
                {/* Cadastral Info */}
                <div className="bg-[#121214] p-4 rounded-xl border border-white/5 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-gray-500">Nome Fantasia:</span>
                    <p className="font-medium text-gray-200">{selectedCompanyDetail.receitaWsData.nomeFantasia || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Tipo:</span>
                    <p className="font-medium text-gray-200">{selectedCompanyDetail.receitaWsData.tipo}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Situação Cadastral:</span>
                    <p className="font-medium text-green-500">{selectedCompanyDetail.receitaWsData.situacao}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Abertura:</span>
                    <p className="font-medium text-gray-200">{selectedCompanyDetail.receitaWsData.dataAbertura}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Capital Social:</span>
                    <p className="font-medium text-gray-200">{selectedCompanyDetail.receitaWsData.capitalSocial || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Natureza Jurídica:</span>
                    <p className="font-medium text-gray-200">{selectedCompanyDetail.receitaWsData.naturezaJuridica}</p>
                  </div>
                </div>

                {/* Address */}
                <div className="bg-[#121214] p-4 rounded-xl border border-white/5">
                  <span className="text-gray-500 font-semibold">Endereço Completo:</span>
                  <p className="text-gray-200 mt-1">
                    {selectedCompanyDetail.receitaWsData.logradouro}, {selectedCompanyDetail.receitaWsData.numero} {selectedCompanyDetail.receitaWsData.complemento} - {selectedCompanyDetail.receitaWsData.bairro}, {selectedCompanyDetail.receitaWsData.municipio}/{selectedCompanyDetail.receitaWsData.uf} - CEP {selectedCompanyDetail.receitaWsData.cep}
                  </p>
                </div>

                {/* CNAE */}
                <div className="bg-[#121214] p-4 rounded-xl border border-white/5 space-y-2">
                  <span className="text-gray-500 font-semibold">CNAE Principal:</span>
                  <p className="text-blue-400 font-mono font-bold">
                    {selectedCompanyDetail.receitaWsData.cnaePrincipalCode} - {selectedCompanyDetail.receitaWsData.cnaePrincipalText}
                  </p>

                  {selectedCompanyDetail.receitaWsData.cnaesSecundarios.length > 0 && (
                    <div className="pt-2">
                      <span className="text-gray-500 font-semibold">CNAEs Secundários:</span>
                      <ul className="list-disc pl-4 text-gray-300 space-y-1 mt-1 text-[11px]">
                        {selectedCompanyDetail.receitaWsData.cnaesSecundarios.map((s, idx) => (
                          <li key={idx}>
                            <strong className="text-blue-400 font-mono">{s.code}</strong> - {s.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* QSA */}
                {selectedCompanyDetail.receitaWsData.qsa.length > 0 && (
                  <div className="bg-[#121214] p-4 rounded-xl border border-white/5 space-y-2">
                    <span className="text-gray-500 font-semibold">Quadro de Sócios e Administradores (QSA):</span>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      {selectedCompanyDetail.receitaWsData.qsa.map((s, idx) => (
                        <div key={idx} className="bg-[#18181b] p-2 rounded-lg border border-white/5">
                          <p className="font-bold text-gray-200">{s.nome}</p>
                          <p className="text-[10px] text-gray-400">{s.qual}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-xs">Sem dados detalhados da ReceitaWS.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
