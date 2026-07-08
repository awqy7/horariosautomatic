const STORAGE_KEY = 'educasched_db';
const SEED_VERSION = 2;

type Row = Record<string, any>;
type DB = Record<string, any>;

function generateId(): string {
  return crypto.randomUUID();
}

function now(): string {
  return new Date().toISOString();
}

function seedData(): DB {
  const id = (prefix: string) => `${prefix}-${generateId().slice(0, 8)}`;

  const profIds = [id('prof'), id('prof'), id('prof'), id('prof'), id('prof')];

  const defaultCarga: Record<string, number> = {
    'Língua Portuguesa': 5, Matemática: 5, História: 3, Geografia: 3,
    Ciências: 3, 'Educação Física': 2, Artes: 2, 'Língua Inglesa': 2,
  };

  const professores: Row[] = [
    { id: profIds[0], nome: 'Carlos (Português/Artes)', email: null, materias: ['Língua Portuguesa', 'Artes'], created_at: now() },
    { id: profIds[1], nome: 'Ana (Matemática)', email: null, materias: ['Matemática'], created_at: now() },
    { id: profIds[2], nome: 'Marcos (História/Geografia)', email: null, materias: ['História', 'Geografia'], created_at: now() },
    { id: profIds[3], nome: 'Julia (Ciências)', email: null, materias: ['Ciências'], created_at: now() },
    { id: profIds[4], nome: 'Roberto (Ed. Física/Inglês)', email: null, materias: ['Educação Física', 'Língua Inglesa'], created_at: now() },
  ];

  const turmaDefs = [
    { nome: '6º Ano A', nivel: '6º Ano – Fund. II', turno: 'manha' },
    { nome: '7º Ano A', nivel: '7º Ano – Fund. II', turno: 'manha' },
    { nome: '8º Ano A', nivel: '8º Ano – Fund. II', turno: 'tarde' },
    { nome: '9º Ano A', nivel: '9º Ano – Fund. II', turno: 'tarde' },
    { nome: '6º Ano B', nivel: '6º Ano – Fund. II', turno: 'tarde' },
    { nome: '1º Ano EM', nivel: '1º Ano – Médio', turno: 'manha' },
    { nome: '2º Ano EM', nivel: '2º Ano – Médio', turno: 'manha' },
    { nome: '3º Ano EM', nivel: '3º Ano – Médio', turno: 'tarde' },
  ];
  const turmas: Row[] = turmaDefs.map(t => ({
    id: generateId(), ...t, aulas_por_dia: 5, carga_horaria: defaultCarga, created_at: now(),
  }));

  const atr = (professor_id: string, turma_id: string, disciplina: string, aulas_semanais: number): Row => ({
    id: generateId(), professor_id, turma_id, disciplina, aulas_semanais, created_at: now(),
  });

  const atribuicoes: Row[] = [];
  for (const t of turmas) {
    atribuicoes.push(
      atr(profIds[0], t.id, 'Língua Portuguesa', 5),
      atr(profIds[0], t.id, 'Artes', 2),
      atr(profIds[1], t.id, 'Matemática', 5),
      atr(profIds[2], t.id, 'História', 3),
      atr(profIds[2], t.id, 'Geografia', 3),
      atr(profIds[3], t.id, 'Ciências', 3),
      atr(profIds[4], t.id, 'Educação Física', 2),
      atr(profIds[4], t.id, 'Língua Inglesa', 2),
    );
  }

  // Block some availability for demo
  const indisponibilidades: Row[] = [
    { id: generateId(), professor_id: profIds[2], dia_semana: 6, turno: 'manha', created_at: now() },
    { id: generateId(), professor_id: profIds[4], dia_semana: 3, turno: 'tarde', created_at: now() },
  ];

  return { professores, indisponibilidades, turmas, atribuicoes, grades_geradas: [] };
}

function getDb(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed._seed_version === SEED_VERSION && (parsed.professores?.length || parsed.turmas?.length)) return parsed;
    }
  } catch { /* empty */ }
  const seeded = seedData();
  seeded._seed_version = SEED_VERSION;
  saveDb(seeded);
  return seeded;
}

