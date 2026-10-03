// PROTOKOL — View: Project Access (two-tier auth, 2026-10-03)
//
// Tier 1 — PROJECT PIN (centralized, set by the company at project creation,
// shared with the crew). This screen verifies it and establishes the session.
// Tier 2 — PERSONAL signer PINs are used later, at signature time (per box).
// Employees CANNOT change the project PIN (product decision).
import { setConfigItem, getConfigItem, cacheCriteria } from '../db.js';
import { t } from '../i18n.js';

async function sha256hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function renderIdentifyView(container, onAuthenticated, onOpenProjectSetup, onBackToPortal) {
  const currentToken = localStorage.getItem('protokol_device_token') || 'dvc_pilot_qa_01';
  let activeProjectId = localStorage.getItem('protokol_active_project') || '';

  container.innerHTML = `
    <div style="margin-bottom: 10px;">
      <button type="button" id="btn-back-to-portal" class="btn btn-outline" style="font-size: 12px; padding: 4px 12px; height: 32px; min-height: 32px;">
        ${t('portal.change_project')}
      </button>
    </div>

    <div class="card" style="margin-top: 6px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">🔐</div>
        <h2 style="font-size: 20px; font-weight: 800; color: #0F172A;">${t('identify.title')}</h2>
        <p id="project-subtitle" style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">...</p>
        <p id="offline-badge" style="display:none; font-size: 12px; color: #B45309; background: #FEF3C7; border-radius: 6px; padding: 4px 10px; margin-top: 8px;">
          📴 ${t('identify.offline_mode')}
        </p>
      </div>

      <form id="identify-form">
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

        <!-- Identity selector (attribution only — no PIN here) -->
        <div class="form-group">
          <label class="form-label">${t('identify.select_tech')}</label>
          <select id="tech-select" class="form-input" style="font-size: 14px;">
            <option value="">Seleccione un proyecto primero</option>
          </select>
        </div>

        <!-- Centralized PROJECT PIN -->
        <div class="form-group">
          <label class="form-label">${t('identify.project_pin_label')}</label>
          <div style="position: relative;">
            <input
              type="password"
              id="project-pin"
              class="form-input"
              placeholder="••••••"
              autocomplete="off"
              required
              style="text-align: center; letter-spacing: 6px; font-size: 22px; padding-right: 44px;"
            />
            <button type="button" id="pin-toggle" aria-label="Mostrar / ocultar PIN"
              style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px;">
              👁️
            </button>
          </div>
          <span class="form-label-hint">${t('identify.project_pin_hint')}</span>
        </div>

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
        <div id="identify-lock" style="color: #B45309; font-size: 13px; margin-bottom: 14px; display: none;"></div>

        <button type="submit" id="identify-submit" class="btn btn-primary">
          ${t('identify.btn_submit')}
        </button>
      </form>
    </div>
  `;

  const projectSelect = container.querySelector('#project-select');
  const techSelect = container.querySelector('#tech-select');
  const projectSubtitle = container.querySelector('#project-subtitle');
  const offlineBadge = container.querySelector('#offline-badge');
  const pinInput = container.querySelector('#project-pin');
  const pinToggle = container.querySelector('#pin-toggle');
  const form = container.querySelector('#identify-form');
  const errorDiv = container.querySelector('#identify-error');
  const lockDiv = container.querySelector('#identify-lock');
  const submitBtn = container.querySelector('#identify-submit');
  const gotoSetupBtn = container.querySelector('#btn-goto-setup');

  gotoSetupBtn.addEventListener('click', () => onOpenProjectSetup());
  const backToPortalBtn = container.querySelector('#btn-back-to-portal');
  if (backToPortalBtn && onBackToPortal) backToPortalBtn.addEventListener('click', () => onBackToPortal());

  // Show/hide toggle for the PIN (never prefill — C-01)
  pinToggle.addEventListener('click', () => {
    const show = pinInput.type === 'password';
    pinInput.type = show ? 'text' : 'password';
    pinToggle.textContent = show ? '🙈' : '👁️';
  });

  let projectsList = [];
  let lockUntil = 0;
  let lockTimer = null;

  function showLock(seconds) {
    lockUntil = Date.now() + seconds * 1000;
    submitBtn.disabled = true;
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
      if (left <= 0) {
        lockDiv.style.display = 'none';
        submitBtn.disabled = false;
        if (lockTimer) clearInterval(lockTimer);
        return;
      }
      lockDiv.style.display = 'block';
      lockDiv.innerText = t('identify.locked_retry').replace('{s}', left);
    };
    tick();
    if (lockTimer) clearInterval(lockTimer);
    lockTimer = setInterval(tick, 1000);
  }

  async function loadProjects() {
    try {
      // "My projects" first (owned/joined on this device); falls back to all.
      let res = await fetch(`/api/projects?scope=mine&device_token=${encodeURIComponent(currentToken)}`);
      if (!res.ok) throw new Error('Error al cargar proyectos');
      projectsList = await res.json();
      if (projectsList.length === 0) {
        res = await fetch('/api/projects');
        projectsList = await res.json();
      }
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
        projectSelect.value = activeProjectId;
      }
      updateProjectDetails(activeProjectId);
      await loadTechnicians(activeProjectId);
    } catch (err) {
      console.error(err);
      if (!navigator.onLine) {
        // Offline: offer projects cached from previous logins.
        const cached = await getConfigItem('offline_projects');
        if (cached && cached.length > 0) {
          projectsList = cached;
          projectSelect.innerHTML = projectsList.map(p =>
            `<option value="${p.id}">${p.name} (${p.id})</option>`).join('');
          activeProjectId = projectsList[0].id;
          offlineBadge.style.display = 'block';
          await loadTechnicians(activeProjectId);
          return;
        }
      }
      projectSelect.innerHTML = '<option value="">Sin conexión y sin proyectos en caché</option>';
    }
  }

  function updateProjectDetails(projId) {
    const proj = projectsList.find(p => p.id === projId);
    if (proj) {
      projectSubtitle.innerText = `${proj.road_section || proj.location || ''} • ${proj.entity || ''}`;
    }
  }

  async function loadTechnicians(projId) {
    try {
      const res = await fetch(`/api/projects/${projId}/technicians`);
      let techs;
      if (res.ok) {
        techs = await res.json();
        await setConfigItem(`techs_${projId}`, techs); // offline cache
      } else {
        techs = (await getConfigItem(`techs_${projId}`)) || [];
      }
      if (!techs || techs.length === 0) {
        // Offline without cache: allow continuing without identity attribution
        techSelect.innerHTML = '<option value="">Sin técnicos (modo sin conexión)</option>';
        return;
      }
      const exec = techs.filter(t => !String(t.role || '').toLowerCase().includes('supervis'));
      const sup = techs.filter(t => String(t.role || '').toLowerCase().includes('supervis'));
      let html = '';
      if (exec.length > 0) {
        html += `<optgroup label="Equipo de Ejecución">` + exec.map(t => `
          <option value="${t.id}" data-role="${t.role}" data-token="${t.device_token || ''}">
            ${t.name} (${t.role}${t.cip_number ? ' • CIP ' + t.cip_number : ''})
          </option>`).join('') + `</optgroup>`;
      }
      if (sup.length > 0) {
        html += `<optgroup label="Equipo de Supervisión">` + sup.map(t => `
          <option value="${t.id}" data-role="${t.role}" data-token="${t.device_token || ''}">
            ${t.name} (${t.role}${t.cip_number ? ' • CIP ' + t.cip_number : ''})
          </option>`).join('') + `</optgroup>`;
      }
      techSelect.innerHTML = html;
    } catch (err) {
      console.warn('Technicians load failed:', err);
      techSelect.innerHTML = '<option value="">Sin técnicos disponibles</option>';
    }
  }

  projectSelect.addEventListener('change', async () => {
    activeProjectId = projectSelect.value;
    localStorage.setItem('protokol_active_project', activeProjectId);
    updateProjectDetails(activeProjectId);
    await loadTechnicians(activeProjectId);
  });

  /** Cache what offline mode needs: PIN hash, criteria, checklist templates. */
  async function primeOfflineCache(projectId, pin) {
    try {
      // PIN hash salted with the device token (per-device, not a global salt).
      const hash = await sha256hex(`${currentToken}:${pin}`);
      await setConfigItem(`offline_pin_${projectId}`, { hash, saved_at: new Date().toISOString() });
      await setConfigItem('offline_projects', projectsList.map(p => ({ id: p.id, name: p.name })));
      const critRes = await fetch(`/api/projects/${projectId}/criteria`);
      if (critRes.ok) await cacheCriteria(await critRes.json());
      // Checklist templates per activity
      for (const activity of ['CONCRETE', 'SOIL_COMPACTION', 'STEEL', 'FORMWORK']) {
        try {
          const tr = await fetch(`/api/projects/${projectId}/checklist-templates?activity=${activity}`);
          if (tr.ok) {
            const items = await tr.json();
            await setConfigItem(`templates_${projectId}_${activity}`, items);
          }
        } catch { /* best effort */ }
      }
    } catch (e) {
      console.warn('Offline cache priming failed (non-blocking):', e);
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    lockDiv.style.display = 'none';
    const pin = pinInput.value.trim();
    if (pin.length < 4) {
      errorDiv.innerText = t('identify.err_pin');
      errorDiv.style.display = 'block';
      return;
    }
    const selectedProj = projectSelect.value;
    if (!selectedProj) {
      errorDiv.innerText = t('identify.err_no_project');
      errorDiv.style.display = 'block';
      return;
    }
    const selectedOpt = techSelect.options[techSelect.selectedIndex];
    const techId = techSelect.value || null;
    const role = selectedOpt ? selectedOpt.getAttribute('data-role') : '';
    const name = selectedOpt ? selectedOpt.text.split('(')[0].trim() : '';

    // --- Offline path (D-10): verify against the cached PIN hash ---
    if (!navigator.onLine) {
      const cached = await getConfigItem(`offline_pin_${selectedProj}`);
      if (cached && cached.hash === await sha256hex(`${currentToken}:${pin}`)) {
        offlineBadge.style.display = 'block';
        const session = {
          project_id: selectedProj, technician_id: techId, name, role,
          device_token: currentToken, offline: true,
        };
        localStorage.setItem('protokol_active_project', selectedProj);
        if (techId) localStorage.setItem('protokol_tech_id', techId);
        localStorage.setItem('protokol_device_token', currentToken);
        await setConfigItem('session', session);
        onAuthenticated(session);
      } else {
        errorDiv.innerText = t('identify.err_offline_pin');
        errorDiv.style.display = 'block';
      }
      return;
    }

    // --- Online path: server verifies the centralized project PIN ---
    submitBtn.disabled = true;
    try {
      const res = await fetch(`/api/projects/${selectedProj}/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, device_token: currentToken })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 423) {
        showLock(data.retry_after_seconds || 900);
        return;
      }
      if (!res.ok) {
        const left = data.attempts_remaining;
        throw new Error(
          (data.message || 'PIN incorrecto.') +
          (typeof left === 'number' ? ` (${t('identify.attempts_left').replace('{n}', left)})` : '')
        );
      }
      const session = {
        project_id: selectedProj, technician_id: techId, name, role,
        device_token: currentToken, offline: false,
      };
      localStorage.setItem('protokol_active_project', selectedProj);
      if (techId) localStorage.setItem('protokol_tech_id', techId);
      localStorage.setItem('protokol_device_token', currentToken);
      await setConfigItem('session', session);
      await primeOfflineCache(selectedProj, pin);
      pinInput.value = ''; // never keep the PIN in the DOM
      onAuthenticated(session);
    } catch (err) {
      errorDiv.innerText = err.message;
      errorDiv.style.display = 'block';
    } finally {
      if (Date.now() >= lockUntil) submitBtn.disabled = false;
    }
  });

  loadProjects();
}
