import type { Professor, Atribuicao, Indisponibilidade, Turma } from '../types/database';
import { TURNO_OFFSET, TURNO_MAX_SLOTS } from './constants';

interface Event {
  eventId: string;
  atribuicaoId: string;
  professorId: string;
  turmaId: string;
  turmaTurno: 'manha' | 'tarde' | 'noite';
  aulasPorDia: number;
  disciplina: string;
  profLoad: number;
  turmaLoad: number;
}

interface TimePoint {
  dia: number;
  slotRel: number;
  slotAbs: number;
}

interface SolverState {
  assignment: Map<string, TimePoint>;
  profOccupied: Set<string>;
  turmaOccupied: Set<string>;
  sameDayCount: Map<string, number>;
}

export interface ScheduledEvent {
  atribuicaoId: string;
  dia: number;
  slotRelativo: number;
}

export interface SolverSolution {
  index: number;
  events: ScheduledEvent[];
}

export interface SolverInput {
  professores: Professor[];
  turmas: Turma[];
  atribuicoes: Atribuicao[];
  indisponibilidades: Indisponibilidade[];
  maxSolutions: number;
}

export interface SolverOutput {
  solutions: SolverSolution[];
  infeasible: boolean;
  message: string;
}

export function runSolver(input: SolverInput): SolverOutput {
  const { atribuicoes, turmas, indisponibilidades, maxSolutions } = input;

  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  const profBlocked = new Set<string>();
  for (const ind of indisponibilidades) {
    const offset = TURNO_OFFSET[ind.turno];
    const maxSlots = TURNO_MAX_SLOTS[ind.turno];
    for (let s = 1; s <= maxSlots; s++) {
      profBlocked.add(`${ind.professor_id}|${ind.dia_semana}|${offset + s}`);
    }
  }

  const profEventCount = new Map<string, number>();
  const turmaEventCount = new Map<string, number>();

  const events: Event[] = [];
  for (const atr of atribuicoes) {
    const turma = turmaMap.get(atr.turma_id);
    if (!turma) continue;
    for (let occ = 0; occ < atr.aulas_semanais; occ++) {
      const eid = `${atr.id}-${occ}`;
      profEventCount.set(atr.professor_id, (profEventCount.get(atr.professor_id) ?? 0) + 1);
      turmaEventCount.set(atr.turma_id, (turmaEventCount.get(atr.turma_id) ?? 0) + 1);
      events.push({
        eventId: eid,
        atribuicaoId: atr.id,
        professorId: atr.professor_id,
        turmaId: atr.turma_id,
        turmaTurno: turma.turno,
        aulasPorDia: turma.aulas_por_dia,
        disciplina: atr.disciplina,
        profLoad: 0,
        turmaLoad: 0,
      });
    }
  }

  for (const ev of events) {
    ev.profLoad = profEventCount.get(ev.professorId) ?? 1;
    ev.turmaLoad = turmaEventCount.get(ev.turmaId) ?? 1;
  }

  if (events.length === 0) {
    return { solutions: [], infeasible: true, message: 'Nenhuma atribuição cadastrada.' };
  }

  const solutions: SolverSolution[] = [];
  const deadline = Date.now() + 15000;

  for (let run = 0; run < 20 && solutions.length < maxSolutions; run++) {
    if (Date.now() > deadline) break;
    const shuffled = shuffleWithSeed([...events], run);
    const result = backtrackMRV(
      shuffled, 0, { assignment: new Map(), profOccupied: new Set(), turmaOccupied: new Set(), sameDayCount: new Map() },
      profBlocked, deadline, solutions, maxSolutions
    );
    if (result === 'timeout') break;
  }

  if (solutions.length === 0) {
    return {
      solutions: [],
      infeasible: true,
      message: 'Não foi possível gerar uma grade válida com as restrições atuais. Verifique as indisponibilidades e as cargas horárias.',
    };
  }

  return { solutions, infeasible: false, message: `${solutions.length} solução(ões) gerada(s) com sucesso.` };
}

