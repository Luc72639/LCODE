require('dotenv').config();

const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { initializeDatabase, getPool } = require('./src/db');
const store = require('./src/store/mysqlStore');
const MySQLSessionStore = require('./src/session/mysqlSessionStore');
const requireAdmin = require('./src/middleware/adminSession');
const { validateAnimal, validateRequest, validateInterest } = require('./src/utils/validation');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
if (IS_PRODUCTION) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      "img-src": ["'self'", 'data:', 'https:'],
      "style-src": ["'self'", "'unsafe-inline'"],
      "script-src": ["'self'"],
      "connect-src": ["'self'"],
      "font-src": ["'self'", 'data:']
    }
  }
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 180,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'rate_limit', mensagem: 'Muitas requisicoes. Tente novamente em alguns minutos.' }
});

const formLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'rate_limit', mensagem: 'Muitas solicitacoes enviadas. Tente novamente mais tarde.' }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { erro: 'rate_limit', mensagem: 'Muitas tentativas de login. Aguarde alguns minutos.' }
});

function clientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').slice(0, 64);
}

function sessionRegenerate(req) {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}

function sessionSave(req) {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}

function sessionDestroy(req) {
  return new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));
}

function publicAdmin(admin) {
  return {
    id: admin.id,
    nome: admin.nome,
    email: admin.email,
    ultimoLoginEm: admin.ultimoLoginEm,
    criadoEm: admin.criadoEm
  };
}

