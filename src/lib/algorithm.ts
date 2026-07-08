import type { Professor, Atribuicao, Indisponibilidade, Turma } from '../types/database';
import { TURNO_OFFSET } from './constants';

interface Event {
  eventId: string;
  atribuicaoId: string;
  professorId: string;
  turmaId: string;
  turmaTurno: 'manha' | 'tarde' | 'noite';
  aulasPorDia: number;
  disciplina: string;
}

interface SolverState {
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
    for (let s = 1; s <= 6; s++) {
      profBlocked.add(`${ind.professor_id}|${ind.dia_semana}|${offset + s}`);
    }
  }

  const events: Event[] = [];
  for (const atr of atribuicoes) {
    const turma = turmaMap.get(atr.turma_id);
    if (!turma) continue;
    for (let occ = 0; occ < atr.aulas_semanais; occ++) {
      events.push({
        eventId: `${atr.id}-${occ}`,
        atribuicaoId: atr.id,
        professorId: atr.professor_id,
        turmaId: atr.turma_id,
        turmaTurno: turma.turno,
        aulasPorDia: turma.aulas_por_dia,
        disciplina: atr.disciplina,
      });
    }
  }

  if (events.length === 0) {
    return { solutions: [], infeasible: true, message: 'Nenhuma atribuição cadastrada.' };
  }

  const solutions: SolverSolution[] = [];
  const deadline = Date.now() + 10000;

  for (let run = 0; run < 2000 && solutions.length < maxSolutions; run++) {
    if (Date.now() > deadline) break;

    const order = shuffle([...events], run);

    const assignment = tryAssign(order, profBlocked);
    if (assignment) {
      solutions.push(buildSolution(solutions.length, assignment));
    }
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

function tryAssign(events: Event[], profBlocked: Set<string>): Map<string, ScheduledEvent> | null {
  const state: SolverState = {
    profOccupied: new Set(),
    turmaOccupied: new Set(),
    sameDayCount: new Map(),
  };
  const result = new Map<string, ScheduledEvent>();

  for (const ev of events) {
    const slot = findSlot(ev, state, profBlocked);
    if (!slot) return null;

    result.set(ev.eventId, { atribuicaoId: ev.atribuicaoId, dia: slot.dia, slotRelativo: slot.slotRel });
    state.profOccupied.add(`${ev.professorId}|${slot.dia}|${slot.slotAbs}`);
    state.turmaOccupied.add(`${ev.turmaId}|${slot.dia}|${slot.slotRel}`);
    const dayKey = `${ev.professorId}|${ev.turmaId}|${ev.disciplina}|${slot.dia}`;
    state.sameDayCount.set(dayKey, (state.sameDayCount.get(dayKey) ?? 0) + 1);
  }

  return result;
}

function findSlot(ev: Event, state: SolverState, profBlocked: Set<string>): { dia: number; slotRel: number; slotAbs: number } | null {
  const offset = TURNO_OFFSET[ev.turmaTurno];

  for (let dia = 1; dia <= 6; dia++) {
    for (let slotRel = 1; slotRel <= ev.aulasPorDia; slotRel++) {
      const slotAbs = offset + slotRel;
      if (state.profOccupied.has(`${ev.professorId}|${dia}|${slotAbs}`)) continue;
      if (profBlocked.has(`${ev.professorId}|${dia}|${slotAbs}`)) continue;
      if (state.turmaOccupied.has(`${ev.turmaId}|${dia}|${slotRel}`)) continue;
      const dayKey = `${ev.professorId}|${ev.turmaId}|${ev.disciplina}|${dia}`;
      if ((state.sameDayCount.get(dayKey) ?? 0) >= 2) continue;
      return { dia, slotRel, slotAbs };
    }
  }
  return null;
}

function buildSolution(idx: number, assignment: Map<string, ScheduledEvent>): SolverSolution {
  return { index: idx, events: Array.from(assignment.values()) };
}

function shuffle<T>(arr: T[], seed: number): T[] {
  let s = seed + 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
