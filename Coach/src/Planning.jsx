// src/Planning.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./styles/planning.css";
import coachImg from "./assets/Coach.png";
import { listWorkoutsInRange, createWorkout } from "./lib/api"; // NEW

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

  // Day panel state
  const [selectedDayISO, setSelectedDayISO] = useState(null);
  const [isDayOpen, setIsDayOpen] = useState(false);

  // Add form state (NEW)
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Load week helper (so we can call it from useEffect and after save)  // NEW
  async function loadWeek(weekStart) {
    const startISO = toISODate(weekStart);
    const endISO = toISODate(addDays(weekStart, 6));
    try {
      const rows = await listWorkoutsInRange(userId, startISO, endISO);
      const map = {};
      for (const w of rows) {
        const key = w.scheduled_for;
        if (!key) continue;
        (map[key] ||= []).push(w);
      }
      setWorkoutsByDay(map);
      // console.log("week workouts:", map);
    } catch (err) {
      console.error("week range load error:", err);
      setWorkoutsByDay({});
    }
  }

  useEffect(() => {
    loadWeek(currentWeekStart);
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

  function openDay(iso) {
    setSelectedDayISO(iso);
    setIsDayOpen(true);
    setNewTitle("");
    setNewNotes("");
    setSaveError("");
  }
  function closeDay() {
    setIsDayOpen(false);
  }

  // Save handler (NEW)
  async function handleAddWorkout(e) {
    e.preventDefault();
    if (!selectedDayISO) return;

    setSaving(true);
    setSaveError("");
    try {
      await createWorkout({
        user_id: userId,
        title: newTitle || "Workout",
        notes: newNotes || "",
        scheduled_for: selectedDayISO, // important
      });

      // refresh this week
      await loadWeek(currentWeekStart);

      // clear form (keep modal open so user sees result)
      setNewTitle("");
      setNewNotes("");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }

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
                  onClick={() => openDay(iso)}
                  title={items.length ? `${items.length} workout(s)` : ""}
                >
                  <div className="day-head" style={{ justifyContent: "space-between" }}>
                    <div>
                      <div className="day-name muted">{dayNames[i]}</div>
                      <div className="day-date">{d.getDate()}</div>
                    </div>
                    {items.length > 0 && <span className="badge">{items.length}</span>}
                  </div>

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

        {/* RIGHT — AI Coach */}
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

      {/* DAY MODAL */}
      {isDayOpen && (
        <div className="day-modal">
          <div className="day-modal__backdrop" onClick={closeDay} />
          <div className="day-modal__card">
            <header className="day-modal__head">
              <h3>Plan for {selectedDayISO}</h3>
              <button type="button" className="ghost" onClick={closeDay}>
                ✕
              </button>
            </header>

            <div className="day-modal__body">
              {/* existing workouts */}
              {(() => {
                const items = workoutsByDay[selectedDayISO] || [];
                if (items.length === 0) return <p className="muted">No workouts scheduled.</p>;
                return (
                  <ul className="day-list">
                    {items.map((w) => (
                      <li key={w.id}>
                        <div className="title">{w.title || "Workout"}</div>
                        {w.notes ? <div className="muted">{w.notes}</div> : null}
                      </li>
                    ))}
                  </ul>
                );
              })()}

              {/* Add form */}
              <form onSubmit={handleAddWorkout} className="add-form">
                <div className="field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Push Day"
                  />
                </div>
                <div className="field">
                  <label>Notes</label>
                  <textarea
                    rows={3}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder="Optional notes…"
                  />
                </div>
                {saveError && (
                  <div className="error" role="alert">
                    {saveError}
                  </div>
                )}
                <div className="day-modal__foot">
                  <button type="submit" className="btn btn--blue" disabled={saving}>
                    {saving ? "Saving…" : "+ Add workout"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
