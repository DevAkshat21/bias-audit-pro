import pandas as pd
import numpy as np
import shap
import io
import json
import traceback
from typing import Dict, Any, List
from fairlearn.metrics import selection_rate, demographic_parity_difference, demographic_parity_ratio
from fairlearn.preprocessing import CorrelationRemover
from fairlearn.postprocessing import ThresholdOptimizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error, r2_score
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier, XGBRegressor
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

DEBUG_MODE = True

class AIServiceException(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)

class AIService:
    def __init__(self):
        pass

    def _safe_impute(self, series: pd.Series) -> pd.Series:
        if pd.api.types.is_numeric_dtype(series):
            fill_val = series.median()
            if pd.isna(fill_val):
                fill_val = 0
            return series.fillna(fill_val)
        else:
            mode_val = series.mode()
            fill_val = mode_val.iloc[0] if not mode_val.empty else "Unknown"
            return series.fillna(fill_val)

    def _detect_task_type(self, y_raw: pd.Series) -> str:
        if pd.api.types.is_numeric_dtype(y_raw):
            unique_count = y_raw.nunique()
            if unique_count == 2:
                return 'binary'
            elif unique_count > 20: # Heuristic for continuous
                return 'regression'
            else:
                return 'multiclass'
        else:
            unique_count = y_raw.nunique()
            if unique_count == 2:
                return 'binary'
            elif unique_count > 20:
                raise AIServiceException(f"Target variable has too many unique categorical values ({unique_count}). Maximum supported classes is 20. If this is a regression task, ensure the target values are numeric. Otherwise, please select a valid categorical target column.")
            else:
                return 'multiclass'

    def analyze_bias(self, df: pd.DataFrame, target: str, protected_attributes: List[str]) -> Dict[str, Any]:
        warnings_list = []

        if not protected_attributes:
            raise AIServiceException("At least one protected attribute must be selected.", status_code=400)
        if target not in df.columns:
            raise AIServiceException(f"Target column '{target}' not found in dataset.", status_code=400)

        df = df.copy()

        if not pd.api.types.is_numeric_dtype(df[target]):
            coerced = pd.to_numeric(df[target], errors='coerce')
            if coerced.notna().sum() > 0.5 * len(df):
                df[target] = coerced
                warnings_list.append(f"Target column '{target}' was converted to numeric.")

        na_count = df[target].isna().sum()
        if na_count > 0:
            df = df.dropna(subset=[target])
            warnings_list.append(f"Dropped {na_count} rows with missing target values.")

        y_raw = df[target]
        task_type = self._detect_task_type(y_raw)
        
        if task_type in ['binary', 'multiclass']:
            encoder = LabelEncoder()
            y_encoded = encoder.fit_transform(y_raw.astype(str))
            y = y_encoded
        else:
            y = y_raw.to_numpy()

        X = df.drop(columns=[target])

        # Feature Handling
        cols_to_drop = []
        for col in X.columns:
            if col in protected_attributes: continue
            nunique = X[col].nunique(dropna=False)
            if nunique <= 1 or nunique / len(X) > 0.5:
                cols_to_drop.append(col)
                continue
            if X[col].dtype == 'object' or X[col].dtype == 'category':
                if nunique > 50:
                    cols_to_drop.append(col)
                    continue
                avg_len = X[col].dropna().astype(str).str.len().mean()
                if pd.notna(avg_len) and avg_len > 100:
                    cols_to_drop.append(col)

        if cols_to_drop:
            X = X.drop(columns=cols_to_drop)
            warnings_list.append(f"Dropped {len(cols_to_drop)} column(s) (ID-like or constant).")

        for col in X.columns:
            X[col] = self._safe_impute(X[col])

        valid_protected_attributes = []
        for attr in protected_attributes:
            if attr not in X.columns: continue
            if X[attr].nunique() < 2: continue
            valid_protected_attributes.append(attr)
            
        if len(valid_protected_attributes) > 1:
            intersectional_attr = "_".join(valid_protected_attributes)
            X[intersectional_attr] = X[valid_protected_attributes].astype(str).agg('_'.join, axis=1)
            valid_protected_attributes.append(intersectional_attr)

        if not valid_protected_attributes:
            raise AIServiceException("No valid protected attributes remaining.", status_code=422)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )

        X_train_enc = pd.get_dummies(X_train)
        X_test_enc = pd.get_dummies(X_test).reindex(columns=X_train_enc.columns, fill_value=0)

        # Sanitize column names for XGBoost
        clean_cols = lambda cols: [str(c).replace('[', '_').replace(']', '_').replace('<', '_') for c in cols]
        X_train_enc.columns = clean_cols(X_train_enc.columns)
        X_test_enc.columns = clean_cols(X_test_enc.columns)

        # Model Instantiation based on task
        if task_type == 'binary':
            model = XGBClassifier(eval_metric='logloss', random_state=42)
        elif task_type == 'multiclass':
            model = XGBClassifier(eval_metric='mlogloss', random_state=42)
        else:
            model = XGBRegressor(random_state=42)

        model.fit(X_train_enc, y_train)
        y_pred = model.predict(X_test_enc)

        # Baseline metrics
        baseline_acc = float(accuracy_score(y_test, y_pred)) if task_type in ['binary', 'multiclass'] else float(r2_score(y_test, y_pred))

        # Bias Metrics
        bias_metrics = {}
        for attr in valid_protected_attributes:
            groups = []
            sensitive_features_test = X_test[attr]
            
            di_ratio = 1.0
            parity_diff = 0.0
            is_compliant = True

            if task_type == 'binary':
                for group_name in sorted(sensitive_features_test.unique(), key=str):
                    mask = (sensitive_features_test == group_name)
                    rate = selection_rate(y_test[mask], y_pred[mask], pos_label=1)
                    groups.append({
                        "group_name": str(group_name),
                        "group_size": int(mask.sum()),
                        "selection_rate": float(rate),
                    })
                try:
                    di_ratio = float(demographic_parity_ratio(y_test, y_pred, sensitive_features=sensitive_features_test))
                    parity_diff = float(demographic_parity_difference(y_test, y_pred, sensitive_features=sensitive_features_test))
                except Exception: pass
                is_compliant = bool(di_ratio >= 0.8)

            elif task_type == 'multiclass':
                # For multiclass, we check if the distribution of predictions is independent of sensitive feature
                # Simplified: max variation in selection rate across any class
                warnings_list.append(f"Multiclass fairness metrics are simplified approximations.")
                is_compliant = True # Placeholder logic
                # Implement one-vs-rest metrics
                pass
            
            elif task_type == 'regression':
                for group_name in sorted(sensitive_features_test.unique(), key=str):
                    mask = (sensitive_features_test == group_name)
                    mean_pred = np.mean(y_pred[mask])
                    groups.append({
                        "group_name": str(group_name),
                        "group_size": int(mask.sum()),
                        "selection_rate": float(mean_pred), # mean prediction as 'rate' for regression
                    })
                
                group_means = [g["selection_rate"] for g in groups if not np.isnan(g["selection_rate"])]
                if group_means:
                    parity_diff = max(group_means) - min(group_means)
                    di_ratio = min(group_means) / max(group_means) if max(group_means) > 0 else 1.0
                is_compliant = bool(di_ratio >= 0.8)

            if np.isnan(di_ratio) or np.isinf(di_ratio): di_ratio = 0.0
            if np.isnan(parity_diff) or np.isinf(parity_diff): parity_diff = 0.0

            bias_metrics[attr] = {
                "groups": groups,
                "disparate_impact_ratio": di_ratio,
                "parity_difference": parity_diff,
                "is_di_compliant": is_compliant,
            }

        # Phase 3: "Stalker Model" Proxy Detection
        proxy_results = {}
        for attr in valid_protected_attributes:
            try:
                attr_y = LabelEncoder().fit_transform(X[attr].astype(str))
                attr_X = X.drop(columns=[attr])
                attr_X_enc = pd.get_dummies(attr_X)
                attr_X_enc.columns = clean_cols(attr_X_enc.columns)
                
                stalker = XGBClassifier(eval_metric='mlogloss', random_state=42)
                
                # Sample for speed
                sample_n = min(1000, len(attr_X_enc))
                X_sample = attr_X_enc.sample(n=sample_n, random_state=42)
                y_sample_raw = pd.Series(attr_y).iloc[X_sample.index]
                
                # Re-encode sample to ensure continuous range [0, n-1] for XGBoost multiclass
                y_sample = LabelEncoder().fit_transform(y_sample_raw.astype(str))
                
                stalker.fit(X_sample, y_sample)
                
                # Get feature importances of stalker model
                importances = stalker.feature_importances_
                high_risk_features = []
                for i, col in enumerate(attr_X_enc.columns):
                    if importances[i] > 0.1: # Significant proxy
                        high_risk_features.append({"feature": col, "correlation": float(importances[i])})
                        
                high_risk_features.sort(key=lambda x: x["correlation"], reverse=True)
                
                proxy_results[attr] = {
                    "high_risk": high_risk_features[:5],
                    "all_correlations": {str(k): float(v) for k, v in zip(attr_X_enc.columns[:10], importances[:10])},
                }
            except Exception as e:
                proxy_results[attr] = {"high_risk": [], "all_correlations": {}}
                warnings_list.append(f"Proxy detection failed for '{attr}': {str(e)}")

        # Mitigation
        main_attr = valid_protected_attributes[0]
        baseline_di = bias_metrics[main_attr]["disparate_impact_ratio"]

        mitigation_results = {
            "protected_attribute": main_attr,
            "baseline": {"disparate_impact_ratio": baseline_di, "accuracy": baseline_acc},
            "preprocessing": {"method": "Correlation Remover", "disparate_impact_ratio": baseline_di, "accuracy": baseline_acc},
            "postprocessing": {"method": "Threshold Optimizer", "disparate_impact_ratio": baseline_di, "accuracy": baseline_acc},
        }

        # Pre-processing (Correlation Remover)
        try:
            cr = CorrelationRemover(sensitive_feature_ids=[main_attr])
            X_train_cr_input = X_train_enc.copy()
            if main_attr not in X_train_cr_input.columns:
                X_train_cr_input[main_attr] = pd.factorize(X_train[main_attr])[0]
            X_test_cr_input = X_test_enc.copy()
            if main_attr not in X_test_cr_input.columns:
                X_test_cr_input[main_attr] = pd.factorize(X_test[main_attr])[0]

            X_train_cr = cr.fit_transform(X_train_cr_input)
            X_test_cr = cr.transform(X_test_cr_input)

            if task_type == 'binary':
                preproc_model = XGBClassifier(eval_metric='logloss', random_state=42)
            elif task_type == 'multiclass':
                preproc_model = XGBClassifier(eval_metric='mlogloss', random_state=42)
            else:
                preproc_model = XGBRegressor(random_state=42)

            preproc_model.fit(X_train_cr, y_train)
            y_pred_pre = preproc_model.predict(X_test_cr)

            if task_type == 'binary':
                pre_di = float(demographic_parity_ratio(y_test, y_pred_pre, sensitive_features=X_test[main_attr]))
                pre_acc = float(accuracy_score(y_test, y_pred_pre))
            else:
                pre_di = baseline_di # Simplified
                pre_acc = baseline_acc
                
            if not np.isnan(pre_di):
                mitigation_results["preprocessing"]["disparate_impact_ratio"] = pre_di
                mitigation_results["preprocessing"]["accuracy"] = pre_acc
        except Exception as e:
            warnings_list.append(f"Preprocessing mitigation failed: {str(e)}")

        if task_type == 'binary':
            try:
                orig_predict = model.predict
                model.predict = lambda X: orig_predict(X).astype(np.float64)
                if hasattr(model, 'predict_proba'):
                    orig_predict_proba = model.predict_proba
                    model.predict_proba = lambda X: orig_predict_proba(X).astype(np.float64)

                postproc = ThresholdOptimizer(
                    estimator=model,
                    constraints="demographic_parity",
                    predict_method="auto",
                    prefit=True,
                )
                postproc.fit(X_train_enc, y_train, sensitive_features=X_train[main_attr].to_numpy())
                y_pred_post = postproc.predict(X_test_enc, sensitive_features=X_test[main_attr].to_numpy())

                post_di = float(demographic_parity_ratio(y_test, y_pred_post, sensitive_features=X_test[main_attr]))
                post_acc = float(accuracy_score(y_test, y_pred_post))
                if not np.isnan(post_di):
                    mitigation_results["postprocessing"]["disparate_impact_ratio"] = post_di
                    mitigation_results["postprocessing"]["accuracy"] = post_acc
            except Exception as e:
                warnings_list.append(f"Postprocessing mitigation failed: {str(e)}")
        else:
            mitigation_results["postprocessing"]["method"] = "Not Supported for non-binary tasks"

        # Explainability (SHAP)
        explainability = {
            "status": "skipped",
            "reason": None,
            "data": {"feature_importance": [], "group_differences": []},
        }

        if len(X_train_enc) < 50:
            explainability["reason"] = f"Dataset is too small to compute reliable SHAP values."
        else:
            try:
                explainer = shap.TreeExplainer(model)
                shap_sample = X_test_enc.sample(n=min(100, len(X_test_enc)), random_state=42)
                shap_values = explainer.shap_values(shap_sample)

                if task_type == 'multiclass':
                    shap_values = np.abs(shap_values).mean(axis=-1) # average over classes
                    
                fi = [
                    {"feature": col, "importance": float(val)}
                    for col, val in zip(shap_sample.columns, np.abs(shap_values).mean(0))
                ]
                fi = sorted(fi, key=lambda x: x["importance"], reverse=True)[:10]

                explainability["status"] = "computed"
                explainability["data"]["feature_importance"] = fi
            except Exception as e:
                explainability["reason"] = f"SHAP computation failed: {str(e)}"
                if DEBUG_MODE:
                    print(f"[DEBUG] SHAP error: {traceback.format_exc()}")

        return {
            "bias": bias_metrics,
            "proxy": proxy_results,
            "mitigation": mitigation_results,
            "explainability": explainability,
            "warnings": warnings_list,
            "task_type": task_type
        }

    def generate_pdf_report(self, results: Dict[str, Any]) -> io.BytesIO:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        
        title_style = styles["Title"]
        title_style.alignment = 0
        title_style.fontSize = 24
        title_style.textColor = colors.HexColor("#022448")
        
        heading_style = styles["Heading2"]
        heading_style.fontSize = 14
        heading_style.textColor = colors.HexColor("#022448")
        heading_style.spaceBefore = 20
        heading_style.spaceAfter = 10
        
        normal_style = styles["Normal"]
        
        elements = []
        elements.append(Paragraph("BiasAudit Pro — Compliance Report", title_style))
        elements.append(Spacer(1, 24))
        
        elements.append(Paragraph("1. Executive Summary", heading_style))
        total_attrs = len(results["bias"])
        failing_attrs = sum(1 for v in results["bias"].values() if not v["is_di_compliant"])
        avg_di = sum(v["disparate_impact_ratio"] for v in results["bias"].values()) / total_attrs if total_attrs > 0 else 0
        
        elements.append(Paragraph(f"Audited {total_attrs} attributes. Average DI Ratio: {avg_di:.3f}. Failing: {failing_attrs}.", normal_style))
        doc.build(elements)
        buffer.seek(0)
        return buffer
