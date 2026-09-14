// PROTOKOL — Main Application Orchestrator
import { openLocalDB, getConfigItem, getPendingSubmissions } from './db.js';
import { initAutoSync, onSyncStateChange } from './sync.js';
import { renderIdentifyView } from './views/identify.js';
import { renderHomeView } from './views/home.js';
import { renderProtocolFormView } from './views/protocol_form.js';
import { renderVerdictView } from './views/verdict.js';
import { renderQueueDrawer } from './views/queue.js';
import { renderStatusView } from './views/status_view.js';

class App {
  constructor() {
    this.mainContainer = document.getElementById('app-content');
    this.statusPill = document.getElementById('status-pill');
    this.statusText = document.getElementById('status-text');
    this.drawerContainer = document.getElementById('queue-drawer');
    this.drawerPanel = document.getElementById('queue-drawer-panel');

    this.session = null;
    this.currentView = 'identify';
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

    // 5. Check existing session
    const savedSession = await getConfigItem('session');
    if (savedSession) {
      this.session = savedSession;
      this.navigateTo('home');
    } else {
      this.navigateTo('identify');
    }
  }

  bindNetworkStatus() {
    const updateNetworkUI = (isOnline) => {
      if (isOnline) {
        this.statusPill.classList.remove('offline');
        this.statusText.innerText = 'ONLINE';
      } else {
        this.statusPill.classList.add('offline');
        this.statusText.innerText = 'OFFLINE';
      }
    };

    updateNetworkUI(navigator.onLine);
    window.addEventListener('online', () => updateNetworkUI(true));
    window.addEventListener('offline', () => updateNetworkUI(false));

    onSyncStateChange((state) => {
      if (state.isSyncing) {
        this.statusPill.classList.add('syncing');
        this.statusText.innerText = `SYNC (${state.pendingCount})`;
      } else {
        this.statusPill.classList.remove('syncing');
        if (state.pendingCount > 0) {
          this.statusText.innerText = `${state.pendingCount} EN COLA`;
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
    this.mainContainer.innerHTML = '';

    switch (viewName) {
      case 'identify':
        renderIdentifyView(this.mainContainer, (session) => {
          this.session = session;
          this.navigateTo('home');
        });
        break;

      case 'home':
        renderHomeView(
          this.mainContainer,
          this.session,
          (activity) => this.navigateTo('form', { activity }),
          () => this.navigateTo('status')
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
