import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Download, FileSpreadsheet, Upload as UploadIcon } from "lucide-react";
import Papa from "papaparse";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

export default function Upload() {
  const [, setLocation] = useLocation();
  const [acknowledged, setAcknowledged] = useState(false);
  const [uploading, setUploading] = useState(false);

  const startImportMutation = trpc.sheets.startImport.useMutation();
  const uploadCSVMutation = trpc.sheets.uploadCSV.useMutation();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!acknowledged) {
      toast.error("Please acknowledge the privacy notice");
      return;
    }

    setUploading(true);

    try {
      // Parse CSV
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            // Create session
            const session = await startImportMutation.mutateAsync();

            // Transform data to match schema
            const data = results.data.map((row: any) => ({
              employeeId: String(row.employeeId || row.employee_id || ""),
              gender: String(row.gender || ""),
              race: String(row.race || ""),
              jobTitle: String(row.jobTitle || row.job_title || ""),
              location: String(row.location || ""),
              yearsExperience: parseInt(row.yearsExperience || row.years_experience || "0"),
              yearsInRole: parseInt(row.yearsInRole || row.years_in_role || "0"),
              performanceRating: String(row.performanceRating || row.performance_rating || ""),
              baseSalary: parseInt(row.baseSalary || row.base_salary || "0"),
            }));

            // Upload data
            await uploadCSVMutation.mutateAsync({
              sessionId: session.sessionId,
              data,
            });

            toast.success(`Uploaded ${data.length} records successfully`);

            // Navigate to validation page
            setLocation(`/validation?session=${session.sessionId}`);
          } catch (error: any) {
            toast.error(error.message || "Failed to upload data");
            setUploading(false);
          }
        },
        error: (error) => {
          toast.error(`Failed to parse CSV: ${error.message}`);
          setUploading(false);
        },
      });
    } catch (error: any) {
      toast.error(error.message || "Failed to process file");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost">← Back to Home</Button>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Import Data</h1>
          <div className="w-24"></div>
        </div>
      </header>

      <main className="flex-1 container py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Privacy Warning */}
          <div className="danger-banner">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-lg mb-1">⛔ NO PRIVACY GUARANTEE</h3>
                <p className="mb-2">
                  <strong>DO NOT include employee names.</strong> Use employee IDs or code names only.
                </p>
                <p className="text-sm">
                  This tool provides NO PRIVACY GUARANTEE. Data is processed through third-party systems.
                  You are solely responsible for compliance with your organization's data protection policies
                  and applicable privacy regulations (GDPR, CCPA, etc.).
                </p>
              </div>
            </div>
          </div>

          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV File</CardTitle>
              <CardDescription>
                Upload your employee compensation data in CSV format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                <FileSpreadsheet className="h-16 w-16 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-foreground">Upload Your Data</h3>
                <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                  Select a CSV file with your employee compensation data
                </p>

                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  disabled={!acknowledged || uploading}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button size="lg" disabled={!acknowledged || uploading} asChild>
                    <span>
                      {uploading ? (
                        <>Processing...</>
                      ) : (
                        <>
                          <UploadIcon className="mr-2 h-4 w-4" />
                          Choose CSV File
                        </>
                      )}
                    </span>
                  </Button>
                </label>
              </div>

              {/* Acknowledgment Checkbox */}
              <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                  className="mt-1"
                />
                <label htmlFor="acknowledge" className="text-sm text-yellow-900 cursor-pointer">
                  <strong>I acknowledge</strong> that I have removed all employee names and replaced them with IDs or code names,
                  and I understand there is NO PRIVACY GUARANTEE for data processed through this tool.
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Template Card */}
          <Card>
            <CardHeader>
              <CardTitle>Need a Template?</CardTitle>
              <CardDescription>
                Download our sample template with required fields and example data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2"><strong>Required fields:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>employeeId (use IDs or code names, NOT real names)</li>
                    <li>gender</li>
                    <li>race</li>
                    <li>jobTitle</li>
                    <li>location (US State or Country)</li>
                    <li>yearsExperience</li>
                    <li>yearsInRole</li>
                    <li>performanceRating (Below Midpoint / Midpoint / Above Midpoint)</li>
                    <li>baseSalary</li>
                  </ul>
                </div>
                <Button variant="outline" asChild>
                  <a href="/sample-data.csv" download>
                    <Download className="mr-2 h-4 w-4" />
                    Download Sample Template
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
