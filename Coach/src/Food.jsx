import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./styles/food.css";
import coachImg from "./assets/Coach.png";
import { aiChat } from "./lib/api"; // talk to the backend coach

/* tiny date utils (monday-start weeks like tracker) */
function toISODate(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function getWeekStart(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // mon=0 … sun=6
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}
function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/* demo seed for today only; other days start empty */
const seedToday = toISODate(new Date());
const initialEntriesByDay = {
  [seedToday]: [
    { id: 1, title: "Entry #1", time: "12:00", calories: 450, protein: 35, carbs: 48, fat: 14 },
    { id: 2, title: "Entry #2", time: "19:30", calories: 620, protein: 42, carbs: 70, fat: 20 },
  ],
};

export default function Food() {
  /* calendar / day selection */
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const [selectedDayISO, setSelectedDayISO] = useState(toISODate(new Date()));

  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekEnd = addDays(currentWeekStart, 6);
  const weekLabel = `${currentWeekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  function prevWeek() { setCurrentWeekStart(addDays(currentWeekStart, -7)); }
  function nextWeek() { setCurrentWeekStart(addDays(currentWeekStart, 7)); }
  function goToToday() {
    const today = new Date();
    setCurrentWeekStart(getWeekStart(today));
    setSelectedDayISO(toISODate(today));
  }

  /* entries map keyed by iso date so calendar can show totals per day */
  const [entriesByDay, setEntriesByDay] = useState(initialEntriesByDay);

  // handy getter/setter for the selected day’s entries
  const entries = entriesByDay[selectedDayISO] ?? [];
  function setEntriesForSelected(updater) {
    setEntriesByDay((prev) => {
      const current = prev[selectedDayISO] ?? [];
      const nextList = typeof updater === "function" ? updater(current) : updater;
      return { ...prev, [selectedDayISO]: nextList };
    });
  }

  /* add-entry form state */
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    time: nowHHMM(),
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  const resetDraft = () => {
    setDraft({ title: "", time: nowHHMM(), calories: "", protein: "", carbs: "", fat: "" });
  };

  const openForm = () => { resetDraft(); setShowForm(true); };
  const cancelForm = () => { setShowForm(false); resetDraft(); };

  /* coach chat state (simple, stateless server; no updates to entries) */
  const userId = 1; // todo: replace with real auth identity
  const [chatLog, setChatLog] = useState([
    { role: "assistant", content: "How are your meals today?" },
  ]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // send one message to the coach (nutrition scope); includes light context
  async function sendCoachMessage(e) {
    e.preventDefault();
    const text = chatDraft.trim();
    if (!text || chatBusy) return;

    // tiny context line so coach can give targeted tips without editing anything
    const context = `context: ${selectedDayISO} totals → calories ${totals.calories}, protein ${totals.protein}g, carbs ${totals.carbs}g, fat ${totals.fat}g.`;

    const next = [
      ...chatLog,
      { role: "assistant", content: context },     // soft hint; backend still uses its own system prompt
      { role: "user", content: text },
    ];

    setChatLog(next);
    setChatDraft("");
    setChatBusy(true);

    try {
      // pass scope so backend picks the nutrition prompt
      const reply = await aiChat(next, userId, "nutrition");
      setChatLog((prev) => [...prev, { role: "assistant", content: reply.content }]);
    } catch (err) {
      console.error(err);
      setChatLog((prev) => [
        ...prev,
        { role: "assistant", content: "Coach is offline right now. Try again soon." },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  /* selected-day totals */
  const totals = useMemo(() => {
    return entries.reduce(
      (a, e) => ({
        calories: a.calories + (e.calories || 0),
        protein:  a.protein  + (e.protein  || 0),
        carbs:    a.carbs    + (e.carbs    || 0),
        fat:      a.fat      + (e.fat      || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [entries]);

  /* per-day totals for the week (for the small kcal chip on each day) */
  const totalsByISO = useMemo(() => {
    const map = new Map();
    for (const d of weekDays) {
      const iso = toISODate(d);
      const list = entriesByDay[iso] ?? [];
      const t = list.reduce(
        (a, e) => ({
          calories: a.calories + (e.calories || 0),
          protein:  a.protein  + (e.protein  || 0),
          carbs:    a.carbs    + (e.carbs    || 0),
          fat:      a.fat      + (e.fat      || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      );
      map.set(iso, t);
    }
    return map;
  }, [weekDays, entriesByDay]);

  /* handlers */
  const saveEntry = (e) => {
    e.preventDefault();
    setEntriesForSelected((prev) => {
      const nextId = prev.length ? Math.max(...prev.map(x => x.id)) + 1 : 1;
      const title = draft.title.trim() || `Entry #${nextId}`;
      const time  = draft.time.trim() || nowHHMM();
      const toNum = (v) => (v === "" ? 0 : Math.max(0, Number(v) || 0));
      const newEntry = {
        id: nextId, title, time,
        calories: toNum(draft.calories),
        protein:  toNum(draft.protein),
        carbs:    toNum(draft.carbs),
        fat:      toNum(draft.fat),
      };
      // keep chronological for readability
      return [newEntry, ...prev].sort((a, b) => a.time.localeCompare(b.time));
    });
    setShowForm(false);
    resetDraft();
  };

  const removeEntry = (id) => {
    setEntriesForSelected((prev) => prev.filter((e) => e.id !== id));
  };

  // when switching weeks, ensure a valid selected day (fallback to monday)
  useEffect(() => {
    const weekISO = new Set(weekDays.map(toISODate));
    if (!weekISO.has(selectedDayISO)) {
      setSelectedDayISO(toISODate(currentWeekStart));
    }
  }, [currentWeekStart]); // eslint-disable-line

  return (
    <main className="food-page">
      <div className="food-grid">
        {/* left — goals */}
        <aside className="panel-dark notes-panel">
          <header className="panel-head">
            <h2>Goals</h2>
          </header>

          <textarea className="notes-input" placeholder="Write today's nutrition goals…" />
          <ul className="notes-tips muted">
            <li>set protein first, then split remaining calories.</li>
            <li>aim for whole foods & fiber.</li>
          </ul>
          <Link className="back-link" to="/home">← Back to Home</Link>
        </aside>

        {/* center — calendar + food log for selected day */}
        <section className="panel-dark log-panel">
          <header className="panel-head">
            <h2>Nutrition Calendar</h2>
            <div className="day-switch">
              <button className="ghost" type="button" onClick={prevWeek}>←</button>
              <div className="date muted">Week • {weekLabel}</div>
              <button className="ghost" type="button" onClick={nextWeek}>→</button>
              <button className="ghost" type="button" onClick={goToToday} style={{ marginLeft: 8 }}>Today</button>
            </div>
          </header>

          {/* weekly grid with daily calorie chips */}
          <div className="calendar-grid calendar-grid--food">
            {weekDays.map((d, i) => {
              const iso = toISODate(d);
              const t = totalsByISO.get(iso) || { calories: 0 };
              const isSelected = iso === selectedDayISO;
              return (
                <button
                  key={iso}
                  type="button"
                  className={`day-col ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedDayISO(iso)}
                  title="view this day’s log"
                >
                  <div className="day-head">
                    <div className="day-name">{dayNames[i]}</div>
                    <div className="day-date muted">{d.getDate()}</div>
                  </div>
                  <div className="nutri-chip">
                    <span className="nutri-chip__label">kcal</span>
                    <span className="nutri-chip__value">{t.calories}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* selected-day log + totals */}
          <div className="log-body">
            {/* totals for selected day */}
            <div className="summary-card">
              <div className="summary-head">
                <span className="muted">Totals • {selectedDayISO}</span>
                <button className="btn btn--blue" type="button" onClick={openForm}>+ Add Entry</button>
              </div>
              <div className="summary-row">
                <div className="metric"><div className="label">Calories</div><div className="value">{totals.calories}</div><div className="unit">kcal</div></div>
                <div className="metric"><div className="label">Protein</div><div className="value">{totals.protein}</div><div className="unit">g</div></div>
                <div className="metric"><div className="label">Carbs</div><div className="value">{totals.carbs}</div><div className="unit">g</div></div>
                <div className="metric"><div className="label">Fat</div><div className="value">{totals.fat}</div><div className="unit">g</div></div>
              </div>
            </div>

            {/* add form */}
            {showForm && (
              <form className="entry-card add-form" onSubmit={saveEntry}>
                <div className="row">
                  <input
                    className="inline-input"
                    type="text"
                    placeholder="Title (optional)"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                  <input
                    className="inline-input"
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                  />
                </div>

                <div className="row metrics-row">
                  <label className="metric-edit">
                    <span>Calories</span>
                    <input
                      inputMode="numeric"
                      className="inline-input"
                      value={draft.calories}
                      onChange={(e) => setDraft({ ...draft, calories: e.target.value })}
                      placeholder="kcal"
                    />
                  </label>
                  <label className="metric-edit">
                    <span>Protein</span>
                    <input
                      inputMode="numeric"
                      className="inline-input"
                      value={draft.protein}
                      onChange={(e) => setDraft({ ...draft, protein: e.target.value })}
                      placeholder="g"
                    />
                  </label>
                  <label className="metric-edit">
                    <span>Carbs</span>
                    <input
                      inputMode="numeric"
                      className="inline-input"
                      value={draft.carbs}
                      onChange={(e) => setDraft({ ...draft, carbs: e.target.value })}
                      placeholder="g"
                    />
                  </label>
                  <label className="metric-edit">
                    <span>Fat</span>
                    <input
                      inputMode="numeric"
                      className="inline-input"
                      value={draft.fat}
                      onChange={(e) => setDraft({ ...draft, fat: e.target.value })}
                      placeholder="g"
                    />
                  </label>
                </div>

                <div className="row buttons">
                  <button className="btn btn--blue" type="submit">Save</button>
                  <button className="ghost" type="button" onClick={cancelForm}>Cancel</button>
                </div>
              </form>
            )}

            {/* add tile */}
            {!showForm && (
              <button className="entry-card add" type="button" onClick={openForm}>
                <span className="plus">＋</span>
                <span>Add Entry</span>
              </button>
            )}

            {/* entries for selected day only */}
            {entries.map((e) => (
              <article className="entry-card" key={e.id}>
                <div className="entry-head">
                  <div className="title">{e.title}</div>
                  <div className="time muted">{e.time}</div>
                </div>

                <div className="metrics">
                  <div className="metric"><div className="label">Calories</div><div className="value">{e.calories}</div><div className="unit">kcal</div></div>
                  <div className="metric"><div className="label">Protein</div><div className="value">{e.protein}</div><div className="unit">g</div></div>
                  <div className="metric"><div className="label">Carbs</div><div className="value">{e.carbs}</div><div className="unit">g</div></div>
                  <div className="metric"><div className="label">Fat</div><div className="value">{e.fat}</div><div className="unit">g</div></div>
                </div>

                <div className="card-actions">
                  <button className="ghost small" type="button" onClick={() => removeEntry(e.id)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* right — coach (now wired to aiChat with nutrition scope) */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head"><h2>AI Coach</h2></header>
          <div className="coach-avatar has-image"><img src={coachImg} alt="AI Coach" /></div>

          <div className="chat-log">
            {chatLog.map((m, i) => (
              <div key={i} className={`msg ${m.role === "user" ? "user" : "coach"}`}>
                {m.content}
              </div>
            ))}
          </div>

          <form className="chat-input" onSubmit={sendCoachMessage}>
            <input
              type="text"
              placeholder={chatBusy ? "Thinking…" : "Ask your coach…"}
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              disabled={chatBusy}
            />
            <button className="btn btn--blue" type="submit" disabled={chatBusy || !chatDraft.trim()}>
              {chatBusy ? "…" : "Send"}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
