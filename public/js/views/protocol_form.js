// PROTOKOL — View: 4-Step Guided Protocol Wizard
// Supports v2.4 Dynamic Concrete Pour Architecture (1 to 20+ Ready-Mix Trucks)
import { getDeviceLocation } from '../location.js';
import { queueSubmission, storeLocalPhoto } from '../db.js';
import { t, getLanguage } from '../i18n.js';

export async function renderProtocolFormView(container, activity, session, onCompleted, onCancel) {
  let currentStep = 1;
  let acknowledgedNC = false;
  const projectId = session.project_id || 'AY-728-001';

  // Default criteria fallback
  const defaultCriteria = {
    slump_cm: { field: 'slump_cm', operator: 'BETWEEN', min_value: 8.9, max_value: 12.7, unit: 'cm' },
    cylinders_cast: { field: 'cylinders_cast', operator: 'GTE', min_value: 4, unit: 'probetas' },
    formwork_approved: { field: 'formwork_approved', operator: 'EQ', expected_value: 'true' },
    elevation_deviation: { field: 'elevation_deviation', operator: 'LTE', max_value: 1.0, unit: 'cm' },
    compaction_pct: { field: 'compaction_pct', operator: 'GTE', min_value: 100.0, unit: '%' },
    moisture_deviation: { field: 'moisture_deviation', operator: 'LTE', max_value: 1.5, unit: '%' },
    sub_base_thickness: { field: 'sub_base_thickness', operator: 'GTE', min_value: 20.0, unit: 'cm' },
    base_thickness: { field: 'base_thickness', operator: 'GTE', min_value: 25.0, unit: 'cm' },
    bar_spacing_cm: { field: 'bar_spacing_cm', operator: 'BETWEEN', min_value: 14.0, max_value: 16.0, unit: 'cm' },
    concrete_cover_cm: { field: 'concrete_cover_cm', operator: 'GTE', min_value: 5.0, unit: 'cm' }
  };

  // Load project criteria for client-side hints & live validation
  let criteriaMap = { ...defaultCriteria };
  try {
    const res = await fetch(`/api/projects/${projectId}/criteria`);
    if (res.ok) {
      const crits = await res.json();
      crits.forEach(c => { criteriaMap[c.field] = c; });
    }
  } catch {
    // offline fallback
  }

  // Initial concrete trucks state
  let trucksState = [
    {
      truck_number: 1,
      mixer_id: '6D37',
      delivery_note: 'GR-00412',
      slump_cm: '10.5',
      cylinders_cast: 4,
      design_fc: 280,
      notes: ''
    }
  ];

  const formData = {
    activity,
    chainage: '0+144',
    panel: '15',
    gps: { lat: -13.1588, lng: -74.2236, accuracy: 10 },
    measurements: {
      formwork_approved: true
    },
    localPhotos: [], // Array of { id, blob, dataUrl }
    notes: ''
  };

  // Pre-fetch GPS coordinates in background
  getDeviceLocation().then(loc => {
    formData.gps = loc;
    const gpsEl = container.querySelector('#gps-display');
    if (gpsEl) {
      gpsEl.innerText = `${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)} (±${loc.accuracy}m)`;
    }
  });

  // Evaluate any single criterion rule
  function evaluateCriterion(crit, val) {
    if (!crit) return { valid: true };
    const num = typeof val === 'number' ? val : parseFloat(val);
    if (isNaN(num)) return { valid: false, error: 'Valor inválido' };

    if (crit.operator === 'BETWEEN') {
      const valid = num >= crit.min_value && num <= crit.max_value;
      const range = `${crit.min_value} - ${crit.max_value}`;
      return {
        valid,
        range,
        error: valid ? null : t('validation.slump_out', { range })
      };
    }
    if (crit.operator === 'GTE') {
      const valid = num >= crit.min_value;
      return {
        valid,
        min: crit.min_value,
        error: valid ? null : `Menor al mínimo exigido (≥ ${crit.min_value} ${crit.unit || ''})`
      };
    }
    if (crit.operator === 'LTE') {
      const valid = num <= crit.max_value;
      return {
        valid,
        max: crit.max_value,
        error: valid ? null : `Supera la tolerancia máxima (≤ ${crit.max_value} ${crit.unit || ''})`
      };
    }
    if (crit.operator === 'EQ') {
      const valid = String(val).toLowerCase() === String(crit.expected_value).toLowerCase();
      return { valid, error: valid ? null : 'Requisito previo no verificado' };
    }
    return { valid: true };
  }

  // Scan current measurements for non-conformances
  function checkNonConformances() {
    const issues = [];
    if (activity === 'CONCRETE') {
      if (formData.measurements.formwork_approved === false) {
        issues.push('Checklist Previo de Encofrado: No aprobado');
      }
      const slumpCrit = criteriaMap['slump_cm'] || { min_value: 8.9, max_value: 12.7 };
      const cylCrit = criteriaMap['cylinders_cast'] || { min_value: 4 };
      trucksState.forEach(t => {
        const s = parseFloat(t.slump_cm);
        if (!isNaN(s) && (s < slumpCrit.min_value || s > slumpCrit.max_value)) {
          issues.push(`Camión Mixer #${t.truck_number} (${t.mixer_id}): Asentamiento (slump) de ${s} cm fuera de tolerancia (${slumpCrit.min_value} - ${slumpCrit.max_value} cm)`);
        }
        const c = parseInt(t.cylinders_cast, 10);
        if (!isNaN(c) && c < (cylCrit.min_value || 4)) {
          issues.push(`Camión Mixer #${t.truck_number}: Solo ${c} probetas moldeadas (mínimo ${cylCrit.min_value || 4})`);
        }
      });
    } else if (activity === 'SURVEY') {
      const dev = Math.abs(parseFloat(formData.measurements.elevation_deviation));
      const maxDev = criteriaMap['elevation_deviation']?.max_value || 1.0;
      if (!isNaN(dev) && dev > maxDev) {
        issues.push(`Desviación de cota: ${formData.measurements.elevation_deviation} cm (tolerancia: ≤ ${maxDev} cm)`);
      }
    } else if (activity === 'COMPACTION') {
      const pct = parseFloat(formData.measurements.compaction_pct);
      const minPct = criteriaMap['compaction_pct']?.min_value || 100.0;
      if (!isNaN(pct) && pct < minPct) {
        issues.push(`Grado de compactación: ${pct}% (mínimo exigido: ≥ ${minPct}%)`);
      }
      const moist = Math.abs(parseFloat(formData.measurements.moisture_deviation));
      const maxMoist = criteriaMap['moisture_deviation']?.max_value || 1.5;
      if (!isNaN(moist) && moist > maxMoist) {
        issues.push(`Desviación de humedad: ${formData.measurements.moisture_deviation}% (tolerancia: ±${maxMoist}%)`);
      }
      const sub = parseFloat(formData.measurements.sub_base_thickness);
      const minSub = criteriaMap['sub_base_thickness']?.min_value || 20.0;
      if (!isNaN(sub) && sub < minSub) {
        issues.push(`Espesor sub-base: ${sub} cm (mínimo: ≥ ${minSub} cm)`);
      }
      const base = parseFloat(formData.measurements.base_thickness);
      const minBase = criteriaMap['base_thickness']?.min_value || 25.0;
      if (!isNaN(base) && base < minBase) {
        issues.push(`Espesor base: ${base} cm (mínimo: ≥ ${minBase} cm)`);
      }
    } else if (activity === 'STEEL') {
      const sp = parseFloat(formData.measurements.bar_spacing_cm);
      const spCrit = criteriaMap['bar_spacing_cm'] || { min_value: 14.0, max_value: 16.0 };
      if (!isNaN(sp) && (sp < spCrit.min_value || sp > spCrit.max_value)) {
        issues.push(`Espaciamiento de acero: ${sp} cm (tolerancia: ${spCrit.min_value} - ${spCrit.max_value} cm)`);
      }
      const cov = parseFloat(formData.measurements.concrete_cover_cm);
      const minCov = criteriaMap['concrete_cover_cm']?.min_value || 5.0;
      if (!isNaN(cov) && cov < minCov) {
        issues.push(`Recubrimiento de concreto: ${cov} cm (mínimo: ≥ ${minCov} cm)`);
      }
    }
    return issues;
  }

  function renderStep() {
    container.innerHTML = `
      <!-- Top Navigation -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <button id="btn-back" class="btn btn-outline" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
          ${currentStep > 1 ? t('form.prev_step') : t('form.back_to_activities')}
        </button>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge ${activity === 'CONCRETE' ? 'badge-provisional' : 'badge-pass'}">
            ${activity}
          </span>
          ${currentStep > 1 ? `
            <button id="btn-exit-flow" class="btn btn-outline" style="width: auto; min-height: 32px; height: 32px; padding: 2px 10px; font-size: 11px; color: #64748B;">
              ${t('form.exit')}
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Stepper Header -->
      <div class="stepper">
        <div class="step-item ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}">
          <div class="step-circle">${currentStep > 1 ? '✓' : '1'}</div>
          <span class="step-label">${t('form.step1')}</span>
        </div>
        <div class="step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}">
          <div class="step-circle">${currentStep > 2 ? '✓' : '2'}</div>
          <span class="step-label">${t('form.step2')}</span>
        </div>
        <div class="step-item ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}">
          <div class="step-circle">${currentStep > 3 ? '✓' : '3'}</div>
          <span class="step-label">${t('form.step3')}</span>
        </div>
        <div class="step-item ${currentStep === 4 ? 'active' : ''}">
          <div class="step-circle">4</div>
          <span class="step-label">${t('form.step4')}</span>
        </div>
      </div>

      <!-- Step Content Container -->
      <div class="card" id="step-content">
        ${getStepContentHtml(currentStep)}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 12px; margin-top: 14px;">
        ${currentStep > 1 ? `
          <button id="btn-prev-step" class="btn btn-secondary" style="flex: 1;">
            ${t('form.prev_step')}
          </button>
        ` : ''}
        
        ${currentStep < 4 ? `
          <button id="btn-next-step" class="btn btn-primary" style="flex: 2;">
            ${t('form.next_step')}
          </button>
        ` : `
          <button id="btn-submit-protocol" class="btn btn-success" style="flex: 2;">
            ${t('form.submit_btn')}
          </button>
        `}
      </div>
    `;

    bindStepEvents();
  }

  function getStepContentHtml(step) {
    if (step === 1) {
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          ${t('step1.title')}
        </h3>
        
        <div class="form-group">
          <label class="form-label">${t('step1.chainage')}</label>
          <input 
            type="text" 
            id="input-chainage" 
            class="form-input" 
            value="${formData.chainage}" 
            placeholder="0+144" 
            required
          />
          <span class="form-label-hint">${t('step1.chainage_hint')}</span>
        </div>

        <div class="form-group">
          <label class="form-label">${t('step1.panel')}</label>
          <input 
            type="text" 
            id="input-panel" 
            class="form-input" 
            value="${formData.panel}" 
            placeholder="15" 
            required
          />
          <span class="form-label-hint">${t('step1.panel_hint')}</span>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('step1.gps_title')}</label>
          <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📍</span>
              <span id="gps-display" style="font-size: 14px; font-weight: 700; color: #0284C7;">
                ${formData.gps.lat.toFixed(6)}, ${formData.gps.lng.toFixed(6)} (±${formData.gps.accuracy}m)
              </span>
            </div>
            <span style="font-size: 11px; color: var(--color-text-muted); display: block; margin-top: 4px;">
              ${t('step1.gps_hint')}
            </span>
          </div>
        </div>
      `;
    }

    if (step === 2) {
      const advisoryContainerHtml = `<div id="step2-quality-advisory" style="display: none;"></div>`;

      if (activity === 'CONCRETE') {
        const isChecked = formData.measurements.formwork_approved !== false;
        const slumpRangeText = criteriaMap['slump_cm'] 
          ? `${criteriaMap['slump_cm'].min_value} - ${criteriaMap['slump_cm'].max_value}` 
          : '8.9 - 12.7';

        return `
          ${advisoryContainerHtml}

          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            ${t('concrete.step_title')}
          </h3>

          <!-- Formwork Pre-pour Checklist -->
          <div style="margin-bottom: 18px;">
            <label class="form-label" style="color: #0284C7;">
              ${t('concrete.formwork_title')}
            </label>
            <div class="checklist-item ${isChecked ? 'checked' : ''}" id="chk-formwork">
              <div class="checklist-checkbox">✓</div>
              <div>
                <div class="checklist-text">${t('concrete.formwork_label')}</div>
                <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
                  ${t('concrete.formwork_desc')}
                </div>
              </div>
            </div>
          </div>

          <!-- Mixer Trucks Dynamic Section -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; margin-bottom: 10px;">
            <label class="form-label" style="color: #0284C7; margin-bottom: 0;">
              ${t('concrete.trucks_title')}
            </label>
            <button type="button" id="btn-add-truck" class="btn btn-primary" style="min-height: 32px; height: 32px; font-size: 12px; padding: 0 12px; width: auto;">
              ${t('concrete.add_truck')}
            </button>
          </div>

          <div id="trucks-container">
            ${trucksState.map((truck, idx) => renderTruckCard(truck, idx, slumpRangeText)).join('')}
          </div>
        `;
      }

      if (activity === 'SURVEY') {
        const elevVal = formData.measurements.elevation_deviation !== undefined ? formData.measurements.elevation_deviation : '0.5';
        return `
          ${advisoryContainerHtml}

          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            ${t('survey.step_title')}
          </h3>

          <div class="form-group">
            <label class="form-label">${t('survey.elevation')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-survey-elev" 
                class="form-input" 
                value="${elevVal}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div id="survey-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Tolerancia del Expediente: <strong>≤ 1.0 cm</strong>
            </div>
          </div>
        `;
      }

      if (activity === 'COMPACTION') {
        return `
          ${advisoryContainerHtml}

          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            ${t('compaction.step_title')}
          </h3>

          <div class="form-group">
            <label class="form-label">${t('compaction.pct')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-comp-pct" 
                class="form-input" 
                value="${formData.measurements.compaction_pct || '101.2'}" 
                required
              />
              <span class="input-unit">%</span>
            </div>
            <div id="comp-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Exigido: <strong>≥ 100.0%</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('compaction.moisture')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-moisture" 
                class="form-input" 
                value="${formData.measurements.moisture_deviation !== undefined ? formData.measurements.moisture_deviation : '0.5'}" 
                required
              />
              <span class="input-unit">%</span>
            </div>
            <div id="moisture-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Tolerancia: <strong>±1.5%</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('compaction.subbase')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-subbase" 
                class="form-input" 
                value="${formData.measurements.sub_base_thickness || '21.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div id="subbase-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Exigido: <strong>≥ 20 cm</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('compaction.base')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-base" 
                class="form-input" 
                value="${formData.measurements.base_thickness || '25.5'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div id="base-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Exigido: <strong>≥ 25 cm</strong>
            </div>
          </div>
        `;
      }

      if (activity === 'STEEL') {
        return `
          ${advisoryContainerHtml}

          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            ${t('steel.step_title')}
          </h3>

          <div class="form-group">
            <label class="form-label">${t('steel.spacing')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-steel-spacing" 
                class="form-input" 
                value="${formData.measurements.bar_spacing_cm || '15.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div id="steel-spacing-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Tolerancia: <strong>14.0 - 16.0 cm</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">${t('steel.cover')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-steel-cover" 
                class="form-input" 
                value="${formData.measurements.concrete_cover_cm || '5.5'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div id="steel-cover-feedback-msg"></div>
            <div class="criteria-hint">
              ℹ️ Exigido: <strong>≥ 5.0 cm</strong>
            </div>
          </div>
        `;
      }
    }

    if (step === 3) {
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 8px; color: #0F172A;">
          ${t('step3.title')}
        </h3>
        <p style="font-size: 12px; color: var(--color-text-secondary); margin-bottom: 16px;">
          ${t('step3.hint')}
        </p>

        <div style="margin-bottom: 16px;">
          <input type="file" accept="image/*" capture="environment" id="camera-input" style="display: none;" />
          <button type="button" id="btn-open-camera" class="btn btn-outline" style="font-weight: 700;">
            ${t('step3.capture_btn')}
          </button>
        </div>

        <div id="photo-preview-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${formData.localPhotos.map((p, i) => `
            <div style="position: relative; border-radius: 8px; overflow: hidden; border: 1px solid var(--color-border);">
              <img src="${p.dataUrl}" style="width: 100%; height: 110px; object-fit: cover;" />
              <button type="button" class="btn-remove-photo" data-index="${i}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: #fff; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 12px; cursor: pointer;">✕</button>
            </div>
          `).join('')}
        </div>
      `;
    }

    if (step === 4) {
      const nonConformances = checkNonConformances();
      const hasNC = nonConformances.length > 0;

      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          ${t('step4.title')}
        </h3>

        <!-- Real-Time Evaluation Summary Preview -->
        ${hasNC ? `
          <div style="background: #FEF2F2; border: 1.5px solid #FECACA; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
            <div style="display: flex; align-items: flex-start; gap: 8px;">
              <span style="font-size: 20px;">⚠️</span>
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #991B1B;">
                  ${t('form.pre_verdict_nc')}
                </div>
                <ul style="font-size: 12px; color: #B91C1C; margin-top: 6px; margin-left: 18px; line-height: 1.4;">
                  ${nonConformances.map(nc => `<li>${nc}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        ` : `
          <div style="background: #ECFDF5; border: 1.5px solid #A7F3D0; border-radius: 8px; padding: 14px; margin-bottom: 18px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 20px;">✅</span>
              <div>
                <div style="font-size: 13px; font-weight: 800; color: #065F46;">
                  ${t('form.pre_verdict_pass')}
                </div>
                <div style="font-size: 12px; color: #047857; margin-top: 2px;">
                  ${activity === 'CONCRETE' ? 'Estado proyectado: APROBACIÓN PROVISIONAL (pendiente resultados de probetas a 7/28 días).' : 'Estado proyectado: CONFORME / APROBADO.'}
                </div>
              </div>
            </div>
          </div>
        `}

        <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; margin-bottom: 18px;">
          <div style="font-size: 11px; font-weight: 800; color: #0284C7; text-transform: uppercase;">
            ${t('step4.tech_label')}
          </div>
          <div style="font-size: 16px; font-weight: 800; color: #0F172A; margin-top: 2px;">
            ${session.name}
          </div>
          <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 1px;">
            ${session.role} • Token: ${session.device_token.substring(0, 16)}...
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${t('step4.notes_label')}</label>
          <textarea id="input-notes" class="form-input" rows="3" placeholder="Observaciones de campo...">${formData.notes}</textarea>
        </div>

        <div style="background: #FEF3C7; border: 1px solid #FDE68A; border-radius: 8px; padding: 12px; font-size: 12px; color: #92400E;">
          ⚖️ ${t('step4.declaration')}
        </div>
      `;
    }

    return '';
  }

  function renderTruckCard(truck, idx, slumpRangeText) {
    const sCrit = criteriaMap['slump_cm'] || { min_value: 8.9, max_value: 12.7 };
    const sVal = parseFloat(truck.slump_cm);
    const isSlumpValid = !isNaN(sVal) && sVal >= sCrit.min_value && sVal <= sCrit.max_value;
    const isSlumpInvalid = !isNaN(sVal) && (sVal < sCrit.min_value || sVal > sCrit.max_value);

    const cCrit = criteriaMap['cylinders_cast'] || { min_value: 4 };
    const cVal = parseInt(truck.cylinders_cast, 10);
    const isCylInvalid = !isNaN(cVal) && cVal < (cCrit.min_value || 4);

    return `
      <div class="truck-card" data-index="${idx}" style="border: 1px solid var(--color-border); border-radius: 8px; padding: 14px; margin-bottom: 14px; background: #FAFAFA;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 13px; font-weight: 800; color: #0284C7;">
            ${t('concrete.truck_header', { number: truck.truck_number })}
          </span>
          ${trucksState.length > 1 ? `
            <button type="button" class="btn-remove-truck" data-index="${idx}" style="background: none; border: none; color: #EF4444; font-size: 12px; font-weight: 700; cursor: pointer;">
              ✕ ${t('concrete.remove_truck')}
            </button>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('concrete.mixer_id')}</label>
            <input type="text" class="form-input truck-mixer" data-index="${idx}" value="${truck.mixer_id}" placeholder="MIX-01" required />
          </div>
          <div class="form-group">
            <label class="form-label">${t('concrete.delivery_note')}</label>
            <input type="text" class="form-input truck-guia" data-index="${idx}" value="${truck.delivery_note}" placeholder="GR-00412" required />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('concrete.slump')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                class="form-input truck-slump ${isSlumpInvalid ? 'input-invalid' : isSlumpValid ? 'input-valid' : ''}" 
                data-index="${idx}" 
                value="${truck.slump_cm}" 
                required 
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="slump-feedback-msg" data-index="${idx}">
              ${isSlumpInvalid ? `
                <div class="inline-validation-msg msg-error">
                  ${t('validation.slump_out', { range: slumpRangeText })}
                </div>
              ` : isSlumpValid ? `
                <div class="inline-validation-msg msg-ok">
                  ${t('validation.slump_ok', { range: slumpRangeText })}
                </div>
              ` : ''}
            </div>
            <span class="form-label-hint">${t('concrete.slump_hint', { range: slumpRangeText })}</span>
          </div>

          <div class="form-group">
            <label class="form-label">${t('concrete.cylinders')}</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                class="form-input truck-cylinders ${isCylInvalid ? 'input-invalid' : 'input-valid'}" 
                data-index="${idx}" 
                value="${truck.cylinders_cast}" 
                min="1" 
                required 
              />
              <span class="input-unit">und</span>
            </div>
            <div class="cylinders-feedback-msg" data-index="${idx}">
              ${isCylInvalid ? `
                <div class="inline-validation-msg msg-error">
                  ${t('validation.cylinders_out', { min: cCrit.min_value || 4 })}
                </div>
              ` : `
                <div class="inline-validation-msg msg-ok">
                  ${t('validation.cylinders_ok', { min: cCrit.min_value || 4 })}
                </div>
              `}
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">${t('concrete.design_fc')}</label>
          <select class="form-input truck-fc" data-index="${idx}">
            <option value="280" ${truck.design_fc === 280 ? 'selected' : ''}>280 kg/cm² (Pavimento)</option>
            <option value="210" ${truck.design_fc === 210 ? 'selected' : ''}>210 kg/cm² (Estructural)</option>
            <option value="175" ${truck.design_fc === 175 ? 'selected' : ''}>175 kg/cm² (Muros)</option>
            <option value="140" ${truck.design_fc === 140 ? 'selected' : ''}>140 kg/cm² (Solado)</option>
          </select>
        </div>
      </div>
    `;
  }

  function syncStepData() {
    if (currentStep === 1) {
      const chainEl = container.querySelector('#input-chainage');
      const panEl = container.querySelector('#input-panel');
      if (chainEl) formData.chainage = chainEl.value.trim();
      if (panEl) formData.panel = panEl.value.trim();
    } else if (currentStep === 2) {
      if (activity === 'CONCRETE') {
        container.querySelectorAll('.truck-card').forEach((card, idx) => {
          const mixer = card.querySelector('.truck-mixer')?.value.trim() || '';
          const guia = card.querySelector('.truck-guia')?.value.trim() || '';
          const slump = card.querySelector('.truck-slump')?.value.trim() || '';
          const cyl = card.querySelector('.truck-cylinders')?.value.trim() || '4';
          const fc = card.querySelector('.truck-fc')?.value || '280';

          trucksState[idx] = {
            truck_number: idx + 1,
            mixer_id: mixer,
            delivery_note: guia,
            slump_cm: slump,
            cylinders_cast: parseInt(cyl, 10) || 4,
            design_fc: parseFloat(fc) || 280,
            notes: ''
          };
        });

        formData.measurements.trucks = trucksState.map(t => ({
          truck_number: t.truck_number,
          mixer_id: t.mixer_id,
          delivery_note: t.delivery_note,
          slump_cm: parseFloat(t.slump_cm),
          cylinders_cast: t.cylinders_cast,
          design_fc: t.design_fc,
          notes: t.notes
        }));
      } else if (activity === 'SURVEY') {
        const el = container.querySelector('#input-survey-elev');
        if (el) formData.measurements.elevation_deviation = parseFloat(el.value);
      } else if (activity === 'COMPACTION') {
        const cp = container.querySelector('#input-comp-pct');
        const mo = container.querySelector('#input-moisture');
        const sb = container.querySelector('#input-subbase');
        const ba = container.querySelector('#input-base');
        if (cp) formData.measurements.compaction_pct = parseFloat(cp.value);
        if (mo) formData.measurements.moisture_deviation = parseFloat(mo.value);
        if (sb) formData.measurements.sub_base_thickness = parseFloat(sb.value);
        if (ba) formData.measurements.base_thickness = parseFloat(ba.value);
      } else if (activity === 'STEEL') {
        const sp = container.querySelector('#input-steel-spacing');
        const co = container.querySelector('#input-steel-cover');
        if (sp) formData.measurements.bar_spacing_cm = parseFloat(sp.value);
        if (co) formData.measurements.concrete_cover_cm = parseFloat(co.value);
      }
    } else if (currentStep === 4) {
      const notesEl = container.querySelector('#input-notes');
      if (notesEl) formData.notes = notesEl.value.trim();
    }
  }

  function showQualityAdvisory(issues, onProceed) {
    const advEl = container.querySelector('#step2-quality-advisory');
    if (!advEl) {
      onProceed();
      return;
    }
    advEl.className = 'quality-advisory-banner advisory-nc';
    advEl.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 18px;">⚠️</span>
        <div style="flex: 1;">
          <div style="font-weight: 800; font-size: 14px; color: #991B1B; margin-bottom: 4px;">
            ${t('form.quality_advisory_title')}
          </div>
          <div style="font-size: 13px; color: #7F1D1D; line-height: 1.4; margin-bottom: 8px;">
            ${t('form.quality_advisory_nc_text')}
            <ul style="margin-top: 6px; margin-left: 18px;">
              ${issues.map(item => `<li><strong>${item}</strong></li>`).join('')}
            </ul>
          </div>
          <div style="display: flex; gap: 8px; margin-top: 10px;">
            <button type="button" id="btn-advisory-fix" class="btn btn-outline" style="flex: 1; min-height: 38px; height: 38px; font-size: 12px; font-weight: 700; background: #fff; color: #0F172A;">
              ${t('form.quality_advisory_fix')}
            </button>
            <button type="button" id="btn-advisory-continue" class="btn btn-danger" style="flex: 1; min-height: 38px; height: 38px; font-size: 12px; font-weight: 700; background: #DC2626; color: #fff; border-color: #DC2626;">
              ${t('form.quality_advisory_continue')}
            </button>
          </div>
        </div>
      </div>
    `;
    advEl.style.display = 'block';
    advEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

    advEl.querySelector('#btn-advisory-fix').addEventListener('click', () => {
      advEl.style.display = 'none';
      const firstInvalid = container.querySelector('.input-invalid');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }
    });

    advEl.querySelector('#btn-advisory-continue').addEventListener('click', () => {
      onProceed();
    });
  }

  function bindStepEvents() {
    // Top Navigation: Back / Previous
    const backBtn = container.querySelector('#btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (currentStep > 1) {
          syncStepData();
          currentStep--;
          renderStep();
        } else {
          // On Step 1, prompt if user typed anything custom
          if (formData.chainage !== '0+144' || formData.panel !== '15') {
            if (confirm(t('form.confirm_exit'))) {
              onCancel();
            }
          } else {
            onCancel();
          }
        }
      });
    }

    // Top Navigation: Explicit Exit on steps 2-4
    const exitBtn = container.querySelector('#btn-exit-flow');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        if (confirm(t('form.confirm_exit'))) {
          onCancel();
        }
      });
    }

    // Bottom Navigation: Previous
    const prevBtn = container.querySelector('#btn-prev-step');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        syncStepData();
        currentStep--;
        renderStep();
      });
    }

    // Bottom Navigation: Next
    const nextBtn = container.querySelector('#btn-next-step');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        syncStepData();

        // If advancing from Step 2 to Step 3, perform quality check
        if (currentStep === 2 && !acknowledgedNC) {
          const issues = checkNonConformances();
          if (issues.length > 0) {
            showQualityAdvisory(issues, () => {
              acknowledgedNC = true;
              currentStep++;
              renderStep();
            });
            return;
          }
        }

        currentStep++;
        renderStep();
      });
    }

    // Step 2 Live Validation & Event Bindings
    if (currentStep === 2) {
      if (activity === 'CONCRETE') {
        const chk = container.querySelector('#chk-formwork');
        if (chk) {
          chk.addEventListener('click', () => {
            formData.measurements.formwork_approved = !formData.measurements.formwork_approved;
            chk.classList.toggle('checked', formData.measurements.formwork_approved);
            acknowledgedNC = false;
          });
        }

        const addTruckBtn = container.querySelector('#btn-add-truck');
        if (addTruckBtn) {
          addTruckBtn.addEventListener('click', () => {
            syncStepData();
            acknowledgedNC = false;
            const nextNum = trucksState.length + 1;
            trucksState.push({
              truck_number: nextNum,
              mixer_id: `MIX-${String(nextNum).padStart(2, '0')}`,
              delivery_note: `GR-${String(nextNum).padStart(3, '0')}`,
              slump_cm: '10.5',
              cylinders_cast: 4,
              design_fc: trucksState[0]?.design_fc || 280,
              notes: ''
            });
            renderStep();
          });
        }

        container.querySelectorAll('.btn-remove-truck').forEach(btn => {
          btn.addEventListener('click', (e) => {
            syncStepData();
            acknowledgedNC = false;
            const idx = parseInt(btn.getAttribute('data-index'), 10);
            trucksState.splice(idx, 1);
            // renumber trucks
            trucksState.forEach((t, i) => { t.truck_number = i + 1; });
            renderStep();
          });
        });

        // Attach live validation on truck cards
        container.querySelectorAll('.truck-card').forEach((card, idx) => {
          const slumpInput = card.querySelector('.truck-slump');
          const cylInput = card.querySelector('.truck-cylinders');
          const slumpMsg = card.querySelector('.slump-feedback-msg');
          const cylMsg = card.querySelector('.cylinders-feedback-msg');

          const updateLiveSlump = () => {
            acknowledgedNC = false;
            const val = parseFloat(slumpInput.value);
            const crit = criteriaMap['slump_cm'] || { min_value: 8.9, max_value: 12.7 };
            const rangeText = `${crit.min_value} - ${crit.max_value}`;
            if (isNaN(val)) {
              slumpInput.classList.remove('input-valid', 'input-invalid');
              if (slumpMsg) slumpMsg.innerHTML = '';
            } else if (val < crit.min_value || val > crit.max_value) {
              slumpInput.classList.add('input-invalid');
              slumpInput.classList.remove('input-valid');
              if (slumpMsg) slumpMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.slump_out', { range: rangeText })}</div>`;
            } else {
              slumpInput.classList.remove('input-invalid');
              slumpInput.classList.add('input-valid');
              if (slumpMsg) slumpMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.slump_ok', { range: rangeText })}</div>`;
            }
          };

          const updateLiveCylinders = () => {
            acknowledgedNC = false;
            const val = parseInt(cylInput.value, 10);
            const crit = criteriaMap['cylinders_cast'] || { min_value: 4 };
            const minVal = crit.min_value || 4;
            if (isNaN(val)) {
              cylInput.classList.remove('input-valid', 'input-invalid');
              if (cylMsg) cylMsg.innerHTML = '';
            } else if (val < minVal) {
              cylInput.classList.add('input-invalid');
              cylInput.classList.remove('input-valid');
              if (cylMsg) cylMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.cylinders_out', { min: minVal })}</div>`;
            } else {
              cylInput.classList.remove('input-invalid');
              cylInput.classList.add('input-valid');
              if (cylMsg) cylMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.cylinders_ok', { min: minVal })}</div>`;
            }
          };

          if (slumpInput) {
            slumpInput.addEventListener('input', updateLiveSlump);
            slumpInput.addEventListener('blur', updateLiveSlump);
          }
          if (cylInput) {
            cylInput.addEventListener('input', updateLiveCylinders);
            cylInput.addEventListener('blur', updateLiveCylinders);
          }
        });
      } else if (activity === 'SURVEY') {
        const elevInput = container.querySelector('#input-survey-elev');
        const elevMsg = container.querySelector('#survey-feedback-msg');
        const updateElev = () => {
          acknowledgedNC = false;
          const val = Math.abs(parseFloat(elevInput.value));
          const maxVal = criteriaMap['elevation_deviation']?.max_value || 1.0;
          if (isNaN(val)) {
            elevInput.classList.remove('input-valid', 'input-invalid');
            if (elevMsg) elevMsg.innerHTML = '';
          } else if (val > maxVal) {
            elevInput.classList.add('input-invalid');
            elevInput.classList.remove('input-valid');
            if (elevMsg) elevMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.elev_out', { max: maxVal })}</div>`;
          } else {
            elevInput.classList.remove('input-invalid');
            elevInput.classList.add('input-valid');
            if (elevMsg) elevMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.elev_ok', { max: maxVal })}</div>`;
          }
        };
        if (elevInput) {
          elevInput.addEventListener('input', updateElev);
          elevInput.addEventListener('blur', updateElev);
          updateElev();
        }
      } else if (activity === 'COMPACTION') {
        const compInput = container.querySelector('#input-comp-pct');
        const compMsg = container.querySelector('#comp-feedback-msg');
        const updateComp = () => {
          acknowledgedNC = false;
          const val = parseFloat(compInput.value);
          const minVal = criteriaMap['compaction_pct']?.min_value || 100.0;
          if (isNaN(val)) {
            compInput.classList.remove('input-valid', 'input-invalid');
            if (compMsg) compMsg.innerHTML = '';
          } else if (val < minVal) {
            compInput.classList.add('input-invalid');
            compInput.classList.remove('input-valid');
            if (compMsg) compMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.comp_out', { min: minVal })}</div>`;
          } else {
            compInput.classList.remove('input-invalid');
            compInput.classList.add('input-valid');
            if (compMsg) compMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.comp_ok', { min: minVal })}</div>`;
          }
        };
        if (compInput) {
          compInput.addEventListener('input', updateComp);
          compInput.addEventListener('blur', updateComp);
          updateComp();
        }

        const moistInput = container.querySelector('#input-moisture');
        const moistMsg = container.querySelector('#moisture-feedback-msg');
        const updateMoist = () => {
          acknowledgedNC = false;
          const val = Math.abs(parseFloat(moistInput.value));
          const maxVal = criteriaMap['moisture_deviation']?.max_value || 1.5;
          if (isNaN(val)) {
            moistInput.classList.remove('input-valid', 'input-invalid');
            if (moistMsg) moistMsg.innerHTML = '';
          } else if (val > maxVal) {
            moistInput.classList.add('input-invalid');
            moistInput.classList.remove('input-valid');
            if (moistMsg) moistMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.moisture_out', { max: maxVal })}</div>`;
          } else {
            moistInput.classList.remove('input-invalid');
            moistInput.classList.add('input-valid');
            if (moistMsg) moistMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.moisture_ok', { max: maxVal })}</div>`;
          }
        };
        if (moistInput) {
          moistInput.addEventListener('input', updateMoist);
          moistInput.addEventListener('blur', updateMoist);
          updateMoist();
        }
      } else if (activity === 'STEEL') {
        const spInput = container.querySelector('#input-steel-spacing');
        const spMsg = container.querySelector('#steel-spacing-feedback-msg');
        const updateSpacing = () => {
          acknowledgedNC = false;
          const val = parseFloat(spInput.value);
          const crit = criteriaMap['bar_spacing_cm'] || { min_value: 14.0, max_value: 16.0 };
          const rangeText = `${crit.min_value} - ${crit.max_value}`;
          if (isNaN(val)) {
            spInput.classList.remove('input-valid', 'input-invalid');
            if (spMsg) spMsg.innerHTML = '';
          } else if (val < crit.min_value || val > crit.max_value) {
            spInput.classList.add('input-invalid');
            spInput.classList.remove('input-valid');
            if (spMsg) spMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.spacing_out', { range: rangeText })}</div>`;
          } else {
            spInput.classList.remove('input-invalid');
            spInput.classList.add('input-valid');
            if (spMsg) spMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.spacing_ok', { range: rangeText })}</div>`;
          }
        };
        if (spInput) {
          spInput.addEventListener('input', updateSpacing);
          spInput.addEventListener('blur', updateSpacing);
          updateSpacing();
        }

        const covInput = container.querySelector('#input-steel-cover');
        const covMsg = container.querySelector('#steel-cover-feedback-msg');
        const updateCover = () => {
          acknowledgedNC = false;
          const val = parseFloat(covInput.value);
          const minVal = criteriaMap['concrete_cover_cm']?.min_value || 5.0;
          if (isNaN(val)) {
            covInput.classList.remove('input-valid', 'input-invalid');
            if (covMsg) covMsg.innerHTML = '';
          } else if (val < minVal) {
            covInput.classList.add('input-invalid');
            covInput.classList.remove('input-valid');
            if (covMsg) covMsg.innerHTML = `<div class="inline-validation-msg msg-error">${t('validation.cover_out', { min: minVal })}</div>`;
          } else {
            covInput.classList.remove('input-invalid');
            covInput.classList.add('input-valid');
            if (covMsg) covMsg.innerHTML = `<div class="inline-validation-msg msg-ok">${t('validation.cover_ok', { min: minVal })}</div>`;
          }
        };
        if (covInput) {
          covInput.addEventListener('input', updateCover);
          covInput.addEventListener('blur', updateCover);
          updateCover();
        }
      }
    }

    // Step 3 Photo capture
    if (currentStep === 3) {
      const cameraInput = container.querySelector('#camera-input');
      const openCamBtn = container.querySelector('#btn-open-camera');

      if (openCamBtn && cameraInput) {
        openCamBtn.addEventListener('click', () => cameraInput.click());

        cameraInput.addEventListener('change', async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = async (event) => {
            const photoId = `photo_client_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const photoObj = {
              id: photoId,
              blob: file,
              dataUrl: event.target.result
            };
            formData.localPhotos.push(photoObj);
            await storeLocalPhoto(photoId, file, { gps: formData.gps, captured_at: new Date().toISOString() });
            renderStep();
          };
          reader.readAsDataURL(file);
        });
      }

      container.querySelectorAll('.btn-remove-photo').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          formData.localPhotos.splice(idx, 1);
          renderStep();
        });
      });
    }

    // Step 4 Submit
    const submitBtn = container.querySelector('#btn-submit-protocol');
    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        syncStepData();
        submitBtn.disabled = true;
        submitBtn.innerText = 'Enviando protocolo...';

        const idempotencyKey = `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const lang = getLanguage();

        const payload = {
          project_id: projectId,
          device_token: session.device_token,
          technician_pin: '1234',
          activity,
          recorded_at: new Date().toISOString(),
          gps: formData.gps,
          panel: formData.panel,
          chainage: formData.chainage,
          measurements: formData.measurements,
          photo_ids: [],
          local_photo_ids: formData.localPhotos.map(p => p.id),
          notes: formData.notes,
          idempotency_key: idempotencyKey,
          lang
        };

        // If offline, queue locally
        if (!navigator.onLine) {
          await queueSubmission(payload);
          alert('Protocolo guardado en cola local (Modo Offline). Se sincronizará automáticamente.');
          onCompleted({
            protocol_id: `OFFLINE-${Date.now()}`,
            verdict: activity === 'CONCRETE' ? 'PROVISIONAL_PASS' : 'PASS',
            checks: [],
            nonconformance_id: null,
            pdf_url: '',
            pending: activity === 'CONCRETE' ? ['CYLINDER_7D', 'CYLINDER_28D'] : []
          });
          return;
        }

        try {
          const res = await fetch('/api/protocols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.message || 'Error al emitir protocolo');
          }

          const result = await res.json();
          onCompleted(result);
        } catch (err) {
          console.warn('Fallo en red, guardando en cola offline:', err);
          await queueSubmission(payload);
          alert(`Protocolo en cola offline: ${err.message}`);
          onCompleted({
            protocol_id: `OFFLINE-${Date.now()}`,
            verdict: activity === 'CONCRETE' ? 'PROVISIONAL_PASS' : 'PASS',
            checks: [],
            nonconformance_id: null,
            pdf_url: '',
            pending: activity === 'CONCRETE' ? ['CYLINDER_7D', 'CYLINDER_28D'] : []
          });
        }
      });
    }
  }

  renderStep();
}
