const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bcrypt = require('bcrypt');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'clinica_vida',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
  decimalNumbers: true
});

app.disable('x-powered-by');
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

// Nunca expor arquivos internos pela pasta pública.
app.use('/backend', (_req, res) => res.status(404).end());
app.use('/node_modules', (_req, res) => res.status(404).end());
app.get(['/package.json', '/package-lock.json'], (_req, res) => res.status(404).end());
app.use(express.static(ROOT, { dotfiles: 'deny', index: 'index.html' }));

const loginAttempts = new Map();

function normalizarEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function texto(valor, limite = 255) {
  if (valor === null || valor === undefined) return null;
  const v = String(valor).trim();
  return v ? v.slice(0, limite) : null;
}

function somenteLogado(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: 'Você precisa estar logado.' });
  }
  next();
}

function somenteTipo(tipo) {
  return (req, res, next) => {
    if (!req.session.usuarioId) {
      return res.status(401).json({ erro: 'Você precisa estar logado.' });
    }
    if (req.session.tipo !== tipo) {
      return res.status(403).json({ erro: 'Você não possui permissão para esta ação.' });
    }
    next();
  };
}

const somenteAdmin = somenteTipo('admin');
const somenteMedico = somenteTipo('medico');
const somentePaciente = somenteTipo('paciente');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function ensureColumn(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`Banco atualizado: ${table}.${column}`);
  }
}

async function ensureSchema() {
  await pool.query('SELECT 1');

  await ensureColumn('usuarios', 'cpf', 'VARCHAR(20) NULL');
  await ensureColumn('usuarios', 'data_nascimento', 'DATE NULL');
  await ensureColumn('usuarios', 'telefone', 'VARCHAR(30) NULL');
  await ensureColumn('usuarios', 'endereco', 'VARCHAR(255) NULL');
  await ensureColumn('usuarios', 'criado_em', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');

  await ensureColumn('medicos', 'cpf', 'VARCHAR(20) NULL');
  await ensureColumn('medicos', 'crm', 'VARCHAR(40) NULL');
  await ensureColumn('medicos', 'telefone', 'VARCHAR(30) NULL');
  await ensureColumn('medicos', 'foto', 'MEDIUMTEXT NULL');
  await ensureColumn('medicos', 'criado_em', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
  await ensureColumn('medicos', 'valor_consulta', 'DECIMAL(10,2) NOT NULL DEFAULT 0');

  await ensureColumn('agendamentos', 'paciente_id', 'INT NULL');
  await ensureColumn('agendamentos', 'valor_consulta', 'DECIMAL(10,2) NULL');
  await ensureColumn('agendamentos', 'pagamento_status', "ENUM('pendente','pago') NOT NULL DEFAULT 'pendente'");
  await ensureColumn('agendamentos', 'pagamento_confirmado_em', 'DATETIME NULL');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS configuracoes (
      id INT PRIMARY KEY,
      nome_clinica VARCHAR(120) NOT NULL DEFAULT 'Clínica Vida+',
      telefone VARCHAR(30) NULL,
      email VARCHAR(160) NULL,
      endereco VARCHAR(255) NULL,
      horario_funcionamento VARCHAR(180) NULL,
      logo MEDIUMTEXT NULL,
      atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NULL,
      usuario_nome VARCHAR(160) NULL,
      usuario_tipo VARCHAR(30) NULL,
      acao VARCHAR(500) NOT NULL,
      criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_logs_criado (criado_em),
      INDEX idx_logs_usuario (usuario_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS notificacoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      usuario_id INT NOT NULL,
      tipo VARCHAR(40) NOT NULL DEFAULT 'info',
      titulo VARCHAR(160) NOT NULL,
      mensagem VARCHAR(500) NULL,
      lida TINYINT(1) NOT NULL DEFAULT 0,
      criada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_usuario (usuario_id, lida, criada_em)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    INSERT INTO configuracoes (id, nome_clinica, telefone, email, endereco, horario_funcionamento)
    VALUES (1, 'Clínica Vida+', '(11) 4000-0000', 'contato@clinicavida.local', 'Endereço da clínica', 'Segunda a sexta, 08:00 às 18:00')
    ON DUPLICATE KEY UPDATE id = id
  `);

  // Migração leve dos dados existentes para o modelo final.
  await pool.query(`
    UPDATE agendamentos a
    INNER JOIN usuarios u ON LOWER(u.email) = LOWER(a.email) AND u.tipo = 'paciente'
    SET a.paciente_id = u.id
    WHERE a.paciente_id IS NULL
  `);

  await pool.query(`
    UPDATE agendamentos a
    INNER JOIN medicos m ON m.id = a.medico_id
    SET a.valor_consulta = m.valor_consulta
    WHERE a.valor_consulta IS NULL
  `);
}

async function obterUsuarioBasico(id) {
  const [rows] = await pool.query(
    'SELECT id, nome, email, tipo, ativo FROM usuarios WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

async function registrarLog(req, acao) {
  try {
    const usuario = req?.session?.usuarioId
      ? await obterUsuarioBasico(req.session.usuarioId)
      : null;
    await pool.query(
      `INSERT INTO logs (usuario_id, usuario_nome, usuario_tipo, acao)
       VALUES (?, ?, ?, ?)`,
      [usuario?.id || null, usuario?.nome || null, usuario?.tipo || null, texto(acao, 500)]
    );
  } catch (err) {
    console.error('Falha ao registrar log:', err.message);
  }
}

async function notificarUsuario(usuarioId, titulo, mensagem, tipo = 'info') {
  if (!usuarioId) return;
  try {
    await pool.query(
      `INSERT INTO notificacoes (usuario_id, tipo, titulo, mensagem)
       VALUES (?, ?, ?, ?)`,
      [usuarioId, tipo, texto(titulo, 160), texto(mensagem, 500)]
    );
  } catch (err) {
    console.error('Falha ao criar notificação:', err.message);
  }
}

async function notificarAdmins(titulo, mensagem, tipo = 'info') {
  try {
    const [admins] = await pool.query(
      `SELECT id FROM usuarios WHERE tipo = 'admin' AND ativo = 1`
    );
    await Promise.all(admins.map(a => notificarUsuario(a.id, titulo, mensagem, tipo)));
  } catch (err) {
    console.error('Falha ao notificar administradores:', err.message);
  }
}

async function idsRelacionadosAgendamento(id) {
  const [rows] = await pool.query(`
    SELECT a.paciente_id, m.usuario_id AS medico_usuario_id, a.paciente, a.data, a.horario
    FROM agendamentos a
    LEFT JOIN medicos m ON m.id = a.medico_id
    WHERE a.id = ? LIMIT 1
  `, [id]);
  return rows[0] || {};
}

function validarImagemDataUrl(valor) {
  if (!valor) return true;
  if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(valor)) return false;
  const base64 = valor.split(',')[1] || '';
  return Buffer.byteLength(base64, 'base64') <= 2 * 1024 * 1024;
}

// ========================================
// STATUS / CONFIGURAÇÕES PÚBLICAS
// ========================================

app.get('/api/status', (_req, res) => {
  res.json({ sistema: 'Clínica Vida+', status: 'online' });
});

app.get('/api/configuracoes/publicas', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT nome_clinica, telefone, email, endereco, horario_funcionamento, logo
      FROM configuracoes WHERE id = 1
    `);
    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar as informações da clínica.' });
  }
});

// ========================================
// CADASTRO / LOGIN / SESSÃO
// ========================================

app.post('/api/cadastro', async (req, res) => {
  const nome = texto(req.body.nome, 160);
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || '');
  const cpf = texto(req.body.cpf, 20);
  const dataNascimento = texto(req.body.data_nascimento, 10);
  const telefone = texto(req.body.telefone, 30);
  const endereco = texto(req.body.endereco, 255);

  if (!nome || !email || senha.length < 8) {
    return res.status(400).json({ erro: 'Informe nome, e-mail e uma senha com pelo menos 8 caracteres.' });
  }

  try {
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (existentes.length) {
      return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const [result] = await pool.query(`
      INSERT INTO usuarios (nome, email, senha, tipo, ativo, cpf, data_nascimento, telefone, endereco)
      VALUES (?, ?, ?, 'paciente', 1, ?, ?, ?, ?)
    `, [nome, email, hash, cpf, dataNascimento || null, telefone, endereco]);

    req.session.usuarioId = result.insertId;
    req.session.tipo = 'paciente';

    await notificarUsuario(result.insertId, 'Conta criada', 'Seu acesso à Clínica Vida+ está pronto.', 'sucesso');
    await notificarAdmins('Novo paciente cadastrado', `${nome} criou uma conta.`, 'info');
    await registrarLog(req, `Paciente ${nome} criou uma conta.`);

    res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso.',
      usuario: { id: result.insertId, nome, email, tipo: 'paciente' }
    });
  } catch (err) {
    console.error('Erro no cadastro:', err);
    res.status(500).json({ erro: 'Não foi possível concluir o cadastro.' });
  }
});

