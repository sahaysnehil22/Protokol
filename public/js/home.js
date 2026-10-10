// PROTOKOL — View: Home & Activity Selector
import { t } from '../i18n.js';
import { icon } from '../icons.js';

export function renderHomeView(container, session, onSelectActivity, onOpenStatusView, onOpenProjectSetup, onOpenPortal) {
  const projectId = session.project_id || localStorage.getItem('protokol_active_project') || 'AY-728-001';

  container.innerHTML = `
    <div class="page-head">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
        <div style="flex: 1; min-width: 0;">
          <span class="id-chip">${projectId}</span>
          <h1 style="margin-top: 6px;">${t('home.quality_record')}</h1>
          <p>${session.name} <span style="color: var(--color-text-muted);">• ${session.role}</span></p>
        </div>
        <button id="btn-back-portal" class="btn btn-outline btn-sm" style="white-space: nowrap; flex-shrink: 0;">
          ${t('portal.change_project')}
        </button>
      </div>
    </div>

    <!-- Site Sequence Workflows -->
    <div style="margin-bottom: 10px;">
      <span style="font-size: var(--font-size-caption); font-weight: 600; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.6px;">
        ${t('home.select_activity')}
      </span>
    </div>

    <div class="activity-grid">
      <!-- 1. SURVEY (Topografía) -->
      <button class="activity-card" id="btn-act-survey">
        <span class="activity-icon">${icon('ruler', 19)}</span>
        <span class="activity-body">
          <span class="activity-title">1. TOPOGRAFÍA Y TRAZO</span>
          <span class="activity-desc">${t('home.act_survey_desc')}</span>
          <span class="activity-code">GCO-PVT-2026 • Rev. 01</span>
        </span>
        <span class="list-chevron">${icon('chevron-right', 18)}</span>
      </button>

      <!-- 2. FORMWORK (Encofrado) -->
      <button class="activity-card" id="btn-act-formwork">
        <span class="activity-icon">${icon('layers', 19)}</span>
        <span class="activity-body">
          <span class="activity-title">2. ENCOFRADO Y DESENCOFRADO</span>
          <span class="activity-desc">${t('home.act_formwork_desc')}</span>
          <span class="activity-code">GDC-PDE-2026 • Versión 001</span>
        </span>
        <span class="list-chevron">${icon('chevron-right', 18)}</span>
      </button>

      <!-- 3. STEEL (Acero) -->
      <button class="activity-card" id="btn-act-steel">
        <span class="activity-icon">${icon('grid', 19)}</span>
        <span class="activity-body">
          <span class="activity-title">3. ACERO DE REFUERZO</span>
          <span class="activity-desc">${t('home.act_steel_desc')}</span>
          <span class="activity-code">FO01PT03 • Versión 001</span>
        </span>
        <span class="list-chevron">${icon('chevron-right', 18)}</span>
      </button>

      <!-- 4. CONCRETE (Pavimento) -->
      <button class="activity-card" id="btn-act-concrete">
        <span class="activity-icon">${icon('truck', 19)}</span>
        <span class="activity-body">
          <span class="activity-title">4. CONCRETO (PAVIMENTO RÍGIDO)</span>
          <span class="activity-desc">${t('home.act_concrete_desc')}</span>
          <span class="activity-code">GDC-PCC-2026 • Versión 001</span>
        </span>
        <span class="list-chevron">${icon('chevron-right', 18)}</span>
      </button>
    </div>

    <!-- Action Buttons -->
    <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 10px;">
      <button class="btn btn-outline" id="btn-status-view" style="font-size: 14px;">
        <span style="display: inline-flex; vertical-align: -3px; margin-right: 2px;">${icon('bar-chart', 17)}</span>${t('home.btn_status_view')}
      </button>
      <button class="btn btn-secondary" id="btn-setup-view" style="font-size: 14px;">
        <span style="display: inline-flex; vertical-align: -3px; margin-right: 2px;">${icon('clipboard-list', 17)}</span>${t('home.btn_project_config')}
      </button>
    </div>
  `;

  container.querySelector('#btn-act-survey').addEventListener('click', () => onSelectActivity('SURVEY'));
  container.querySelector('#btn-act-steel').addEventListener('click', () => onSelectActivity('STEEL'));
  container.querySelector('#btn-act-formwork').addEventListener('click', () => onSelectActivity('FORMWORK'));
  container.querySelector('#btn-act-concrete').addEventListener('click', () => onSelectActivity('CONCRETE'));
  container.querySelector('#btn-status-view').addEventListener('click', () => onOpenStatusView());
  container.querySelector('#btn-setup-view').addEventListener('click', () => onOpenProjectSetup());

  const backPortalBtn = container.querySelector('#btn-back-portal');
  if (backPortalBtn && onOpenPortal) {
    backPortalBtn.addEventListener('click', () => onOpenPortal());
  }
}
