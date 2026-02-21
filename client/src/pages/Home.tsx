import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Shield, TrendingUp, Users } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

export default function Home() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const startImportMutation = trpc.sheets.startImport.useMutation();
  const uploadCSVMutation = trpc.sheets.uploadCSV.useMutation();

  const handleViewSampleReport = async () => {
    setLoading(true);
    try {
      // Create a session
      const session = await startImportMutation.mutateAsync();
      
      // Generate sample data (50 employees)
      const sampleData = Array.from({ length: 50 }, (_, i) => {
        const genders = ['Male', 'Female'];
        const races = ['White', 'Black', 'Asian', 'Hispanic'];
        const jobTitles = ['Engineer', 'Manager', 'Analyst', 'Director'];
        const locations = ['California', 'New York', 'Texas', 'Florida'];
        const ratings = ['Below Midpoint', 'Midpoint', 'Above Midpoint'];
        
        const gender = genders[i % 2];
        const race = races[i % 4];
        const jobTitle = jobTitles[Math.floor(i / 12.5) % 4];
        const yearsExperience = 1 + (i % 15);
        const yearsInRole = Math.min(yearsExperience, 1 + (i % 8));
        const performanceRating = ratings[i % 3];
        
        // Base salary with some intentional disparities for demo
        let baseSalary = 60000 + (yearsExperience * 3000) + (jobTitles.indexOf(jobTitle) * 15000);
        if (performanceRating === 'Above Midpoint') baseSalary += 10000;
        if (performanceRating === 'Below Midpoint') baseSalary -= 5000;
        
        // Add some gender/race gaps for demonstration
        if (gender === 'Female') baseSalary *= 0.92; // 8% gap
        if (race === 'Black' || race === 'Hispanic') baseSalary *= 0.95; // 5% gap
        
        baseSalary = Math.round(baseSalary);
        
        return {
          employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
          gender,
          race,
          jobTitle,
          location: locations[i % 4],
          yearsExperience,
          yearsInRole,
          performanceRating,
          baseSalary,
        };
      });

      // Upload sample data
      await uploadCSVMutation.mutateAsync({
        sessionId: session.sessionId,
        data: sampleData,
      });

      toast.success('Sample data loaded!');
      setLocation(`/validation?session=${session.sessionId}`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load sample data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
              <BarChart3 className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-foreground">Salary Equity Analyzer</h1>
            </div>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground">
              Salary Equity Analysis
            </h2>
            <p className="text-xl text-muted-foreground">
              A statistical tool to explore compensation data across demographic factors — built as a vibe coding project.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/upload">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Analysis
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={handleViewSampleReport}
                disabled={loading}
              >
                {loading ? 'Loading Sample...' : 'View Sample Report'}
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container py-16 bg-muted/30">
          <div className="max-w-5xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-foreground">
              Comprehensive Pay Equity Analysis
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Statistical Regression Analysis</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Multiple linear regression models control for legitimate factors like job title, experience, and performance to isolate pay disparities.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>At-Risk Employee Identification</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Identify specific employees who may be underpaid relative to their peers using advanced statistical methods.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BarChart3 className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Interactive Visualizations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    Clear charts and graphs show pay gaps with confidence intervals, progressive adjustments, and intersectionality effects.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>Privacy-Focused Design</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    No data storage after analysis. Use employee IDs instead of names. You maintain full control of your sensitive compensation data.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="container py-16">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12 text-foreground">
              How It Works
            </h3>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
                  1
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2 text-foreground">Upload a CSV</h4>
                  <p className="text-muted-foreground">
                    Upload a CSV file with your employee compensation data. A sample template is provided with the required fields.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
                  2
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2 text-foreground">Validate Your Data</h4>
                  <p className="text-muted-foreground">
                    The system checks for missing values, invalid entries, and salary outliers. Review flagged records before proceeding.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
                  3
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2 text-foreground">Run the Analysis</h4>
                  <p className="text-muted-foreground">
                    A regression engine controls for job title, experience, performance, and location to isolate pay gaps by gender and race.
                  </p>
                </div>
              </div>

              <div className="flex gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-bold text-lg">
                  4
                </div>
                <div>
                  <h4 className="text-xl font-semibold mb-2 text-foreground">View Results and Export</h4>
                  <p className="text-muted-foreground">
                    See your pay equity score, pay gap charts, at-risk employees, and model diagnostics. Export everything to CSV or PDF.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Blog Link */}
        <section className="container py-12">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm text-muted-foreground">
              This tool was built using AI-assisted development (vibe coding).{" "}
              <a href="https://www.alenareva.com/vibe-coding/salary-equity-analyzer" className="underline hover:text-foreground transition-colors">
                Read the full breakdown on the blog
              </a>.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-card mt-auto">
        <div className="container py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p>© 2026 Salary Equity Analyzer. For informational purposes only.</p>
            <p className="mt-2">
              <strong>Privacy Notice:</strong> This tool provides NO PRIVACY GUARANTEE. Users are responsible for compliance with data protection regulations.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
