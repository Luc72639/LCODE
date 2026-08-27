(() => {
    const header = document.querySelector('.site-header');
    const nav = document.querySelector('.main-nav');
    const toggle = document.querySelector('.nav-toggle');

    const updateHeader = () => {
        if (header) header.classList.toggle('scrolled', window.scrollY > 8);
    };

    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });

    if (toggle && nav) {
        toggle.addEventListener('click', () => {
            const open = !nav.classList.contains('open');
            nav.classList.toggle('open', open);
            toggle.setAttribute('aria-expanded', String(open));
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });

        document.addEventListener('click', (event) => {
            if (!nav.classList.contains('open')) return;
            if (nav.contains(event.target) || toggle.contains(event.target)) return;
            nav.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    }

    const year = document.querySelector('[data-current-year]');
    if (year) year.textContent = String(new Date().getFullYear());

    const lightbox = document.querySelector('.lightbox');
    const lightboxImage = lightbox?.querySelector('img');
    const lightboxClose = lightbox?.querySelector('.lightbox-close');

    const closeLightbox = () => {
        if (!lightbox) return;
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
    };

    document.querySelectorAll('[data-lightbox]').forEach(item => {
        item.addEventListener('click', () => {
            if (!lightbox || !lightboxImage) return;
            const img = item.querySelector('img');
            if (!img) return;
            lightboxImage.src = img.currentSrc || img.src;
            lightboxImage.alt = img.alt;
            lightbox.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
    });

    lightboxClose?.addEventListener('click', closeLightbox);
    lightbox?.addEventListener('click', event => {
        if (event.target === lightbox) closeLightbox();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') closeLightbox();
    });

    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    } else {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'));
    }
})();
