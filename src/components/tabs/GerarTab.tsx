import { useState } from 'react';
import { useAppStore } from '../../store/appStore';
import { runSolver } from '../../lib/algorithm';
import type { SolverSolution } from '../../lib/algorithm';
import type { DiaSemana } from '../../types/database';
import { Zap, AlertCircle, CheckCircle, Loader, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

import SolutionGrid from '../SolutionGrid';

interface Props {
  allReady: boolean;
  onGoToTab: (tab: any) => void;
}

export default function GerarTab({ allReady, onGoToTab }: Props) {
  const { professores, turmas, atribuicoes, indisponibilidades, saveGrades, clearGrades, gradesGeradas } = useAppStore();
  const [generating, setGenerating] = useState(false);
  const [solutions, setSolutions] = useState<SolverSolution[]>([]);
  const [selectedSolution, setSelectedSolution] = useState(0);
  const [message, setMessage] = useState('');
  const [hasGenerated, setHasGenerated] = useState(gradesGeradas.length > 0);

  const handleGenerate = async () => {
    if (!allReady) return;
    setGenerating(true);
    setMessage('');

    // Run solver in a "microtask" to allow UI to update
    await new Promise(r => setTimeout(r, 50));

    try {
      const result = runSolver({
        professores,
        turmas,
        atribuicoes,
        indisponibilidades,
        maxSolutions: 5,
      });

      if (result.infeasible || result.solutions.length === 0) {
        setMessage(result.message);
        toast.error(result.message);
        setGenerating(false);
        return;
      }

      setSolutions(result.solutions);
      setSelectedSolution(0);
      setMessage(result.message);
      setHasGenerated(true);

      // Save to DB
      const rows = result.solutions.flatMap(sol =>
        sol.events.map(ev => ({
          solution_index: sol.index,
          atribuicao_id: ev.atribuicaoId,
          dia_semana: ev.dia as DiaSemana,
          slot_relativo: ev.slotRelativo,
        }))
      );
      const saved = await saveGrades(rows);
      if (saved) toast.success(result.message);
      else toast.error('Grades geradas mas não foram salvas no banco.');
    } catch (err: any) {
      toast.error('Erro durante a geração: ' + err?.message);
      console.error(err);
    }

    setGenerating(false);
  };

  const handleClear = async () => {
    if (!confirm('Limpar todas as grades geradas?')) return;
    await clearGrades();
    setSolutions([]);
    setHasGenerated(false);
    setMessage('');
    toast.success('Grades limpas.');
  };

  // Check readiness details
  const reasons: string[] = [];
  if (professores.length === 0) reasons.push('Nenhum professor cadastrado');
  if (turmas.length === 0) reasons.push('Nenhuma turma cadastrada');
  turmas.forEach(t => {
    const total = atribuicoes.filter(a => a.turma_id === t.id).reduce((s, a) => s + a.aulas_semanais, 0);
    const needed = t.aulas_por_dia * 5;
    if (total < needed) reasons.push(`Turma "${t.nome}": ${total}/${needed} aulas atribuídas`);
  });

  return (
    <div className="animate-fade-in">
      {/* Status panel */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {allReady ? <CheckCircle size={20} color="#10b981" /> : <AlertCircle size={20} color="#f59e0b" />}
              {allReady ? 'Sistema pronto para gerar!' : 'Dados incompletos'}
            </h3>
            {!allReady && (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {reasons.map((r, i) => (
                  <li key={i} style={{ fontSize: '0.85rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ opacity: 0.7 }}>•</span> {r}
                    {r.includes('professor') && <button onClick={() => onGoToTab('professores')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}>Corrigir</button>}
                    {r.includes('Turma') && <button onClick={() => onGoToTab('atribuicoes')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.82rem', textDecoration: 'underline' }}>Corrigir</button>}
                  </li>
                ))}
              </ul>
            )}
            {allReady && (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {professores.length} professor(es) · {turmas.length} turma(s) · {atribuicoes.length} atribuição(ões)
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {hasGenerated && (
              <button onClick={handleClear} className="btn" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                <Trash2 size={15} /> Limpar
              </button>
            )}
            <button
              onClick={handleGenerate}
              disabled={!allReady || generating}
              className="btn btn-primary"
              style={{ padding: '0.65rem 1.5rem', fontSize: '1rem', fontWeight: 700, opacity: allReady ? 1 : 0.4 }}
            >
              {generating ? <><Loader size={18} className="spin" /> Gerando...</> : <><Zap size={18} /> Gerar Grade Horária</>}
            </button>
          </div>
        </div>

        {message && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 8, fontSize: '0.88rem', color: '#10b981' }}>
            {message}
          </div>
        )}
      </div>

      {/* Solutions */}
      {solutions.length > 0 && (
        <div>
          {/* Solution selector */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {solutions.map((_sol, i) => (
              <button
                key={i}
                onClick={() => setSelectedSolution(i)}
                className="btn"
                style={{
                  padding: '0.5rem 1.25rem',
                  background: selectedSolution === i ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: selectedSolution === i ? 'white' : 'var(--text-muted)',
                  border: selectedSolution === i ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                  fontWeight: selectedSolution === i ? 700 : 400,
                }}
              >
                Opção {i + 1}
              </button>
            ))}
          </div>

          <SolutionGrid solution={solutions[selectedSolution]} />
        </div>
      )}
    </div>
  );
}
