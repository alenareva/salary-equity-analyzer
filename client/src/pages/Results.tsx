import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc, trpcClient } from "@/lib/trpc";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileText, Info, Loader2 } from "lucide-react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";

/**
 * Inline tooltip for statistical terms. Renders as a dotted-underline term
 * with an info icon that shows a plain-English explanation on hover.
 */
function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help border-b border-dotted border-muted-foreground/50">
          {label}
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

/** Human-readable descriptions for each progressive model. */
const MODEL_INFO: Record<string, { title: string; description: string }> = {
  unadjusted: {
    title: "Unadjusted (Raw Gaps)",
    description: "Raw pay differences by gender and race with no other factors considered. This is the starting point — it shows the overall gap but doesn't tell us why it exists.",
  },
  job_adjusted: {
    title: "Adjusted for Job Title",
    description: "Pay gaps after accounting for differences in job titles. If men and women hold different roles, this removes that effect to compare more fairly.",
  },
  job_experience: {
    title: "Adjusted for Job + Experience",
    description: "Adds years of experience and time in current role. This accounts for the fact that more experienced employees typically earn more.",
  },
  plus_performance: {
    title: "Adjusted for Job + Experience + Performance",
    description: "Also factors in performance ratings. This controls for the possibility that pay differences reflect performance differences.",
  },
  fully_adjusted: {
    title: "Fully Adjusted",
    description: "Controls for everything: job title, experience, performance, and location. Any remaining gap here can't be explained by these legitimate factors — it may indicate a pay equity issue.",
  },
};

/** Custom tooltip for pay gap bar charts. */
function PayGapTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-card border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold mb-1">{label}{data.isReference ? " (reference group)" : ""}</p>
      {data.isReference ? (
        <p className="text-muted-foreground text-xs">
          This is the baseline group. Other groups' gaps are measured relative to this one.
        </p>
      ) : (
        <>
          <p>
            Pay gap: <span className="font-semibold">{data.gap?.toFixed(1)}%</span>
          </p>
          {data.ciLower != null && data.ciUpper != null && (
            <p className="text-muted-foreground text-xs mt-1">
              95% confidence interval: {data.ciLower?.toFixed(1)}% to {data.ciUpper?.toFixed(1)}%
            </p>
          )}
          <p className="text-xs mt-1">
            {data.significant
              ? "Statistically significant — unlikely to be due to chance"
              : "Not statistically significant — could be due to random variation"}
          </p>
        </>
      )}
    </div>
  );
}

