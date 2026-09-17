import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Upload,
  CheckCircle,
  AlertTriangle,
  Play,
  FileCheck2,
  Table,
  HelpCircle,
} from 'lucide-react';
import { Municipality, ExcelImportPreview, AnalysisJob } from '../../types';

interface NewAnalysisTabProps {
  municipality: Municipality;
  onJobStarted: (job: AnalysisJob) => void;
}

export const NewAnalysisTab: React.FC<NewAnalysisTabProps> = ({
  municipality,
  onJobStarted,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelImportPreview | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setErrorMsg(null);
    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('excelFile', file);

      const res = await fetch('/api/jobs/preview-excel', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro ao analisar arquivo Excel.');
      }

      const data: ExcelImportPreview = await res.json();
      setPreview(data);
      setSelectedColumn(data.cnpjColumn);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao analisar planilha.');
      setPreview(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleColumnChange = async (columnName: string) => {
    setSelectedColumn(columnName);
    if (!selectedFile) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('excelFile', selectedFile);
      formData.append('cnpjColumn', columnName);

      const res = await fetch('/api/jobs/preview-excel', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data: ExcelImportPreview = await res.json();
        setPreview(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (!selectedFile || !preview || preview.validCleanCnpjs.length === 0) return;

    setIsStartingJob(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      formData.append('excelFile', selectedFile);
      formData.append('municipalityId', municipality.id);
      formData.append('cnpjColumn', selectedColumn);
      formData.append('createdBy', 'Analista Tributário');

      const res = await fetch('/api/jobs/start', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Erro ao iniciar job de análise.');
      }

      const job: AnalysisJob = await res.json();
      onJobStarted(job);
    } catch (err: any) {
      setErrorMsg(err.message || 'Falha ao iniciar processamento.');
    } finally {
      setIsStartingJob(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-3 text-blue-400 font-bold text-xs uppercase tracking-wider mb-1">
          <FileSpreadsheet className="w-5 h-5" />
          <span>Importação e Análise Cadastral em Lote</span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Nova Análise - {municipality.nome} ({municipality.uf})
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Envie a planilha de empresas (.xlsx ou .xls). Os CNPJs serão normalizados, validados e consultados na ReceitaWS na velocidade segura de 3 requisições/minuto.
        </p>
      </div>

      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Dropzone */}
      <div className="bg-[#18181b] border border-white/5 rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-blue-600/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
          <Upload className="w-8 h-8" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">
            {selectedFile ? selectedFile.name : 'Selecione a planilha Excel (.xlsx / .xls)'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Arraste ou clique para selecionar a lista de CNPJs
          </p>
        </div>

        <div>
          <label className="inline-block bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg cursor-pointer shadow-lg transition-colors">
            <span>{selectedFile ? 'Alterar Arquivo' : 'Selecionar Arquivo'}</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      </div>

      {/* Analysis Preview Section */}
      {isAnalyzing && (
        <div className="bg-[#18181b] border border-white/5 rounded-2xl p-8 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-300 font-semibold">Analisando colunas e validando CNPJs...</p>
        </div>
      )}

      {preview && !isAnalyzing && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-green-500" />
                <span>Resumo da Identificação de CNPJs</span>
              </h3>
              <div className="flex items-center space-x-2 text-xs">
                <span className="text-gray-400">Coluna CNPJ:</span>
                <select
                  value={selectedColumn}
                  onChange={e => handleColumnChange(e.target.value)}
                  className="bg-[#121214] border border-white/10 text-blue-400 font-bold rounded-lg px-2.5 py-1 focus:outline-none focus:border-blue-500"
                >
                  {preview.availableColumns.map(col => (
                    <option key={col} value={col}>
                      {col}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
                <p className="text-gray-400">Linhas Totais</p>
                <p className="text-lg font-bold font-mono text-white mt-1">{preview.totalRows}</p>
              </div>
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
                <p className="text-gray-400">Identificados</p>
                <p className="text-lg font-bold font-mono text-blue-400 mt-1">{preview.cnpjsIdentified}</p>
              </div>
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
                <p className="text-gray-400">CNPJs Válidos</p>
                <p className="text-lg font-bold font-mono text-green-500 mt-1">{preview.validCnpjs}</p>
              </div>
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
                <p className="text-gray-400">Duplicados</p>
                <p className="text-lg font-bold font-mono text-amber-500 mt-1">{preview.duplicateCnpjs}</p>
              </div>
              <div className="bg-[#121214] p-3 rounded-xl border border-white/5">
                <p className="text-gray-400">Inválidos</p>
                <p className="text-lg font-bold font-mono text-red-500 mt-1">{preview.invalidCnpjs}</p>
              </div>
            </div>
          </div>

          {/* Table Sample */}
          <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 space-y-4 shadow-xl">
            <h4 className="font-bold text-xs text-gray-300 flex items-center space-x-2">
              <Table className="w-4 h-4 text-blue-400" />
              <span>Prévia dos Primeiros Registros</span>
            </h4>

            <div className="overflow-x-auto border border-white/5 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#121214] border-b border-white/5 text-gray-500 font-bold uppercase text-[10px]">
                    <th className="p-3">CNPJ Original</th>
                    <th className="p-3">CNPJ Limpo</th>
                    <th className="p-3">Validação</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {preview.previewRows.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="p-3 font-mono text-gray-300">{row.rawCnpj || '-'}</td>
                      <td className="p-3 font-mono text-gray-200">{row.cleanCnpj || '-'}</td>
                      <td className="p-3">
                        {row.isValid ? (
                          <span className="text-green-500 font-semibold">Válido (14 dígitos)</span>
                        ) : (
                          <span className="text-red-500 font-semibold">Inválido</span>
                        )}
                      </td>
                      <td className="p-3">
                        {row.isDuplicate ? (
                          <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            Duplicado
                          </span>
                        ) : row.isValid ? (
                          <span className="bg-green-500/10 text-green-500 border border-green-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            Apto p/ Análise
                          </span>
                        ) : (
                          <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                            Descartado
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Start Button Banner */}
          <div className="bg-[#18181b] border border-white/5 rounded-2xl p-6 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-sm font-bold text-white">
                Pronto para iniciar análise de {preview.validCnpjs} CNPJs?
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                O processamento continuará em segundo plano mesmo se você fechar esta janela.
              </p>
            </div>

            <button
              onClick={handleStartAnalysis}
              disabled={isStartingJob || preview.validCnpjs === 0}
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-6 py-3 rounded-lg shadow-lg transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isStartingJob ? 'Criando Job...' : 'INICIAR ANÁLISE'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
