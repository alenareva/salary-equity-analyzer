"""
Statistical Analysis Engine for Pay Equity Analysis
Implements multiple linear regression with progressive adjustments
"""

import sys
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor
from statsmodels.stats.diagnostic import het_breuschpagan
from scipy import stats
from typing import Dict, List, Any, Tuple

# Import advanced features
import os
import importlib.util
spec = importlib.util.spec_from_file_location("advanced_statistics", os.path.join(os.path.dirname(__file__), "advanced_statistics.py"))
advanced_stats = importlib.util.module_from_spec(spec)
spec.loader.exec_module(advanced_stats)


def prepare_data(records: List[Dict]) -> pd.DataFrame:
    """Convert records to DataFrame and prepare for analysis"""
    df = pd.DataFrame(records)
    
    # Convert salary to log scale
    df['log_salary'] = np.log(df['baseSalary'])
    
    return df


def create_dummy_variables(df: pd.DataFrame, column: str, reference: str = None) -> pd.DataFrame:
    """Create dummy variables for categorical column"""
    dummies = pd.get_dummies(df[column], prefix=column, drop_first=False, dtype=int)
    
    # If reference specified, drop that column
    if reference and f"{column}_{reference}" in dummies.columns:
        dummies = dummies.drop(columns=[f"{column}_{reference}"])
    elif not reference:
        # Drop first category as reference
        dummies = dummies.iloc[:, 1:]
    
    return dummies


