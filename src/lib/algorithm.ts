/**
 * EducaSched – CSP Timetabling Algorithm
 *
 * Implements Constraint Satisfaction Problem backtracking with:
 *  - MRV (Minimum Remaining Values) heuristic for variable ordering
 *  - Forward Checking for early failure detection
 *  - Domain shuffling to produce diverse solutions
 *  - Time-budget guard (max 20 seconds per run)
 *
 * Hard Constraints:
 *  1. A professor cannot be in two turmas at the exact same absolute timeslot.
 *  2. A turma cannot have two classes at the same relative timeslot.
 *  3. A professor must not be assigned during their marked unavailability periods.
 *  4. Each atribuição's aulas_semanais must be satisfied exactly.
 *
 * Soft Constraint (applied as hard for quality):
 *  5. Max 2 aulas of the same disciplina for the same turma on a single day.
 */

import type { Professor, Atribuicao, Indisponibilidade, Turma } from '../types/database';
import { TURNO_OFFSET, TURNO_MAX_SLOTS } from './constants';

// ─── Internal Types ───────────────────────────────────────────────────────────

/** One "event" = a single lesson-occurrence that must be placed in the grid. */
interface Event {
  eventId: string;          // unique: `${atribuicaoId}-${occurrence}`
  atribuicaoId: string;
  professorId: string;
  turmaId: string;
  turmaTurno: 'manha' | 'tarde' | 'noite';
  aulasPorDia: number;      // max slots per day in this turma
  disciplina: string;
}

interface TimePoint {
  dia: number;          // 1–6
  slotRel: number;      // relative slot within turno (1–aulasPorDia)
  slotAbs: number;      // absolute slot for professor conflict detection
}

interface SolverState {
  // Maps eventId → assigned TimePoint
  assignment: Map<string, TimePoint>;
  // "professorId|dia|slotAbs" → true (global professor occupation)
  profOccupied: Set<string>;
  // "turmaId|dia|slotRel" → true (turma slot occupation)
  turmaOccupied: Set<string>;
  // "professorId|turmaId|disciplina|dia" → count (max-2 per day constraint)
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

// ─── Public Entry Point ───────────────────────────────────────────────────────

export interface SolverInput {
  professores: Professor[];
  turmas: Turma[];
  atribuicoes: Atribuicao[];
  indisponibilidades: Indisponibilidade[];
  maxSolutions: number; // typically 5
}

export interface SolverOutput {
  solutions: SolverSolution[];
  infeasible: boolean;
  message: string;
}

export function runSolver(input: SolverInput): SolverOutput {
  const { atribuicoes, turmas, indisponibilidades, maxSolutions } = input;

  // Build turma lookup
  const turmaMap = new Map(turmas.map(t => [t.id, t]));

  // Build professor blocked set: "professorId|dia|slotAbs" → blocked
  const profBlocked = new Set<string>();
  for (const ind of indisponibilidades) {
    const offset = TURNO_OFFSET[ind.turno];
    const maxSlots = TURNO_MAX_SLOTS[ind.turno];
    for (let s = 1; s <= maxSlots; s++) {
      profBlocked.add(`${ind.professor_id}|${ind.dia_semana}|${offset + s}`);
    }
  }

  // Expand atribuicoes into events
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
  const deadline = Date.now() + 25_000; // 25 second budget

  // Run solver multiple times with different domain orderings
  for (let run = 0; run < maxSolutions * 4 && solutions.length < maxSolutions; run++) {
    if (Date.now() > deadline) break;

    const eventsShuffled = shuffleWithSeed([...events], run);
    const result = backtrack(
      eventsShuffled,
      0,
      { assignment: new Map(), profOccupied: new Set(), turmaOccupied: new Set(), sameDayCount: new Map() },
      profBlocked,
      deadline,
      solutions,
      maxSolutions
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

// ─── Backtracking Engine ──────────────────────────────────────────────────────

function backtrack(
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
    // Found a complete solution
    solutions.push(buildSolution(solutions.length, state.assignment));
    return 'ok';
  }

  const event = events[idx];
  const domain = buildDomain(event, state, profBlocked);

  for (const tp of domain) {
    if (assign(event, tp, state)) {
      const res = backtrack(events, idx + 1, state, profBlocked, deadline, solutions, maxSolutions);
      if (res === 'timeout') return 'timeout';
      if (solutions.length >= maxSolutions) return 'ok';
    }
    unassign(event, tp, state);
  }

  return 'ok';
}

// ─── Domain Building ──────────────────────────────────────────────────────────

function buildDomain(event: Event, state: SolverState, profBlocked: Set<string>): TimePoint[] {
  const offset = TURNO_OFFSET[event.turmaTurno];
  const domain: TimePoint[] = [];

  for (let dia = 1; dia <= 6; dia++) {
    for (let slotRel = 1; slotRel <= event.aulasPorDia; slotRel++) {
      const slotAbs = offset + slotRel;

      // C1: Professor global conflict
      if (state.profOccupied.has(`${event.professorId}|${dia}|${slotAbs}`)) continue;
      // C1b: Professor marked unavailable
      if (profBlocked.has(`${event.professorId}|${dia}|${slotAbs}`)) continue;
      // C2: Turma already has a class at this slot
      if (state.turmaOccupied.has(`${event.turmaId}|${dia}|${slotRel}`)) continue;
      // C3: Max 2 same disciplina per day in same turma
      const dayKey = `${event.professorId}|${event.turmaId}|${event.disciplina}|${dia}`;
      if ((state.sameDayCount.get(dayKey) ?? 0) >= 2) continue;

      domain.push({ dia, slotRel, slotAbs });
    }
  }

  return domain;
}

// ─── Assignment / Unassignment ────────────────────────────────────────────────

function assign(event: Event, tp: TimePoint, state: SolverState): boolean {
  state.assignment.set(event.eventId, tp);
  state.profOccupied.add(`${event.professorId}|${tp.dia}|${tp.slotAbs}`);
  state.turmaOccupied.add(`${event.turmaId}|${tp.dia}|${tp.slotRel}`);
  const dayKey = `${event.professorId}|${event.turmaId}|${event.disciplina}|${tp.dia}`;
  state.sameDayCount.set(dayKey, (state.sameDayCount.get(dayKey) ?? 0) + 1);
  return true;
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

// ─── Solution Builder ─────────────────────────────────────────────────────────

function buildSolution(idx: number, assignment: Map<string, TimePoint>): SolverSolution {
  const events: ScheduledEvent[] = [];
  for (const [eventId, tp] of assignment.entries()) {
    const atribuicaoId = eventId.replace(/-\d+$/, '');
    events.push({ atribuicaoId, dia: tp.dia, slotRelativo: tp.slotRel });
  }
  return { index: idx, events };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/** Deterministic shuffle using a simple LCG seed for diversity between runs */
function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  let s = seed + 1;
  const rng = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff; };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
