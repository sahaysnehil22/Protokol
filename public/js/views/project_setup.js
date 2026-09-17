// PROTOKOL — View: Project Setup & Configuration Admin Flow
import { t } from '../i18n.js';

export function renderProjectSetupView(container, onProjectCreated, onCancel) {
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <button id="btn-cancel-setup" class="btn btn-outline" style="width: auto; min-height: 40px; padding: 6px 14px; font-size: 13px;">
        ${t('setup.back')}
      </button>
      <span class="badge badge-pass" style="font-size: 11px;">Admin / Setup</span>
    </div>

    <div class="card" style="margin-top: 10px;">
      <div style="margin-bottom: 20px;">
        <h2 style="font-size: 20px; font-weight: 800; color: #0F172A;">${t('setup.title')}</h2>
        <p style="font-size: 13px; color: var(--color-text-secondary); margin-top: 4px;">
          ${t('setup.subtitle')}
        </p>
      </div>

      <form id="project-setup-form" novalidate>
        <!-- 1. Identificación del Proyecto -->
        <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase; margin-bottom: 12px;">
          1. Información del Contrato
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.id')}</label>
          <input type="text" id="proj-id" class="form-input" placeholder="PROY-2026-01" required />
          <span class="form-label-hint">${t('setup.id_hint')}</span>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.name')}</label>
          <input type="text" id="proj-name" class="form-input" placeholder="Mejoramiento Vial Tramo..." required />
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.contract')}</label>
          <input type="text" id="proj-contract" class="form-input" placeholder="N° 102-2026-GORE" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.entity')}</label>
            <input type="text" id="proj-entity" class="form-input" placeholder="Gobierno Regional" required />
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.mode')}</label>
            <select id="proj-mode" class="form-input">
              <option value="Administración Directa">Administración Directa</option>
              <option value="Contrata">Por Contrata</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.location')}</label>
            <input type="text" id="proj-location" class="form-input" placeholder="Huamanga, Ayacucho" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.road_section')}</label>
            <input type="text" id="proj-section" class="form-input" placeholder="km 0+000 a 5+200" />
          </div>
        </div>

        <!-- 2. Parámetros de Control y Concreto -->
        <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase; margin-top: 20px; margin-bottom: 12px;">
          2. Criterios Técnicos de Concreto (Mixers y Probetas)
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.cylinders_per_truck')}</label>
          <div class="input-wrapper">
            <input type="number" id="proj-cylinders" class="form-input" value="4" min="1" max="10" required />
            <span class="input-unit">probetas / mixer</span>
          </div>
          <span class="form-label-hint">Cantidad obligatoria de testigos por cada mixer (v2.4 norma: 4 probetas).</span>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.default_fc')}</label>
          
          <!-- 1-Tap Quick Select Pills for Mobile Field Ergonomics -->
          <div class="fc-chips-container" id="fc-chips-list">
            <button type="button" class="btn-fc-chip" data-val="140">140 (Solado)</button>
            <button type="button" class="btn-fc-chip" data-val="175">175 (Muros)</button>
            <button type="button" class="btn-fc-chip active" data-val="210">210 (Estructural)</button>
            <button type="button" class="btn-fc-chip" data-val="280">280 (Pavimento)</button>
            <button type="button" class="btn-fc-chip" data-val="custom">Otro ▼</button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: center;">
            <div class="input-wrapper">
              <input type="number" id="proj-fc" class="form-input" value="210" min="50" max="1000" step="5" required style="font-weight: 800; font-size: 16px;" />
              <span class="input-unit">kg/cm²</span>
            </div>
            <div>
              <select id="proj-fc-preset" class="form-input" style="font-size: 13px;">
                <option value="210">210 kg/cm² (Estructural)</option>
                <option value="280">280 kg/cm² (Pavimento)</option>
                <option value="175">175 kg/cm² (Muros)</option>
                <option value="140">140 kg/cm² (Solado)</option>
                <option value="245">245 kg/cm² (Puentes)</option>
                <option value="315">315 kg/cm² (Vigas Post.)</option>
                <option value="350">350 kg/cm² (Alta Res.)</option>
                <option value="420">420 kg/cm² (Especial)</option>
                <option value="custom">Otro personalizado...</option>
              </select>
            </div>
          </div>
          <div id="fc-validation-hint" style="display: none; margin-top: 6px;" class="inline-validation-msg msg-error"></div>
          <span class="form-label-hint">kg/cm² — Toque un preset rápido o escriba cualquier valor del expediente.</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.slump_min')}</label>
            <input type="number" step="0.1" id="proj-slump-min" class="form-input" value="8.9" required />
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.slump_max')}</label>
            <input type="number" step="0.1" id="proj-slump-max" class="form-input" value="12.7" required />
          </div>
        </div>

        <!-- 3. Equipo de Ingenieros y Especialistas del Proyecto -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase;">
            3. Equipo de Ingenieros y Especialistas (${t('nav.projects')})
          </div>
          <button type="button" id="btn-add-tech-row" class="btn btn-outline" style="font-size: 11px; padding: 2px 10px; height: 28px; min-height: 28px;">
            + Agregar Ingeniero / Especialista
          </button>
        </div>

        <div id="tech-roster-container" style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 18px;">
          <!-- Dynamically populated engineer cards -->
        </div>

        <div id="setup-error" style="color: #F87171; font-size: 13px; margin-bottom: 14px; display: none;"></div>

        <button type="submit" class="btn btn-primary" style="margin-top: 10px;">
          ${t('setup.btn_create')}
        </button>
      </form>
    </div>
  `;

  const form = container.querySelector('#project-setup-form');
  const errorDiv = container.querySelector('#setup-error');
  const rosterContainer = container.querySelector('#tech-roster-container');
  const addTechBtn = container.querySelector('#btn-add-tech-row');
  const fcInput = container.querySelector('#proj-fc');
  const fcPreset = container.querySelector('#proj-fc-preset');
  const fcChips = container.querySelectorAll('.btn-fc-chip');
  const fcValidationHint = container.querySelector('#fc-validation-hint');

  function validateAndSyncFc(val, source) {
    const num = parseFloat(val);
    if (fcValidationHint) {
      fcValidationHint.style.display = 'none';
      fcValidationHint.innerText = '';
    }
    if (fcInput) {
      fcInput.setCustomValidity('');
    }

    if (isNaN(num)) {
      if (fcValidationHint) {
        fcValidationHint.innerText = '⚠️ Ingrese un valor numérico para f\'c';
        fcValidationHint.style.display = 'flex';
      }
      return;
    }

    if (num > 1000) {
      if (fcValidationHint) {
        fcValidationHint.innerText = '⚠️ El valor de f\'c debe ser menor o igual a 1000 kg/cm²';
        fcValidationHint.style.display = 'flex';
      }
      fcInput.classList.add('input-invalid');
      fcInput.classList.remove('input-valid');
      return;
    } else if (num < 50) {
      if (fcValidationHint) {
        fcValidationHint.innerText = '⚠️ El valor de f\'c debe ser al menos 50 kg/cm²';
        fcValidationHint.style.display = 'flex';
      }
      fcInput.classList.add('input-invalid');
      fcInput.classList.remove('input-valid');
      return;
    } else {
      fcInput.classList.remove('input-invalid');
      fcInput.classList.add('input-valid');
    }

    // Synchronize dropdown selection if triggered from input or chip
    if (source !== 'dropdown' && fcPreset) {
      const match = Array.from(fcPreset.options).find(o => o.value === String(num));
      if (match) {
        fcPreset.value = String(num);
      } else {
        fcPreset.value = 'custom';
      }
    }

    // Synchronize chip highlight
    fcChips.forEach(chip => {
      const cVal = chip.getAttribute('data-val');
      if (cVal === String(num) || (cVal === 'custom' && fcPreset && fcPreset.value === 'custom')) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  // Handle preset dropdown change and input
  if (fcPreset && fcInput) {
    const onPresetChange = () => {
      if (!fcPreset.value) return;
      if (fcPreset.value === 'custom') {
        fcChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-val') === 'custom'));
        fcInput.focus();
        return;
      }
      fcInput.value = fcPreset.value;
      validateAndSyncFc(fcPreset.value, 'dropdown');
    };
    fcPreset.addEventListener('change', onPresetChange);
    fcPreset.addEventListener('input', onPresetChange);
  }

  // Handle quick chip clicks
  fcChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const cVal = chip.getAttribute('data-val');
      if (cVal === 'custom') {
        if (fcPreset) fcPreset.value = 'custom';
        fcChips.forEach(c => c.classList.toggle('active', c === chip));
        fcInput.focus();
      } else {
        fcInput.value = cVal;
        if (fcPreset) fcPreset.value = cVal;
        validateAndSyncFc(cVal, 'chip');
      }
    });
  });

  // Handle numeric input change
  if (fcInput) {
    fcInput.addEventListener('input', () => {
      validateAndSyncFc(fcInput.value, 'input');
    });
    fcInput.addEventListener('blur', () => {
      validateAndSyncFc(fcInput.value, 'input');
    });
  }

  let engineersList = [
    {
      name: '',
      role: 'Quality Specialist',
      cip: '',
      pin: '1234',
      whatsapp: ''
    }
  ];

  function renderEngineerCards() {
    rosterContainer.innerHTML = engineersList.map((eng, idx) => `
      <div class="card tech-card-entry" data-index="${idx}" style="background: #F8FAFC; border: 1px solid #CBD5E1; padding: 12px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 11px; font-weight: 800; color: #0284C7; text-transform: uppercase;">
            Ingeniero / Especialista #${idx + 1}
          </span>
          ${engineersList.length > 1 ? `
            <button type="button" class="btn btn-outline btn-remove-eng" data-index="${idx}" style="font-size: 11px; padding: 2px 8px; height: 24px; min-height: 24px; color: #EF4444; border-color: #FCA5A5;">
              ✕ Eliminar
            </button>
          ` : ''}
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-bottom: 8px;">
          <div>
            <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">Nombre Completo</label>
            <input type="text" class="form-input eng-name" placeholder="Ej. Ing. Maria Gonzales" value="${eng.name}" required style="font-size: 13px;" />
          </div>
          <div>
            <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">Colegiatura CIP (Opcional)</label>
            <input type="text" class="form-input eng-cip" placeholder="Ej. 182940" value="${eng.cip}" style="font-size: 13px;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div>
            <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">Rol en el Proyecto</label>
            <select class="form-input eng-role" style="font-size: 12px;">
              <option value="Quality Specialist" ${eng.role === 'Quality Specialist' ? 'selected' : ''}>Especialista Calidad</option>
              <option value="Site Resident" ${eng.role === 'Site Resident' ? 'selected' : ''}>Residente de Obra</option>
              <option value="Supervisor" ${eng.role === 'Supervisor' ? 'selected' : ''}>Supervisor de Obra</option>
              <option value="Soils Specialist" ${eng.role === 'Soils Specialist' ? 'selected' : ''}>Especialista en Suelos</option>
              <option value="Structures Specialist" ${eng.role === 'Structures Specialist' ? 'selected' : ''}>Especialista Estructuras</option>
              <option value="Safety Specialist" ${eng.role === 'Safety Specialist' ? 'selected' : ''}>Especialista Seguridad</option>
              <option value="Assistant" ${eng.role === 'Assistant' ? 'selected' : ''}>Asistente de Campo</option>
            </select>
          </div>

          <div>
            <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">PIN de Campo (4 dígitos)</label>
            <input type="password" maxlength="4" pattern="[0-9]*" inputmode="numeric" class="form-input eng-pin" placeholder="1234" value="${eng.pin}" required style="font-size: 14px; text-align: center; letter-spacing: 2px;" />
          </div>

          <div>
            <label class="form-label" style="font-size: 11px; margin-bottom: 2px;">WhatsApp (Alertas)</label>
            <input type="tel" class="form-input eng-phone" placeholder="+51987654321" value="${eng.whatsapp}" style="font-size: 12px;" />
          </div>
        </div>
      </div>
    `).join('');

    rosterContainer.querySelectorAll('.tech-card-entry').forEach(card => {
      const idx = parseInt(card.getAttribute('data-index'), 10);
      card.querySelector('.eng-name').addEventListener('input', (e) => { engineersList[idx].name = e.target.value; });
      card.querySelector('.eng-cip').addEventListener('input', (e) => { engineersList[idx].cip = e.target.value; });
      card.querySelector('.eng-role').addEventListener('change', (e) => { engineersList[idx].role = e.target.value; });
      card.querySelector('.eng-pin').addEventListener('input', (e) => { engineersList[idx].pin = e.target.value; });
      card.querySelector('.eng-phone').addEventListener('input', (e) => { engineersList[idx].whatsapp = e.target.value; });
    });

    rosterContainer.querySelectorAll('.btn-remove-eng').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        engineersList.splice(idx, 1);
        renderEngineerCards();
      });
    });
  }

  addTechBtn.addEventListener('click', () => {
    engineersList.push({
      name: '',
      role: 'Quality Specialist',
      cip: '',
      pin: '1234',
      whatsapp: ''
    });
    renderEngineerCards();
  });

  renderEngineerCards();

  container.querySelector('#btn-cancel-setup').addEventListener('click', onCancel);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const id = container.querySelector('#proj-id').value.trim();
    const name = container.querySelector('#proj-name').value.trim();
    const contract_number = container.querySelector('#proj-contract').value.trim();
    const entity = container.querySelector('#proj-entity').value.trim();
    const execution_mode = container.querySelector('#proj-mode').value;
    const location = container.querySelector('#proj-location').value.trim();
    const road_section = container.querySelector('#proj-section').value.trim();
    const cylinders_per_truck = parseInt(container.querySelector('#proj-cylinders').value, 10);
    const default_design_fc = parseFloat(container.querySelector('#proj-fc').value);
    const slump_min = parseFloat(container.querySelector('#proj-slump-min').value);
    const slump_max = parseFloat(container.querySelector('#proj-slump-max').value);

    if (isNaN(default_design_fc) || default_design_fc < 50 || default_design_fc > 1000) {
      errorDiv.innerText = 'El valor de f\'c de diseño debe ser un número válido entre 50 y 1000 kg/cm².';
      errorDiv.style.display = 'block';
      fcInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      fcInput.focus();
      return;
    }

    if (isNaN(slump_min) || isNaN(slump_max) || slump_min >= slump_max) {
      errorDiv.innerText = 'El asentamiento (slump) mínimo debe ser un número menor al slump máximo.';
      errorDiv.style.display = 'block';
      return;
    }

    // Validate technicians
    if (engineersList.length === 0) {
      errorDiv.innerText = 'Debe registrar al menos un ingeniero o especialista para el proyecto.';
      errorDiv.style.display = 'block';
      return;
    }

    for (let i = 0; i < engineersList.length; i++) {
      const eng = engineersList[i];
      if (!eng.name.trim()) {
        errorDiv.innerText = `Por favor ingrese el nombre del Ingeniero #${i + 1}`;
        errorDiv.style.display = 'block';
        return;
      }
      if (!eng.pin || eng.pin.trim().length !== 4) {
        errorDiv.innerText = `El PIN para "${eng.name}" debe tener exactamente 4 dígitos.`;
        errorDiv.style.display = 'block';
        return;
      }
    }

    try {
      const recipients = engineersList.map(e => e.whatsapp).filter(Boolean).join(', ') || '+51966000001';

      const payload = {
        id,
        name,
        contract_number,
        entity,
        execution_mode,
        location,
        road_section,
        timezone: 'America/Lima',
        timezone_offset: '-05:00',
        whatsapp_recipients: recipients,
        sampling_basis: 'PER_TRUCK',
        cylinders_per_truck,
        default_design_fc,
        criteria: [
          {
            activity: 'CONCRETE',
            field: 'formwork_approved',
            operator: 'EQ',
            expected_value: 'true',
            unit: 'checklist',
            source_reference: 'Checklist Previo de Encofrado'
          },
          {
            activity: 'CONCRETE',
            field: 'slump_cm',
            operator: 'BETWEEN',
            min_value: slump_min,
            max_value: slump_max,
            unit: 'cm',
            source_reference: 'Diseño de Mezclas Acreditado'
          },
          {
            activity: 'CONCRETE',
            field: 'cylinders_cast',
            operator: 'GTE',
            min_value: cylinders_per_truck,
            unit: 'probetas/mixer',
            source_reference: `Regla de Muestreo: ${cylinders_per_truck} probetas por mixer`
          },
          {
            activity: 'CONCRETE',
            field: 'design_fc',
            operator: 'GTE',
            min_value: default_design_fc,
            unit: 'kg/cm²',
            source_reference: 'Especificaciones Técnicas'
          }
        ],
        technicians: engineersList.map(e => ({
          name: e.name.trim(),
          role: e.role,
          cip_number: e.cip.trim() || null,
          pin: e.pin.trim(),
          whatsapp: e.whatsapp.trim() || ''
        }))
      };

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Error al crear proyecto');
      }

      const created = await res.json();
      localStorage.setItem('protokol_active_project', created.id);
      alert(t('setup.success'));
      onProjectCreated(created);
    } catch (err) {
      errorDiv.innerText = err.message;
      errorDiv.style.display = 'block';
    }
  });
}
