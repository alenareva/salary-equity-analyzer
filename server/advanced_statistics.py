"""
Advanced Statistical Features for Pay Equity Analysis
- Intersectionality analysis
- Model diagnostics (VIF, heteroscedasticity, normality)
- Pay equity scoring algorithm
- At-risk employee identification
"""

import sys
import json
import numpy as np
import pandas as pd
import statsmodels.api as sm
from statsmodels.stats.outliers_influence import variance_inflation_factor, OLSInfluence
from statsmodels.stats.diagnostic import het_breuschpagan
from scipy import stats
from typing import Dict, List, Any


def calculate_vif(X: pd.DataFrame) -> Dict[str, float]:
    """Calculate Variance Inflation Factor for multicollinearity check"""
    vif_data = {}
    
    # Skip constant column
    X_no_const = X.drop(columns=['const'], errors='ignore')
    
    for i, col in enumerate(X_no_const.columns):
        try:
            vif = variance_inflation_factor(X_no_const.values, i)
            vif_data[col] = float(vif) if not np.isnan(vif) and not np.isinf(vif) else 0.0
        except:
            vif_data[col] = 0.0
    
    return vif_data


def run_diagnostic_tests(results) -> Dict[str, Any]:
    """Run model diagnostic tests"""
    diagnostics = {}
    
    # Breusch-Pagan test for heteroscedasticity
    try:
        bp_test = het_breuschpagan(results.resid, results.model.exog)
        diagnostics['heteroscedasticity'] = {
            'test': 'breusch_pagan',
            'statistic': float(bp_test[0]),
            'p_value': float(bp_test[1]),
            'status': 'pass' if bp_test[1] > 0.05 else 'warning',
        }
    except:
        diagnostics['heteroscedasticity'] = {'status': 'error', 'message': 'Test failed'}
    
    # Shapiro-Wilk test for normality of residuals (if sample size < 5000)
    if len(results.resid) < 5000:
        try:
            sw_test = stats.shapiro(results.resid)
            diagnostics['normality'] = {
                'test': 'shapiro_wilk',
                'statistic': float(sw_test[0]),
                'p_value': float(sw_test[1]),
                'status': 'pass' if sw_test[1] > 0.05 else 'warning',
            }
        except:
            diagnostics['normality'] = {'status': 'error', 'message': 'Test failed'}
    else:
        diagnostics['normality'] = {'status': 'skipped', 'message': 'Sample size too large'}
    
    # VIF for multicollinearity
    try:
        vif_values = calculate_vif(pd.DataFrame(results.model.exog, columns=results.model.exog_names))
        max_vif = max(vif_values.values()) if vif_values else 0
        diagnostics['multicollinearity'] = {
            'max_vif': float(max_vif),
            'vif_by_variable': vif_values,
            'status': 'pass' if max_vif < 10 else 'warning',
        }
    except:
        diagnostics['multicollinearity'] = {'status': 'error', 'message': 'Test failed'}
    
    return diagnostics


def calculate_equity_score(pay_gaps: Dict[str, Any]) -> Dict[str, Any]:
    """
    Calculate overall pay equity score (0-100)
    Based on maximum significant negative pay gap
    """
    max_gap = 0.0
    max_gap_group = None
    max_gap_field = None
    
    # Find maximum significant negative gap
    for field in ['gender', 'race']:
        if field not in pay_gaps:
            continue
        
        for group, gap_data in pay_gaps[field].items():
            if gap_data['significant'] and gap_data['gap_pct'] < 0:
                # Use upper bound of CI for conservative estimate
                gap_magnitude = abs(gap_data['ci_upper']) if gap_data['ci_upper'] < 0 else abs(gap_data['gap_pct'])
                
                if gap_magnitude > max_gap:
                    max_gap = gap_magnitude
                    max_gap_group = group
                    max_gap_field = field
    
    # Calculate score based on gap size
    if max_gap == 0:
        score = 100
        interpretation = 'Excellent'
        recommendation = 'No evidence of systemic pay disparities.'
    elif max_gap < 3.0:
        # Linear interpolation: 85 + (2.9 - gap) / 2.8 * 14
        score = 85 + ((2.9 - max_gap) / 2.8) * 14
        interpretation = 'Good'
        recommendation = 'Minor gaps exist but are within a tolerable range.'
    elif max_gap < 5.0:
        # Linear interpolation: 70 + (4.9 - gap) / 1.9 * 14
        score = 70 + ((4.9 - max_gap) / 1.9) * 14
        interpretation = 'Fair'
        recommendation = 'Gaps are becoming substantial and require attention.'
    else:
        # max(0, 70 - (gap - 5) * 7)
        score = max(0, 70 - (max_gap - 5) * 7)
        interpretation = 'Needs Improvement'
        recommendation = 'Significant pay disparities requiring immediate investigation.'
    
    return {
        'equity_score': int(round(score)),
        'interpretation': interpretation,
        'recommendation': recommendation,
        'max_gap': {
            'field': max_gap_field,
            'group': max_gap_group,
            'gap_pct': float(-max_gap) if max_gap > 0 else 0.0,
        } if max_gap_group else None,
    }


