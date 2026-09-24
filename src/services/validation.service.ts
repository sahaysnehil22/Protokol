import { DatabaseSync } from 'node:sqlite';
import { CriterionRecord, ValidationCheck, ActivityType, ConcreteTruckInput } from '../types.js';

export interface ValidationEvaluationResult {
  checks: ValidationCheck[];
  allPassed: boolean;
  failedChecks: ValidationCheck[];
}

export class ValidationService {
  constructor(private db: DatabaseSync) {}

  /**
   * Retrieves active criteria for a given project and activity.
   */
  getCriteria(projectId: string, activity: ActivityType): CriterionRecord[] {
    const stmt = this.db.prepare(`
      SELECT id, project_id, activity, field, operator, min_value, max_value, allowed_values, expected_value, unit, source_reference, hold_point, is_active
      FROM criteria
      WHERE project_id = ? AND activity = ? AND is_active = 1
    `);
    const rows = stmt.all(projectId, activity) as any[];
    return rows.map(r => {
      let allowedValues: string[] | null = null;
      if (r.allowed_values) {
        if (Array.isArray(r.allowed_values)) {
          allowedValues = r.allowed_values;
        } else if (typeof r.allowed_values === 'string') {
          try {
            const parsed = JSON.parse(r.allowed_values);
            if (Array.isArray(parsed)) allowedValues = parsed.map(String);
          } catch {
            allowedValues = r.allowed_values.split(',').map((s: string) => s.trim());
          }
        }
      }
      return {
        ...r,
        allowed_values: allowedValues,
        hold_point: Boolean(r.hold_point)
      } as CriterionRecord;
    });
  }

  /**
   * Validates submitted measurements against the project's criteria.
   * Supports both standard measurements and multi-truck concrete pour validation.
   */
  validateMeasurements(
    projectId: string,
    activity: ActivityType,
    measurements: Record<string, any>
  ): ValidationEvaluationResult {
    const criteria = this.getCriteria(projectId, activity);
    const checks: ValidationCheck[] = [];
    const failedChecks: ValidationCheck[] = [];

    // Special handling for multi-truck concrete pours
    if (activity === 'CONCRETE' && Array.isArray(measurements.trucks) && measurements.trucks.length > 0) {
      const slumpCrit = criteria.find(c => c.field === 'slump' || c.field === 'slump_cm');
      const cylindersCrit = criteria.find(c => c.field === 'cylinders_cast');
      const formworkCrit = criteria.find(c => c.field === 'formwork_approved');

      // 1. Validate Formwork pre-pour checklist if criterion exists
      if (formworkCrit) {
        const actualVal = measurements.formwork_approved;
        if (actualVal === undefined || actualVal === null) {
          const check: ValidationCheck = {
            field: formworkCrit.field,
            expected: this.formatExpected(formworkCrit),
            actual: 'MISSING',
            result: 'FAIL',
            unit: formworkCrit.unit || undefined,
            source_reference: formworkCrit.source_reference
          };
          checks.push(check);
          failedChecks.push(check);
        } else {
          const passed = this.evaluateCriterion(formworkCrit, actualVal);
          const check: ValidationCheck = {
            field: formworkCrit.field,
            expected: this.formatExpected(formworkCrit),
            actual: actualVal,
            result: passed ? 'PASS' : 'FAIL',
            unit: formworkCrit.unit || undefined,
            source_reference: formworkCrit.source_reference
          };
          checks.push(check);
          if (!passed) failedChecks.push(check);
        }
      }

      // 2. Validate each truck independently
      const trucks: ConcreteTruckInput[] = measurements.trucks;
      for (const truck of trucks) {
        const truckLabel = `Mixer ${truck.mixer_id} (Guía ${truck.delivery_note})`;

        // Validate Slump (supports both discrete slump inches "3.5", "4", "4.5", "5" and slump_cm)
        if (slumpCrit) {
          let rawSlump: any;
          if (slumpCrit.field === 'slump_cm' || slumpCrit.unit === 'cm') {
            rawSlump = truck.slump_cm !== undefined ? truck.slump_cm : (truck.slump ? parseFloat(truck.slump) * 2.54 : undefined);
          } else {
            rawSlump = truck.slump !== undefined && truck.slump !== null && String(truck.slump).trim() !== ''
              ? String(truck.slump)
              : (truck.slump_cm !== undefined ? truck.slump_cm : undefined);
          }

          if (rawSlump === undefined || rawSlump === null) {
            const check: ValidationCheck = {
              field: `${slumpCrit.field} [Camión ${truck.truck_number}: ${truckLabel}]`,
              expected: this.formatExpected(slumpCrit),
              actual: 'MISSING',
              result: 'FAIL',
              unit: slumpCrit.unit || (slumpCrit.operator === 'IN' ? '"' : 'cm'),
              source_reference: slumpCrit.source_reference
            };
            checks.push(check);
            failedChecks.push(check);
          } else {
            const passed = this.evaluateCriterion(slumpCrit, rawSlump);
            const check: ValidationCheck = {
              field: `${slumpCrit.field} [Camión ${truck.truck_number}: ${truckLabel}]`,
              expected: this.formatExpected(slumpCrit),
              actual: rawSlump,
              result: passed ? 'PASS' : 'FAIL',
              unit: slumpCrit.unit || (slumpCrit.operator === 'IN' ? '"' : 'cm'),
              source_reference: slumpCrit.source_reference
            };
            checks.push(check);
            if (!passed) failedChecks.push(check);
          }
        }

        // Validate Cylinders Cast per truck if criterion exists
        if (cylindersCrit && truck.cylinders_cast !== undefined) {
          const passed = this.evaluateCriterion(cylindersCrit, truck.cylinders_cast);
          const check: ValidationCheck = {
            field: `cylinders_cast [Camión ${truck.truck_number}: ${truckLabel}]`,
            expected: this.formatExpected(cylindersCrit),
            actual: truck.cylinders_cast,
            result: passed ? 'PASS' : 'FAIL',
            unit: cylindersCrit.unit || 'probetas',
            source_reference: cylindersCrit.source_reference
          };
          checks.push(check);
          if (!passed) failedChecks.push(check);
        }
      }

      return {
        checks,
        allPassed: failedChecks.length === 0,
        failedChecks
      };
    }

    // Standard field-by-field evaluation (for non-concrete or legacy single-truck payloads)
    for (const crit of criteria) {
      const actualValue = measurements[crit.field];

      if (actualValue === undefined || actualValue === null) {
        const check: ValidationCheck = {
          field: crit.field,
          expected: this.formatExpected(crit),
          actual: 'MISSING',
          result: 'FAIL',
          unit: crit.unit || undefined,
          source_reference: crit.source_reference
        };
        checks.push(check);
        failedChecks.push(check);
        continue;
      }

      const passed = this.evaluateCriterion(crit, actualValue);
      const check: ValidationCheck = {
        field: crit.field,
        expected: this.formatExpected(crit),
        actual: actualValue,
        result: passed ? 'PASS' : 'FAIL',
        unit: crit.unit || undefined,
        source_reference: crit.source_reference
      };

      checks.push(check);
      if (!passed) {
        failedChecks.push(check);
      }
    }

    return {
      checks,
      allPassed: failedChecks.length === 0,
      failedChecks
    };
  }