app.post('/api/login', async (req, res) => {
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || '');
  const key = `${req.ip}:${email}`;
  const agora = Date.now();
  const tentativa = loginAttempts.get(key) || { count: 0, until: 0 };

  if (tentativa.until > agora) {
    return res.status(429).json({ erro: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' });
  }

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT id, nome, email, senha, tipo, ativo FROM usuarios WHERE email = ? LIMIT 1`,
      [email]
    );

    const usuario = rows[0];
    const correta = usuario ? await bcrypt.compare(senha, usuario.senha) : false;

    if (!usuario || !correta || !usuario.ativo) {
      const count = tentativa.count + 1;
      loginAttempts.set(key, {
        count,
        until: count >= 10 ? agora + 15 * 60 * 1000 : 0
      });
      return res.status(401).json({ erro: 'E-mail ou senha incorretos, ou usuário inativo.' });
    }

    loginAttempts.delete(key);
    req.session.usuarioId = usuario.id;
    req.session.tipo = usuario.tipo;

    res.json({
      mensagem: 'Login realizado com sucesso.',
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo }
    });
  } catch (err) {
    console.error('Erro no login:', err);
    res.status(500).json({ erro: 'Não foi possível realizar o login.' });
  }
});

app.get('/api/sessao', async (req, res) => {
  if (!req.session.usuarioId) return res.status(401).json({ logado: false });
  try {
    const usuario = await obterUsuarioBasico(req.session.usuarioId);
    if (!usuario || !usuario.ativo) {
      req.session.destroy(() => {});
      return res.status(401).json({ logado: false });
    }
    res.json({ logado: true, usuario });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível verificar a sessão.' });
  }
});

app.post('/api/logout', somenteLogado, (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ erro: 'Não foi possível sair.' });
    res.clearCookie('connect.sid');
    res.json({ mensagem: 'Logout realizado.' });
  });
});

// ========================================
// NOTIFICAÇÕES
// ========================================

app.get('/api/notificacoes', somenteLogado, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, tipo, titulo, mensagem, lida, criada_em
      FROM notificacoes
      WHERE usuario_id = ?
      ORDER BY criada_em DESC
      LIMIT 30
    `, [req.session.usuarioId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar as notificações.' });
  }
});

app.put('/api/notificacoes/:id/lida', somenteLogado, async (req, res) => {
  await pool.query('UPDATE notificacoes SET lida = 1 WHERE id = ? AND usuario_id = ?', [req.params.id, req.session.usuarioId]);
  res.json({ mensagem: 'Notificação marcada como lida.' });
});

app.put('/api/notificacoes/lidas', somenteLogado, async (req, res) => {
  await pool.query('UPDATE notificacoes SET lida = 1 WHERE usuario_id = ?', [req.session.usuarioId]);
  res.json({ mensagem: 'Notificações atualizadas.' });
});

// ========================================
// MÉDICOS PÚBLICOS / HORÁRIOS
// ========================================

app.get('/api/medicos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT m.id, m.nome, m.especialidade, m.valor_consulta, m.foto, m.crm
      FROM medicos m
      INNER JOIN usuarios u ON u.id = m.usuario_id
      WHERE u.ativo = 1
      ORDER BY m.nome
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar os médicos.' });
  }
});

// Mantida apenas por compatibilidade, sem expor dados pessoais.
app.get('/api/agendamentos', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, medico_id, data, horario, status
      FROM agendamentos
      WHERE status <> 'cancelada'
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar a agenda.' });
  }
});

