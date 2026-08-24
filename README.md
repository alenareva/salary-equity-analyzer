# Salary Equity Analyzer

A free, open-source web application for conducting pay equity analysis across gender, race, and other demographic factors. Built for HR professionals and compensation analysts at organizations of any size.

**Live tool:** [sea.alenareva.com](https://sea.alenareva.com)
**Case study:** [How I built this in 8 hours with vibe coding](https://www.alenareva.com/vibe-coding/salary-equity-analyzer)

## What It Does

Upload employee compensation data in CSV format and get a full statistical pay equity analysis:

- **Data validation** — checks for missing fields, formatting issues, and salary outliers using the IQR method
- **Multiple linear regression** — controls for job title, experience, location, and performance to isolate the impact of gender and race on compensation
- **Progressive adjustment models** — five models that add controls incrementally, showing how pay gaps change as legitimate factors are accounted for
- **Pay equity score** — a single 0–100 score based on the largest statistically significant pay gap
- **At-risk employee identification** — flags potentially underpaid employees using studentized residuals
- **Intersectionality analysis** — examines combined effects of gender × race
- **Model diagnostics** — R², Breusch-Pagan, Shapiro-Wilk, and VIF checks
- **Export** — CSV and PDF reports with executive summaries

## Statistical Methodology

The analysis uses log-transformed salary as the dependent variable with dummy-coded categorical predictors, following industry best practices for pay equity audits.

**Regression equation:**

```
log(Salary) = β₀ + β₁(Experience) + β₂(RoleExperience) + Σβⱼ(JobTitle_j)
              + Σβₖ(Location_k) + Σβₘ(Performance_m) + γ₁(Gender)
              + Σγₙ(Race_n) + ε
```

Pay gaps are calculated as `(exp(β) - 1) × 100` with 95% confidence intervals.

## Required CSV Format

Your CSV must include these columns:

| Column | Description | Example |
|--------|-------------|---------|
| `employeeId` | Unique identifier (NO names) | EMP001 |
| `gender` | Gender | Male, Female, Non-Binary |
| `race` | Race/ethnicity | White, Black, Hispanic, Asian |
| `jobTitle` | Job title | Software Engineer |
| `location` | US state or country | California |
| `yearsExperience` | Total years of experience | 8 |
| `yearsInRole` | Years in current role | 3 |
| `performanceRating` | Performance level | Below Midpoint, Midpoint, Above Midpoint |
| `baseSalary` | Annual base salary | 125000 |

⚠️ **Do not include employee names or other personally identifiable information.**

## Tech Stack

- **Frontend:** React, TypeScript, Vite, TailwindCSS, Recharts
- **Backend:** Node.js, Express, TypeScript
- **Statistics:** Python 3.11, statsmodels, pandas, numpy, scipy, scikit-learn
- **Deployment:** Docker, Railway

## Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- pnpm

### Setup

```bash
# Clone the repo
git clone https://github.com/alenareva/salary-equity-analyzer.git
cd salary-equity-analyzer

# Install Node dependencies
pnpm install

# Install Python dependencies
pip install -r requirements.txt

# Start dev server
pnpm run dev
```

The app will be available at `http://localhost:3000`.

## Deployment

The app is configured for Railway deployment with Docker.

```bash
# Build and run locally with Docker
docker build -t salary-equity-analyzer .
docker run -p 3000:3000 -e PORT=3000 salary-equity-analyzer
```

### Railway

1. Connect your GitHub repo to Railway
2. Railway auto-detects the Dockerfile and builds
3. Set `PYTHON_PATH=/usr/bin/python3` in environment variables (already configured in Dockerfile)
4. Add a custom domain under Service → Settings → Networking

## Privacy

- No user data is stored long-term after the session ends
- HTTPS enforced in production
- All inputs validated on the backend
- **This tool provides NO PRIVACY GUARANTEE** — do not upload employee names or other PII

## License

MIT

## Author

[Alena Reva](https://www.alenareva.com) — VP, Total Rewards and People Operations
