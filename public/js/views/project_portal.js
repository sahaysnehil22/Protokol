// PROTOKOL — View: Project Portal (Landing Hub)
// 2026-10-03: "my projects" dashboard (scope=mine), archive/restore with PIN.
import { t } from '../i18n.js';

export async function renderProjectPortalView(container, onSelectProject, onOpenProjectSetup) {
  const deviceToken = localStorage.getItem('protokol_device_token') || 'dvc_pilot_qa_01';

  container.innerHTML = `
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div>
          <h1 style="font-size: 22px; font-weight: 900; color: #0F172A; margin: 0;">
            ${t('portal.title')}
          </h1>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin: 4px 0 0 0;">
            ${t('portal.subtitle')}
          </p>
        </div>
        <button id="btn-portal-create" class="btn btn-primary" style="padding: 0 16px; height: 38px; min-height: 38px; font-size: 13px;">
          ${t('nav.new_project')}
        </button>
      </div>

      <div style="margin-top: 18px; display: flex; gap: 10px;">
        <input
          type="text"
          id="portal-search"
          class="form-input"
          placeholder="${t('portal.search')}"
          style="font-size: 13px; padding-left: 12px; flex: 1;"
        />
        <button id="btn-toggle-archived" class="btn btn-outline" style="font-size: 12px; white-space: nowrap;">
          📦 ${t('portal.show_archived')}
        </button>
      </div>
    </div>

    <div id="portal-projects-list" style="display: flex; flex-direction: column; gap: 14px;">
      <div style="text-align: center; padding: 40px; color: var(--color-text-muted);">
        <div style="font-size: 28px; animation: pulse 1s infinite;">⚙️</div>
        <p style="margin-top: 8px; font-size: 13px;">Cargando proyectos...</p>
      </div>
    </div>

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
  const searchInput = container.querySelector('#portal-search');
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
      renderProjects(allProjects);
    } catch (err) {
      projectsContainer.innerHTML = `
        <div class="card" style="text-align: center; color: #EF4444; padding: 30px;">
          <p style="font-weight: 700;">Error al cargar proyectos: ${err.message}</p>
          <button class="btn btn-outline" id="btn-retry-portal" style="margin-top: 10px;">Reintentar</button>
        </div>
      `;
      const retryBtn = projectsContainer.querySelector('#btn-retry-portal');
      if (retryBtn) retryBtn.addEventListener('click', loadProjects);
    }
  }

  function openArchiveModal(project, action) {
    pendingArchive = { id: project.id, name: project.name, action };
    modalTitle.innerText = action === 'archive'
      ? `📦 ${t('portal.archive_title')}`
      : `♻️ ${t('portal.restore_title')}`;
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
      projectsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 40px; color: var(--color-text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📂</div>
          <p style="font-weight: 700; font-size: 14px; color: #334155;">${t('portal.empty')}</p>
          <button class="btn btn-primary" id="btn-empty-create" style="margin-top: 14px;">
            ${t('nav.new_project')}
          </button>
        </div>
      `;
      const emptyCreate = projectsContainer.querySelector('#btn-empty-create');
      if (emptyCreate) emptyCreate.addEventListener('click', () => onOpenProjectSetup());
      return;
    }

    projectsContainer.innerHTML = projects.map(p => `
      <div class="card project-card" data-id="${p.id}" style="cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; border-left: 4px solid ${showingArchived ? '#94A3B8' : '#0284C7'}; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 11px; font-weight: 800; color: #0284C7; background: #E0F2FE; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px;">
                ${p.id}
              </span>
              ${showingArchived ? `<span style="font-size: 11px; font-weight: 700; color: #64748B; background: #F1F5F9; padding: 2px 8px; border-radius: 6px;">📦 ${t('portal.archived_badge')}</span>` : ''}
            </div>
            <h3 style="font-size: 16px; font-weight: 800; color: #0F172A; margin: 8px 0 4px 0; line-height: 1.3;">
              ${p.name}
            </h3>
            <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px;">
              🏢 <strong>${p.entity || ''}</strong> • 📍 ${p.location || 'Perú'}
            </div>
            ${p.road_section ? `
              <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px;">
                🛣️ Tramo: ${p.road_section}
              </div>
            ` : ''}
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
            ${!showingArchived ? `
            <button class="btn-archive" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}"
              title="${t('portal.archive_title')}"
              style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px;" >
              📦
            </button>` : `
            <button class="btn-restore" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}"
              title="${t('portal.restore_title')}"
              style="background: none; border: none; font-size: 16px; cursor: pointer; padding: 4px;">
              ♻️
            </button>`}
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #F0F9FF; color: #0284C7; border-radius: 50%; font-size: 18px; font-weight: bold;">
              →
            </span>
          </div>
        </div>
      </div>
    `).join('');

    projectsContainer.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '';
      });
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-archive') || e.target.closest('.btn-restore')) return;
        onSelectProject(card.getAttribute('data-id'));
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
      ? `📂 ${t('portal.show_active')}`
      : `📦 ${t('portal.show_archived')}`;
    loadProjects();
  });

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) { renderProjects(allProjects); return; }
    const filtered = allProjects.filter(p =>
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.entity && p.entity.toLowerCase().includes(q)) ||
      (p.location && p.location.toLowerCase().includes(q)) ||
      (p.road_section && p.road_section.toLowerCase().includes(q))
    );
    renderProjects(filtered);
  });

  loadProjects();
}
