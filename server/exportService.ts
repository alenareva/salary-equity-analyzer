/**
 * Export service for generating CSV and PDF reports
 */

interface PayGapData {
  model: string;
  group: string;
  gapPercent: number;
  ciLower: number;
  ciUpper: number;
  significant: boolean;
}

interface AtRiskEmployee {
  employeeId: string;
  gender: string;
  race: string;
  actualSalary: number;
  predictedSalary: number;
  differencePercent: number;
  studentizedResidual: number;
}

/**
 * Sanitize a string value for safe CSV output.
 * 1. Escape embedded double quotes by doubling them.
 * 2. Prefix formula-triggering characters (=, +, -, @, \t, \r) with a
 *    single quote so spreadsheet apps treat them as text.
 */
function csvSafe(value: string): string {
  let sanitized = String(value).replace(/"/g, '""');

  if (/^[=+\-@\t\r]/.test(sanitized)) {
    sanitized = `'${sanitized}`;
  }

  return `"${sanitized}"`;
}

/**
 * Generate CSV for pay gaps
 */
export function generatePayGapsCSV(results: any): string {
  const rows: PayGapData[] = [];

  // Extract pay gaps from all models
  Object.entries(results.models || {}).forEach(([modelName, modelData]: [string, any]) => {
    // Gender gaps
    Object.entries(modelData.pay_gaps?.gender || {}).forEach(([group, data]: [string, any]) => {
      rows.push({
        model: modelName,
        group: `Gender: ${group}`,
        gapPercent: data.gap_pct,
        ciLower: data.ci_lower,
        ciUpper: data.ci_upper,
        significant: data.significant,
      });
    });

    // Race gaps
    Object.entries(modelData.pay_gaps?.race || {}).forEach(([group, data]: [string, any]) => {
      rows.push({
        model: modelName,
        group: `Race: ${group}`,
        gapPercent: data.gap_pct,
        ciLower: data.ci_lower,
        ciUpper: data.ci_upper,
        significant: data.significant,
      });
    });
  });

  // Convert to CSV
  const header = "Model,Group,Gap %,CI Lower,CI Upper,Significant\n";
  const csvRows = rows.map(row =>
    `${csvSafe(row.model)},${csvSafe(row.group)},${row.gapPercent.toFixed(2)},${row.ciLower.toFixed(2)},${row.ciUpper.toFixed(2)},${row.significant}`
  );

  return header + csvRows.join("\n");
}

/**
 * Generate CSV for at-risk employees
 */
export function generateAtRiskCSV(results: any): string {
  const atRisk = results.at_risk_employees?.at_risk || [];

  if (atRisk.length === 0) {
    return "No at-risk employees identified\n";
  }

  const header = "Employee ID,Gender,Race,Actual Salary,Predicted Salary,Difference %,Residual\n";
  const csvRows = atRisk.map((emp: any) =>
    `${csvSafe(emp.employee_id)},${csvSafe(emp.gender)},${csvSafe(emp.race)},${emp.actual_salary},${emp.predicted_salary},${emp.difference_pct.toFixed(2)},${emp.studentized_residual.toFixed(2)}`
  );

  return header + csvRows.join("\n");
}

/**
 * Generate CSV for model results
 */
export function generateModelResultsCSV(results: any): string {
  const rows: any[] = [];

  Object.entries(results.models || {}).forEach(([modelName, modelData]: [string, any]) => {
    rows.push({
      model: modelName,
      rSquared: modelData.model_fit?.r_squared || 0,
      fStatistic: modelData.model_fit?.f_statistic || 0,
      observations: modelData.model_fit?.n_obs || 0,
    });
  });

  const header = "Model,R²,F-Statistic,Observations\n";
  const csvRows = rows.map(row =>
    `${csvSafe(row.model)},${row.rSquared.toFixed(4)},${row.fStatistic.toFixed(2)},${row.observations}`
  );

  return header + csvRows.join("\n");
}

/**
 * Generate comprehensive CSV with all results
 */
export function generateFullResultsCSV(results: any): string {
  let csv = "PAY EQUITY ANALYSIS RESULTS\n\n";

  // Overall Score
  csv += "OVERALL PAY EQUITY SCORE\n";
  csv += `Score,${results.equity_score?.equity_score || 0}\n`;
  csv += `Interpretation,${csvSafe(results.equity_score?.interpretation || 'Unknown')}\n`;
  csv += `Recommendation,${csvSafe(results.equity_score?.recommendation || '')}\n\n`;

  // Pay Gaps
  csv += "PAY GAPS BY MODEL\n";
  csv += generatePayGapsCSV(results) + "\n\n";

  // At-Risk Employees
  csv += "AT-RISK EMPLOYEES\n";
  csv += generateAtRiskCSV(results) + "\n\n";

  // Model Results
  csv += "MODEL FIT STATISTICS\n";
  csv += generateModelResultsCSV(results) + "\n";

  return csv;
}

/**
 * Generate a real PDF report using PDFKit.
 */
export async function generatePDFReport(results: any): Promise<Buffer> {
  const PDFDocument = (await import("pdfkit")).default;

  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const blue = "#2563eb";
    const gray = "#6b7280";
    const red = "#dc2626";
    const green = "#16a34a";
    const yellow = "#ca8a04";
    const pageWidth = doc.page.width - 100; // margins

    // ── Helper: section heading ──
    const heading = (text: string) => {
      doc.moveDown(0.8);
      doc.fontSize(14).fillColor(blue).text(text);
      doc
        .moveTo(50, doc.y + 2)
        .lineTo(50 + pageWidth, doc.y + 2)
        .strokeColor(blue)
        .lineWidth(0.5)
        .stroke();
      doc.moveDown(0.4);
      doc.fillColor("#000");
    };

    // ── Helper: key/value line ──
    const kvLine = (label: string, value: string) => {
      doc.fontSize(10).fillColor(gray).text(label, { continued: true });
      doc.fillColor("#000").text(`  ${value}`);
    };

    // ── Helper: simple table ──
    const simpleTable = (
      headers: string[],
      rows: string[][],
      colWidths: number[]
    ) => {
      const startX = 50;
      // Header row
      doc.fontSize(8).fillColor(gray);
      let x = startX;
      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], x, doc.y, {
          width: colWidths[i],
          continued: i < headers.length - 1,
        });
        x += colWidths[i];
      }
      doc.moveDown(0.3);

      // Data rows
      doc.fillColor("#000").fontSize(9);
      for (const row of rows) {
        if (doc.y > doc.page.height - 80) {
          doc.addPage();
        }
        x = startX;
        for (let i = 0; i < row.length; i++) {
          doc.text(row[i], x, doc.y, {
            width: colWidths[i],
            continued: i < row.length - 1,
          });
          x += colWidths[i];
        }
        doc.moveDown(0.15);
      }
    };

    // ── Title page ──
    doc.fontSize(24).fillColor(blue).text("Pay Equity Analysis Report", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc
      .fontSize(10)
      .fillColor(gray)
      .text(`Generated ${new Date().toLocaleDateString()}`, {
        align: "center",
      });
    doc.moveDown(1.5);

    // ── Executive Summary ──
    const score = results.equity_score?.equity_score ?? 0;
    const interpretation = results.equity_score?.interpretation || "Unknown";
    const scoreColor = score >= 85 ? green : score >= 70 ? yellow : red;

    heading("Executive Summary");
    doc.fontSize(36).fillColor(scoreColor).text(`${score}/100`, { align: "center" });
    doc
      .fontSize(14)
      .fillColor("#000")
      .text(interpretation, { align: "center" });
    doc.moveDown(0.5);

    if (results.equity_score?.recommendation) {
      doc
        .fontSize(10)
        .fillColor(gray)
        .text(results.equity_score.recommendation, { align: "left" });
    }
    doc.moveDown(0.3);

    const atRiskTotal =
      results.at_risk_employees?.summary?.total_at_risk || 0;
    const watchTotal =
      results.at_risk_employees?.summary?.total_watch_list || 0;
    kvLine("At-Risk Employees:", String(atRiskTotal));
    kvLine("Watch List:", String(watchTotal));
    kvLine("Sample Size:", String(results.sample_size ?? "—"));

    // ── Pay Gaps (fully adjusted) ──
    const fullyAdjusted = results.models?.fully_adjusted;
    if (fullyAdjusted && !fullyAdjusted.error) {
      heading("Pay Gaps — Fully Adjusted Model");
      doc
        .fontSize(9)
        .fillColor(gray)
        .text(
          "Percentage pay difference after controlling for job title, experience, performance, and location."
        );
      doc.moveDown(0.4);

      const gapRows: string[][] = [];
      const genderGaps = fullyAdjusted.pay_gaps?.gender || {};
      const genderRef = fullyAdjusted.pay_gaps?.gender_reference;
      for (const [group, data] of Object.entries<any>(genderGaps)) {
        if (data.is_reference) continue;
        gapRows.push([
          `Gender: ${group} vs ${genderRef || "ref"}`,
          `${data.gap_pct?.toFixed(1)}%`,
          `${data.ci_lower?.toFixed(1)}% to ${data.ci_upper?.toFixed(1)}%`,
          data.p_value != null ? data.p_value.toFixed(4) : "—",
          data.significant ? "Yes" : "No",
        ]);
      }
      const raceGaps = fullyAdjusted.pay_gaps?.race || {};
      const raceRef = fullyAdjusted.pay_gaps?.race_reference;
      for (const [group, data] of Object.entries<any>(raceGaps)) {
        if (data.is_reference) continue;
        gapRows.push([
          `Race: ${group} vs ${raceRef || "ref"}`,
          `${data.gap_pct?.toFixed(1)}%`,
          `${data.ci_lower?.toFixed(1)}% to ${data.ci_upper?.toFixed(1)}%`,
          data.p_value != null ? data.p_value.toFixed(4) : "—",
          data.significant ? "Yes" : "No",
        ]);
      }

      simpleTable(
        ["Group", "Gap", "95% CI", "p-value", "Significant"],
        gapRows,
        [170, 60, 120, 70, 70]
      );
    }

    // ── Progressive Models ──
    heading("Progressive Model Fit");
    doc
      .fontSize(9)
      .fillColor(gray)
      .text(
        "Five regression models, each adding more control variables. R² shows how much salary variation the model explains (0–1 scale)."
      );
    doc.moveDown(0.4);

    const modelLabels: Record<string, string> = {
      unadjusted: "Unadjusted (raw gaps)",
      job_adjusted: "+ Job Title",
      job_experience: "+ Job + Experience",
      plus_performance: "+ Job + Exp + Performance",
      fully_adjusted: "+ Job + Exp + Perf + Location",
    };

    const modelRows: string[][] = [];
    for (const [name, data] of Object.entries<any>(results.models || {})) {
      if (data.error) {
        modelRows.push([modelLabels[name] || name, "Error", "—"]);
      } else {
        modelRows.push([
          modelLabels[name] || name,
          data.model_fit?.r_squared?.toFixed(4) ?? "—",
          String(data.model_fit?.n_obs ?? "—"),
        ]);
      }
    }
    simpleTable(["Model", "R²", "Observations"], modelRows, [220, 100, 100]);

    // ── At-Risk Employees ──
    const atRisk = results.at_risk_employees?.at_risk || [];
    if (atRisk.length > 0) {
      heading("At-Risk Employees");
      doc
        .fontSize(9)
        .fillColor(gray)
        .text(
          "Employees paid significantly less than the model predicts (studentized residual < -2.0)."
        );
      doc.moveDown(0.4);

      const empRows = atRisk.slice(0, 30).map((emp: any) => [
        emp.employee_id || "—",
        emp.gender || "—",
        emp.race || "—",
        `$${(emp.actual_salary ?? 0).toLocaleString()}`,
        `$${(emp.predicted_salary ?? 0).toLocaleString()}`,
        `${(emp.difference_pct ?? 0).toFixed(1)}%`,
      ]);
      simpleTable(
        ["ID", "Gender", "Race", "Actual", "Predicted", "Diff %"],
        empRows,
        [70, 70, 70, 85, 85, 60]
      );
      if (atRisk.length > 30) {
        doc
          .moveDown(0.3)
          .fontSize(8)
          .fillColor(gray)
          .text(`Showing 30 of ${atRisk.length} at-risk employees. Export CSV for the full list.`);
      }
    }

    // ── Diagnostics ──
    if (results.diagnostics) {
      heading("Model Diagnostics");

      const diagRows: string[][] = [];
      const diag = results.diagnostics;
      if (diag.multicollinearity) {
        diagRows.push([
          "Multicollinearity (VIF)",
          `Max VIF: ${diag.multicollinearity.max_vif?.toFixed(2) ?? "—"}`,
          diag.multicollinearity.status === "pass" ? "Pass" : "Warning",
        ]);
      }
      if (diag.heteroscedasticity) {
        diagRows.push([
          "Breusch-Pagan (variance consistency)",
          `p = ${diag.heteroscedasticity.p_value?.toFixed(4) ?? "—"}`,
          diag.heteroscedasticity.status === "pass" ? "Pass" : "Warning",
        ]);
      }
      if (diag.normality) {
        diagRows.push([
          "Shapiro-Wilk (residual normality)",
          `p = ${diag.normality.p_value?.toFixed(4) ?? "—"}`,
          diag.normality.status === "pass" ? "Pass" : "Warning",
        ]);
      }
      simpleTable(["Test", "Result", "Status"], diagRows, [200, 150, 80]);
    }

    // ── Methodology ──
    heading("Methodology");
    doc
      .fontSize(9)
      .fillColor("#000")
      .text(
        "This analysis uses ordinary least-squares (OLS) multiple linear regression on log-transformed salaries. " +
          "Five progressive models add control variables incrementally — job title, years of experience, years in role, " +
          "performance rating, and work location — to isolate pay disparities associated with gender and race. " +
          "At-risk employees are identified using studentized residuals from the fully adjusted model. " +
          "Employees whose actual pay falls more than 2 standard deviations below the model's prediction are flagged."
      );

    // ── Footer ──
    doc.moveDown(1);
    doc
      .fontSize(8)
      .fillColor(gray)
      .text(
        "This report is for informational purposes only and does not constitute legal or professional advice.",
        { align: "center" }
      );

    // Finalize — this triggers the 'end' event
    doc.end();
  });
}
