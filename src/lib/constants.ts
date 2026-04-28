import type { DiaSemana, Turno } from '../types/database';

export const DIAS_SEMANA: { id: DiaSemana; nome: string; short: string }[] = [
  { id: 1, nome: 'Segunda-feira', short: 'Seg' },
  { id: 2, nome: 'Terça-feira',   short: 'Ter' },
  { id: 3, nome: 'Quarta-feira',  short: 'Qua' },
  { id: 4, nome: 'Quinta-feira',  short: 'Qui' },
  { id: 5, nome: 'Sexta-feira',   short: 'Sex' },
  { id: 6, nome: 'Sábado',        short: 'Sáb' },
];

// Slot times por turno (posição relativa 1-6 dentro do turno)
export const SLOT_TIMES: Record<Turno, Record<number, string>> = {
  manha: {
    1: '07:00 – 07:50',
    2: '07:50 – 08:40',
    3: '08:50 – 09:40',
    4: '09:40 – 10:30',
    5: '10:40 – 11:30',
    6: '11:30 – 12:20',
  },
  tarde: {
    1: '13:00 – 13:50',
    2: '13:50 – 14:40',
    3: '14:50 – 15:40',
    4: '15:40 – 16:30',
    5: '16:40 – 17:30',
    6: '17:30 – 18:20',
  },
  noite: {
    1: '19:00 – 19:50',
    2: '19:50 – 20:40',
    3: '20:50 – 21:40',
    4: '21:40 – 22:30',
    5: '— — —',
    6: '— — —',
  },
};

// Absolute slot offset so professor conflicts work across turnos
// Manhã: 1-6, Tarde: 7-12, Noite: 13-16
export const TURNO_OFFSET: Record<Turno, number> = {
  manha: 0,
  tarde: 6,
  noite: 12,
};

export const TURNO_MAX_SLOTS: Record<Turno, number> = {
  manha: 6,
  tarde: 6,
  noite: 4,
};

export const TURNO_LABEL: Record<Turno, string> = {
  manha: 'Matutino',
  tarde: 'Vespertino',
  noite: 'Noturno',
};

// Absolute slot: offset + relative slot
export function absSlot(turno: Turno, relative: number): number {
  return TURNO_OFFSET[turno] + relative;
}

// Disciplines predefined (BNCC)
export const MATERIAS_BNCC = [
  'Língua Portuguesa',
  'Matemática',
  'História',
  'Geografia',
  'Ciências',
  'Física',
  'Química',
  'Biologia',
  'Educação Física',
  'Artes',
  'Língua Inglesa',
  'Filosofia',
  'Sociologia',
  'Ensino Religioso',
  'Redação',
  'Literatura',
];

export const NIVEL_OPTIONS = [
  '1º Ano – Fund. I',
  '2º Ano – Fund. I',
  '3º Ano – Fund. I',
  '4º Ano – Fund. I',
  '5º Ano – Fund. I',
  '6º Ano – Fund. II',
  '7º Ano – Fund. II',
  '8º Ano – Fund. II',
  '9º Ano – Fund. II',
  '1º Ano – Médio',
  '2º Ano – Médio',
  '3º Ano – Médio',
];

// Color palette for disciplines (deterministic by name hash)
const DISC_COLORS = [
  '#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444',
  '#06b6d4','#f97316','#84cc16','#ec4899','#6366f1',
  '#14b8a6','#a855f7','#eab308','#22c55e',
];

export function disciplinaColor(nome: string): string {
  let hash = 0;
  for (const ch of nome) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return DISC_COLORS[Math.abs(hash) % DISC_COLORS.length];
}
