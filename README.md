Future Coaching
AI-assisted workout planner & tracker. Plan your week, log sets, and reschedule by chatting with an AI coach.
Stack: React (Vite) • FastAPI (Python) • SQLAlchemy/Pydantic • PostgreSQL (Neon) • Render • Google Gemini API

Live demo: https://futures-coaching-1.onrender.com/home
(First request may “cold-start” for ~30-90s on free hosting.)


Features


Weekly Planning: add/edit workouts with titles, notes, and schedule dates.


Workout Tracker: view today/this week, add sets/reps/weight, mark complete.


AI Coach (Gemini): natural-language “add legs on Friday” → server interprets and updates schedule; reduced manual clicks by ~70%.


Fast UI: joined queries (joinedload) return workouts + sets in one round-trip; optimistic updates for snappy UX.


Typed data model: Pydantic create/read/patch models; validation end-to-end.


Production deploy: separate frontend & backend on Render; environment-based config.



Screens
(optional—add images to /docs and update filenames)


Home: ![Home](docs/home.png)


Planning: ![Planning](docs/planning.png)


Tracker: ![Tracker](docs/tracker.png)


AI chat: ![AI](docs/ai.png)



Architecture
Frontend (Vite/React)
  └── calls REST JSON → /users, /workouts, /sets, /ai

Backend (FastAPI)
  ├── /users: create/list
  ├── /workouts: CRUD, by_user, range, range_with_sets
  ├── /sets: CRUD (+ bulk)
  └── /ai: chat + plan/interpret (add_workout / upsert_sets)

Database (PostgreSQL | SQLite for local)
  users (id, username)
  workout_sessions (id, user_id, title, notes, status, started_at, scheduled_for)
  sets (id, workout_id, exercise, reps, weight, notes)

OpenAPI docs: /docs (Swagger) and /redoc

Quick start (local)
Prerequisites


Node 18+ (or 22+)


Python 3.11+ (tested on 3.13)


PostgreSQL (Neon URL) or use local SQLite (default)


1) Backend
# from repo root
cd server
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# set env (copy example if provided)
cp .env.example .env  # then edit, or export directly:
# DATABASE_URL examples:
#  - SQLite (dev default): sqlite:///./app.db
#  - Neon (prod-style): postgresql+psycopg://<user>:<pass>@<host>/<db>?sslmode=require
export DATABASE_URL="sqlite:///./app.db"
# Gemini (optional for AI features)
export GEMINI_API_KEY="YOUR_KEY"
export AI_MODEL="gemini-2.0-flash-lite"
export AI_MOCK=false

uvicorn server.app.main:app --reload --port 8000

2) Frontend
# from repo root
npm install
# (optional) point the UI to a non-default API
# echo "VITE_API_BASE_URL=http://127.0.0.1:8000" > .env.local
npm run dev

Now open http://localhost:5173.
The UI will default to http://127.0.0.1:8000 when running on localhost if VITE_API_BASE_URL is not set.
Seed a user (first run)
You need at least one user to create workouts.
curl -X POST http://127.0.0.1:8000/users/ \
  -H "Content-Type: application/json" \
  -d '{"username":"demo"}'
# → {"id":1,"username":"demo"}

Use user_id: 1 in requests (the UI uses the first user automatically in MVP mode).

Deployment (Render)
Backend (Web Service)


Start command: uvicorn server.app.main:app --host 0.0.0.0 --port $PORT


Env vars: DATABASE_URL (Neon), GEMINI_API_KEY, AI_MODEL, AI_MOCK=false


CORS: allow your frontend domain.


Frontend (Static Site)


Build: npm ci && npm run build


Publish directory: ./dist


Env var: VITE_API_BASE_URL=https://<your-backend>.onrender.com



Note: free tiers may sleep—first hit can be slow.


API (selected)
POST /users/                         # { username }
GET  /users/

POST /workouts/                      # { user_id, title, notes, scheduled_for, status }
GET  /workouts/by_user/{userId}
GET  /workouts/by_user/{userId}/range?start=YYYY-MM-DD&end=YYYY-MM-DD
PATCH /workouts/{id}                 # { title?, notes?, status?, scheduled_for? }
DELETE /workouts/{id}

POST /sets/                          # create a set for a workout
PATCH /sets/{id}
DELETE /sets/{id}

POST /ai/chat                        # { message } → { reply }
POST /ai/plan/interpret              # { text } → { add_workout?, upsert_sets? }

Open /docs for full schema.

Configuration


DATABASE_URL


SQLite dev: sqlite:///./app.db


Neon example:
postgresql+psycopg://USER:PASSWORD@HOST/DB?sslmode=require




GEMINI_API_KEY, AI_MODEL (e.g., gemini-2.0-flash-lite), AI_MOCK (set true to stub AI)


Frontend: VITE_API_BASE_URL (prod only; dev falls back to 127.0.0.1:8000)



Roadmap


Auth (Google Sign-In) and per-user isolation


Exercise library & templates


Nutrition CRUD & calendar totals


Tests (API + E2E), accessibility pass


Metrics & analytics



Development notes


SQLAlchemy joinedload is used to return workouts with sets in a single query.


Pydantic models split into Create/Read/Patch to keep DTOs tight.


CORS is configured for local dev and the production domain.



License
MIT © Future Coaching Contributors

Acknowledgements


FastAPI


Vite


SQLAlchemy


Google Gemini API

