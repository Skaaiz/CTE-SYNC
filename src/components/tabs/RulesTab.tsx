import React, { useState } from 'react';
import {
  Sliders,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { MunicipalityRule, Municipality } from '../../types';

interface RulesTabProps {
  municipality: Municipality;
  rules: MunicipalityRule[];
  onCreateRule: (ruleData: {
    name: string;
    condition: string;
    instruction: string;
    priority: number;
  }) => Promise<void>;
  onDeleteRule: (ruleId: string) => Promise<void>;
}

export const RulesTab: React.FC<RulesTabProps> = ({
  municipality,
  rules,
  onCreateRule,
  onDeleteRule,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [condition, setCondition] = useState('');
  const [instruction, setInstruction] = useState('');
  const [priority, setPriority] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !condition || !instruction) return;

    setIsSubmitting(true);
    try {
      await onCreateRule({
        name,
        condition,
        instruction,
        priority: Number(priority) || 1,
      });
      setShowModal(false);
      setName('');
      setCondition('');
      setInstruction('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sliders className="w-4 h-4" />
            <span>Regras Condicionais de Enquadramento</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Regras Locais - {municipality.nome}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Defina condições prioritárias (ex: SE CNAE == 47.21-1-03 ENTÃO priorizar "Comércio de Gêneros Alimentícios").
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Regra</span>
        </button>
      </div>

      {/* Rules List */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs">
            Nenhuma regra cadastrada para este município. As classificações utilizarão a memória operacional e a IA.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map(rule => (
              <div
                key={rule.id}
                className="bg-[#121214] border border-white/5 rounded-xl p-4 flex items-start justify-between text-xs space-x-4 hover:border-white/10 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-sm text-white">{rule.name}</span>
                    <span className="bg-blue-600/10 text-blue-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider border border-blue-500/20">
                      Prioridade {rule.priority}
                    </span>
                  </div>

                  <div className="font-mono text-amber-400 text-[11px] bg-[#18181b] px-3 py-1.5 rounded-lg border border-white/5">
                    <strong>SE:</strong> {rule.condition}
                  </div>

                  <div className="font-medium text-green-400 text-[11px] bg-[#18181b] px-3 py-1.5 rounded-lg border border-white/5">
                    <strong>ENTÃO:</strong> {rule.instruction}
                  </div>
                </div>

                <button
                  onClick={() => onDeleteRule(rule.id)}
                  className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-white/5 transition-colors"
                  title="Excluir regra"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181b] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="font-bold text-lg text-white">Adicionar Regra do Município</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Nome da Regra</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Prioridade Comércio de Alimentos"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Condição (SE)</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: CNAE == 47.21-1-03"
                  value={condition}
                  onChange={e => setCondition(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Instrução / Ação (ENTÃO)</label>
                <input
                  type="text"
                  required
                  placeholder='Ex: 1001: Comércio de Gêneros Alimentícios'
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Prioridade</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={priority}
                  onChange={e => setPriority(Number(e.target.value))}
                  className="w-full bg-[#121214] border border-white/10 rounded-lg px-3 py-2 text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
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
                  {isSubmitting ? 'Salvando...' : 'Salvar Regra'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
