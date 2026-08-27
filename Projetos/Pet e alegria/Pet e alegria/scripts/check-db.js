require('dotenv').config();
const { initializeDatabase, getPool, closeDatabase, databaseName } = require('../src/db');

(async () => {
  try {
    const init = await initializeDatabase();
    const [tables] = await getPool().query('SHOW TABLES');
    const [[animals]] = await getPool().query('SELECT COUNT(*) AS total FROM animais');
    const [[admins]] = await getPool().query('SELECT COUNT(*) AS total FROM usuarios_admin');

    console.log('MySQL conectado com sucesso.');
    console.log(`Banco: ${databaseName()}`);
    console.log(`Tabelas: ${tables.length}`);
    console.log(`Animais: ${animals.total}`);
    console.log(`Administradores: ${admins.total}`);

    if (init.bootstrapAdmin) {
      console.log('');
      console.log('==============================================');
      console.log(' ADMINISTRADOR INICIAL CRIADO');
      console.log('==============================================');
      console.log(`E-mail: ${init.bootstrapAdmin.email}`);
      console.log(`Senha temporaria: ${init.bootstrapAdmin.temporaryPassword}`);
      console.log('');
      console.log('COPIE ESTA SENHA AGORA. Ela nao sera mostrada novamente.');
      console.log('Depois entre no painel e altere a senha na aba Conta.');
      console.log('==============================================');
      console.log('');
    }
  } catch (error) {
    console.error('Falha ao verificar o banco:', error.message);
    if (error.code) console.error('Codigo:', error.code);
    process.exitCode = 1;
  } finally {
    await closeDatabase().catch(() => {});
  }
})();
