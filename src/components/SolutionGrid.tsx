import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import type { SolverSolution } from '../lib/algorithm';
import { DIAS_SEMANA, SLOT_TIMES, TURNO_LABEL, TURNO_OFFSET, disciplinaColor } from '../lib/constants';
import type { Turno } from '../types/database';

interface Props { solution: SolverSolution; }

export default function SolutionGrid({ solution }: Props) {
  const { turmas, atribuicoes, professores } = useAppStore();
  const [viewMode, setViewMode] = useState<'turma' | 'professor'>('turma');
  const [selectedId, setSelectedId] = useState<string>(turmas[0]?.id ?? '');

  const profMap  = new Map(professores.map(p => [p.id, p]));
  const atrMap   = new Map(atribuicoes.map(a => [a.id, a]));
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  // ─── TURMA VIEW ─────────────────────────────────────────────────────────────
  const renderTurmaGrid = () => {
    const turma = turmaMap.get(selectedId);
    if (!turma) return <p style={{ color: 'var(--text-muted)', padding: '2rem' }}>Selecione uma turma.</p>;

    const turnoSlots = SLOT_TIMES[turma.turno as Turno];
    const slotCount  = turma.aulas_por_dia;

    type Cell = { disciplina: string; professorNome: string } | null;
    const grid: Cell[][] = Array.from({ length: 7 }, () => Array(slotCount + 1).fill(null));

    for (const ev of solution.events) {
      const atr = atrMap.get(ev.atribuicaoId);
      if (!atr || atr.turma_id !== selectedId) continue;
      const prof = profMap.get(atr.professor_id);
      if (ev.dia >= 1 && ev.dia <= 6 && ev.slotRelativo >= 1 && ev.slotRelativo <= slotCount) {
        grid[ev.dia][ev.slotRelativo] = {
          disciplina: atr.disciplina,
          professorNome: prof?.nome ?? '—',
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
                  return (
                    <td key={dia.id} style={{
                      height: 76, borderRadius: 10, padding: '0.55rem 0.65rem',
                      background: cell ? `${color}1a` : 'rgba(255,255,255,0.03)',
                      border: cell ? `1px solid ${color}50` : '1px solid rgba(255,255,255,0.06)',
                      verticalAlign: 'top', transition: 'all 0.15s',
                    }}>
                      {cell && (
                        <div>
                          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: color!, lineHeight: 1.3, marginBottom: 2 }}>{cell.disciplina}</p>
                          <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{cell.professorNome.split(' ')[0]}</p>
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
    // grid[dia][absSlot] → Cell
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
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: 3 }}>
          {(['turma', 'professor'] as const).map(mode => (
            <button key={mode} onClick={() => { setViewMode(mode); setSelectedId(mode === 'turma' ? (turmas[0]?.id ?? '') : (professores[0]?.id ?? '')); }}
              style={{ padding: '0.4rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: viewMode === mode ? 'rgba(59,130,246,0.35)' : 'transparent', color: viewMode === mode ? 'white' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {mode === 'turma' ? 'Por Turma' : 'Por Professor'}
            </button>
          ))}
        </div>

        <select className="input-field" style={{ flex: 1, maxWidth: 260 }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
          {entities.map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
        </select>

        {isViewTurma && selectedId && turmaMap.has(selectedId) && (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '0.3rem 0.65rem', borderRadius: 6 }}>
            {TURNO_LABEL[turmaMap.get(selectedId)!.turno as Turno]}
          </span>
        )}
      </div>

      <div style={{ padding: '1.25rem' }}>
        {isViewTurma ? renderTurmaGrid() : renderProfGrid()}
      </div>
    </div>
  );
}