export default function Results() {
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session");

  const { data: results, isLoading } = trpc.analysis.getResults.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>No Session Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/upload">Start New Analysis</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!results || !results.success) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Analysis Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Unable to load analysis results</p>
            <Button asChild>
              <Link href="/upload">Start New Analysis</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const equityScore = results.equity_score?.equity_score || 0;
  const interpretation = results.equity_score?.interpretation || "Unknown";
  const fullyAdjusted = results.models?.fully_adjusted;

  const genderGaps = fullyAdjusted?.pay_gaps?.gender || {};
  const raceGaps = fullyAdjusted?.pay_gaps?.race || {};
  const genderRef = fullyAdjusted?.pay_gaps?.gender_reference as string | undefined;
  const raceRef = fullyAdjusted?.pay_gaps?.race_reference as string | undefined;

  const genderChartData = Object.entries(genderGaps).map(([group, data]: [string, any]) => ({
    group: data.is_reference ? `${group} (ref)` : group,
    gap: data.gap_pct,
    ciLower: data.ci_lower,
    ciUpper: data.ci_upper,
    significant: data.significant,
    isReference: !!data.is_reference,
  }));

  const raceChartData = Object.entries(raceGaps).map(([group, data]: [string, any]) => ({
    group: data.is_reference ? `${group} (ref)` : group,
    gap: data.gap_pct,
    ciLower: data.ci_lower,
    ciUpper: data.ci_upper,
    significant: data.significant,
    isReference: !!data.is_reference,
  }));

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const atRiskCount = results.at_risk_employees?.summary?.total_at_risk || 0;
  const watchListCount = results.at_risk_employees?.summary?.total_watch_list || 0;

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = async (type: "payGaps" | "atRisk" | "modelResults" | "fullResults" | "pdf") => {
    if (!sessionId) return;
    try {
      if (type === "pdf") {
        const data = await trpcClient.export.pdf.query({ sessionId });
        const byteChars = atob(data.pdf);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const data = await trpcClient.export[type].query({ sessionId });
        downloadCSV(data.csv, data.filename);
      }
      toast.success("Export downloaded");
    } catch (error: any) {
      toast.error(error.message || "Export failed");
    }
  };

  const diagnosticStatusLabel = (status: string) => {
    if (status === "pass") return "Pass";
    if (status === "warning") return "Warning";
    return "Fail";
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost">← Home</Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Pay Equity Analysis Results</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("fullResults")}>
                <FileText className="mr-2 h-4 w-4" />
                Full Results (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("payGaps")}>
                <FileText className="mr-2 h-4 w-4" />
                Pay Gaps (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("atRisk")}>
                <FileText className="mr-2 h-4 w-4" />
                At-Risk Employees (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("modelResults")}>
                <FileText className="mr-2 h-4 w-4" />
                Model Results (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileText className="mr-2 h-4 w-4" />
                PDF Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* ── Equity Score Card ── */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <InfoTip label="Overall Pay Equity Score">
                  A composite score from 0 to 100 that summarizes how equitable pay is across your organization. It's calculated from the fully adjusted regression model, which isolates pay gaps that can't be explained by job title, experience, performance, or location. Higher is better.
                </InfoTip>
              </CardTitle>
              <CardDescription>
                Based on the{" "}
                <InfoTip label="fully adjusted model">
                  The regression model that controls for all available legitimate pay factors — job title, years of experience, time in role, performance rating, and work location. Any pay differences that remain after these adjustments may indicate an equity issue.
                </InfoTip>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className={`text-7xl font-bold ${getScoreColor(equityScore)}`}>
                    {equityScore}
                    <span className="text-3xl">/100</span>
                  </div>
                  <div className="mt-2">
                    <span className="text-2xl font-semibold text-foreground">{interpretation}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4 max-w-2xl">
                    {results.equity_score?.recommendation}
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-4 bg-red-50 rounded-lg cursor-help">
                        <div className="text-3xl font-bold text-red-700">{atRiskCount}</div>
                        <div className="text-sm text-red-700">At-Risk Employees</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-sm leading-relaxed">
                      Employees who are paid significantly less than the model predicts they should be, based on their job, experience, performance, and location. These individuals may warrant a closer compensation review.
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg cursor-help">
                        <div className="text-3xl font-bold text-yellow-700">{watchListCount}</div>
                        <div className="text-sm text-yellow-700">Watch List</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-sm leading-relaxed">
                      Employees who are paid somewhat less than expected — not as extreme as "at-risk," but enough to keep an eye on. They fall between 1.5 and 2.0 standard deviations below the model's prediction.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Tabs ── */}
          <Tabs defaultValue="gaps" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="gaps">Pay Gaps</TabsTrigger>
              <TabsTrigger value="models">Progressive Models</TabsTrigger>
              <TabsTrigger value="atrisk">At-Risk Employees</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>

            {/* ── Pay Gaps Tab ── */}
            <TabsContent value="gaps" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Gender Pay Gaps (Fully Adjusted)</CardTitle>
                  <CardDescription>
                    Percentage pay difference for each gender group compared to the{" "}
                    <InfoTip label="reference group">
                      The reference group is the baseline for comparison — in this case{genderRef ? ` "${genderRef}"` : ""} (the largest gender group). All other groups' pay gaps are measured relative to this group. A negative percentage means that group is paid less than the reference; positive means more.
                    </InfoTip>
                    {genderRef ? ` (${genderRef})` : ""}, after{" "}
                    <InfoTip label="controlling for">
                      "Controlling for" means the model mathematically accounts for these factors so we can see what pay differences remain when everyone is compared as if they had the same job title, experience level, performance rating, and location.
                    </InfoTip>{" "}
                    job title, experience, performance, and location.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={genderChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="group" />
                      <YAxis label={{ value: 'Pay Gap (%)', angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip content={<PayGapTooltip />} />
                      <Bar dataKey="gap" fill="#3b82f6">
                        {genderChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isReference ? "#cbd5e1" : entry.significant ? (entry.gap < 0 ? "#ef4444" : "#22c55e") : "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#cbd5e1]" />
                      Reference group (baseline)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#ef4444]" />
                      Significant underpayment
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#22c55e]" />
                      Significant overpayment
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#94a3b8]" />
                      Not statistically significant
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Race Pay Gaps (Fully Adjusted)</CardTitle>
                  <CardDescription>
                    Percentage pay difference for each racial group compared to the reference group{raceRef ? ` (${raceRef})` : ""}, after controlling for job title, experience, performance, and location.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={raceChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="group" />
                      <YAxis label={{ value: 'Pay Gap (%)', angle: -90, position: 'insideLeft' }} />
                      <RechartsTooltip content={<PayGapTooltip />} />
                      <Bar dataKey="gap" fill="#3b82f6">
                        {raceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isReference ? "#cbd5e1" : entry.significant ? (entry.gap < 0 ? "#ef4444" : "#22c55e") : "#94a3b8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#cbd5e1]" />
                      Reference group (baseline)
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#ef4444]" />
                      Significant underpayment
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#22c55e]" />
                      Significant overpayment
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#94a3b8]" />
                      Not statistically significant
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Progressive Models Tab ── */}
            <TabsContent value="models" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Progressive Adjustment Models</CardTitle>
                  <CardDescription>
                    The analysis runs five{" "}
                    <InfoTip label="regression models">
                      A regression model is a mathematical equation that predicts salary based on a set of input factors (like job title and experience). By adding factors one at a time, we can see how much of the raw pay gap is explained by each factor versus how much remains unexplained.
                    </InfoTip>
                    , each adding more factors. This shows whether raw pay gaps shrink (or persist) once we account for legitimate pay differences.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(results.models || {}).map(([modelName, modelData]: [string, any]) => {
                      const info = MODEL_INFO[modelName];
                      return (
                        <div key={modelName} className="border rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-1">
                            {info?.title || modelName.replace(/_/g, " ")}
                          </h3>
                          {info?.description && (
                            <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                          )}
                          {modelData.error ? (
                            <p className="text-sm text-red-600">Could not fit this model: {modelData.error}</p>
                          ) : (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <InfoTip label="R²">
                                  R-squared (R²) measures how well the model explains salary variation, on a scale from 0 to 1. An R² of 0.85 means the model's factors explain 85% of salary differences. Higher values mean the model is a better fit.
                                </InfoTip>
                                <span className="ml-2 font-semibold">
                                  {modelData.model_fit?.r_squared != null
                                    ? modelData.model_fit.r_squared.toFixed(3)
                                    : "—"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Observations:</span>
                                <span className="ml-2 font-semibold">{modelData.model_fit?.n_obs ?? "—"}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── At-Risk Employees Tab ── */}
            <TabsContent value="atrisk" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>At-Risk Employees</CardTitle>
                  <CardDescription>
                    {atRiskCount > 0 ? (
                      <>
                        Employees whose actual salary is significantly below what the model predicts for someone with their job, experience, performance, and location. These are identified using{" "}
                        <InfoTip label="studentized residuals">
                          A studentized residual measures how far an employee's actual salary is from the model's prediction, in standardized units. A value below -2.0 means the employee is paid more than 2 standard deviations less than expected — which is unusual enough to flag for review.
                        </InfoTip>
                        {" "}below -2.0.
                      </>
                    ) : (
                      "No employees were identified with significant underpayment relative to the model's predictions."
                    )}
                  </CardDescription>
                </CardHeader>
                {atRiskCount > 0 && (
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Employee ID</th>
                            <th className="p-2 text-left">Gender</th>
                            <th className="p-2 text-left">Race</th>
                            <th className="p-2 text-right">Actual Salary</th>
                            <th className="p-2 text-right">
                              <InfoTip label="Predicted Salary">
                                The salary the regression model estimates this employee should earn, based on their job title, experience, performance, and location. If actual pay is well below this number, it may indicate underpayment.
                              </InfoTip>
                            </th>
                            <th className="p-2 text-right">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.at_risk_employees?.at_risk?.map((emp: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{emp.employee_id}</td>
                              <td className="p-2">{emp.gender}</td>
                              <td className="p-2">{emp.race}</td>
                              <td className="p-2 text-right font-semibold">${emp.actual_salary?.toLocaleString()}</td>
                              <td className="p-2 text-right">${emp.predicted_salary?.toLocaleString()}</td>
                              <td className="p-2 text-right text-red-600 font-semibold">{emp.difference_pct?.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>

              {watchListCount > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Watch List</CardTitle>
                    <CardDescription>
                      Employees with moderate underpayment (between 1.5 and 2.0 standard deviations below expected). Not as urgent as at-risk, but worth monitoring.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Employee ID</th>
                            <th className="p-2 text-left">Gender</th>
                            <th className="p-2 text-left">Race</th>
                            <th className="p-2 text-right">Actual Salary</th>
                            <th className="p-2 text-right">Predicted Salary</th>
                            <th className="p-2 text-right">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.at_risk_employees?.watch_list?.map((emp: any, idx: number) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{emp.employee_id}</td>
                              <td className="p-2">{emp.gender}</td>
                              <td className="p-2">{emp.race}</td>
                              <td className="p-2 text-right font-semibold">${emp.actual_salary?.toLocaleString()}</td>
                              <td className="p-2 text-right">${emp.predicted_salary?.toLocaleString()}</td>
                              <td className="p-2 text-right text-yellow-600 font-semibold">{emp.difference_pct?.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── Diagnostics Tab ── */}
            <TabsContent value="diagnostics" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Model Diagnostics</CardTitle>
                  <CardDescription>
                    These tests check whether the regression model's assumptions hold. If they don't, the pay gap estimates may be less reliable. A "Pass" means the assumption is met; a "Warning" means results should be interpreted with caution.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {results.diagnostics?.multicollinearity && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">
                            <InfoTip label="Multicollinearity (VIF)">
                              Multicollinearity means some input factors are highly correlated with each other (e.g., years of experience and years in role). The Variance Inflation Factor (VIF) measures this — a VIF above 5 suggests two factors are so similar they may distort the model. Below 5 is generally fine.
                            </InfoTip>
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            Max VIF: {results.diagnostics.multicollinearity.max_vif?.toFixed(2)} — {results.diagnostics.multicollinearity.max_vif < 5 ? "input factors are sufficiently independent" : "some factors may be too correlated"}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          results.diagnostics.multicollinearity.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {diagnosticStatusLabel(results.diagnostics.multicollinearity.status)}
                        </div>
                      </div>
                    )}
                    {results.diagnostics?.heteroscedasticity && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">
                            <InfoTip label="Consistent Variance (Breusch-Pagan Test)">
                              This checks whether the model's prediction errors are roughly the same size across all salary levels. If errors are larger for high earners than low earners (or vice versa), the model's confidence intervals may be unreliable. A "Pass" means error sizes are consistent.
                            </InfoTip>
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            <InfoTip label="p-value">
                              A p-value measures the probability of seeing these results if there were no real issue. A p-value above 0.05 means "Pass" (no evidence of a problem). Below 0.05 suggests the assumption may be violated.
                            </InfoTip>
                            : {results.diagnostics.heteroscedasticity.p_value?.toFixed(4)} — {results.diagnostics.heteroscedasticity.p_value >= 0.05 ? "no evidence of inconsistent variance" : "variance may differ across salary levels"}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          results.diagnostics.heteroscedasticity.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {diagnosticStatusLabel(results.diagnostics.heteroscedasticity.status)}
                        </div>
                      </div>
                    )}
                    {results.diagnostics?.normality && (
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <h4 className="font-semibold">
                            <InfoTip label="Normality of Residuals (Shapiro-Wilk Test)">
                              This checks whether the model's prediction errors follow a bell-curve (normal) distribution. Regression assumes errors are normally distributed. If they're not, the model's p-values and confidence intervals may be less accurate — though with larger samples this matters less.
                            </InfoTip>
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            p-value: {results.diagnostics.normality.p_value?.toFixed(4)} — {results.diagnostics.normality.p_value >= 0.05 ? "residuals appear normally distributed" : "residuals may not be normally distributed (common with small samples)"}
                          </p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          results.diagnostics.normality.status === 'pass' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {diagnosticStatusLabel(results.diagnostics.normality.status)}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
