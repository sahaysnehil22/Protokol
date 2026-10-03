import request from 'supertest';

/**
 * Test helper: returns a supertest agent holding a valid session cookie for
 * the given project (two-tier auth: project PIN verified via /verify-access).
 * For seeded legacy projects (no access_pin_hash) the technician PIN works.
 */
export async function authedAgent(
  app: any,
  projectId = 'AY-728-001',
  pin = '1234',
  deviceToken = 'test-device-01'
) {
  const agent = request.agent(app);
  const res = await agent
    .post(`/api/projects/${projectId}/verify-access`)
    .send({ pin, device_token: deviceToken });
  if (res.status !== 200) {
    throw new Error(`test login failed for ${projectId}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}

/** Creates a project (with centralized access PIN) and returns a logged-in agent. */
export async function createProjectAndLogin(app: any, overrides: Record<string, any> = {}) {
  const projectId = overrides.id || `PROJ-T-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const access_pin = overrides.access_pin || 'test-pin-1234';
  const createRes = await request(app)
    .post('/api/projects')
    .send({
      name: 'Proyecto de Prueba',
      contract_number: 'TEST-001',
      entity: 'Test Entity',
      execution_mode: 'Contrata',
      access_pin,
      ...overrides,
      id: projectId,
    });
  if (createRes.status !== 201) {
    throw new Error(`test project creation failed: ${createRes.status} ${JSON.stringify(createRes.body)}`);
  }
  const agent = await authedAgent(app, projectId, access_pin);
  return { agent, projectId, access_pin };
}
