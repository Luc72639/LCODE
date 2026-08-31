(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const navbar = $('#navbar');
  const backTop = $('#backTop');
  const onScroll = () => {
    navbar.classList.toggle('scrolled', scrollY > 30);
    backTop.classList.toggle('visible', scrollY > 600);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  backTop.addEventListener('click', () => scrollTo({ top: 0, behavior: 'smooth' }));

  // Theme
  const root = document.documentElement;
  const themeToggle = $('#themeToggle');
  const savedTheme = localStorage.getItem('lcode-theme');
  if (savedTheme === 'light') root.classList.add('light');
  const updateThemeIcon = () => themeToggle.innerHTML = root.classList.contains('light') ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
  updateThemeIcon();
  themeToggle.addEventListener('click', () => {
    root.classList.toggle('light');
    localStorage.setItem('lcode-theme', root.classList.contains('light') ? 'light' : 'dark');
    updateThemeIcon();
  });

  // Mobile menu
  const burger = $('#burger'), mobile = $('#mobileMenu'), backdrop = $('#mobileBackdrop'), close = $('#mobileClose');
  const setMenu = open => {
    mobile.classList.toggle('open', open); backdrop.classList.toggle('open', open);
    burger.classList.toggle('open', open); burger.setAttribute('aria-expanded', String(open)); mobile.setAttribute('aria-hidden', String(!open));
    document.body.style.overflow = open ? 'hidden' : '';
  };
  burger.addEventListener('click', () => setMenu(!mobile.classList.contains('open')));
  close.addEventListener('click', () => setMenu(false)); backdrop.addEventListener('click', () => setMenu(false));
  $$('.mobile-menu a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') { setMenu(false); closeModal(); } });

  // Active nav
  const navLinks = $$('#desktopNav a');
  const sections = $$('main section[id]');
  const navObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
  }), { rootMargin: '-45% 0px -45% 0px' });
  sections.forEach(s => navObserver.observe(s));

  // Reveal
  const revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('in-view'); revealObserver.unobserve(entry.target); }
  }), { threshold: .12 });
  $$('.reveal').forEach(el => revealObserver.observe(el));

  // Typing
  const typed = $('#typedRole');
  const roles = ['sites', 'sistemas personalizados', 'APIs integradas', 'currículos online'];
  let ri = 0, ci = roles[0].length, deleting = true;
  const type = () => {
    const word = roles[ri];
    if (deleting) { ci--; if (ci <= 0) { deleting = false; ri = (ri + 1) % roles.length; ci = 0; } }
    else { ci++; if (ci >= roles[ri].length) { ci = roles[ri].length; deleting = true; } }
    typed.textContent = roles[ri].slice(0, ci);
    setTimeout(type, deleting ? 42 : 65);
  };
  setTimeout(type, 1800);

  // Counters
  const countEls = $$('[data-count]');
  const animateCount = el => {
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || '', duration = 1100, start = performance.now();
    const frame = now => { const p = Math.min((now - start) / duration, 1), eased = 1 - Math.pow(1 - p, 3); el.textContent = Math.round(target * eased) + suffix; if (p < 1) requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  };
  const counterObserver = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); counterObserver.unobserve(e.target); } }), { threshold: .7 });
  countEls.forEach(el => counterObserver.observe(el));

  // Particle canvas
  const canvas = $('#particles'), ctx = canvas.getContext('2d');
  let particles = [], mouse = { x:-9999, y:-9999 };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function resizeCanvas(){ canvas.width=innerWidth*devicePixelRatio; canvas.height=innerHeight*devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0); }
  function initParticles(){ particles = Array.from({length: Math.min(55, Math.floor(innerWidth/25))}, () => ({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25,r:Math.random()*1.4+.4})); }
  function drawParticles(){ if(reduced) return; ctx.clearRect(0,0,innerWidth,innerHeight); const dark=!root.classList.contains('light'); particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>innerWidth)p.vx*=-1;if(p.y<0||p.y>innerHeight)p.vy*=-1; const dx=p.x-mouse.x,dy=p.y-mouse.y,dist=Math.hypot(dx,dy);if(dist<130){p.x+=dx/dist*.12;p.y+=dy/dist*.12;}ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fillStyle=dark?'rgba(0,194,255,.42)':'rgba(0,102,255,.2)';ctx.fill();}); for(let i=0;i<particles.length;i++){for(let j=i+1;j<particles.length;j++){const a=particles[i],b=particles[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<105){ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=dark?`rgba(0,194,255,${.08*(1-d/105)})`:`rgba(0,102,255,${.05*(1-d/105)})`;ctx.stroke();}}}requestAnimationFrame(drawParticles); }
  addEventListener('resize',()=>{resizeCanvas();initParticles();}); addEventListener('pointermove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;}); resizeCanvas();initParticles();drawParticles();

  // Mouse glow
  const glow=$('.cursor-glow'); addEventListener('pointermove',e=>{glow.style.left=e.clientX+'px';glow.style.top=e.clientY+'px';},{passive:true});
})();
