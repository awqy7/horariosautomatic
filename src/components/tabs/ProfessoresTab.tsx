import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  Plus, Trash2, ChevronDown, ChevronUp, X, BookOpen,
  Calendar, Check, Edit2, Save, ArrowRight, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import type { Professor, Turma, DiaSemana } from '../../types/database';
import { DIAS_SEMANA, MATERIAS_BNCC } from '../../lib/constants';
import { runSolver } from '../../lib/algorithm';

const TURNOS = [
  { id: 'manha', label: 'Manhã' },
  { id: 'tarde', label: 'Tarde' },
  { id: 'noite', label: 'Noite' },
] as const;

type InnerTab = 'materias' | 'disponibilidade' | 'lote';

interface AtribWizard {
  turmaId: string;
  disciplina: string;
}

// ─── Quick-add wizard state ────────────────────────────────────────────────────
interface WizardState {
  nome: string;
  materiasSelecionadas: string[];
  diasBloqueados: Set<string>; // "dia-turno"
  atribuicoes: AtribWizard[];
  bulkOption: 'none' | '6to9' | '1to3' | 'both' | 'all';
  bulkMateria: string;
  autoGenerateSchedule: boolean;
}

const emptyWizard = (): WizardState => ({
  nome: '',
  materiasSelecionadas: [],
  diasBloqueados: new Set(),
  atribuicoes: [],
  bulkOption: 'none',
  bulkMateria: '',
  autoGenerateSchedule: true,
});

interface Props {
  onGoToGerar?: () => void;
}

// Helper to check if a class (turma) matches the selected range for bulk assignment
const matchTurmaForBulk = (turma: Turma, bulkOption: string) => {
  if (bulkOption === 'all') return true;
  const nivel = turma.nivel.toLowerCase();
  const isFundII = nivel.includes('fund. ii') || nivel.includes('6º') || nivel.includes('7º') || nivel.includes('8º') || nivel.includes('9º');
  const isMedio = nivel.includes('médio') || nivel.includes('medio') || nivel.includes('1º ano') || nivel.includes('2º ano') || nivel.includes('3º ano') || nivel.includes('médio');
  
  if (bulkOption === '6to9') return isFundII;
  if (bulkOption === '1to3') return isMedio;
  if (bulkOption === 'both') return isFundII || isMedio;
  return false;
};