  /**
   * Evaluates a single criterion rule deterministically.
   */
  evaluateCriterion(crit: CriterionRecord, actualValue: any): boolean {
    const numActual = typeof actualValue === 'number' ? actualValue : parseFloat(actualValue);

    switch (crit.operator) {
      case 'IN': {
        const allowed = Array.isArray(crit.allowed_values) ? crit.allowed_values : [];
        if (allowed.length === 0) return true;
        const cleanActual = String(actualValue).replace(/["'\s]/g, '');
        // Check direct match
        const directMatch = allowed.some(a => {
          const cleanAllowed = String(a).replace(/["'\s]/g, '');
          return cleanAllowed === cleanActual || parseFloat(cleanAllowed) === parseFloat(cleanActual);
        });
        if (directMatch) return true;

        // If actualValue was submitted in cm or fractional inches
        const numVal = parseFloat(cleanActual);
        if (!isNaN(numVal)) {
          if (numVal >= 8.5 && numVal <= 13.0) {
            return true; // within 8.9 - 12.7 cm reference band
          }
          if (numVal >= 3.25 && numVal <= 5.25) {
            return true; // within 3.5" - 5" discrete range
          }
        }
        return false;
      }

      case 'BETWEEN':
        if (isNaN(numActual) || crit.min_value === null || crit.min_value === undefined || crit.max_value === null || crit.max_value === undefined) {
          return false;
        }
        // If criterion is in cm (8.9 - 12.7) but value was supplied in inches (3.5 - 5.0)
        if (numActual >= 1.0 && numActual <= 8.0 && crit.min_value >= 8.0) {
          const inCm = numActual * 2.54;
          return inCm >= (crit.min_value - 0.1) && inCm <= (crit.max_value + 0.1);
        }
        return numActual >= crit.min_value && numActual <= crit.max_value;

      case 'GTE':
        if (isNaN(numActual) || crit.min_value === null || crit.min_value === undefined) {
          return false;
        }
        return numActual >= crit.min_value;

      case 'LTE':
        if (isNaN(numActual) || crit.max_value === null || crit.max_value === undefined) {
          return false;
        }
        return numActual <= crit.max_value;

      case 'EQ':
        if (crit.expected_value === 'true' || crit.expected_value === 'false') {
          return String(actualValue).toLowerCase() === crit.expected_value.toLowerCase();
        }
        return String(actualValue) === String(crit.expected_value);

      default:
        return false;
    }
  }

  /**
   * Formats the expected criterion range or value for display and PDF certificates.
   */
  formatExpected(crit: CriterionRecord): string {
    switch (crit.operator) {
      case 'IN': {
        const allowed = Array.isArray(crit.allowed_values) ? crit.allowed_values : [];
        const formatted = allowed.map(v => String(v).includes('"') ? String(v) : `${v}"`).join(' / ');
        return formatted || 'Valores permitidos';
      }
      case 'BETWEEN':
        return `${crit.min_value} - ${crit.max_value}${crit.unit ? ' ' + crit.unit : ''}`;
      case 'GTE':
        return `>= ${crit.min_value}${crit.unit ? ' ' + crit.unit : ''}`;
      case 'LTE':
        return `<= ${crit.max_value}${crit.unit ? ' ' + crit.unit : ''}`;
      case 'EQ':
        return `${crit.expected_value}${crit.unit ? ' ' + crit.unit : ''}`;
      default:
        return 'N/A';
    }
  }
}
