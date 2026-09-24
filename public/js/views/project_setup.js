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
        <!-- 1. Información General del Proyecto (F5) -->
        <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase; margin-bottom: 12px;">
          1. Información General del Proyecto
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.id')}</label>
          <input type="text" id="proj-id" class="form-input" placeholder="AY-728-002" required />
          <span class="form-label-hint">${t('setup.id_hint')}</span>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.name')}</label>
          <input type="text" id="proj-name" class="form-input" placeholder="Mejoramiento y Ampliación de Transitabilidad Tramo AY-728 a AY-729" required />
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.contract')}</label>
          <input type="text" id="proj-contract" class="form-input" placeholder="N° 81-2026-GRA-SEDECENTRAL-OAPF" required />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.entity')}</label>
            <input type="text" id="proj-entity" class="form-input" placeholder="Gobierno Regional de Ayacucho" required />
          </div>
          <div class="form-group">
            <label class="form-label">Tipo de Proyecto</label>
            <select id="proj-type" class="form-input">
              <option value="Carretera / Infraestructura Vial" selected>Carretera / Infraestructura Vial</option>
              <option value="Edificación Urbana / Inmobiliaria">Edificación Urbana / Inmobiliaria</option>
              <option value="Puentes y Obras de Arte">Puentes y Obras de Arte</option>
              <option value="Saneamiento e Hidráulica">Saneamiento e Hidráulica</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="form-group">
            <label class="form-label">${t('setup.mode')}</label>
            <select id="proj-mode" class="form-input">
              <option value="Administración Directa">Administración Directa</option>
              <option value="Contrata">Por Contrata</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">${t('setup.location')}</label>
            <input type="text" id="proj-location" class="form-input" placeholder="Huamanga, Ayacucho, Perú" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">${t('setup.road_section')}</label>
          <input type="text" id="proj-section" class="form-input" placeholder="Tramo AY-728 a AY-729 (km 0+000 a 2+380)" />
        </div>

        <!-- 2. Equipo de Ingenieros y Especialistas del Proyecto (F6 - Feeds PDF signature grid) -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div>
            <div style="font-size: 13px; font-weight: 800; color: #0284C7; text-transform: uppercase;">
              2. Equipo de Ingenieros y Especialistas (Cuadro de Firmas PPI)
            </div>
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 2px;">
              Este equipo alimenta directamente el cuadro oficial de firmas y sellos en los protocolos y el dosier final.
            </div>
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
  let engineersList = [
    {
      name: 'Ing. David Valdez Ochoa',
      role: 'Quality Specialist',
      cip: '',
      pin: '1234',
      whatsapp: '+51966000001'
    },
    {
      name: 'Ing. Cristian Manuel Torres Salinas',
      role: 'Quality Specialist',
      cip: '260873',
      pin: '1234',
      whatsapp: '+51966000009'
    },
    {
      name: 'Ing. Teodoro Manuel Huamancusi Quispe',
      role: 'Supervisor',
      cip: '53548',
      pin: '1234',
      whatsapp: '+51966000006'
    },
    {
      name: 'Ing. Edison Cuadros Garcia',
      role: 'Site Resident',
      cip: '302775',
      pin: '1234',
      whatsapp: '+51966000002'
    },
    {
      name: 'Ing. Roly Conocachi Huamani',
      role: 'Structures Specialist',
      cip: '76843',
      pin: '1234',
      whatsapp: '+51966000007'
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

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

    try {
      const id = container.querySelector('#proj-id')?.value.trim() || '';
      const name = container.querySelector('#proj-name')?.value.trim() || '';
      const contract_number = container.querySelector('#proj-contract')?.value.trim() || '';
      const entity = container.querySelector('#proj-entity')?.value.trim() || '';
      const execution_mode = container.querySelector('#proj-mode')?.value || 'Administración Directa';
      const location = container.querySelector('#proj-location')?.value.trim() || '';
      const road_section = container.querySelector('#proj-section')?.value.trim() || '';

      // Validate required project information
      if (!id) {
        errorDiv.innerText = 'El Código / ID del Proyecto es obligatorio (ej. AY-728-002).';
        errorDiv.style.display = 'block';
        container.querySelector('#proj-id')?.focus();
        return;
      }
      if (!name) {
        errorDiv.innerText = 'El Nombre Completo del Proyecto es obligatorio.';
        errorDiv.style.display = 'block';
        container.querySelector('#proj-name')?.focus();
        return;
      }
      if (!contract_number) {
        errorDiv.innerText = 'El Número de Contrato es obligatorio.';
        errorDiv.style.display = 'block';
        container.querySelector('#proj-contract')?.focus();
        return;
      }
      if (!entity) {
        errorDiv.innerText = 'La Entidad Propietaria / Contratante es obligatoria.';
        errorDiv.style.display = 'block';
        container.querySelector('#proj-entity')?.focus();
        return;
      }

      // Sync latest values from DOM cards into engineersList
      const techCards = rosterContainer.querySelectorAll('.tech-card-entry');
      techCards.forEach(card => {
        const idx = parseInt(card.getAttribute('data-index'), 10);
        if (engineersList[idx]) {
          const nameVal = card.querySelector('.eng-name')?.value;
          const cipVal = card.querySelector('.eng-cip')?.value;
          const roleVal = card.querySelector('.eng-role')?.value;
          const pinVal = card.querySelector('.eng-pin')?.value;
          const phoneVal = card.querySelector('.eng-phone')?.value;
          if (nameVal !== undefined) engineersList[idx].name = nameVal.trim();
          if (cipVal !== undefined) engineersList[idx].cip = cipVal.trim();
          if (roleVal !== undefined) engineersList[idx].role = roleVal;
          if (pinVal !== undefined) engineersList[idx].pin = pinVal.trim();
          if (phoneVal !== undefined) engineersList[idx].whatsapp = phoneVal.trim();
        }
      });

      // Validate technicians
      if (engineersList.length === 0) {
        errorDiv.innerText = 'Debe registrar al menos un ingeniero o especialista para el proyecto.';
        errorDiv.style.display = 'block';
        return;
      }

      for (let i = 0; i < engineersList.length; i++) {
        const eng = engineersList[i];
        if (!eng.name || !eng.name.trim()) {
          errorDiv.innerText = `Por favor ingrese el nombre del Ingeniero #${i + 1}`;
          errorDiv.style.display = 'block';
          return;
        }
        if (!eng.pin || eng.pin.trim().length !== 4) {
          errorDiv.innerText = `El PIN para "${eng.name}" debe tener exactamente 4 dígitos numéricos.`;
          errorDiv.style.display = 'block';
          return;
        }
      }

      // Set loading state on button
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `⏳ ${t('setup.saving') || 'Guardando y Activando...'}`;
      }

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
        cylinders_per_truck: 4,
        default_design_fc: 280,
        criteria: [
          { activity: 'COMPACTION', field: 'compaction_pct', operator: 'GTE', min_value: 95.0, unit: '%', source_reference: 'MTC EG-2013 Tabla 300-01' },
          { activity: 'SURVEY', field: 'elevation_dev_mm', operator: 'LTE', max_value: 10.0, unit: 'mm', source_reference: 'Expediente Técnico Topografía' },
          { activity: 'STEEL', field: 'concrete_cover_cm', operator: 'GTE', min_value: 4.0, unit: 'cm', source_reference: 'NTE E.060 Cap. 7' },
          { activity: 'STEEL', field: 'spacing_cm', operator: 'LTE', max_value: 20.0, unit: 'cm', source_reference: 'Plano de Estructuras' },
          { activity: 'FORMWORK', field: 'surface_clean', operator: 'EQ', expected_value: 'true', unit: 'checklist', source_reference: 'EG-2013 Sec. 402' },
          { activity: 'FORMWORK', field: 'release_agent_applied', operator: 'EQ', expected_value: 'true', unit: 'checklist', source_reference: 'EG-2013 Sec. 402' },
          { activity: 'FORMWORK', field: 'alignment_mm', operator: 'LTE', max_value: 5.0, unit: 'mm', source_reference: 'Tolerancias EG-2013' },
          { activity: 'FORMWORK', field: 'tightness_verified', operator: 'EQ', expected_value: 'true', unit: 'checklist', source_reference: 'EG-2013 Sec. 402' },
          { activity: 'CONCRETE', field: 'formwork_approved', operator: 'EQ', expected_value: 'true', unit: 'checklist', source_reference: 'Checklist Previo de Encofrado' },
          { activity: 'CONCRETE', field: 'slump', operator: 'IN', allowed_values: ['3.5', '4', '4.5', '5'], unit: 'pulgadas', source_reference: 'Requerimiento F2 Ing. David Valdez' },
          { activity: 'CONCRETE', field: 'cylinders_cast', operator: 'GTE', min_value: 4, unit: 'probetas/mixer', source_reference: 'MTC v2.4 (4 probetas por mixer)' },
          { activity: 'CONCRETE', field: 'design_fc', operator: 'GTE', min_value: 280, unit: 'kg/cm²', source_reference: 'Expediente Técnico Pavimento' }
        ],
        technicians: engineersList.map(e => ({
          name: e.name.trim(),
          role: e.role,
          cip_number: e.cip ? e.cip.trim() : null,
          pin: e.pin.trim(),
          whatsapp: e.whatsapp ? e.whatsapp.trim() : ''
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
      errorDiv.innerText = err.message || 'Error inesperado al guardar proyecto.';
      errorDiv.style.display = 'block';
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });
}
