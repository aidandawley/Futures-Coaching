from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.database import engine
from .db import models
from .routers import users, workouts, sets, ai
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI()


ALLOWED_ORIGINS = [
    "https://futures-coaching-1.onrender.com",  
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,      
    allow_methods=["*"],
    allow_headers=["*"],
    
)

models.Base.metadata.create_all(bind=engine)

app.include_router(users.router)
app.include_router(workouts.router)
app.include_router(sets.router)
app.include_router(ai.router)

@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running"}

from .core.config import settings
print("AI key present?", bool(settings.GEMINI_API_KEY))
print("AI model:", settings.AI_MODEL, "mock:", settings.AI_MOCK)