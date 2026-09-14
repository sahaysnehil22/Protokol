import { DatabaseSync } from 'node:sqlite';
import { CriterionRecord, ValidationCheck, ActivityType } from '../types.js';

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
   */
  validateMeasurements(
    projectId: string,
    activity: ActivityType,
    measurements: Record<string, any>
  ): ValidationEvaluationResult {
    const criteria = this.getCriteria(projectId, activity);
    const checks: ValidationCheck[] = [];
    const failedChecks: ValidationCheck[] = [];

    for (const crit of criteria) {
      const actualValue = measurements[crit.field];
      
      // If a configured field is missing from measurements, it fails validation
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
  private evaluateCriterion(crit: CriterionRecord, actualValue: any): boolean {
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
  private formatExpected(crit: CriterionRecord): string {
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
