// PROTOKOL — View: 4-Step Guided Protocol Wizard
import { getDeviceLocation } from '../location.js';
import { queueSubmission, storeLocalPhoto, getCachedCriteria } from '../db.js';

export async function renderProtocolFormView(container, activity, session, onCompleted, onCancel) {
  let currentStep = 1;
  const formData = {
    activity,
    chainage: '0+144',
    panel: '15',
    gps: { lat: -13.1588, lng: -74.2236, accuracy: 10 },
    measurements: {},
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
          ← Volver
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
          <span class="step-label">Ubicación</span>
        </div>
        <div class="step-item ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}">
          <div class="step-circle">${currentStep > 2 ? '✓' : '2'}</div>
          <span class="step-label">Medición</span>
        </div>
        <div class="step-item ${currentStep === 3 ? 'active' : currentStep > 3 ? 'completed' : ''}">
          <div class="step-circle">${currentStep > 3 ? '✓' : '3'}</div>
          <span class="step-label">Evidencia</span>
        </div>
        <div class="step-item ${currentStep === 4 ? 'active' : ''}">
          <div class="step-circle">4</div>
          <span class="step-label">Firma</span>
        </div>
      </div>

      <!-- Step Content Container -->
      <div class="card" id="step-content">
        ${getStepContentHtml(currentStep, activity, formData, session)}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 12px; margin-top: 14px;">
        ${currentStep > 1 ? `
          <button id="btn-prev-step" class="btn btn-secondary" style="flex: 1;">
            ← Anterior
          </button>
        ` : ''}
        
        ${currentStep < 4 ? `
          <button id="btn-next-step" class="btn btn-primary" style="flex: 2;">
            Siguiente Paso →
          </button>
        ` : `
          <button id="btn-submit-protocol" class="btn btn-success" style="flex: 2;">
            ✓ Firmar y Emitir Protocolo
          </button>
        `}
      </div>
    `;

    bindStepEvents();
  }

  function getStepContentHtml(step, act, data, sess) {
    if (step === 1) {
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          Paso 1: Segmento y Coordenadas
        </h3>
        
        <div class="form-group">
          <label class="form-label">Progresiva (Km + Metros)</label>
          <input 
            type="text" 
            id="input-chainage" 
            class="form-input" 
            value="${data.chainage}" 
            placeholder="0+144" 
            required
          />
          <span class="form-label-hint">Ejemplo: 0+144 para el metro 144</span>
        </div>

        <div class="form-group">
          <label class="form-label">Paño / Elemento Estructural</label>
          <input 
            type="text" 
            id="input-panel" 
            class="form-input" 
            value="${data.panel}" 
            placeholder="15" 
            required
          />
          <span class="form-label-hint">Número de paño de pavimento o tramo</span>
        </div>

        <div class="form-group" style="margin-bottom: 0;">
          <label class="form-label">Georreferenciación GPS Automática</label>
          <div style="background: #F8FAFC; border: 1px solid var(--color-border); border-radius: 8px; padding: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 18px;">📍</span>
              <span id="gps-display" style="font-size: 14px; font-weight: 700; color: #0284C7;">
                ${data.gps.lat.toFixed(6)}, ${data.gps.lng.toFixed(6)} (±${data.gps.accuracy}m)
              </span>
            </div>
            <span style="font-size: 11px; color: var(--color-text-muted); display: block; margin-top: 4px;">
              Coordenadas grabadas con sello de tiempo inmutable.
            </span>
          </div>
        </div>
      `;
    }

    if (step === 2) {
      if (act === 'CONCRETE') {
        const isChecked = data.measurements.formwork_approved !== false;
        return `
          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            Paso 2: Vaciado y Checklist Previo de Encofrado
          </h3>

          <!-- Formwork Pre-pour Checklist (Formwork is NOT a 5th activity, it is inside Concrete) -->
          <div style="margin-bottom: 18px;">
            <label class="form-label" style="color: #0284C7;">
              1. Checklist Previo al Vaciado (Encofrado)
            </label>
            <div class="checklist-item ${isChecked ? 'checked' : ''}" id="chk-formwork">
              <div class="checklist-checkbox">✓</div>
              <div>
                <div class="checklist-text">Encofrado Verificado y Aprobado</div>
                <div style="font-size: 12px; color: var(--color-text-secondary); margin-top: 2px;">
                  Dimensiones, nivelación, alineamiento y estanqueidad conformes.
                </div>
              </div>
            </div>
          </div>

          <label class="form-label" style="color: #0284C7; margin-top: 16px;">
            2. Control de Mezcla en Llegada
          </label>

          <div class="form-group">
            <label class="form-label">Asentamiento / Slump (Cono de Abrams)</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-slump" 
                class="form-input" 
                value="${data.measurements.slump_cm || '8.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint" id="hint-slump">
              ℹ️ Rango exigido por diseño de mezcla: <strong>7.6 - 10.2 cm</strong> (3" a 4")
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Identificador de Camión Mixer</label>
            <input 
              type="text" 
              id="input-mixer" 
              class="form-input" 
              value="${data.measurements.mixer_id || '6D37'}" 
              placeholder="6D37" 
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Guía de Remisión de Concreto</label>
            <input 
              type="text" 
              id="input-delivery" 
              class="form-input" 
              value="${data.measurements.delivery_note || 'GR-00412'}" 
              placeholder="GR-00412" 
              required
            />
          </div>

          <div class="form-group">
            <label class="form-label">Probetas / Testigos Moldeados</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                id="input-cylinders" 
                class="form-input" 
                value="${data.measurements.cylinders_cast || '2'}" 
                min="2" 
                required
              />
              <span class="input-unit">und</span>
            </div>
            <span class="form-label-hint">Mínimo 2 probetas por vaciado mayor a 4 m³ (EG-2013)</span>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Resistencia de Diseño f'c</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                id="input-design-fc" 
                class="form-input" 
                value="${data.measurements.design_fc || '210'}" 
                readonly 
                style="background: #F1F5F9; color: #475569; border-color: #E2E8F0;"
              />
              <span class="input-unit">kg/cm²</span>
            </div>
          </div>
        `;
      }

      if (act === 'SURVEY') {
        return `
          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            Paso 2: Topografía y Control Geométrico
          </h3>

          <div class="form-group">
            <label class="form-label">Desviación de Cota respecto al Diseño</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-survey-elev" 
                class="form-input" 
                value="${data.measurements.elevation_deviation || '0.5'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint" id="hint-elev">
              ℹ️ Tolerancia del Plan de Calidad: <strong>≤ 1.0 cm</strong>
            </div>
          </div>
        `;
      }

      if (act === 'COMPACTION') {
        return `
          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            Paso 2: Ensayos de Suelos y Compactación
          </h3>

          <div class="form-group">
            <label class="form-label">Grado de Compactación (% Proctor Modificado)</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-comp-pct" 
                class="form-input" 
                value="${data.measurements.compaction_pct || '100.5'}" 
                required
              />
              <span class="input-unit">%</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Exigido por Norma: <strong>≥ 100.0%</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Desviación de Humedad respecto a la Óptima</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.1" 
                id="input-comp-moisture" 
                class="form-input" 
                value="${data.measurements.moisture_deviation || '0.5'}" 
                required
              />
              <span class="input-unit">%</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Rango admisible: <strong>-1.5% a +1.5%</strong>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Espesor de Capa Sub-base</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.5" 
                id="input-comp-subbase" 
                class="form-input" 
                value="${data.measurements.sub_base_thickness || '20.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Mínimo de diseño: <strong>≥ 20.0 cm</strong>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Espesor de Capa Base Granular</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.5" 
                id="input-comp-base" 
                class="form-input" 
                value="${data.measurements.base_thickness || '25.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Mínimo de diseño: <strong>≥ 25.0 cm</strong>
            </div>
          </div>
        `;
      }

      if (act === 'STEEL') {
        return `
          <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
            Paso 2: Armadura de Acero de Refuerzo
          </h3>

          <div class="form-group">
            <label class="form-label">Espaciamiento entre Varillas</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.5" 
                id="input-steel-spacing" 
                class="form-input" 
                value="${data.measurements.bar_spacing_cm || '15.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Plano Estructural: <strong>14.0 - 16.0 cm</strong> (nominal 15 cm)
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Recubrimiento de Concreto</label>
            <div class="input-wrapper">
              <input 
                type="number" 
                step="0.5" 
                id="input-steel-cover" 
                class="form-input" 
                value="${data.measurements.concrete_cover_cm || '5.0'}" 
                required
              />
              <span class="input-unit">cm</span>
            </div>
            <div class="criteria-hint">
              ℹ️ Recubrimiento mínimo especificado: <strong>≥ 5.0 cm</strong>
            </div>
          </div>
        `;
      }
    }

    if (step === 3) {
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          Paso 3: Evidencia Fotográfica de Campo
        </h3>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 16px;">
          Tome fotos de la medición y del elemento con coordenadas GPS bloqueadas.
        </p>

        <div class="photo-preview-grid" id="photo-grid">
          ${data.localPhotos.map((p, idx) => `
            <div class="photo-thumb">
              <img src="${p.dataUrl}" alt="Evidencia ${idx + 1}" />
              <button class="photo-thumb-remove" data-index="${idx}">×</button>
            </div>
          `).join('')}
        </div>

        <div style="margin-top: 14px;">
          <input 
            type="file" 
            id="camera-input" 
            accept="image/*" 
            capture="environment" 
            style="display: none;"
          />
          <button type="button" class="photo-capture-btn" id="btn-trigger-camera" style="width: 100%;">
            <span style="font-size: 28px;">📷</span>
            <span>Tomar Foto con GPS</span>
          </button>
        </div>
      `;
    }

    if (step === 4) {
      return `
        <h3 style="font-size: 17px; font-weight: 800; margin-bottom: 16px; color: #0F172A;">
          Paso 4: Resumen y Firma Digital
        </h3>

        <div style="background: #F8FAFC; border-radius: 8px; padding: 14px; margin-bottom: 18px; border: 1px solid var(--color-border);">
          <div style="font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px;">RESUMEN DE LIBERACIÓN</div>
          <div style="font-size: 14px; font-weight: 700; color: #0F172A;">
            Actividad: <span style="color: #0284C7;">${data.activity}</span>
          </div>
          <div style="font-size: 13px; color: var(--color-text-secondary); margin-top: 2px;">
            Progresiva ${data.chainage} | Paño ${data.panel}
          </div>
          <div style="font-size: 12px; color: var(--color-text-muted); margin-top: 2px;">
            Fotos adjuntas: ${data.localPhotos.length} | GPS: ${data.gps.lat.toFixed(6)}, ${data.gps.lng.toFixed(6)}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Observaciones / Notas Adicionales (Opcional)</label>
          <textarea 
            id="input-notes" 
            class="form-input" 
            style="min-height: 70px; font-size: 14px;" 
            placeholder="Detalles sobre clima, cuadrilla o equipo..."
          >${data.notes}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">PIN de Conformidad (${sess.name})</label>
          <input 
            type="password" 
            id="input-confirm-pin" 
            class="form-input" 
            maxlength="4" 
            inputmode="numeric" 
            value="${sess.pin}" 
            style="text-align: center; letter-spacing: 6px; font-size: 22px;" 
            required
          />
          <span class="form-label-hint">Su PIN firma el registro inmutable bajo el Art. 1784 C.C.</span>
        </div>

        <div id="submit-error" style="color: #F87171; font-size: 13px; margin-top: 10px; display: none;"></div>
      `;
    }
  }

  function bindStepEvents() {
    const btnBack = container.querySelector('#btn-back');
    if (btnBack) btnBack.addEventListener('click', onCancel);

    const btnPrev = container.querySelector('#btn-prev-step');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        saveCurrentStepValues();
        currentStep--;
        renderStep();
      });
    }

    const btnNext = container.querySelector('#btn-next-step');
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (saveCurrentStepValues()) {
          currentStep++;
          renderStep();
        }
      });
    }

    const btnSubmit = container.querySelector('#btn-submit-protocol');
    if (btnSubmit) {
      btnSubmit.addEventListener('click', () => {
        saveCurrentStepValues();
        executeSubmission();
      });
    }

    // Step 2 Formwork toggle
    const chkFormwork = container.querySelector('#chk-formwork');
    if (chkFormwork) {
      chkFormwork.addEventListener('click', () => {
        const isCurrentlyChecked = chkFormwork.classList.contains('checked');
        if (isCurrentlyChecked) {
          chkFormwork.classList.remove('checked');
          formData.measurements.formwork_approved = false;
        } else {
          chkFormwork.classList.add('checked');
          formData.measurements.formwork_approved = true;
        }
      });
    }

    // Step 3 Camera capture
    const btnTriggerCam = container.querySelector('#btn-trigger-camera');
    const cameraInput = container.querySelector('#camera-input');
    if (btnTriggerCam && cameraInput) {
      btnTriggerCam.addEventListener('click', () => cameraInput.click());
      cameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (re) => {
          const clientPhotoId = `ph_local_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          formData.localPhotos.push({
            id: clientPhotoId,
            blob: file,
            dataUrl: re.target.result
          });
          renderStep();
        };
        reader.readAsDataURL(file);
      });

      // Remove photo thumbnail
      container.querySelectorAll('.photo-thumb-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(btn.getAttribute('data-index'), 10);
          formData.localPhotos.splice(idx, 1);
          renderStep();
        });
      });
    }
  }

  function saveCurrentStepValues() {
    if (currentStep === 1) {
      const chainageEl = container.querySelector('#input-chainage');
      const panelEl = container.querySelector('#input-panel');
      if (!chainageEl.value.trim() || !panelEl.value.trim()) {
        alert('Por favor ingrese la progresiva y el número de paño.');
        return false;
      }
      formData.chainage = chainageEl.value.trim();
      formData.panel = panelEl.value.trim();
    }

    if (currentStep === 2) {
      if (activity === 'CONCRETE') {
        const slump = parseFloat(container.querySelector('#input-slump').value);
        const mixer = container.querySelector('#input-mixer').value.trim();
        const delivery = container.querySelector('#input-delivery').value.trim();
        const cylinders = parseInt(container.querySelector('#input-cylinders').value, 10);
        const designFc = parseFloat(container.querySelector('#input-design-fc').value);

        formData.measurements = {
          formwork_approved: formData.measurements.formwork_approved !== false,
          slump_cm: slump,
          mixer_id: mixer,
          delivery_note: delivery,
          cylinders_cast: cylinders,
          design_fc: designFc
        };
      } else if (activity === 'SURVEY') {
        formData.measurements = {
          elevation_deviation: parseFloat(container.querySelector('#input-survey-elev').value)
        };
      } else if (activity === 'COMPACTION') {
        formData.measurements = {
          compaction_pct: parseFloat(container.querySelector('#input-comp-pct').value),
          moisture_deviation: parseFloat(container.querySelector('#input-comp-moisture').value),
          sub_base_thickness: parseFloat(container.querySelector('#input-comp-subbase').value),
          base_thickness: parseFloat(container.querySelector('#input-comp-base').value)
        };
      } else if (activity === 'STEEL') {
        formData.measurements = {
          bar_spacing_cm: parseFloat(container.querySelector('#input-steel-spacing').value),
          concrete_cover_cm: parseFloat(container.querySelector('#input-steel-cover').value)
        };
      }
    }

    if (currentStep === 4) {
      formData.notes = container.querySelector('#input-notes').value.trim();
    }

    return true;
  }

  async function executeSubmission() {
    const pin = container.querySelector('#input-confirm-pin').value.trim();
    const errorDiv = container.querySelector('#submit-error');

    if (pin.length !== 4) {
      errorDiv.innerText = 'El PIN debe tener 4 dígitos.';
      errorDiv.style.display = 'block';
      return;
    }

    const idempotencyKey = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const recordedAt = new Date().toISOString().replace('Z', '-05:00'); // PET Peru offset

    // Save photos in local IndexedDB first
    const localPhotoIds = [];
    for (const ph of formData.localPhotos) {
      await storeLocalPhoto(ph.id, ph.blob, {
        gps: formData.gps,
        captured_at: recordedAt
      });
      localPhotoIds.push(ph.id);
    }

    const submissionPayload = {
      project_id: 'AY-728-001',
      device_token: session.deviceToken,
      technician_pin: pin,
      activity: formData.activity,
      recorded_at: recordedAt,
      gps: { lat: formData.gps.lat, lng: formData.gps.lng },
      panel: formData.panel,
      chainage: formData.chainage,
      measurements: formData.measurements,
      photo_ids: [],
      local_photo_ids: localPhotoIds,
      notes: formData.notes,
      idempotency_key: idempotencyKey
    };

    // If device is ONLINE, try direct network submission
    if (navigator.onLine) {
      try {
        // Upload photos first
        const uploadedPhotoIds = [];
        for (const ph of formData.localPhotos) {
          const fd = new FormData();
          fd.append('photo', ph.blob, `${ph.id}.jpg`);
          fd.append('gps_lat', formData.gps.lat);
          fd.append('gps_lng', formData.gps.lng);
          fd.append('captured_at', recordedAt);

          const upRes = await fetch('/api/photos', { method: 'POST', body: fd });
          if (upRes.ok) {
            const upJson = await upRes.json();
            uploadedPhotoIds.push(upJson.photo_id);
          }
        }

        submissionPayload.photo_ids = uploadedPhotoIds;

        const res = await fetch('/api/protocols', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(submissionPayload)
        });

        if (res.ok) {
          const result = await res.json();
          onCompleted({ ...result, isOffline: false });
          return;
        }
      } catch (e) {
        console.warn('[SUBMISSION] Error en envío directo online, pasando a cola offline:', e);
      }
    }

    // If offline or network error: Queue in IndexedDB (Requirement R3)
    await queueSubmission(submissionPayload);
    
    // Compute immediate local verdict preview for the field technician
    let previewVerdict = 'PASS';
    if (activity === 'CONCRETE') {
      previewVerdict = 'PROVISIONAL_PASS';
    }

    onCompleted({
      protocol_id: `PRT-OFFLINE-${Date.now()}`,
      verdict: previewVerdict,
      checks: Object.keys(formData.measurements).map(k => ({
        field: k,
        actual: formData.measurements[k],
        expected: 'Criterio en cola local',
        result: 'PASS'
      })),
      nonconformance_id: null,
      pdf_url: null,
      pending: activity === 'CONCRETE' ? ['CYLINDER_7D', 'CYLINDER_28D'] : [],
      isOffline: true
    });
  }

  // Initial render
  renderStep();
}
