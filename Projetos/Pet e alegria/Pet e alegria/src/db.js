const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

let pool = null;

function envBool(name, fallback = false) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function sslOptions() {
  if (!envBool('DB_SSL', false)) return undefined;
  return {
    rejectUnauthorized: true,
    ...(process.env.DB_CA
      ? { ca: process.env.DB_CA.replace(/\\n/g, '\n') }
      : {})
  };
}

function baseConfig() {
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    ssl: sslOptions(),
    charset: 'utf8mb4'
  };
}

function databaseName() {
  const name = process.env.DB_NAME || 'pet_e_alegria';
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error('DB_NAME invalido. Use apenas letras, numeros e underscore.');
  }
  return name;
}

async function ensureDatabaseExists() {
  const name = databaseName();
  const connection = await mysql.createConnection(baseConfig());
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } catch (error) {
    // Em bancos gerenciados o usuario pode nao ter CREATE DATABASE. Se o banco ja
    // existir, a conexao principal abaixo funcionara normalmente.
    if (!['ER_DBACCESS_DENIED_ERROR', 'ER_ACCESS_DENIED_ERROR'].includes(error.code)) {
      throw error;
    }
  } finally {
    await connection.end();
  }
}

async function applySchema() {
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  const connection = await mysql.createConnection({
    ...baseConfig(),
    database: databaseName(),
    multipleStatements: true
  });
  try {
    await connection.query(schema);
  } finally {
    await connection.end();
  }
}

async function seedDemoAnimals() {
  if (!envBool('SEED_DEMO_DATA', true)) return;
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM animais');
  if (Number(total) > 0) return;

  const animais = [
    ['Bidu', 'cachorro', 'Labrador', '2 anos', 'macho', 'grande', 1, 1, 'disponivel', 'Carinhoso, ativo e muito companheiro. Adora passeios e se da bem com pessoas.'],
    ['Mimi', 'gato', 'Siames', '1 ano', 'femea', 'pequeno', 1, 0, 'disponivel', 'Curiosa, tranquila e muito afetuosa. Gosta de lugares altos e de receber carinho.'],
    ['Nina', 'cachorro', 'Sem raca definida', '8 meses', 'femea', 'medio', 1, 1, 'disponivel', 'Brincalhona e sociavel. Procura uma familia que goste de atividades e muito carinho.'],
    ['Theo', 'gato', 'Sem raca definida', '3 anos', 'macho', 'medio', 1, 1, 'disponivel', 'Calmo, observador e independente, mas sempre aparece quando quer companhia.']
  ];

  for (const animal of animais) {
    await pool.query(
      `INSERT INTO animais
      (nome, tipo, raca, idade, sexo, porte, vacinado, castrado, status, descricao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      animal
    );
  }
}

function generateTemporaryPassword() {
  return `${crypto.randomBytes(12).toString('base64url')}!Aa1`;
}

async function ensureBootstrapAdmin() {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios_admin');
  if (Number(total) > 0) return null;

  const email = String(process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@petealegria.local').trim().toLowerCase();
  const nome = String(process.env.ADMIN_BOOTSTRAP_NAME || 'Administrador Pet e Alegria').trim();
  const temporaryPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || generateTemporaryPassword();
  const senhaHash = await bcrypt.hash(temporaryPassword, 12);

  await pool.query(
    'INSERT INTO usuarios_admin (nome, email, senha_hash) VALUES (?, ?, ?)',
    [nome, email, senhaHash]
  );

  return { email, temporaryPassword };
}

async function initializeDatabase() {
  if (pool) return pool;

  await ensureDatabaseExists();
  await applySchema();

  pool = mysql.createPool({
    ...baseConfig(),
    database: databaseName(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    dateStrings: true,
    decimalNumbers: true
  });

  await pool.query('SELECT 1');
  await seedDemoAnimals();
  const bootstrapAdmin = await ensureBootstrapAdmin();
  return { pool, bootstrapAdmin };
}

function getPool() {
  if (!pool) throw new Error('Banco ainda nao foi inicializado.');
  return pool;
}

async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  initializeDatabase,
  getPool,
  closeDatabase,
  databaseName,
  sslOptions
};
