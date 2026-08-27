const loginView = document.querySelector('[data-login-view]');
const appView = document.querySelector('[data-admin-view]');
const loginForm = document.getElementById('adminLoginForm');
const loginNotice = document.querySelector('[data-login-notice]');
const tabs = [...document.querySelectorAll('[data-admin-tab]')];
const panels = [...document.querySelectorAll('[data-admin-panel]')];
let currentAdmin = null;
let cache = { animais: [], solicitacoes: [], interesses: [], logs: [] };
const editAnimalModal = document.getElementById('editAnimalModal');
const editAnimalForm = document.getElementById('editAnimalForm');

function openEditAnimal(animal) {
  const fields = editAnimalForm.elements;
  fields.id.value = animal.id;
  fields.nome.value = animal.nome || '';
  fields.tipo.value = animal.tipo || 'cachorro';
  fields.raca.value = animal.raca || '';
  fields.idade.value = animal.idade || '';
  fields.sexo.value = animal.sexo || 'macho';
  fields.porte.value = animal.porte || 'pequeno';
  fields.status.value = animal.status || 'disponivel';
  fields.descricao.value = animal.descricao || '';
  fields.imagemUrl.value = animal.imagemUrl || '';
  fields.vacinado.checked = Boolean(animal.vacinado);
  fields.castrado.checked = Boolean(animal.castrado);
  editAnimalForm.querySelector('[data-edit-notice]').classList.add('hidden');
  editAnimalModal.classList.add('open');
  document.body.classList.add('modal-open');
}

function closeEditAnimal() {
  editAnimalModal.classList.remove('open');
  document.body.classList.remove('modal-open');
}

document.querySelectorAll('[data-close-edit-animal]').forEach((button) => button.addEventListener('click', closeEditAnimal));
editAnimalModal.addEventListener('click', (event) => { if (event.target === editAnimalModal) closeEditAnimal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && editAnimalModal.classList.contains('open')) closeEditAnimal(); });


async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin();
    throw new Error(payload.mensagem || 'Sua sessão expirou. Entre novamente.');
  }
  if (!response.ok) throw new Error(payload.mensagem || 'Erro na operação.');
  return payload;
}

function showLogin() {
  appView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

function showApp(admin) {
  currentAdmin = admin;
  loginView.classList.add('hidden');
  appView.classList.remove('hidden');
  document.querySelector('[data-admin-name]').textContent = admin.nome;
  document.querySelector('[data-account-name]').textContent = admin.nome;
  document.querySelector('[data-account-email]').textContent = admin.email;
  loadAll();
}

async function checkSession() {
  try {
    const payload = await api('/api/v1/auth/me');
    showApp(payload.data);
  } catch {
    showLogin();
  }
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginNotice.className = 'notice info';
  loginNotice.textContent = 'Validando acesso...';
  loginNotice.classList.remove('hidden');
  const form = new FormData(loginForm);
  try {
    const payload = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: form.get('email'), senha: form.get('senha') })
    });
    loginForm.reset();
    loginNotice.classList.add('hidden');
    showApp(payload.data);
  } catch (error) {
    loginNotice.className = 'notice error';
    loginNotice.textContent = error.message;
  }
});

document.querySelector('[data-logout]').addEventListener('click', async () => {
  try { await api('/api/v1/auth/logout', { method: 'POST' }); } catch {}
  showLogin();
});

tabs.forEach((tab) => tab.addEventListener('click', () => {
  tabs.forEach((item) => item.classList.toggle('active', item === tab));
  panels.forEach((panel) => panel.classList.toggle('hidden', panel.dataset.adminPanel !== tab.dataset.adminTab));
}));

async function loadAll() {
  try {
    const [animals, requests, interests, logs] = await Promise.all([
      api('/api/v1/admin/animais'),
      api('/api/v1/admin/solicitacoes'),
      api('/api/v1/admin/interesses'),
      api('/api/v1/admin/logs')
    ]);
    cache.animais = animals.data;
    cache.solicitacoes = requests.data;
    cache.interesses = interests.data;
    cache.logs = logs.data;
    renderStats();
    renderAnimals();
    renderRequests();
    renderInterests();
    renderLogs();
  } catch (error) {
    console.error(error);
  }
}

function renderStats() {
  document.querySelector('[data-stat-available]').textContent = cache.animais.filter((a) => a.status === 'disponivel').length;
  document.querySelector('[data-stat-requests]').textContent = cache.solicitacoes.filter((r) => r.status === 'pendente').length;
  document.querySelector('[data-stat-interests]').textContent = cache.interesses.filter((i) => i.status === 'novo').length;
  document.querySelector('[data-stat-adopted]').textContent = cache.animais.filter((a) => a.status === 'adotado').length;
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text ?? '—';
  return td;
}

function statusSpan(status) {
  const span = document.createElement('span');
  span.className = `status ${status || ''}`;
  span.textContent = (status || '—').replace('_', ' ');
  return span;
}

function actionButton(label, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', handler);
  return button;
}

