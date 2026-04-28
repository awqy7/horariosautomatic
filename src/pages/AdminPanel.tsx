import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/appStore';
import { BookOpen, Users, School, Zap, LogOut, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import ProfessoresTab from '../components/tabs/ProfessoresTab';
import TurmasTab from '../components/tabs/TurmasTab';
import GerarTab from '../components/tabs/GerarTab';

type Tab = 'professores' | 'turmas' | 'gerar';

interface Props { onLogout: () => void; }

export default function AdminPanel({ onLogout }: Props) {
  const { fetchAll, loading, professores, turmas, atribuicoes } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('professores');

  useEffect(() => { fetchAll(); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada.');
    onLogout();
  };

  // Readiness check: all turmas must have their total aulas covered
  const totalAulasPorTurma = (turmaId: string) => {
    const t = turmas.find(t => t.id === turmaId);
    if (!t) return { needed: 0, assigned: 0 };
    const needed = t.aulas_por_dia * 5; // 5 days
    const assigned = atribuicoes.filter(a => a.turma_id === turmaId).reduce((s, a) => s + a.aulas_semanais, 0);
    return { needed, assigned };
  };

  const allReady = turmas.length > 0 && professores.length > 0 &&
    turmas.every(t => {
      const { needed, assigned } = totalAulasPorTurma(t.id);
      return assigned >= needed;
    });

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'professores', label: 'Professores', icon: <Users size={18} />, badge: professores.length },
    { id: 'turmas',      label: 'Turmas',      icon: <School size={18} />, badge: turmas.length },
    { id: 'gerar',       label: 'Gerar Grade',  icon: <Zap size={18} /> },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <BookOpen size={20} color="var(--primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, lineHeight: 1 }}>EducaSched</h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1, marginTop: 2 }}>Painel Administrativo</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Readiness indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: allReady ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${allReady ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 8, padding: '0.35rem 0.75rem' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: allReady ? '#10b981' : '#f59e0b', boxShadow: `0 0 6px ${allReady ? '#10b981' : '#f59e0b'}` }} />
            <span style={{ fontSize: '0.78rem', color: allReady ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {allReady ? 'Pronto para gerar' : 'Dados incompletos'}
            </span>
          </div>

          {loading && <Loader size={16} className="spin" style={{ color: 'var(--text-muted)' }} />}

          <button onClick={handleLogout} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <nav style={{ display: 'flex', gap: '0.25rem', padding: '0.75rem 2rem 0', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="btn"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === tab.id ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.88rem',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span style={{ background: activeTab === tab.id ? 'var(--primary)' : 'rgba(255,255,255,0.1)', color: 'white', borderRadius: 99, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 700 }}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main style={{ flex: 1, padding: '2rem', maxWidth: 1300, width: '100%', margin: '0 auto' }}>
        {activeTab === 'professores'  && <ProfessoresTab onGoToGerar={() => setActiveTab('gerar')} />}
        {activeTab === 'turmas'       && <TurmasTab />}
        {activeTab === 'gerar'        && <GerarTab allReady={allReady} onGoToTab={setActiveTab} />}
      </main>
    </div>
  );
}
