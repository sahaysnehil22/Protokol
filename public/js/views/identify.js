// PROTOKOL — View: Technician Identity & Dynamic Project Selection
import { setConfigItem, getConfigItem } from '../db.js';
import { t } from '../i18n.js';

export async function renderIdentifyView(container, onAuthenticated, onOpenProjectSetup, onBackToPortal) {
  const currentToken = localStorage.getItem('protokol_device_token') || 'dvc_pilot_qa_01';
  let activeProjectId = localStorage.getItem('protokol_active_project') || 'AY-728-001';

  container.innerHTML = `
    <div style="margin-bottom: 10px;">
      <button type="button" id="btn-back-to-portal" class="btn btn-outline" style="font-size: 12px; padding: 4px 12px; height: 32px; min-height: 32px;">
        ${t('portal.change_project')}
      </button>
    </div>

    <div class="card" style="margin-top: 6px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">👷‍♂️</div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0F172A;">${t('identify.title')}</h2>
        <p id="project-subtitle" style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">
          ...
        </p>
      </div>

      <form id="identify-form">
        <!-- Project Selector -->
        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="margin-bottom: 0;">${t('identify.select_project')}</label>
            <button type="button" id="btn-goto-setup" class="btn btn-outline" style="font-size: 11px; padding: 2px 8px; min-height: 26px; height: 26px;">
              ${t('nav.new_project')}
            </button>
          </div>
          <select id="project-select" class="form-input" style="font-size: 14px; font-weight: 600;">
            <option value="">Cargando proyectos...</option>
          </select>
        </div>

        <!-- Technician Selector -->
        <div class="form-group">
          <label class="form-label">${t('identify.select_tech')}</label>
          <select id="tech-select" class="form-input" style="font-size: 14px;">
            <option value="">Seleccione un proyecto primero</option>
          </select>
        </div>

        <!-- PIN Input -->
        <div class="form-group">
          <label class="form-label">${t('identify.pin_label')}</label>
          <div class="input-wrapper">
            <input 
              type="password" 
              id="tech-pin" 
              class="form-input" 
              inputmode="numeric" 
              pattern="[0-9]*" 
              maxlength="4" 
              placeholder="••••" 
              value="1234"
              required 
              style="text-align: center; letter-spacing: 8px; font-size: 24px;"
            />
          </div>
          <span class="form-label-hint">${t('identify.pin_hint')}</span>
        </div>

        <!-- Device Token Input -->
        <div class="form-group" style="margin-top: 10px; margin-bottom: 24px;">
          <label class="form-label" style="font-size: 12px; color: var(--color-text-muted);">
            ${t('identify.device_label')}
          </label>
          <input 
            type="text" 
            id="device-token" 
            class="form-input" 
            value="${currentToken}" 
            readonly 
            style="font-size: 12px; color: var(--color-text-muted); background: #F1F5F9; border-color: #E2E8F0;"
          />
        </div>

        <div id="identify-error" style="color: #F87171; font-size: 13px; margin-bottom: 14px; display: none;"></div>

        <button type="submit" class="btn btn-primary">
          ${t('identify.btn_submit')}
        </button>
      </form>
    </div>
  `;

  const projectSelect = container.querySelector('#project-select');
  const techSelect = container.querySelector('#tech-select');
  const projectSubtitle = container.querySelector('#project-subtitle');
  const pinInput = container.querySelector('#tech-pin');
  const form = container.querySelector('#identify-form');
  const errorDiv = container.querySelector('#identify-error');
  const gotoSetupBtn = container.querySelector('#btn-goto-setup');

  gotoSetupBtn.addEventListener('click', () => onOpenProjectSetup());

  const backToPortalBtn = container.querySelector('#btn-back-to-portal');
  if (backToPortalBtn && onBackToPortal) {
    backToPortalBtn.addEventListener('click', () => onBackToPortal());
  }

  let projectsList = [];

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Error al cargar proyectos');
      projectsList = await res.json();

      if (projectsList.length === 0) {
        projectSelect.innerHTML = '<option value="">Sin proyectos registrados</option>';
        return;
      }

      projectSelect.innerHTML = projectsList.map(p => `
        <option value="${p.id}" ${p.id === activeProjectId ? 'selected' : ''}>
          ${p.name} (${p.id})
        </option>
      `).join('');

      if (!activeProjectId || !projectsList.some(p => p.id === activeProjectId)) {
        activeProjectId = projectsList[0].id;
      }

      updateProjectDetails(activeProjectId);
      await loadTechnicians(activeProjectId);
    } catch (err) {
      console.error(err);
      projectSelect.innerHTML = '<option value="AY-728-001">Proyecto Piloto (AY-728-001)</option>';
      loadTechnicians('AY-728-001');
    }
  }

  function updateProjectDetails(projId) {
    const proj = projectsList.find(p => p.id === projId);
    if (proj) {
      projectSubtitle.innerText = `${proj.road_section || proj.location || ''} • Contrato ${proj.contract_number}`;
    }
  }

  async function loadTechnicians(projId) {
    try {
      const res = await fetch(`/api/projects/${projId}/technicians`);
      if (!res.ok) throw new Error('Error al cargar técnicos');
      const techs = await res.json();

      if (techs.length === 0) {
        techSelect.innerHTML = '<option value="">Sin técnicos registrados</option>';
        return;
      }

      // Group into Execution vs Supervision
      const exec = techs.filter(t => !t.role.toLowerCase().includes('supervis'));
      const sup = techs.filter(t => t.role.toLowerCase().includes('supervis'));

      let html = '';
      if (exec.length > 0) {
        html += `<optgroup label="Equipo de Ejecución">` + exec.map(t => `
          <option value="${t.id}" data-role="${t.role}" data-token="${t.device_token}">
            ${t.name} (${t.role}${t.cip_number ? ' • CIP ' + t.cip_number : ''})
          </option>
        `).join('') + `</optgroup>`;
      }
      if (sup.length > 0) {
        html += `<optgroup label="Equipo de Supervisión">` + sup.map(t => `
          <option value="${t.id}" data-role="${t.role}" data-token="${t.device_token}">
            ${t.name} (${t.role}${t.cip_number ? ' • CIP ' + t.cip_number : ''})
          </option>
        `).join('') + `</optgroup>`;
      }
      techSelect.innerHTML = html;
    } catch (err) {
      console.warn('Fallback technicians:', err);
      techSelect.innerHTML = `
        <option value="tech_quality_spec" data-role="Quality Specialist">Ing. Especialista de Calidad</option>
        <option value="tech_resident" data-role="Site Resident">Ing. Residente de Obra</option>
      `;
    }
  }

  projectSelect.addEventListener('change', async () => {
    activeProjectId = projectSelect.value;
    localStorage.setItem('protokol_active_project', activeProjectId);
    updateProjectDetails(activeProjectId);
    await loadTechnicians(activeProjectId);
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    const pin = pinInput.value.trim();

    if (pin.length !== 4) {
      errorDiv.innerText = t('identify.err_pin');
      errorDiv.style.display = 'block';
      return;
    }

    const selectedProj = projectSelect.value;
    const selectedOpt = techSelect.options[techSelect.selectedIndex];
    if (!selectedOpt) return;

    const techId = techSelect.value;
    const role = selectedOpt.getAttribute('data-role');
    const name = selectedOpt.text.split('(')[0].trim();
    const deviceToken = selectedOpt.getAttribute('data-token') || currentToken;

    // Verify PIN via server
    try {
      const res = await fetch('/api/technicians/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProj, pin })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'PIN inválido');
      }

      const verified = await res.json();
      const session = {
        project_id: selectedProj,
        technician_id: verified.technician_id || techId,
        name: verified.name || name,
        role: verified.role || role,
        device_token: verified.device_token || deviceToken
      };

      localStorage.setItem('protokol_active_project', selectedProj);
      localStorage.setItem('protokol_tech_id', session.technician_id);
      localStorage.setItem('protokol_device_token', session.device_token);
      await setConfigItem('session', session);

      onAuthenticated(session);
    } catch (err) {
      errorDiv.innerText = err.message;
      errorDiv.style.display = 'block';
    }
  });

  loadProjects();
}
