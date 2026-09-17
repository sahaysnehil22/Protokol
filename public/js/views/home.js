// PROTOKOL — View: Home & Activity Selector
import { t } from '../i18n.js';

export function renderHomeView(container, session, onSelectActivity, onOpenStatusView, onOpenProjectSetup, onOpenPortal) {
  const projectId = session.project_id || localStorage.getItem('protokol_active_project') || 'AY-728-001';

  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; font-weight: 800; color: #0284C7; letter-spacing: 0.5px; text-transform: uppercase;">
              ${projectId}
            </span>
          </div>
          <h1 style="font-size: 22px; font-weight: 900; color: #0F172A; margin-top: 2px;">
            ${t('home.quality_record')}
          </h1>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: 2px;">
            ${session.name} <span style="color: var(--color-text-muted);">• ${session.role}</span>
          </p>
        </div>
        <button id="btn-back-portal" class="btn btn-outline" style="font-size: 11px; padding: 2px 10px; height: 30px; min-height: 30px; white-space: nowrap;">
          ${t('portal.change_project')}
        </button>
      </div>
    </div>

    <!-- 4 Activities -->
    <div style="margin-bottom: 8px;">
      <span style="font-size: 12px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
        ${t('home.select_activity')}
      </span>
    </div>

    <div class="activity-grid">
      <!-- 1. CONCRETE -->
      <button class="activity-card" id="btn-act-concrete">
        <div class="activity-icon">🏗️</div>
        <div class="activity-title">${t('home.act_concrete_title')}</div>
        <div class="activity-desc">${t('home.act_concrete_desc')}</div>
      </button>

      <!-- 2. SURVEY -->
      <button class="activity-card" id="btn-act-survey">
        <div class="activity-icon">📐</div>
        <div class="activity-title">${t('home.act_survey_title')}</div>
        <div class="activity-desc">${t('home.act_survey_desc')}</div>
      </button>

      <!-- 3. COMPACTION -->
      <button class="activity-card" id="btn-act-compaction">
        <div class="activity-icon">🚜</div>
        <div class="activity-title">${t('home.act_compaction_title')}</div>
        <div class="activity-desc">${t('home.act_compaction_desc')}</div>
      </button>

      <!-- 4. STEEL -->
      <button class="activity-card" id="btn-act-steel">
        <div class="activity-icon">🔩</div>
        <div class="activity-title">${t('home.act_steel_title')}</div>
        <div class="activity-desc">${t('home.act_steel_desc')}</div>
      </button>
    </div>

    <!-- Action Buttons -->
    <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 10px;">
      <button class="btn btn-outline" id="btn-status-view" style="font-size: 14px;">
        ${t('home.btn_status_view')}
      </button>
      <button class="btn btn-secondary" id="btn-setup-view" style="font-size: 13px;">
        ${t('home.btn_project_config')}
      </button>
    </div>
  `;

  container.querySelector('#btn-act-concrete').addEventListener('click', () => onSelectActivity('CONCRETE'));
  container.querySelector('#btn-act-survey').addEventListener('click', () => onSelectActivity('SURVEY'));
  container.querySelector('#btn-act-compaction').addEventListener('click', () => onSelectActivity('COMPACTION'));
  container.querySelector('#btn-act-steel').addEventListener('click', () => onSelectActivity('STEEL'));
  container.querySelector('#btn-status-view').addEventListener('click', () => onOpenStatusView());
  container.querySelector('#btn-setup-view').addEventListener('click', () => onOpenProjectSetup());

  const backPortalBtn = container.querySelector('#btn-back-portal');
  if (backPortalBtn && onOpenPortal) {
    backPortalBtn.addEventListener('click', () => onOpenPortal());
  }
}
