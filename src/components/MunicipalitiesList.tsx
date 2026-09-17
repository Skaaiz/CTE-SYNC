import React, { useState } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  FileCheck,
  Cpu,
  ArrowRight,
  Search,
  Trash2,
  Edit2,
  Paperclip,
} from 'lucide-react';
import { Municipality } from '../types';

interface MunicipalitiesListProps {
  municipalities: Municipality[];
  onSelectMunicipality: (muni: Municipality) => void;
  onCreateMunicipality: (data: {
    nome: string;
    uf: string;
    aiInstructions: string;
    fallbackActivityId: string;
    fallbackActivityDescription: string;
    confidenceThreshold: number;
  }) => Promise<void>;
  onDeleteMunicipality?: (id: string) => Promise<void>;
  onUpdateMunicipality?: (id: string, data: Partial<Municipality>) => Promise<void>;
  isLoading: boolean;
}

export const MunicipalitiesList: React.FC<MunicipalitiesListProps> = ({
  municipalities,
  onSelectMunicipality,
  onCreateMunicipality,
  onDeleteMunicipality,
  onUpdateMunicipality,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingMunicipality, setEditingMunicipality] = useState<Municipality | null>(null);

  const [nome, setNome] = useState('');
  const [uf, setUf] = useState('MA');
  const [aiInstructions, setAiInstructions] = useState('');
  const [fallbackActivityId, setFallbackActivityId] = useState('OUTROS-01');
  const [fallbackActivityDescription, setFallbackActivityDescription] = useState('Outras Atividades sem Especificação');
  const [confidenceThreshold, setConfidenceThreshold] = useState(80);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [muniToDelete, setMuniToDelete] = useState<Municipality | null>(null);

  const openCreateModal = () => {
    setEditingMunicipality(null);
    setNome('');
    setUf('MA');
    setAiInstructions('');
    setFallbackActivityId('OUTROS-01');
    setFallbackActivityDescription('Outras Atividades sem Especificação');
    setConfidenceThreshold(80);
    setShowModal(true);
  };

  const openEditModal = (muni: Municipality, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingMunicipality(muni);
    setNome(muni.nome);
    setUf(muni.uf);
    setAiInstructions(muni.aiInstructions || '');
    setFallbackActivityId(muni.fallbackActivityId || 'OUTROS-01');
    setFallbackActivityDescription(muni.fallbackActivityDescription || 'Outras Atividades sem Especificação');
    setConfidenceThreshold(muni.confidenceThreshold || 80);
    setShowModal(true);
  };

  const handleDeleteClick = (muni: Municipality, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setMuniToDelete(muni);
  };

  const confirmDelete = async () => {
    if (!muniToDelete || !onDeleteMunicipality) return;

    setIsDeleting(muniToDelete.id);
    try {
      await onDeleteMunicipality(muniToDelete.id);
      setMuniToDelete(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Erro ao excluir o município.');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      alert('Por favor, informe o Nome do Município.');
      return;
    }
    if (!uf.trim()) {
      alert('Por favor, informe a UF do Município.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingMunicipality && onUpdateMunicipality) {
        await onUpdateMunicipality(editingMunicipality.id, {
          nome: nome.trim(),
          uf: uf.trim().toUpperCase(),
        });
      } else {
        await onCreateMunicipality({
          nome: nome.trim(),
          uf: uf.trim().toUpperCase(),
          aiInstructions: aiInstructions || '',
          fallbackActivityId: fallbackActivityId || 'OUTROS-01',
          fallbackActivityDescription: fallbackActivityDescription || 'Outras Atividades sem Especificação',
          confidenceThreshold: Number(confidenceThreshold) || 80,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      console.error('[Submit Municipality Error]:', err);
      alert(err.message || 'Erro ao salvar município.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMunicipalities = municipalities.filter(m =>
    m.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.uf.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Welcome Banner */}
      <div className="bg-[#121214] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Building2 className="w-4 h-4" />
            <span>Gestão Cadastral Municipal Isolada</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Municípios Cadastrados ({municipalities.length})
          </h2>
          <p className="text-gray-400 text-xs mt-1 max-w-2xl leading-relaxed">
            Selecione um município para gerenciar o CTM, arquivos PDF, regras locais, análises de CNPJs em lote e memória operacional de enquadramento.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Município</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-[#18181b] border border-white/5 rounded-xl p-3 flex items-center space-x-3 shadow-md">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Buscar município por nome ou UF (ex: Anajatuba, MA)..."
          className="w-full bg-transparent text-xs text-white placeholder-gray-500 focus:outline-none"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-gray-500 hover:text-white text-xs font-bold px-2"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="bg-[#18181b] border border-white/5 rounded-2xl p-6 h-48 animate-pulse"
            />
          ))}
        </div>
      ) : filteredMunicipalities.length === 0 ? (
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 text-gray-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Nenhum município encontrado</h3>
          <p className="text-xs text-gray-400 max-w-md mx-auto">
            {searchTerm ? `Nenhum resultado para "${searchTerm}". Tente buscar por outro termo.` : 'Cadastre seu primeiro município para iniciar os enquadramentos tributários.'}
          </p>
          {!searchTerm && (
            <button
              onClick={openCreateModal}
              className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg mt-2"
            >
              <Plus className="w-4 h-4" />
              <span>Cadastrar Município</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMunicipalities.map(muni => (
            <div
              key={muni.id}
              onClick={() => onSelectMunicipality(muni)}
              className="group bg-[#18181b] hover:bg-[#1f1f23] border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 shadow-md transition-all cursor-pointer flex flex-col justify-between space-y-4 relative"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-blue-400 transition-colors">
                        {muni.nome}
                      </h3>
                      <div className="flex items-center space-x-1.5 text-xs text-gray-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-500" />
                        <span>UF: {muni.uf}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => openEditModal(muni, e)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer"
                      title="Editar dados do município"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {onDeleteMunicipality && (
                      <button
                        onClick={e => handleDeleteClick(muni, e)}
                        disabled={isDeleting === muni.id}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                        title="Excluir município"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center space-x-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span>Documento CTM:</span>
                    </span>
                    <span className={`font-semibold ${muni.ctmFileName ? 'text-green-500' : 'text-amber-500'}`}>
                      {muni.ctmFileName ? 'INDEXADO' : 'PENDENTE'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center space-x-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-blue-400" />
                      <span>Arquivos PDF:</span>
                    </span>
                    <span className="font-mono font-semibold text-gray-200">
                      {muni.pdfAttachments ? muni.pdfAttachments.length : (muni.ctmFileName ? 1 : 0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-gray-400">
                    <span className="flex items-center space-x-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-500" />
                      <span>Limiar Confiança:</span>
                    </span>
                    <span className="font-mono font-semibold text-gray-200">
                      {muni.confidenceThreshold}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-xs font-bold text-blue-400 group-hover:text-blue-300">
                <span>Acessar Painel do Município</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6 text-gray-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <div className="flex items-center space-x-2 text-white font-bold text-base">
                <Building2 className="w-5 h-5 text-blue-400" />
                <span>{editingMunicipality ? `Editar ${editingMunicipality.nome}` : 'Cadastrar Novo Município'}</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-gray-300 font-bold flex items-center justify-between">
                    <span>Nome do Município *</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Anajatuba"
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3.5 py-2.5 text-gray-100 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-gray-300 font-bold flex items-center justify-between">
                    <span>UF (Estado) *</span>
                  </label>
                  <select
                    value={uf}
                    onChange={e => setUf(e.target.value)}
                    className="w-full bg-[#121214] border border-white/10 rounded-lg px-3.5 py-2.5 text-gray-100 text-sm focus:outline-none focus:border-blue-500 font-mono transition-colors"
                  >
                    {['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'].map(state => (
                      <option key={state} value={state} className="bg-[#18181b] text-gray-200">
                        {state}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-5 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold transition-colors shadow-lg disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : (editingMunicipality ? 'Atualizar Município' : 'Salvar Município')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Deletar Município */}
      {muniToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-red-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-gray-200">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Excluir Município</h3>
                <p className="text-xs text-red-300/80">{muniToDelete.nome} - {muniToDelete.uf}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-[#121214] p-3.5 rounded-xl border border-white/5">
              Atenção: Ao excluir o município <strong className="text-white">{muniToDelete.nome}</strong>, todos os seus dados cadastrais (regras, classificações, arquivos CTM, análises e lotes) serão removidos do sistema permanentemente.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setMuniToDelete(null)}
                disabled={!!isDeleting}
                className="px-4 py-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={!!isDeleting}
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
