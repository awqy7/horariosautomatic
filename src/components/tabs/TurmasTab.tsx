import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Turno } from '../../types/database';
import { TURNO_LABEL, NIVEL_OPTIONS } from '../../lib/constants';

const TURNO_IDS: Turno[] = ['manha', 'tarde', 'noite'];

export default function TurmasTab() {
  const { turmas, atribuicoes, addTurma, deleteTurma } = useAppStore();

  const [nome, setNome] = useState('');
  const [nivel, setNivel] = useState(NIVEL_OPTIONS[5]);
  const [turno, setTurno] = useState<Turno>('manha');
  const [aulasPorDia, setAulasPorDia] = useState<5 | 6>(5);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setAdding(true);
    const ok = await addTurma({ nome: nome.trim(), nivel, turno, aulas_por_dia: aulasPorDia });
    if (ok) { toast.success('Turma criada!'); setNome(''); }
    else toast.error('Erro ao criar turma.');
    setAdding(false);
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Remover turma "${nome}"? Todas as atribuições serão removidas.`)) return;
    const ok = await deleteTurma(id);
    if (ok) toast.success('Turma removida.');
    else toast.error('Erro ao remover turma.');
  };

  const turnoColor = { manha: '#3b82f6', tarde: '#f59e0b', noite: '#8b5cf6' };

  return (
    <div className="animate-fade-in">
      {/* Add Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova Turma</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nome da Turma *</label>
            <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: 7º Ano A" required />
          </div>
          <div style={{ flex: '1 1 170px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nível</label>
            <select className="input-field" value={nivel} onChange={e => setNivel(e.target.value)}>
              {NIVEL_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 130px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Turno</label>
            <select className="input-field" value={turno} onChange={e => setTurno(e.target.value as Turno)}>
              {TURNO_IDS.map(t => <option key={t} value={t}>{TURNO_LABEL[t]}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 120px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Aulas/Dia</label>
            <select className="input-field" value={aulasPorDia} onChange={e => setAulasPorDia(parseInt(e.target.value) as 5 | 6)}>
              <option value={5}>5 aulas</option>
              <option value={6}>6 aulas</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: 44, whiteSpace: 'nowrap' }}>
            <Plus size={16} /> {adding ? 'Salvando...' : 'Criar Turma'}
          </button>
        </form>
      </div>

      {/* Grid */}
      {turmas.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Nenhuma turma cadastrada ainda.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {turmas.map(turma => {
            const atrCount = atribuicoes.filter(a => a.turma_id === turma.id).length;
            const totalAtrib = atribuicoes.filter(a => a.turma_id === turma.id).reduce((s, a) => s + a.aulas_semanais, 0);
            const needed = turma.aulas_por_dia * 5;
            const pct = Math.min(100, Math.round((totalAtrib / needed) * 100));
            const color = turnoColor[turma.turno];

            return (
              <div key={turma.id} className="glass-panel" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.7 }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{turma.nome}</h3>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{turma.nivel}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 6, padding: '2px 8px', fontSize: '0.72rem', fontWeight: 600 }}>
                      {TURNO_LABEL[turma.turno]}
                    </span>
                    <button onClick={() => handleDelete(turma.id, turma.nome)} className="btn" style={{ padding: '0.3rem', color: '#ef4444' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{atrCount} atribuição(ões)</span>
                  <span style={{ color: pct === 100 ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>
                    {totalAtrib}/{needed} aulas
                  </span>
                </div>
                <div style={{ width: '100%', height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#10b981' : color, transition: 'width 0.5s ease' }} />
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                  {turma.aulas_por_dia} aulas/dia · {pct === 100 ? '✓ Grade completa' : `${needed - totalAtrib} aula(s) faltando`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
