import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Activity,
  FileText,
  Sliders,
  Database,
  CheckSquare,
  ArrowLeft,
  Building2,
  Trash2,
} from 'lucide-react';
import {
  Municipality,
  AnalysisJob,
  MunicipalityRule,
  ClassificationMapping,
  JobCompany,
} from '../types';
import { DashboardTab } from './tabs/DashboardTab';
import { NewAnalysisTab } from './tabs/NewAnalysisTab';
import { AnalysesTab } from './tabs/AnalysesTab';
import { CtmIaTab } from './tabs/CtmIaTab';
import { RulesTab } from './tabs/RulesTab';
import { MappingsTab } from './tabs/MappingsTab';
import { ReviewTab } from './tabs/ReviewTab';

interface MunicipalityViewProps {
  municipality: Municipality;
  onBackToMunicipalities: () => void;
  onDeleteMunicipality?: (id: string) => Promise<void>;
  onUpdateMunicipality: (updatedData: Partial<Municipality>) => Promise<void>;
}

export const MunicipalityView: React.FC<MunicipalityViewProps> = ({
  municipality,
  onBackToMunicipalities,
  onDeleteMunicipality,
  onUpdateMunicipality,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'new_analysis' | 'analyses' | 'ctm_ia' | 'rules' | 'mappings' | 'review'
  >('dashboard');

  const [jobs, setJobs] = useState<AnalysisJob[]>([]);
  const [rules, setRules] = useState<MunicipalityRule[]>([]);
  const [mappings, setMappings] = useState<ClassificationMapping[]>([]);
  const [selectedJob, setSelectedJob] = useState<AnalysisJob | null>(null);
  const [reviewCompany, setReviewCompany] = useState<JobCompany | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch jobs, rules, mappings for this municipality
  const fetchData = async () => {
    try {
      const [jobsRes, rulesRes, mappingsRes] = await Promise.all([
        fetch(`/api/jobs?municipalityId=${municipality.id}`),
        fetch(`/api/municipalities/${municipality.id}/rules`),
        fetch(`/api/municipalities/${municipality.id}/mappings`),
      ]);

      if (jobsRes.ok) setJobs(await jobsRes.json());
      if (rulesRes.ok) setRules(await rulesRes.json());
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [municipality.id]);

  const handleCreateRule = async (ruleData: {
    name: string;
    condition: string;
    instruction: string;
    priority: number;
  }) => {
    const res = await fetch(`/api/municipalities/${municipality.id}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleData),
    });
    if (res.ok) fetchData();
  };

  const handleDeleteRule = async (ruleId: string) => {
    const res = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleCreateMapping = async (mappingData: {
    cnae: string;
    cnaeDescription: string;
    ctmActivityCode: string;
    ctmActivityDescription: string;
  }) => {
    const res = await fetch(`/api/municipalities/${municipality.id}/mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mappingData),
    });
    if (res.ok) fetchData();
  };

  const handleSaveReview = async (
    companyId: string,
    jobId: string,
    data: {
      ctmActivityCode: string;
      ctmActivityDescription: string;
      saveAsFutureRule: boolean;
      reviewedBy: string;
    }
  ) => {
    const res = await fetch(`/api/jobs/${jobId}/companies/${companyId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      fetchData();
    }
  };

  const confirmDeleteMunicipality = async () => {
    if (!onDeleteMunicipality) return;
    setIsDeleting(true);
    try {
      await onDeleteMunicipality(municipality.id);
      onBackToMunicipalities();
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao excluir o município.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Municipality Navigation Header */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMunicipalities}
            className="p-2 rounded-xl bg-[#121214] hover:bg-[#27272a] text-gray-300 border border-white/5 transition-colors"
            title="Voltar para lista de municípios"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="font-bold text-xl text-white tracking-tight">{municipality.nome}</h2>
              <span className="bg-blue-600/10 text-blue-400 text-xs px-2.5 py-0.5 rounded-full font-bold border border-blue-500/20">
                UF: {municipality.uf}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              CTM: {municipality.ctmFileName || 'Pendente'} | Limiar: {municipality.confidenceThreshold}%
            </p>
          </div>
          {onDeleteMunicipality && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 transition-colors cursor-pointer ml-auto"
              title="Excluir município"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="flex items-center space-x-1 bg-[#121214] p-1.5 rounded-xl border border-white/5 text-xs overflow-x-auto w-full md:w-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'new_analysis', label: 'Nova Análise', icon: FileSpreadsheet },
            { id: 'analyses', label: 'Análises', icon: Activity },
            { id: 'ctm_ia', label: 'CTM', icon: FileText },
            { id: 'rules', label: 'Regras', icon: Sliders },
            { id: 'mappings', label: 'Classificações', icon: Database },
            { id: 'review', label: 'Histórico / Revisão', icon: CheckSquare },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white font-bold shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dashboard' && (
        <DashboardTab
          municipality={municipality}
          jobs={jobs}
          rules={rules}
          mappings={mappings}
          onSelectJob={job => {
            setSelectedJob(job);
            setActiveTab('analyses');
          }}
          onNavigateTab={tab => setActiveTab(tab as any)}
        />
      )}

      {activeTab === 'new_analysis' && (
        <NewAnalysisTab
          municipality={municipality}
          onJobStarted={job => {
            setSelectedJob(job);
            fetchData();
            setActiveTab('analyses');
          }}
        />
      )}

      {activeTab === 'analyses' && (
        <AnalysesTab
          municipality={municipality}
          jobs={jobs}
          selectedJob={selectedJob}
          onSelectJob={job => setSelectedJob(job)}
          onOpenReview={comp => {
            setReviewCompany(comp);
            setActiveTab('review');
          }}
        />
      )}

      {activeTab === 'ctm_ia' && (
        <CtmIaTab
          municipality={municipality}
          onUpdateMunicipality={onUpdateMunicipality}
        />
      )}

      {activeTab === 'rules' && (
        <RulesTab
          municipality={municipality}
          rules={rules}
          onCreateRule={handleCreateRule}
          onDeleteRule={handleDeleteRule}
        />
      )}

      {activeTab === 'mappings' && (
        <MappingsTab
          municipality={municipality}
          mappings={mappings}
          onCreateMapping={handleCreateMapping}
        />
      )}

      {activeTab === 'review' && (
        <ReviewTab
          municipality={municipality}
          reviewCompany={reviewCompany}
          onSaveReview={handleSaveReview}
          onCloseReview={() => {
            setReviewCompany(null);
            setActiveTab('analyses');
          }}
        />
      )}

      {/* Modal Deletar Município */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-red-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-gray-200">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Excluir Município</h3>
                <p className="text-xs text-red-300/80">{municipality.nome} - {municipality.uf}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-[#121214] p-3.5 rounded-xl border border-white/5">
              Atenção: Ao excluir o município <strong className="text-white">{municipality.nome}</strong>, todos os seus dados cadastrais (regras, classificações, arquivos CTM, análises e lotes) serão removidos do sistema permanentemente.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteMunicipality}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-lg cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {isDeleting ? (
                  <span>Excluindo...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Definitivamente</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
