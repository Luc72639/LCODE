const { getPool } = require('../db');

function bool(value) {
  return Boolean(Number(value));
}

function mapAnimal(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    raca: row.raca,
    idade: row.idade,
    sexo: row.sexo,
    porte: row.porte,
    vacinado: bool(row.vacinado),
    castrado: bool(row.castrado),
    status: row.status,
    descricao: row.descricao || '',
    imagemUrl: row.imagem_url || null,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function mapRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    nomeAnimal: row.nome_animal,
    tipo: row.tipo,
    raca: row.raca || '',
    idade: row.idade,
    sexo: row.sexo || '',
    porte: row.porte || '',
    descricao: row.descricao || '',
    responsavel: row.responsavel,
    telefone: row.telefone,
    email: row.email || '',
    imagemUrl: row.imagem_url || null,
    status: row.status,
    animalIdCriado: row.animal_id_criado,
    analisadaPorAdminId: row.analisada_por_admin_id,
    analisadaEm: row.analisada_em,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function mapInterest(row) {
  if (!row) return null;
  return {
    id: row.id,
    animalId: row.animal_id,
    animalNome: row.animal_nome,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email || '',
    mensagem: row.mensagem || '',
    status: row.status,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em
  };
}

function mapAdmin(row) {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    email: row.email,
    senhaHash: row.senha_hash,
    ativo: bool(row.ativo),
    ultimoLoginEm: row.ultimo_login_em,
    criadoEm: row.criado_em
  };
}

async function listarAnimais(filtros = {}, { admin = false } = {}) {
  const pool = getPool();
  const where = [];
  const params = [];

  if (filtros.tipo) { where.push('tipo = ?'); params.push(filtros.tipo); }
  if (filtros.sexo) { where.push('sexo = ?'); params.push(filtros.sexo); }
  if (filtros.porte) { where.push('porte = ?'); params.push(filtros.porte); }
  if (filtros.status && filtros.status !== 'todos') { where.push('status = ?'); params.push(filtros.status); }
  if (!admin && !filtros.status) { where.push("status = 'disponivel'"); }
  if (filtros.q) {
    const search = `%${String(filtros.q).trim()}%`;
    where.push('(nome LIKE ? OR raca LIKE ? OR descricao LIKE ?)');
    params.push(search, search, search);
  }

  let sql = 'SELECT * FROM animais';
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY criado_em DESC, id DESC';

  const [rows] = await pool.query(sql, params);
  return rows.map(mapAnimal);
}

async function buscarAnimalPorId(id) {
  const [rows] = await getPool().query('SELECT * FROM animais WHERE id = ? LIMIT 1', [id]);
  return mapAnimal(rows[0]);
}

async function criarAnimal(dados) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO animais
    (nome, tipo, raca, idade, sexo, porte, vacinado, castrado, status, descricao, imagem_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.nome,
      dados.tipo,
      dados.raca,
      dados.idade,
      dados.sexo || null,
      dados.porte || null,
      dados.vacinado ? 1 : 0,
      dados.castrado ? 1 : 0,
      dados.status || 'disponivel',
      dados.descricao || null,
      dados.imagemUrl || null
    ]
  );
  return buscarAnimalPorId(result.insertId);
}

async function atualizarAnimal(id, dados) {
  const fields = [];
  const values = [];
  const mapping = {
    nome: 'nome',
    tipo: 'tipo',
    raca: 'raca',
    idade: 'idade',
    sexo: 'sexo',
    porte: 'porte',
    status: 'status',
    descricao: 'descricao',
    imagemUrl: 'imagem_url'
  };

  for (const [key, column] of Object.entries(mapping)) {
    if (dados[key] !== undefined) {
      fields.push(`${column} = ?`);
      values.push(dados[key] === '' ? null : dados[key]);
    }
  }
  if (dados.vacinado !== undefined) { fields.push('vacinado = ?'); values.push(dados.vacinado ? 1 : 0); }
  if (dados.castrado !== undefined) { fields.push('castrado = ?'); values.push(dados.castrado ? 1 : 0); }

  if (!fields.length) return buscarAnimalPorId(id);
  values.push(id);
  const [result] = await getPool().query(`UPDATE animais SET ${fields.join(', ')} WHERE id = ?`, values);
  if (!result.affectedRows) return null;
  return buscarAnimalPorId(id);
}

async function removerAnimal(id) {
  const [result] = await getPool().query('DELETE FROM animais WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function criarSolicitacao(dados) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO solicitacoes_anuncio
    (nome_animal, tipo, raca, idade, sexo, porte, descricao, responsavel, telefone, email, imagem_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.nomeAnimal,
      dados.tipo,
      dados.raca || null,
      dados.idade,
      dados.sexo || null,
      dados.porte || null,
      dados.descricao || null,
      dados.responsavel,
      dados.telefone,
      dados.email || null,
      dados.imagemUrl || null
    ]
  );
  const [rows] = await pool.query('SELECT * FROM solicitacoes_anuncio WHERE id = ?', [result.insertId]);
  return mapRequest(rows[0]);
}

