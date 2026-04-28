// ─── Database Row Types ───────────────────────────────────────────────────────

export interface Professor {
  id: string;
  nome: string;
  email: string | null;
  materias: string[];
  created_at: string;
}


export interface Indisponibilidade {
  id: string;
  professor_id: string;
  dia_semana: DiaSemana;
  turno: Turno;
}

export interface Turma {
  id: string;
  nome: string;
  nivel: string;
  turno: Turno;
  aulas_por_dia: 5 | 6;
  created_at: string;
}

export interface Atribuicao {
  id: string;
  professor_id: string;
  turma_id: string;
  disciplina: string;
  aulas_semanais: number;
  created_at: string;
}

export interface GradeGerada {
  id: string;
  solution_index: number;
  atribuicao_id: string;
  dia_semana: DiaSemana;
  slot_relativo: number;
  created_at: string;
}

// ─── Primitive Types ──────────────────────────────────────────────────────────

export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6;
export type Turno = 'manha' | 'tarde' | 'noite';

// ─── Algorithm / Presentation Types ──────────────────────────────────────────

export interface SolucaoSlot {
  professor: Professor;
  atribuicao: Atribuicao;
}

// Grid cell: [dia][slot] → SolucaoSlot | null
export type GradeGrid = (SolucaoSlot | null)[][];

export interface Solucao {
  index: number;
  grids: Record<string, GradeGrid>; // turmaId → GradeGrid
}
