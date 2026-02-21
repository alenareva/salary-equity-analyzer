# Salary Equity Analyzer - Project TODO

## Core Infrastructure
- [x] Set up project structure and design system
- [x] Configure database schema for analysis sessions and results
- [x] Install Python dependencies for statistical analysis

## Google Sheets Integration
- [x] Implement Google Sheets OAuth flow with read-only scope (backend complete)
- [ ] Create data import UI with file picker and sheet selector (UI pending)
- [ ] Build data preview table (first 10 rows)
- [ ] Add column mapping interface with auto-detection
- [ ] Create sample Google Sheets template with realistic data
- [x] Add prominent privacy warnings (NO PRIVACY GUARANTEE)
- [x] Implement acknowledgment checkbox before data import

## CSV Upload Alternative (Implemented)
- [x] Build CSV file upload component
- [x] Parse CSV data with papaparse
- [x] Create sample CSV template with 50 employee records
- [x] Validate CSV structure on upload

## Data Validation Module
- [x] Schema validation for all required fields
- [x] Data type validation (positive numbers, non-empty strings)
- [x] Missing data handling with error display
- [x] Outlier detection using IQR method
- [x] Display validation summary with record counts
- [x] Show validation errors in table format
- [ ] Interactive fix or exclude flow (backend ready, UI shows errors only)
- [ ] Show warning when >20% records excluded

## Statistical Engine - Core
- [x] Set up Python statistical engine with statsmodels
- [x] Implement data preparation (log transformation, dummy variables)
- [x] Build multiple linear regression using statsmodels OLS
- [x] Create 5 progressive adjustment models
- [x] Calculate pay gaps with confidence intervals
- [x] Return model fit statistics (R², F-statistic)
- [x] Node.js wrapper to call Python script

## Statistical Engine - Advanced
- [x] Intersectionality analysis (gender × race interactions)
- [x] Multicollinearity checks (VIF calculation)
- [x] Model diagnostics (Breusch-Pagan, Shapiro-Wilk tests)
- [x] Overall pay equity scoring algorithm (0-100 scale)
- [x] Small sample size warnings (n < 30, n < 10)
- [x] Descriptive statistics by experience and performance
- [x] At-risk employee identification with studentized residuals

## Results Dashboard
- [x] Pay equity score display with large number
- [x] Color-coded score interpretation (Excellent/Good/Fair/Needs Improvement)
- [x] Small sample size warning display (in validation)
- [x] At-risk employee count cards
- [x] Tabbed interface for different result views
- [x] Pay gap bar charts for gender and race
- [x] Progressive adjustment model summary
- [x] At-risk employees table with details
- [x] Model diagnostics display with status badges
- [ ] Forest plot visualization (currently using bar charts)
- [ ] Intersectionality section display
- [ ] Descriptive statistics charts

## At-Risk Employee Identification
- [x] Calculate studentized residuals for each employee
- [x] Identify primary at-risk list (residual < -2.0)
- [x] Create watch list for protected class members (residual < -1.5)
- [x] Calculate 80% prediction intervals
- [x] Build at-risk employees display table
- [ ] Add filtering and sorting capabilities
- [ ] Show risk level indicators with colors

## Export Functionality
- [x] CSV export for pay gaps data (backend complete)
- [x] CSV export for at-risk employees list (backend complete)
- [x] CSV export for full model results (backend complete)
- [x] CSV export for descriptive statistics (backend complete)
- [x] PDF report generation with executive summary (backend complete)
- [ ] PDF report with visualizations and charts (text-based for now)
- [x] PDF report with methodology and disclaimers (backend complete)
- [ ] Export dropdown UI with multiple options (UI integration pending)
- [x] Handle large datasets gracefully

## Cohort Analysis
- [ ] Filter UI panel (performance, experience, job title, location)
- [ ] Re-run entire regression on filtered subset
- [ ] Generate new pay equity score for cohort
- [ ] Side-by-side comparison view (overall vs cohort)
- [ ] Warning for small cohort sizes
- [ ] Session persistence for filter selections
- [ ] URL parameters for shareable filtered views

## Testing & Polish
- [ ] Unit tests for regression calculations
- [ ] Unit tests for scoring algorithm
- [ ] Integration tests for full analysis flow
- [ ] Edge case handling (small datasets, outliers)
- [ ] UI polish and responsive design
- [ ] Security review (no data persistence after session)
- [ ] Performance optimization (< 30 seconds for 1000 employees)
- [ ] User documentation and FAQ
- [ ] Test with sample data end-to-end

## Known Issues & Improvements
- [ ] Add loading states during analysis
- [ ] Improve error messages
- [ ] Add tooltips for statistical terms
- [ ] Implement data cleanup after analysis completion
- [ ] Add ability to download sample template from UI
- [ ] Improve chart responsiveness on mobile

## Deployment
- [ ] Production deployment
- [ ] SSL configuration
- [ ] Error monitoring setup
- [ ] End-to-end testing on production


## Bug Fixes
- [x] Fix authentication flow - "Start Analysis" button redirects to sign-in but doesn't work after login
- [x] Ensure Upload page properly handles authenticated users
- [x] Fix session creation and navigation after login
- [x] Fix "View Sample Report" button on home page - now generates and loads sample data
- [x] Fix __dirname is not defined error in validation endpoint - updated to use ES module path resolution
- [x] Fix Python SRE module mismatch error - use system Python 3.11 instead of uv Python 3.13
- [x] Fix Python 3.13 still being used despite python3.11 command - use absolute path /usr/bin/python3.11
- [x] Remove execute permissions from Python scripts so shebang is ignored and spawn uses specified interpreter
- [x] Set up clean Python 3.11 virtual environment with uv (Python 3.11.14)
- [x] Reinstall statistical dependencies in venv (statsmodels, pandas, numpy, scipy, scikit-learn)
- [x] Update code to use venv Python interpreter (.venv/bin/python)
- [x] Use system Python 3.11 directly with full path /usr/bin/python3 to bypass broken uv Python
- [x] Remove shebang from Python scripts completely to prevent override of spawn interpreter
- [x] Use /usr/bin/python3.11 directly instead of /usr/bin/python3 symlink