export default function ProfessoresTab({ onGoToGerar }: Props) {
  const {
    professores, indisponibilidades, turmas, atribuicoes,
    addProfessor, deleteProfessor,
    setIndisponibilidade, updateProfessorMaterias,
    addAtribuicao, saveGrades
  } = useAppStore();

  // ── wizard ──────────────────────────────────────────────────────────────────
  const [wiz, setWiz] = useState<WizardState>(emptyWizard());
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // ── list ────────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState<string | null>(null);
  const [innerTab, setInnerTab] = useState<Record<string, InnerTab>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // ── edit name inline ─────────────────────────────────────────────────────────
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editNameVal, setEditNameVal] = useState('');

  // ─── edit bulk states ────────────────────────────────────────────────────────
  const [editBulkOpt, setEditBulkOpt] = useState<'none' | '6to9' | '1to3' | 'both' | 'all'>('none');
  const [editBulkMat, setEditBulkMat] = useState('');
  const [editBulkAuto, setEditBulkAuto] = useState(true);
  const [applyingBulk, setApplyingBulk] = useState<string | null>(null);

  const handleApplyBulk = async (profId: string) => {
    if (editBulkOpt === 'none' || !editBulkMat) return;
    setApplyingBulk(profId);

    const matchingTurmas = turmas.filter(t => matchTurmaForBulk(t, editBulkOpt));
    if (matchingTurmas.length === 0) {
      toast.error('Nenhuma turma cadastrada corresponde a esta faixa de atribuição.');
      setApplyingBulk(null);
      return;
    }

    const resolveToastId = toast.loading('Aplicando atribuições...');

    // Save each assignment
    let count = 0;
    for (const t of matchingTurmas) {
      const alreadyAssigned = atribuicoes.some(a => a.professor_id === profId && a.turma_id === t.id && a.disciplina === editBulkMat);
      if (!alreadyAssigned) {
        const aulas = t.carga_horaria?.[editBulkMat] ?? 2;
        await addAtribuicao({
          professor_id: profId,
          turma_id: t.id,
          disciplina: editBulkMat,
          aulas_semanais: aulas
        });
        count++;
      }
    }

    toast.success(`${count} atribuição(ões) realizada(s) com sucesso!`, { id: resolveToastId });

    if (editBulkAuto) {
      const solverToastId = toast.loading('Calculando novos horários...');
      await new Promise(resolve => setTimeout(resolve, 300));
      const state = useAppStore.getState();

      const result = runSolver({
        professores: state.professores,
        turmas: state.turmas,
        atribuicoes: state.atribuicoes,
        indisponibilidades: state.indisponibilidades,
        maxSolutions: 5,
      });

      if (result.infeasible || result.solutions.length === 0) {
        toast.error(`Atribuições salvas, mas não foi possível gerar uma grade válida: ${result.message}`, { id: solverToastId, duration: 6000 });
      } else {
        const rows = result.solutions.flatMap(sol =>
          sol.events.map(ev => ({
            solution_index: sol.index,
            atribuicao_id: ev.atribuicaoId,
            dia_semana: ev.dia as DiaSemana,
            slot_relativo: ev.slotRelativo,
          }))
        );
        const saved = await saveGrades(rows);
        if (saved) {
          toast.success(`Nova grade horária recalculada com sucesso!`, { id: solverToastId, duration: 4000 });
          if (onGoToGerar) {
            setTimeout(() => { onGoToGerar(); }, 800);
          }
        } else {
          toast.error('Erro ao salvar as novas grades recalculadas.', { id: solverToastId });
        }
      }
    }

    setApplyingBulk(null);
    setEditBulkOpt('none');
    setEditBulkMat('');
  };

  // ─── wizard helpers ──────────────────────────────────────────────────────────
  const toggleWizMateria = (m: string) =>
    setWiz(w => {
      const nextMaterias = w.materiasSelecionadas.includes(m)
        ? w.materiasSelecionadas.filter(x => x !== m)
        : [...w.materiasSelecionadas, m];
      return {
        ...w,
        materiasSelecionadas: nextMaterias,
        bulkMateria: w.bulkMateria && nextMaterias.includes(w.bulkMateria)
          ? w.bulkMateria
          : nextMaterias[0] || '',
      };
    });

  const toggleWizDia = (dia: number, turno: string) => {
    const key = `${dia}-${turno}`;
    setWiz(w => {
      const next = new Set(w.diasBloqueados);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...w, diasBloqueados: next };
    });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wiz.nome.trim()) return;
    setAdding(true);

    // 1. Create professor
    const ok = await addProfessor(wiz.nome.trim(), '');
    if (!ok) { toast.error('Erro ao adicionar professor.'); setAdding(false); return; }

    // 2. Get the newly created professor (last added)
    const fresh = useAppStore.getState().professores.find(p => p.nome === wiz.nome.trim());
    if (fresh) {
      // 3. Set materias
      if (wiz.materiasSelecionadas.length > 0)
        await updateProfessorMaterias(fresh.id, wiz.materiasSelecionadas);

      // 4. Set indisponibilidades
      for (const key of wiz.diasBloqueados) {
        const [diaStr, turno] = key.split('-');
        await setIndisponibilidade(fresh.id, parseInt(diaStr), turno, true);
      }

      // 5. Create manual atribuicoes
      for (const atr of wiz.atribuicoes) {
        if (atr.turmaId && atr.disciplina) {
          const selectedTurma = turmas.find(t => t.id === atr.turmaId);
          const aulas = selectedTurma?.carga_horaria?.[atr.disciplina] ?? 2;
          await addAtribuicao({
            professor_id: fresh.id,
            turma_id: atr.turmaId,
            disciplina: atr.disciplina,
            aulas_semanais: aulas
          });
        }
      }

      // 6. Create bulk assignments
      if (wiz.bulkOption !== 'none' && wiz.bulkMateria) {
        const matchingTurmas = turmas.filter(t => matchTurmaForBulk(t, wiz.bulkOption));
        for (const t of matchingTurmas) {
          const alreadyAssigned = wiz.atribuicoes.some(atr => atr.turmaId === t.id && atr.disciplina === wiz.bulkMateria);
          if (!alreadyAssigned) {
            const aulas = t.carga_horaria?.[wiz.bulkMateria] ?? 2;
            await addAtribuicao({
              professor_id: fresh.id,
              turma_id: t.id,
              disciplina: wiz.bulkMateria,
              aulas_semanais: aulas
            });
          }
        }
      }

      // 7. Auto-generate schedule if selected
      if (wiz.autoGenerateSchedule) {
        const resolveToastId = toast.loading('Calculando novos horários...');
        
        // Let the state update finish and get the latest values
        await new Promise(resolve => setTimeout(resolve, 300));
        const state = useAppStore.getState();

        const result = runSolver({
          professores: state.professores,
          turmas: state.turmas,
          atribuicoes: state.atribuicoes,
          indisponibilidades: state.indisponibilidades,
          maxSolutions: 5,
        });

        if (result.infeasible || result.solutions.length === 0) {
          toast.error(`Professor adicionado, mas não foi possível gerar uma grade válida: ${result.message}`, { id: resolveToastId, duration: 6000 });
        } else {
          const rows = result.solutions.flatMap(sol =>
            sol.events.map(ev => ({
              solution_index: sol.index,
              atribuicao_id: ev.atribuicaoId,
              dia_semana: ev.dia as DiaSemana,
              slot_relativo: ev.slotRelativo,
            }))
          );
          const saved = await saveGrades(rows);
          if (saved) {
            toast.success(`Professor cadastrado e nova grade horária gerada com sucesso!`, { id: resolveToastId, duration: 4000 });
            if (onGoToGerar) {
              setTimeout(() => { onGoToGerar(); }, 800);
            }
          } else {
            toast.error('Erro ao salvar as novas grades geradas no banco.', { id: resolveToastId });
          }
        }
      } else {
        toast.success(`Professor "${wiz.nome.trim()}" adicionado com sucesso!`);
      }
    }

    setWiz(emptyWizard());
    setShowForm(false);
    setAdding(false);
  };

  // ─── list helpers ────────────────────────────────────────────────────────────
  const handleDelete = async (p: Professor) => {
    if (!confirm(`Remover "${p.nome}"? Todas as atribuições serão removidas.`)) return;
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

  const getInnerTab = (profId: string): InnerTab => innerTab[profId] ?? 'materias';
  const setTab = (profId: string, tab: InnerTab) =>
    setInnerTab(prev => ({ ...prev, [profId]: tab }));

  const handleSaveName = async (prof: Professor) => {
    if (!editNameVal.trim()) { setEditingName(null); return; }
    setSaving(`name-${prof.id}`);
    // update via materias update trick — we just update the name in professores
    // Since store doesn't have updateNome, we use a local workaround: re-fetch after
    // For now update via supabase directly
    const { supabase } = await import('../../lib/supabase');
    const { error } = await supabase.from('professores').update({ nome: editNameVal.trim() }).eq('id', prof.id);
    if (!error) {
      useAppStore.setState(s => ({
        professores: s.professores.map(p => p.id === prof.id ? { ...p, nome: editNameVal.trim() } : p),
      }));
      toast.success('Nome atualizado!');
    } else {
      toast.error('Erro ao atualizar nome.');
    }
    setSaving(null);
    setEditingName(null);
  };

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <div className="animate-fade-in">

      {/* ── FORMULÁRIO DE CADASTRO ─────────────────────────────────────────── */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.1rem 1.5rem', cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowForm(v => !v)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={17} color="var(--primary)" />
            </div>
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Cadastrar Novo Professor</span>
          </div>
          {showForm ? <ChevronUp size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </div>

        {showForm && (
          <form onSubmit={handleAdd} style={{ borderTop: '1px solid var(--border-color)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Nome */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Nome do Professor *
              </label>
              <input
                className="input-field"
                style={{ maxWidth: 400 }}
                value={wiz.nome}
                onChange={e => setWiz(w => ({ ...w, nome: e.target.value }))}
                placeholder="Nome completo"
                required
              />
            </div>

            {/* Matérias */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                📚 Matérias que leciona
                {wiz.materiasSelecionadas.length > 0 && (
                  <span style={{ marginLeft: 8, background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '1px 8px', fontSize: '0.72rem' }}>
                    {wiz.materiasSelecionadas.length} selecionada{wiz.materiasSelecionadas.length !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '0.4rem' }}>
                {MATERIAS_BNCC.map(m => {
                  const sel = wiz.materiasSelecionadas.includes(m);
                  return (
                    <button
                      key={m} type="button"
                      onClick={() => toggleWizMateria(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        padding: '0.5rem 0.8rem', borderRadius: 8, cursor: 'pointer',
                        background: sel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                        border: sel ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border-color)',
                        color: sel ? 'white' : 'var(--text-muted)',
                        fontWeight: sel ? 600 : 400, fontSize: '0.84rem', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, background: sel ? 'var(--primary)' : 'rgba(255,255,255,0.08)', border: sel ? 'none' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                        {sel && <Check size={10} color="white" strokeWidth={3} />}
                      </div>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Atribuição Rápida em Lote (Opcional) */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>
                  <Sparkles size={16} color="var(--primary)" /> Atribuição Rápida em Lote (Opcional)
                </label>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Atribua este professor a várias turmas automaticamente de acordo com as séries/anos correspondentes.
                </p>
              </div>

              {/* Cards de Opções */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
                {([
                  { id: 'none', label: 'Manual', desc: 'Atribuições manuais abaixo' },
                  { id: '6to9', label: '6º ao 9º Ano', desc: 'Turmas do Ensino Fund. II' },
                  { id: '1to3', label: '1º ao 3º Ano', desc: 'Turmas do Ensino Médio' },
                  { id: 'both', label: 'Ambos os Níveis', desc: 'Fund. II e Ensino Médio' },
                  { id: 'all', label: 'Todas as Salas', desc: 'Todas as turmas registradas' },
                ] as const).map(opt => {
                  const active = wiz.bulkOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setWiz(w => ({ ...w, bulkOption: opt.id }))}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '0.25rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                        border: active ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        boxShadow: active ? '0 0 12px rgba(59,130,246,0.15)' : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span style={{ fontWeight: 700, fontSize: '0.84rem', color: active ? 'white' : 'var(--text-muted)' }}>
                        {opt.label}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>

              {wiz.bulkOption !== 'none' && (
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }} className="animate-fade-in">
                  <div style={{ flex: '1 1 200px' }}>
                    <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      Matéria para Atribuição em Lote *
                    </label>
                    <select
                      className="input-field"
                      style={{ height: 38 }}
                      value={wiz.bulkMateria}
                      onChange={e => setWiz(w => ({ ...w, bulkMateria: e.target.value }))}
                      required
                    >
                      <option value="">Selecione a disciplina...</option>
                      {wiz.materiasSelecionadas.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    {wiz.materiasSelecionadas.length === 0 && (
                      <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem' }}>
                        ⚠️ Selecione as matérias lecionadas no passo acima primeiro.
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: 38, marginLeft: 'auto' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        cursor: 'pointer',
                        padding: '0.5rem 0.8rem',
                        borderRadius: '8px',
                        background: 'rgba(16,185,129,0.06)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        fontSize: '0.84rem',
                        fontWeight: 600,
                        color: '#10b981',
                        userSelect: 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={wiz.autoGenerateSchedule}
                        onChange={e => setWiz(w => ({ ...w, autoGenerateSchedule: e.target.checked }))}
                        style={{
                          width: 15,
                          height: 15,
                          accentColor: '#10b981',
                          cursor: 'pointer',
                        }}
                      />
                      <span>Gerar horários automaticamente após salvar</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Atribuições / Turmas */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                🏫 Turmas e Carga Horária
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {wiz.atribuicoes.map((atr, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                    <select
                      className="input-field"
                      style={{ flex: 1, height: 38 }}
                      value={atr.turmaId}
                      onChange={e => setWiz(w => {
                        const newAtrs = [...w.atribuicoes];
                        newAtrs[index].turmaId = e.target.value;
                        return { ...w, atribuicoes: newAtrs };
                      })}
                    >
                      <option value="">Selecione a Turma...</option>
                      {turmas.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                    </select>
                    
                    <select
                      className="input-field"
                      style={{ flex: 1, height: 38 }}
                      value={atr.disciplina}
                      onChange={e => setWiz(w => {
                        const newAtrs = [...w.atribuicoes];
                        newAtrs[index].disciplina = e.target.value;
                        return { ...w, atribuicoes: newAtrs };
                      })}
                    >
                      <option value="">Disciplina...</option>
                      {wiz.materiasSelecionadas.map(m => <option key={m} value={m}>{m}</option>)}
                      {wiz.materiasSelecionadas.length === 0 && <option value="" disabled>Selecione as matérias acima primeiro</option>}
                    </select>

                    {atr.turmaId && atr.disciplina && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(59,130,246,0.1)', padding: '0 0.75rem', borderRadius: 8, border: '1px solid rgba(59,130,246,0.2)', height: 38 }}>
                        <span style={{ fontSize: '0.78rem', color: '#93c5fd', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {turmas.find(t => t.id === atr.turmaId)?.carga_horaria?.[atr.disciplina] ?? 2} aulas/sem
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setWiz(w => ({ ...w, atribuicoes: w.atribuicoes.filter((_, i) => i !== index) }))}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.4rem' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setWiz(w => ({ ...w, atribuicoes: [...w.atribuicoes, { turmaId: '', disciplina: w.materiasSelecionadas[0] || '', aulasSemanais: 2 }] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.8rem', borderRadius: 8, background: 'rgba(59,130,246,0.1)', color: 'var(--primary)', border: '1px dashed rgba(59,130,246,0.4)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: 600, width: 'fit-content' }}
                >
                  <Plus size={14} /> Adicionar Turma/Disciplina
                </button>
              </div>
            </div>

            {/* Dias que NÃO trabalha */}
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                🚫 Dias / turnos que <span style={{ color: '#ef4444' }}>NÃO trabalha</span>
                {wiz.diasBloqueados.size > 0 && (
                  <span style={{ marginLeft: 8, background: 'rgba(239,68,68,0.2)', color: '#ef4444', borderRadius: 99, padding: '1px 8px', fontSize: '0.72rem' }}>
                    {wiz.diasBloqueados.size} bloqueio{wiz.diasBloqueados.size !== 1 ? 's' : ''}
                  </span>
                )}
              </label>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'separate', borderSpacing: 4, minWidth: 480 }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '0.4rem 0.6rem', textAlign: 'left', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Período</th>
                      {DIAS_SEMANA.map(d => (
                        <th key={d.id} style={{ padding: '0.4rem 0.6rem', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', minWidth: 55 }}>{d.short}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TURNOS.map(turno => (
                      <tr key={turno.id}>
                        <td style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>{turno.label}</td>
                        {DIAS_SEMANA.map(dia => {
                          const blocked = wiz.diasBloqueados.has(`${dia.id}-${turno.id}`);
                          return (
                            <td key={dia.id} style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => toggleWizDia(dia.id, turno.id)}
                                title={blocked ? 'Clique para liberar' : 'Clique para bloquear'}
                                style={{
                                  width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer',
                                  background: blocked ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)',
                                  outline: blocked ? '2px solid rgba(239,68,68,0.5)' : '1px solid var(--border-color)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s', margin: '0 auto',
                                }}
                              >
                                {blocked && <X size={13} color="#ef4444" />}
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

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="submit" className="btn btn-primary" disabled={adding || !wiz.nome.trim()} style={{ padding: '0.65rem 1.5rem' }}>
                <Plus size={16} /> {adding ? 'Salvando...' : 'Adicionar Professor'}
              </button>
              <button type="button" className="btn" onClick={() => { setWiz(emptyWizard()); setShowForm(false); }} style={{ color: 'var(--text-muted)' }}>
                Cancelar
              </button>
              {onGoToGerar && (
                <button type="button" className="btn" onClick={onGoToGerar} style={{ marginLeft: 'auto', color: 'var(--primary)', borderColor: 'rgba(59,130,246,0.3)' }}>
                  Ir para Gerar Grade <ArrowRight size={15} />
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* ── LISTA ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {professores.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
            Nenhum professor cadastrado ainda. Clique em "Cadastrar Novo Professor" acima.
          </p>
        )}
        {professores.map(prof => {
          const isOpen = expanded === prof.id;
          const materias = prof.materias ?? [];
          const blockedCount = indisponibilidades.filter(i => i.professor_id === prof.id).length;
          const tab = getInnerTab(prof.id);

          return (
            <div key={prof.id} className="glass-panel" style={{ overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', cursor: 'pointer' }}
                onClick={() => setExpanded(isOpen ? null : prof.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)', fontSize: '1rem', flexShrink: 0 }}>
                    {prof.nome.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {editingName === prof.id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }} onClick={e => e.stopPropagation()}>
                        <input
                          className="input-field"
                          style={{ padding: '3px 8px', fontSize: '0.9rem', width: 220 }}
                          value={editNameVal}
                          onChange={e => setEditNameVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveName(prof); if (e.key === 'Escape') setEditingName(null); }}
                          autoFocus
                        />
                        <button onClick={() => handleSaveName(prof)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}><Save size={15} /></button>
                        <button onClick={() => setEditingName(null)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={15} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <p style={{ fontWeight: 600, fontSize: '0.95rem' }}>{prof.nome}</p>
                        <button
                          onClick={e => { e.stopPropagation(); setEditingName(prof.id); setEditNameVal(prof.nome); }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2, opacity: 0.6 }}
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 2 }}>
                      {materias.length > 0 ? (
                        <span style={{ color: '#3b82f6' }}>📚 {materias.length} matéria{materias.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span style={{ color: '#f59e0b' }}>⚠ Sem matérias</span>
                      )}
                      {blockedCount > 0 && (
                        <span style={{ color: '#f59e0b' }}>🚫 {blockedCount} bloqueio{blockedCount !== 1 ? 's' : ''}</span>
                      )}
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

              {/* Expanded */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.15)' }}>
                    {([
                      { id: 'materias' as InnerTab, label: 'Matérias', icon: <BookOpen size={14} /> },
                      { id: 'disponibilidade' as InnerTab, label: 'Disponibilidade', icon: <Calendar size={14} /> },
                      { id: 'lote' as InnerTab, label: 'Atribuição em Lote', icon: <Sparkles size={14} /> },
                    ]).map(t => (
                      <button key={t.id} onClick={() => setTab(prof.id, t.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.65rem 1.25rem', background: 'transparent', border: 'none', cursor: 'pointer', color: tab === t.id ? 'white' : 'var(--text-muted)', fontWeight: tab === t.id ? 600 : 400, fontSize: '0.84rem', borderBottom: tab === t.id ? '2px solid var(--primary)' : '2px solid transparent' }}>
                        {t.icon} {t.label}
                        {t.id === 'materias' && materias.length > 0 && (
                          <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 99, padding: '0 6px', fontSize: '0.7rem', fontWeight: 700 }}>{materias.length}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {tab === 'materias' && (
                    <div style={{ padding: '1.25rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                        Disciplinas que <strong style={{ color: 'white' }}>{prof.nome}</strong> está habilitado a lecionar:
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.4rem' }}>
                        {MATERIAS_BNCC.map(materia => {
                          const selected = materias.includes(materia);
                          const isSavingThis = saving === `mat-${prof.id}-${materia}`;
                          return (
                            <button key={materia} onClick={() => toggleMateria(prof, materia)} disabled={!!saving}
                              style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.55rem 0.85rem', borderRadius: 8, background: selected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', border: selected ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border-color)', color: selected ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontSize: '0.84rem', fontWeight: selected ? 600 : 400, transition: 'all 0.15s', textAlign: 'left' }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: selected ? 'var(--primary)' : 'rgba(255,255,255,0.08)', border: selected ? 'none' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                                {selected && !isSavingThis && <Check size={11} color="white" strokeWidth={3} />}
                                {isSavingThis && <div style={{ width: 10, height: 10, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                              </div>
                              {materia}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

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
                                      <button onClick={() => toggleIndisponib(prof.id, dia.id, turno.id)} disabled={saving === key}
                                        style={{ width: 34, height: 34, borderRadius: 8, border: 'none', cursor: 'pointer', background: blocked ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)', outline: blocked ? '2px solid rgba(239,68,68,0.5)' : '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', margin: '0 auto' }}>
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

                  {tab === 'lote' && (
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Atribua <strong style={{ color: 'white' }}>{prof.nome}</strong> a várias turmas de uma só vez e recalcule a grade horária:
                      </p>

                      {/* Cards de Opções */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.6rem' }}>
                        {([
                          { id: 'none', label: 'Selecionar...', desc: 'Selecione uma opção' },
                          { id: '6to9', label: '6º ao 9º Ano', desc: 'Turmas do Ensino Fund. II' },
                          { id: '1to3', label: '1º ao 3º Ano', desc: 'Turmas do Ensino Médio' },
                          { id: 'both', label: 'Ambos os Níveis', desc: 'Fund. II e Ensino Médio' },
                          { id: 'all', label: 'Todas as Salas', desc: 'Todas as turmas registradas' },
                        ] as const).map(opt => {
                          const active = editBulkOpt === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setEditBulkOpt(opt.id);
                                if (!editBulkMat) {
                                  setEditBulkMat(prof.materias?.[0] || '');
                                }
                              }}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '0.25rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                background: active ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.02)',
                                border: active ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                                boxShadow: active ? '0 0 12px rgba(59,130,246,0.15)' : 'none',
                                transition: 'all 0.2s ease',
                              }}
                            >
                              <span style={{ fontWeight: 700, fontSize: '0.84rem', color: active ? 'white' : 'var(--text-muted)' }}>
                                {opt.label}
                              </span>
                              <span style={{ fontSize: '0.72rem', color: active ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)' }}>
                                {opt.desc}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {editBulkOpt !== 'none' && (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }} className="animate-fade-in">
                          <div style={{ flex: '1 1 200px' }}>
                            <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                              Matéria para Atribuição em Lote *
                            </label>
                            <select
                              className="input-field"
                              style={{ height: 38 }}
                              value={editBulkMat}
                              onChange={e => setEditBulkMat(e.target.value)}
                              required
                            >
                              <option value="">Selecione a disciplina...</option>
                              {prof.materias?.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            {(prof.materias ?? []).length === 0 && (
                              <p style={{ fontSize: '0.72rem', color: '#f59e0b', marginTop: '0.3rem' }}>
                                ⚠️ O professor não possui matérias cadastradas. Cadastre-as na aba "Matérias" ao lado.
                              </p>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: 38, marginLeft: 'auto' }}>
                            <label
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.6rem',
                                cursor: 'pointer',
                                padding: '0.5rem 0.8rem',
                                borderRadius: '8px',
                                background: 'rgba(16,185,129,0.06)',
                                border: '1px solid rgba(16,185,129,0.2)',
                                fontSize: '0.84rem',
                                fontWeight: 600,
                                color: '#10b981',
                                userSelect: 'none',
                                transition: 'all 0.15s',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={editBulkAuto}
                                onChange={e => setEditBulkAuto(e.target.checked)}
                                style={{
                                  width: 15,
                                  height: 15,
                                  accentColor: '#10b981',
                                  cursor: 'pointer',
                                }}
                              />
                              <span>Gerar horários automaticamente</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {editBulkOpt !== 'none' && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleApplyBulk(prof.id)}
                            disabled={applyingBulk === prof.id || !editBulkMat}
                            className="btn btn-primary"
                            style={{ padding: '0.6rem 1.5rem', fontSize: '0.88rem', fontWeight: 700 }}
                          >
                            {applyingBulk === prof.id ? 'Aplicando Atribuições...' : 'Aplicar Atribuições em Lote'}
                          </button>
                        </div>
                      )}
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
