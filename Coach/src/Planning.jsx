// src/Planning.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import "./styles/planning.css";
import coachImg from "./assets/Coach.png";

// api helpers
import {
  listWorkoutsInRangeWithSets,
  listWorkoutsInRange,
  createWorkout,
  getWorkoutDetail,
  createSet,
  updateSet,
  deleteSet,
  listSetsByWorkout,
} from "./lib/api";

// --- helpers ---
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// monday as week start
function getWeekStart(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function Chip({ status = "planned" }) {
  const label =
    status === "done" ? "Completed" :
    status === "rest" ? "Rest" :
    "Planned";
  return <span className={`chip chip--${status}`}>{label}</span>;
}

export default function Planning() {
  const userId = 1; // todo: real current user

  // week + days
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [workoutsByDay, setWorkoutsByDay] = useState({}); // { "yyyy-mm-dd": [workout, ...] }

  // day modal
  const [selectedDayISO, setSelectedDayISO] = useState(null);
  const [isDayOpen, setIsDayOpen] = useState(false);

  // add workout form
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // workout detail panel
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [sets, setSets] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  // add set mini-form
  const [newSetExercise, setNewSetExercise] = useState("");
  const [newSetReps, setNewSetReps] = useState("");
  const [newSetWeight, setNewSetWeight] = useState("");

  // inline edit state per set id
  const [editRows, setEditRows] = useState({});

  // load a week’s workouts
  async function loadWeek(weekStart) {
    const startISO = toISODate(weekStart);
    const endISO = toISODate(addDays(weekStart, 6));
    try {
      const rows = await listWorkoutsInRangeWithSets(userId, startISO, endISO);
      const map = {};
      for (const w of rows) {
        const key = w.scheduled_for;
        if (!key) continue;
        if (!map[key]) map[key] = [];
        map[key].push(w);
      }
      setWorkoutsByDay(map);
    } catch (err) {
      console.error("week range load error:", err);
      setWorkoutsByDay({});
    }
  }
  

  useEffect(() => {
    loadWeek(currentWeekStart);
  }, [currentWeekStart]);

  // week controls
  function prevWeek() { setCurrentWeekStart(addDays(currentWeekStart, -7)); }
  function nextWeek() { setCurrentWeekStart(addDays(currentWeekStart, 7)); }
  function goToToday() { setCurrentWeekStart(getWeekStart(new Date())); }

  const weekEnd = addDays(currentWeekStart, 6);
  const weekLabel = `${currentWeekStart.toLocaleDateString(undefined, {
    month: "short", day: "numeric",
  })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // open/close day modal
  function openDay(iso) {
    setSelectedDayISO(iso);
    setIsDayOpen(true);
    setNewTitle("");
    setNewNotes("");
    setNewStatus("planned");
    setSaveError("");
  }
  function closeDay() {
    setIsDayOpen(false);
    // also close workout detail if open
    closeWorkoutDetail();
  }

  // add workout
  async function handleAddWorkout(e) {
    e.preventDefault();
    if (!selectedDayISO) return;
  
    setSaving(true);
    setSaveError("");
    try {
      const created = await createWorkout({
        user_id: userId,
        title: newTitle || "Workout",
        notes: newNotes || "",
        scheduled_for: selectedDayISO,
        status: newStatus,
      });
  
      // refresh the week so the new workout shows up in the list
      await loadWeek(currentWeekStart);
  
      // immediately open the workout detail so you can add/edit sets
      await openWorkoutDetail(created.id);
  
      // reset the add form
      setNewTitle("");
      setNewNotes("");
      setNewStatus("planned");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Failed to save workout");
    } finally {
      setSaving(false);
    }
  }
  
  // open/close workout detail
  async function openWorkoutDetail(workoutId) {
    setLoadingDetail(true);
    setDetailError("");
    try {
      const detail = await getWorkoutDetail(workoutId); // returns WorkoutWithSets
      setSelectedWorkout(detail);
      const initialSets = Array.isArray(detail.sets)
        ? detail.sets
        : await listSetsByWorkout(workoutId);
      setSets(initialSets ?? []);
      setEditRows({});
    } catch (err) {
      console.error(err);
      setDetailError(err.message || "Failed to load workout");
    } finally {
      setLoadingDetail(false);
    }
  }
  function closeWorkoutDetail() {
    setSelectedWorkout(null);
    setSets([]);
    setEditRows({});
    setNewSetExercise("");
    setNewSetReps("");
    setNewSetWeight("");
  }

  // create set
  async function handleAddSet(e) {
    e.preventDefault();
    if (!selectedWorkout) return;
    try {
      const row = await createSet({
        workout_id: selectedWorkout.id,
        exercise: newSetExercise || "Exercise",
        reps: Number(newSetReps || 0),
        weight: newSetWeight, // helper will coerce/omit
      });
      setSets((prev) => [...prev, row]);
      setNewSetExercise("");
      setNewSetReps("");
      setNewSetWeight("");
    } catch (err) {
      alert(err.message || "Failed to add set");
    }
  }

  // inline edit controls
  function startEdit(setRow) {
    setEditRows((m) => ({
      ...m,
      [setRow.id]: {
        exercise: setRow.exercise,
        reps: String(setRow.reps),
        weight: setRow.weight ?? "",
      },
    }));
  }
  function cancelEdit(setId) {
    setEditRows((m) => {
      const n = { ...m };
      delete n[setId];
      return n;
    });
  }
  async function saveEdit(setId) {
    const staged = editRows[setId];
    if (!staged) return;
    try {
      const updated = await updateSet(setId, {
        exercise: staged.exercise,
        reps: staged.reps,
        weight: staged.weight === "" ? null : staged.weight,
      });
      setSets((prev) => prev.map((s) => (s.id === setId ? updated : s)));
      cancelEdit(setId);
    } catch (err) {
      alert(err.message || "Failed to update set");
    }
  }
  async function removeSet(setId) {
    if (!confirm("Delete this set?")) return;
    try {
      await deleteSet(setId);
      setSets((prev) => prev.filter((s) => s.id !== setId));
    } catch (err) {
      alert(err.message || "Failed to delete set");
    }
  }

  return (
    <main className="planning-page">
      <div className="planning-grid">
        {/* left — week controls */}
        <aside className="panel-dark week-panel">
          <header className="panel-head">
            <h2>Week</h2>
            <div className="week-nav">
              <button type="button" className="ghost" onClick={prevWeek}>←</button>
              <button type="button" className="ghost" onClick={nextWeek}>→</button>
              <button type="button" className="btn btn--blue" onClick={goToToday}>Go to Today</button>
            </div>
          </header>

          <div className="week-meta">
            <div className="muted">Week of</div>
            <div className="week-range">{weekLabel}</div>
            <button type="button" className="btn btn--blue" onClick={goToToday}>Go to Today</button>
          </div>

          <ul className="legend">
            <li><span className="dot done" /> Completed</li>
            <li><span className="dot planned" /> Planned</li>
            <li><span className="dot rest" /> Recovery/Rest</li>
          </ul>

          <Link className="back-link" to="/home">← Back to Home</Link>
        </aside>

        <section className="panel-dark calendar-panel">
  <header className="panel-head">
    <h2>Weekly Calendar</h2>
    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
      <button type="button" className="ghost" onClick={prevWeek}>←</button>
      <div className="muted">{weekLabel}</div>
      <button type="button" className="ghost" onClick={nextWeek}>→</button>
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

          {/* preview: title + exercise summaries */}
          {items.length > 0 && (
            <ul className="workout-preview">
              {items.slice(0, 3).map((w) => {
                const counts = {};
                (w.sets || []).forEach((s) => {
                  const name = s.exercise || "Exercise";
                  counts[name] = (counts[name] || 0) + 1;
                });
                const entries = Object.entries(counts);
                const show = entries.slice(0, 3);
                const more = Math.max(entries.length - show.length, 0);

                return (
                  <li key={w.id} className="workout-card" style={{ cursor: "pointer" }}>
                    <div className="row">
                      <div className="title">{w.title || "Workout"}</div>
                      <span style={{ marginLeft: "auto" }} />
                      <Chip status={w.status || "planned"} />
                    </div>

                    {show.length > 0 ? (
                      <div className="w-summary">
                        {show.map(([ex, c], idx) => (
                          <div key={idx} className="w-summary__line">
                            <span className="w-ex">{ex}</span>: <span className="w-sets">{c} set{c > 1 ? "s" : ""}</span>
                          </div>
                        ))}
                        {more > 0 && <div className="w-summary__more">+{more} more</div>}
                      </div>
                    ) : (
                      <div className="muted" style={{ fontSize: 12 }}>no sets yet</div>
                    )}
                  </li>
                );
              })}
              {items.length > 3 && (
                <li className="more muted">+{items.length - 3} more workout(s)</li>
              )}
            </ul>
          )}
        </button>
      );
    })}
  </div>
</section>


        {/* right — ai coach */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head"><h2>AI Coach</h2></header>
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
            <button type="submit" className="btn btn--blue">Send</button>
          </form>
        </aside>
      </div>

      {/* day modal */}
      {isDayOpen && (
        <div className="day-modal">
          <div className="day-modal__backdrop" onClick={closeDay} />
          <div className="day-modal__card">
            <header className="day-modal__head">
              <h3>Plan for {selectedDayISO}</h3>
              <button type="button" className="ghost" onClick={closeDay}>✕</button>
            </header>

            <div className="day-modal__body">
              {(() => {
                const items = workoutsByDay[selectedDayISO] || [];
                if (items.length === 0) return <p className="muted">No workouts scheduled.</p>;
                return (
                  <ul className="day-list">
                    {items.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          className="workout-card"
                          onClick={() => openWorkoutDetail(w.id)}
                          style={{ width: "100%", textAlign: "left" }}
                          title="Open workout detail"
                        >
                          <div className="row">
                            <div className="title">{w.title || "Workout"}</div>
                            <Chip status={w.status || "planned"} />
                          </div>
                          {w.notes ? <div className="muted">{w.notes}</div> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}

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
                <div className="field">
                  <label>Status</label>
                  <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                    <option value="planned">Planned</option>
                    <option value="done">Completed</option>
                    <option value="rest">Recovery/Rest</option>
                  </select>
                </div>
                {saveError && <div className="error" role="alert">{saveError}</div>}
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

      {/* workout detail modal (opens on workout click) */}
      {isDayOpen && selectedWorkout && (
        <div className="day-modal workout-detail">
          <div className="day-modal__backdrop" onClick={closeWorkoutDetail} />
          <div className="day-modal__card" style={{ maxWidth: 720 }}>
            <header className="day-modal__head">
              <h3>
                {selectedWorkout.title || "Workout"} — {selectedWorkout.scheduled_for || "unscheduled"}
              </h3>
              <button type="button" className="ghost" onClick={closeWorkoutDetail}>✕</button>
            </header>

            <div className="day-modal__body">
              {loadingDetail ? (
                <p className="muted">Loading…</p>
              ) : detailError ? (
                <p className="error">{detailError}</p>
              ) : (
                <>
                  {/* sets list */}
                  {sets.length === 0 ? (
                    <p className="muted">No sets yet. Add your first set below.</p>
                  ) : (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                      {sets.map((s) => {
                        const editing = editRows[s.id];
                        return (
                          <li key={s.id} className="workout-card">
                            {!editing ? (
                              <div className="row" style={{ gap: 12 }}>
                                <div style={{ fontWeight: 700 }}>{s.exercise}</div>
                                <div className="muted">reps: {s.reps}</div>
                                <div className="muted">
                                  weight: {s.weight == null ? <em>—</em> : s.weight}
                                </div>
                                <span style={{ marginLeft: "auto" }} />
                                <button type="button" className="ghost" onClick={() => startEdit(s)}>Edit</button>
                                <button type="button" className="ghost" onClick={() => removeSet(s.id)}>Delete</button>
                              </div>
                            ) : (
                              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                                <input
                                  type="text"
                                  value={editing.exercise}
                                  onChange={(e) =>
                                    setEditRows((m) => ({ ...m, [s.id]: { ...m[s.id], exercise: e.target.value } }))
                                  }
                                  placeholder="Exercise"
                                  className="field-input"
                                  style={{ minWidth: 160 }}
                                />
                                <input
                                  type="number"
                                  value={editing.reps}
                                  onChange={(e) =>
                                    setEditRows((m) => ({ ...m, [s.id]: { ...m[s.id], reps: e.target.value } }))
                                  }
                                  placeholder="Reps"
                                  className="field-input"
                                  style={{ width: 100 }}
                                />
                                <input
                                  type="number"
                                  value={editing.weight}
                                  onChange={(e) =>
                                    setEditRows((m) => ({ ...m, [s.id]: { ...m[s.id], weight: e.target.value } }))
                                  }
                                  placeholder="Weight (optional)"
                                  className="field-input"
                                  style={{ width: 160 }}
                                />
                                <span style={{ marginLeft: "auto" }} />
                                <button type="button" className="btn btn--blue" onClick={() => saveEdit(s.id)}>Save</button>
                                <button type="button" className="ghost" onClick={() => cancelEdit(s.id)}>Cancel</button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* add set */}
                  <form onSubmit={handleAddSet} className="add-form" style={{ marginTop: 14 }}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        placeholder="Exercise (e.g., Lat Pulldown)"
                        value={newSetExercise}
                        onChange={(e) => setNewSetExercise(e.target.value)}
                        className="field-input"
                        required
                        style={{ minWidth: 220 }}
                      />
                      <input
                        type="number"
                        placeholder="Reps"
                        value={newSetReps}
                        onChange={(e) => setNewSetReps(e.target.value)}
                        className="field-input"
                        required
                        style={{ width: 120 }}
                      />
                      <input
                        type="number"
                        placeholder="Weight (optional)"
                        value={newSetWeight}
                        onChange={(e) => setNewSetWeight(e.target.value)}
                        className="field-input"
                        style={{ width: 160 }}
                      />
                      <span style={{ marginLeft: "auto" }} />
                      <button type="submit" className="btn btn--blue">+ Add Set</button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
