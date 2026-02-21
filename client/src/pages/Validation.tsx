import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Link, useLocation, useSearch } from "wouter";
import { toast } from "sonner";

export default function Validation() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const sessionId = new URLSearchParams(search).get("session");

  const { data: validation, isLoading } = trpc.validation.validate.useQuery(
    { sessionId: sessionId || "" },
    { enabled: !!sessionId }
  );

  const proceedMutation = trpc.validation.proceedToAnalysis.useMutation();
  const runAnalysisMutation = trpc.analysis.run.useMutation();

  const handleProceed = async () => {
    if (!sessionId) return;

    try {
      await proceedMutation.mutateAsync({ sessionId });
      toast.info("Running statistical analysis...");
      await runAnalysisMutation.mutateAsync({ sessionId });
      toast.success("Analysis complete!");
      setLocation(`/results?session=${sessionId}`);
    } catch (error: any) {
      toast.error(error.message || "Analysis failed");
    }
  };

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>No Session Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/upload">Upload Data</Link>
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

  const hasErrors = validation && validation.errors.length > 0;
  const hasOutliers = validation && validation.outliers.length > 0;
  const hasSampleWarnings = validation && validation.sampleSizeWarnings.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/upload">
            <Button variant="ghost">← Back</Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Data Validation</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Validation Summary</CardTitle>
              <CardDescription>Review data quality before proceeding to analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-3xl font-bold text-foreground">{validation?.totalRecords || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Records</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-700">{validation?.validRecords || 0}</div>
                  <div className="text-sm text-green-700">Valid Records</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-3xl font-bold text-red-700">{validation?.errors.length || 0}</div>
                  <div className="text-sm text-red-700">Validation Errors</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {hasErrors && (
            <Card className="border-red-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-red-900">Validation Errors</CardTitle>
                </div>
                <CardDescription>The following records have data quality issues</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Row</th>
                        <th className="p-2 text-left">Employee ID</th>
                        <th className="p-2 text-left">Field</th>
                        <th className="p-2 text-left">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.errors.slice(0, 50).map((error, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{error.rowIndex}</td>
                          <td className="p-2 font-mono text-xs">{error.employeeId}</td>
                          <td className="p-2">{error.field}</td>
                          <td className="p-2 text-red-700">{error.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validation.errors.length > 50 && (
                    <p className="text-sm text-muted-foreground mt-4 text-center">
                      Showing first 50 of {validation.errors.length} errors
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {hasOutliers && (
            <Card className="border-yellow-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-yellow-900">Salary Outliers Detected</CardTitle>
                </div>
                <CardDescription>These salaries fall outside the expected range (IQR method)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left">Employee ID</th>
                        <th className="p-2 text-right">Salary</th>
                        <th className="p-2 text-right">Expected Range</th>
                        <th className="p-2 text-right">Deviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validation.outliers.map((outlier, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2 font-mono text-xs">{outlier.employeeId}</td>
                          <td className="p-2 text-right font-semibold">${outlier.baseSalary.toLocaleString()}</td>
                          <td className="p-2 text-right text-muted-foreground text-xs">
                            ${Math.round(outlier.lowerBound).toLocaleString()} - ${Math.round(outlier.upperBound).toLocaleString()}
                          </td>
                          <td className="p-2 text-right text-yellow-700">{outlier.deviationPercent.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {hasSampleWarnings && (
            <Card className="border-yellow-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                  <CardTitle className="text-yellow-900">Small Sample Size Warnings</CardTitle>
                </div>
                <CardDescription>Some groups have small sample sizes which may affect statistical reliability</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {validation.sampleSizeWarnings.map((warning, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-yellow-50 rounded">
                      <div>
                        <span className="font-semibold">{warning.group}</span>
                        <span className="text-muted-foreground text-sm ml-2">({warning.field})</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{warning.count}</span> records
                        {warning.severity === 'warning' && <span className="ml-2 text-red-600 font-semibold">(n &lt; 10)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {!hasErrors && !hasOutliers && (
            <Card className="border-green-200 bg-green-50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-green-900">Data Validation Passed</CardTitle>
                </div>
                <CardDescription>All records are valid and ready for analysis</CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="flex justify-between items-center">
            <Button variant="outline" asChild>
              <Link href="/upload">Upload Different File</Link>
            </Button>
            <Button size="lg" onClick={handleProceed} disabled={hasErrors || runAnalysisMutation.isPending}>
              {runAnalysisMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Running Analysis...
                </>
              ) : (
                "Proceed to Analysis"
              )}
            </Button>
          </div>

          {hasErrors && (
            <p className="text-sm text-red-600 text-center">Please fix validation errors before proceeding</p>
          )}
        </div>
      </main>
    </div>
  );
}
