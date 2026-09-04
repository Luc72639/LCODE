(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Navbar + back-to-top on scroll
  const navbar = $('#navbar');
  const backTop = $('#backTop');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', scrollY > 20);
    backTop.classList.toggle('visible', scrollY > 600);
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // Theme toggle (persisted)
  const root = document.documentElement;
  const themeToggle = $('#themeToggle');
  if (localStorage.getItem('lcode-theme') === 'light') root.classList.add('light');
  const updateThemeIcon = () => {
    themeToggle.innerHTML = root.classList.contains('light')
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  };
  updateThemeIcon();
  themeToggle.addEventListener('click', () => {
    root.classList.toggle('light');
    localStorage.setItem('lcode-theme', root.classList.contains('light') ? 'light' : 'dark');
    updateThemeIcon();
  });

  // Mobile menu
  const burger = $('#burger'), mobile = $('#mobileMenu'), backdrop = $('#mobileBackdrop'), closeBtn = $('#mobileClose');
  const setMenu = (open) => {
    mobile.classList.toggle('open', open);
    backdrop.classList.toggle('open', open);
    burger.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    mobile.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!mobile.classList.contains('open')));
  closeBtn.addEventListener('click', () => setMenu(false));
  backdrop.addEventListener('click', () => setMenu(false));
  $$('.mobile-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // Active nav link on scroll
  const navLinks = $$('#desktopNav a');
  const sections = $$('main section[id]');
  const navObserver = new IntersectionObserver(
    (entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
    }),
    { rootMargin: '-45% 0px -45% 0px' }
  );
  sections.forEach((s) => navObserver.observe(s));

  // Stat counters (hero only — the single deliberate motion moment besides the hero card entrance)
  const countEls = $$('[data-count]');
  const animateCount = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const duration = 900;
    const start = performance.now();
    const frame = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  };
  const counterObserver = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { animateCount(e.target); counterObserver.unobserve(e.target); }
    }),
    { threshold: 0.6 }
  );
  countEls.forEach((el) => counterObserver.observe(el));

  // Contact form -> prefilled WhatsApp message (static site, no backend)
  const contactForm = $('#contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = $('[name="nome"]', contactForm).value.trim();
      const email = $('[name="email"]', contactForm).value.trim();
      const mensagem = $('[name="mensagem"]', contactForm).value.trim();
      const text = `Olá! Meu nome é ${nome} (${email}).\n\n${mensagem}`;
      window.open(`https://wa.me/5554999833483?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });
  }
})();