def run_intersectionality_analysis(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Analyze intersectionality (gender × race interactions)
    """
    # Create interaction terms
    df['gender_race'] = df['gender'] + '_' + df['race']
    
    # Count by intersection
    intersection_counts = df['gender_race'].value_counts().to_dict()
    
    # Filter to intersections with n >= 10
    valid_intersections = {k: v for k, v in intersection_counts.items() if v >= 10}
    
    if len(valid_intersections) == 0:
        return {
            'available': False,
            'message': 'Insufficient sample sizes for intersectionality analysis',
        }
    
    # Calculate mean salary by intersection (unadjusted)
    intersection_means = df.groupby('gender_race')['baseSalary'].mean().to_dict()
    
    # For each valid intersection, report the combined effect
    intersections = {}
    for intersection, count in valid_intersections.items():
        parts = intersection.split('_', 1)
        if len(parts) == 2:
            gender, race = parts
            intersections[intersection] = {
                'gender': gender,
                'race': race,
                'count': int(count),
                'mean_salary': float(intersection_means.get(intersection, 0)),
            }
    
    return {
        'available': True,
        'intersections': intersections,
    }


def identify_at_risk_employees(df: pd.DataFrame, results) -> List[Dict[str, Any]]:
    """
    Identify employees at risk of pay disparity using studentized residuals
    """
    # Calculate influence measures
    influence = OLSInfluence(results)
    studentized_resid = influence.resid_studentized_internal
    
    # Calculate prediction intervals (80%)
    predictions = results.get_prediction()
    pred_summary = predictions.summary_frame(alpha=0.2)  # 80% CI
    
    at_risk = []
    watch_list = []
    
    for i, row in df.iterrows():
        stud_resid = studentized_resid[i]
        
        # Primary at-risk: studentized residual < -2.0
        if stud_resid < -2.0:
            at_risk.append({
                'employee_id': row['employeeId'],
                'actual_salary': int(row['baseSalary']),
                'predicted_log_salary': float(results.fittedvalues[i]),
                'predicted_salary': int(np.exp(results.fittedvalues[i])),
                'studentized_residual': float(stud_resid),
                'pred_interval_lower': int(np.exp(pred_summary.iloc[i]['obs_ci_lower'])),
                'pred_interval_upper': int(np.exp(pred_summary.iloc[i]['obs_ci_upper'])),
                'difference_pct': float(((row['baseSalary'] - np.exp(results.fittedvalues[i])) / np.exp(results.fittedvalues[i])) * 100),
                'risk_level': 'high',
                'gender': row['gender'],
                'race': row['race'],
            })
        # Watch list: protected class with residual < -1.5
        elif stud_resid < -1.5:
            watch_list.append({
                'employee_id': row['employeeId'],
                'actual_salary': int(row['baseSalary']),
                'predicted_salary': int(np.exp(results.fittedvalues[i])),
                'studentized_residual': float(stud_resid),
                'difference_pct': float(((row['baseSalary'] - np.exp(results.fittedvalues[i])) / np.exp(results.fittedvalues[i])) * 100),
                'risk_level': 'moderate',
                'gender': row['gender'],
                'race': row['race'],
            })
    
    return {
        'at_risk': at_risk,
        'watch_list': watch_list,
        'summary': {
            'total_at_risk': len(at_risk),
            'total_watch_list': len(watch_list),
        }
    }


def enhance_analysis_with_advanced_features(basic_results: Dict[str, Any], df: pd.DataFrame, fully_adjusted_results) -> Dict[str, Any]:
    """
    Add advanced features to basic analysis results
    """
    # Run diagnostics
    diagnostics = run_diagnostic_tests(fully_adjusted_results)
    
    # Calculate equity score
    fully_adjusted_gaps = basic_results['models']['fully_adjusted']['pay_gaps']
    equity_score = calculate_equity_score(fully_adjusted_gaps)
    
    # Intersectionality analysis
    intersectionality = run_intersectionality_analysis(df)
    
    # At-risk employees
    at_risk_analysis = identify_at_risk_employees(df, fully_adjusted_results)
    
    # Add to results
    basic_results['diagnostics'] = diagnostics
    basic_results['equity_score'] = equity_score
    basic_results['intersectionality'] = intersectionality
    basic_results['at_risk_employees'] = at_risk_analysis
    
    return basic_results


if __name__ == '__main__':
    # This module is meant to be imported, not run directly
    print(json.dumps({'error': 'This module should be imported, not run directly'}))