def build_model_matrix(df: pd.DataFrame, model_type: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Build design matrix for different model types
    Returns: (X matrix, list of variable names)
    """
    X_parts = []
    var_names = []
    
    # Always include experience variables (except for unadjusted model)
    if model_type != 'unadjusted':
        X_parts.append(df[['yearsExperience', 'yearsInRole']])
        var_names.extend(['yearsExperience', 'yearsInRole'])
    
    # Model 1: Unadjusted (only protected characteristics)
    if model_type == 'unadjusted':
        pass  # Will add gender and race below
    
    # Model 2: Job-adjusted
    elif model_type == 'job_adjusted':
        job_dummies = create_dummy_variables(df, 'jobTitle')
        X_parts.append(job_dummies)
        var_names.extend(job_dummies.columns.tolist())
    
    # Model 3: Job + Experience (already added above)
    elif model_type == 'job_experience':
        job_dummies = create_dummy_variables(df, 'jobTitle')
        X_parts.append(job_dummies)
        var_names.extend(job_dummies.columns.tolist())
    
    # Model 4: + Performance
    elif model_type == 'plus_performance':
        job_dummies = create_dummy_variables(df, 'jobTitle')
        X_parts.append(job_dummies)
        var_names.extend(job_dummies.columns.tolist())
        
        perf_dummies = create_dummy_variables(df, 'performanceRating', reference='Midpoint')
        X_parts.append(perf_dummies)
        var_names.extend(perf_dummies.columns.tolist())
    
    # Model 5: Fully adjusted (+ Location)
    elif model_type == 'fully_adjusted':
        job_dummies = create_dummy_variables(df, 'jobTitle')
        X_parts.append(job_dummies)
        var_names.extend(job_dummies.columns.tolist())
        
        perf_dummies = create_dummy_variables(df, 'performanceRating', reference='Midpoint')
        X_parts.append(perf_dummies)
        var_names.extend(perf_dummies.columns.tolist())
        
        loc_dummies = create_dummy_variables(df, 'location')
        X_parts.append(loc_dummies)
        var_names.extend(loc_dummies.columns.tolist())
    
    # Add protected characteristics (gender and race)
    # Use the most common category as the reference group (most stable baseline)
    gender_ref = df['gender'].value_counts().idxmax()
    gender_dummies = create_dummy_variables(df, 'gender', reference=gender_ref)
    X_parts.append(gender_dummies)
    var_names.extend(gender_dummies.columns.tolist())

    race_ref = df['race'].value_counts().idxmax()
    race_dummies = create_dummy_variables(df, 'race', reference=race_ref)
    X_parts.append(race_dummies)
    var_names.extend(race_dummies.columns.tolist())
    
    # Combine all parts
    if X_parts:
        X = pd.concat(X_parts, axis=1)
    else:
        X = pd.DataFrame()
    
    # Add constant
    X = sm.add_constant(X)
    var_names = ['const'] + var_names
    
    return X, var_names


def run_regression(df: pd.DataFrame, model_type: str) -> Dict[str, Any]:
    """Run OLS regression for specified model type"""
    y = df['log_salary']
    X, var_names = build_model_matrix(df, model_type)
    
    # Fit model
    model = sm.OLS(y, X)
    results = model.fit()
    
    # Extract coefficients with confidence intervals
    coefficients = {}
    for i, var_name in enumerate(var_names):
        if var_name == 'const':
            continue
        
        coef = results.params[i]
        std_err = results.bse[i]
        p_value = results.pvalues[i]
        conf_int = results.conf_int().iloc[i]
        
        # Convert log coefficient to percentage
        pct_effect = (np.exp(coef) - 1) * 100
        pct_ci_lower = (np.exp(conf_int[0]) - 1) * 100
        pct_ci_upper = (np.exp(conf_int[1]) - 1) * 100
        
        coefficients[var_name] = {
            'coefficient': float(coef),
            'std_error': float(std_err),
            'p_value': float(p_value),
            'significant': p_value < 0.05,
            'pct_effect': float(pct_effect),
            'ci_lower': float(pct_ci_lower),
            'ci_upper': float(pct_ci_upper),
        }
    
    # Model fit statistics
    model_fit = {
        'r_squared': float(results.rsquared),
        'adj_r_squared': float(results.rsquared_adj),
        'f_statistic': float(results.fvalue),
        'f_pvalue': float(results.f_pvalue),
        'n_obs': int(results.nobs),
        'rmse': float(np.sqrt(results.mse_resid)),
    }
    
    return {
        'coefficients': coefficients,
        'model_fit': model_fit,
        'results_obj': results,  # Keep for further analysis
    }


def extract_pay_gaps(model_results: Dict[str, Any], df: pd.DataFrame) -> Dict[str, Any]:
    """Extract pay gaps for gender and race from model results.

    Includes the reference group (most common category) with a 0% gap
    so it appears in visualizations alongside the other groups.
    """
    coefficients = model_results['coefficients']

    all_genders = sorted(df['gender'].unique().tolist())
    all_races = sorted(df['race'].unique().tolist())

    pay_gaps: Dict[str, Any] = {
        'gender': {},
        'race': {},
        'gender_reference': None,
        'race_reference': None,
    }

    # Extract gender gaps
    for var_name, coef_data in coefficients.items():
        if var_name.startswith('gender_'):
            group = var_name.replace('gender_', '')
            pay_gaps['gender'][group] = {
                'gap_pct': coef_data['pct_effect'],
                'ci_lower': coef_data['ci_lower'],
                'ci_upper': coef_data['ci_upper'],
                'p_value': coef_data['p_value'],
                'significant': coef_data['significant'],
            }

    # Add reference group (any gender not in coefficients)
    for g in all_genders:
        if g not in pay_gaps['gender']:
            pay_gaps['gender_reference'] = g
            pay_gaps['gender'][g] = {
                'gap_pct': 0.0,
                'ci_lower': 0.0,
                'ci_upper': 0.0,
                'p_value': 1.0,
                'significant': False,
                'is_reference': True,
            }

    # Extract race gaps
    for var_name, coef_data in coefficients.items():
        if var_name.startswith('race_'):
            group = var_name.replace('race_', '')
            pay_gaps['race'][group] = {
                'gap_pct': coef_data['pct_effect'],
                'ci_lower': coef_data['ci_lower'],
                'ci_upper': coef_data['ci_upper'],
                'p_value': coef_data['p_value'],
                'significant': coef_data['significant'],
            }

    # Add reference group (any race not in coefficients)
    for r in all_races:
        if r not in pay_gaps['race']:
            pay_gaps['race_reference'] = r
            pay_gaps['race'][r] = {
                'gap_pct': 0.0,
                'ci_lower': 0.0,
                'ci_upper': 0.0,
                'p_value': 1.0,
                'significant': False,
                'is_reference': True,
            }

    return pay_gaps


def run_progressive_analysis(df: pd.DataFrame) -> Tuple[Dict[str, Any], Any]:
    """Run all 5 progressive models and return results + fully adjusted model object"""
    models = {
        'unadjusted': 'unadjusted',
        'job_adjusted': 'job_adjusted',
        'job_experience': 'job_experience',
        'plus_performance': 'plus_performance',
        'fully_adjusted': 'fully_adjusted',
    }
    
    results = {}
    fully_adjusted_results_obj = None
    
    for model_name, model_type in models.items():
        try:
            model_results = run_regression(df, model_type)
            pay_gaps = extract_pay_gaps(model_results, df)
            
            results[model_name] = {
                'pay_gaps': pay_gaps,
                'model_fit': model_results['model_fit'],
                'coefficients': model_results['coefficients'],
            }
            
            # Save fully adjusted model for advanced analysis
            if model_name == 'fully_adjusted':
                fully_adjusted_results_obj = model_results['results_obj']
        except Exception as e:
            results[model_name] = {
                'error': str(e),
            }
    
    return results, fully_adjusted_results_obj


def calculate_descriptive_stats(df: pd.DataFrame) -> Dict[str, Any]:
    """Calculate descriptive statistics"""
    
    # Average salary by experience brackets
    df['exp_bracket'] = pd.cut(
        df['yearsExperience'],
        bins=[0, 2, 5, 10, 100],
        labels=['0-2 years', '3-5 years', '6-10 years', '11+ years'],
        include_lowest=True
    )
    
    exp_stats = df.groupby('exp_bracket')['baseSalary'].agg(['mean', 'count']).to_dict('index')
    
    # Average salary by performance
    perf_stats = df.groupby('performanceRating')['baseSalary'].agg(['mean', 'count']).to_dict('index')
    
    # Average salary by gender (unadjusted)
    gender_stats = df.groupby('gender')['baseSalary'].agg(['mean', 'count']).to_dict('index')
    
    # Average salary by race (unadjusted)
    race_stats = df.groupby('race')['baseSalary'].agg(['mean', 'count']).to_dict('index')
    
    return {
        'by_experience': {k: {'mean': v['mean'], 'count': v['count']} for k, v in exp_stats.items()},
        'by_performance': {k: {'mean': v['mean'], 'count': v['count']} for k, v in perf_stats.items()},
        'by_gender': {k: {'mean': v['mean'], 'count': v['count']} for k, v in gender_stats.items()},
        'by_race': {k: {'mean': v['mean'], 'count': v['count']} for k, v in race_stats.items()},
    }


def analyze_pay_equity(records: List[Dict]) -> Dict[str, Any]:
    """Main analysis function"""
    
    # Prepare data
    df = prepare_data(records)
    
    # Run progressive analysis
    progressive_results, fully_adjusted_results_obj = run_progressive_analysis(df)
    
    # Calculate descriptive statistics
    descriptive_stats = calculate_descriptive_stats(df)
    
    # Build basic results
    basic_results = {
        'success': True,
        'sample_size': len(df),
        'models': progressive_results,
        'descriptive_stats': descriptive_stats,
    }
    
    # Add advanced features if fully adjusted model succeeded
    if fully_adjusted_results_obj is not None:
        try:
            basic_results = advanced_stats.enhance_analysis_with_advanced_features(
                basic_results, df, fully_adjusted_results_obj
            )
        except Exception as e:
            basic_results['advanced_features_error'] = str(e)
    
    return basic_results


class NumpyEncoder(json.JSONEncoder):
    """Handle numpy types that aren't natively JSON serializable."""
    def default(self, obj):
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def sanitize_for_json(obj):
    """Recursively replace NaN/Inf floats with None so json.dumps won't emit invalid tokens."""
    if isinstance(obj, float):
        if obj != obj or obj == float('inf') or obj == float('-inf'):  # NaN or Inf
            return None
        return obj
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    return obj


if __name__ == '__main__':
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())

    # Run analysis
    results = analyze_pay_equity(input_data['records'])

    # Output results as JSON (sanitize NaN/Inf, handle numpy types)
    print(json.dumps(sanitize_for_json(results), indent=2, cls=NumpyEncoder))
