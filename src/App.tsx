import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { MunicipalitiesList } from './components/MunicipalitiesList';
import { MunicipalityView } from './components/MunicipalityView';
import { GlobalDashboard } from './components/GlobalDashboard';
import { Municipality, AnalysisJob } from './types';

export default function App() {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<Municipality | null>(null);
  const [isLoadingMunicipalities, setIsLoadingMunicipalities] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [activeProcessingJob, setActiveProcessingJob] = useState<{
    id: string;
    municipalityName: string;
    processed: number;
    total: number;
    currentCnpj?: string;
  } | null>(null);

  const fetchMunicipalities = async () => {
    setIsLoadingMunicipalities(true);
    try {
      const res = await fetch('/api/municipalities');
      if (res.ok) {
        const data = await res.json();
        setMunicipalities(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMunicipalities(false);
    }
  };

  // Poll for any active processing jobs across the system for header banner
  const checkActiveJobs = async () => {
    try {
      const res = await fetch('/api/jobs');
      if (res.ok) {
        const jobs: AnalysisJob[] = await res.json();
        const active = jobs.find(j => j.status === 'PROCESSING' || j.status === 'WAITING');
        if (active) {
          setActiveProcessingJob({
            id: active.id,
            municipalityName: active.municipalityName,
            processed: active.processed || 0,
            total: active.total || 0,
            currentCnpj: active.currentProcessingCnpj || undefined,
          });
        } else {
          setActiveProcessingJob(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMunicipalities();
    checkActiveJobs();

    const interval = setInterval(() => {
      checkActiveJobs();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleCreateMunicipality = async (data: {
    nome: string;
    uf: string;
    aiInstructions: string;
    fallbackActivityId: string;
    fallbackActivityDescription: string;
    confidenceThreshold: number;
  }) => {
    const res = await fetch('/api/municipalities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      await fetchMunicipalities();
    } else {
      const errJson = await res.json();
      throw new Error(errJson.error || 'Erro ao criar município.');
    }
  };

  const handleUpdateMunicipalityById = async (id: string, updatedData: Partial<Municipality>) => {
    const res = await fetch(`/api/municipalities/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedData),
    });

    if (res.ok) {
      if (selectedMunicipality?.id === id) {
        const updated = await res.json();
        setSelectedMunicipality(updated);
      }
      await fetchMunicipalities();
    } else {
      const errJson = await res.json();
      throw new Error(errJson.error || 'Erro ao atualizar município.');
    }
  };

  const handleDeleteMunicipality = async (id: string) => {
    const res = await fetch(`/api/municipalities/${id}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      if (selectedMunicipality?.id === id) {
        setSelectedMunicipality(null);
      }
      await fetchMunicipalities();
    } else {
      const errJson = await res.json();
      throw new Error(errJson.error || 'Erro ao excluir município.');
    }
  };

  const handleUpdateMunicipality = async (updatedData: Partial<Municipality>) => {
    if (!selectedMunicipality) return;
    await handleUpdateMunicipalityById(selectedMunicipality.id, updatedData);
  };

  return (
    <Layout
      activeNav={activeNav}
      onNavigate={nav => {
        setActiveNav(nav);
        if (nav === 'municipalities' || nav === 'dashboard') {
          setSelectedMunicipality(null);
        }
      }}
      selectedMunicipalityName={selectedMunicipality?.nome}
      activeProcessingJob={activeProcessingJob}
    >
      {activeNav === 'dashboard' ? (
        <GlobalDashboard
          municipalities={municipalities}
          onSelectMunicipality={muni => {
            setSelectedMunicipality(muni);
            setActiveNav('municipality_detail');
          }}
          onNavigateToMunicipalities={() => {
            setSelectedMunicipality(null);
            setActiveNav('municipalities');
          }}
        />
      ) : selectedMunicipality ? (
        <MunicipalityView
          municipality={selectedMunicipality}
          onBackToMunicipalities={() => {
            setSelectedMunicipality(null);
            setActiveNav('municipalities');
          }}
          onDeleteMunicipality={handleDeleteMunicipality}
          onUpdateMunicipality={handleUpdateMunicipality}
        />
      ) : (
        <MunicipalitiesList
          municipalities={municipalities}
          onSelectMunicipality={muni => {
            setSelectedMunicipality(muni);
            setActiveNav('municipality_detail');
          }}
          onCreateMunicipality={handleCreateMunicipality}
          onDeleteMunicipality={handleDeleteMunicipality}
          onUpdateMunicipality={handleUpdateMunicipalityById}
          isLoading={isLoadingMunicipalities}
        />
      )}
    </Layout>
  );
}
