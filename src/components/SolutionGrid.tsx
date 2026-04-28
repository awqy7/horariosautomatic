import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { SolverSolution } from '../lib/algorithm';
import { DIAS_SEMANA, SLOT_TIMES, TURNO_LABEL, TURNO_OFFSET, disciplinaColor } from '../lib/constants';
import type { Turno } from '../types/database';
import { Edit3, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { solution: SolverSolution; }


export default function SolutionGrid({ solution }: Props) {
  const { turmas, atribuicoes, professores, gradesGeradas, updateGradeSlot } = useAppStore();
  const [viewMode, setViewMode] = useState<'turma' | 'professor'>('turma');
  const [selectedId, setSelectedId] = useState<string>(turmas[0]?.id ?? '');
  const [editMode, setEditMode] = useState(false);
  const [editingCell, setEditingCell] = useState<{ dia: number; slot: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const profMap  = new Map(professores.map(p => [p.id, p]));
  const atrMap   = new Map(atribuicoes.map(a => [a.id, a]));
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  // Map from atribuicaoId+dia+slotRelativo → gradeGerada id
  const gradeKey = (atrId: string, dia: number, slot: number) => `${atrId}-${dia}-${slot}`;
  const gradeIdMap = new Map<string, string>();
  for (const g of gradesGeradas) {
    gradeIdMap.set(gradeKey(g.atribuicao_id, g.dia_semana, g.slot_relativo), g.id);
  }

  // ─── Cell click handler ─────────────────────────────────────────────────────
  const handleCellClick = (
    dia: number, slot: number,
    currentAtrId: string | null,
  ) => {
    if (!editMode) return;
    if (!currentAtrId) return; // can't edit empty cell in this version
    setEditingCell({ dia, slot });
  };

  const handleSwapProf = async (
    dia: number, slotRelativo: number,
    currentAtrId: string,
    newAtrId: string,
  ) => {
    if (currentAtrId === newAtrId) { setEditingCell(null); return; }
    const gId = gradeIdMap.get(gradeKey(currentAtrId, dia, slotRelativo));
    if (!gId) { toast.error('Slot não encontrado no banco.'); setEditingCell(null); return; }

    setSaving(true);
    const ok = await updateGradeSlot(gId, newAtrId);
    if (ok) toast.success('Slot atualizado!');
    else toast.error('Erro ao salvar alteração.');
    setSaving(false);
    setEditingCell(null);
  };

  // ─── TURMA VIEW ─────────────────────────────────────────────────────────────
  const renderTurmaGrid = () => {
    const turma = turmaMap.get(selectedId);
    if (!turma) return <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>Selecione uma turma.</p>;

    const turnoSlots = SLOT_TIMES[turma.turno as Turno];
    const slotCount  = turma.aulas_por_dia;

    // Atribuições válidas para esta turma (para edição)
    const turmaAtrs = atribuicoes.filter(a => a.turma_id === selectedId);

    type Cell = { disciplina: string; professorNome: string; atrId: string } | null;
    const grid: Cell[][] = Array.from({ length: 7 }, () => Array(slotCount + 1).fill(null));

    for (const ev of solution.events) {
      const atr = atrMap.get(ev.atribuicaoId);
      if (!atr || atr.turma_id !== selectedId) continue;
      const prof = profMap.get(atr.professor_id);
      if (ev.dia >= 1 && ev.dia <= 6 && ev.slotRelativo >= 1 && ev.slotRelativo <= slotCount) {
        grid[ev.dia][ev.slotRelativo] = {
          disciplina: atr.disciplina,
          professorNome: prof?.nome ?? '—',
          atrId: ev.atribuicaoId,
        };
      }
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 5, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ width: 110, padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'left' }}>Horário</th>
              {DIAS_SEMANA.map(d => (
                <th key={d.id} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontWeight: 600, fontSize: '0.85rem', textAlign: 'center' }}>{d.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: slotCount }, (_, i) => i + 1).map(slot => (
              <tr key={slot}>
                <td style={{ textAlign: 'left', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.3rem 0.5rem', whiteSpace: 'nowrap' }}>
                  {turnoSlots[slot] ?? '—'}
                </td>
                {DIAS_SEMANA.map(dia => {
                  const cell = grid[dia.id][slot];
                  const color = cell ? disciplinaColor(cell.disciplina) : null;
                  const isEditing = editMode && editingCell?.dia === dia.id && editingCell?.slot === slot;

                  return (
                    <td key={dia.id}
                      onClick={() => cell && handleCellClick(dia.id, slot, cell.atrId)}
                      style={{
                        height: 80, borderRadius: 10, padding: '0.55rem 0.65rem',
                        background: cell ? `${color}1a` : 'rgba(255,255,255,0.03)',
                        border: cell
                          ? (editMode ? `1px solid ${color}80` : `1px solid ${color}50`)
                          : '1px solid rgba(255,255,255,0.06)',
                        verticalAlign: 'top', transition: 'all 0.15s',
                        cursor: editMode && cell ? 'pointer' : 'default',
                        position: 'relative',
                        outline: isEditing ? `2px solid ${color}` : 'none',
                      }}
                    >
                      {cell && (
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: color!, lineHeight: 1.3, marginBottom: 2 }}>{cell.disciplina}</p>
                          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{cell.professorNome.split(' ')[0]}</p>
                          {editMode && (
                            <p style={{ fontSize: '0.65rem', color: color!, opacity: 0.7, marginTop: 2 }}>✏ clique p/ editar</p>
                          )}
                        </div>
                      )}

                      {/* Edit popup */}
                      {isEditing && cell && (
                        <div
                          onClick={e => e.stopPropagation()}
                          style={{
                            position: 'absolute', top: 0, left: 0, zIndex: 20,
                            background: 'var(--bg-card)', border: `1px solid ${color}60`,
                            borderRadius: 10, padding: '0.75rem', minWidth: 220,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          }}
                        >
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                            Trocar professor — {cell.disciplina}
                          </p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: 200, overflowY: 'auto' }}>
                            {turmaAtrs
                              .filter(a => a.disciplina === cell.disciplina)
                              .map(a => {
                                const p = profMap.get(a.professor_id);
                                const isCurrent = a.id === cell.atrId;
                                return (
                                  <button
                                    key={a.id}
                                    disabled={saving}
                                    onClick={() => handleSwapProf(dia.id, slot, cell.atrId, a.id)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      padding: '0.45rem 0.7rem', borderRadius: 6, border: 'none',
                                      cursor: 'pointer', fontSize: '0.82rem',
                                      background: isCurrent ? `${color}20` : 'rgba(255,255,255,0.06)',
                                      color: isCurrent ? color! : 'var(--text-main)',
                                      fontWeight: isCurrent ? 700 : 400,
                                    }}
                                  >
                                    {isCurrent && <Check size={13} />}
                                    {p?.nome ?? '—'}
                                  </button>
                                );
                              })}
                          </div>
                          <button onClick={() => setEditingCell(null)} style={{ marginTop: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <X size={12} /> Cancelar
                          </button>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // ─── PROFESSOR VIEW ──────────────────────────────────────────────────────────
  const renderProfGrid = () => {
    const prof = profMap.get(selectedId);
    if (!prof) return <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>Selecione um professor.</p>;

    type Cell = { disciplina: string; turmaNome: string } | null;
    const grid: Record<number, Record<number, Cell>> = {};
    for (let d = 1; d <= 6; d++) grid[d] = {};

    for (const ev of solution.events) {
      const atr = atrMap.get(ev.atribuicaoId);
      if (!atr || atr.professor_id !== selectedId) continue;
      const turma = turmaMap.get(atr.turma_id);
      if (!turma) continue;
      const offset = TURNO_OFFSET[turma.turno as Turno];
      const absSlot = offset + ev.slotRelativo;
      grid[ev.dia][absSlot] = { disciplina: atr.disciplina, turmaNome: turma.nome };
    }

    const usedAbsSlots = new Set<number>();
    Object.values(grid).forEach(dayMap => Object.keys(dayMap).forEach(k => usedAbsSlots.add(parseInt(k))));
    const sortedSlots = Array.from(usedAbsSlots).sort((a, b) => a - b);

    if (sortedSlots.length === 0) {
      return <p style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>Este professor não tem aulas nesta solução.</p>;
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 5, minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ width: 60, padding: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center' }}>Slot</th>
              {DIAS_SEMANA.map(d => (
                <th key={d.id} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, fontSize: '0.85rem', textAlign: 'center' }}>{d.short}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSlots.map(abs => (
              <tr key={abs}>
                <td style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', padding: '0.3rem' }}>#{abs}</td>
                {DIAS_SEMANA.map(dia => {
                  const cell = grid[dia.id]?.[abs] ?? null;
                  const color = cell ? disciplinaColor(cell.disciplina) : null;
                  return (
                    <td key={dia.id} style={{ height: 72, borderRadius: 10, padding: '0.55rem 0.65rem', background: cell ? `${color}1a` : 'rgba(255,255,255,0.03)', border: cell ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.06)', verticalAlign: 'top' }}>
                      {cell && (
                        <div>
                          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: color!, lineHeight: 1.3 }}>{cell.disciplina}</p>
                          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{cell.turmaNome}</p>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const isViewTurma = viewMode === 'turma';
  const entities = isViewTurma ? turmas : professores;

  return (
    <div className="glass-panel" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)' }}>
        {/* View mode toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
          {(['turma', 'professor'] as const).map(mode => (
            <button key={mode} onClick={() => { setViewMode(mode); setSelectedId(mode === 'turma' ? (turmas[0]?.id ?? '') : (professores[0]?.id ?? '')); setEditingCell(null); }}
              style={{ padding: '0.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: viewMode === mode ? 'rgba(59,130,246,0.35)' : 'transparent', color: viewMode === mode ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {mode === 'turma' ? 'Por Turma' : 'Por Professor'}
            </button>
          ))}
        </div>

        <select className="input-field" style={{ flex: 1, maxWidth: 260 }} value={selectedId} onChange={e => { setSelectedId(e.target.value); setEditingCell(null); }}>
          {entities.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>

        {isViewTurma && selectedId && turmaMap.has(selectedId) && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.65rem', borderRadius: 6 }}>
            {TURNO_LABEL[turmaMap.get(selectedId)!.turno as Turno]}
          </span>
        )}

        {/* Edit mode toggle */}
        {isViewTurma && (
          <button
            onClick={() => { setEditMode(v => !v); setEditingCell(null); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.4rem 0.9rem', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: editMode ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.07)',
              color: editMode ? '#10b981' : 'var(--text-muted)',
              fontWeight: editMode ? 700 : 400, fontSize: '0.82rem',
              outline: editMode ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border-color)',
              transition: 'all 0.2s',
            }}
          >
            <Edit3 size={14} />
            {editMode ? 'Editando...' : 'Editar Grade'}
          </button>
        )}
      </div>

      {editMode && (
        <div style={{ padding: '0.6rem 1.25rem', background: 'rgba(16,185,129,0.06)', borderBottom: '1px solid rgba(16,185,129,0.15)', fontSize: '0.8rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Edit3 size={13} />
          Modo edição ativo — clique em qualquer célula para trocar o professor daquele slot.
        </div>
      )}

      <div style={{ padding: '1.25rem' }}>
        {isViewTurma ? renderTurmaGrid() : renderProfGrid()}
      </div>
    </div>
  );
}
