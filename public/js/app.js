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

    this.session = null;
    this.currentView = 'portal';
    this.currentParams = {};
    this.lastSubmissionResult = null;
  }

  async init() {
    console.log('[APP] Inicializando PROTOKOL PWA...');

    // 1. Initialize local IndexedDB
    await openLocalDB();

    // 2. Initialize ServiceWorker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('[SW] Service Worker registrado exitosamente con scope:', reg.scope);
      }).catch((err) => {
        console.warn('[SW] Fallo al registrar Service Worker:', err);
      });
    }

    // 3. Initialize background auto-synchronization
    initAutoSync();

    // 4. Bind network status & queue drawer
    this.bindNetworkStatus();

    // 5. Bind Language Switcher & Brand Home Link
    this.bindLanguageSwitcher();
    this.bindBrandLink();

    // 6. Check existing session
    const savedSession = await getConfigItem('session');
    if (savedSession) {
      this.session = savedSession;
    }

    // Landing screen is the Project Portal
    this.navigateTo('portal');
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