async function listarSolicitacoes() {
  const [rows] = await getPool().query('SELECT * FROM solicitacoes_anuncio ORDER BY criado_em DESC, id DESC');
  return rows.map(mapRequest);
}

async function atualizarStatusSolicitacao(id, status, adminId) {
  const pool = getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query('SELECT * FROM solicitacoes_anuncio WHERE id = ? FOR UPDATE', [id]);
    const request = rows[0];
    if (!request) {
      await connection.rollback();
      return { notFound: true };
    }

    if (request.status !== 'pendente' && request.status !== status) {
      await connection.rollback();
      return { conflict: true, data: mapRequest(request) };
    }

    let animalId = request.animal_id_criado;
    if (status === 'aprovada' && !animalId) {
      const [animalResult] = await connection.query(
        `INSERT INTO animais
        (nome, tipo, raca, idade, sexo, porte, vacinado, castrado, status, descricao, imagem_url)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 'disponivel', ?, ?)`,
        [
          request.nome_animal,
          request.tipo,
          request.raca || 'Sem raca definida',
          request.idade,
          request.sexo || null,
          request.porte || null,
          request.descricao || null,
          request.imagem_url || null
        ]
      );
      animalId = animalResult.insertId;
    }

    await connection.query(
      `UPDATE solicitacoes_anuncio
       SET status = ?, animal_id_criado = ?, analisada_por_admin_id = ?, analisada_em = NOW()
       WHERE id = ?`,
      [status, animalId || null, adminId, id]
    );
    await connection.commit();

    const [updated] = await pool.query('SELECT * FROM solicitacoes_anuncio WHERE id = ?', [id]);
    return { data: mapRequest(updated[0]), animalId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function criarInteresse(dados, animal) {
  const pool = getPool();
  const [result] = await pool.query(
    `INSERT INTO interesses_adocao
    (animal_id, animal_nome, nome, telefone, email, mensagem)
    VALUES (?, ?, ?, ?, ?, ?)`,
    [animal.id, animal.nome, dados.nome, dados.telefone, dados.email || null, dados.mensagem || null]
  );
  const [rows] = await pool.query('SELECT * FROM interesses_adocao WHERE id = ?', [result.insertId]);
  return mapInterest(rows[0]);
}

async function listarInteresses() {
  const [rows] = await getPool().query('SELECT * FROM interesses_adocao ORDER BY criado_em DESC, id DESC');
  return rows.map(mapInterest);
}

async function atualizarStatusInteresse(id, status) {
  const pool = getPool();
  const [result] = await pool.query('UPDATE interesses_adocao SET status = ? WHERE id = ?', [status, id]);
  if (!result.affectedRows) return null;
  const [rows] = await pool.query('SELECT * FROM interesses_adocao WHERE id = ?', [id]);
  return mapInterest(rows[0]);
}

async function buscarAdminPorEmail(email) {
  const [rows] = await getPool().query('SELECT * FROM usuarios_admin WHERE email = ? LIMIT 1', [String(email).toLowerCase()]);
  return mapAdmin(rows[0]);
}

async function buscarAdminPorId(id) {
  const [rows] = await getPool().query('SELECT * FROM usuarios_admin WHERE id = ? LIMIT 1', [id]);
  return mapAdmin(rows[0]);
}

async function atualizarUltimoLogin(id) {
  await getPool().query('UPDATE usuarios_admin SET ultimo_login_em = NOW() WHERE id = ?', [id]);
}

async function atualizarSenhaAdmin(id, senhaHash) {
  await getPool().query('UPDATE usuarios_admin SET senha_hash = ? WHERE id = ?', [senhaHash, id]);
}

async function registrarLog(adminId, acao, detalhes, ip) {
  await getPool().query(
    'INSERT INTO logs_admin (admin_id, acao, detalhes, ip) VALUES (?, ?, ?, ?)',
    [adminId || null, acao, detalhes || null, ip || null]
  );
}

async function listarLogs(limit = 80) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 80, 200));
  const [rows] = await getPool().query(
    `SELECT l.id, l.acao, l.detalhes, l.ip, l.criado_em,
            u.nome AS admin_nome, u.email AS admin_email
     FROM logs_admin l
     LEFT JOIN usuarios_admin u ON u.id = l.admin_id
     ORDER BY l.criado_em DESC, l.id DESC
     LIMIT ?`,
    [safeLimit]
  );
  return rows.map((row) => ({
    id: row.id,
    acao: row.acao,
    detalhes: row.detalhes || '',
    ip: row.ip || '',
    adminNome: row.admin_nome || 'Sistema',
    adminEmail: row.admin_email || '',
    criadoEm: row.criado_em
  }));
}

module.exports = {
  listarAnimais,
  buscarAnimalPorId,
  criarAnimal,
  atualizarAnimal,
  removerAnimal,
  criarSolicitacao,
  listarSolicitacoes,
  atualizarStatusSolicitacao,
  criarInteresse,
  listarInteresses,
  atualizarStatusInteresse,
  buscarAdminPorEmail,
  buscarAdminPorId,
  atualizarUltimoLogin,
  atualizarSenhaAdmin,
  registrarLog,
  listarLogs
};
