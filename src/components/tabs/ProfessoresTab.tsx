import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, Trash2, ChevronDown, ChevronUp, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Professor } from '../../types/database';
import { DIAS_SEMANA } from '../../lib/constants';

const TURNOS = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' },
] as const;

export default function ProfessoresTab() {
  const { professores, indisponibilidades, addProfessor, deleteProfessor, setIndisponibilidade } = useAppStore();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    setAdding(true);
    const ok = await addProfessor(nome.trim(), email.trim());
    if (ok) { toast.success('Professor adicionado!'); setNome(''); setEmail(''); }
    else toast.error('Erro ao adicionar professor.');
    setAdding(false);
  };

  const handleDelete = async (p: Professor) => {
    if (!confirm(`Remover "${p.nome}"? Todas as atribuições deste professor serão removidas.`)) return;
    const ok = await deleteProfessor(p.id);
    if (ok) toast.success('Professor removido.');
    else toast.error('Erro ao remover.');
  };

  const isBlocked = (profId: string, dia: number, turno: string) =>
    indisponibilidades.some(i => i.professor_id === profId && i.dia_semana === dia && i.turno === turno);

  const toggleIndisponib = async (profId: string, dia: number, turno: string) => {
    const blocked = isBlocked(profId, dia, turno);
    setSaving(`${profId}-${dia}-${turno}`);
    await setIndisponibilidade(profId, dia, turno, !blocked);
    setSaving(null);
  };

  return (
    <div className="animate-fade-in">
      {/* Add Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Novo Professor</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Nome *</label>
            <input className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome completo" required />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Email (opcional)</label>
            <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="professor@escola.com" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: 44, whiteSpace: 'nowrap' }}>
            <Plus size={16} /> {adding ? 'Salvando...' : 'Adicionar'}
          </button>
        </form>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {professores.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Nenhum professor cadastrado ainda.</p>
        )}
        {professores.map(prof => {
          const isOpen = expanded === prof.id;
          const blockedCount = indisponibilidades.filter(i => i.professor_id === prof.id).length;
          return (
            <div key={prof.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              {/* Header row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : prof.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                    {prof.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{prof.nome}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {prof.email || 'Sem email'}
                      {blockedCount > 0 && <span style={{ marginLeft: '0.75rem', color: '#f59e0b' }}>⚠ {blockedCount} período(s) indisponível</span>}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button onClick={e => { e.stopPropagation(); handleDelete(prof); }} className="btn" style={{ padding: '0.35rem 0.6rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <Trash2 size={15} />
                  </button>
                  {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                </div>
              </div>

              {/* Indisponibilidade grid */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '1.25rem' }}>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    Marque os períodos em que o professor <strong style={{ color: 'white' }}>NÃO PODE</strong> lecionar:
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'separate', borderSpacing: '4px', minWidth: 500 }}>
                      <thead>
                        <tr>
                          <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Período</th>
                          {DIAS_SEMANA.map(d => (
                            <th key={d.id} style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', minWidth: 60 }}>{d.short}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {TURNOS.map(turno => (
                          <tr key={turno.id}>
                            <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{turno.label}</td>
                            {DIAS_SEMANA.map(dia => {
                              const blocked = isBlocked(prof.id, dia.id, turno.id);
                              const key = `${prof.id}-${dia.id}-${turno.id}`;
                              return (
                                <td key={dia.id} style={{ textAlign: 'center' }}>
                                  <button
                                    onClick={() => toggleIndisponib(prof.id, dia.id, turno.id)}
                                    disabled={saving === key}
                                    style={{
                                      width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                                      background: blocked ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
                                      outline: blocked ? '2px solid rgba(239,68,68,0.5)' : '1px solid var(--border-color)',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      transition: 'all 0.15s', margin: '0 auto',
                                    }}
                                    title={blocked ? 'Clique para liberar' : 'Clique para bloquear'}
                                  >
                                    {blocked && <X size={14} color="#ef4444" />}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
