const menuButton = document.querySelector('[data-menu-toggle]');
const menu = document.querySelector('[data-menu]');
if (menuButton && menu) {
  menuButton.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
}

document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

function animalIcon(type = 'cachorro') {
  const isCat = type === 'gato';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    ${isCat ? '<path d="M4.5 8.8 4 4l4 2.1A8 8 0 0 1 16 6L20 4l-.5 4.8A8 8 0 1 1 4.5 8.8Z"/><path d="M9 13h.01M15 13h.01M9.5 16c1.5 1 3.5 1 5 0"/>' : '<path d="M7.5 9.5 5 5.5C3.5 6.5 3 8 3.5 10.5M16.5 9.5 19 5.5c1.5 1 2 2.5 1.5 5M7 10.5c1.5-2 8.5-2 10 0 2 2.8 1.5 8-5 8s-7-5.2-5-8Z"/><path d="M9 13h.01M15 13h.01M10 16h4"/>'}
  </svg>`;
}

function createAnimalCard(animal, onOpen) {
  const card = document.createElement('article');
  card.className = 'animal-card';
  const photo = document.createElement('div');
  photo.className = 'animal-photo';
  if (animal.imagemUrl) {
    const img = document.createElement('img');
    img.src = animal.imagemUrl;
    img.alt = `Foto de ${animal.nome}`;
    img.loading = 'lazy';
    photo.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'animal-placeholder';
    placeholder.innerHTML = animalIcon(animal.tipo);
    photo.appendChild(placeholder);
  }

  const body = document.createElement('div');
  body.className = 'animal-body';
  const title = document.createElement('h3');
  title.textContent = animal.nome;
  const subtitle = document.createElement('p');
  subtitle.textContent = `${animal.raca} • ${animal.idade}`;
  const meta = document.createElement('div');
  meta.className = 'animal-meta';
  [animal.tipo === 'gato' ? 'Gato' : 'Cachorro', animal.sexo ? (animal.sexo === 'femea' ? 'Fêmea' : 'Macho') : '', animal.porte ? `Porte ${animal.porte}` : ''].filter(Boolean).forEach((label) => {
    const pill = document.createElement('span');
    pill.className = 'pill';
    pill.textContent = label;
    meta.appendChild(pill);
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  const button = document.createElement('button');
  button.className = 'btn btn-primary btn-small';
  button.type = 'button';
  button.textContent = 'Conhecer';
  button.addEventListener('click', () => onOpen?.(animal));
  actions.appendChild(button);
  body.append(title, subtitle, meta, actions);
  card.append(photo, body);
  return card;
}

window.PetUI = { animalIcon, createAnimalCard };
