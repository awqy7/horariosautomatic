import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MATERIAS_BNCC } from '../../lib/constants';

export default function AtribuicoesTab() {
  const { professores, turmas, atribuicoes, addAtribuicao, deleteAtribuicao, updateAtribuicao } = useAppStore();

  const [profId, setProfId] = useState('');
  const [turmaId, setTurmaId] = useState('');
  const [disciplina, setDisciplina] = useState(MATERIAS_BNCC[0]);
  const [aulasSem, setAulasSem] = useState(2);
  const [adding, setAdding] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState(1);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profId || !turmaId) { toast.error('Selecione professor e turma.'); return; }
    // Check duplicate
    const dup = atribuicoes.find(a => a.professor_id === profId && a.turma_id === turmaId && a.disciplina === disciplina);
    if (dup) { toast.error('Já existe esta atribuição.'); return; }

    setAdding(true);
    const ok = await addAtribuicao({ professor_id: profId, turma_id: turmaId, disciplina, aulas_semanais: aulasSem });
    if (ok) toast.success('Atribuição criada!');
    else toast.error('Erro ao criar atribuição.');
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover esta atribuição?')) return;
    const ok = await deleteAtribuicao(id);
    if (ok) toast.success('Removida.');
    else toast.error('Erro ao remover.');
  };

  const handleSaveEdit = async (id: string) => {
    const ok = await updateAtribuicao(id, editValue);
    if (ok) toast.success('Carga horária atualizada!');
    else toast.error('Erro ao atualizar.');
    setEditingId(null);
  };

  // Group atribuicoes by turma for display
  const byTurma = turmas.map(t => ({
    turma: t,
    items: atribuicoes.filter(a => a.turma_id === t.id),
  })).filter(g => g.items.length > 0 || true);

  const getProfNome = (id: string) => professores.find(p => p.id === id)?.nome ?? '—';

  // Professors qualified for the selected disciplina
  const qualifiedProfs = professores.filter(p =>
    !p.materias || p.materias.length === 0 || p.materias.includes(disciplina)
  );
  const noOneQualified = professores.length > 0 && qualifiedProfs.length === 0;
  const displayProfs = noOneQualified ? professores : qualifiedProfs;

  return (
    <div className="animate-fade-in">
      {/* Add Form */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nova Atribuição</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Professor *</label>
            <select className="input-field" value={profId} onChange={e => setProfId(e.target.value)} required>
              <option value="">Selecione...</option>
              {displayProfs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nome}{(p.materias ?? []).length === 0 ? ' ⚠' : ''}
                </option>
              ))}
            </select>
            {noOneQualified && (
              <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem' }}>
                ⚠ Nenhum professor tem &quot;{disciplina}&quot; cadastrado em suas matérias.
              </p>
            )}
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Turma *</label>
            <select className="input-field" value={turmaId} onChange={e => setTurmaId(e.target.value)} required>
              <option value="">Selecione...</option>
              {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Disciplina *</label>
            <select className="input-field" value={disciplina} onChange={e => setDisciplina(e.target.value)}>
              {MATERIAS_BNCC.map(m => <option key={m} value={m}>{m}</option>)}
              <option value="__custom">Outra (digitar)</option>
            </select>
            {disciplina === '__custom' && (
              <input className="input-field" style={{ marginTop: 6 }} placeholder="Nome da disciplina" onBlur={e => setDisciplina(e.target.value || MATERIAS_BNCC[0])} />
            )}
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Aulas/semana</label>
            <input type="number" className="input-field" min={1} max={12} value={aulasSem} onChange={e => setAulasSem(parseInt(e.target.value) || 1)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={adding} style={{ height: 44, whiteSpace: 'nowrap' }}>
            <Plus size={16} /> {adding ? 'Salvando...' : 'Atribuir'}
          </button>
        </form>
      </div>

      {/* Table grouped by turma */}
      {turmas.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Cadastre turmas primeiro.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {byTurma.map(({ turma, items }) => (
            <div key={turma.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1rem' }}>{turma.nome}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '0.75rem' }}>{turma.nivel} · {turma.turno}</span>
                </div>
                <div style={{ fontSize: '0.8rem' }}>
                  {(() => {
                    const total = items.reduce((s, a) => s + a.aulas_semanais, 0);
                    const needed = turma.aulas_por_dia * 5;
                    const ok = total >= needed;
                    return <span style={{ color: ok ? '#10b981' : '#f59e0b', fontWeight: 600 }}>{total}/{needed} aulas {ok ? '✓' : '⚠'}</span>;
                  })()}
                </div>
              </div>

              {items.length === 0 ? (
                <p style={{ padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Nenhuma atribuição nesta turma.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {['Professor', 'Disciplina', 'Aulas/semana', ''].map(h => (
                        <th key={h} style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(atr => (
                      <tr key={atr.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '0.7rem 1rem', fontSize: '0.88rem' }}>{getProfNome(atr.professor_id)}</td>
                        <td style={{ padding: '0.7rem 1rem', fontSize: '0.88rem', color: 'var(--primary)' }}>{atr.disciplina}</td>
                        <td style={{ padding: '0.7rem 1rem' }}>
                          {editingId === atr.id ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input type="number" min={1} max={12} value={editValue}
                                onChange={e => setEditValue(parseInt(e.target.value) || 1)}
                                style={{ width: 60, background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: 6, color: 'white', padding: '3px 8px', fontSize: '0.85rem' }}
                              />
                              <button onClick={() => handleSaveEdit(atr.id)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}><Check size={16} /></button>
                              <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700 }}>{atr.aulas_semanais}×</span>
                              <button onClick={() => { setEditingId(atr.id); setEditValue(atr.aulas_semanais); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}>
                                <Edit2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '0.7rem 1rem', textAlign: 'right' }}>
                          <button onClick={() => handleDelete(atr.id)} className="btn" style={{ padding: '0.3rem 0.5rem', color: '#ef4444' }}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
