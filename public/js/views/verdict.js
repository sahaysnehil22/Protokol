// PROTOKOL — View: Immediate Verdict Display

export function renderVerdictView(container, result, onNewProtocol, onOpenStatusView) {
  let verdictClass = 'badge-pass';
  let verdictTitle = 'CONFORME / LIBERADO';
  let verdictDesc = 'La actividad cumple con todos los criterios técnicos del Expediente y la norma EG-2013.';

  if (result.verdict === 'PROVISIONAL_PASS') {
    verdictClass = 'badge-provisional';
    verdictTitle = 'APROBACIÓN PROVISIONAL';
    verdictDesc = 'Vaciado conforme en llegada. El protocolo queda pendiente hasta los ensayos de rotura de probetas (28 días).';
  } else if (result.verdict === 'FAIL') {
    verdictClass = 'badge-fail';
    verdictTitle = 'NO CONFORME (FALLA)';
    verdictDesc = `Se ha abierto automáticamente la No Conformidad ${result.nonconformance_id || 'NC'}. Notificación enviada al Especialista de Calidad.`;
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
            📄 Descargar Protocolo Oficial (PDF)
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

      <!-- Pending Tasks Notice -->
      ${result.pending && result.pending.length > 0 ? `
        <div style="text-align: left; background: #FFFBEB; border: 1px solid #FCD34D; border-radius: 8px; padding: 12px 14px; margin-top: 14px;">
          <div style="font-size: 12px; font-weight: 700; color: #B45309; margin-bottom: 4px;">
            ⏳ Tareas Pendientes Programadas:
          </div>
          <ul style="font-size: 12px; color: #78350F; padding-left: 18px; line-height: 1.6;">
            <li>Rotura de probeta a 7 días (Alerta temprana de resistencia).</li>
            <li>Rotura de probeta a 28 días (Liberación contractual de f'c ≥ 210 kg/cm²).</li>
          </ul>
        </div>
      ` : ''}

      <div style="display: flex; gap: 10px; margin-top: 24px;">
        <button id="btn-new-activity" class="btn btn-secondary" style="flex: 1; font-size: 14px;">
          + Nueva Actividad
        </button>
        <button id="btn-view-status" class="btn btn-outline" style="flex: 1; font-size: 14px;">
          📊 Ver Estado General
        </button>
      </div>
    </div>
  `;

  container.querySelector('#btn-new-activity').addEventListener('click', onNewProtocol);
  container.querySelector('#btn-view-status').addEventListener('click', onOpenStatusView);
}
