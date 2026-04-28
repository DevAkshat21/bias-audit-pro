# BiasAudit Pro - Design System (Corporate Modern)

This document synthesizes the visual design system and UX patterns for the BiasAudit Pro dashboard, derived from the "Compliance & Precision" Stitch design project.

## 🎨 Color Palette

The system uses a high-contrast palette designed for institutional trust and clarity.

| Role | Color | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Primary** | Navy | `#022448` | Global navigation, headers, primary actions |
| **Secondary** | Slate | `#3b6090` | Secondary chart elements, inactive states |
| **Background** | Soft Blue | `#f6faff` | Main application background |
| **Surface** | White | `#ffffff` | Content cards, tables, report documents |
| **Error** | Deep Red | `#ba1a1a` | Violations, high-risk alerts |
| **Warning** | Amber | `#F39C12` | Borderline compliance, medium-risk alerts |
| **Success** | Green | `#2ECC71` | Compliance PASS states |
| **Outline** | Silver | `#c4c6cf` | Component borders and dividers |

## 📐 Layout Patterns

The dashboard follows a strict 8px grid system and employs specific layout compositions for data density.

### 1. Executive Summary (Overview)
- **Top Row**: 4 equal-width KPI cards with colored left-borders.
- **Main Section**: Grouped bar charts with horizontal orientation to maximize label space.
- **Compliance Grid**: A row of centered status badges.

### 2. Analysis Workbench (Bias Detection)
- **3-Column Composition** (4:5:3 ratio):
    - **Col 1**: Metrics Panel (Numerical scores + Threshold progress bars).
    - **Col 2**: Data Grid (Detailed group breakdown table).
    - **Col 3**: Verdict Sidebar (Sticky pass/fail status + actionable recommendations).

### 3. Strategy Comparison (Mitigation)
- **Scorecard Flow**: 3 primary cards connected by directional arrows (→) to visualize the remediation journey from Baseline to Compliant.
- **Trade-off Plot**: A scatter plot comparing Accuracy vs. Fairness.

### 4. Interpretation View (Explainability)
- **60/40 Composition**:
    - **Left (60%)**: Horizontal bar charts with risk-based coloring (Red for high-risk proxies).
    - **Right (40%)**: Contextual scanner with high-contrast warning blocks.

## 🔡 Typography

- **Font Family**: Inter (Google Fonts)
- **Primary Scale**:
    - **KPI Value**: 32px / 700 weight
    - **Heading XL**: 24px / 600 weight
    - **Heading LG**: 18px / 600 weight
    - **Body Base**: 15px / 400 weight
    - **Label Caps**: 11px / 600 weight (Uppercase, 0.05em spacing)

## ✨ UI Components

- **Cards**: White background, 1px `#c4c6cf` border, 4px corner radius.
- **Badges**: Pill-shaped, semi-bold text, high-contrast foreground on tinted background.
- **Dividers**: 1px horizontal lines for data tables; 2px accented dividers for section headers.
- **Shadows**: Subtle (0 2px 4px) used only on hover or overlays to maintain a "report-like" flatness.
