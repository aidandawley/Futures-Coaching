from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.database import engine
from .db import models
from .routers import users, workouts, sets, ai


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      
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