from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .db.database import engine
from .db import models
from .routers import users, workouts, sets

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine)

app.include_router(users.router)
app.include_router(workouts.router)
app.include_router(sets.router)

@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running"}
