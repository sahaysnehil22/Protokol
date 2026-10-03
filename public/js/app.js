// PROTOKOL — Main Application Orchestrator
import { openLocalDB, getConfigItem } from './db.js';
import { initAutoSync, onSyncStateChange } from './sync.js';
import { getLanguage, setLanguage, onLanguageChange, t } from './i18n.js';
import { renderIdentifyView } from './views/identify.js';
import { renderHomeView } from './views/home.js';
import { renderProtocolFormView } from './views/protocol_form.js';
import { renderVerdictView } from './views/verdict.js';
import { renderQueueDrawer } from './views/queue.js';
import { renderStatusView } from './views/status_view.js';
import { renderProjectSetupView } from './views/project_setup.js';
import { renderProjectPortalView } from './views/project_portal.js';

class App {
  constructor() {
    this.mainContainer = document.getElementById('app-content');
    this.statusPill = document.getElementById('status-pill');
    this.statusText = document.getElementById('status-text');
    this.drawerContainer = document.getElementById('queue-drawer');
    this.drawerPanel = document.getElementById('queue-drawer-panel');
    this.langToggleBtn = document.getElementById('btn-lang-toggle');
    this.headerSearchWrap = document.getElementById('header-search');
    this.headerSearchInput = document.getElementById('header-search-input');
    this.headerSearchBtn = document.getElementById('btn-header-search');
    this.headerSearchHandler = null;
    this.headerSearchExpanded = false;

    this.session = null;
    this.currentView = 'portal';
    this.currentParams = {};
    this.lastSubmissionResult = null;

    // Exposed so views (e.g. project portal) can register a header search handler.
    window.__protokolApp = this;
  }

