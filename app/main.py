from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, func, inspect
from sqlalchemy.orm import sessionmaker, declarative_base
from contextlib import asynccontextmanager
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== DATABASE CONFIG (4 ENV VARS) ====================

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "admin")
DB_PASS = os.getenv("DB_PASS", "secretpass123")
DB_NAME = os.getenv("DB_NAME", "crud_app")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASS}@{DB_HOST}:5432/{DB_NAME}"

logger.info(f"Connecting to database at {DB_HOST}/{DB_NAME} as {DB_USER}")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ==================== MODELS ====================

class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False)
    phone = Column(String(30))
    company = Column(String(100))
    role = Column(String(100))
    notes = Column(Text)
    avatar_color = Column(String(7), default="#6C63FF")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


# ==================== PYDANTIC SCHEMAS ====================

class ContactCreate(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = "#6C63FF"


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = None
    avatar_color: Optional[str] = None


class ContactResponse(BaseModel):
    id: int
    name: str
    email: str
    phone: Optional[str]
    company: Optional[str]
    role: Optional[str]
    notes: Optional[str]
    avatar_color: Optional[str]
    created_at: Optional[str]
    updated_at: Optional[str]

    class Config:
        from_attributes = True


# ==================== SEED DATA ====================

SEED_DATA = [
    {
        "name": "Budi Santoso",
        "email": "budi@example.com",
        "phone": "+62 812-3456-7890",
        "company": "PT Teknologi Maju",
        "role": "Software Engineer",
        "notes": "Full-stack developer dengan pengalaman 5 tahun",
        "avatar_color": "#6C63FF",
    },
    {
        "name": "Siti Rahayu",
        "email": "siti@example.com",
        "phone": "+62 813-9876-5432",
        "company": "CV Digital Kreasi",
        "role": "UI/UX Designer",
        "notes": "Spesialis dalam design system dan mobile app",
        "avatar_color": "#FF6584",
    },
    {
        "name": "Ahmad Faisal",
        "email": "ahmad@example.com",
        "phone": "+62 857-1234-5678",
        "company": "PT Cloud Indonesia",
        "role": "DevOps Engineer",
        "notes": "Expert di Kubernetes dan AWS",
        "avatar_color": "#43E97B",
    },
    {
        "name": "Dewi Lestari",
        "email": "dewi@example.com",
        "phone": "+62 878-5678-1234",
        "company": "Startup Inovasi",
        "role": "Product Manager",
        "notes": "Berpengalaman membangun produk dari nol",
        "avatar_color": "#F7971E",
    },
    {
        "name": "Rizky Pratama",
        "email": "rizky@example.com",
        "phone": "+62 856-4321-8765",
        "company": "PT Data Solusi",
        "role": "Data Scientist",
        "notes": "Machine learning dan big data analytics",
        "avatar_color": "#A18CD1",
    },
]


def init_database():
    """Auto-create tables (CREATE IF NOT EXISTS) and seed data if empty."""
    logger.info("Initializing database — creating tables if not exist...")
    Base.metadata.create_all(bind=engine)
    logger.info("Tables created/verified successfully!")

    # Seed data if table is empty
    db = SessionLocal()
    try:
        count = db.query(Contact).count()
        if count == 0:
            logger.info("Table is empty — seeding sample data...")
            for data in SEED_DATA:
                db.add(Contact(**data))
            db.commit()
            logger.info(f"Seeded {len(SEED_DATA)} sample contacts!")
        else:
            logger.info(f"Table already has {count} contacts — skipping seed.")
    except Exception as e:
        logger.error(f"Error seeding data: {e}")
        db.rollback()
    finally:
        db.close()


# ==================== APP LIFECYCLE ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_database()
    yield


# ==================== APP ====================

app = FastAPI(
    title="Contact Manager API",
    description="A beautiful CRUD application for managing contacts",
    version="1.0.0",
    lifespan=lifespan,
)

# Static files and templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==================== FRONTEND ROUTES ====================

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Serves the frontend — also used as health check endpoint."""
    return templates.TemplateResponse("index.html", {"request": request})


# ==================== HEALTH CHECK ====================

@app.get("/health")
def health_check():
    """Quick health check endpoint."""
    db = SessionLocal()
    try:
        db.execute(func.now())
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unhealthy: {str(e)}")
    finally:
        db.close()


# ==================== API ROUTES ====================

@app.get("/api/contacts")
def get_contacts(search: Optional[str] = None):
    db = SessionLocal()
    try:
        query = db.query(Contact)
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                Contact.name.ilike(search_term) |
                Contact.email.ilike(search_term) |
                Contact.company.ilike(search_term) |
                Contact.role.ilike(search_term)
            )
        contacts = query.order_by(Contact.created_at.desc()).all()
        return [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "phone": c.phone,
                "company": c.company,
                "role": c.role,
                "notes": c.notes,
                "avatar_color": c.avatar_color,
                "created_at": str(c.created_at) if c.created_at else None,
                "updated_at": str(c.updated_at) if c.updated_at else None,
            }
            for c in contacts
        ]
    finally:
        db.close()


@app.get("/api/contacts/{contact_id}")
def get_contact(contact_id: int):
    db = SessionLocal()
    try:
        contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return {
            "id": contact.id,
            "name": contact.name,
            "email": contact.email,
            "phone": contact.phone,
            "company": contact.company,
            "role": contact.role,
            "notes": contact.notes,
            "avatar_color": contact.avatar_color,
            "created_at": str(contact.created_at) if contact.created_at else None,
            "updated_at": str(contact.updated_at) if contact.updated_at else None,
        }
    finally:
        db.close()


@app.post("/api/contacts", status_code=201)
def create_contact(contact: ContactCreate):
    db = SessionLocal()
    try:
        db_contact = Contact(**contact.model_dump())
        db.add(db_contact)
        db.commit()
        db.refresh(db_contact)
        return {
            "id": db_contact.id,
            "name": db_contact.name,
            "email": db_contact.email,
            "phone": db_contact.phone,
            "company": db_contact.company,
            "role": db_contact.role,
            "notes": db_contact.notes,
            "avatar_color": db_contact.avatar_color,
            "created_at": str(db_contact.created_at) if db_contact.created_at else None,
            "updated_at": str(db_contact.updated_at) if db_contact.updated_at else None,
        }
    finally:
        db.close()


@app.put("/api/contacts/{contact_id}")
def update_contact(contact_id: int, contact: ContactUpdate):
    db = SessionLocal()
    try:
        db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not db_contact:
            raise HTTPException(status_code=404, detail="Contact not found")

        update_data = contact.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_contact, key, value)

        db.commit()
        db.refresh(db_contact)
        return {
            "id": db_contact.id,
            "name": db_contact.name,
            "email": db_contact.email,
            "phone": db_contact.phone,
            "company": db_contact.company,
            "role": db_contact.role,
            "notes": db_contact.notes,
            "avatar_color": db_contact.avatar_color,
            "created_at": str(db_contact.created_at) if db_contact.created_at else None,
            "updated_at": str(db_contact.updated_at) if db_contact.updated_at else None,
        }
    finally:
        db.close()


@app.delete("/api/contacts/{contact_id}")
def delete_contact(contact_id: int):
    db = SessionLocal()
    try:
        db_contact = db.query(Contact).filter(Contact.id == contact_id).first()
        if not db_contact:
            raise HTTPException(status_code=404, detail="Contact not found")

        db.delete(db_contact)
        db.commit()
        return {"message": "Contact deleted successfully", "id": contact_id}
    finally:
        db.close()


@app.get("/api/stats")
def get_stats():
    db = SessionLocal()
    try:
        total = db.query(Contact).count()
        companies = db.query(Contact.company).distinct().count()
        return {
            "total_contacts": total,
            "total_companies": companies,
        }
    finally:
        db.close()
