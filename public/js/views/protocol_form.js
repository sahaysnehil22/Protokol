// PROTOKOL — View: 4-Step Guided Protocol Wizard
// Supports v2.4 Dynamic Concrete Pour Architecture (1 to 20+ Ready-Mix Trucks)
import { getDeviceLocation } from '../location.js';
import { queueSubmission, storeLocalPhoto } from '../db.js';
import { t, getLanguage } from '../i18n.js';

export async function renderProtocolFormView(container, activity, session, onCompleted, onCancel) {
  let currentStep = 1;
  const projectId = session.project_id || 'AY-728-001';

  // Load project criteria for client-side hints
  let criteriaMap = {};
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

  function renderStep() {
    container.innerHTML = `
      <!-- Top Navigation -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
        <button id="btn-back" class="btn btn-outline" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
          ${t('form.back')}
        </button>
        <div style="text-align: right;">
          <span class="badge ${activity === 'CONCRETE' ? 'badge-provisional' : 'badge-pass'}">
            ${activity}
          </span>
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
      if (activity === 'CONCRETE') {
        const isChecked = formData.measurements.formwork_approved !== false;
        const slumpRangeText = criteriaMap['slump_cm'] 
          ? `${criteriaMap['slump_cm'].min_value} - ${criteriaMap['slump_cm'].max_value}` 
          : '8.9 - 12.7';

        return `
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
            <div class="criteria-hint">
              ℹ️ Tolerancia: <strong>≤ 1.0 cm</strong>
            </div>
          </div>
        `;
      }

      if (activity === 'COMPACTION') {
        return `
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
            <div class="criteria-hint">
              ℹ️ Exigido: <strong>≥ 25 cm</strong>
            </div>
          </div>
        `;
      }

      if (activity === 'STEEL') {
        return `
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
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          ${t('step4.title')}
        </h3>

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
              <input type="number" step="0.1" class="form-input truck-slump" data-index="${idx}" value="${truck.slump_cm}" required />
              <span class="input-unit">cm</span>
            </div>
            <span class="form-label-hint">${t('concrete.slump_hint', { range: slumpRangeText })}</span>
          </div>

          <div class="form-group">
            <label class="form-label">${t('concrete.cylinders')}</label>
            <div class="input-wrapper">
              <input type="number" class="form-input truck-cylinders" data-index="${idx}" value="${truck.cylinders_cast}" min="1" required />
              <span class="input-unit">und</span>
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
      formData.chainage = container.querySelector('#input-chainage').value.trim();
      formData.panel = container.querySelector('#input-panel').value.trim();
    } else if (currentStep === 2) {
      if (activity === 'CONCRETE') {
        // Read all trucks from DOM
        container.querySelectorAll('.truck-card').forEach((card, idx) => {
          const mixer = card.querySelector('.truck-mixer').value.trim();
          const guia = card.querySelector('.truck-guia').value.trim();
          const slump = card.querySelector('.truck-slump').value.trim();
          const cyl = card.querySelector('.truck-cylinders').value.trim();
          const fc = card.querySelector('.truck-fc').value;

          trucksState[idx] = {
            truck_number: idx + 1,
            mixer_id: mixer,
            delivery_note: guia,
            slump_cm: slump,
            cylinders_cast: parseInt(cyl, 10) || 4,
            design_fc: parseFloat(fc) || 210,
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
        formData.measurements.elevation_deviation = parseFloat(container.querySelector('#input-survey-elev').value);
      } else if (activity === 'COMPACTION') {
        formData.measurements.compaction_pct = parseFloat(container.querySelector('#input-comp-pct').value);
        formData.measurements.moisture_deviation = parseFloat(container.querySelector('#input-moisture').value);
        formData.measurements.sub_base_thickness = parseFloat(container.querySelector('#input-subbase').value);
        formData.measurements.base_thickness = parseFloat(container.querySelector('#input-base').value);
      } else if (activity === 'STEEL') {
        formData.measurements.bar_spacing_cm = parseFloat(container.querySelector('#input-steel-spacing').value);
        formData.measurements.concrete_cover_cm = parseFloat(container.querySelector('#input-steel-cover').value);
      }
    } else if (currentStep === 4) {
      const notesEl = container.querySelector('#input-notes');
      if (notesEl) formData.notes = notesEl.value.trim();
    }
  }

  function bindStepEvents() {
    container.querySelector('#btn-back').addEventListener('click', onCancel);

    const prevBtn = container.querySelector('#btn-prev-step');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        syncStepData();
        currentStep--;
        renderStep();
      });
    }

    const nextBtn = container.querySelector('#btn-next-step');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        syncStepData();
        currentStep++;
        renderStep();
      });
    }

    // Step 2 Concrete events
    if (currentStep === 2 && activity === 'CONCRETE') {
      const chk = container.querySelector('#chk-formwork');
      if (chk) {
        chk.addEventListener('click', () => {
          formData.measurements.formwork_approved = !formData.measurements.formwork_approved;
          chk.classList.toggle('checked', formData.measurements.formwork_approved);
        });
      }

      const addTruckBtn = container.querySelector('#btn-add-truck');
      if (addTruckBtn) {
        addTruckBtn.addEventListener('click', () => {
          syncStepData();
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
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          trucksState.splice(idx, 1);
          // renumber trucks
          trucksState.forEach((t, i) => { t.truck_number = i + 1; });
          renderStep();
        });
      });
    }

    // Step 3 Photo capture
    if (currentStep === 3) {
      const cameraInput = container.querySelector('#camera-input');
      const openCamBtn = container.querySelector('#btn-open-camera');

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
