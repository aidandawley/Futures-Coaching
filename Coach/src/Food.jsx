import { useState } from "react";
import { Link } from "react-router-dom";
import "./styles/food.css";
import coachImg from "./assets/Coach.png";

function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export default function Food() {
  // seed with the two sample entries you already saw
  const [entries, setEntries] = useState([
    { id: 1, title: "Entry #1", time: "12:00", calories: 450, protein: 35, carbs: 48, fat: 14 },
    { id: 2, title: "Entry #2", time: "19:30", calories: 620, protein: 42, carbs: 70, fat: 20 },
  ]);
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

  const openForm = () => {
    resetDraft();
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    resetDraft();
  };

  const saveEntry = (e) => {
    e.preventDefault();
    const nextId = entries.length ? Math.max(...entries.map(x => x.id)) + 1 : 1;
    const title = draft.title.trim() || `Entry #${nextId}`;
    const time  = draft.time.trim() || nowHHMM();

    const toNum = (v) => (v === "" ? 0 : Math.max(0, Number(v) || 0));
    const newEntry = {
      id: nextId,
      title,
      time,
      calories: toNum(draft.calories),
      protein:  toNum(draft.protein),
      carbs:    toNum(draft.carbs),
      fat:      toNum(draft.fat),
    };

    setEntries((prev) => [newEntry, ...prev]); // newest on top
    setShowForm(false);
    resetDraft();
  };

  const removeEntry = (id) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  return (
    <main className="food-page">
      <div className="food-grid">
        {/* left — goals */}
        <aside className="panel-dark notes-panel">
          <header className="panel-head">
            <h2>Goals</h2>
          </header>

          <textarea
            className="notes-input"
            placeholder="Write today's nutrition goals…"
          />

          <ul className="notes-tips muted">
            <li>set protein first, then split remaining calories.</li>
            <li>aim for whole foods & fiber.</li>
          </ul>

          <Link className="back-link" to="/home">← Back to Home</Link>
        </aside>

        {/* center — food log (scrolls) */}
        <section className="panel-dark log-panel">
          <header className="panel-head">
            <h2>Food Log</h2>
            <div className="day-switch">
              <button className="ghost" type="button">←</button>
              <div className="date muted">Today • MM/DD</div>
              <button className="ghost" type="button">→</button>
            </div>
          </header>

          <div className="log-body">
            {/* add form (inline) */}
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

            {/* add tile (opens form) */}
            {!showForm && (
              <button className="entry-card add" type="button" onClick={openForm}>
                <span className="plus">＋</span>
                <span>Add Entry</span>
              </button>
            )}

            {/* entries */}
            {entries.map((e) => (
              <article className="entry-card" key={e.id}>
                <div className="entry-head">
                  <div className="title">{e.title}</div>
                  <div className="time muted">{e.time}</div>
                </div>

                <div className="metrics">
                  <div className="metric">
                    <div className="label">Calories</div>
                    <div className="value">{e.calories}</div>
                    <div className="unit">kcal</div>
                  </div>
                  <div className="metric">
                    <div className="label">Protein</div>
                    <div className="value">{e.protein}</div>
                    <div className="unit">g</div>
                  </div>
                  <div className="metric">
                    <div className="label">Carbs</div>
                    <div className="value">{e.carbs}</div>
                    <div className="unit">g</div>
                  </div>
                  <div className="metric">
                    <div className="label">Fat</div>
                    <div className="value">{e.fat}</div>
                    <div className="unit">g</div>
                  </div>
                </div>

                <div className="card-actions">
                  <button className="ghost small" type="button" onClick={() => removeEntry(e.id)}>
                    Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* right — coach */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head">
            <h2>AI Coach</h2>
          </header>

          <div className="coach-avatar has-image">
            <img src={coachImg} alt="AI Coach" />
          </div>

          <div className="chat-log">
            <div className="msg coach">How are your meals today?</div>
            <div className="msg user">Good! Hit my protein at lunch.</div>
            <div className="msg coach">Nice — keep fiber high at dinner.</div>
          </div>

          <form className="chat-input" onSubmit={(e)=>e.preventDefault()}>
            <input type="text" placeholder="Ask your coach…" />
            <button className="btn btn--blue" type="submit">Send</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