app.get('/api/horarios-disponiveis', async (req, res) => {
  const medicoId = Number(req.query.medico_id);
  const data = texto(req.query.data, 10);
  if (!Number.isInteger(medicoId) || !data) {
    return res.status(400).json({ erro: 'Médico e data são obrigatórios.' });
  }

  const horarios = [
    '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
    '13:30','14:00','14:30','15:00','15:30','16:00','16:30','17:00','17:30'
  ];

  try {
    const [rows] = await pool.query(`
      SELECT horario FROM agendamentos
      WHERE medico_id = ? AND data = ? AND status <> 'cancelada'
    `, [medicoId, data]);
    const ocupados = new Set(rows.map(r => String(r.horario).slice(0,5)));
    res.json({ medico_id: medicoId, data, duracao_consulta: 30, horarios: horarios.filter(h => !ocupados.has(h)) });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível verificar os horários.' });
  }
});

// ========================================
// AGENDAMENTO DO PACIENTE
// ========================================

app.post('/api/agendamentos', somentePaciente, async (req, res) => {
  const especialidade = texto(req.body.especialidade, 100);
  const medicoId = Number(req.body.medico_id);
  const data = texto(req.body.data, 10);
  const horario = texto(req.body.horario, 8);
  const motivo = texto(req.body.motivo_consulta, 2000);

  if (!especialidade || !Number.isInteger(medicoId) || !data || !horario) {
    return res.status(400).json({ erro: 'Preencha especialidade, médico, data e horário.' });
  }

  const conn = await pool.getConnection();
  const lockName = `agenda:${medicoId}:${data}:${horario}`;
  let lockAdquirido = false;
  try {
    const [[lockResult]] = await conn.query('SELECT GET_LOCK(?, 5) AS locked', [lockName]);
    lockAdquirido = Number(lockResult?.locked) === 1;
    if (!lockAdquirido) {
      throw Object.assign(new Error('Este horário está sendo reservado agora. Tente novamente em alguns segundos.'), { status: 409 });
    }

    await conn.beginTransaction();

    const [[paciente]] = await conn.query(
      `SELECT id, nome, email FROM usuarios WHERE id = ? AND tipo = 'paciente' AND ativo = 1 LIMIT 1`,
      [req.session.usuarioId]
    );
    if (!paciente) throw Object.assign(new Error('Paciente não encontrado.'), { status: 404 });

    const [[medico]] = await conn.query(`
      SELECT m.id, m.nome, m.especialidade, m.valor_consulta, m.usuario_id
      FROM medicos m
      INNER JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.id = ? AND u.ativo = 1
      LIMIT 1
      FOR UPDATE
    `, [medicoId]);

    if (!medico) throw Object.assign(new Error('Médico não encontrado ou inativo.'), { status: 404 });
    if (medico.especialidade !== especialidade) {
      throw Object.assign(new Error('A especialidade não corresponde ao médico selecionado.'), { status: 400 });
    }

    const [conflitos] = await conn.query(`
      SELECT id FROM agendamentos
      WHERE medico_id = ? AND data = ? AND horario = ? AND status <> 'cancelada'
      LIMIT 1 FOR UPDATE
    `, [medicoId, data, horario]);

    if (conflitos.length) {
      throw Object.assign(new Error('Este horário já foi reservado. Escolha outro horário.'), { status: 409 });
    }

    const [result] = await conn.query(`
      INSERT INTO agendamentos
      (paciente, email, paciente_id, motivo_consulta, especialidade, data, horario, medico_id, status, retorno, valor_consulta, pagamento_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'agendada', 0, ?, 'pendente')
    `, [paciente.nome, paciente.email, paciente.id, motivo, especialidade, data, horario, medicoId, medico.valor_consulta]);

    await conn.commit();
    await conn.query('SELECT RELEASE_LOCK(?)', [lockName]);
    lockAdquirido = false;

    await notificarUsuario(paciente.id, 'Consulta agendada', `${medico.nome} • ${data} às ${horario.slice(0,5)}`, 'sucesso');
    await notificarUsuario(medico.usuario_id, 'Novo agendamento', `${paciente.nome} agendou uma consulta para ${data} às ${horario.slice(0,5)}.`, 'info');
    await notificarAdmins('Novo agendamento', `${paciente.nome} agendou com ${medico.nome}.`, 'info');
    await registrarLog(req, `Paciente ${paciente.nome} realizou novo agendamento #${result.insertId}.`);

    res.status(201).json({
      mensagem: 'Consulta agendada com sucesso.',
      id: result.insertId,
      valor_consulta: medico.valor_consulta,
      pagamento_status: 'pendente'
    });
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    res.status(err.status || 500).json({ erro: err.status ? err.message : 'Não foi possível criar o agendamento.' });
  } finally {
    if (lockAdquirido) {
      try { await conn.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch (_) {}
    }
    conn.release();
  }
});

// ========================================
// ÁREA DO PACIENTE
// ========================================

app.get('/api/paciente/perfil', somentePaciente, async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT id, nome, email, cpf, data_nascimento, telefone, endereco, ativo, criado_em
      FROM usuarios WHERE id = ? AND tipo = 'paciente' LIMIT 1
    `, [req.session.usuarioId]);
    if (!row) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar seu perfil.' });
  }
});

app.put('/api/paciente/perfil', somentePaciente, async (req, res) => {
  const nome = texto(req.body.nome, 160);
  const email = normalizarEmail(req.body.email);
  const cpf = texto(req.body.cpf, 20);
  const dataNascimento = texto(req.body.data_nascimento, 10);
  const telefone = texto(req.body.telefone, 30);
  const endereco = texto(req.body.endereco, 255);
  if (!nome || !email) return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [duplicado] = await conn.query('SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1', [email, req.session.usuarioId]);
    if (duplicado.length) throw Object.assign(new Error('Este e-mail já está em uso.'), { status: 409 });

    await conn.query(`
      UPDATE usuarios SET nome = ?, email = ?, cpf = ?, data_nascimento = ?, telefone = ?, endereco = ?
      WHERE id = ? AND tipo = 'paciente'
    `, [nome, email, cpf, dataNascimento || null, telefone, endereco, req.session.usuarioId]);

    await conn.query(`
      UPDATE agendamentos SET paciente = ?, email = ?
      WHERE paciente_id = ? AND status <> 'realizada'
    `, [nome, email, req.session.usuarioId]);

    await conn.commit();
    await registrarLog(req, 'Paciente atualizou os próprios dados de perfil.');
    res.json({ mensagem: 'Perfil atualizado com sucesso.' });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ erro: err.status ? err.message : 'Não foi possível atualizar o perfil.' });
  } finally {
    conn.release();
  }
});

app.get('/api/paciente/agendamentos', somentePaciente, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, m.nome AS medico_nome, m.crm, COALESCE(a.valor_consulta, m.valor_consulta) AS valor_consulta
      FROM agendamentos a
      LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.paciente_id = ?
      ORDER BY a.data DESC, a.horario DESC
    `, [req.session.usuarioId]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar suas consultas.' });
  }
});

