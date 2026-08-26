(() => {
  const qs = (s, c = document) => c.querySelector(s);
  const qsa = (s, c = document) => [...c.querySelectorAll(s)];

  function icon(name, size = 18) {
    return `<i data-lucide="${name}" style="width:${size}px;height:${size}px"></i>`;
  }

  function refreshIcons() {
    try { if (window.lucide) window.lucide.createIcons(); } catch (_) {}
  }

  function ensureToastRoot() {
    let root = qs('#app-toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'app-toast-root';
      root.className = 'app-toast-root';
      document.body.appendChild(root);
    }
    return root;
  }

  function toast(message, type = 'success', detail = '') {
    const root = ensureToastRoot();
    const item = document.createElement('div');
    item.className = `app-toast ${type}`;
    const icons = { success: 'check-circle-2', error: 'circle-x', warning: 'triangle-alert', info: 'info' };
    item.innerHTML = `
      <div class="app-toast-icon">${icon(icons[type] || 'info', 19)}</div>
      <div class="app-toast-copy"><strong>${escapeHTML(message)}</strong>${detail ? `<span>${escapeHTML(detail)}</span>` : ''}</div>
      <button class="app-toast-close" type="button" aria-label="Fechar">${icon('x', 16)}</button>
    `;
    root.appendChild(item);
    refreshIcons();
    requestAnimationFrame(() => item.classList.add('show'));
    const close = () => {
      item.classList.remove('show');
      setTimeout(() => item.remove(), 180);
    };
    qs('.app-toast-close', item)?.addEventListener('click', close);
    setTimeout(close, 4200);
  }

  function confirmModal({ title = 'Confirmar ação', message = '', confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false } = {}) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'app-confirm-overlay';
      overlay.innerHTML = `
        <div class="app-confirm" role="dialog" aria-modal="true">
          <div class="app-confirm-icon ${danger ? 'danger' : ''}">${icon(danger ? 'triangle-alert' : 'circle-help', 22)}</div>
          <h3>${escapeHTML(title)}</h3>
          <p>${escapeHTML(message)}</p>
          <div class="app-confirm-actions">
            <button type="button" class="btn btn-secondary app-confirm-cancel">${escapeHTML(cancelText)}</button>
            <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'} app-confirm-ok">${escapeHTML(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      refreshIcons();
      requestAnimationFrame(() => overlay.classList.add('show'));
      const finish = value => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 160);
        resolve(value);
      };
      qs('.app-confirm-cancel', overlay).addEventListener('click', () => finish(false));
      qs('.app-confirm-ok', overlay).addEventListener('click', () => finish(true));
      overlay.addEventListener('click', e => { if (e.target === overlay) finish(false); });
      qs('.app-confirm-ok', overlay)?.focus();
    });
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function applyTheme(theme) {
    const chosen = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = chosen;
    localStorage.setItem('vida-theme', chosen);
    qsa('[data-theme-icon]').forEach(el => {
      el.innerHTML = icon(chosen === 'dark' ? 'sun' : 'moon', 18);
    });
    refreshIcons();
  }

  function initTheme() {
    const saved = localStorage.getItem('vida-theme');
    const preferred = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved || preferred);
  }

  function initShell() {
    const sidebar = qs('.app-sidebar, .admin-sidebar, .doctor-sidebar, .patient-sidebar');
    const main = qs('.app-main, .admin-main, .doctor-main, .patient-main');
    if (!sidebar || !main) return;

    sidebar.classList.add('app-sidebar');
    main.classList.add('app-main');

    const compact = localStorage.getItem('vida-sidebar') === 'compact';
    document.body.classList.toggle('sidebar-compact', compact);

    qsa('[data-sidebar-toggle]').forEach(btn => btn.addEventListener('click', () => {
      if (window.innerWidth <= 820) {
        document.body.classList.toggle('sidebar-mobile-open');
      } else {
        document.body.classList.toggle('sidebar-compact');
        localStorage.setItem('vida-sidebar', document.body.classList.contains('sidebar-compact') ? 'compact' : 'open');
      }
    }));

    qsa('.app-sidebar [data-section], .app-sidebar a').forEach(item => item.addEventListener('click', () => {
      if (window.innerWidth <= 820) document.body.classList.remove('sidebar-mobile-open');
    }));
  }

  async function loadNotifications() {
    const list = qs('#app-notification-list');
    const badge = qs('#app-notification-badge');
    if (!list || !badge) return;
    try {
      const response = await fetch('/api/notificacoes', { cache: 'no-store' });
      if (!response.ok) return;
      const items = await response.json();
      const unread = items.filter(n => !Number(n.lida)).length;
      badge.textContent = unread > 9 ? '9+' : String(unread);
      badge.hidden = unread === 0;
      list.innerHTML = items.length ? items.map(n => `
        <button class="notification-item ${Number(n.lida) ? '' : 'unread'}" type="button" data-notification-id="${n.id}">
          <span class="notification-dot"></span>
          <span><strong>${escapeHTML(n.titulo)}</strong><small>${escapeHTML(n.mensagem || '')}</small><time>${formatDateTime(n.criada_em)}</time></span>
        </button>`).join('') : '<div class="notification-empty">Nenhuma notificação por aqui.</div>';
      qsa('[data-notification-id]', list).forEach(btn => btn.addEventListener('click', async () => {
        await fetch(`/api/notificacoes/${btn.dataset.notificationId}/lida`, { method: 'PUT' });
        btn.classList.remove('unread');
        loadNotifications();
      }));
    } catch (_) {}
  }

  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  function injectTopbarActions() {
    const topbar = qs('.app-topbar, .admin-topbar, .doctor-topbar, .patient-topbar');
    if (!topbar || qs('.app-topbar-actions', topbar)) return;
    const actions = document.createElement('div');
    actions.className = 'app-topbar-actions';
    actions.innerHTML = `
      <button class="icon-button mobile-menu-button" type="button" data-sidebar-toggle title="Menu">${icon('menu', 19)}</button>
      <div class="notification-wrap">
        <button class="icon-button" id="app-notification-button" type="button" title="Notificações">${icon('bell', 19)}<span id="app-notification-badge" class="notification-badge" hidden>0</span></button>
        <div class="notification-popover" id="app-notification-popover">
          <div class="notification-head"><strong>Notificações</strong><button id="mark-all-read" type="button">Marcar como lidas</button></div>
          <div id="app-notification-list" class="notification-list"><div class="notification-empty">Carregando...</div></div>
        </div>
      </div>
      <button class="icon-button" type="button" data-theme-toggle title="Alternar tema"><span data-theme-icon></span></button>
      <button class="icon-button desktop-sidebar-button" type="button" data-sidebar-toggle title="Recolher menu">${icon('panel-left-close', 19)}</button>
    `;
    topbar.appendChild(actions);
    refreshIcons();

    qs('[data-theme-toggle]', actions)?.addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
    });

    const pop = qs('#app-notification-popover');
    qs('#app-notification-button')?.addEventListener('click', e => {
      e.stopPropagation();
      pop?.classList.toggle('open');
      loadNotifications();
    });
    qs('#mark-all-read')?.addEventListener('click', async () => {
      await fetch('/api/notificacoes/lidas', { method: 'PUT' });
      loadNotifications();
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.notification-wrap')) pop?.classList.remove('open');
    });
  }

  function init() {
    initTheme();
    qsa('[data-theme-toggle]').forEach(btn => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    });
    injectTopbarActions();
    initShell();
    refreshIcons();
    if (qs('#app-notification-list')) loadNotifications();
  }

  window.appToast = toast;
  window.appConfirm = confirmModal;
  window.appEscape = escapeHTML;
  window.appIcon = icon;
  window.refreshIcons = refreshIcons;
  window.loadNotifications = loadNotifications;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
