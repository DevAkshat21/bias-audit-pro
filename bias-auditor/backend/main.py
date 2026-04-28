from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import pandas as pd
import io
import json
import uuid
import traceback
import os
from sqlalchemy.orm import Session
from ai_service import AIService, AIServiceException
from database import get_db, AuditSession

app = FastAPI(title="BiasAudit Pro API", version="1.0.0")
ai_service = AIService()

# Ensure data directory exists
os.makedirs("data", exist_ok=True)

# CORS — allow the local React dev server and any deployment origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-headers")
async def upload_headers(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Accept a CSV file, return its column list and a unique session ID."""
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {str(e)}")

    if df.empty or len(df.columns) < 2:
        raise HTTPException(status_code=400, detail="CSV must have at least 2 columns and at least 1 row.")

    session_id = str(uuid.uuid4())
    data_path = f"data/{session_id}.csv"
    
    # Save file to disk
    df.to_csv(data_path, index=False)
    
    # Create DB record
    db_session = AuditSession(id=session_id, data_path=data_path)
    db.add(db_session)
    db.commit()

    return {"sessionId": session_id, "columns": df.columns.tolist(), "rowCount": len(df)}


@app.post("/analyze")
def analyze(
    sessionId: str = Form(None),
    target: str = Form(None),
    protectedAttributes: str = Form(None),
    db: Session = Depends(get_db)
):
    """Run the full bias audit pipeline and return structured results."""
    if not sessionId:
        return JSONResponse(status_code=400, content={"error": "Missing sessionId", "details": "sessionId is required."})

    audit_session = db.query(AuditSession).filter(AuditSession.id == sessionId).first()
    if not audit_session:
        return JSONResponse(status_code=400, content={"error": "Session expired or invalid", "details": "Upload a CSV file first to create a session."})

    if not target:
        return JSONResponse(status_code=400, content={"error": "Missing target", "details": "target_column is required."})

    if not protectedAttributes:
        return JSONResponse(status_code=400, content={"error": "Missing protectedAttributes", "details": "At least one protected attribute is required."})

    try:
        protected_attrs = json.loads(protectedAttributes)
        if not isinstance(protected_attrs, list) or len(protected_attrs) == 0:
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        return JSONResponse(status_code=400, content={"error": "Invalid format", "details": "protectedAttributes must be a non-empty JSON array."})

    try:
        df = pd.read_csv(audit_session.data_path)
        results = ai_service.analyze_bias(df, target, protected_attrs)
        
        # Save results to DB
        audit_session.results = results
        db.commit()
        
        return results

    except AIServiceException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"error": "Analysis failed", "details": e.message},
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": "Unexpected server error", "details": str(e), "traceback": traceback.format_exc()},
        )


@app.get("/report/{session_id}")
async def get_report(session_id: str, db: Session = Depends(get_db)):
    """Generate and stream a PDF audit report for a completed session."""
    audit_session = db.query(AuditSession).filter(AuditSession.id == session_id).first()
    
    if not audit_session or not audit_session.results:
        raise HTTPException(status_code=404, detail="Report not found. Run analysis first.")

    try:
        pdf_buffer = ai_service.generate_pdf_report(audit_session.results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=bias_audit_report_{session_id}.pdf"},
    )


@app.get("/health")
def health(db: Session = Depends(get_db)):
    # Verify DB connection
    from sqlalchemy import text
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception:
        return {"status": "error", "database": "disconnected"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