app.get('/api/paciente/agendamentos/:id', somentePaciente, async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT a.*, m.nome AS medico_nome, m.crm, COALESCE(a.valor_consulta, m.valor_consulta) AS valor_consulta
      FROM agendamentos a
      LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.id = ? AND a.paciente_id = ? LIMIT 1
    `, [req.params.id, req.session.usuarioId]);
    if (!row) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    res.json({ consulta: row });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar a consulta.' });
  }
});

app.put('/api/paciente/agendamentos/:id/cancelar', somentePaciente, async (req, res) => {
  try {
    const [result] = await pool.query(`
      UPDATE agendamentos SET status = 'cancelada'
      WHERE id = ? AND paciente_id = ? AND status IN ('agendada','confirmada') AND data >= CURDATE()
    `, [req.params.id, req.session.usuarioId]);
    if (!result.affectedRows) return res.status(409).json({ erro: 'Esta consulta não pode mais ser cancelada.' });
    const rel = await idsRelacionadosAgendamento(req.params.id);
    await notificarUsuario(rel.medico_usuario_id, 'Consulta cancelada', `O paciente cancelou a consulta #${req.params.id}.`, 'aviso');
    await notificarAdmins('Consulta cancelada', `Consulta #${req.params.id} foi cancelada pelo paciente.`, 'aviso');
    await registrarLog(req, `Consulta #${req.params.id} foi cancelada pelo paciente.`);
    res.json({ mensagem: 'Consulta cancelada.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível cancelar a consulta.' });
  }
});

// ========================================
// ÁREA DO MÉDICO
// ========================================

async function medicoDoUsuario(usuarioId) {
  const [[row]] = await pool.query(`
    SELECT m.*, u.email, u.ativo
    FROM medicos m INNER JOIN usuarios u ON u.id = m.usuario_id
    WHERE m.usuario_id = ? LIMIT 1
  `, [usuarioId]);
  return row || null;
}

app.get('/api/medico/perfil', somenteMedico, async (req, res) => {
  try {
    const medico = await medicoDoUsuario(req.session.usuarioId);
    if (!medico) return res.status(404).json({ erro: 'Médico não encontrado.' });
    res.json(medico);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar o perfil.' });
  }
});

app.put('/api/medico/foto', somenteMedico, async (req, res) => {
  const foto = req.body.foto || null;
  if (!validarImagemDataUrl(foto)) {
    return res.status(400).json({ erro: 'Use uma imagem JPG, PNG ou WEBP de até 2 MB.' });
  }
  try {
    await pool.query('UPDATE medicos SET foto = ? WHERE usuario_id = ?', [foto, req.session.usuarioId]);
    await registrarLog(req, 'Médico atualizou sua foto de perfil.');
    res.json({ mensagem: 'Foto atualizada com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível atualizar a foto.' });
  }
});

app.get('/api/meus-agendamentos', somenteMedico, async (req, res) => {
  try {
    const medico = await medicoDoUsuario(req.session.usuarioId);
    if (!medico) return res.status(404).json({ erro: 'Médico não encontrado.' });
    const [rows] = await pool.query(`
      SELECT a.*, u.data_nascimento AS paciente_data_nascimento,
             COALESCE(a.valor_consulta, m.valor_consulta) AS valor_consulta
      FROM agendamentos a
      INNER JOIN medicos m ON m.id = a.medico_id
      LEFT JOIN usuarios u ON u.id = a.paciente_id
      WHERE a.medico_id = ?
      ORDER BY a.data DESC, a.horario DESC
    `, [medico.id]);
    res.json({
      medico: {
        id: medico.id, nome: medico.nome, especialidade: medico.especialidade,
        valor_consulta: medico.valor_consulta, foto: medico.foto, crm: medico.crm
      },
      agendamentos: rows
    });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar sua agenda.' });
  }
});

app.get('/api/meus-agendamentos/:id', somenteMedico, async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT a.*, u.data_nascimento AS paciente_data_nascimento,
             m.nome AS medico_nome, m.crm, COALESCE(a.valor_consulta, m.valor_consulta) AS valor_consulta
      FROM agendamentos a
      INNER JOIN medicos m ON m.id = a.medico_id
      LEFT JOIN usuarios u ON u.id = a.paciente_id
      WHERE a.id = ? AND m.usuario_id = ? LIMIT 1
    `, [req.params.id, req.session.usuarioId]);
    if (!row) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    res.json({ consulta: row });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar a consulta.' });
  }
});

app.get('/api/meus-agendamentos/:id/historico-paciente', somenteMedico, async (req, res) => {
  try {
    const [[atual]] = await pool.query(`
      SELECT a.paciente_id, a.email, a.medico_id
      FROM agendamentos a
      INNER JOIN medicos m ON m.id = a.medico_id
      WHERE a.id = ? AND m.usuario_id = ? LIMIT 1
    `, [req.params.id, req.session.usuarioId]);
    if (!atual) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    const [rows] = await pool.query(`
      SELECT id, data, especialidade, diagnostico, receita, observacoes, retorno, data_retorno, realizado_em
      FROM agendamentos
      WHERE medico_id = ? AND status = 'realizada'
        AND id <> ?
        AND ((paciente_id IS NOT NULL AND paciente_id = ?) OR (paciente_id IS NULL AND email = ?))
      ORDER BY data DESC, horario DESC
      LIMIT 10
    `, [atual.medico_id, req.params.id, atual.paciente_id, atual.email]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar o histórico.' });
  }
});

app.put('/api/meus-agendamentos/:id/salvar', somenteMedico, async (req, res) => {
  try {
    const medico = await medicoDoUsuario(req.session.usuarioId);
    if (!medico) return res.status(404).json({ erro: 'Médico não encontrado.' });
    const retorno = Boolean(req.body.retorno);
    const dataRetorno = retorno ? texto(req.body.data_retorno, 10) : null;
    if (retorno && !dataRetorno) return res.status(400).json({ erro: 'Informe a data do retorno.' });

    const [result] = await pool.query(`
      UPDATE agendamentos
      SET diagnostico = ?, receita = ?, observacoes = ?, retorno = ?, data_retorno = ?
      WHERE id = ? AND medico_id = ? AND status <> 'cancelada' AND status <> 'realizada'
    `, [texto(req.body.diagnostico, 10000), texto(req.body.receita, 10000), texto(req.body.observacoes, 10000), retorno ? 1 : 0, dataRetorno, req.params.id, medico.id]);
    if (!result.affectedRows) return res.status(409).json({ erro: 'Esta consulta não pode ser editada.' });
    await registrarLog(req, `Médico salvou o atendimento da consulta #${req.params.id}.`);
    res.json({ mensagem: 'Atendimento salvo.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível salvar o atendimento.' });
  }
});

