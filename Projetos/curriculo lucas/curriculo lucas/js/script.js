/* ============================================================
   LCODE — script.js
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {

  /* ---------- THEME TOGGLE ---------- */
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const savedTheme = localStorage_safe_get('lcode-theme');
  if (savedTheme) body.setAttribute('data-theme', savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = body.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    body.setAttribute('data-theme', current);
    localStorage_safe_set('lcode-theme', current);
  });

  function localStorage_safe_get(key){
    try { return window.localStorage.getItem(key); } catch(e){ return null; }
  }
  function localStorage_safe_set(key, val){
    try { window.localStorage.setItem(key, val); } catch(e){ /* ignore */ }
  }

  /* ---------- NAVBAR SCROLL STATE ---------- */
  const navbar = document.getElementById('navbar');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- MOBILE MENU ---------- */
  const burger = document.getElementById('burger');
  const mobileMenu = document.getElementById('mobileMenu');
  burger.addEventListener('click', () => {
    burger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
  });
  document.querySelectorAll('.mobile-menu a').forEach(a => {
    a.addEventListener('click', () => {
      burger.classList.remove('open');
      mobileMenu.classList.remove('open');
    });
  });

  /* ---------- ACTIVE NAV LINK ON SCROLL ---------- */
  const navLinks = document.querySelectorAll('.nav-link[data-nav]');
  const sections = [...document.querySelectorAll('main section[id], main[id]')];

  const sectionObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        const id = entry.target.getAttribute('id');
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

  sections.forEach(sec => sectionObserver.observe(sec));

  /* ---------- SCROLL REVEAL ---------- */
  const revealEls = document.querySelectorAll('[data-reveal]');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(el => revealObserver.observe(el));

  /* ---------- ANIMATED COUNTERS ---------- */
  const counters = document.querySelectorAll('.stat-number');
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting){
        animateCounter(entry.target);
        counterObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.6 });
  counters.forEach(c => counterObserver.observe(c));

  function animateCounter(el){
    const target = parseInt(el.getAttribute('data-count'), 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1400;
    const start = performance.now();

    function tick(now){
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(eased * target) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  /* ---------- TYPED ROLE EFFECT ---------- */
  const typedEl = document.getElementById('typedRole');
  const roles = [
    'Desenvolvedor Web Full Stack',
    'Fundador da LCODE',
    'Criador de APIs & Sistemas'
  ];
  let roleIndex = 0, charIndex = roles[0].length, deleting = false;

  function typeLoop(){
    const current = roles[roleIndex];
    if (!deleting){
      charIndex++;
      if (charIndex > current.length){
        deleting = true;
        setTimeout(typeLoop, 1800);
        return;
      }
    } else {
      charIndex--;
      if (charIndex < 0){
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        charIndex = 0;
      }
    }
    typedEl.textContent = current.slice(0, charIndex);
    setTimeout(typeLoop, deleting ? 35 : 55);
  }
  typedEl.textContent = roles[0];
  setTimeout(typeLoop, 2000);

  /* ---------- PARTICLES BACKGROUND ---------- */
  const canvas = document.getElementById('particles');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  function resizeCanvas(){
    const hero = canvas.parentElement;
    canvas.width = hero.offsetWidth * dpr;
    canvas.height = hero.offsetHeight * dpr;
    canvas.style.width = hero.offsetWidth + 'px';
    canvas.style.height = hero.offsetHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles(){
    const count = window.innerWidth < 700 ? 26 : 55;
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      r: Math.random() * 1.8 + 0.6,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      o: Math.random() * 0.5 + 0.15
    }));
  }

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawParticles(){
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = canvas.offsetWidth;
      if (p.x > canvas.offsetWidth) p.x = 0;
      if (p.y < 0) p.y = canvas.offsetHeight;
      if (p.y > canvas.offsetHeight) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56,189,248,${p.o})`;
      ctx.fill();
    });
    if (!prefersReducedMotion) requestAnimationFrame(drawParticles);
  }

  if (canvas){
    resizeCanvas();
    initParticles();
    drawParticles();
    window.addEventListener('resize', () => { resizeCanvas(); initParticles(); });
  }

  /* ---------- TECH DATA + GRID + MODAL ---------- */
  const techData = [
    { name: 'HTML5', icon: 'fa-brands fa-html5', level: 'Avançado',
      desc: 'HTML5 é utilizado para criar a estrutura moderna e semântica das páginas web.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'CSS3', icon: 'fa-brands fa-css3-alt', level: 'Avançado',
      desc: 'CSS3 dá vida ao layout, com responsividade, animações e efeitos visuais modernos.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'JavaScript', icon: 'fa-brands fa-js', level: 'Avançado',
      desc: 'JavaScript adiciona interatividade, lógica de front-end e integração com APIs.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'Node.js', icon: 'fa-brands fa-node-js', level: 'Intermediário/Avançado',
      desc: 'Ambiente de execução usado para construir o back-end e as APIs dos sistemas.',
      projects: ['Clínica Vida+', 'Pet e Alegria'] },
    { name: 'Express.js', icon: 'fa-solid fa-server', level: 'Intermediário',
      desc: 'Framework para Node.js utilizado na criação de rotas e APIs REST.',
      projects: ['Clínica Vida+', 'Pet e Alegria'] },
    { name: 'MySQL', icon: 'fa-solid fa-database', level: 'Intermediário/Avançado',
      desc: 'Banco de dados relacional utilizado para armazenar e organizar informações dos sistemas.',
      projects: ['Clínica Vida+', 'Pet e Alegria'] },
    { name: 'Git', icon: 'fa-brands fa-git-alt', level: 'Avançado',
      desc: 'Controle de versão utilizado no dia a dia para gerenciar o histórico de código.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'GitHub', icon: 'fa-brands fa-github', level: 'Avançado',
      desc: 'Plataforma para hospedar repositórios, colaborar e versionar os projetos.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'Render', icon: 'fa-solid fa-cloud', level: 'Intermediário',
      desc: 'Plataforma de hospedagem em nuvem utilizada para colocar sistemas full stack no ar.',
      projects: ['Clínica Vida+', 'Pet e Alegria'] },
    { name: 'Cloudflare Pages', icon: 'fa-brands fa-cloudflare', level: 'Intermediário',
      desc: 'Serviço de hospedagem para sites estáticos, rápido e com CDN global.',
      projects: ['Pão Quente'] },
    { name: 'Aiven', icon: 'fa-solid fa-server', level: 'Intermediário',
      desc: 'Serviço de banco de dados em nuvem gerenciado, utilizado para hospedar o MySQL.',
      projects: ['Clínica Vida+'] },
    { name: 'VS Code', icon: 'fa-solid fa-code', level: 'Avançado',
      desc: 'Editor de código principal utilizado para desenvolver todos os projetos.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] },
    { name: 'npm', icon: 'fa-brands fa-npm', level: 'Avançado',
      desc: 'Gerenciador de pacotes utilizado para instalar e organizar dependências dos projetos Node.js.',
      projects: ['Clínica Vida+', 'Pet e Alegria'] },
    { name: 'ChatGPT / OpenAI', icon: 'fa-solid fa-robot', level: 'Uso avançado como ferramenta',
      desc: 'Utilizado como apoio para produtividade, pesquisa técnica e aceleração do desenvolvimento.',
      projects: ['Clínica Vida+', 'Pet e Alegria', 'Pão Quente'] }
  ];

  const techGrid = document.getElementById('techGrid');
  techData.forEach((tech, i) => {
    const item = document.createElement('button');
    item.className = 'tech-item';
    item.type = 'button';
    item.innerHTML = `<i class="${tech.icon}"></i><span>${tech.name}</span>`;
    item.addEventListener('click', () => openTechModal(i));
    techGrid.appendChild(item);
  });

  const techModalOverlay = document.getElementById('techModalOverlay');
  const modalIcon = document.getElementById('modalIcon');
  const modalName = document.getElementById('modalName');
  const modalDesc = document.getElementById('modalDesc');
  const modalLevel = document.getElementById('modalLevel');
  const modalProjects = document.getElementById('modalProjects');
  const modalClose = document.getElementById('modalClose');

  function openTechModal(index){
    const tech = techData[index];
    modalIcon.innerHTML = `<i class="${tech.icon}"></i>`;
    modalName.textContent = tech.name;
    modalDesc.textContent = tech.desc;
    modalLevel.textContent = tech.level;
    modalProjects.innerHTML = tech.projects.map(p => `<li>${p}</li>`).join('');
    techModalOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeTechModal(){
    techModalOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }
  modalClose.addEventListener('click', closeTechModal);
  techModalOverlay.addEventListener('click', (e) => {
    if (e.target === techModalOverlay) closeTechModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTechModal();
  });

});
