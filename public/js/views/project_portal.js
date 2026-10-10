// PROTOKOL — View: Project Portal (Landing Hub)
// 2026-10-03: "my projects" dashboard (scope=mine), archive/restore with PIN.
import { t } from '../i18n.js';
import { icon } from '../icons.js';

export async function renderProjectPortalView(container, onSelectProject, onOpenProjectSetup) {
  const deviceToken = localStorage.getItem('protokol_device_token') || 'dvc_pilot_qa_01';

  container.innerHTML = `
    <div class="page-head">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
        <div style="flex: 1; min-width: 0;">
          <h1>${t('portal.title')}</h1>
          <p>${t('portal.subtitle')}</p>
        </div>
        <button id="btn-portal-create" class="btn btn-primary btn-sm" style="flex-shrink: 0;">
          ${t('nav.new_project')}
        </button>
      </div>

      <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
        <button id="btn-toggle-archived" class="btn btn-outline btn-sm" style="width: auto;">
          <span style="display: inline-flex; vertical-align: -3px; margin-right: 6px;">${icon('archive', 15)}</span>${t('portal.show_archived')}
        </button>
      </div>
    </div>

    <div id="portal-projects-list" class="plain-list" style="display: none;"></div>
    <div id="portal-loading" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
      <p style="margin-top: 8px; font-size: 13px;">Cargando proyectos...</p>
    </div>
    <div id="portal-empty" style="display: none;"></div>

    <!-- Archive PIN modal -->
    <div id="archive-modal" style="display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.5); z-index: 100; align-items: center; justify-content: center; padding: 20px;">
      <div class="card" style="max-width: 380px; width: 100%;">
        <h3 id="archive-modal-title" style="font-size: 16px; font-weight: 800; margin-bottom: 6px;"></h3>
        <p id="archive-modal-desc" style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 14px;"></p>
        <input type="password" id="archive-pin" class="form-input" placeholder="PIN del proyecto"
          style="text-align: center; letter-spacing: 6px; font-size: 20px;" />
        <div id="archive-error" style="color: #F87171; font-size: 13px; margin-top: 8px; display: none;"></div>
        <div style="display: flex; gap: 10px; margin-top: 16px;">
          <button id="archive-cancel" class="btn btn-outline" style="flex: 1;">${t('common.cancel')}</button>
          <button id="archive-confirm" class="btn btn-primary" style="flex: 1;"></button>
        </div>
      </div>
    </div>
  `;

  const projectsContainer = container.querySelector('#portal-projects-list');
  const loadingEl = container.querySelector('#portal-loading');
  const emptyEl = container.querySelector('#portal-empty');
  const createBtn = container.querySelector('#btn-portal-create');
  const toggleArchivedBtn = container.querySelector('#btn-toggle-archived');
  const modal = container.querySelector('#archive-modal');
  const modalTitle = container.querySelector('#archive-modal-title');
  const modalDesc = container.querySelector('#archive-modal-desc');
  const modalPin = container.querySelector('#archive-pin');
  const modalError = container.querySelector('#archive-error');
  const modalCancel = container.querySelector('#archive-cancel');
  const modalConfirm = container.querySelector('#archive-confirm');

  createBtn.addEventListener('click', () => onOpenProjectSetup());

  let allProjects = [];
  let showingArchived = false;
  let pendingArchive = null; // { id, name, action: 'archive' | 'restore' }

  async function loadProjects() {
    try {
      const url = showingArchived
        ? `/api/projects?archived=true`
        : `/api/projects?scope=mine&device_token=${encodeURIComponent(deviceToken)}`;
      let res = await fetch(url);
      if (!res.ok) throw new Error('Error al conectar con la base de datos de proyectos');
      allProjects = await res.json();
      if (!showingArchived && allProjects.length === 0) {
        // Fallback: show all (legacy projects without owner/membership)
        res = await fetch('/api/projects');
        allProjects = await res.json();
      }
      loadingEl.style.display = 'none';
      renderProjects(allProjects);
    } catch (err) {
      loadingEl.style.display = 'none';
      projectsContainer.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 24px;">
          <p style="font-weight: 600; font-size: 14px; color: var(--color-fail-text);">Error al cargar proyectos: ${err.message}</p>
          <button class="btn btn-outline btn-sm" id="btn-retry-portal" style="margin-top: 12px; width: auto;">Reintentar</button>
        </div>
      `;
      const retryBtn = emptyEl.querySelector('#btn-retry-portal');
      if (retryBtn) retryBtn.addEventListener('click', () => {
        emptyEl.style.display = 'none';
        loadingEl.style.display = 'block';
        loadProjects();
      });
    }
  }

  function openArchiveModal(project, action) {
    pendingArchive = { id: project.id, name: project.name, action };
    modalTitle.innerText = action === 'archive'
      ? t('portal.archive_title')
      : t('portal.restore_title');
    modalDesc.innerText = action === 'archive'
      ? t('portal.archive_desc').replace('{name}', project.name)
      : t('portal.restore_desc').replace('{name}', project.name);
    modalConfirm.innerText = action === 'archive' ? t('portal.archive_confirm') : t('portal.restore_confirm');
    modalPin.value = '';
    modalError.style.display = 'none';
    modal.style.display = 'flex';
    setTimeout(() => modalPin.focus(), 50);
  }

  modalCancel.addEventListener('click', () => { modal.style.display = 'none'; pendingArchive = null; });
  modal.addEventListener('click', (e) => { if (e.target === modal) { modal.style.display = 'none'; pendingArchive = null; } });

  modalConfirm.addEventListener('click', async () => {
    if (!pendingArchive) return;
    const pin = modalPin.value.trim();
    if (pin.length < 4) {
      modalError.innerText = t('identify.err_pin');
      modalError.style.display = 'block';
      return;
    }
    modalConfirm.disabled = true;
    try {
      // Verify the project PIN (establishes the session cookie), then archive/restore.
      const vRes = await fetch(`/api/projects/${pendingArchive.id}/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, device_token: deviceToken })
      });
      if (!vRes.ok) {
        const d = await vRes.json().catch(() => ({}));
        throw new Error(d.message || 'PIN incorrecto.');
      }
      const aRes = await fetch(`/api/projects/${pendingArchive.id}/${pendingArchive.action}`, { method: 'PATCH' });
      if (!aRes.ok) throw new Error('No se pudo completar la operación.');
      // Log out the archive session (it was only for this action)
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      modal.style.display = 'none';
      pendingArchive = null;
      await loadProjects();
    } catch (err) {
      modalError.innerText = err.message;
      modalError.style.display = 'block';
    } finally {
      modalConfirm.disabled = false;
    }
  });

  function renderProjects(projects) {
    if (projects.length === 0) {
      projectsContainer.style.display = 'none';
      emptyEl.style.display = 'block';
      emptyEl.innerHTML = `
        <div class="card" style="text-align: center; padding: 32px 20px;">
          <div style="display: flex; justify-content: center; margin-bottom: 12px; color: var(--color-text-muted);">
            ${icon('package', 32, 1.5)}
          </div>
          <p style="font-weight: 600; font-size: 14px; color: var(--color-text-primary);">${t('portal.empty')}</p>
          <button class="btn btn-primary btn-sm" id="btn-empty-create" style="margin-top: 14px; width: auto;">
            ${t('nav.new_project')}
          </button>
        </div>
      `;
      const emptyCreate = emptyEl.querySelector('#btn-empty-create');
      if (emptyCreate) emptyCreate.addEventListener('click', () => onOpenProjectSetup());
      return;
    }

    emptyEl.style.display = 'none';
    projectsContainer.style.display = 'block';

    projectsContainer.innerHTML = projects.map(p => `
      <div class="plain-list-item" data-id="${p.id}" role="button" tabindex="0" aria-label="${p.name.replace(/"/g, '&quot;')}">
        <div class="plain-list-main">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
            <span class="id-chip">${p.id}</span>
            ${showingArchived ? `<span class="id-chip" style="background: var(--color-surface-hover); color: var(--color-text-muted);">${t('portal.archived_badge')}</span>` : ''}
          </div>
          <div class="plain-list-title">${p.name}</div>
          <div class="plain-list-meta">
            ${icon('building', 13)}<span>${p.entity || ''}</span>
            <span aria-hidden="true">•</span>
            ${icon('map-pin', 13)}<span>${p.location || 'Perú'}</span>
            ${p.road_section ? `<span aria-hidden="true">•</span>${icon('road', 13)}<span>Tramo: ${p.road_section}</span>` : ''}
          </div>
        </div>
        ${!showingArchived ? `
        <button class="icon-btn btn-archive" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}"
          title="${t('portal.archive_title')}" aria-label="${t('portal.archive_title')}">
          ${icon('archive', 17)}
        </button>` : `
        <button class="icon-btn btn-restore" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}"
          title="${t('portal.restore_title')}" aria-label="${t('portal.restore_title')}">
          ${icon('archive-restore', 17)}
        </button>`}
        <span class="list-chevron">${icon('chevron-right', 18)}</span>
      </div>
    `).join('');

    projectsContainer.querySelectorAll('.plain-list-item').forEach(item => {
      const open = (e) => {
        if (e.target.closest('.btn-archive') || e.target.closest('.btn-restore')) return;
        onSelectProject(item.getAttribute('data-id'));
      };
      item.addEventListener('click', open);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
      });
    });

    projectsContainer.querySelectorAll('.btn-archive').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openArchiveModal({ id: btn.dataset.id, name: btn.dataset.name }, 'archive');
      });
    });
    projectsContainer.querySelectorAll('.btn-restore').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openArchiveModal({ id: btn.dataset.id, name: btn.dataset.name }, 'restore');
      });
    });
  }

  toggleArchivedBtn.addEventListener('click', () => {
    showingArchived = !showingArchived;
    toggleArchivedBtn.innerHTML = showingArchived
      ? `<span style="display: inline-flex; vertical-align: -3px; margin-right: 6px;">${icon('package', 15)}</span>${t('portal.show_active')}`
      : `<span style="display: inline-flex; vertical-align: -3px; margin-right: 6px;">${icon('archive', 15)}</span>${t('portal.show_archived')}`;
    loadingEl.style.display = 'block';
    projectsContainer.style.display = 'none';
    emptyEl.style.display = 'none';
    loadProjects();
  });

  // Header search: filter the project list.
  // Registered here so it only appears on the portal view.
  function applySearchFilter(rawQuery) {
    const q = String(rawQuery || '').toLowerCase().trim();
    if (!q) { renderProjects(allProjects); return; }
    const filtered = allProjects.filter(p =>
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.entity && p.entity.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.road_section && p.road_section.toLowerCase().includes(q))
    );
    renderProjects(filtered);
  }
  if (window.__protokolApp) {
    window.__protokolApp.setHeaderSearchHandler(applySearchFilter, t('portal.search'));
  }

  loadProjects();
}
