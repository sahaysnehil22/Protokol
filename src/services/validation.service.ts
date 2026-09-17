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
      SELECT id, project_id, activity, field, operator, min_value, max_value, expected_value, unit, source_reference, is_active
      FROM criteria
      WHERE project_id = ? AND activity = ? AND is_active = 1
    `);
    return stmt.all(projectId, activity) as unknown as CriterionRecord[];
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
      const slumpCrit = criteria.find(c => c.field === 'slump_cm');
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

        // Validate Slump
        if (slumpCrit) {
          if (truck.slump_cm === undefined || truck.slump_cm === null || isNaN(Number(truck.slump_cm))) {
            const check: ValidationCheck = {
              field: `slump_cm [Camión ${truck.truck_number}: ${truckLabel}]`,
              expected: this.formatExpected(slumpCrit),
              actual: 'MISSING',
              result: 'FAIL',
              unit: slumpCrit.unit || 'cm',
              source_reference: slumpCrit.source_reference
            };
            checks.push(check);
            failedChecks.push(check);
          } else {
            const passed = this.evaluateCriterion(slumpCrit, truck.slump_cm);
            const check: ValidationCheck = {
              field: `slump_cm [Camión ${truck.truck_number}: ${truckLabel}]`,
              expected: this.formatExpected(slumpCrit),
              actual: truck.slump_cm,
              result: passed ? 'PASS' : 'FAIL',
              unit: slumpCrit.unit || 'cm',
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
      case 'BETWEEN':
        if (isNaN(numActual) || crit.min_value === null || crit.min_value === undefined || crit.max_value === null || crit.max_value === undefined) {
          return false;
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
