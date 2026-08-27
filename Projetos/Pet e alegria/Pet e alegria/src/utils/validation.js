const allowed = {
  tipo: ['cachorro', 'gato'],
  sexo: ['macho', 'femea'],
  porte: ['pequeno', 'medio', 'grande'],
  status: ['disponivel', 'adotado', 'indisponivel']
};

function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function booleanValue(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function validEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validImageUrl(value) {
  if (!value) return true;
  if (value.startsWith('/assets/')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateAnimal(body, partial = false) {
  const output = {};
  const errors = [];
  const required = ['nome', 'tipo', 'raca', 'idade', 'sexo', 'porte'];

  for (const field of required) {
    if (!partial || body[field] !== undefined) {
      const value = text(body[field], 120);
      if (!value) errors.push(`${field} e obrigatorio.`);
      else output[field] = value;
    }
  }

  for (const field of ['tipo', 'sexo', 'porte']) {
    if (output[field] && !allowed[field].includes(output[field])) {
      errors.push(`${field} possui um valor invalido.`);
    }
  }

  if (!partial || body.status !== undefined) {
    const status = text(body.status || 'disponivel', 30);
    if (!allowed.status.includes(status)) errors.push('status possui um valor invalido.');
    else output.status = status;
  }

  if (body.descricao !== undefined || !partial) output.descricao = text(body.descricao, 1200);
  if (body.imagemUrl !== undefined || !partial) {
    output.imagemUrl = text(body.imagemUrl, 1200) || null;
    if (!validImageUrl(output.imagemUrl)) errors.push('imagemUrl deve usar HTTPS.');
  }
  if (body.vacinado !== undefined || !partial) output.vacinado = booleanValue(body.vacinado);
  if (body.castrado !== undefined || !partial) output.castrado = booleanValue(body.castrado);

  return { errors, value: output };
}

function validateRequest(body) {
  const fields = {
    nomeAnimal: 120,
    tipo: 30,
    raca: 120,
    idade: 60,
    sexo: 30,
    porte: 30,
    descricao: 1200,
    responsavel: 160,
    telefone: 40,
    email: 180,
    imagemUrl: 1200
  };
  const value = {};
  for (const [key, max] of Object.entries(fields)) value[key] = text(body[key], max);

  const errors = [];
  for (const field of ['nomeAnimal', 'tipo', 'idade', 'responsavel', 'telefone']) {
    if (!value[field]) errors.push(`${field} e obrigatorio.`);
  }
  if (value.tipo && !allowed.tipo.includes(value.tipo)) errors.push('tipo invalido.');
  if (value.sexo && !allowed.sexo.includes(value.sexo)) errors.push('sexo invalido.');
  if (value.porte && !allowed.porte.includes(value.porte)) errors.push('porte invalido.');
  if (!validEmail(value.email)) errors.push('e-mail invalido.');
  if (!validImageUrl(value.imagemUrl)) errors.push('imagemUrl deve usar HTTPS.');

  value.status = 'pendente';
  return { errors, value };
}

function validateInterest(body) {
  const value = {
    animalId: Number(body.animalId),
    nome: text(body.nome, 160),
    telefone: text(body.telefone, 40),
    email: text(body.email, 180),
    mensagem: text(body.mensagem, 1200),
    status: 'novo'
  };
  const errors = [];
  if (!Number.isInteger(value.animalId) || value.animalId <= 0) errors.push('animalId e obrigatorio.');
  if (!value.nome) errors.push('nome e obrigatorio.');
  if (!value.telefone) errors.push('telefone e obrigatorio.');
  if (!validEmail(value.email)) errors.push('e-mail invalido.');
  return { errors, value };
}

module.exports = { validateAnimal, validateRequest, validateInterest };
