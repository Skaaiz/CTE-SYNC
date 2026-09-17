import React, { useState } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Paperclip,
  FileCheck,
} from 'lucide-react';
import { Municipality } from '../../types';

interface CtmIaTabProps {
  municipality: Municipality;
  onUpdateMunicipality: (updatedData: Partial<Municipality>) => Promise<void>;
}

export const CtmIaTab: React.FC<CtmIaTabProps> = ({
  municipality,
  onUpdateMunicipality,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isMainCtmUpload, setIsMainCtmUpload] = useState(true);
  const [isDeletingPdf, setIsDeletingPdf] = useState<string | null>(null);
  const [pdfToDelete, setPdfToDelete] = useState<{ id: string; name: string } | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePdfUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setIsUploading(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);
      formData.append('isMainCtm', String(isMainCtmUpload));

      const res = await fetch(`/api/municipalities/${municipality.id}/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro ao enviar o arquivo PDF.');
      }

      const data = await res.json();
      await onUpdateMunicipality(data.municipality);

      setSuccessMsg(`Arquivo PDF '${file.name}' enviado e indexado com sucesso para a IA!`);
      setFile(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha no envio do arquivo PDF.');
    } finally {
      setIsUploading(false);
    }
  };

  const confirmDeletePdf = async () => {
    if (!pdfToDelete) return;

    const { id: pdfId, name: fileName } = pdfToDelete;
    setIsDeletingPdf(pdfId);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/municipalities/${municipality.id}/pdf/${pdfId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro ao remover PDF.');
      }

      const data = await res.json();
      await onUpdateMunicipality(data.municipality);
      setSuccessMsg(`Arquivo PDF '${fileName}' excluído e desassociado com sucesso.`);
      setPdfToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir o arquivo PDF.');
    } finally {
      setIsDeletingPdf(null);
    }
  };

  const pdfAttachments = municipality.pdfAttachments || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Documentos e Legislação Tributária</span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Guia & Arquivos do CTM - {municipality.nome}
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Envie e gerencie o Código Tributário Municipal (CTM), decretos, tabelas de alíquotas e anexos legais em PDF para o enquadramento.
          </p>
        </div>

        <div className="bg-[#121214] border border-white/10 rounded-xl px-4 py-2.5 flex items-center space-x-3 shrink-0 shadow-lg">
          <div className="w-8 h-8 rounded-lg bg-green-600/20 text-green-400 flex items-center justify-center font-bold">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Status do CTM</div>
            <div className={`text-xs font-bold ${municipality.ctmFileName ? 'text-green-400' : 'text-amber-400'}`}>
              {municipality.ctmFileName ? 'CTM Indexado' : 'Aguardando PDF'}
            </div>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload PDF Files Card */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <h3 className="font-bold text-sm text-white flex items-center space-x-2">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Upload do CTM e Anexos Fiscais (.PDF)</span>
          </h3>
          <span className="text-xs text-gray-400">
            {pdfAttachments.length} {pdfAttachments.length === 1 ? 'arquivo anexado' : 'arquivos anexados'}
          </span>
        </div>

        {/* Upload Form */}
        <form onSubmit={handlePdfUpload} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="md:col-span-2 border-2 border-dashed border-white/10 hover:border-blue-500/50 rounded-xl p-5 text-center space-y-2 transition-colors">
              <p className="text-gray-300 font-medium">
                {file ? file.name : 'Selecione um arquivo PDF (CTM, Decretos ou Legislação)'}
              </p>
              <label className="inline-block bg-[#121214] hover:bg-white/5 text-gray-200 border border-white/10 px-4 py-2 rounded-lg cursor-pointer font-bold transition-colors">
                <span>{file ? 'Trocar Arquivo PDF' : 'Escolher Arquivo PDF'}</span>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="space-y-3 bg-[#121214] p-4 rounded-xl border border-white/5">
              <label className="flex items-center space-x-2 cursor-pointer text-gray-300 font-medium">
                <input
                  type="checkbox"
                  checked={isMainCtmUpload}
                  onChange={e => setIsMainCtmUpload(e.target.checked)}
                  className="rounded border-white/10 bg-[#18181b] text-blue-600 focus:ring-blue-500"
                />
                <span>Definir como CTM Principal</span>
              </label>
              <p className="text-[10px] text-gray-500">
                Se marcado, este PDF será a referência tributária primária deste município.
              </p>
              <button
                type="submit"
                disabled={!file || isUploading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg shadow-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{isUploading ? 'Processando PDF...' : 'Adicionar Arquivo PDF'}</span>
              </button>
            </div>
          </div>
        </form>

        {/* List of Attached PDF Files */}
        {pdfAttachments.length > 0 ? (
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Paperclip className="w-3.5 h-3.5 text-blue-400" />
              <span>Documentos e Legislações Indexadas</span>
            </h4>

            <div className="bg-[#121214] border border-white/5 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-[#18181b] text-[10px] uppercase text-gray-400 font-bold border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Nome do Arquivo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Tamanho</th>
                    <th className="px-4 py-3">Data de Envio</th>
                    <th className="px-4 py-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {pdfAttachments.map(pdf => (
                    <tr key={pdf.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                        <span className="truncate max-w-xs">{pdf.fileName}</span>
                      </td>
                      <td className="px-4 py-3">
                        {pdf.isMainCtm || municipality.ctmFileName === pdf.fileName ? (
                          <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            CTM Principal
                          </span>
                        ) : (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                            Anexo Legal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                        {pdf.sizeBytes ? `${(pdf.sizeBytes / 1024).toFixed(1)} KB` : 'N/A'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-gray-400">
                        {new Date(pdf.uploadedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setPdfToDelete({ id: pdf.id, name: pdf.fileName })}
                          disabled={isDeletingPdf === pdf.id}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer disabled:opacity-50"
                          title="Excluir PDF"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-6 bg-[#121214] border border-white/5 rounded-xl text-center text-xs text-gray-400 space-y-1">
            <p className="font-bold text-gray-300">Nenhum documento PDF anexado ainda para {municipality.nome}</p>
            <p className="text-[11px] text-gray-500">
              Faça o upload da lei do Código Tributário Municipal acima para habilitar o cruzamento automático de CNAEs.
            </p>
          </div>
        )}
      </div>

      {/* Modal de Confirmação para Exclusão de PDF do CTM */}
      {pdfToDelete && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#18181b] border border-red-500/20 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-gray-200">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Excluir Documento CTM</h3>
                <p className="text-xs text-red-300/80 truncate max-w-[260px]">{pdfToDelete.name}</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed bg-[#121214] p-3.5 rounded-xl border border-white/5">
              Deseja realmente excluir o documento <strong className="text-white">{pdfToDelete.name}</strong> da base de dados? Esta ação removerá o arquivo PDF do sistema e desassociará sua referência do município <strong className="text-white">{municipality.nome}</strong>.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setPdfToDelete(null)}
                disabled={!!isDeletingPdf}
                className="px-4 py-2.5 rounded-lg bg-[#27272a] hover:bg-[#3f3f46] text-gray-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeletePdf}
                disabled={!!isDeletingPdf}
                className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors shadow-lg cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {isDeletingPdf ? (
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
