import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "./styles/tracker.css";

export default function Tracker() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const [selected, setSelected] = useState(null); // { name: 'Mon', date: '20' } | null
  const openDay  = (d, date = "20") => setSelected({ name: d, date });
  const closeDay = () => setSelected(null);

  // esc to close
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && closeDay();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <main className="tracker-page">
      <div className="tracker-grid">
        {/* left — week panel */}
        <aside className="panel-dark week-panel">
          <header className="panel-head">
            <h2>Week</h2>
            <div className="week-nav">
              <button type="button" className="ghost" aria-label="Previous week">←</button>
              <button type="button" className="ghost" aria-label="Next week">→</button>
            </div>
          </header>

          <div className="week-meta">
            <div className="muted">Week of</div>
            <div className="week-range">Oct 14 – Oct 20</div>
            <button type="button" className="btn btn--blue">Go to Today</button>
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
            {days.map((d) => (
              <button
                key={d}
                type="button"
                className="day-col"
                onClick={() => openDay(d)}
              >
                <div className="day-head">
                  <div className="day-name">{d}</div>
                  <div className="day-date muted">20</div>
                </div>

                {/* sample markers */}
                <div className="workout-card planned">
                  <div className="title">Planned</div>
                  <div className="desc muted">Legs & glutes</div>
                </div>
                <div className="workout-card done">
                  <div className="title">Completed</div>
                  <div className="desc muted">Chest & tris</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* modal */}
      {selected && (
        <div className="modal-backdrop" onClick={closeDay} role="dialog" aria-modal="true">
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <header className="modal-head">
              <h3>
                {selected.name} <span className="muted">• {selected.date}</span>
              </h3>
              <button className="ghost" onClick={closeDay} aria-label="Close">✕</button>
            </header>

            <div className="modal-body">
              <p className="muted">
                Placeholder window. Later we’ll pull your plan for this day and
                record sets, reps, and weight.
              </p>

              <div className="modal-grid">
                <div className="metric">
                  <div className="label">Planned</div>
                  <div className="value">Legs & glutes</div>
                </div>
                <div className="metric">
                  <div className="label">Status</div>
                  <div className="value">—</div>
                </div>
              </div>
            </div>

            <footer className="modal-foot">
              <button className="btn btn--blue" onClick={closeDay}>Close</button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}
