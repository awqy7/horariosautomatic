import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, Trash2, ChevronDown, ChevronUp, X, BookOpen, Calendar, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Professor } from '../../types/database';
import { DIAS_SEMANA, MATERIAS_BNCC } from '../../lib/constants';

const TURNOS = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' },
] as const;

type InnerTab = 'materias' | 'disponibilidade';

export default function ProfessoresTab() {
  const { professores, indisponibilidades, addProfessor, deleteProfessor, setIndisponibilidade, updateProfessorMaterias } = useAppStore();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<Record<string, InnerTab>>({});
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

  const toggleMateria = async (prof: Professor, materia: string) => {
    const current = prof.materias ?? [];
    const next = current.includes(materia)
      ? current.filter(m => m !== materia)
      : [...current, materia];
    setSaving(`mat-${prof.id}-${materia}`);
    const ok = await updateProfessorMaterias(prof.id, next);
    if (!ok) toast.error('Erro ao salvar matéria.');
    setSaving(null);
  };

  const getInnerTab = (profId: string): InnerTab =>
    innerTab[profId] ?? 'materias';

  const setTab = (profId: string, tab: InnerTab) =>
    setInnerTab(prev => ({ ...prev, [profId]: tab }));

  return (
    <div className="animate-fade-in">
      {/* Add Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Novo Professor
        </h3>
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
          const materias = prof.materias ?? [];
          const blockedCount = indisponibilidades.filter(i => i.professor_id === prof.id).length;
          const tab = getInnerTab(prof.id);

          return (
            <div key={prof.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : prof.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem' }}>
                    {prof.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{prof.nome}</p>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <span>{prof.email || 'Sem email'}</span>
                      {materias.length > 0 && (
                        <span style={{ color: '#3b82f6' }}>
                          📚 {materias.length} matéria{materias.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {blockedCount > 0 && (
                        <span style={{ color: '#f59e0b' }}>⚠ {blockedCount} bloqueio{blockedCount !== 1 ? 's' : ''}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Pill preview of materias */}
                  {materias.slice(0, 3).map(m => (
                    <span key={m} style={{ background: 'rgba(59,130,246,0.12)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 99, padding: '2px 8px', fontSize: '0.7rem', display: 'none' /* shown on wider screens */ }}>{m}</span>
                  ))}
                  <button onClick={e => { e.stopPropagation(); handleDelete(prof); }} className="btn" style={{ padding: '0.35rem 0.6rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                    <Trash2 size={15} />
                  </button>
                  {isOpen ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
                </div>
              </div>

              {/* Expanded panel */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-color)' }}>
                  {/* Inner tab bar */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)' }}>
                    {([
                      { id: 'materias' as InnerTab, label: 'Matérias', icon: <BookOpen size={14} /> },
                      { id: 'disponibilidade' as InnerTab, label: 'Disponibilidade', icon: <Calendar size={14} /> },
                    ]).map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTab(prof.id, t.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          padding: '0.65rem 1.25rem',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: tab === t.id ? 'white' : 'var(--text-muted)',
                          fontWeight: tab === t.id ? 600 : 400,
                          fontSize: '0.84rem',
                          borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                        }}
                      >
                        {t.icon} {t.label}
                        {t.id === 'materias' && materias.length > 0 && (
                          <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>
                            {materias.length}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* ── MATÉRIAS TAB ─────────────────────────────────────── */}
                  {tab === 'materias' && (
                    <div style={{ padding: '1.25rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Selecione as disciplinas que <strong style={{ color: 'white' }}>{prof.nome}</strong> está habilitado a lecionar:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem' }}>
                        {MATERIAS_BNCC.map(materia => {
                          const selected = materias.includes(materia);
                          const isSavingThis = saving === `mat-${prof.id}-${materia}`;
                          return (
                            <button
                              key={materia}
                              onClick={() => toggleMateria(prof, materia)}
                              disabled={!!saving}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.6rem',
                                padding: '0.55rem 0.85rem',
                                borderRadius: 8,
                                background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                                border: selected ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border-color)',
                                color: selected ? 'white' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.84rem',
                                fontWeight: selected ? 600 : 400,
                                transition: 'all 0.15s',
                                textAlign: 'left',
                              }}
                            >
                              <div style={{
                                width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                                background: selected ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                                border: selected ? 'none' : '1px solid var(--border-color)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                              }}>
                                {selected && <Check size={11} color="white" strokeWidth={3} />}
                                {isSavingThis && <div style={{ width: 10, height: 10, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                              </div>
                              {materia}
                            </button>
                          );
                        })}
                      </div>

                      {materias.length > 0 && (
                        <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 8 }}>
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Selecionadas:</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                            {materias.map(m => (
                              <span key={m} style={{ background: 'rgba(59,130,246,0.2)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 99, padding: '2px 10px', fontSize: '0.78rem', fontWeight: 600 }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── DISPONIBILIDADE TAB ───────────────────────────────── */}
                  {tab === 'disponibilidade' && (
                    <div style={{ padding: '1.25rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                        Marque os períodos em que <strong style={{ color: 'white' }}>{prof.nome}</strong> <strong style={{ color: '#ef4444' }}>NÃO PODE</strong> lecionar:
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
                                        title={blocked ? 'Clique para liberar' : 'Clique para bloquear'}
                                        style={{
                                          width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer',
                                          background: blocked ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
                                          outline: blocked ? '2px solid rgba(239,68,68,0.5)' : '1px solid var(--border-color)',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          transition: 'all 0.15s', margin: '0 auto',
                                        }}
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
