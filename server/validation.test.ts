import { describe, expect, it } from "vitest";
import { validateEmployeeData, checkSampleSizes } from "./validation";

describe("validateEmployeeData", () => {
  it("should pass validation for valid employee data", () => {
    const validData = [
      {
        employeeId: "EMP001",
        gender: "Male",
        race: "White",
        jobTitle: "Engineer",
        location: "California",
        yearsExperience: 5,
        yearsInRole: 2,
        performanceRating: "Above Midpoint",
        baseSalary: 120000,
      },
    ];

    const result = validateEmployeeData(validData);
    expect(result.errors).toHaveLength(0);
    expect(result.validRecords).toBe(1);
  });

  it("should detect missing required fields", () => {
    const invalidData = [
      {
        employeeId: "",
        gender: "Male",
        race: "White",
        jobTitle: "Engineer",
        location: "California",
        yearsExperience: 5,
        yearsInRole: 2,
        performanceRating: "Above Midpoint",
        baseSalary: 120000,
      },
    ];

    const result = validateEmployeeData(invalidData);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.field).toBe("employeeId");
  });

  it("should detect invalid salary values", () => {
    const invalidData = [
      {
        employeeId: "EMP001",
        gender: "Male",
        race: "White",
        jobTitle: "Engineer",
        location: "California",
        yearsExperience: 5,
        yearsInRole: 2,
        performanceRating: "Above Midpoint",
        baseSalary: -5000,
      },
    ];

    const result = validateEmployeeData(invalidData);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.field).toBe("baseSalary");
  });

  it("should validate records without sample size warnings", () => {
    const smallSample = Array.from({ length: 8 }, (_, i) => ({
      employeeId: `EMP${String(i + 1).padStart(3, "0")}`,
      gender: "Male",
      race: "White",
      jobTitle: "Engineer",
      location: "California",
      yearsExperience: 5,
      yearsInRole: 2,
      performanceRating: "Above Midpoint",
      baseSalary: 120000,
    }));

    const result = validateEmployeeData(smallSample);
    expect(result.validRecords).toBe(8);
    expect(result.errors).toHaveLength(0);
  });
});

describe("checkSampleSizes", () => {
  it("should detect small sample sizes", () => {
    const smallSample = Array.from({ length: 8 }, (_, i) => ({
      employeeId: `EMP${String(i + 1).padStart(3, "0")}`,
      gender: "Male",
      race: "White",
      jobTitle: "Engineer",
      location: "California",
      yearsExperience: 5,
      yearsInRole: 2,
      performanceRating: "Above Midpoint",
      baseSalary: 120000,
    }));

    const result = checkSampleSizes(smallSample);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should not warn for groups with 30+ members", () => {
    // Create 60 records with 2 genders (30 each) and 2 races (30 each)
    const adequateSample = Array.from({ length: 60 }, (_, i) => ({
      employeeId: `EMP${String(i + 1).padStart(3, "0")}`,
      gender: i < 30 ? "Male" : "Female",
      race: i % 2 === 0 ? "White" : "Black",
      jobTitle: "Engineer",
      location: "California",
      yearsExperience: 5,
      yearsInRole: 2,
      performanceRating: "Above Midpoint",
      baseSalary: 50000 + i * 1000,
    }));

    const result = checkSampleSizes(adequateSample);
    // Should have no warnings since all groups have exactly 30 members
    expect(result.warnings).toHaveLength(0);
  });
});
