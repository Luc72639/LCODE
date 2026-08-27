(async function () {
  const grid = document.querySelector('[data-featured-animals]');
  if (!grid) return;
  try {
    const response = await fetch('/api/v1/animais?status=disponivel');
    if (!response.ok) throw new Error('Falha ao carregar animais');
    const payload = await response.json();
    grid.innerHTML = '';
    payload.data.slice(0, 4).forEach((animal) => {
      grid.appendChild(window.PetUI.createAnimalCard(animal, () => { location.href = `/adocao.html#animal-${animal.id}`; }));
    });
  } catch {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">A lista de adoção estará disponível quando a API estiver online.</div>';
  }
})();
