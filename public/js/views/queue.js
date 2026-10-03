// PROTOKOL — View: Offline Queue Drawer
import { getPendingSubmissions, removeSubmission, updateSubmissionMeta } from '../db.js';
import { syncOfflineQueue } from '../sync.js';
import { t } from '../i18n.js';

export async function renderQueueDrawer(drawerContainer, onClose) {
  const all = await getPendingSubmissions();
  const pending = all.filter(p => p.status !== 'REJECTED');
  const rejected = all.filter(p => p.status === 'REJECTED');

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
          ${pending.map(p => {
            const trucksCount = p.measurements?.trucks?.length;
            const truckBadge = trucksCount ? ` • ${trucksCount} mixers` : '';
            return `
              <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <span class="badge ${p.activity === 'CONCRETE' ? 'badge-provisional' : 'badge-pass'}" style="font-size: 10px;">
                    ${p.activity}${truckBadge}
                  </span>
                  <span style="font-size: 11px; color: var(--color-text-muted);">
                    ${new Date(p.queued_at).toLocaleTimeString()}
                  </span>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: #0F172A; margin-top: 6px;">
                  Progresiva ${p.chainage} | Paño ${p.panel}
                </div>
                <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
                  ID Clave: ${p.idempotency_key}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="margin-top: 20px;">
          <button id="btn-force-sync" class="btn btn-primary">
            🔄 Sincronizar Ahora con el Servidor
          </button>
        </div>
      `}

    ${rejected.length > 0 ? `
      <div style="margin-top: 20px; border-top: 2px solid #FECACA; padding-top: 14px;">
        <h4 style="font-size: 14px; font-weight: 800; color: #B91C1C; margin-bottom: 8px;">
          ⚠️ Rechazados por el servidor (${rejected.length}) — requieren revisión
        </h4>
        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 220px; overflow-y: auto;">
          ${rejected.map(p => `
            <div style="background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 12px;">
              <div style="font-size: 13px; font-weight: 700; color: #0F172A;">
                Progresiva ${p.chainage} | Paño ${p.panel} (${p.activity})
              </div>
              <div style="font-size: 11px; color: #B91C1C; margin-top: 4px;">
                ${p.last_error || 'Error desconocido'} • ${p.retry_count || 0} intentos
              </div>
              <div style="display: flex; gap: 8px; margin-top: 8px;">
                <button class="btn btn-outline btn-retry" data-key="${p.idempotency_key}" style="font-size: 11px; padding: 4px 10px; min-height: 28px;">🔄 Reintentar</button>
                <button class="btn btn-outline btn-discard" data-key="${p.idempotency_key}" style="font-size: 11px; padding: 4px 10px; min-height: 28px; color: #B91C1C;">🗑️ Descartar</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  drawerContainer.querySelector('#btn-close-drawer').addEventListener('click', onClose);

  drawerContainer.querySelectorAll('.btn-retry').forEach(btn => {
    btn.addEventListener('click', async () => {
      await updateSubmissionMeta(btn.dataset.key, { status: 'PENDING_SYNC', retry_count: 0, last_error: null });
      await syncOfflineQueue();
      onClose();
    });
  });
  drawerContainer.querySelectorAll('.btn-discard').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Descartar este protocolo? Se perderá el registro local.')) {
        await removeSubmission(btn.dataset.key);
        onClose();
      }
    });
  });

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