function saveDb(db: DB) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

class SupabaseQuery {
  private _filters: Array<(r: Row) => boolean> = [];
  private _orderCol: string | null = null;
  private _orderAsc = true;
  private _returnSingle = false;
  private _table: string;
  private _method: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  private _payload: any;
  private _conflictCols: string | undefined;

  constructor(table: string, method: 'select' | 'insert' | 'upsert' | 'update' | 'delete', payload?: any, conflictCols?: string) {
    this._table = table;
    this._method = method;
    this._payload = payload;
    this._conflictCols = conflictCols;
  }

  eq(col: string, val: any) {
    this._filters.push(r => r[col] === val);
    return this;
  }

  neq(col: string, val: any) {
    this._filters.push(r => r[col] !== val);
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this._orderCol = col;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  single() {
    this._returnSingle = true;
    return this;
  }

  select(_cols?: string) {
    return this;
  }

  then<T1 = { data: any; error: any }, T2 = never>(
    onfulfilled?: ((v: { data: any; error: any }) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((v: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve(this._exec()).then(onfulfilled, onrejected);
  }

  private _exec(): { data: any; error: any } {
    const db = getDb();
    const table: Row[] = db[this._table] || [];
    let rows = [...table];
    for (const f of this._filters) rows = rows.filter(f);
    if (this._orderCol) {
      rows.sort((a, b) => {
        const av = a[this._orderCol!], bv = b[this._orderCol!];
        if (av == null) return 1;
        if (bv == null) return -1;
        return typeof av === 'string'
          ? (this._orderAsc ? av.localeCompare(bv) : bv.localeCompare(av))
          : (this._orderAsc ? av - bv : bv - av);
      });
    }

    switch (this._method) {
      case 'select':
        return { data: this._returnSingle ? (rows[0] ?? null) : rows, error: null };

      case 'insert': {
        const items = Array.isArray(this._payload) ? this._payload : [this._payload];
        const inserted = items.map(item => ({ id: generateId(), created_at: now(), ...item }));
        table.push(...inserted);
        db[this._table] = table;
        saveDb(db);
        return { data: this._returnSingle ? inserted[0] : inserted, error: null };
      }

      case 'upsert': {
        const conflict = this._conflictCols ? this._conflictCols.split(',') : ['id'];
        const item = this._payload;
        const existing = rows.find(r => conflict.every(c => r[c] === item[c]));
        if (existing) {
          Object.assign(existing, item);
          db[this._table] = table;
          saveDb(db);
          return { data: existing, error: null };
        }
        const newRow = { id: generateId(), created_at: now(), ...item };
        table.push(newRow);
        db[this._table] = table;
        saveDb(db);
        return { data: newRow, error: null };
      }

      case 'update': {
        for (const row of rows) Object.assign(row, this._payload);
        db[this._table] = table;
        saveDb(db);
        return { data: this._returnSingle ? (rows[0] ?? null) : rows, error: null };
      }

      case 'delete': {
        const ids = new Set(rows.map(r => r.id));
        db[this._table] = table.filter(r => !ids.has(r.id));
        saveDb(db);
        return { data: null, error: null };
      }

      default:
        return { data: null, error: { message: 'Unknown operation' } };
    }
  }
}

export const supabase = {
  from(table: string) {
    return {
      select:      (_cols?: string) => new SupabaseQuery(table, 'select'),
      insert:      (p: any)         => new SupabaseQuery(table, 'insert', p),
      upsert:      (p: any, opts?: { onConflict?: string }) =>
                                      new SupabaseQuery(table, 'upsert', p, opts?.onConflict),
      update:      (p: any)         => new SupabaseQuery(table, 'update', p),
      delete:      ()               => new SupabaseQuery(table, 'delete'),
    };
  },
  auth: {
    signInWithPassword: async (_: { email: string; password: string }) => ({
      data: { user: { id: 'local-user', email: _.email } },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (_cb: (e: string, s: any) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
  },
};
