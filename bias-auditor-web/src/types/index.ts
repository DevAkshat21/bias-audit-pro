export interface GroupData {
  group_name: string;
  group_size: number;
  selection_rate: number;
  actual_positive_rate: number;
  false_positive_rate: number;
  false_negative_rate: number;
}

export interface BiasMetric {
  groups: GroupData[];
  disparate_impact_ratio: number;
  parity_difference: number;
  is_di_compliant: boolean;
}

export interface MitigationResult {
  method?: string;
  disparate_impact_ratio: number;
  accuracy: number;
  groups: Record<string, number>;
}

export interface ProxyRisk {
  feature: string;
  correlation: number;
}

export interface ProxyAnalysis {
  high_risk: ProxyRisk[];
  medium_risk: ProxyRisk[];
  all_correlations: Record<string, number>;
}

export interface FeatureImportance {
  feature: string;
  importance: number;
}

export interface ExplainabilityData {
  status: 'ok' | 'skipped';
  reason?: string;
  data?: {
    feature_importance: FeatureImportance[];
  };
}