function registerRoutes() {
  // -----------------------------------------------------
  // STATUS / API PUBLICA
  // -----------------------------------------------------
  // API interna usada pelo proprio site e pelo painel.
  app.get('/api/v1/status', publicLimiter, async (_req, res, next) => {
    try {
      await getPool().query('SELECT 1');
      res.json({
        name: 'Pet e Alegria API',
        version: '1.0.0',
        status: 'online',
        storage: 'mysql',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/animais', publicLimiter, async (req, res, next) => {
    try {
      const { tipo, sexo, porte, status = 'disponivel', q } = req.query;
      const items = await store.listarAnimais({ tipo, sexo, porte, status, q });
      res.json({ data: items, total: items.length });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/animais/:id', publicLimiter, async (req, res, next) => {
    try {
      const item = await store.buscarAnimalPorId(req.params.id);
      if (!item) {
        return res.status(404).json({ erro: 'not_found', mensagem: 'Animal nao encontrado.' });
      }
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/solicitacoes', formLimiter, async (req, res, next) => {
    try {
      const { errors, value } = validateRequest(req.body);
      if (errors.length) {
        return res.status(400).json({ erro: 'validation', mensagem: errors[0], detalhes: errors });
      }
      const item = await store.criarSolicitacao(value);
      res.status(201).json({
        mensagem: 'Solicitacao recebida para analise.',
        data: { id: item.id, status: item.status }
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/interesses', formLimiter, async (req, res, next) => {
    try {
      const { errors, value } = validateInterest(req.body);
      if (errors.length) {
        return res.status(400).json({ erro: 'validation', mensagem: errors[0], detalhes: errors });
      }
      const animal = await store.buscarAnimalPorId(value.animalId);
      if (!animal || animal.status !== 'disponivel') {
        return res.status(400).json({
          erro: 'animal_unavailable',
          mensagem: 'Este animal nao esta disponivel para adocao.'
        });
      }
      const item = await store.criarInteresse(value, animal);
      res.status(201).json({
        mensagem: 'Interesse registrado. A equipe entrara em contato.',
        data: { id: item.id }
      });
    } catch (error) {
      next(error);
    }
  });

  // -----------------------------------------------------
  // AUTENTICACAO
  // -----------------------------------------------------
  app.post('/api/v1/auth/login', loginLimiter, async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().toLowerCase();
      const senha = String(req.body.senha || '');
      if (!email || !senha) {
        return res.status(400).json({ erro: 'validation', mensagem: 'Informe e-mail e senha.' });
      }

      const admin = await store.buscarAdminPorEmail(email);
      const valid = admin && admin.ativo && await bcrypt.compare(senha, admin.senhaHash);
      if (!valid) {
        return res.status(401).json({ erro: 'invalid_credentials', mensagem: 'E-mail ou senha invalidos.' });
      }

      await sessionRegenerate(req);
      req.session.admin = { id: admin.id, nome: admin.nome, email: admin.email };
      await sessionSave(req);
      await store.atualizarUltimoLogin(admin.id);
      await store.registrarLog(admin.id, 'login', 'Login administrativo realizado.', clientIp(req));

      const refreshed = await store.buscarAdminPorId(admin.id);
      res.json({ mensagem: 'Login realizado.', data: publicAdmin(refreshed) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v1/auth/logout', requireAdmin, async (req, res, next) => {
    try {
      const adminId = req.session.admin.id;
      await store.registrarLog(adminId, 'logout', 'Logout administrativo realizado.', clientIp(req));
      await sessionDestroy(req);
      res.json({ mensagem: 'Sessao encerrada.' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v1/auth/me', requireAdmin, async (req, res, next) => {
    try {
      const admin = await store.buscarAdminPorId(req.session.admin.id);
      if (!admin || !admin.ativo) {
        await sessionDestroy(req).catch(() => {});
        return res.status(401).json({ erro: 'unauthorized', mensagem: 'Sessao invalida.' });
      }
      res.json({ data: publicAdmin(admin) });
    } catch (error) {
      next(error);
    }
  });

  // -----------------------------------------------------
  // ADMIN
  // -----------------------------------------------------
  const adminRouter = express.Router();
  adminRouter.use(requireAdmin);

  adminRouter.get('/animais', async (_req, res, next) => {
    try {
      res.json({ data: await store.listarAnimais({ status: 'todos' }, { admin: true }) });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.post('/animais', async (req, res, next) => {
    try {
      const { errors, value } = validateAnimal(req.body, false);
      if (errors.length) {
        return res.status(400).json({ erro: 'validation', mensagem: errors[0], detalhes: errors });
      }
      const item = await store.criarAnimal(value);
      await store.registrarLog(req.session.admin.id, 'animal_criado', `Animal #${item.id} (${item.nome}) cadastrado.`, clientIp(req));
      res.status(201).json({ mensagem: 'Animal cadastrado.', data: item });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.patch('/animais/:id', async (req, res, next) => {
    try {
      const { errors, value } = validateAnimal(req.body, true);
      if (errors.length) {
        return res.status(400).json({ erro: 'validation', mensagem: errors[0], detalhes: errors });
      }
      const item = await store.atualizarAnimal(req.params.id, value);
      if (!item) {
        return res.status(404).json({ erro: 'not_found', mensagem: 'Animal nao encontrado.' });
      }
      await store.registrarLog(req.session.admin.id, 'animal_atualizado', `Animal #${item.id} (${item.nome}) atualizado.`, clientIp(req));
      res.json({ mensagem: 'Animal atualizado.', data: item });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.delete('/animais/:id', async (req, res, next) => {
    try {
      const animal = await store.buscarAnimalPorId(req.params.id);
      if (!animal) {
        return res.status(404).json({ erro: 'not_found', mensagem: 'Animal nao encontrado.' });
      }
      await store.removerAnimal(req.params.id);
      await store.registrarLog(req.session.admin.id, 'animal_removido', `Animal #${animal.id} (${animal.nome}) removido.`, clientIp(req));
      res.json({ mensagem: 'Animal removido.' });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.get('/solicitacoes', async (_req, res, next) => {
    try {
      res.json({ data: await store.listarSolicitacoes() });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.patch('/solicitacoes/:id', async (req, res, next) => {
    try {
      const status = String(req.body.status || '').trim();
      if (!['aprovada', 'recusada'].includes(status)) {
        return res.status(400).json({ erro: 'validation', mensagem: 'Status invalido.' });
      }

      const result = await store.atualizarStatusSolicitacao(
        req.params.id,
        status,
        req.session.admin.id
      );
      if (result.notFound) {
        return res.status(404).json({ erro: 'not_found', mensagem: 'Solicitacao nao encontrada.' });
      }
      if (result.conflict) {
        return res.status(409).json({
          erro: 'request_already_reviewed',
          mensagem: 'Esta solicitacao ja foi analisada.',
          data: result.data
        });
      }

      const extra = result.animalId ? ` Animal #${result.animalId} criado automaticamente.` : '';
      await store.registrarLog(
        req.session.admin.id,
        `solicitacao_${status}`,
        `Solicitacao #${req.params.id} marcada como ${status}.${extra}`,
        clientIp(req)
      );
      res.json({ mensagem: `Solicitacao ${status}.${extra}`, data: result.data });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.get('/interesses', async (_req, res, next) => {
    try {
      res.json({ data: await store.listarInteresses() });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.patch('/interesses/:id', async (req, res, next) => {
    try {
      const status = String(req.body.status || '').trim();
      if (!['novo', 'em_contato', 'concluido', 'arquivado'].includes(status)) {
        return res.status(400).json({ erro: 'validation', mensagem: 'Status invalido.' });
      }
      const item = await store.atualizarStatusInteresse(req.params.id, status);
      if (!item) {
        return res.status(404).json({ erro: 'not_found', mensagem: 'Interesse nao encontrado.' });
      }
      await store.registrarLog(req.session.admin.id, 'interesse_atualizado', `Interesse #${item.id} alterado para ${status}.`, clientIp(req));
      res.json({ mensagem: 'Interesse atualizado.', data: item });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.get('/logs', async (_req, res, next) => {
    try {
      res.json({ data: await store.listarLogs(100) });
    } catch (error) {
      next(error);
    }
  });

  adminRouter.patch('/perfil/senha', async (req, res, next) => {
    try {
      const atual = String(req.body.senhaAtual || '');
      const nova = String(req.body.novaSenha || '');
      if (!atual || !nova) {
        return res.status(400).json({ erro: 'validation', mensagem: 'Informe a senha atual e a nova senha.' });
      }
      if (nova.length < 10) {
        return res.status(400).json({ erro: 'validation', mensagem: 'A nova senha deve ter pelo menos 10 caracteres.' });
      }
      const admin = await store.buscarAdminPorId(req.session.admin.id);
      if (!admin || !(await bcrypt.compare(atual, admin.senhaHash))) {
        return res.status(400).json({ erro: 'invalid_password', mensagem: 'A senha atual esta incorreta.' });
      }
      const hash = await bcrypt.hash(nova, 12);
      await store.atualizarSenhaAdmin(admin.id, hash);
      await store.registrarLog(admin.id, 'senha_alterada', 'Senha administrativa alterada.', clientIp(req));
      res.json({ mensagem: 'Senha alterada com sucesso.' });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/admin', adminRouter);

  // -----------------------------------------------------
  // FRONTEND
  // -----------------------------------------------------
  app.use(express.static(PUBLIC_DIR, {
    extensions: ['html'],
    maxAge: IS_PRODUCTION ? '1h' : 0
  }));

  app.get('/adocao', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'adocao.html')));
  app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

  app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ erro: 'not_found', mensagem: 'Endpoint nao encontrado.' });
    }
    res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ erro: 'internal_error', mensagem: 'Ocorreu um erro interno.' });
  });
}

async function start() {
  const init = await initializeDatabase();
  const pool = init.pool || getPool();

  let sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (IS_PRODUCTION) {
      throw new Error('SESSION_SECRET e obrigatorio em producao.');
    }
    sessionSecret = 'pet-e-alegria-dev-session-secret-change-me';
    console.warn('SESSION_SECRET nao configurado. Usando chave apenas para desenvolvimento local.');
  }

  app.use(session({
    name: 'pet_admin_sid',
    secret: sessionSecret,
    store: new MySQLSessionStore(pool),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: IS_PRODUCTION,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));

  registerRoutes();

  app.listen(PORT, () => {
    console.log('');
    console.log('==============================================');
    console.log(` Pet e Alegria: http://localhost:${PORT}`);
    console.log(` Admin:         http://localhost:${PORT}/admin.html`);
    console.log(' Banco:         MySQL');
    console.log('==============================================');
    if (init.bootstrapAdmin) {
      console.log('');
      console.log('ADMINISTRADOR INICIAL CRIADO');
      console.log(`E-mail: ${init.bootstrapAdmin.email}`);
      console.log(`Senha temporaria: ${init.bootstrapAdmin.temporaryPassword}`);
      console.log('Entre no painel e altere a senha na aba Conta.');
      console.log('Esta senha aparece somente na criacao do primeiro admin.');
    }
    console.log('');
  });
}

start().catch((error) => {
  console.error('');
  console.error('Nao foi possivel iniciar o Pet e Alegria.');
  console.error(error.message);
  if (error.code) console.error(`Codigo: ${error.code}`);
  console.error('');
  console.error('Confirme se o MySQL portatil esta ligado e se o .env possui a senha correta.');
  process.exit(1);
});
