const state = { animais: [], tipo: 'todos', sexo: '', porte: '', q: '' };
const grid = document.querySelector('[data-animal-grid]');
const empty = document.querySelector('[data-empty]');
const search = document.querySelector('[data-search]');
const sex = document.querySelector('[data-sex]');
const size = document.querySelector('[data-size]');
const chips = [...document.querySelectorAll('[data-type-filter]')];
const detailModal = document.getElementById('animalModal');
const requestModal = document.getElementById('requestModal');
const interestModal = document.getElementById('interestModal');
let selectedAnimal = null;

function label(value) { return value ? value.charAt(0).toUpperCase() + value.slice(1) : '—'; }

async function loadAnimals() {
  grid.innerHTML = '<div class="loading" style="grid-column:1/-1">Carregando animais disponíveis...</div>';
  try {
    const response = await fetch('/api/v1/animais?status=disponivel');
    if (!response.ok) throw new Error();
    const payload = await response.json();
    state.animais = payload.data;
    render();
    const hashId = location.hash.startsWith('#animal-') ? location.hash.replace('#animal-', '') : null;
    if (hashId) {
      const animal = state.animais.find((a) => String(a.id) === hashId);
      if (animal) openDetail(animal);
    }
  } catch {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    empty.textContent = 'Não foi possível carregar os animais. Verifique se a API está online.';
  }
}

function render() {
  const query = state.q.toLowerCase();
  const filtered = state.animais.filter((animal) => {
    if (state.tipo !== 'todos' && animal.tipo !== state.tipo) return false;
    if (state.sexo && animal.sexo !== state.sexo) return false;
    if (state.porte && animal.porte !== state.porte) return false;
    if (query && ![animal.nome, animal.raca, animal.descricao].some((v) => String(v || '').toLowerCase().includes(query))) return false;
    return true;
  });
  grid.innerHTML = '';
  empty.classList.toggle('hidden', filtered.length > 0);
  if (!filtered.length) empty.textContent = 'Nenhum animal encontrado com estes filtros.';
  filtered.forEach((animal) => grid.appendChild(window.PetUI.createAnimalCard(animal, openDetail)));
}

function openModal(modal) { modal.classList.add('open'); document.body.classList.add('modal-open'); }
function closeModal(modal) { modal.classList.remove('open'); document.body.classList.remove('modal-open'); }

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => closeModal(button.closest('.modal')));
});
document.querySelectorAll('.modal').forEach((modal) => modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(modal); }));

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.modal.open').forEach(closeModal); });

function openDetail(animal) {
  selectedAnimal = animal;
  document.querySelector('[data-detail-name]').textContent = animal.nome;
  document.querySelector('[data-detail-subtitle]').textContent = `${animal.raca} • ${animal.idade}`;
  document.querySelector('[data-detail-description]').textContent = animal.descricao || 'Este animal está procurando uma nova família.';
  document.querySelector('[data-detail-sex]').textContent = label(animal.sexo);
  document.querySelector('[data-detail-size]').textContent = label(animal.porte);
  document.querySelector('[data-detail-vaccine]').textContent = animal.vacinado ? 'Sim' : 'Não informado';
  document.querySelector('[data-detail-neutered]').textContent = animal.castrado ? 'Sim' : 'Não informado';
  const photo = document.querySelector('[data-detail-photo]');
  photo.innerHTML = '';
  if (animal.imagemUrl) {
    const img = document.createElement('img'); img.src = animal.imagemUrl; img.alt = `Foto de ${animal.nome}`; photo.appendChild(img);
  } else {
    const placeholder = document.createElement('div'); placeholder.className = 'animal-placeholder'; placeholder.innerHTML = window.PetUI.animalIcon(animal.tipo); photo.appendChild(placeholder);
  }
  history.replaceState(null, '', `#animal-${animal.id}`);
  openModal(detailModal);
}

document.querySelector('[data-interest-button]').addEventListener('click', () => {
  closeModal(detailModal);
  document.querySelector('[data-interest-animal]').textContent = selectedAnimal?.nome || 'este animal';
  openModal(interestModal);
});

document.querySelector('[data-open-request]').addEventListener('click', () => openModal(requestModal));

chips.forEach((chip) => chip.addEventListener('click', () => {
  chips.forEach((c) => c.classList.remove('active'));
  chip.classList.add('active');
  state.tipo = chip.dataset.typeFilter;
  render();
}));
search.addEventListener('input', () => { state.q = search.value.trim(); render(); });
sex.addEventListener('change', () => { state.sexo = sex.value; render(); });
size.addEventListener('change', () => { state.porte = size.value; render(); });

async function submitJson(form, endpoint, buildPayload, successText) {
  const notice = form.querySelector('[data-form-notice]');
  notice.className = 'notice info'; notice.textContent = 'Enviando...'; notice.classList.remove('hidden');
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(buildPayload(new FormData(form))) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.mensagem || 'Não foi possível enviar.');
    notice.className = 'notice success'; notice.textContent = successText;
    form.reset();
  } catch (err) {
    notice.className = 'notice error'; notice.textContent = err.message;
  }
}

document.getElementById('requestForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitJson(e.currentTarget, '/api/v1/solicitacoes', (fd) => Object.fromEntries(fd.entries()), 'Solicitação recebida. Ela ficará pendente até análise da equipe.');
});

document.getElementById('interestForm').addEventListener('submit', (e) => {
  e.preventDefault();
  submitJson(e.currentTarget, '/api/v1/interesses', (fd) => ({ ...Object.fromEntries(fd.entries()), animalId: selectedAnimal?.id }), `Interesse registrado. A equipe poderá entrar em contato sobre ${selectedAnimal?.nome || 'o animal'}.`);
});

loadAnimals();
