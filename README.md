# BiasAudit Pro: AI Fairness & Intersectional Auditing Platform

BiasAudit Pro is an end-to-end fairness auditing platform designed to identify, analyze, and mitigate algorithmic bias in structured datasets and machine learning models. It features a modern React dashboard and a robust Python backend powered by Fairlearn and Google Gemini AI.

## 🚀 Key Features

*   **Automated Bias Detection:** Instant calculation of Disparate Impact (DI) Ratio and Statistical Parity.
*   **Intersectional Auditing:** Synthesizes multiple protected attributes to uncover compounded discrimination.
*   **Proxy Detection:** Uses a "Stalker Model" approach to identify features leaking sensitive information.
*   **Explainability:** Integrated SHAP (Shapley Additive Explanations) for feature-level bias attribution.
*   **Bias Mitigation:** Pre-processing (Correlation Remover) and Post-processing (Threshold Optimizer) pipelines.
*   **Gemini AI Insights:** Translates complex mathematical disparities into plain-English ethical narratives.

## 🛠️ Tech Stack

*   **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Recharts.
*   **Backend:** FastAPI, XGBoost, Scikit-Learn.
*   **Fairness:** Fairlearn, SHAP.
*   **LLM:** Google Gemini 2.0 Flash API.

## 📦 Project Structure

```text
├── bias-auditor/         # Python Backend (FastAPI)
│   ├── backend/          # Core logic (main.py, ai_service.py)
│   ├── requirements.txt  # Python dependencies
│   └── ...
├── bias-auditor-web/     # React Frontend (Vite)
│   ├── src/              # Dashboard components & pages
│   ├── package.json      # Node dependencies
│   └── ...
└── README.md             # This file
```

## ⚙️ Getting Started

### 1. Prerequisites
*   Python 3.10+
*   Node.js 18+
*   Google Gemini API Key

### 2. Backend Setup
```bash
cd bias-auditor
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Or venv\Scripts\activate on Windows
# Install dependencies
pip install -r requirements.txt
# Run the server
uvicorn backend.main:app --reload
```

### 3. Frontend Setup
```bash
cd bias-auditor-web
# Create .env file and add: VITE_GEMINI_API_KEY=your_key_here
npm install
npm run dev
```

## 📜 License
Distributed under the MIT License.
