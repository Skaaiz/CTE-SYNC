import React, { useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  BookmarkPlus,
  Edit3,
  FileText,
  Sparkles,
  Building,
} from 'lucide-react';
import { JobCompany, Municipality } from '../../types';

interface ReviewTabProps {
  municipality: Municipality;
  reviewCompany: JobCompany | null;
  onSaveReview: (
    companyId: string,
    jobId: string,
    data: {
      ctmActivityCode: string;
      ctmActivityDescription: string;
      saveAsFutureRule: boolean;
      reviewedBy: string;
    }
  ) => Promise<void>;
  onCloseReview: () => void;
}

export const ReviewTab: React.FC<ReviewTabProps> = ({
  municipality,
  reviewCompany,
  onSaveReview,
  onCloseReview,
}) => {
  const [selectedCode, setSelectedCode] = useState(
    reviewCompany?.classification?.ctmActivityCode || ''
  );
  const [selectedDesc, setSelectedDesc] = useState(
    reviewCompany?.classification?.ctmActivityDescription || ''
  );
  const [saveAsFutureRule, setSaveAsFutureRule] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!reviewCompany) {
    return (
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-12 text-center text-gray-500 space-y-3 max-w-3xl mx-auto shadow-xl">
        <CheckSquare className="w-10 h-10 mx-auto text-gray-600" />
        <p className="text-sm font-bold text-gray-400">Nenhuma empresa selecionada para revisão manual.</p>
        <p className="text-xs text-gray-500">
          Selecione uma empresa com o aviso de "Revisão Necessária" na tabela de análises para efetuar a revisão cadastral.
        </p>
      </div>
    );
  }

  const rw = reviewCompany.receitaWsData;
  const cl = reviewCompany.classification;

  const handleApproveSuggestion = async () => {
    if (!cl) return;
    setIsSubmitting(true);
    try {
      await onSaveReview(reviewCompany.id, reviewCompany.jobId, {
        ctmActivityCode: cl.ctmActivityCode,
        ctmActivityDescription: cl.ctmActivityDescription,
        saveAsFutureRule,
        reviewedBy: 'Analista Tributário',
      });
      onCloseReview();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCode || !selectedDesc) return;

    setIsSubmitting(true);
    try {
      await onSaveReview(reviewCompany.id, reviewCompany.jobId, {
        ctmActivityCode: selectedCode,
        ctmActivityDescription: selectedDesc,
        saveAsFutureRule,
        reviewedBy: 'Analista Tributário',
      });
      onCloseReview();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 text-amber-500 font-bold text-xs uppercase tracking-wider mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span>Revisão Manual de Enquadramento Cadastral</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {rw?.razaoSocial || reviewCompany.cnpj}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            CNPJ: <strong className="text-gray-200 font-mono">{reviewCompany.formattedCnpj}</strong> | Município: {municipality.nome} ({municipality.uf})
          </p>
        </div>

        <button
          onClick={onCloseReview}
          className="bg-[#121214] hover:bg-white/5 text-gray-300 border border-white/10 text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          Voltar para Tabela
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Side: ReceitaWS & CNAEs */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-xs uppercase tracking-wider text-blue-400 flex items-center space-x-2 border-b border-white/5 pb-3">
            <Building className="w-4 h-4" />
            <span>Dados Oficiais ReceitaWS</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-gray-500">Razão Social:</span>
              <p className="font-bold text-gray-200 text-sm">{rw?.razaoSocial || '-'}</p>
            </div>

            <div>
              <span className="text-gray-500">Nome Fantasia:</span>
              <p className="font-medium text-gray-300">{rw?.nomeFantasia || '-'}</p>
            </div>

            <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
              <span className="text-gray-400 font-semibold">CNAE Principal:</span>
              <p className="font-mono text-blue-400 font-bold mt-0.5">
                {rw?.cnaePrincipalCode} - {rw?.cnaePrincipalText}
              </p>
            </div>

            {rw?.cnaesSecundarios && rw.cnaesSecundarios.length > 0 && (
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-gray-400 font-semibold">CNAEs Secundários:</span>
                <ul className="list-disc pl-4 text-gray-300 space-y-1 text-[11px]">
                  {rw.cnaesSecundarios.map((s, idx) => (
                    <li key={idx}>
                      <strong className="text-blue-400 font-mono">{s.code}</strong> - {s.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: AI Suggestion & Excerpt */}
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="font-bold text-xs uppercase tracking-wider text-amber-500 flex items-center space-x-2 border-b border-white/5 pb-3">
            <Sparkles className="w-4 h-4" />
            <span>Sugestão da IA / Evidência no CTM</span>
          </h3>

          {cl ? (
            <div className="space-y-4 text-xs">
              <div className="bg-[#121214] p-3.5 rounded-xl border border-white/5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 font-semibold">Atividade Sugerida:</span>
                  <span className="font-bold text-amber-500 font-mono">Confiança: {cl.confidence}%</span>
                </div>
                <p className="font-mono text-green-500 font-bold text-sm">
                  {cl.ctmActivityCode} - {cl.ctmActivityDescription}
                </p>
              </div>

              {cl.sourceExcerpt && (
                <div className="bg-[#121214] p-3 rounded-xl border border-white/5 space-y-1">
                  <span className="text-gray-400 font-semibold">Evidência no CTM ({cl.sourcePage}):</span>
                  <p className="text-gray-300 italic text-[11px] leading-relaxed">
                    "{cl.sourceExcerpt}"
                  </p>
                </div>
              )}

              {cl.reasoningSummary && (
                <div className="text-gray-400 text-[11px]">
                  <strong>Justificativa:</strong> {cl.reasoningSummary}
                </div>
              )}

              {/* Alternatives */}
              {cl.alternatives && cl.alternatives.length > 0 && (
                <div className="bg-[#121214] p-3 rounded-xl border border-white/5 space-y-2">
                  <span className="text-gray-400 font-semibold">Alternativas Sugeridas:</span>
                  <div className="space-y-1">
                    {cl.alternatives.map((alt, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSelectedCode(alt.ctmActivityCode);
                          setSelectedDesc(alt.ctmActivityDescription);
                        }}
                        className="w-full text-left bg-[#18181b] hover:bg-white/5 p-2 rounded-lg border border-white/5 text-gray-300 hover:text-white transition-colors"
                      >
                        <p className="font-mono text-blue-400 font-bold">{alt.ctmActivityCode}</p>
                        <p className="text-[10px]">{alt.ctmActivityDescription} ({alt.confidence}%)</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 text-xs">Sem sugestão de IA gerada.</p>
          )}
        </div>
      </div>

      {/* Manual Override & Actions Form */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl">
        <h3 className="font-bold text-sm text-white border-b border-white/5 pb-3 flex items-center space-x-2">
          <Edit3 className="w-4 h-4 text-blue-400" />
          <span>Confirmar ou Alterar Enquadramento Manualmente</span>
        </h3>

        <form onSubmit={handleCustomSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Código Atividade CTM *</label>
              <input
                type="text"
                required
                value={selectedCode}
                onChange={e => setSelectedCode(e.target.value)}
                placeholder="Ex: 1001"
                className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-gray-400 font-bold uppercase tracking-wider text-[10px]">Descrição da Atividade no CTM *</label>
              <input
                type="text"
                required
                value={selectedDesc}
                onChange={e => setSelectedDesc(e.target.value)}
                placeholder="Ex: Comércio de Gêneros Alimentícios em Geral"
                className="w-full bg-[#121214] border border-white/10 rounded-xl px-3 py-2.5 text-gray-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-[#121214] p-3 rounded-xl border border-white/5">
            <input
              type="checkbox"
              id="saveFuture"
              checked={saveAsFutureRule}
              onChange={e => setSaveAsFutureRule(e.target.checked)}
              className="w-4 h-4 accent-blue-600 rounded"
            />
            <label htmlFor="saveFuture" className="text-gray-300 font-medium cursor-pointer">
              [ Salvar como regra futura na Memória Operacional ] (Empresas futuras com CNAE{' '}
              <strong className="text-blue-400 font-mono">{rw?.cnaePrincipalCode}</strong> usarão esta regra automaticamente)
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-white/5">
            {cl && (
              <button
                type="button"
                onClick={handleApproveSuggestion}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Aprovar Sugestão</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !selectedCode || !selectedDesc}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Edit3 className="w-4 h-4" />
              <span>{isSubmitting ? 'Salvando...' : 'Salvar Enquadramento Manual'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
