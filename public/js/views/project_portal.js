// PROTOKOL — View: Project Portal (Landing Hub)
import { t } from '../i18n.js';

export async function renderProjectPortalView(container, onSelectProject, onOpenProjectSetup) {
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

      <!-- Search Bar -->
      <div style="margin-top: 18px;">
        <input 
          type="text" 
          id="portal-search" 
          class="form-input" 
          placeholder="${t('portal.search')}"
          style="font-size: 13px; padding-left: 12px;"
        />
      </div>
    </div>

    <!-- Projects List Grid -->
    <div id="portal-projects-list" style="display: flex; flex-direction: column; gap: 14px;">
      <div style="text-align: center; padding: 40px; color: var(--color-text-muted);">
        <div style="font-size: 28px; animation: pulse 1s infinite;">⚙️</div>
        <p style="margin-top: 8px; font-size: 13px;">Cargando proyectos...</p>
      </div>
    </div>
  `;

  const projectsContainer = container.querySelector('#portal-projects-list');
  const searchInput = container.querySelector('#portal-search');
  const createBtn = container.querySelector('#btn-portal-create');

  createBtn.addEventListener('click', () => onOpenProjectSetup());

  let allProjects = [];

  async function loadProjects() {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Error al conectar con la base de datos de proyectos');
      allProjects = await res.json();
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
      <div class="card project-card" data-id="${p.id}" style="cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease; border-left: 4px solid #0284C7; position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="font-size: 11px; font-weight: 800; color: #0284C7; background: #E0F2FE; padding: 2px 8px; border-radius: 6px; letter-spacing: 0.5px;">
                ${p.id}
              </span>
              <span style="font-size: 11px; color: var(--color-text-muted); font-weight: 600;">
                ${p.contract_number || 'Contrato sin número'}
              </span>
            </div>

            <h3 style="font-size: 16px; font-weight: 800; color: #0F172A; margin: 8px 0 4px 0; line-height: 1.3;">
              ${p.name}
            </h3>

            <div style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 8px;">
              🏢 <strong>${p.entity}</strong> • 📍 ${p.location || 'Perú'}
            </div>

            ${p.road_section ? `
              <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px;">
                🛣️ Tramo: ${p.road_section}
              </div>
            ` : ''}

            <!-- Badges info -->
            <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">
              <span style="font-size: 11px; background: #F1F5F9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                🧪 ${t('portal.sampling')}: ${p.cylinders_per_truck || 4} probetas/mixer
              </span>
              <span style="font-size: 11px; background: #F1F5F9; color: #475569; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                💪 ${t('portal.default_fc')}: ${p.default_design_fc || 210} kg/cm²
              </span>
            </div>
          </div>

          <div style="align-self: center;">
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
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        onSelectProject(id);
      });
    });
  }

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderProjects(allProjects);
      return;
    }
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