  async init() {
    console.log('[APP] Inicializando PROTOKOL PWA...');

    // 1. Initialize local IndexedDB (graceful degradation: field devices or
    // hardened browsers may deny storage — the app must still boot online).
    // A synchronous throw from indexedDB.open() becomes a rejection here.
    try {
      await openLocalDB();
    } catch (e) {
      console.error('[APP] IndexedDB no disponible, continuando en modo solo-en-línea:', e);
      this.dbUnavailable = true;
    }

    // 2. Initialize ServiceWorker
    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
          console.log('[SW] Service Worker registrado exitosamente con scope:', reg.scope);
        }).catch((err) => {
          console.warn('[SW] Fallo al registrar Service Worker:', err);
        });
      } catch (e) {
        console.warn('[SW] Registro síncrono falló:', e);
      }
    }

    // 3. Initialize background auto-synchronization (needs IndexedDB)
    if (!this.dbUnavailable) {
      try {
        initAutoSync();
      } catch (e) {
        console.warn('[APP] initAutoSync falló:', e);
      }
    }

    // 4. Bind network status & queue drawer
    try {
      this.bindNetworkStatus();
    } catch (e) {
      console.warn('[APP] bindNetworkStatus falló:', e);
    }

    // 5. Bind Language Switcher & Brand Home Link
    try {
      this.bindLanguageSwitcher();
      this.bindBrandLink();
      this.setupHeaderSearch();
    } catch (e) {
      console.warn('[APP] bindings fallaron:', e);
    }

    // 6. Check existing session (needs IndexedDB; skip when unavailable)
    if (!this.dbUnavailable) {
      try {
        const savedSession = await getConfigItem('session');
        if (savedSession) {
          this.session = savedSession;
        }
      } catch (e) {
        console.warn('[APP] No se pudo leer la sesión guardada:', e);
      }
    }

    // Landing screen is the Project Portal — ALWAYS reached. A boot failure
    // must never leave the user staring at the splash screen.
    try {
      this.navigateTo('portal');
    } catch (e) {
      console.error('[APP] Fallo crítico al renderizar el portal:', e);
      this.mainContainer.innerHTML = `
        <div class="card" style="text-align:center; padding: 32px 20px; margin-top: 24px;">
          <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
          <p style="font-weight: 800; margin-bottom: 6px;">No se pudo iniciar PROTOKOL</p>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">${String(e.message || e)}</p>
          <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
        </div>`;
    }
  }

  bindBrandLink() {
    const brandLink = document.getElementById('brand-link');
    if (brandLink) {
      brandLink.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo('portal');
      });
    }
  }

  // Expandable header search. Views register a filter callback via
  // setHeaderSearchHandler(); the icon is only visible while a handler exists.
  setupHeaderSearch() {
    if (!this.headerSearchBtn || !this.headerSearchInput) return;

    this.headerSearchBtn.addEventListener('click', () => {
      if (!this.headerSearchExpanded) {
        this.headerSearchExpanded = true;
        this.headerSearchInput.style.display = 'block';
        requestAnimationFrame(() => {
          this.headerSearchInput.style.width = '150px';
          this.headerSearchInput.style.opacity = '1';
        });
        this.headerSearchBtn.innerHTML = '✕';
        setTimeout(() => this.headerSearchInput.focus(), 60);
      } else {
        this.collapseHeaderSearch();
      }
    });

    this.headerSearchInput.addEventListener('input', (e) => {
      if (this.headerSearchHandler) this.headerSearchHandler(e.target.value);
    });

    this.headerSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.collapseHeaderSearch();
    });
  }

  collapseHeaderSearch() {
    if (!this.headerSearchExpanded) return;
    this.headerSearchExpanded = false;
    this.headerSearchInput.style.width = '0';
    this.headerSearchInput.style.opacity = '0';
    setTimeout(() => {
      this.headerSearchInput.style.display = 'none';
      this.headerSearchInput.value = '';
    }, 220);
    this.headerSearchBtn.innerHTML = '🔍';
    if (this.headerSearchHandler) this.headerSearchHandler('');
  }

  setHeaderSearchHandler(fn, placeholder) {
    this.headerSearchHandler = fn || null;
    if (this.headerSearchExpanded) this.collapseHeaderSearch();
    if (this.headerSearchWrap) {
      this.headerSearchWrap.style.display = fn ? 'flex' : 'none';
    }
    if (fn && placeholder && this.headerSearchInput) {
      this.headerSearchInput.placeholder = placeholder;
    }
  }

  bindLanguageSwitcher() {
    if (!this.langToggleBtn) return;

    const updateBtnText = (lang) => {
      this.langToggleBtn.innerText = lang === 'es' ? 'EN' : 'ES';
    };

    updateBtnText(getLanguage());

    this.langToggleBtn.addEventListener('click', () => {
      const nextLang = getLanguage() === 'es' ? 'en' : 'es';
      setLanguage(nextLang);
      updateBtnText(nextLang);
    });

    onLanguageChange(() => {
      this.navigateTo(this.currentView, this.currentParams);
    });
  }

  bindNetworkStatus() {
    const updateNetworkUI = (isOnline) => {
      if (isOnline) {
        this.statusPill.classList.remove('offline');
        this.statusText.innerText = t('nav.online');
      } else {
        this.statusPill.classList.add('offline');
        this.statusText.innerText = t('nav.offline');
      }
    };

    updateNetworkUI(navigator.onLine);
    window.addEventListener('online', () => updateNetworkUI(true));
    window.addEventListener('offline', () => updateNetworkUI(false));

    onSyncStateChange((state) => {
      if (state.isSyncing) {
        this.statusPill.classList.add('syncing');
        this.statusText.innerText = `${t('nav.syncing')} (${state.pendingCount})`;
      } else {
        this.statusPill.classList.remove('syncing');
        if (state.pendingCount > 0) {
          this.statusText.innerText = t('nav.queued', { count: state.pendingCount });
        } else {
          updateNetworkUI(navigator.onLine);
        }
      }
    });

    this.statusPill.addEventListener('click', () => {
      this.openQueueDrawer();
    });
  }

  openQueueDrawer() {
    this.drawerContainer.classList.add('open');
    renderQueueDrawer(this.drawerPanel, () => {
      this.drawerContainer.classList.remove('open');
    });
  }

  navigateTo(viewName, params = {}) {
    this.currentView = viewName;
    this.currentParams = params;
    this.mainContainer.innerHTML = '';
    // Header search belongs to the portal only; views re-register if needed.
    this.setHeaderSearchHandler(null);

    switch (viewName) {
      case 'portal':
        renderProjectPortalView(
          this.mainContainer,
          (projectId) => {
            localStorage.setItem('protokol_active_project', projectId);
            this.navigateTo('identify');
          },
          () => this.navigateTo('setup')
        );
        break;

      case 'identify':
        renderIdentifyView(
          this.mainContainer,
          (session) => {
            this.session = session;
            this.navigateTo('home');
          },
          () => this.navigateTo('setup'),
          () => this.navigateTo('portal')
        );
        break;

      case 'setup':
        renderProjectSetupView(
          this.mainContainer,
          (createdProject) => {
            if (createdProject && createdProject.id) {
              localStorage.setItem('protokol_active_project', createdProject.id);
              this.navigateTo('identify');
            } else {
              this.navigateTo('portal');
            }
          },
          () => {
            this.navigateTo('portal');
          }
        );
        break;

      case 'home':
        renderHomeView(
          this.mainContainer,
          this.session,
          (activity) => this.navigateTo('form', { activity }),
          () => this.navigateTo('status'),
          () => this.navigateTo('setup'),
          () => this.navigateTo('portal')
        );
        break;

      case 'form':
        renderProtocolFormView(
          this.mainContainer,
          params.activity,
          this.session,
          (result) => {
            this.lastSubmissionResult = result;
            this.navigateTo('verdict', { result });
          },
          () => this.navigateTo('home')
        );
        break;

      case 'verdict':
        renderVerdictView(
          this.mainContainer,
          params.result || this.lastSubmissionResult,
          () => this.navigateTo('home'),
          () => this.navigateTo('status')
        );
        break;

      case 'status':
        renderStatusView(this.mainContainer, () => this.navigateTo('home'));
        break;

      default:
        this.navigateTo('home');
        break;
    }
  }
}

// Start application
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
