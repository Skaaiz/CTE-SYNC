import React from 'react';
import {
  Activity,
  FileSpreadsheet,
  FileText,
  Sliders,
  Database,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Municipality, AnalysisJob, MunicipalityRule, ClassificationMapping } from '../../types';

interface DashboardTabProps {
  municipality: Municipality;
  jobs: AnalysisJob[];
  rules: MunicipalityRule[];
  mappings: ClassificationMapping[];
  onSelectJob: (job: AnalysisJob) => void;
  onNavigateTab: (tab: string) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  municipality,
  jobs,
  rules,
  mappings,
  onSelectJob,
  onNavigateTab,
}) => {
  const totalAnalyzed = jobs.reduce((acc, j) => acc + (j.processed || 0), 0);
  const totalSuccess = jobs.reduce((acc, j) => acc + (j.success || 0), 0);
  const totalReview = jobs.reduce((acc, j) => acc + (j.requiresReviewCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <span className="text-blue-400 font-bold text-xs uppercase tracking-wider">
            Painel Geral do Município
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight mt-1">
            {municipality.nome} - {municipality.uf}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Enquadramento tributário automatizado via ReceitaWS e IA treinada para o CTM Local.
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('new_analysis')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Nova Análise Excel</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Análises Executadas</span>
            <Activity className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white mt-2">{jobs.length}</p>
          <p className="text-[11px] text-gray-500 mt-1">{totalAnalyzed} CNPJs processados</p>
        </div>

        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Documento CTM</span>
            <FileText className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-500 mt-2 truncate">
            {municipality.ctmFileName ? municipality.ctmFileName : 'Não enviado'}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {municipality.ctmFileName ? 'Status: INDEXADO' : 'Aguardando Upload'}
          </p>
        </div>

        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Regras Locais</span>
            <Sliders className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold font-mono text-white mt-2">{rules.length}</p>
          <p className="text-[11px] text-gray-500 mt-1">Diretrizes ativas do CTM</p>
        </div>

        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between text-gray-400 text-xs font-bold uppercase tracking-wider">
            <span>Memória Operacional</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono text-white mt-2">{mappings.length}</p>
          <p className="text-[11px] text-gray-500 mt-1">Mapeamentos validados sem custo IA</p>
        </div>
      </div>

      {/* Recent Jobs */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <span>Análises Recentes</span>
          </h3>
          <button
            onClick={() => onNavigateTab('analyses')}
            className="text-blue-400 hover:text-blue-300 text-xs font-bold flex items-center space-x-1"
          >
            <span>Ver todas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs space-y-2">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-gray-600 opacity-60" />
            <p>Nenhuma análise foi realizada ainda para este município.</p>
            <button
              onClick={() => onNavigateTab('new_analysis')}
              className="mt-2 text-blue-400 font-bold hover:underline inline-block"
            >
              Iniciar primeira análise
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.slice(0, 5).map(job => (
              <div
                key={job.id}
                onClick={() => onSelectJob(job)}
                className="bg-[#121214] border border-white/5 hover:border-blue-500/30 rounded-xl p-4 flex items-center justify-between transition-all cursor-pointer text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-gray-200">
                    <span>{job.fileName}</span>
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
                  <p className="text-[11px] text-gray-500">
                    Iniciado em: {new Date(job.startedAt || '').toLocaleString('pt-BR')} | Por: {job.createdBy}
                  </p>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <p className="font-semibold text-gray-300 font-mono">
                      {job.processed} / {job.total} ({Math.round((job.processed / Math.max(1, job.total)) * 100)}%)
                    </p>
                    <p className="text-[10px] text-gray-500">
                      Sucesso: {job.success} | Revisão: {job.requiresReviewCount}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
