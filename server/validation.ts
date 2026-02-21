/**
 * Data validation service for pay equity analysis
 * Handles schema validation, missing data detection, and outlier identification
 */

export interface EmployeeRecord {
  employeeId: string;
  gender: string;
  race: string;
  jobTitle: string;
  location: string;
  yearsExperience: number;
  yearsInRole: number;
  performanceRating: string;
  baseSalary: number;
}

export interface ValidationError {
  rowIndex: number;
  employeeId: string;
  field: string;
  error: string;
  value: any;
}

export interface OutlierRecord {
  rowIndex: number;
  employeeId: string;
  baseSalary: number;
  lowerBound: number;
  upperBound: number;
  deviationPercent: number;
}

export interface ValidationResult {
  valid: boolean;
  totalRecords: number;
  validRecords: number;
  errors: ValidationError[];
  outliers: OutlierRecord[];
  summary: {
    missingData: number;
    invalidTypes: number;
    outliersDetected: number;
  };
}

const REQUIRED_FIELDS = [
  'employeeId',
  'gender',
  'race',
  'jobTitle',
  'location',
  'yearsExperience',
  'yearsInRole',
  'performanceRating',
  'baseSalary',
];

const VALID_PERFORMANCE_RATINGS = ['Below Midpoint', 'Midpoint', 'Above Midpoint'];

/**
 * Validate a single employee record
 */
function validateRecord(record: any, rowIndex: number): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (record[field] === null || record[field] === undefined || record[field] === '') {
      errors.push({
        rowIndex,
        employeeId: record.employeeId || `Row ${rowIndex}`,
        field,
        error: 'Missing required field',
        value: record[field],
      });
    }
  }

  // Validate data types and constraints
  if (record.baseSalary !== null && record.baseSalary !== undefined) {
    const salary = Number(record.baseSalary);
    if (isNaN(salary) || salary <= 0) {
      errors.push({
        rowIndex,
        employeeId: record.employeeId,
        field: 'baseSalary',
        error: 'Must be a positive number',
        value: record.baseSalary,
      });
    }
  }

  if (record.yearsExperience !== null && record.yearsExperience !== undefined) {
    const years = Number(record.yearsExperience);
    if (isNaN(years) || years < 0) {
      errors.push({
        rowIndex,
        employeeId: record.employeeId,
        field: 'yearsExperience',
        error: 'Must be a non-negative number',
        value: record.yearsExperience,
      });
    }
  }

  if (record.yearsInRole !== null && record.yearsInRole !== undefined) {
    const years = Number(record.yearsInRole);
    if (isNaN(years) || years < 0) {
      errors.push({
        rowIndex,
        employeeId: record.employeeId,
        field: 'yearsInRole',
        error: 'Must be a non-negative number',
        value: record.yearsInRole,
      });
    }
  }

  // Validate performance rating
  if (record.performanceRating && !VALID_PERFORMANCE_RATINGS.includes(record.performanceRating)) {
    errors.push({
      rowIndex,
      employeeId: record.employeeId,
      field: 'performanceRating',
      error: `Must be one of: ${VALID_PERFORMANCE_RATINGS.join(', ')}`,
      value: record.performanceRating,
    });
  }

  return errors;
}

/**
 * Detect salary outliers using IQR method
 */
function detectOutliers(records: EmployeeRecord[]): OutlierRecord[] {
  // Extract valid salaries
  const salaries = records
    .map((r, idx) => ({ salary: r.baseSalary, index: idx, record: r }))
    .filter(item => item.salary > 0)
    .sort((a, b) => a.salary - b.salary);

  if (salaries.length < 4) {
    return []; // Need at least 4 data points for IQR
  }

  // Calculate quartiles
  const q1Index = Math.floor(salaries.length * 0.25);
  const q3Index = Math.floor(salaries.length * 0.75);
  
  const q1 = salaries[q1Index].salary;
  const q3 = salaries[q3Index].salary;
  const iqr = q3 - q1;

  // Calculate bounds
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  // Identify outliers
  const outliers: OutlierRecord[] = [];
  
  for (const item of salaries) {
    if (item.salary < lowerBound || item.salary > upperBound) {
      const deviation = item.salary < lowerBound
        ? ((lowerBound - item.salary) / lowerBound) * 100
        : ((item.salary - upperBound) / upperBound) * 100;

      outliers.push({
        rowIndex: item.index,
        employeeId: item.record.employeeId,
        baseSalary: item.salary,
        lowerBound,
        upperBound,
        deviationPercent: Math.round(deviation * 10) / 10,
      });
    }
  }

  return outliers;
}

/**
 * Validate all employee records
 */
export function validateEmployeeData(records: any[]): ValidationResult {
  const allErrors: ValidationError[] = [];
  
  // Validate each record
  records.forEach((record, index) => {
    const errors = validateRecord(record, index + 1); // 1-indexed for user display
    allErrors.push(...errors);
  });

  // Filter to valid records for outlier detection
  const validRecords = records.filter((record, index) => {
    const recordErrors = allErrors.filter(e => e.rowIndex === index + 1);
    return recordErrors.length === 0;
  });

  // Detect outliers
  const outliers = detectOutliers(validRecords as EmployeeRecord[]);

  // Calculate summary
  const missingDataErrors = allErrors.filter(e => e.error === 'Missing required field');
  const invalidTypeErrors = allErrors.filter(e => e.error !== 'Missing required field');

  return {
    valid: allErrors.length === 0,
    totalRecords: records.length,
    validRecords: validRecords.length,
    errors: allErrors,
    outliers,
    summary: {
      missingData: new Set(missingDataErrors.map(e => e.rowIndex)).size,
      invalidTypes: new Set(invalidTypeErrors.map(e => e.rowIndex)).size,
      outliersDetected: outliers.length,
    },
  };
}

/**
 * Check for small sample size warnings
 */
export function checkSampleSizes(records: EmployeeRecord[]): {
  warnings: Array<{
    group: string;
    field: string;
    count: number;
    severity: 'caution' | 'warning';
  }>;
} {
  const warnings: Array<{
    group: string;
    field: string;
    count: number;
    severity: 'caution' | 'warning';
  }> = [];

  // Count by gender
  const genderCounts = new Map<string, number>();
  records.forEach(r => {
    genderCounts.set(r.gender, (genderCounts.get(r.gender) || 0) + 1);
  });

  genderCounts.forEach((count, gender) => {
    if (count < 30) {
      warnings.push({
        group: gender,
        field: 'gender',
        count,
        severity: count < 10 ? 'warning' : 'caution',
      });
    }
  });

  // Count by race
  const raceCounts = new Map<string, number>();
  records.forEach(r => {
    raceCounts.set(r.race, (raceCounts.get(r.race) || 0) + 1);
  });

  raceCounts.forEach((count, race) => {
    if (count < 30) {
      warnings.push({
        group: race,
        field: 'race',
        count,
        severity: count < 10 ? 'warning' : 'caution',
      });
    }
  });

  return { warnings };
}
