// PROTOKOL — View: Technician Identity & Device Setup
import { setConfigItem, getConfigItem } from '../db.js';

export async function renderIdentifyView(container, onAuthenticated) {
  const currentToken = localStorage.getItem('protokol_device_token') || 'dvc_pilot_david_01';
  const savedTechId = localStorage.getItem('protokol_tech_id') || 'tech_david_valdez';

  container.innerHTML = `
    <div class="card" style="margin-top: 10px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 32px; margin-bottom: 8px;">👷‍♂️</div>
        <h2 style="font-size: 20px; font-weight: 800; color: #F8FAFC;">Identificación de Campo</h2>
        <p style="font-size: 13px; color: var(--color-text-secondary);">
          Tramo AY-728 a AY-729 (Ayacucho) — Contrato N° 81-2026
        </p>
      </div>

      <form id="identify-form">
        <div class="form-group">
          <label class="form-label">Técnico / Especialista Responsable</label>
          <select id="tech-select" class="form-input" style="font-size: 15px;">
            <optgroup label="Equipo de Ejecución">
              <option value="tech_david_valdez" data-role="Quality Specialist">Ing. David Valdez Ochoa (Especialista de Calidad)</option>
              <option value="tech_resident" data-role="Site Resident">Ing. Carlos Mendoza (Residente de Obra)</option>
              <option value="tech_soils" data-role="Soils Specialist">Ing. Marco Quispe (Especialista en Suelos)</option>
              <option value="tech_assistant_exec" data-role="Assistant">Tec. Jorge Huamán (Asistente de Calidad)</option>
              <option value="tech_safety" data-role="Safety Specialist">Ing. Patricia Flores (Especialista de Seguridad)</option>
            </optgroup>
            <optgroup label="Equipo de Supervisión">
              <option value="tech_supervisor" data-role="Supervisor">Ing. Roberto Alarcón (Supervisor de Obra)</option>
              <option value="tech_structures" data-role="Structures Specialist">Ing. Luis Morales (Especialista Estructuras)</option>
              <option value="tech_assistant_sup" data-role="Assistant">Tec. Juan Ramos (Asistente Supervisión)</option>
            </optgroup>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">PIN de Seguridad (4 dígitos)</label>
          <div class="input-wrapper">
            <input 
              type="password" 
              id="tech-pin" 
              class="form-input" 
              inputmode="numeric" 
              pattern="[0-9]*" 
              maxlength="4" 
              placeholder="••••" 
              value="1234"
              required 
              style="text-align: center; letter-spacing: 8px; font-size: 24px;"
            />
          </div>
          <span class="form-label-hint">PIN piloto demo: 1234</span>
        </div>

        <div class="form-group" style="margin-top: 10px; margin-bottom: 24px;">
          <label class="form-label" style="font-size: 12px; color: var(--color-text-muted);">
            Token de Dispositivo Físico
          </label>
          <input 
            type="text" 
            id="device-token" 
            class="form-input" 
            value="${currentToken}" 
            readonly 
            style="font-size: 12px; color: var(--color-text-muted); background: #0B1120;"
          />
        </div>

        <div id="identify-error" style="color: #F87171; font-size: 13px; margin-bottom: 14px; display: none;"></div>

        <button type="submit" class="btn btn-primary">
          Ingresar al Panel de Campo →
        </button>
      </form>
    </div>
  `;

  const form = container.querySelector('#identify-form');
  const techSelect = container.querySelector('#tech-select');
  const pinInput = container.querySelector('#tech-pin');
  const errorDiv = container.querySelector('#identify-error');

  techSelect.value = savedTechId;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = pinInput.value.trim();
    const selectedOption = techSelect.options[techSelect.selectedIndex];
    const techId = techSelect.value;
    const role = selectedOption.getAttribute('data-role');
    const name = selectedOption.text.split('(')[0].trim();

    if (pin.length !== 4) {
      errorDiv.innerText = 'El PIN debe contener exactamente 4 dígitos.';
      errorDiv.style.display = 'block';
      return;
    }

    // Save session
    localStorage.setItem('protokol_device_token', currentToken);
    localStorage.setItem('protokol_tech_id', techId);
    localStorage.setItem('protokol_tech_name', name);
    localStorage.setItem('protokol_tech_role', role);
    localStorage.setItem('protokol_tech_pin', pin);

    await setConfigItem('session', {
      techId,
      name,
      role,
      pin,
      deviceToken: currentToken
    });

    onAuthenticated({
      techId,
      name,
      role,
      pin,
      deviceToken: currentToken
    });
  });
}
