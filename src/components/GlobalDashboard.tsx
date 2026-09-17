import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Paperclip,
  Cpu,
  FileSpreadsheet,
  CheckSquare,
  ShieldCheck,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { Municipality, AnalysisJob } from '../types';

interface DashboardStats {
  totalMunicipalities: number;
  totalCompanies: number;
  totalJobs: number;
  totalPdfFiles: number;
  validatedCount: number;
  pendingReviews: number;
  fallbackCount: number;
  highConfidenceCount: number;
  manualReviewCount: number;
  totalErrors: number;
  municipalitiesList: { id: string; nome: string; uf: string; pdfsCount: number }[];
  recentJobs: AnalysisJob[];
}

interface GlobalDashboardProps {
  municipalities: Municipality[];
  onSelectMunicipality: (muni: Municipality) => void;
  onNavigateToMunicipalities: () => void;
}

export const GlobalDashboard: React.FC<GlobalDashboardProps> = ({
  municipalities,
  onSelectMunicipality,
  onNavigateToMunicipalities,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      } else {
        throw new Error('Falha ao carregar métricas.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Não foi possível carregar as estatísticas em tempo real.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [municipalities]);

  const totalCompanies = stats?.totalCompanies || 0;
  const validatedCount = stats?.validatedCount || 0;
  const pendingReviews = stats?.pendingReviews || 0;
  const accuracyRate = totalCompanies > 0
    ? Math.round((validatedCount / Math.max(1, totalCompanies)) * 100)
    : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* Top Banner */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <BarChart3 className="w-4 h-4" />
            <span>Visão Geral do Sistema</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Dashboard Executivo de Enquadramento
          </h2>
          <p className="text-gray-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Consolidado em tempo real de municípios cadastrados, lotes de CNPJs processados, assertividade da IA e revisões fiscais pendentes.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="bg-[#18181b] hover:bg-[#27272a] text-gray-200 border border-white/10 font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg transition-colors flex items-center space-x-2 shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-blue-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1: Total Municipalities */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Municípios Cadastrados
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {stats ? stats.totalMunicipalities : municipalities.length}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
              <Paperclip className="w-3.5 h-3.5 text-blue-400" />
              <span>{stats?.totalPdfFiles || 0} documentos CTM anexados</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Total Companies Processed */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Empresas / CNPJs Processados
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
              {totalCompanies}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>{stats?.totalJobs || 0} lotes executados</span>
            </p>
          </div>
        </div>

        {/* Metric 3: Assertividade / Enquadramentos Validados */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Enquadramentos Validados
            </span>
            <div className="w-9 h-9 rounded-xl bg-green-600/10 border border-green-500/20 text-green-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-green-400 tracking-tight font-mono">
              {validatedCount}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-green-400" />
              <span>{accuracyRate}% de taxa de precisão da IA</span>
            </p>
          </div>
        </div>

        {/* Metric 4: Pending Reviews */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              Revisões Fiscal Pendentes
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-3xl font-extrabold text-amber-400 tracking-tight font-mono">
              {pendingReviews}
            </div>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Abaixo do limiar de confiança configurado</span>
            </p>
          </div>
        </div>
      </div>

      {/* Operational Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Municipalities Quick Overview */}
        <div className="lg:col-span-1 bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-blue-400" />
                <span>Municípios no Sistema</span>
              </h3>
              <button
                onClick={onNavigateToMunicipalities}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center space-x-1"
              >
                <span>Ver Todos</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
              {municipalities.map(muni => {
                const pdfs = muni.pdfAttachments ? muni.pdfAttachments.length : (muni.ctmFileName ? 1 : 0);
                return (
                  <div
                    key={muni.id}
                    onClick={() => onSelectMunicipality(muni)}
                    className="p-3 bg-[#121214] hover:bg-white/5 border border-white/5 rounded-xl transition-all cursor-pointer flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/10 text-blue-400 flex items-center justify-center font-bold text-xs">
                        {muni.uf}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-white group-hover:text-blue-400 transition-colors">
                          {muni.nome}
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          Limiar Confiança: {muni.confidenceThreshold}%
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        pdfs > 0
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {pdfs} {pdfs === 1 ? 'PDF' : 'PDFs'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={onNavigateToMunicipalities}
            className="w-full mt-4 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 text-xs font-bold py-2.5 rounded-xl transition-colors text-center"
          >
            Gerenciar Municípios & CTM
          </button>
        </div>

        {/* Right Col: Recent Batch Processing Jobs */}
        <div className="lg:col-span-2 bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="font-bold text-sm text-white flex items-center space-x-2">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>Lotes Recentes de Processamento</span>
            </h3>
            <span className="text-xs text-gray-400">
              {stats?.recentJobs?.length || 0} jobs registrados
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-[#121214] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !stats?.recentJobs || stats.recentJobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-xs space-y-2">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-600" />
              <p>Nenhum lote de processamento executado até o momento.</p>
              <p className="text-[11px] text-gray-600">
                Acesse o painel de um município para importar planilhas Excel de CNPJs.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentJobs.map(job => {
                const progressPct = Math.round(((job.processed || 0) / Math.max(1, job.total || 1)) * 100);
                const isFinished = job.status === 'FINISHED' || job.status === 'CANCELLED';

                return (
                  <div
                    key={job.id}
                    className="p-4 bg-[#121214] border border-white/5 rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 font-bold text-white">
                        <span className="text-blue-400">{job.municipalityName}</span>
                        <span className="text-gray-500 font-normal">({job.fileName})</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        job.status === 'FINISHED'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : job.status === 'PROCESSING'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-gray-800 text-gray-400'
                      }`}>
                        {job.status === 'FINISHED' ? 'Concluído' : job.status === 'PROCESSING' ? 'Processando' : job.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                      <span>Progresso: {job.processed || 0} / {job.total} CNPJs ({progressPct}%)</span>
                      <span>Iniciado: {new Date(job.startedAt).toLocaleString('pt-BR')}</span>
                    </div>

                    <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isFinished ? 'bg-green-500' : 'bg-blue-600 animate-pulse'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
