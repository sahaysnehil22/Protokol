// PROTOKOL — View: Offline Queue Drawer
import { getPendingSubmissions } from '../db.js';
import { syncOfflineQueue } from '../sync.js';

export async function renderQueueDrawer(drawerContainer, onClose) {
  const pending = await getPendingSubmissions();

  drawerContainer.innerHTML = `
    <div class="drawer-header">
      <h3 style="font-size: 18px; font-weight: 800; color: #0F172A;">
        Cola de Sincronización Offline (${pending.length})
      </h3>
      <button class="drawer-close" id="btn-close-drawer">✕</button>
    </div>

    ${pending.length === 0 ? `
      <div style="text-align: center; padding: 30px 10px; color: var(--color-text-secondary);">
        <div style="font-size: 32px; margin-bottom: 8px;">✅</div>
        <p style="font-size: 14px;">Todos los protocolos están sincronizados con el servidor.</p>
      </div>
    ` : `
      <div style="margin-bottom: 16px;">
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 12px;">
          Estos protocolos fueron registrados sin señal y están resguardados en este teléfono.
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 260px; overflow-y: auto;">
          ${pending.map(p => `
            <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="badge ${p.activity === 'CONCRETE' ? 'badge-provisional' : 'badge-pass'}" style="font-size: 10px;">
                  ${p.activity}
                </span>
                <span style="font-size: 11px; color: var(--color-text-muted);">
                  ${new Date(p.queued_at).toLocaleTimeString('es-PE')}
                </span>
              </div>
              <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 6px;">
                Progresiva ${p.chainage} | Paño ${p.panel}
              </div>
              <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
                ID Clave: ${p.idempotency_key}
              </div>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 20px;">
          <button id="btn-force-sync" class="btn btn-primary">
            🔄 Sincronizar Ahora con el Servidor
          </button>
        </div>
      `}
  `;

  drawerContainer.querySelector('#btn-close-drawer').addEventListener('click', onClose);

  const btnSync = drawerContainer.querySelector('#btn-force-sync');
  if (btnSync) {
    btnSync.addEventListener('click', async () => {
      btnSync.innerText = 'Sincronizando...';
      btnSync.disabled = true;
      await syncOfflineQueue();
      onClose();
    });
  }
}