function renderAnimals() {
  const body = document.querySelector('[data-animal-rows]');
  body.innerHTML = '';
  cache.animais.forEach((animal) => {
    const tr = document.createElement('tr');
    tr.append(cell(animal.nome), cell(animal.tipo), cell(animal.raca), cell(animal.idade));
    const st = document.createElement('td'); st.append(statusSpan(animal.status)); tr.append(st);
    const actions = document.createElement('td'); actions.className = 'admin-actions';
    actions.append(
      actionButton('Editar', () => openEditAnimal(animal)),
      actionButton(animal.status === 'adotado' ? 'Reabrir' : 'Marcar adotado', async () => {
        await updateAnimal(animal.id, { status: animal.status === 'adotado' ? 'disponivel' : 'adotado' });
      }),
      actionButton(animal.status === 'indisponivel' ? 'Disponibilizar' : 'Indisponível', async () => {
        await updateAnimal(animal.id, { status: animal.status === 'indisponivel' ? 'disponivel' : 'indisponivel' });
      }),
      actionButton('Remover', async () => {
        if (confirm(`Remover ${animal.nome}?`)) {
          await api(`/api/v1/admin/animais/${animal.id}`, { method: 'DELETE' });
          await loadAll();
        }
      })
    );
    tr.append(actions);
    body.append(tr);
  });
}

async function updateAnimal(id, payload) {
  await api(`/api/v1/admin/animais/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  await loadAll();
}

function renderRequests() {
  const body = document.querySelector('[data-request-rows]');
  body.innerHTML = '';
  cache.solicitacoes.forEach((item) => {
    const tr = document.createElement('tr');
    tr.append(cell(item.nomeAnimal), cell(item.tipo), cell(item.responsavel), cell(item.telefone));
    const st = document.createElement('td'); st.append(statusSpan(item.status)); tr.append(st);
    const actions = document.createElement('td'); actions.className = 'admin-actions';
    if (item.status === 'pendente') {
      actions.append(
        actionButton('Aprovar', () => updateRequest(item.id, 'aprovada')),
        actionButton('Recusar', () => updateRequest(item.id, 'recusada'))
      );
    } else {
      actions.textContent = item.animalIdCriado ? `Animal #${item.animalIdCriado}` : 'Analisada';
    }
    tr.append(actions);
    body.append(tr);
  });
}

async function updateRequest(id, status) {
  await api(`/api/v1/admin/solicitacoes/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  await loadAll();
}

function renderInterests() {
  const body = document.querySelector('[data-interest-rows]');
  body.innerHTML = '';
  cache.interesses.forEach((item) => {
    const tr = document.createElement('tr');
    tr.append(cell(item.animalNome), cell(item.nome), cell(item.telefone), cell(item.email), cell(item.mensagem));
    const st = document.createElement('td'); st.append(statusSpan(item.status)); tr.append(st);
    const actions = document.createElement('td'); actions.className = 'admin-actions';
    actions.append(
      actionButton('Em contato', () => updateInterest(item.id, 'em_contato')),
      actionButton('Concluir', () => updateInterest(item.id, 'concluido')),
      actionButton('Arquivar', () => updateInterest(item.id, 'arquivado'))
    );
    tr.append(actions);
    body.append(tr);
  });
}

async function updateInterest(id, status) {
  await api(`/api/v1/admin/interesses/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  await loadAll();
}

function renderLogs() {
  const body = document.querySelector('[data-log-rows]');
  body.innerHTML = '';
  cache.logs.forEach((item) => {
    const date = item.criadoEm ? new Date(item.criadoEm).toLocaleString('pt-BR') : '—';
    const tr = document.createElement('tr');
    tr.append(cell(date), cell(item.adminNome), cell(item.acao.replaceAll('_', ' ')), cell(item.detalhes));
    body.append(tr);
  });
}

document.getElementById('adminAnimalForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());
  payload.vacinado = fd.get('vacinado') === 'on';
  payload.castrado = fd.get('castrado') === 'on';
  const notice = form.querySelector('[data-form-notice]');
  try {
    await api('/api/v1/admin/animais', { method: 'POST', body: JSON.stringify(payload) });
    notice.className = 'notice success';
    notice.textContent = 'Animal cadastrado.';
    notice.classList.remove('hidden');
    form.reset();
    await loadAll();
  } catch (error) {
    notice.className = 'notice error';
    notice.textContent = error.message;
    notice.classList.remove('hidden');
  }
});

document.getElementById('changePasswordForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const notice = form.querySelector('[data-password-notice]');
  try {
    const payload = await api('/api/v1/admin/perfil/senha', {
      method: 'PATCH',
      body: JSON.stringify({ senhaAtual: fd.get('senhaAtual'), novaSenha: fd.get('novaSenha') })
    });
    notice.className = 'notice success';
    notice.textContent = payload.mensagem;
    notice.classList.remove('hidden');
    form.reset();
    await loadAll();
  } catch (error) {
    notice.className = 'notice error';
    notice.textContent = error.message;
    notice.classList.remove('hidden');
  }
});

editAnimalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const fd = new FormData(form);
  const id = fd.get('id');
  const payload = Object.fromEntries(fd.entries());
  delete payload.id;
  payload.vacinado = fd.get('vacinado') === 'on';
  payload.castrado = fd.get('castrado') === 'on';
  const notice = form.querySelector('[data-edit-notice]');
  try {
    await api(`/api/v1/admin/animais/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    notice.className = 'notice success';
    notice.textContent = 'Animal atualizado com sucesso.';
    notice.classList.remove('hidden');
    await loadAll();
    setTimeout(closeEditAnimal, 450);
  } catch (error) {
    notice.className = 'notice error';
    notice.textContent = error.message;
    notice.classList.remove('hidden');
  }
});

checkSession();
