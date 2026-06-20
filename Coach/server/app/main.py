from collections import Counter
from time import perf_counter

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from .db.database import engine
from .db import models
from .routers import users, workouts, sets, ai


app = FastAPI(title="Future Coaching API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REQUEST_COUNT: Counter[tuple[str, str, int]] = Counter()
REQUEST_LATENCY_SECONDS: Counter[tuple[str, str]] = Counter()


@app.middleware("http")
async def collect_http_metrics(request: Request, call_next):
    start = perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        route = request.scope.get("route")
        path = getattr(route, "path", request.url.path)
        method = request.method
        elapsed = perf_counter() - start
        REQUEST_COUNT[(method, path, status_code)] += 1
        REQUEST_LATENCY_SECONDS[(method, path)] += elapsed


models.Base.metadata.create_all(bind=engine)

app.include_router(users.router)
app.include_router(workouts.router)
app.include_router(sets.router)
app.include_router(ai.router)


@app.get("/")
def read_root():
    return {"message": "FastAPI backend is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    lines = [
        "# HELP coach_http_requests_total Total HTTP requests handled by the Coach API.",
        "# TYPE coach_http_requests_total counter",
    ]
    for (method, path, status), count in sorted(REQUEST_COUNT.items()):
        lines.append(
            f'coach_http_requests_total{{method="{method}",path="{path}",status="{status}"}} {count}'
        )

    lines.extend([
        "# HELP coach_http_request_latency_seconds_total Cumulative HTTP request latency by route.",
        "# TYPE coach_http_request_latency_seconds_total counter",
    ])
    for (method, path), seconds in sorted(REQUEST_LATENCY_SECONDS.items()):
        lines.append(
            f'coach_http_request_latency_seconds_total{{method="{method}",path="{path}"}} {seconds:.6f}'
        )

    return Response("\n".join(lines) + "\n", media_type="text/plain; version=0.0.4")


from .core.config import settings
print("AI key present?", bool(settings.GEMINI_API_KEY))
print("AI model:", settings.AI_MODEL, "mock:", settings.AI_MOCK)
