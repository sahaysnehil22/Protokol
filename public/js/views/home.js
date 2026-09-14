// PROTOKOL — View: Home & Activity Selector

export function renderHomeView(container, session, onSelectActivity, onOpenStatusView) {
  container.innerHTML = `
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <span style="font-size: 11px; font-weight: 800; color: #0284C7; letter-spacing: 0.5px; text-transform: uppercase;">
            Proyecto AY-728-001 (Ayacucho)
          </span>
          <h1 style="font-size: 22px; font-weight: 900; color: #0F172A; margin-top: 2px;">
            Registro de Calidad en Campo
          </h1>
          <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: 2px;">
            ${session.name} <span style="color: var(--color-text-muted);">• ${session.role}</span>
          </p>
        </div>
      </div>
    </div>

    <!-- 4 Pilot Activities (Section 2 & 7.1) -->
    <div style="margin-bottom: 8px;">
      <span style="font-size: 12px; font-weight: 800; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.5px;">
        Seleccione Actividad a Liberar
      </span>
    </div>

    <div class="activity-grid">
      <!-- 1. CONCRETE -->
      <button class="activity-card" id="btn-act-concrete">
        <div class="activity-icon">🏗️</div>
        <div class="activity-title">1. CONCRETO</div>
        <div class="activity-desc">
          Vaciado de losas, asentamiento (slump), guía, probetas y <strong>checklist previo de encofrado</strong>.
        </div>
      </button>

      <!-- 2. SURVEY -->
      <button class="activity-card" id="btn-act-survey">
        <div class="activity-icon">📐</div>
        <div class="activity-title">2. TOPOGRAFÍA</div>
        <div class="activity-desc">
          Nivelación geométrica, cota de rasante y tolerancia de elevación (≤ 1 cm).
        </div>
      </button>

      <!-- 3. COMPACTION -->
      <button class="activity-card" id="btn-act-compaction">
        <div class="activity-icon">🚜</div>
        <div class="activity-title">3. COMPACTACIÓN</div>
        <div class="activity-desc">
          Densidad in-situ (≥100% Proctor Modificado), humedad y espesor de capas base/sub-base.
        </div>
      </button>

      <!-- 4. STEEL -->
      <button class="activity-card" id="btn-act-steel">
        <div class="activity-icon">🔩</div>
        <div class="activity-title">4. ACERO</div>
        <div class="activity-desc">
          Armadura de refuerzo, espaciamiento entre varillas y recubrimiento mínimo.
        </div>
      </button>
    </div>

    <!-- Quality Specialist Quick Status View Access -->
    <div style="margin-top: 28px;">
      <button class="btn btn-outline" id="btn-status-view" style="font-size: 14px;">
        📊 Vista de Estado del Especialista de Calidad →
      </button>
    </div>
  `;

  container.querySelector('#btn-act-concrete').addEventListener('click', () => onSelectActivity('CONCRETE'));
  container.querySelector('#btn-act-survey').addEventListener('click', () => onSelectActivity('SURVEY'));
  container.querySelector('#btn-act-compaction').addEventListener('click', () => onSelectActivity('COMPACTION'));
  container.querySelector('#btn-act-steel').addEventListener('click', () => onSelectActivity('STEEL'));
  container.querySelector('#btn-status-view').addEventListener('click', () => onOpenStatusView());
}
