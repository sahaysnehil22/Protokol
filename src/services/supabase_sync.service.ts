import { DatabaseSync } from 'node:sqlite';
import { getSupabaseClient, isSupabaseConfigured } from '../db/supabase.js';

export class SupabaseSyncService {
  /**
   * Pulls all existing projects, technicians, and protocols from Supabase Cloud PostgreSQL
   * into the local database instance on server startup.
   */
  static async syncFromSupabase(db: DatabaseSync): Promise<void> {
    if (!isSupabaseConfigured()) {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      console.log('⚡ [SUPABASE] Conectando y sincronizando con Supabase PostgreSQL...');

      // 1. Sync Projects
      const { data: projects, error: pErr } = await supabase.from('projects').select('*');
      if (pErr) throw pErr;

      if (projects && projects.length > 0) {
        const insertProj = db.prepare(`
          INSERT OR REPLACE INTO projects (
            id, name, contract_number, entity, execution_mode,
            location, road_section, timezone, timezone_offset,
            whatsapp_recipients, sampling_basis, cylinders_per_truck, default_design_fc, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const p of projects) {
          insertProj.run(
            p.id,
            p.name,
            p.contract_number,
            p.entity,
            p.execution_mode,
            p.location || null,
            p.road_section || null,
            p.timezone || 'America/Lima',
            p.timezone_offset || '-05:00',
            p.whatsapp_recipients || null,
            p.sampling_basis || 'PER_TRUCK',
            p.cylinders_per_truck || 4,
            p.default_design_fc || 210,
            p.created_at || new Date().toISOString()
          );
        }
      }

      // 2. Sync Technicians
      const { data: technicians, error: tErr } = await supabase.from('technicians').select('*');
      if (tErr) throw tErr;

      if (technicians && technicians.length > 0) {
        const insertTech = db.prepare(`
          INSERT OR REPLACE INTO technicians (
            id, project_id, name, pin_hash, device_token, whatsapp, role, cip_number, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of technicians) {
          insertTech.run(
            t.id,
            t.project_id,
            t.name,
            t.pin_hash,
            t.device_token,
            t.whatsapp || '',
            t.role,
            t.cip_number || null,
            t.created_at || new Date().toISOString()
          );
        }
      }

      // 3. Sync Criteria
      const { data: criteria, error: cErr } = await supabase.from('criteria').select('*');
      if (cErr) throw cErr;

      if (criteria && criteria.length > 0) {
        const insertCrit = db.prepare(`
          INSERT OR REPLACE INTO criteria (
            id, project_id, activity, field, operator,
            min_value, max_value, expected_value, unit, source_reference, is_active, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const c of criteria) {
          insertCrit.run(
            c.id,
            c.project_id,
            c.activity,
            c.field,
            c.operator,
            c.min_value !== undefined ? c.min_value : null,
            c.max_value !== undefined ? c.max_value : null,
            c.expected_value || null,
            c.unit || null,
            c.source_reference,
            c.is_active !== undefined ? c.is_active : 1,
            c.created_at || new Date().toISOString()
          );
        }
      }

      // 4. Sync Protocols
      const { data: protocols, error: prErr } = await supabase.from('protocols').select('*');
      if (prErr) throw prErr;

      if (protocols && protocols.length > 0) {
        const insertProto = db.prepare(`
          INSERT OR REPLACE INTO protocols (
            id, project_id, activity, chainage, panel, verdict,
            measurements, technician_id, device_token, gps_lat, gps_lng,
            recorded_at, integrity_hash, supersedes_protocol_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const pr of protocols) {
          insertProto.run(
            pr.id,
            pr.project_id,
            pr.activity,
            pr.chainage,
            pr.panel,
            pr.verdict,
            typeof pr.measurements === 'string' ? pr.measurements : JSON.stringify(pr.measurements),
            pr.technician_id,
            pr.device_token,
            pr.gps_lat,
            pr.gps_lng,
            pr.recorded_at,
            pr.integrity_hash,
            pr.supersedes_protocol_id || null,
            pr.created_at || new Date().toISOString()
          );
        }
      }

      // 5. Sync Concrete Trucks
      const { data: trucks, error: trErr } = await supabase.from('concrete_trucks').select('*');
      if (trErr) throw trErr;

      if (trucks && trucks.length > 0) {
        const insertTruck = db.prepare(`
          INSERT OR REPLACE INTO concrete_trucks (
            id, protocol_id, truck_number, mixer_id, delivery_note,
            slump_cm, cylinders_cast, design_fc, slump_verdict, notes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const tr of trucks) {
          insertTruck.run(
            tr.id,
            tr.protocol_id,
            tr.truck_number,
            tr.mixer_id,
            tr.delivery_note,
            tr.slump_cm,
            tr.cylinders_cast,
            tr.design_fc,
            tr.slump_verdict,
            tr.notes || null,
            tr.created_at || new Date().toISOString()
          );
        }
      }

      // 6. Sync Cylinders
      const { data: cylinders, error: cylErr } = await supabase.from('cylinders').select('*');
      if (cylErr) throw cylErr;

      if (cylinders && cylinders.length > 0) {
        const insertCyl = db.prepare(`
          INSERT OR REPLACE INTO cylinders (
            id, protocol_id, truck_id, truck_number, specimen_number,
            cylinder_code, cast_date, test_date, age_days, strength_kgcm2,
            design_fc, lab, report_photo_id, status, verdict, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const cyl of cylinders) {
          insertCyl.run(
            cyl.id,
            cyl.protocol_id,
            cyl.truck_id || null,
            cyl.truck_number || null,
            cyl.specimen_number || null,
            cyl.cylinder_code,
            cyl.cast_date,
            cyl.test_date || null,
            cyl.age_days,
            cyl.strength_kgcm2 !== undefined ? cyl.strength_kgcm2 : null,
            cyl.design_fc,
            cyl.lab || null,
            cyl.report_photo_id || null,
            cyl.status,
            cyl.verdict || null,
            cyl.created_at || new Date().toISOString()
          );
        }
      }

      console.log(`✅ [SUPABASE] Sincronización exitosa: ${projects?.length || 0} proyectos, ${technicians?.length || 0} técnicos, ${protocols?.length || 0} protocolos cargados.`);
    } catch (err: any) {
      console.warn('⚠️ [SUPABASE] Advertencia durante la sincronización inicial:', err.message);
    }
  }

  /**
   * Pushes a newly created project, its acceptance criteria, and initial technicians to Supabase.
   */
  static async pushProject(project: any, criteria: any[] = [], technicians: any[] = []): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      // 1. Insert Project
      await supabase.from('projects').upsert({
        id: project.id,
        name: project.name,
        contract_number: project.contract_number,
        entity: project.entity,
        execution_mode: project.execution_mode,
        location: project.location || null,
        road_section: project.road_section || null,
        timezone: project.timezone || 'America/Lima',
        timezone_offset: project.timezone_offset || '-05:00',
        whatsapp_recipients: project.whatsapp_recipients || null,
        sampling_basis: project.sampling_basis || 'PER_TRUCK',
        cylinders_per_truck: project.cylinders_per_truck || 4,
        default_design_fc: project.default_design_fc || 210
      });

      // 2. Insert Criteria
      if (criteria && criteria.length > 0) {
        await supabase.from('criteria').upsert(criteria);
      }

      // 3. Insert Technicians
      if (technicians && technicians.length > 0) {
        await supabase.from('technicians').upsert(technicians);
      }

      console.log(`☁️ [SUPABASE] Proyecto "${project.id}" guardado permanentemente en Supabase.`);
    } catch (err: any) {
      console.error('❌ [SUPABASE] Error al guardar proyecto en Supabase:', err.message);
    }
  }

  /**
   * Pushes a protocol and its associated multi-truck ready-mix records and cylinders to Supabase.
   */
  static async pushProtocol(protocol: any, trucks: any[] = [], cylinders: any[] = [], nonconformances: any[] = []): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase.from('protocols').upsert({
        id: protocol.id,
        project_id: protocol.project_id,
        activity: protocol.activity,
        chainage: protocol.chainage,
        panel: protocol.panel,
        verdict: protocol.verdict,
        measurements: protocol.measurements,
        technician_id: protocol.technician_id,
        device_token: protocol.device_token,
        gps_lat: protocol.gps_lat,
        gps_lng: protocol.gps_lng,
        recorded_at: protocol.recorded_at,
        integrity_hash: protocol.integrity_hash,
        supersedes_protocol_id: protocol.supersedes_protocol_id || null
      });

      if (trucks && trucks.length > 0) {
        await supabase.from('concrete_trucks').upsert(trucks);
      }

      if (cylinders && cylinders.length > 0) {
        await supabase.from('cylinders').upsert(cylinders);
      }

      if (nonconformances && nonconformances.length > 0) {
        await supabase.from('nonconformances').upsert(nonconformances);
      }

      console.log(`☁️ [SUPABASE] Protocolo "${protocol.id}" guardado en Supabase.`);
    } catch (err: any) {
      console.error('❌ [SUPABASE] Error al guardar protocolo en Supabase:', err.message);
    }
  }

  /**
   * Pushes a cylinder break test result update to Supabase.
   */
  static async pushCylinderResult(cylinder: any, newProtocolVerdict: string, nc: any = null): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    try {
      await supabase.from('cylinders').update({
        strength_kgcm2: cylinder.strength_kgcm2,
        lab: cylinder.lab,
        test_date: cylinder.test_date,
        status: 'TESTED',
        verdict: cylinder.verdict,
        report_photo_id: cylinder.report_photo_id || null
      }).eq('id', cylinder.id);

      if (newProtocolVerdict) {
        await supabase.from('protocols').update({ verdict: newProtocolVerdict }).eq('id', cylinder.protocol_id);
      }

      if (nc) {
        await supabase.from('nonconformances').upsert(nc);
      }

      console.log(`☁️ [SUPABASE] Ensayo de probeta "${cylinder.cylinder_code}" guardado en Supabase.`);
    } catch (err: any) {
      console.error('❌ [SUPABASE] Error al actualizar probeta en Supabase:', err.message);
    }
  }
}