app.put('/api/meus-agendamentos/:id/realizar', somenteMedico, async (req, res) => {
  try {
    const medico = await medicoDoUsuario(req.session.usuarioId);
    if (!medico) return res.status(404).json({ erro: 'Médico não encontrado.' });
    const retorno = Boolean(req.body.retorno);
    const dataRetorno = retorno ? texto(req.body.data_retorno, 10) : null;
    if (retorno && !dataRetorno) return res.status(400).json({ erro: 'Informe a data do retorno.' });

    const [result] = await pool.query(`
      UPDATE agendamentos
      SET diagnostico = ?, receita = ?, observacoes = ?, retorno = ?, data_retorno = ?,
          realizado_em = NOW(), status = 'realizada'
      WHERE id = ? AND medico_id = ? AND status IN ('agendada','confirmada')
    `, [texto(req.body.diagnostico, 10000), texto(req.body.receita, 10000), texto(req.body.observacoes, 10000), retorno ? 1 : 0, dataRetorno, req.params.id, medico.id]);
    if (!result.affectedRows) return res.status(409).json({ erro: 'Esta consulta não pode ser finalizada.' });

    const rel = await idsRelacionadosAgendamento(req.params.id);
    await notificarUsuario(rel.paciente_id, 'Consulta realizada', `Seu atendimento #${req.params.id} foi finalizado.`, 'sucesso');
    await notificarAdmins('Consulta realizada', `${medico.nome} finalizou a consulta #${req.params.id}.`, 'sucesso');
    if (retorno) await notificarUsuario(rel.paciente_id, 'Retorno registrado', `Retorno previsto para ${dataRetorno}.`, 'info');
    await registrarLog(req, `${medico.nome} finalizou a consulta #${req.params.id}.`);
    res.json({ mensagem: 'Atendimento finalizado com sucesso.', status: 'realizada' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível finalizar o atendimento.' });
  }
});

// ========================================
// ADMIN - MÉDICOS
// ========================================

app.post('/api/admin/medicos', somenteAdmin, async (req, res) => {
  const nome = texto(req.body.nome, 160);
  const email = normalizarEmail(req.body.email);
  const senha = String(req.body.senha || '');
  const especialidade = texto(req.body.especialidade, 100);
  const valor = Number(req.body.valor_consulta);
  const cpf = texto(req.body.cpf, 20);
  const crm = texto(req.body.crm, 40);
  const telefone = texto(req.body.telefone, 30);

  if (!nome || !email || senha.length < 8 || !especialidade || !Number.isFinite(valor) || valor < 0) {
    return res.status(400).json({ erro: 'Preencha nome, e-mail, senha, especialidade e valor da consulta.' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [dup] = await conn.query('SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email]);
    if (dup.length) throw Object.assign(new Error('Este e-mail já está cadastrado.'), { status: 409 });
    const hash = await bcrypt.hash(senha, 10);
    const [u] = await conn.query(`
      INSERT INTO usuarios (nome, email, senha, tipo, ativo, cpf, telefone)
      VALUES (?, ?, ?, 'medico', 1, ?, ?)
    `, [nome, email, hash, cpf, telefone]);
    const [m] = await conn.query(`
      INSERT INTO medicos (nome, especialidade, usuario_id, valor_consulta, cpf, crm, telefone)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [nome, especialidade, u.insertId, valor, cpf, crm, telefone]);
    await conn.commit();
    await notificarUsuario(u.insertId, 'Acesso criado', 'Seu perfil profissional foi cadastrado na Clínica Vida+.', 'sucesso');
    await registrarLog(req, `Administrador cadastrou o médico ${nome}.`);
    res.status(201).json({ mensagem: 'Médico cadastrado com sucesso.', id: m.insertId });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ erro: err.status ? err.message : 'Não foi possível cadastrar o médico.' });
  } finally {
    conn.release();
  }
});

app.get('/api/admin/medicos', somenteAdmin, async (req, res) => {
  try {
    const busca = texto(req.query.busca, 100) || '';
    const status = req.query.status;
    const params = [`%${busca}%`, `%${busca}%`, `%${busca}%`];
    let filtroStatus = '';
    if (status === 'ativo' || status === 'inativo') {
      filtroStatus = ' AND u.ativo = ?';
      params.push(status === 'ativo' ? 1 : 0);
    }
    const [rows] = await pool.query(`
      SELECT m.id, m.nome, m.especialidade, m.valor_consulta, m.cpf, m.crm, m.telefone, m.foto, m.criado_em,
             u.id AS usuario_id, u.email, u.ativo,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.data = CURDATE() AND a.status <> 'cancelada') AS consultas_hoje,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.status = 'realizada') AS realizadas_count,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.data >= CURDATE() AND a.status IN ('agendada','confirmada')) AS proximos_agendamentos
      FROM medicos m
      INNER JOIN usuarios u ON u.id = m.usuario_id
      WHERE (m.nome LIKE ? OR m.especialidade LIKE ? OR COALESCE(m.crm,'') LIKE ?)
      ${filtroStatus}
      ORDER BY m.nome
    `, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Não foi possível carregar os médicos.' });
  }
});

app.get('/api/admin/medicos/:id', somenteAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT m.*, u.email, u.ativo,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.data = CURDATE() AND a.status <> 'cancelada') AS consultas_hoje,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.status = 'realizada') AS realizadas_count,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.medico_id = m.id AND a.data >= CURDATE() AND a.status IN ('agendada','confirmada')) AS proximos_agendamentos
      FROM medicos m INNER JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.id = ? LIMIT 1
    `, [req.params.id]);
    if (!row) return res.status(404).json({ erro: 'Médico não encontrado.' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar o médico.' });
  }
});

app.put('/api/admin/medicos/:id', somenteAdmin, async (req, res) => {
  const nome = texto(req.body.nome, 160);
  const email = normalizarEmail(req.body.email);
  const especialidade = texto(req.body.especialidade, 100);
  const valor = Number(req.body.valor_consulta);
  if (!nome || !email || !especialidade || !Number.isFinite(valor) || valor < 0) {
    return res.status(400).json({ erro: 'Preencha os dados obrigatórios corretamente.' });
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[medico]] = await conn.query('SELECT usuario_id FROM medicos WHERE id = ? LIMIT 1', [req.params.id]);
    if (!medico) throw Object.assign(new Error('Médico não encontrado.'), { status: 404 });
    const [dup] = await conn.query('SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1', [email, medico.usuario_id]);
    if (dup.length) throw Object.assign(new Error('Este e-mail já está em uso.'), { status: 409 });
    await conn.query(`UPDATE usuarios SET nome = ?, email = ?, cpf = ?, telefone = ? WHERE id = ?`,
      [nome, email, texto(req.body.cpf,20), texto(req.body.telefone,30), medico.usuario_id]);
    await conn.query(`UPDATE medicos SET nome = ?, especialidade = ?, valor_consulta = ?, cpf = ?, crm = ?, telefone = ? WHERE id = ?`,
      [nome, especialidade, valor, texto(req.body.cpf,20), texto(req.body.crm,40), texto(req.body.telefone,30), req.params.id]);
    await conn.commit();
    await notificarUsuario(medico.usuario_id, 'Perfil atualizado', 'Seus dados profissionais foram atualizados pela administração.', 'info');
    await registrarLog(req, `Administrador alterou os dados do médico ${nome}.`);
    res.json({ mensagem: 'Dados do médico atualizados.' });
  } catch (err) {
    await conn.rollback();
    res.status(err.status || 500).json({ erro: err.status ? err.message : 'Não foi possível atualizar o médico.' });
  } finally {
    conn.release();
  }
});

app.put('/api/admin/medicos/:id/status', somenteAdmin, async (req, res) => {
  const ativo = req.body.ativo === true || req.body.ativo === 1;
  try {
    const [[medico]] = await pool.query(`SELECT m.nome, m.usuario_id FROM medicos m WHERE m.id = ? LIMIT 1`, [req.params.id]);
    if (!medico) return res.status(404).json({ erro: 'Médico não encontrado.' });
    await pool.query('UPDATE usuarios SET ativo = ? WHERE id = ?', [ativo ? 1 : 0, medico.usuario_id]);
    await notificarUsuario(medico.usuario_id, ativo ? 'Acesso reativado' : 'Acesso desativado', ativo ? 'Seu perfil profissional foi reativado.' : 'Seu perfil profissional foi desativado pela administração.', ativo ? 'sucesso' : 'aviso');
    await registrarLog(req, `Administrador ${ativo ? 'reativou' : 'desativou'} o médico ${medico.nome}.`);
    res.json({ mensagem: ativo ? 'Médico reativado com sucesso.' : 'Médico desativado com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível alterar o status do médico.' });
  }
});

// ========================================
// ADMIN - PACIENTES
// ========================================

app.get('/api/admin/pacientes', somenteAdmin, async (req, res) => {
  try {
    const busca = texto(req.query.busca, 100) || '';
    const like = `%${busca}%`;
    const [rows] = await pool.query(`
      SELECT u.id, u.nome, u.email, u.cpf, u.data_nascimento, u.telefone, u.endereco, u.ativo, u.criado_em,
             (SELECT MAX(a.data) FROM agendamentos a WHERE a.paciente_id = u.id AND a.status = 'realizada') AS ultima_consulta,
             (SELECT MIN(a.data) FROM agendamentos a WHERE a.paciente_id = u.id AND a.data >= CURDATE() AND a.status IN ('agendada','confirmada')) AS proxima_consulta,
             (SELECT COUNT(*) FROM agendamentos a WHERE a.paciente_id = u.id) AS total_consultas
      FROM usuarios u
      WHERE u.tipo = 'paciente'
        AND (u.nome LIKE ? OR COALESCE(u.cpf,'') LIKE ? OR COALESCE(u.telefone,'') LIKE ? OR u.email LIKE ?)
      ORDER BY u.nome
    `, [like, like, like, like]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar os pacientes.' });
  }
});

app.get('/api/admin/pacientes/:id', somenteAdmin, async (req, res) => {
  try {
    const [[paciente]] = await pool.query(`
      SELECT id, nome, email, cpf, data_nascimento, telefone, endereco, ativo, criado_em
      FROM usuarios WHERE id = ? AND tipo = 'paciente' LIMIT 1
    `, [req.params.id]);
    if (!paciente) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    const [consultas] = await pool.query(`
      SELECT a.*, m.nome AS medico_nome, COALESCE(a.valor_consulta,m.valor_consulta) AS valor_consulta
      FROM agendamentos a LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.paciente_id = ? ORDER BY a.data DESC, a.horario DESC
    `, [req.params.id]);
    res.json({ paciente, consultas });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar o paciente.' });
  }
});

app.put('/api/admin/pacientes/:id', somenteAdmin, async (req, res) => {
  const nome = texto(req.body.nome, 160);
  const email = normalizarEmail(req.body.email);
  if (!nome || !email) return res.status(400).json({ erro: 'Nome e e-mail são obrigatórios.' });
  try {
    const [dup] = await pool.query('SELECT id FROM usuarios WHERE email = ? AND id <> ? LIMIT 1', [email, req.params.id]);
    if (dup.length) return res.status(409).json({ erro: 'Este e-mail já está em uso.' });
    const [result] = await pool.query(`
      UPDATE usuarios SET nome = ?, email = ?, cpf = ?, data_nascimento = ?, telefone = ?, endereco = ?, ativo = ?
      WHERE id = ? AND tipo = 'paciente'
    `, [nome, email, texto(req.body.cpf,20), texto(req.body.data_nascimento,10) || null, texto(req.body.telefone,30), texto(req.body.endereco,255), req.body.ativo === false ? 0 : 1, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ erro: 'Paciente não encontrado.' });
    await registrarLog(req, `Administrador atualizou os dados do paciente ${nome}.`);
    res.json({ mensagem: 'Paciente atualizado com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível atualizar o paciente.' });
  }
});

// ========================================
// ADMIN - AGENDAMENTOS / PAGAMENTOS
// ========================================

app.get('/api/admin/agendamentos', somenteAdmin, async (req, res) => {
  try {
    const busca = texto(req.query.busca, 100) || '';
    const status = texto(req.query.status, 20);
    const medicoId = Number(req.query.medico_id);
    const data = texto(req.query.data, 10);
    const where = ['(a.paciente LIKE ? OR a.email LIKE ? OR m.nome LIKE ?)'];
    const params = [`%${busca}%`, `%${busca}%`, `%${busca}%`];
    if (status && ['agendada','confirmada','cancelada','realizada'].includes(status)) { where.push('a.status = ?'); params.push(status); }
    if (Number.isInteger(medicoId)) { where.push('a.medico_id = ?'); params.push(medicoId); }
    if (data) { where.push('a.data = ?'); params.push(data); }
    const [rows] = await pool.query(`
      SELECT a.*, m.nome AS medico, m.crm, COALESCE(a.valor_consulta,m.valor_consulta) AS valor_consulta
      FROM agendamentos a LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE ${where.join(' AND ')}
      ORDER BY a.data DESC, a.horario DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar os agendamentos.' });
  }
});

app.get('/api/admin/agendamentos/:id', somenteAdmin, async (req, res) => {
  try {
    const [[row]] = await pool.query(`
      SELECT a.*, m.nome AS medico_nome, m.especialidade AS medico_especialidade, m.crm,
             COALESCE(a.valor_consulta,m.valor_consulta) AS valor_consulta
      FROM agendamentos a LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.id = ? LIMIT 1
    `, [req.params.id]);
    if (!row) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    res.json({ consulta: row });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar a consulta.' });
  }
});

app.put('/api/admin/agendamentos/:id/confirmar', somenteAdmin, async (req, res) => {
  try {
    const [result] = await pool.query(`UPDATE agendamentos SET status = 'confirmada' WHERE id = ? AND status = 'agendada'`, [req.params.id]);
    if (!result.affectedRows) return res.status(409).json({ erro: 'Esta consulta não pode ser confirmada.' });
    const rel = await idsRelacionadosAgendamento(req.params.id);
    await notificarUsuario(rel.paciente_id, 'Consulta confirmada', `Sua consulta #${req.params.id} foi confirmada.`, 'sucesso');
    await notificarUsuario(rel.medico_usuario_id, 'Consulta confirmada', `A consulta #${req.params.id} foi confirmada.`, 'info');
    await registrarLog(req, `Administrador confirmou a consulta #${req.params.id}.`);
    res.json({ mensagem: 'Consulta confirmada.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível confirmar a consulta.' });
  }
});

app.put('/api/admin/agendamentos/:id/cancelar', somenteAdmin, async (req, res) => {
  try {
    const [result] = await pool.query(`UPDATE agendamentos SET status = 'cancelada' WHERE id = ? AND status IN ('agendada','confirmada')`, [req.params.id]);
    if (!result.affectedRows) return res.status(409).json({ erro: 'Esta consulta não pode ser cancelada.' });
    const rel = await idsRelacionadosAgendamento(req.params.id);
    await notificarUsuario(rel.paciente_id, 'Consulta cancelada', `Sua consulta #${req.params.id} foi cancelada.`, 'aviso');
    await notificarUsuario(rel.medico_usuario_id, 'Consulta cancelada', `A consulta #${req.params.id} foi cancelada.`, 'aviso');
    await registrarLog(req, `Consulta #${req.params.id} foi cancelada.`);
    res.json({ mensagem: 'Consulta cancelada.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível cancelar a consulta.' });
  }
});

app.get('/api/admin/pagamentos', somenteAdmin, async (req, res) => {
  try {
    const status = req.query.status;
    const filtro = status === 'pago' || status === 'pendente' ? 'AND a.pagamento_status = ?' : '';
    const params = filtro ? [status] : [];
    const [rows] = await pool.query(`
      SELECT a.id, a.paciente, a.data, a.horario, a.status AS consulta_status,
             a.pagamento_status, a.pagamento_confirmado_em,
             m.nome AS medico, COALESCE(a.valor_consulta,m.valor_consulta) AS valor_consulta
      FROM agendamentos a LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.status <> 'cancelada' ${filtro}
      ORDER BY a.data DESC, a.horario DESC
    `, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar os pagamentos.' });
  }
});

app.put('/api/admin/pagamentos/:id/confirmar', somenteAdmin, async (req, res) => {
  try {
    const [[consulta]] = await pool.query(`
      SELECT a.id, a.pagamento_status, a.status, a.paciente_id, m.usuario_id AS medico_usuario_id
      FROM agendamentos a LEFT JOIN medicos m ON m.id = a.medico_id
      WHERE a.id = ? LIMIT 1
    `, [req.params.id]);
    if (!consulta) return res.status(404).json({ erro: 'Consulta não encontrada.' });
    if (consulta.status === 'cancelada') return res.status(409).json({ erro: 'Uma consulta cancelada não pode ser paga.' });
    if (consulta.pagamento_status === 'pago') return res.status(409).json({ erro: 'Este pagamento já foi confirmado.' });

    await pool.query(`UPDATE agendamentos SET pagamento_status = 'pago', pagamento_confirmado_em = NOW() WHERE id = ?`, [req.params.id]);
    await notificarUsuario(consulta.paciente_id, 'Pagamento confirmado', `O pagamento da consulta #${req.params.id} foi confirmado.`, 'sucesso');
    await notificarUsuario(consulta.medico_usuario_id, 'Pagamento confirmado', `O pagamento da consulta #${req.params.id} foi confirmado.`, 'sucesso');
    await registrarLog(req, `Administrador confirmou o pagamento da consulta #${req.params.id}.`);
    res.json({ mensagem: 'Pagamento confirmado com sucesso.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível confirmar o pagamento.' });
  }
});

// ========================================
// ADMIN - DASHBOARD / RELATÓRIOS / LOGS / CONFIG
// ========================================

app.get('/api/admin/estatisticas', somenteAdmin, async (_req, res) => {
  try {
    const [[r]] = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM agendamentos WHERE data = CURDATE() AND status <> 'cancelada') AS consultasHoje,
        (SELECT COUNT(*) FROM agendamentos WHERE YEAR(data)=YEAR(CURDATE()) AND MONTH(data)=MONTH(CURDATE())) AS consultasMes,
        (SELECT COUNT(*) FROM agendamentos WHERE status='realizada') AS consultasRealizadas,
        (SELECT COUNT(*) FROM agendamentos WHERE status='cancelada') AS consultasCanceladas,
        (SELECT COUNT(*) FROM agendamentos WHERE pagamento_status='pendente' AND status <> 'cancelada') AS consultasPendentes,
        (SELECT COUNT(*) FROM agendamentos WHERE pagamento_status='pago') AS consultasPagas,
        (SELECT COUNT(*) FROM usuarios WHERE tipo='paciente' AND ativo=1) AS totalPacientes,
        (SELECT COUNT(*) FROM usuarios WHERE tipo='medico' AND ativo=1) AS totalMedicos,
        (SELECT COALESCE(SUM(COALESCE(a.valor_consulta,m.valor_consulta)),0)
           FROM agendamentos a LEFT JOIN medicos m ON m.id=a.medico_id
           WHERE a.pagamento_status='pago'
             AND YEAR(a.pagamento_confirmado_em)=YEAR(CURDATE())
             AND MONTH(a.pagamento_confirmado_em)=MONTH(CURDATE())) AS valorRecebidoMes,
        (SELECT COALESCE(SUM(COALESCE(a.valor_consulta,m.valor_consulta)),0)
           FROM agendamentos a LEFT JOIN medicos m ON m.id=a.medico_id
           WHERE a.pagamento_status='pago') AS valorTotalConsultas
    `);
    res.json({
      ...r,
      totalAgendamentos: r.consultasMes,
      consultasPendentes: r.consultasPendentes,
      valorTotalConsultas: r.valorTotalConsultas
    });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar as estatísticas.' });
  }
});

app.get('/api/admin/relatorios', somenteAdmin, async (req, res) => {
  try {
    const inicio = texto(req.query.inicio, 10) || '2000-01-01';
    const fim = texto(req.query.fim, 10) || '2999-12-31';
    const medicoId = Number(req.query.medico_id);
    const whereMedico = Number.isInteger(medicoId) ? 'AND a.medico_id = ?' : '';
    const params = Number.isInteger(medicoId) ? [inicio, fim, medicoId] : [inicio, fim];
    const [[resumo]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(a.status='realizada') AS realizadas,
        SUM(a.status='cancelada') AS canceladas,
        SUM(a.pagamento_status='pendente' AND a.status<>'cancelada') AS pagamentos_pendentes,
        SUM(a.pagamento_status='pago') AS pagamentos_pagos,
        COALESCE(SUM(CASE WHEN a.pagamento_status='pago' THEN COALESCE(a.valor_consulta,m.valor_consulta) ELSE 0 END),0) AS faturamento
      FROM agendamentos a LEFT JOIN medicos m ON m.id=a.medico_id
      WHERE a.data BETWEEN ? AND ? ${whereMedico}
    `, params);
    const [porMedico] = await pool.query(`
      SELECT m.id, m.nome, COUNT(a.id) AS consultas,
             SUM(a.status='realizada') AS realizadas,
             COALESCE(SUM(CASE WHEN a.pagamento_status='pago' THEN COALESCE(a.valor_consulta,m.valor_consulta) ELSE 0 END),0) AS faturamento
      FROM medicos m LEFT JOIN agendamentos a ON a.medico_id=m.id AND a.data BETWEEN ? AND ?
      GROUP BY m.id ORDER BY faturamento DESC
    `, [inicio, fim]);
    const [mensal] = await pool.query(`
      SELECT DATE_FORMAT(a.data,'%Y-%m') AS mes, COUNT(*) AS consultas,
             COALESCE(SUM(CASE WHEN a.pagamento_status='pago' THEN COALESCE(a.valor_consulta,m.valor_consulta) ELSE 0 END),0) AS faturamento
      FROM agendamentos a LEFT JOIN medicos m ON m.id=a.medico_id
      WHERE a.data BETWEEN ? AND ?
      GROUP BY DATE_FORMAT(a.data,'%Y-%m') ORDER BY mes
    `, [inicio, fim]);
    res.json({ resumo, por_medico: porMedico, mensal });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível gerar o relatório.' });
  }
});

app.get('/api/admin/logs', somenteAdmin, async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 300);
    const [rows] = await pool.query(`
      SELECT id, usuario_nome, usuario_tipo, acao, criado_em
      FROM logs ORDER BY criado_em DESC LIMIT ?
    `, [limite]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar os logs.' });
  }
});

app.get('/api/admin/configuracoes', somenteAdmin, async (_req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM configuracoes WHERE id = 1');
    res.json(row || {});
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível carregar as configurações.' });
  }
});

app.put('/api/admin/configuracoes', somenteAdmin, async (req, res) => {
  const logo = req.body.logo || null;
  if (!validarImagemDataUrl(logo)) return res.status(400).json({ erro: 'Logo inválido ou maior que 2 MB.' });
  try {
    await pool.query(`
      UPDATE configuracoes SET nome_clinica=?, telefone=?, email=?, endereco=?, horario_funcionamento=?, logo=? WHERE id=1
    `, [texto(req.body.nome_clinica,120) || 'Clínica Vida+', texto(req.body.telefone,30), normalizarEmail(req.body.email), texto(req.body.endereco,255), texto(req.body.horario_funcionamento,180), logo]);
    await registrarLog(req, 'Administrador atualizou as configurações gerais da clínica.');
    res.json({ mensagem: 'Configurações salvas.' });
  } catch (err) {
    res.status(500).json({ erro: 'Não foi possível salvar as configurações.' });
  }
});

// ========================================
// 404 / START
// ========================================

app.use('/api', (_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

async function start() {
  try {
    await ensureSchema();
    app.listen(PORT, () => {
      console.log(`Clínica Vida+ rodando em http://localhost:${PORT}`);
      if (!process.env.DB_PASSWORD) {
        console.warn('Aviso: DB_PASSWORD não está definido no ambiente. Se o MySQL exigir senha, configure essa variável.');
      }
    });
    console.log('Conectado ao MySQL e estrutura verificada.');
  } catch (err) {
    console.error('Falha ao iniciar a Clínica Vida+:', err.message);
    process.exit(1);
  }
}

start();
