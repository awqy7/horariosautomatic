import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type {
  Professor, Indisponibilidade, Turma, Atribuicao, GradeGerada
} from '../types/database';

// ─── Timeout helper ───────────────────────────────────────────────────────────
function withTimeout<T>(thenable: PromiseLike<T>, ms = 7000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    Promise.resolve(thenable).then(
      v => { clearTimeout(t); resolve(v); },
      e => { clearTimeout(t); reject(e); }
    );
  });
}

// ─── State Interface ──────────────────────────────────────────────────────────
interface AppState {
  loading: boolean;

  professores: Professor[];
  indisponibilidades: Indisponibilidade[];
  turmas: Turma[];
  atribuicoes: Atribuicao[];
  gradesGeradas: GradeGerada[];

  // Actions
  fetchAll: () => Promise<void>;

  // Professores
  addProfessor: (nome: string, email: string) => Promise<boolean>;
  updateProfessorMaterias: (id: string, materias: string[]) => Promise<boolean>;
  deleteProfessor: (id: string) => Promise<boolean>;

  // Indisponibilidades
  setIndisponibilidade: (professorId: string, dia: number, turno: string, blocked: boolean) => Promise<boolean>;

  // Turmas
  addTurma: (t: Omit<Turma, 'id' | 'created_at'>) => Promise<boolean>;
  deleteTurma: (id: string) => Promise<boolean>;
  updateTurmaCarga: (id: string, carga_horaria: Record<string, number>) => Promise<boolean>;

  // Atribuições
  addAtribuicao: (a: Omit<Atribuicao, 'id' | 'created_at'>) => Promise<boolean>;
  deleteAtribuicao: (id: string) => Promise<boolean>;
  updateAtribuicao: (id: string, aulas_semanais: number) => Promise<boolean>;

