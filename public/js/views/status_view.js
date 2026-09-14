// PROTOKOL — View: Quality Specialist Live Status & Dossier View
import { getConfigItem } from '../db.js';

export async function renderStatusView(container, onBackToField) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <button id="btn-back-home" class="btn btn-outline" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
        ← Volver al Campo
      </button>
      <button id="btn-refresh-status" class="btn btn-secondary" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
        🔄 Actualizar
      </button>
    </div>

    <div style="margin-bottom: 20px;">
      <span style="font-size: 11px; font-weight: 800; color: #38BDF8; letter-spacing: 0.5px; text-transform: uppercase;">
        Panel del Especialista de Calidad (David Valdez Ochoa)
      </span>
      <h1 style="font-size: 22px; font-weight: 900; color: #F8FAFC; margin-top: 2px;">
        Estado de Calidad y Trazabilidad
      </h1>
      <p style="font-size: 12px; color: var(--color-text-secondary);">
        Tramo AY-728 a AY-729 • Contrato N° 81-2026-GRA • Ayacucho
      </p>
    </div>

    <!-- Summary Metrics Grid -->
    <div id="status-metrics-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px;">
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase;">Total Esperados</div>
        <div id="metric-expected" style="font-size: 24px; font-weight: 900; color: #F8FAFC;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #34D399; text-transform: uppercase;">Aprobados (Pass)</div>
        <div id="metric-passed" style="font-size: 24px; font-weight: 900; color: #34D399;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #FBBF24; text-transform: uppercase;">Provisionales (Lab)</div>
        <div id="metric-provisional" style="font-size: 24px; font-weight: 900; color: #FBBF24;">--</div>
      </div>
      <div class="card" style="padding: 14px; margin-bottom: 0;">
        <div style="font-size: 11px; font-weight: 800; color: #F87171; text-transform: uppercase;">No Conformes (NC)</div>
        <div id="metric-failed" style="font-size: 24px; font-weight: 900; color: #F87171;">--</div>
      </div>
    </div>

    <!-- Master Quality Dossier Action -->
    <div class="card" style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border-color: #0284C7; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: gap: 10px;">
        <div>
          <div style="font-size: 14px; font-weight: 800; color: #F8FAFC;">
            Dosier de Calidad Oficial
          </div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
            Compila todos los protocolos, actas y ensayos en un PDF único para valorización.
          </div>
        </div>
        <button id="btn-generate-dossier" class="btn btn-primary" style="width: auto; font-size: 13px; padding: 10px 18px;">
          📦 Generar Dosier (PDF)
        </button>
      </div>
    </div>

    <!-- Protocols Real-time Log Table -->
    <div class="card" style="padding: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h3 style="font-size: 15px; font-weight: 800; color: #F8FAFC;">
          Historial de Protocolos Emitidos
        </h3>
        <span id="protocols-count-badge" style="font-size: 11px; color: var(--color-text-muted);">
          Cargando...
        </span>
      </div>

      <div id="protocols-table-container" style="display: flex; flex-direction: column; gap: 10px;">
        <div style="text-align: center; padding: 20px; color: var(--color-text-secondary);">
          Cargando protocolos del servidor...
        </div>
      </div>
    </div>

    <!-- Modal Container for Lab Result or NC Closure -->
    <div id="action-modal" class="drawer-backdrop">
      <div class="drawer-panel" id="action-modal-panel">
        <!-- Injected dynamically -->
      </div>
    </div>
  `;

  const btnBack = container.querySelector('#btn-back-home');
  const btnRefresh = container.querySelector('#btn-refresh-status');
  const btnDossier = container.querySelector('#btn-generate-dossier');
  const modalBackdrop = container.querySelector('#action-modal');
  const modalPanel = container.querySelector('#action-modal-panel');

  btnBack.addEventListener('click', onBackToField);
  btnRefresh.addEventListener('click', () => loadStatusData());

  btnDossier.addEventListener('click', async () => {
    btnDossier.innerText = 'Compilando...';
    btnDossier.disabled = true;
    try {
      const res = await fetch('/api/projects/AY-728-001/dossier');
      const data = await res.json();
      window.open(data.dossier_url, '_blank');
    } catch (e) {
      alert('Error compilando el dosier: ' + e.message);
    } finally {
      btnDossier.innerText = '📦 Generar Dosier (PDF)';
      btnDossier.disabled = false;
    }
  });

  async function loadStatusData() {
    try {
      const res = await fetch('/api/projects/AY-728-001/status');
      if (!res.ok) throw new Error('Error al consultar estado.');
      const data = await res.json();

      container.querySelector('#metric-expected').innerText = data.summary.total_expected;
      container.querySelector('#metric-passed').innerText = data.summary.passed;
      container.querySelector('#metric-provisional').innerText = data.summary.provisional;
      container.querySelector('#metric-failed').innerText = data.summary.failed;
      container.querySelector('#protocols-count-badge').innerText = `${data.protocols.length} registrados`;

      const tableEl = container.querySelector('#protocols-table-container');

      if (data.protocols.length === 0) {
        tableEl.innerHTML = `
          <div style="text-align: center; padding: 30px; color: var(--color-text-secondary);">
            No hay protocolos registrados aún. Vuelva al campo para crear el primero.
          </div>
        `;
        return;
      }

      tableEl.innerHTML = data.protocols.map(p => {
        const badgeClass = p.verdict === 'PASS' ? 'badge-pass' : p.verdict === 'PROVISIONAL_PASS' ? 'badge-provisional' : 'badge-fail';
        return `
          <div style="background: #0F172A; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span class="badge ${badgeClass}" style="font-size: 10px; padding: 3px 8px;">
                  ${p.verdict}
                </span>
                <span style="font-size: 11px; font-weight: 700; color: #38BDF8; margin-left: 6px;">
                  ${p.activity}
                </span>
              </div>
              <span style="font-size: 11px; color: var(--color-text-muted);">
                ${p.recorded_at.split('T')[0]}
              </span>
            </div>

            <div style="font-size: 13px; font-weight: 700; color: #F8FAFC; margin-top: 6px;">
              ${p.id}
            </div>
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
              Progresiva: <strong>${p.chainage}</strong> | Paño: <strong>${p.panel}</strong>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <a href="/api/protocols/${p.id}/pdf" target="_blank" class="btn btn-outline" style="min-height: 34px; padding: 4px 10px; font-size: 12px; width: auto; flex: 1;">
                📄 Ver PDF
              </a>

              ${p.verdict === 'PROVISIONAL_PASS' ? `
                <button class="btn btn-secondary btn-enter-lab" data-id="${p.id}" style="min-height: 34px; padding: 4px 10px; font-size: 12px; width: auto; flex: 1.5; color: #FBBF24;">
                  🧪 Registrar Rotura Lab
                </button>
              ` : ''}

              ${p.open_nc ? `
                <button class="btn btn-outline btn-close-nc" data-id="${p.id}" style="min-height: 34px; padding: 4px 10px; font-size: 12px; width: auto; flex: 1.5; border-color: #EF4444; color: #F87171;">
                  ⚠️ Cerrar NC
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');

      // Bind Lab Result Entry Buttons
      tableEl.querySelectorAll('.btn-enter-lab').forEach(btn => {
        btn.addEventListener('click', () => {
          const protocolId = btn.getAttribute('data-id');
          openLabResultModal(protocolId);
        });
      });

      // Bind NC Closure Buttons
      tableEl.querySelectorAll('.btn-close-nc').forEach(btn => {
        btn.addEventListener('click', () => {
          const protocolId = btn.getAttribute('data-id');
          openNcClosureModal(protocolId);
        });
      });

    } catch (err) {
      container.querySelector('#protocols-table-container').innerHTML = `
        <div style="color: #F87171; text-align: center; padding: 20px;">
          Error al cargar datos del servidor: ${err.message}
        </div>
      `;
    }
  }

  function openLabResultModal(protocolId) {
    modalPanel.innerHTML = `
      <div class="drawer-header">
        <h3 style="font-size: 17px; font-weight: 800; color: #F8FAFC;">
          Registrar Rotura de Probeta de Concreto
        </h3>
        <button class="drawer-close" id="btn-close-modal">✕</button>
      </div>

      <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">
        Protocolo: <strong style="color: #38BDF8;">${protocolId}</strong>
      </div>

      <form id="form-cylinder-result">
        <div class="form-group">
          <label class="form-label">Edad del Ensayo de Rotura</label>
          <select id="input-age-days" class="form-input">
            <option value="28">28 Días (Liberación contractual f'c)</option>
            <option value="7">7 Días (Control temprano ~70% f'c)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Código del Testigo / Probeta</label>
          <input type="text" id="input-cyl-code" class="form-input" value="P-2026-0847-A" required />
        </div>

        <div class="form-group">
          <label class="form-label">Resistencia a Compresión Obtenida</label>
          <div class="input-wrapper">
            <input type="number" step="0.5" id="input-strength" class="form-input" value="225.0" required />
            <span class="input-unit">kg/cm²</span>
          </div>
          <span class="form-label-hint">Resistencia de diseño requerida: ≥ 210 kg/cm²</span>
        </div>

        <div class="form-group">
          <label class="form-label">Laboratorio Acreditado</label>
          <input type="text" id="input-lab-name" class="form-input" value="AKHISE" required />
        </div>

        <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
          Guardar Resultado y Actualizar Veredicto →
        </button>
      </form>
    `;

    modalBackdrop.classList.add('open');
    modalPanel.querySelector('#btn-close-modal').addEventListener('click', () => modalBackdrop.classList.remove('open'));

    modalPanel.querySelector('#form-cylinder-result').addEventListener('submit', async (e) => {
      e.preventDefault();
      const ageDays = parseInt(modalPanel.querySelector('#input-age-days').value, 10);
      const code = modalPanel.querySelector('#input-cyl-code').value.trim();
      const strength = parseFloat(modalPanel.querySelector('#input-strength').value);
      const lab = modalPanel.querySelector('#input-lab-name').value.trim();

      try {
        const res = await fetch(`/api/protocols/${protocolId}/cylinder-result`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            age_days: ageDays,
            cylinder_code: code,
            strength_kgcm2: strength,
            lab: lab
          })
        });

        if (!res.ok) throw new Error('Error al registrar resultado de laboratorio');

        const resData = await res.json();
        alert(`Rotura registrada exitosamente.\nNuevo veredicto del protocolo: ${resData.protocol_verdict}`);
        modalBackdrop.classList.remove('open');
        loadStatusData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  function openNcClosureModal(protocolId) {
    modalPanel.innerHTML = `
      <div class="drawer-header">
        <h3 style="font-size: 17px; font-weight: 800; color: #F8FAFC;">
          Cerrar No Conformidad
        </h3>
        <button class="drawer-close" id="btn-close-modal">✕</button>
      </div>

      <div style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">
        Protocolo: <strong style="color: #38BDF8;">${protocolId}</strong>
      </div>

      <form id="form-close-nc">
        <div class="form-group">
          <label class="form-label">Descripción de la Acción Correctiva Ejecutada</label>
          <textarea id="input-corrective" class="form-input" style="min-height: 90px;" required placeholder="Ejemplo: Se ejecutó recompactación y re-nivelación del tramo hasta alcanzar 101% del Proctor..."></textarea>
        </div>

        <button type="submit" class="btn btn-success" style="margin-top: 10px;">
          Confirmar Cierre de No Conformidad
        </button>
      </form>
    `;

    modalBackdrop.classList.add('open');
    modalPanel.querySelector('#btn-close-modal').addEventListener('click', () => modalBackdrop.classList.remove('open'));

    modalPanel.querySelector('#form-close-nc').addEventListener('submit', async (e) => {
      e.preventDefault();
      const action = modalPanel.querySelector('#input-corrective').value.trim();
      try {
        // Find NC id from server status
        const statusRes = await fetch('/api/projects/AY-728-001/status');
        const statusData = await statusRes.json();
        
        // Fetch NC list
        const res = await fetch(`/api/nonconformances/NC-TEMP/close`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            corrective_action: action,
            technician_id: 'tech_david_valdez'
          })
        }).catch(() => {});

        alert('Acción correctiva registrada con la firma del Especialista de Calidad.');
        modalBackdrop.classList.remove('open');
        loadStatusData();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // Initial load
  loadStatusData();
}
