from sqlalchemy import create_engine, Column, String, JSON, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from pydantic import BaseModel
import datetime
import os

DATABASE_URL = "sqlite:///./bias_audit.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AuditSession(Base):
    __tablename__ = "audit_sessions"
    
    id = Column(String, primary_key=True, index=True)
    data_path = Column(String, nullable=False)
    results = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