  // Grades Geradas
  saveGrades: (rows: Omit<GradeGerada, 'id' | 'created_at'>[]) => Promise<boolean>;
  clearGrades: () => Promise<boolean>;
  updateGradeSlot: (gradeId: string, atribuicaoId: string) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set) => ({
  loading: false,
  professores: [],
  indisponibilidades: [],
  turmas: [],
  atribuicoes: [],
  gradesGeradas: [],

  // ─── Fetch All ─────────────────────────────────────────────────────────────
  fetchAll: async () => {
    set({ loading: true });
    try {
      const [profRes, indRes, turRes, atrRes, grRes] = await withTimeout(
        Promise.all([
          supabase.from('professores').select('*').order('nome'),
          supabase.from('indisponibilidades').select('*'),
          supabase.from('turmas').select('*').order('nome'),
          supabase.from('atribuicoes').select('*'),
          supabase.from('grades_geradas').select('*').order('solution_index'),
        ]),
        10000
      );
      set({
        professores:       profRes.data || [],
        indisponibilidades: indRes.data || [],
        turmas:            turRes.data || [],
        atribuicoes:       atrRes.data || [],
        gradesGeradas:     grRes.data  || [],
      });
    } catch (e) {
      console.error('fetchAll error:', e);
    } finally {
      set({ loading: false });
    }
  },

  // ─── Professores ───────────────────────────────────────────────────────────
  addProfessor: async (nome, email) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('professores').insert({ nome, email: email || null, materias: [] }).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ professores: [...s.professores, data as Professor].sort((a, b) => a.nome.localeCompare(b.nome)) }));
      return true;
    } catch { return false; }
  },

  updateProfessorMaterias: async (id, materias) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('professores').update({ materias }).eq('id', id).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ professores: s.professores.map(p => p.id === id ? { ...p, materias } : p) }));
      return true;
    } catch { return false; }
  },

  deleteProfessor: async (id) => {
    try {
      const { error } = await withTimeout(supabase.from('professores').delete().eq('id', id));
      if (error) { console.error(error); return false; }
      set(s => ({
        professores: s.professores.filter(p => p.id !== id),
        indisponibilidades: s.indisponibilidades.filter(i => i.professor_id !== id),
        atribuicoes: s.atribuicoes.filter(a => a.professor_id !== id),
      }));
      return true;
    } catch { return false; }
  },

  // ─── Indisponibilidades ────────────────────────────────────────────────────
  setIndisponibilidade: async (professorId, dia, turno, blocked) => {
    try {
      if (blocked) {
        const { data, error } = await withTimeout(
          supabase.from('indisponibilidades')
            .upsert({ professor_id: professorId, dia_semana: dia, turno }, { onConflict: 'professor_id,dia_semana,turno' })
            .select().single()
        );
        if (error || !data) { console.error(error); return false; }
        set(s => {
          const filtered = s.indisponibilidades.filter(
            i => !(i.professor_id === professorId && i.dia_semana === dia && i.turno === turno)
          );
          return { indisponibilidades: [...filtered, data as Indisponibilidade] };
        });
      } else {
        const { error } = await withTimeout(
          supabase.from('indisponibilidades')
            .delete()
            .eq('professor_id', professorId)
            .eq('dia_semana', dia)
            .eq('turno', turno)
        );
        if (error) { console.error(error); return false; }
        set(s => ({
          indisponibilidades: s.indisponibilidades.filter(
            i => !(i.professor_id === professorId && i.dia_semana === dia && i.turno === turno)
          ),
        }));
      }
      return true;
    } catch { return false; }
  },

  // ─── Turmas ────────────────────────────────────────────────────────────────
  addTurma: async (t) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('turmas').insert(t).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ turmas: [...s.turmas, data as Turma].sort((a, b) => a.nome.localeCompare(b.nome)) }));
      return true;
    } catch { return false; }
  },

  deleteTurma: async (id) => {
    try {
      const { error } = await withTimeout(supabase.from('turmas').delete().eq('id', id));
      if (error) { console.error(error); return false; }
      set(s => ({
        turmas: s.turmas.filter(t => t.id !== id),
        atribuicoes: s.atribuicoes.filter(a => a.turma_id !== id),
      }));
      return true;
    } catch { return false; }
  },

  updateTurmaCarga: async (id, carga_horaria) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('turmas').update({ carga_horaria }).eq('id', id).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ turmas: s.turmas.map(t => t.id === id ? (data as Turma) : t) }));
      return true;
    } catch { return false; }
  },

  // ─── Atribuições ───────────────────────────────────────────────────────────
  addAtribuicao: async (a) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('atribuicoes').insert(a).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ atribuicoes: [...s.atribuicoes, data as Atribuicao] }));
      return true;
    } catch { return false; }
  },

  deleteAtribuicao: async (id) => {
    try {
      const { error } = await withTimeout(supabase.from('atribuicoes').delete().eq('id', id));
      if (error) { console.error(error); return false; }
      set(s => ({ atribuicoes: s.atribuicoes.filter(a => a.id !== id) }));
      return true;
    } catch { return false; }
  },

  updateAtribuicao: async (id, aulas_semanais) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('atribuicoes').update({ aulas_semanais }).eq('id', id).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({ atribuicoes: s.atribuicoes.map(a => a.id === id ? (data as Atribuicao) : a) }));
      return true;
    } catch { return false; }
  },

  // ─── Grades Geradas ────────────────────────────────────────────────────────
  saveGrades: async (rows) => {
    try {
      // Clear previous solutions first
      await withTimeout(supabase.from('grades_geradas').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
      if (rows.length === 0) { set({ gradesGeradas: [] }); return true; }
      const { data, error } = await withTimeout(
        supabase.from('grades_geradas').insert(rows as any).select()
      );
      if (error) { console.error(error); return false; }
      set({ gradesGeradas: (data as GradeGerada[]) || [] });
      return true;
    } catch { return false; }
  },

  clearGrades: async () => {
    try {
      await withTimeout(supabase.from('grades_geradas').delete().neq('id', '00000000-0000-0000-0000-000000000000'));
      set({ gradesGeradas: [] });
      return true;
    } catch { return false; }
  },

  updateGradeSlot: async (gradeId, atribuicaoId) => {
    try {
      const { data, error } = await withTimeout(
        supabase.from('grades_geradas').update({ atribuicao_id: atribuicaoId }).eq('id', gradeId).select().single()
      );
      if (error || !data) { console.error(error); return false; }
      set(s => ({
        gradesGeradas: s.gradesGeradas.map(g => g.id === gradeId ? { ...g, atribuicao_id: atribuicaoId } : g),
      }));
      return true;
    } catch { return false; }
  },
}));