function buildDomain(event: Event, state: SolverState, profBlocked: Set<string>): TimePoint[] {
  const offset = TURNO_OFFSET[event.turmaTurno];
  const domain: TimePoint[] = [];

  for (let dia = 1; dia <= 6; dia++) {
    for (let slotRel = 1; slotRel <= event.aulasPorDia; slotRel++) {
      const slotAbs = offset + slotRel;
      if (state.profOccupied.has(`${event.professorId}|${dia}|${slotAbs}`)) continue;
      if (profBlocked.has(`${event.professorId}|${dia}|${slotAbs}`)) continue;
      if (state.turmaOccupied.has(`${event.turmaId}|${dia}|${slotRel}`)) continue;
      const dayKey = `${event.professorId}|${event.turmaId}|${event.disciplina}|${dia}`;
      if ((state.sameDayCount.get(dayKey) ?? 0) >= 2) continue;
      domain.push({ dia, slotRel, slotAbs });
    }
  }
  return domain;
}

function backtrackMRV(
  events: Event[],
  idx: number,
  state: SolverState,
  profBlocked: Set<string>,
  deadline: number,
  solutions: SolverSolution[],
  maxSolutions: number
): 'ok' | 'timeout' {
  if (Date.now() > deadline) return 'timeout';
  if (solutions.length >= maxSolutions) return 'ok';
  if (idx === events.length) {
    solutions.push(buildSolution(solutions.length, state.assignment));
    return 'ok';
  }

  let bestIdx = idx;
  let bestDomain: TimePoint[] | null = null;
  let bestSize = Infinity;

  for (let i = idx; i < events.length; i++) {
    if (events[i].profLoad === 0) continue;
    const domain = buildDomain(events[i], state, profBlocked);
    if (domain.length === 0) continue;
    if (domain.length < bestSize) {
      bestSize = domain.length;
      bestIdx = i;
      bestDomain = domain;
      if (bestSize <= 1) break;
    }
  }

  if (bestDomain === null || bestDomain.length === 0) return 'ok';

  [events[idx], events[bestIdx]] = [events[bestIdx], events[idx]];
  const chosen = events[idx];

  for (const tp of bestDomain) {
    assign(chosen, tp, state);
    const res = backtrackMRV(events, idx + 1, state, profBlocked, deadline, solutions, maxSolutions);
    if (res === 'timeout') return 'timeout';
    if (solutions.length >= maxSolutions) return 'ok';
    unassign(chosen, tp, state);
  }

  return 'ok';
}

function assign(event: Event, tp: TimePoint, state: SolverState): void {
  state.assignment.set(event.eventId, tp);
  state.profOccupied.add(`${event.professorId}|${tp.dia}|${tp.slotAbs}`);
  state.turmaOccupied.add(`${event.turmaId}|${tp.dia}|${tp.slotRel}`);
  const dayKey = `${event.professorId}|${event.turmaId}|${event.disciplina}|${tp.dia}`;
  state.sameDayCount.set(dayKey, (state.sameDayCount.get(dayKey) ?? 0) + 1);
}

function unassign(event: Event, tp: TimePoint, state: SolverState): void {
  state.assignment.delete(event.eventId);
  state.profOccupied.delete(`${event.professorId}|${tp.dia}|${tp.slotAbs}`);
  state.turmaOccupied.delete(`${event.turmaId}|${tp.dia}|${tp.slotRel}`);
  const dayKey = `${event.professorId}|${event.turmaId}|${event.disciplina}|${tp.dia}`;
  const prev = state.sameDayCount.get(dayKey) ?? 0;
  if (prev <= 1) state.sameDayCount.delete(dayKey);
  else state.sameDayCount.set(dayKey, prev - 1);
}

function buildSolution(idx: number, assignment: Map<string, TimePoint>): SolverSolution {
  const events: ScheduledEvent[] = [];
  for (const [eventId, tp] of assignment.entries()) {
    const atribuicaoId = eventId.replace(/-\d+$/, '');
    events.push({ atribuicaoId, dia: tp.dia, slotRelativo: tp.slotRel });
  }
  return { index: idx, events };
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  let s = seed + 1;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
