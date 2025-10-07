// src/Planning.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./styles/planning.css";
import coachImg from "./assets/Coach.png";
import { listWorkoutsInRange } from "./lib/api";

// --- helpers ---
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Monday as week start
function getWeekStart(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function Planning() {
  const userId = 1; // TODO: replace with real current user

  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [workoutsByDay, setWorkoutsByDay] = useState({}); // { "YYYY-MM-DD": [workout, ...], ... }

  // Load workouts for the current week (Mon–Sun)
  useEffect(() => {
    const startISO = toISODate(currentWeekStart);
    const endISO = toISODate(addDays(currentWeekStart, 6));

    listWorkoutsInRange(userId, startISO, endISO)
      .then((rows) => {
        const map = {};
        for (const w of rows) {
          const key = w.scheduled_for;
          if (!key) continue;
          (map[key] ||= []).push(w);
        }
        setWorkoutsByDay(map);
        console.log("week workouts:", map);
      })
      .catch((err) => {
        console.error("week range load error:", err);
        setWorkoutsByDay({});
      });
  }, [currentWeekStart]);

  // week controls
  function prevWeek() {
    setCurrentWeekStart(addDays(currentWeekStart, -7));
  }
  function nextWeek() {
    setCurrentWeekStart(addDays(currentWeekStart, 7));
  }
  function goToToday() {
    setCurrentWeekStart(getWeekStart(new Date()));
  }

  const weekEnd = addDays(currentWeekStart, 6);
  const weekLabel = `${currentWeekStart.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  // Build the 7 days of this week
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <main className="planning-page">
      <div className="planning-grid">
        {/* LEFT — week controls */}
        <aside className="panel-dark week-panel">
          <header className="panel-head">
            <h2>Week</h2>
            <div className="week-nav">
              <button type="button" className="ghost" onClick={prevWeek}>
                ←
              </button>
              <button type="button" className="ghost" onClick={nextWeek}>
                →
              </button>
              <button type="button" className="btn btn--blue" onClick={goToToday}>
                Go to Today
              </button>
            </div>
          </header>

          <div className="week-meta">
            <div className="muted">Week of</div>
            <div className="week-range">{weekLabel}</div>
            <button type="button" className="btn btn--blue" onClick={goToToday}>
              Go to Today
            </button>
          </div>

          <ul className="legend">
            <li>
              <span className="dot done" /> Completed
            </li>
            <li>
              <span className="dot plan" /> Planned
            </li>
            <li>
              <span className="dot rest" /> Recovery/Rest
            </li>
          </ul>

          <Link className="back-link" to="/home">
            ← Back to Home
          </Link>
        </aside>

        {/* MIDDLE — weekly calendar */}
        <section className="panel-dark calendar-panel">
          <header className="panel-head">
            <h2>Weekly Calendar</h2>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button type="button" className="ghost" onClick={prevWeek}>
                ←
              </button>
              <div className="muted">{weekLabel}</div>
              <button type="button" className="ghost" onClick={nextWeek}>
                →
              </button>
            </div>
          </header>

          <p className="muted" style={{ marginTop: 8 }}>
            Loaded days this week: {Object.keys(workoutsByDay).length}
          </p>

          <div className="calendar-grid week-grid">
            {weekDays.map((d, i) => {
              const iso = toISODate(d);
              const items = workoutsByDay[iso] || [];
              return (
                <button
                  key={iso}
                  type="button"
                  className="day-cell"
                  onClick={() => console.log("clicked", iso, items)}
                  title={items.length ? `${items.length} workout(s)` : ""}
                >
                  <div className="day-head" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div className="day-name muted">{dayNames[i]}</div>
                      <div className="day-date">{d.getDate()}</div>
                    </div>
                    {items.length > 0 && <span className="badge">{items.length}</span>}
                  </div>

                  {/* (optional) quick peek of first workout */}
                  {items.length > 0 && (
                    <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
                      {items[0].title || "Workout"}
                      {items.length > 1 ? ` +${items.length - 1} more` : ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* RIGHT — AI Coach (unchanged) */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head">
            <h2>AI Coach</h2>
          </header>

          <div className="coach-avatar has-image">
            <img src={coachImg} alt="AI Coach avatar" />
            <span className="muted">Upload coach image</span>
          </div>

          <div className="chat-log">
            <div className="msg coach">How was your chest workout?</div>
            <div className="msg user">Felt strong! Bench moved well.</div>
            <div className="msg coach">Great! We’ll add 2.5–5 lb next session.</div>
          </div>

          <form className="chat-input" onSubmit={(e) => e.preventDefault()}>
            <input type="text" placeholder="Ask your coach…" />
            <button type="submit" className="btn btn--blue">
              Send
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
