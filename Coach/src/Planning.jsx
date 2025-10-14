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
  updateSet,
  deleteSet,
  listSetsByWorkout,
  createSetsBulk,
  aiChat,
  aiInterpret,
  aiQueueTasks,
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

// small status chip
function Chip({ status = "planned" }) {
  const label =
    status === "done" ? "Completed" :
    status === "rest" ? "Rest" :
    "Planned";
  return <span className={`chip chip--${status}`}>{label}</span>;
}

// group sets by exercise+reps+weight
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

export default function Planning() {
  const userId = 1; // TODO: real current user

  // week state
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const [workoutsByDay, setWorkoutsByDay] = useState({}); // { "yyyy-mm-dd": [workout, ...] }

  // day modal state
  const [selectedDayISO, setSelectedDayISO] = useState(null);
  const [isDayOpen, setIsDayOpen] = useState(false);

  // add workout form
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newStatus, setNewStatus] = useState("planned");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // workout detail state
  const [selectedWorkout, setSelectedWorkout] = useState(null);
  const [sets, setSets] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  // ui rows = grouped sets you can edit
  const [rows, setRows] = useState([]); // [{origKey?, exercise, reps, weight, count, ids?, isNew?}]
  const [dirty, setDirty] = useState(false); // single save control

  // tmp inputs for add exercise × sets (not saved until “save changes”)
  const [newEx, setNewEx] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newCount, setNewCount] = useState("1");
  const [newWeight, setNewWeight] = useState("");

  // ---- AI chat + proposals ----
  const [chatInput, setChatInput] = useState("");
  const [chat, setChat] = useState([
    { role: "assistant", content: "hey! tell me your goal + days/week and i'll help plan." },
  ]); // [{role:'user'|'assistant', content}]
  const [chatSending, setChatSending] = useState(false);

  const [proposals, setProposals] = useState([]); // from /ai/plan/interpret

  // updating message
  const [toast, setToast] = useState(null);
  function pushToast(msg) {
    setToast(msg);
    window.clearTimeout(pushToast._t);
    pushToast._t = window.setTimeout(() => setToast(null), 2000);
  }

  // load a week (tries sets endpoint, falls back)
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

  // initial + when week changes
  useEffect(() => {
    loadWeek(currentWeekStart);
  }, [currentWeekStart]);

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
    closeWorkoutDetail();
  }

  // create workout (optimistic insert + open detail)
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
      pushToast("workout saved");

      // optimistic calendar update
      setWorkoutsByDay((prev) => {
        const next = { ...prev };
        const day = selectedDayISO;
        const list = next[day] ? [...next[day]] : [];
        list.push({ ...created, sets: created.sets ?? [] });
        next[day] = list;
        return next;
      });

      loadWeek(currentWeekStart);
      await openWorkoutDetail(created.id);

      setNewTitle("");
      setNewNotes("");
      setNewStatus("planned");
    } catch (err) {
      console.error(err);
      setSaveError(err.message || "Failed to save workout");
      pushToast(err.message || "failed to save");
    } finally {
      setSaving(false);
    }
  }

  // open/close workout detail
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

  // add a logical exercise row (not saved yet)
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

  // remove a logical row (set count to 0)
  function removeLogicalRow(idx) {
    setRows((prev) => {
      const next = [...prev];
      // if it had ids, set count to 0 so we delete; if new, drop it
      if (next[idx].ids && next[idx].ids.length > 0) {
        next[idx] = { ...next[idx], count: "0" };
      } else {
        next.splice(idx, 1);
      }
      return next;
    });
    setDirty(true);
  }

  // single save: apply all row edits to backend
  async function saveAllChanges() {
    if (!selectedWorkout) return;
    try {
      setSaving(true);

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
            // delete extra sets from this group
            const toDelete = og.ids.slice(0, Math.abs(delta));
            for (const id of toDelete) {
              await deleteSet(id);
            }
          }
        } else {
          // new logical row: create n sets
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

      // also handle groups that disappeared (not present in rows anymore)
      const remainingKeys = new Set(rows.filter((r) => r.origKey).map((r) => r.origKey));
      for (const og of originalGroups) {
        if (!remainingKeys.has(og.key)) {
          // delete all sets in this original group
          for (const id of og.ids) {
            await deleteSet(id);
          }
        }
      }

      // reload workout + calendar
      await openWorkoutDetail(selectedWorkout.id);
      await loadWeek(currentWeekStart);
      setDirty(false);
      pushToast("changes saved");
    } catch (err) {
      alert(err.message || "failed to save changes");
      pushToast(err.message || "save failed");
    } finally {
      setSaving(false);
    }
  }

  // ---- AI Coach handlers ----
  function toMsgSchema(list) {
    return list.map(m => ({ role: m.role, content: m.content }));
  }

  async function handleCoachSubmit(e) {
    e.preventDefault();
    const msg = chatInput.trim();
    if (!msg || chatSending) return;
  
    // append user bubble
    const nextTranscript = [...chat, { role: "user", content: msg }];
    setChat(nextTranscript);
    setChatInput("");
    setChatSending(true);
  
    try {
      // 1) normal chat reply
      const reply = await aiChat(nextTranscript, userId);
      setChat(prev => [...prev, reply]); // reply = {role:"assistant", content:"..."}
  
      // 2) interpret for proposals (but DO NOT queue automatically)
      const shouldInterpret = /plan|schedule|add|move|sets|legs|push|pull/i.test(msg);
      if (shouldInterpret) {
        const res = await aiInterpret(
          nextTranscript.map(m => ({ role: m.role, content: m.content })),
          userId
        );
        if (res?.assistant_text) {
          setChat(prev => [...prev, { role: "assistant", content: res.assistant_text }]);
        }
        setProposals(res?.proposals || []);
      }
    } catch (err) {
      pushToast(err.message || "coach error");
    } finally {
      setChatSending(false);
    }
  }

  async function queueProposal(p) {
    const items = [{
      user_id: userId,
      intent: p.intent,
      payload: p.payload,
      summary: p.summary || "",
      confidence: p.confidence ?? 0.7,
      requires_confirmation: p.requires_confirmation ?? true,
      requires_super_confirmation: p.requires_super_confirmation ?? false,
      dedupe_key: p.dedupe_key ?? null,
    }];
    try {
      const out = await aiQueueTasks(items);
      pushToast("Queued for review");
      setProposals([]);          // optional: clear proposals now
    } catch (e) {
      pushToast("Failed to queue");
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

        {/* middle — weekly calendar */}
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

          {/* chat log */}
          <div className="chat-log">
            {chat.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : "coach"}`}>
                {m.content}
              </div>
            ))}
          </div>

          {/* proposals */}
          {proposals.length > 0 && (
            <div className="workout-card" style={{ marginBottom: 10 }}>
              <div className="row">
                <div className="title">Suggested changes</div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0 0", display: "grid", gap: 8 }}>
                {proposals.map((p, idx) => (
                  <li key={idx} className="workout-card" style={{ padding: 10 }}>
                    <div className="row">
                      <div className="w-title">{p.summary || p.intent}</div>
                      <span className="chip chip--planned">
                        conf {Math.round((p.confidence ?? 0.7) * 100)}%
                      </span>
                    </div>
                    <pre className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>
                      {JSON.stringify(p.payload, null, 2)}
                    </pre>
                    <div className="row" style={{ marginTop: 8, gap: 8 }}>
                      <button type="button" className="btn btn--blue" onClick={() => queueProposal(p)}>
                        Confirm
                      </button>
                      <button type="button" className="ghost" onClick={() => setProposals([])}>
                        Dismiss
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* chat input */}
          <form className="chat-input" onSubmit={handleCoachSubmit}>
            <input
              type="text"
              placeholder={chatSending ? "thinking…" : "Ask your coach…"}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatSending}
            />
            <button type="submit" className="btn btn--blue" disabled={chatSending}>
            {chatSending ? "sending…" : "send"}
            </button>
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
                          title="open workout detail"
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
                    placeholder="optional notes…"
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

      {/* workout detail modal */}
      {isDayOpen && selectedWorkout && (
        <div className="day-modal workout-detail">
          <div className="day-modal__backdrop" onClick={closeWorkoutDetail} />
          <div className="day-modal__card" style={{ maxWidth: 820 }}>
            <header className="day-modal__head">
              <h3>
                {selectedWorkout.title || "Workout"} — {selectedWorkout.scheduled_for || "unscheduled"}
              </h3>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--blue"
                  onClick={saveAllChanges}
                  disabled={saving || !dirty}
                  title={dirty ? "save all changes" : "no changes"}
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="ghost" onClick={closeWorkoutDetail}>✕</button>
              </div>
            </header>

            <div className="day-modal__body">
              {loadingDetail ? (
                <p className="muted">Loading…</p>
              ) : detailError ? (
                <p className="error">{detailError}</p>
              ) : (
                <>
                  {/* grouped rows editor */}
                  {rows.length === 0 ? (
                    <p className="muted">no exercises yet. add one below.</p>
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {rows.map((r, idx) => (
                        <div key={idx} className="workout-card" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="text"
                            className="field-input"
                            placeholder="Exercise"
                            value={r.exercise}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], exercise: e.target.value }; return n; }); setDirty(true); }}
                            style={{ minWidth: 220 }}
                          />
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Reps"
                            value={r.reps}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], reps: e.target.value }; return n; }); setDirty(true); }}
                            style={{ width: 120 }}
                          />
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Weight (optional)"
                            value={r.weight}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], weight: e.target.value }; return n; }); setDirty(true); }}
                            style={{ width: 160 }}
                          />
                          <input
                            type="number"
                            className="field-input"
                            placeholder="Sets"
                            min={0}
                            value={r.count}
                            onChange={(e) => { setRows((prev) => { const n = [...prev]; n[idx] = { ...n[idx], count: e.target.value }; return n; }); setDirty(true); }}
                            style={{ width: 110 }}
                          />
                          <button type="button" className="ghost" onClick={() => removeLogicalRow(idx)}>Delete</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* add logical exercise × sets (queued until save) */}
                  <form onSubmit={addLogicalRow} className="add-form" style={{ marginTop: 16 }}>
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
                        + Add Exercise × Sets
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
