function requireAdmin(req, res, next) {
  if (!req.session?.admin?.id) {
    return res.status(401).json({
      erro: 'unauthorized',
      mensagem: 'Faca login para acessar a administracao.'
    });
  }
  next();
}

module.exports = requireAdmin;
