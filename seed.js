import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cauwkuryvqvqricmydbk.supabase.co';
const supabaseKey = 'sb_publishable_i45pH4FZN_Z2_LoBRQS81Q_Ae9Ubr4m';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Iniciando limpeza e cadastro do exemplo...');
  
  // 1. Limpar tabelas antigas (a ordem importa por causa das chaves estrangeiras)
  console.log('Limpando dados antigos...');
  await supabase.from('grades_geradas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('atribuicoes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('indisponibilidades').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('professores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('turmas').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  console.log('Cadastrando as turmas com carga horária pré-definida...');
  const defaultCarga = {
    'Língua Portuguesa': 5,
    'Matemática': 5,
    'História': 3,
    'Geografia': 3,
    'Ciências': 3,
    'Educação Física': 2,
    'Artes': 2,
    'Língua Inglesa': 2
  };

  const { data: turmasData, error: turmasErr } = await supabase.from('turmas').insert([
    { nome: '6º Ano A', nivel: '6º Ano – Fund. II', turno: 'manha', aulas_por_dia: 5, carga_horaria: defaultCarga },
    { nome: '7º Ano A', nivel: '7º Ano – Fund. II', turno: 'manha', aulas_por_dia: 5, carga_horaria: defaultCarga },
    { nome: '1º Ano EM', nivel: '1º Ano – Médio', turno: 'manha', aulas_por_dia: 5, carga_horaria: defaultCarga }
  ]).select();

  if (turmasErr) {
    console.error('Erro ao criar turmas:', turmasErr);
    return;
  }
  console.log('Turmas criadas com sucesso!');

  console.log('Cadastrando os professores habilitados...');
  const { data: profsData, error: profsErr } = await supabase.from('professores').insert([
    { nome: 'Carlos (Português/Artes)', materias: ['Língua Portuguesa', 'Artes'] },
    { nome: 'Ana (Matemática)', materias: ['Matemática'] },
    { nome: 'Marcos (História/Geografia)', materias: ['História', 'Geografia'] },
    { nome: 'Julia (Ciências)', materias: ['Ciências'] },
    { nome: 'Roberto (Ed. Física/Inglês)', materias: ['Educação Física', 'Língua Inglesa'] }
  ]).select();

  if (profsErr) {
    console.error('Erro ao criar professores:', profsErr);
    return;
  }
  console.log('Professores criados com sucesso!');

  // Map data to help creating assignments
  const t6 = turmasData.find(t => t.nome === '6º Ano A');
  const t7 = turmasData.find(t => t.nome === '7º Ano A');
  const t1 = turmasData.find(t => t.nome === '1º Ano EM');

  const pCarlos = profsData.find(p => p.nome.includes('Carlos'));
  const pAna = profsData.find(p => p.nome.includes('Ana'));
  const pMarcos = profsData.find(p => p.nome.includes('Marcos'));
  const pJulia = profsData.find(p => p.nome.includes('Julia'));
  const pRoberto = profsData.find(p => p.nome.includes('Roberto'));

  console.log('Criando as atribuições de matérias para os professores...');
  const { error: atrErr } = await supabase.from('atribuicoes').insert([
    // Carlos
    { professor_id: pCarlos.id, turma_id: t6.id, disciplina: 'Língua Portuguesa', aulas_semanais: 5 },
    { professor_id: pCarlos.id, turma_id: t6.id, disciplina: 'Artes', aulas_semanais: 2 },
    { professor_id: pCarlos.id, turma_id: t7.id, disciplina: 'Língua Portuguesa', aulas_semanais: 5 },
    { professor_id: pCarlos.id, turma_id: t7.id, disciplina: 'Artes', aulas_semanais: 2 },
    { professor_id: pCarlos.id, turma_id: t1.id, disciplina: 'Língua Portuguesa', aulas_semanais: 5 },
    { professor_id: pCarlos.id, turma_id: t1.id, disciplina: 'Artes', aulas_semanais: 2 },

    // Ana
    { professor_id: pAna.id, turma_id: t6.id, disciplina: 'Matemática', aulas_semanais: 5 },
    { professor_id: pAna.id, turma_id: t7.id, disciplina: 'Matemática', aulas_semanais: 5 },
    { professor_id: pAna.id, turma_id: t1.id, disciplina: 'Matemática', aulas_semanais: 5 },

    // Marcos
    { professor_id: pMarcos.id, turma_id: t6.id, disciplina: 'História', aulas_semanais: 3 },
    { professor_id: pMarcos.id, turma_id: t6.id, disciplina: 'Geografia', aulas_semanais: 3 },
    { professor_id: pMarcos.id, turma_id: t7.id, disciplina: 'História', aulas_semanais: 3 },
    { professor_id: pMarcos.id, turma_id: t7.id, disciplina: 'Geografia', aulas_semanais: 3 },
    { professor_id: pMarcos.id, turma_id: t1.id, disciplina: 'História', aulas_semanais: 3 },
    { professor_id: pMarcos.id, turma_id: t1.id, disciplina: 'Geografia', aulas_semanais: 3 },

    // Julia
    { professor_id: pJulia.id, turma_id: t6.id, disciplina: 'Ciências', aulas_semanais: 3 },
    { professor_id: pJulia.id, turma_id: t7.id, disciplina: 'Ciências', aulas_semanais: 3 },
    { professor_id: pJulia.id, turma_id: t1.id, disciplina: 'Ciências', aulas_semanais: 3 },

    // Roberto
    { professor_id: pRoberto.id, turma_id: t6.id, disciplina: 'Educação Física', aulas_semanais: 2 },
    { professor_id: pRoberto.id, turma_id: t6.id, disciplina: 'Língua Inglesa', aulas_semanais: 2 },
    { professor_id: pRoberto.id, turma_id: t7.id, disciplina: 'Educação Física', aulas_semanais: 2 },
    { professor_id: pRoberto.id, turma_id: t7.id, disciplina: 'Língua Inglesa', aulas_semanais: 2 },
    { professor_id: pRoberto.id, turma_id: t1.id, disciplina: 'Educação Física', aulas_semanais: 2 },
    { professor_id: pRoberto.id, turma_id: t1.id, disciplina: 'Língua Inglesa', aulas_semanais: 2 },
  ]);

  if (atrErr) {
    console.error('Erro ao criar atribuições:', atrErr);
    return;
  }

  console.log('Exemplo perfeito criado com sucesso! Atualize a página do aplicativo.');
}

run();
