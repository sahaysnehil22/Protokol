// PROTOKOL — View: Immediate Verdict Display
import { t } from '../i18n.js';

export function renderVerdictView(container, result, onNewProtocol, onOpenStatusView) {
  let verdictClass = 'badge-pass';
  let verdictTitle = t('verdict.pass_title');
  let verdictDesc = 'La actividad cumple con todos los criterios técnicos del Expediente y la norma EG-2013.';

  if (result.verdict === 'PROVISIONAL_PASS') {
    verdictClass = 'badge-provisional';
    verdictTitle = 'APROBADO (Pendiente resultado de laboratorio a 28 días)';
    verdictDesc = 'Cumple con los parámetros de inspección en campo. Pendiente resultado de rotura de probetas a 28 días para la certificación definitiva.';
  } else if (result.verdict === 'FAIL') {
    verdictClass = 'badge-fail';
    verdictTitle = t('verdict.fail_title');
    verdictDesc = t('verdict.fail_desc');
  }

  container.innerHTML = `
    <div class="card" style="text-align: center; padding: 24px 18px;">
      <div style="margin-bottom: 12px;">
        <span class="badge ${verdictClass}" style="font-size: 15px; padding: 8px 18px;">
          ${verdictTitle}
        </span>
      </div>

      <h2 style="font-size: 20px; font-weight: 800; color: #0F172A; margin-bottom: 6px;">
        ${result.protocol_id}
      </h2>
      <p style="font-size: 13px; color: var(--color-text-secondary); max-width: 440px; margin: 0 auto 16px auto;">
        ${verdictDesc}
      </p>

      ${result.isOffline ? `
        <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid #D97706; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; font-size: 12px; color: #B45309;">
          📡 <strong>Modo Offline:</strong> Protocolo guardado en el teléfono. Se sincronizará automáticamente y generará el PDF al recuperar señal.
        </div>
      ` : ''}

      ${result.pdf_url ? `
        <div style="margin-bottom: 18px;">
          <a href="${result.pdf_url}" target="_blank" class="btn btn-primary" style="font-size: 15px;">
            ${t('verdict.pdf_btn')}
          </a>
        </div>
      ` : ''}

      <!-- Checks Table -->
      <div style="text-align: left; margin-top: 16px;">
        <div style="font-size: 12px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 8px;">
          Verificación de Criterios Técnicos
        </div>

        <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
          ${result.checks.map(chk => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #0F172A;">${chk.field}</div>
                <div style="font-size: 11px; color: var(--color-text-muted);">
                  Obtenido: <strong style="color: #0F172A;">${String(chk.actual)}</strong> (Exigido: ${chk.expected})
                </div>
              </div>
              <div>
                <span class="badge ${chk.result === 'PASS' ? 'badge-pass' : 'badge-fail'}" style="font-size: 11px; padding: 4px 10px;">
                  ${chk.result === 'PASS' ? 'CONFORME' : 'FALLA'}
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Signature Grid (D-04): 5 boxes, explicit per-box signing with personal PIN -->
      ${result.signatures && result.signatures.length > 0 ? `
      <div style="text-align: left; margin-top: 16px;">
        <div style="font-size: 12px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 8px;">
          ✍️ Cuadro de Firmas y Sellos
        </div>
        <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden;">
          ${result.signatures.map(sig => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid #E2E8F0;">
              <div>
                <div style="font-size: 13px; font-weight: 700; color: #0F172A;">
                  ${sig.sign_order}. ${sig.signatory_name || sig.role}
                </div>
                <div style="font-size: 11px; color: var(--color-text-muted);">${sig.role || ''}</div>
              </div>
              <div>
                ${sig.status === 'SIGNED' ? `
                  <span class="badge badge-pass" style="font-size: 11px; padding: 4px 10px;">✓ FIRMADO</span>
                ` : sig.status === 'EXEMPT' ? `
                  <span class="badge" style="font-size: 11px; padding: 4px 10px;">EXENTO</span>
                ` : `
                  <button class="btn btn-outline btn-sign-box" data-sig-id="${sig.id}" data-signatory="${sig.signatory_id}"
                    data-name="${(sig.signatory_name || sig.role || '').replace(/"/g, '&quot;')}"
                    style="font-size: 12px; padding: 6px 14px; min-height: 32px;">
                    ✍️ Firmar
                  </button>
                `}
              </div>
            </div>
          `).join('')}
        </div>
        <p style="font-size: 11px; color: var(--color-text-muted); margin-top: 6px;">
          Cada firma requiere el PIN personal del firmante (no el PIN del proyecto).
        </p>
      </div>

      <!-- Signing PIN modal -->
      <div id="sign-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 100; align-items: center; justify-content: center; padding: 20px;">
        <div class="card" style="max-width: 360px; width: 100%;">
          <h3 style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">✍️ Firmar protocolo</h3>
          <p id="sign-modal-name" style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 14px;"></p>
          <label class="form-label">PIN personal del firmante</label>
          <input type="password" id="sign-pin" class="form-input" inputmode="numeric" maxlength="4"
            placeholder="••••" style="text-align: center; letter-spacing: 8px; font-size: 22px;" />
          <div id="sign-error" style="color: #F87171; font-size: 13px; margin-top: 8px; display: none;"></div>
          <div style="display: flex; gap: 10px; margin-top: 16px;">
            <button id="sign-cancel" class="btn btn-outline" style="flex: 1;">${t('common.cancel')}</button>
            <button id="sign-confirm" class="btn btn-primary" style="flex: 1;">Firmar</button>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Pending Tasks Notice -->
      ${result.pending && result.pending.length > 0 ? `
        <div style="text-align: left; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px 14px; margin-top: 14px;">
          <div style="font-size: 12px; font-weight: 700; color: #B45309; margin-bottom: 4px;">
            ⏳ Tareas Pendientes Programadas:
          </div>
          <ul style="font-size: 12px; color: #78350F; padding-left: 18px; line-height: 1.6;">
            <li>Rotura de probetas a 7 días (Alerta temprana).</li>
            <li>Rotura de probetas a 28 días (Liberación contractual de f'c).</li>
          </ul>
        </div>
      ` : ''}

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button id="btn-new-activity" class="btn btn-secondary" style="flex: 1; font-size: 14px;">
          + ${t('verdict.new_protocol')}
        </button>
        <button id="btn-view-status" class="btn btn-outline" style="flex: 1; font-size: 14px;">
          📊 ${t('verdict.status_view')}
        </button>
      </div>
    </div>
  `;

  container.querySelector('#btn-new-activity').addEventListener('click', onNewProtocol);
  container.querySelector('#btn-view-status').addEventListener('click', onOpenStatusView);

  // Per-box signing (two-tier: session + signer's PERSONAL pin)
  const signModal = container.querySelector('#sign-modal');
  if (signModal) {
    const signPin = container.querySelector('#sign-pin');
    const signError = container.querySelector('#sign-error');
    const signName = container.querySelector('#sign-modal-name');
    const signConfirm = container.querySelector('#sign-confirm');
    let pendingSign = null;

    const closeSign = () => { signModal.style.display = 'none'; pendingSign = null; signPin.value = ''; signError.style.display = 'none'; };
    container.querySelector('#sign-cancel').addEventListener('click', closeSign);
    signModal.addEventListener('click', (e) => { if (e.target === signModal) closeSign(); });

    container.querySelectorAll('.btn-sign-box').forEach(btn => {
      btn.addEventListener('click', () => {
        pendingSign = { signatory_id: btn.dataset.signatory };
        signName.innerText = `Firmante: ${btn.dataset.name}`;
        signModal.style.display = 'flex';
        setTimeout(() => signPin.focus(), 50);
      });
    });

    signConfirm.addEventListener('click', async () => {
      if (!pendingSign) return;
      const pin = signPin.value.trim();
      if (pin.length < 4) {
        signError.innerText = 'Ingrese su PIN personal (4 dígitos).';
        signError.style.display = 'block';
        return;
      }
      signConfirm.disabled = true;
      try {
        const res = await fetch(`/api/protocols/${result.protocol_id}/sign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ signatory_id: pendingSign.signatory_id, pin })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'No se pudo firmar.');
        // Refresh the grid: re-fetch signatures and update the box in place
        const sRes = await fetch(`/api/protocols/${result.protocol_id}/signatures`);
        if (sRes.ok) {
          const sigs = await sRes.json();
          const updated = sigs.find(s => s.signatory_id === pendingSign.signatory_id);
          if (updated && updated.status === 'SIGNED') {
            const box = container.querySelector(`.btn-sign-box[data-signatory="${pendingSign.signatory_id}"]`);
            if (box) {
              box.outerHTML = `<span class="badge badge-pass" style="font-size: 11px; padding: 4px 10px;">✓ FIRMADO</span>`;
            }
          }
        }
        closeSign();
      } catch (err) {
        signError.innerText = err.message;
        signError.style.display = 'block';
      } finally {
        signConfirm.disabled = false;
      }
    });
  }
}
