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

      <form id="project-setup-form">
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

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.cylinders_per_truck')}</label>
            <input type="number" id="proj-cylinders" class="form-input" value="4" min="1" max="10" required />
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.default_fc')}</label>
            <select id="proj-fc" class="form-input">
              <option value="280">280 kg/cm² (Pavimento)</option>
              <option value="210" selected>210 kg/cm² (Estructural)</option>
              <option value="175">175 kg/cm² (Muros)</option>
              <option value="140">140 kg/cm² (Solado)</option>
            </select>
          </div>
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

        <!-- 3. Notificaciones y Personal Inicial -->
        <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase; margin-top: 20px; margin-bottom: 12px;">
          3. Especialista de Calidad Inicial
        </div>

        <div class="form-group">
          <label class="form-label">Nombre del Especialista</label>
          <input type="text" id="tech-name" class="form-input" placeholder="Ing. Especialista de Calidad" value="Ing. Especialista de Calidad" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">PIN de Campo (4 dígitos)</label>
            <input type="password" maxlength="4" pattern="[0-9]*" inputmode="numeric" id="tech-pin" class="form-input" value="1234" required style="text-align:center; font-size:18px;" />
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.recipients')}</label>
            <input type="tel" id="proj-phone" class="form-input" placeholder="+51966000001" value="+51966000001" />
          </div>
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
    const tech_name = container.querySelector('#tech-name').value.trim();
    const tech_pin = container.querySelector('#tech-pin').value.trim();
    const phone = container.querySelector('#proj-phone').value.trim();

    if (tech_pin.length !== 4) {
      errorDiv.innerText = t('identify.err_pin');
      errorDiv.style.display = 'block';
      return;
    }

    try {
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
        whatsapp_recipients: phone,
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
        technicians: [
          {
            name: tech_name,
            role: 'Quality Specialist',
            pin: tech_pin,
            whatsapp: phone
          }
        ]
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
