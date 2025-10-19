// src/Tracker.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./styles/tracker.css";

// api helpers (same set you use in Planning.jsx)
import {
  listWorkoutsInRangeWithSets,
  listWorkoutsInRange,
  listWorkoutsOnDay,      // <- day refresh
  getWorkoutDetail,
  listSetsByWorkout,
  updateSet,
  deleteSet,
  createSetsBulk,
  updateWorkout,          // <- PATCH /workouts/:id (uses fetchJSON)
} from "./lib/api";

// --- tiny date utils (same as planner) ---
function toISODate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
// monday as week start
function getWeekStart(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // mon=0
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

// group sets by exercise+reps+weight (lets us edit “logical rows”)
function groupSets(sets) {
  const map = new Map();
  for (const s of sets) {
    const w = s.weight == null ? "" : String(s.weight);
    const key = `${s.exercise}|${s.reps}|${w}`;
    if (!map.has(key)) {
      map.set(key, { key, exercise: s.exercise, reps: s.reps, weight: s.weight ?? "", ids: [] });
    }
    map.get(key).ids.push(s.id);
  }
  return Array.from(map.values()).map((g) => ({ ...g, count: g.ids.length }));
}

export default function Tracker() {
  const userId = window.FC_USER_ID;; 

  // week state
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [workoutsByDay, setWorkoutsByDay] = useState({}); // { "yyyy-mm-dd": [workout, ...] }

  // day modal state
  const [selectedDayISO, setSelectedDayISO] = useState(null);
  const [isDayOpen, setIsDayOpen] = useState(false);

  // workout detail state
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [sets, setSets] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  // ui rows = grouped sets you can edit
  const [rows, setRows] = useState([]); // [{origKey?, exercise, reps, weight, count, ids?, isNew?}]
  const [dirty, setDirty] = useState(false); // single save control
  const [saving, setSaving] = useState(false); // save/complete spinner

  // add row inputs (queued until “save”)
  const [newEx, setNewEx] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newCount, setNewCount] = useState("1");
  const [newWeight, setNewWeight] = useState("");

  // small toast
  const [toast, setToast] = useState(null);
  function pushToast(msg) {
    setToast(msg);
    window.clearTimeout(pushToast._t);
    pushToast._t = window.setTimeout(() => setToast(null), 2000);
  }

  // load a week of workouts (tries joined sets endpoint, falls back)
  async function loadWeek(weekStart) {
    const startISO = toISODate(weekStart);
    const endISO = toISODate(addDays(weekStart, 6));
    try {
      let rows;
      try {
        rows = await listWorkoutsInRangeWithSets(userId, startISO, endISO);
      } catch {
        rows = await listWorkoutsInRange(userId, startISO, endISO);
      }
      const map = {};
      for (const w of rows) {
        const key = w.scheduled_for;
        if (!key) continue;
        if (!map[key]) map[key] = [];
        map[key].push({ ...w, sets: w.sets ?? [] });
      }
      setWorkoutsByDay(map);
    } catch (err) {
      console.error("week range load error:", err);
      setWorkoutsByDay({});
    }
  }

  // refresh just the selected day (cheaper than full week)
  async function refreshSelectedDay() {
    if (!selectedDayISO) return;
    try {
      const list = await listWorkoutsOnDay(userId, selectedDayISO);
      setWorkoutsByDay((prev) => ({ ...prev, [selectedDayISO]: list }));
    } catch (e) {
      console.warn("day refresh failed; falling back to full week", e);
      await loadWeek(currentWeekStart);
    }
  }

  // initial + when week changes
  useEffect(() => { loadWeek(currentWeekStart); }, [currentWeekStart]);

  // whenever sets load, hydrate grouped editable rows
  useEffect(() => {
    const grouped = groupSets(sets).map((g) => ({
      origKey: g.key,
      exercise: g.exercise,
      reps: String(g.reps),
      weight: g.weight === "" ? "" : String(g.weight),
      count: String(g.count),
      ids: g.ids,
      isNew: false,
    }));
    setRows(grouped);
    setDirty(false);
  }, [sets]);

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
  function openDay(iso) { setSelectedDayISO(iso); setIsDayOpen(true); }
  function closeDay() { setIsDayOpen(false); closeWorkoutDetail(); }

  // open workout detail (tracking modal)
  async function openWorkoutDetail(workoutId) {
    setLoadingDetail(true);
    setDetailError("");
    try {
      const detail = await getWorkoutDetail(workoutId);
      setSelectedWorkout(detail);
      const initialSets = Array.isArray(detail.sets)
        ? detail.sets
        : await listSetsByWorkout(workoutId);
      setSets(initialSets ?? []);
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
    setRows([]);
    setDirty(false);
    setNewEx("");
    setNewReps("");
    setNewWeight("");
    setNewCount("1");
  }

  // add logical row (not saved yet)
  function addLogicalRow(e) {
    e.preventDefault();
    if (!selectedWorkout) return;
    if (!newEx || !newReps || Number.isNaN(Number(newReps))) return;

    const row = {
      origKey: undefined, // new
      exercise: newEx,
      reps: String(Number(newReps)),
      weight: newWeight === "" ? "" : String(Number(newWeight)),
      count: String(Math.max(1, Number(newCount || 1))),
      ids: [],
      isNew: true,
    };
    setRows((prev) => [...prev, row]);
    setDirty(true);
    setNewEx("");
    setNewReps("");
    setNewWeight("");
    setNewCount("1");
  }

  // remove logical row (set count to 0 for existing groups; delete if new)
  function removeLogicalRow(idx) {
    setRows((prev) => {
      const next = [...prev];
      if (next[idx].ids && next[idx].ids.length > 0) {
        next[idx] = { ...next[idx], count: "0" };
      } else {
        next.splice(idx, 1);
      }
      return next;
    });
    setDirty(true);
  }

  // duplicate logical row (handy for tracking repeated sets)
  function duplicateLogicalRow(idx) {
    setRows((prev) => {
      const r = prev[idx];
      const copy = { ...r, origKey: undefined, ids: [], isNew: true };
      return [...prev, copy];
    });
    setDirty(true);
  }

  // persist all row edits to backend
  async function saveAllChanges() {
    if (!selectedWorkout) return;
    // do not toggle global "saving" here; callers (save/complete) handle it.
    // this returns after all mutations finish.
    // current grouped state from db (source of truth for ids)
    const originalGroups = groupSets(sets);
    const byKey = new Map(originalGroups.map((g) => [g.key, g]));

    // go through edited rows
    for (const r of rows) {
      const targetCount = Math.max(0, Number(r.count || 0));
      const payload = {
        exercise: r.exercise.trim() || "Exercise",
        reps: Number(r.reps || 0),
        weight: r.weight === "" ? null : Number(r.weight),
      };

      // existing group?
      if (r.origKey && byKey.has(r.origKey)) {
        const og = byKey.get(r.origKey);

        // if fields changed, update all sets in this group
        const changed =
          payload.exercise !== og.exercise ||
          payload.reps !== og.reps ||
          (payload.weight ?? null) !== (og.weight === "" ? null : og.weight);

        if (changed) {
          for (const id of og.ids) {
            await updateSet(id, payload);
          }
        }

        // adjust count up/down
        const delta = targetCount - og.count;
        if (delta > 0) {
          await createSetsBulk({
            workout_id: selectedWorkout.id,
            exercise: payload.exercise,
            reps: payload.reps,
            count: delta,
            weight: payload.weight,
          });
        } else if (delta < 0) {
          const toDelete = og.ids.slice(0, Math.abs(delta));
          for (const id of toDelete) {
            await deleteSet(id);
          }
        }
      } else {
        // new row: create n sets
        if (targetCount > 0) {
          await createSetsBulk({
            workout_id: selectedWorkout.id,
            exercise: payload.exercise,
            reps: payload.reps,
            count: targetCount,
            weight: payload.weight,
          });
        }
      }
    }

    // also handle groups that disappeared completely
    const remainingKeys = new Set(rows.filter((r) => r.origKey).map((r) => r.origKey));
    for (const og of originalGroups) {
      if (!remainingKeys.has(og.key)) {
        for (const id of og.ids) {
          await deleteSet(id);
        }
      }
    }

    // reload workout + day cache
    await openWorkoutDetail(selectedWorkout.id);
    await refreshSelectedDay();
    setDirty(false);
  }

  // complete button: save -> mark done -> refresh -> green chip
  async function completeAfterSave() {
    if (!selectedWorkout) return;
    try {
      setSaving(true);

      // 1) persist edits (returns after all done)
      await saveAllChanges();

      // 2) mark this workout completed
      await updateWorkout(selectedWorkout.id, { status: "done" });

      // 3) optimistic local update so the chip flips immediately
      setSelectedWorkout((w) => (w ? { ...w, status: "done" } : w));
      setWorkoutsByDay((prev) => {
        const next = { ...prev };
        for (const day in next) {
          next[day] = next[day].map((w) =>
            w.id === selectedWorkout.id ? { ...w, status: "done" } : w
          );
        }
        return next;
      });

      // 4) refresh just the day (cheaper) + keep week in sync
      await refreshSelectedDay();
      await loadWeek(currentWeekStart);

      pushToast("completed");
    } catch (e) {
      console.error(e);
      pushToast(e.message || "failed to complete");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="tracker-page">
      <div className="tracker-grid">
        {/* left — week controls */}
        <aside className="panel-dark week-panel">
          <header className="panel-head">
            <h2>Week</h2>
            <div className="week-nav">
              <button type="button" className="ghost" onClick={prevWeek}>←</button>
              <button type="button" className="ghost" onClick={nextWeek}>→</button>
            </div>
          </header>

          <div className="week-meta">
            <div className="muted">Week of</div>
            <div className="week-range">{weekLabel}</div>
            <button type="button" className="btn btn--blue" onClick={goToToday}>Go to Today</button>
          </div>

          <ul className="legend">
            <li><span className="dot done" /> Completed</li>
            <li><span className="dot plan" /> Planned</li>
            <li><span className="dot rest" /> Recovery/Rest</li>
          </ul>

          <Link className="back-link" to="/home">← Back to Home</Link>
        </aside>

        {/* center — calendar */}
        <section className="panel-dark calendar-panel">
          <header className="panel-head">
            <h2>Weekly Calendar</h2>
          </header>

          <div className="calendar-grid">
            {weekDays.map((d, i) => {
              const iso = toISODate(d);
              const items = workoutsByDay[iso] || [];
              return (
                <button
                  key={iso}
                  type="button"
                  className="day-col"
                  onClick={() => openDay(iso)}
                  title={items.length ? `${items.length} workout(s)` : ""}
                >
                  <div className="day-head">
                    <div className="day-name">{dayNames[i]}</div>
                    <div className="day-date muted">{d.getDate()}</div>
                  </div>

                  {items.map((w) => (
                    <div key={w.id} className={`workout-card ${w.status || "planned"}`}>
                      <div className="title">{w.title || "Workout"}</div>
                      <div className="desc muted">
                        {w.status ? w.status.charAt(0).toUpperCase() + w.status.slice(1) : "Planned"}
                      </div>
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* day modal: list workouts for that day */}
      {isDayOpen && !selectedWorkout && (
        <div className="modal-backdrop" onClick={closeDay} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h3>
                {selectedDayISO} <span className="muted">• Workouts</span>
              </h3>
              <button className="ghost" onClick={closeDay} aria-label="Close">✕</button>
            </header>

            <div className="modal-body">
              {(() => {
                const items = workoutsByDay[selectedDayISO] || [];
                if (items.length === 0) return <p className="muted">No workouts scheduled.</p>;
                return (
                  <ul className="day-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 8 }}>
                    {items.map((w) => (
                      <li key={w.id}>
                        <button
                          type="button"
                          className="workout-card"
                          onClick={() => openWorkoutDetail(w.id)}
                          style={{ width: "100%", textAlign: "left" }}
                          title="open tracking"
                        >
                          <div className="title">{w.title || "Workout"}</div>
                          <div className="muted">{w.status || "planned"}</div>
                        </button>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* tracking modal: edit sets + complete */}
      {isDayOpen && selectedWorkout && (
        <div className="modal-backdrop" onClick={closeWorkoutDetail} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: "min(820px, 96vw)" }}>
            <header className="modal-head">
              <h3>
                track: {selectedWorkout.title || "Workout"} <span className="muted">• {selectedWorkout.scheduled_for || "unscheduled"}</span>
              </h3>
              <div style={{ display: "flex", gap: 8 }}>
                {/* save button persists rows only */}
                <button
                  className="btn btn--blue"
                  onClick={async () => { try { setSaving(true); await saveAllChanges(); pushToast("changes saved"); } catch (e) { pushToast(e.message || "save failed"); } finally { setSaving(false); } }}
                  disabled={saving || !dirty}
                  title={dirty ? "save all changes" : "no changes"}
                >
                  {saving ? "Saving…" : "Save"}
                </button>

                {/* complete button saves and flips status to done */}
                <button
                  className="btn btn--blue"
                  onClick={completeAfterSave}
                  disabled={saving}
                  title="save and mark completed"
                >
                  {saving ? "Saving…" : "Complete"}
                </button>

                <button className="ghost" onClick={closeWorkoutDetail} aria-label="Close">✕</button>
              </div>
            </header>

            <div className="modal-body">
              {loadingDetail ? (
                <p className="muted">Loading…</p>
              ) : detailError ? (
                <p className="error">{detailError}</p>
              ) : (
                <>
                  {/* editable set rows */}
                  {rows.length === 0 ? (
                    <p className="muted">no sets yet. add one below.</p>
                  ) : (
                    <div className="sets-editor">
                      {rows.map((r, idx) => (
                        <div key={idx} className="set-row">
                          <input
                            type="text"
                            className="field-input"
                            placeholder="Exercise"
                            value={r.exercise}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], exercise: e.target.value }; return n; }); setDirty(true); }}
                          />
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Reps"
                            value={r.reps}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], reps: e.target.value }; return n; }); setDirty(true); }}
                          />
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Weight (optional)"
                            value={r.weight}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], weight: e.target.value }; return n; }); setDirty(true); }}
                          />
                          <div className="set-row__actions">
                            <button type="button" className="ghost" onClick={() => duplicateLogicalRow(idx)}>+ Duplicate</button>
                            <button type="button" className="ghost" onClick={() => removeLogicalRow(idx)}>Delete</button>
                          </div>
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Sets"
                            min={0}
                            value={r.count}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], count: e.target.value }; return n; }); setDirty(true); }}
                            style={{ gridColumn: "1 / span 4" }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* add logical set row */}
                  <form onSubmit={addLogicalRow} className="add-form" style={{ marginTop: 8 }}>
                    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                      <input
                        type="text"
                        placeholder="Exercise (e.g., Bench Press)"
                        value={newEx}
                        onChange={(e) => setNewEx(e.target.value)}
                        className="field-input"
                        required
                        style={{ minWidth: 220 }}
                      />
                      <input
                        type="number"
                        placeholder="Reps"
                        value={newReps}
                        onChange={(e) => setNewReps(e.target.value)}
                        className="field-input"
                        required
                        style={{ width: 120 }}
                      />
                      <input
                        type="number"
                        placeholder="Sets"
                        value={newCount}
                        onChange={(e) => setNewCount(e.target.value)}
                        className="field-input"
                        required
                        min={1}
                        style={{ width: 120 }}
                      />
                      <input
                        type="number"
                        placeholder="Weight (optional)"
                        value={newWeight}
                        onChange={(e) => setNewWeight(e.target.value)}
                        className="field-input"
                        style={{ width: 160 }}
                      />
                      <span style={{ marginLeft: "auto" }} />
                      <button type="submit" className="btn btn--blue" onClick={() => setDirty(true)}>
                        + Add Set
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
