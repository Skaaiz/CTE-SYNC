import React, { useState } from 'react';
import {
  Database,
  Search,
  Plus,
  CheckCircle2,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import { ClassificationMapping, Municipality } from '../../types';

interface MappingsTabProps {
  municipality: Municipality;
  mappings: ClassificationMapping[];
  onCreateMapping: (mappingData: {
    cnae: string;
    cnaeDescription: string;
    ctmActivityCode: string;
    ctmActivityDescription: string;
  }) => Promise<void>;
}

export const MappingsTab: React.FC<MappingsTabProps> = ({
  municipality,
  mappings,
  onCreateMapping,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [cnae, setCnae] = useState('');
  const [cnaeDescription, setCnaeDescription] = useState('');
  const [ctmActivityCode, setCtmActivityCode] = useState('');
  const [ctmActivityDescription, setCtmActivityDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMappings = mappings.filter(
    m =>
      !searchTerm.trim() ||
      m.cnae.includes(searchTerm) ||
      m.cnaeDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.ctmActivityCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.ctmActivityDescription.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cnae || !ctmActivityCode) return;

    setIsSubmitting(true);
    try {
      await onCreateMapping({
        cnae,
        cnaeDescription,
        ctmActivityCode,
        ctmActivityDescription,
      });
      setShowModal(false);
      setCnae('');
      setCnaeDescription('');
      setCtmActivityCode('');
      setCtmActivityDescription('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" />
            <span>Memória Operacional e Mapeamentos Aprendidos</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Classificações Mapeadas - {municipality.nome}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Mapeamentos validados para este município. CNPJs com estes CNAEs utilizam a resposta salva diretamente sem chamar a API da OpenAI.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Adicionar Mapeamento</span>
        </button>
      </div>

      {/* Search & List */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar por CNAE ou Atividade CTM..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-[#121214] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <span className="text-xs text-gray-400 font-semibold">
            {filteredMappings.length} mapeamentos cadastrados
          </span>
        </div>

        <div className="overflow-x-auto border border-white/5 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#121214] text-gray-500 font-bold uppercase text-[10px] border-b border-white/5">
              <tr>
                <th className="p-3">CNAE</th>
                <th className="p-3">Descrição CNAE</th>
                <th className="p-3">Código CTM</th>
                <th className="p-3">Atividade CTM Correspondente</th>
                <th className="p-3">Origem</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-[#18181b]">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nenhum mapeamento encontrado.
                  </td>
                </tr>
              ) : (
                filteredMappings.map(map => (
                  <tr key={map.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 font-mono text-blue-400 font-bold">{map.cnae}</td>
                    <td className="p-3 text-gray-300 max-w-xs truncate">{map.cnaeDescription || '-'}</td>
                    <td className="p-3 font-mono text-green-500 font-bold">{map.ctmActivityCode}</td>
                    <td className="p-3 text-gray-200 font-medium max-w-xs truncate">
                      {map.ctmActivityDescription}
                    </td>
                    <td className="p-3 text-gray-400 font-medium">
                      {map.source === 'MANUAL_REVIEW' ? 'Revisão Manual' : 'Aprovado por IA'}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center space-x-1 bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        <span>VALIDADO</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="font-bold text-lg text-white">Cadastrar Mapeamento Validado</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Código CNAE *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 47.21-1-03"
                  value={cnae}
                  onChange={e => setCnae(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Descrição do CNAE</label>
                <input
                  type="text"
                  placeholder="Ex: Comércio varejista de laticínios e frios"
                  value={cnaeDescription}
                  onChange={e => setCnaeDescription(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Código da Atividade CTM *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1001"
                  value={ctmActivityCode}
                  onChange={e => setCtmActivityCode(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Descrição da Atividade no CTM</label>
                <input
                  type="text"
                  placeholder="Ex: Comércio de Gêneros Alimentícios"
                  value={ctmActivityDescription}
                  onChange={e => setCtmActivityDescription(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#121214] hover:bg-white/5 text-gray-300 font-bold border border-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Mapeamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
