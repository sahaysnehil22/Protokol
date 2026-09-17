// PROTOKOL — View: Quality Specialist Live Status & Dossier View
import { getConfigItem } from '../db.js';
import { t } from '../i18n.js';

export async function renderStatusView(container, onBackToField) {
  const activeProjectId = localStorage.getItem('protokol_active_project') || 'AY-728-001';

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <button id="btn-back-home" class="btn btn-outline" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
        ${t('status.back')}
      </button>
      <button id="btn-refresh-status" class="btn btn-secondary" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
        ${t('status.refresh')}
      </button>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="font-size: 11px; font-weight: 800; color: #0284C7; letter-spacing: 0.5px; text-transform: uppercase;">
        ${activeProjectId}
      </span>
      <h1 style="font-size: 22px; font-weight: 900; color: #F8FAFC; margin-top: 2px;">
        ${t('status.title')}
      </h1>
      <p id="status-project-desc" style="font-size: 12px; color: var(--color-text-secondary);">
        ...
      </p>
    </div>

    <!-- Summary Metrics Grid -->
    <div id="status-metrics-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase;">${t('status.total_expected')}</div>
        <div id="metric-expected" style="font-size: 24px; font-weight: 900; color: #F8FAFC;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #34D399; text-transform: uppercase;">${t('status.passed')}</div>
        <div id="metric-passed" style="font-size: 24px; font-weight: 900; color: #34D399;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #FBBF24; text-transform: uppercase;">${t('status.provisional')}</div>
        <div id="metric-provisional" style="font-size: 24px; font-weight: 900; color: #FBBF24;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #F87171; text-transform: uppercase;">${t('status.failed')}</div>
        <div id="metric-failed" style="font-size: 24px; font-weight: 900; color: #F87171;">--</div>
      </div>
    </div>

    <!-- Master Quality Dossier Action -->
    <div class="card" style="background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); border: 1px solid #BAE6FD; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #0369A1;">
            ${t('status.dossier_title')}
          </div>
          <div style="font-size: 12px; color: #0284C7; margin-top: 2px;">
            ${t('status.dossier_desc')}
          </div>
        </div>
        <button id="btn-generate-dossier" class="btn btn-primary" style="width: auto; font-size: 13px; padding: 10px 18px;">
          ${t('status.dossier_btn')}
        </button>
      </div>
    </div>

    <!-- Cylinder Break Registration Modal / Section -->
    <div id="cylinder-break-section" class="card" style="margin-bottom: 20px; display: none; border-color: #FBBF24;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #D97706;">
          🧪 ${t('status.record_break_title')}
        </h3>
        <button type="button" id="btn-close-cylinder-form" style="background:none;border:none;color:#94A3B8;cursor:pointer;">✕</button>
      </div>
      <form id="cylinder-break-form">
        <input type="hidden" id="cyl-protocol-id" />
        <div class="form-group">
          <label class="form-label">Protocolo de Concreto</label>
          <input type="text" id="cyl-proto-display" class="form-input" readonly style="background:#F1F5F9;" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">Edad de Rotura</label>
            <select id="cyl-age" class="form-input">
              <option value="7">7 Días</option>
              <option value="28" selected>28 Días (Obligatorio)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Resistencia (kg/cm²)</label>
            <input type="number" step="0.1" id="cyl-strength" class="form-input" placeholder="285.5" required />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Laboratorio Acreditado</label>
          <input type="text" id="cyl-lab" class="form-input" value="AKHISE" required />
        </div>
        <button type="submit" class="btn btn-warning" style="margin-top: 4px;">
          ${t('status.record_break_btn')}
        </button>
      </form>
    </div>

    <!-- Protocols Register Table -->
    <div class="card" style="padding: 16px;">
      <h3 style="font-size: 16px; font-weight: 800; color: #F8FAFC; margin-bottom: 14px;">
        Registro Maestro de Protocolos
      </h3>
      <div id="protocols-list-container">
        <p style="color: var(--color-text-muted); font-size: 13px;">Cargando protocolos...</p>
      </div>
    </div>
  `;

  container.querySelector('#btn-back-home').addEventListener('click', onBackToField);

  const refreshBtn = container.querySelector('#btn-refresh-status');
  const dossierBtn = container.querySelector('#btn-generate-dossier');
  const cylSection = container.querySelector('#cylinder-break-section');
  const cylForm = container.querySelector('#cylinder-break-form');
  const closeCylBtn = container.querySelector('#btn-close-cylinder-form');

  closeCylBtn.addEventListener('click', () => { cylSection.style.display = 'none'; });

  async function loadStatus() {
    try {
      // Load project details
      const projRes = await fetch(`/api/projects/${activeProjectId}`);
      if (projRes.ok) {
        const proj = await projRes.json();
        container.querySelector('#status-project-desc').innerText = 
          `${proj.name} • Contrato ${proj.contract_number} • ${proj.entity}`;
      }

      const res = await fetch(`/api/projects/${activeProjectId}/status`);
      if (!res.ok) throw new Error('Error al consultar estado del proyecto');
      const data = await res.json();

      container.querySelector('#metric-expected').innerText = data.summary.total_expected;
      container.querySelector('#metric-passed').innerText = data.summary.passed;
      container.querySelector('#metric-provisional').innerText = data.summary.provisional;
      container.querySelector('#metric-failed').innerText = data.summary.failed;

      const listContainer = container.querySelector('#protocols-list-container');
      if (data.protocols.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--color-text-muted); font-size: 13px;">No hay protocolos registrados aún en este proyecto.</p>';
        return;
      }

      listContainer.innerHTML = data.protocols.map(p => {
        const badgeClass = p.verdict === 'PASS' ? 'badge-pass' : p.verdict === 'PROVISIONAL_PASS' ? 'badge-provisional' : 'badge-fail';
        return `
          <div style="border-bottom: 1px solid var(--color-border); padding: 12px 0; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="badge ${badgeClass}" style="font-size: 10px;">${p.verdict}</span>
                <span style="font-size: 13px; font-weight: 800; color: #F8FAFC;">${p.id}</span>
                <span style="font-size: 11px; color: var(--color-text-muted);">${p.activity}</span>
              </div>
              <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">
                Progresiva: <strong>${p.chainage}</strong> • Paño: <strong>${p.panel}</strong> • ${p.recorded_at.substring(0, 16)}
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              ${p.verdict === 'PROVISIONAL_PASS' ? `
                <button class="btn btn-warning btn-break-cyl" data-id="${p.id}" style="width: auto; min-height: 32px; height: 32px; padding: 0 10px; font-size: 11px;">
                  🧪 Rotura Lab
                </button>
              ` : ''}
              <a href="/api/protocols/${p.id}/pdf" target="_blank" class="btn btn-outline" style="width: auto; min-height: 32px; height: 32px; padding: 0 10px; font-size: 11px; text-decoration: none; display: flex; align-items: center;">
                📄 PDF
              </a>
            </div>
          </div>
        `;
      }).join('');

      // Bind cylinder break buttons
      listContainer.querySelectorAll('.btn-break-cyl').forEach(btn => {
        btn.addEventListener('click', () => {
          const protoId = btn.getAttribute('data-id');
          container.querySelector('#cyl-protocol-id').value = protoId;
          container.querySelector('#cyl-proto-display').value = protoId;
          cylSection.style.display = 'block';
          cylSection.scrollIntoView({ behavior: 'smooth' });
        });
      });
    } catch (err) {
      console.error(err);
    }
  }

  refreshBtn.addEventListener('click', loadStatus);

  dossierBtn.addEventListener('click', async () => {
    dossierBtn.disabled = true;
    dossierBtn.innerText = 'Compilando...';
    try {
      const res = await fetch(`/api/projects/${activeProjectId}/dossier`);
      const data = await res.json();
      window.open(data.dossier_url, '_blank');
    } catch (err) {
      alert('Error generando dosier: ' + err.message);
    } finally {
      dossierBtn.disabled = false;
      dossierBtn.innerText = t('status.dossier_btn');
    }
  });

  cylForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const protoId = container.querySelector('#cyl-protocol-id').value;
    const ageDays = parseInt(container.querySelector('#cyl-age').value, 10);
    const strength = parseFloat(container.querySelector('#cyl-strength').value);
    const lab = container.querySelector('#cyl-lab').value.trim();

    try {
      const res = await fetch(`/api/protocols/${protoId}/cylinder-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          age_days: ageDays,
          strength_kgcm2: strength,
          lab
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Fallo al registrar rotura');
      }

      const result = await res.json();
      alert(`Rotura registrada exitosamente. Nuevo estado del protocolo: ${result.protocol_verdict}`);
      cylSection.style.display = 'none';
      loadStatus();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });

  loadStatus();
}
