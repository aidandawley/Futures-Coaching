import { Link } from "react-router-dom";

export default function Planning() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <main className="planning-page">
      <div className="planning-grid">
        {/* LEFT — Week switcher */}
        <aside className="panel-dark week-panel">
          <header className="panel-head">
            <h2>Week</h2>
            <div className="week-nav">
              <button type="button" className="ghost">←</button>
              <button type="button" className="ghost">→</button>
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

        {/* CENTER — Weekly calendar */}
        <section className="panel-dark calendar-panel">
          <header className="panel-head">
            <h2>Weekly Calendar</h2>
          </header>

          <div className="calendar-grid">
            {days.map(d => (
              <div className="day-col" key={d}>
                <div className="day-head">
                  <div className="day-name">{d}</div>
                  <div className="day-date muted">20</div>
                </div>

                {/* placeholder workout cards */}
                <div className="workout-card planned">
                  <div className="title">Planned</div>
                  <div className="desc muted">Legs & glutes</div>
                </div>
                <div className="workout-card done">
                  <div className="title">Completed</div>
                  <div className="desc muted">Chest & tris</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT — AI Coach chat */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head">
            <h2>AI Coach</h2>
          </header>

          {/* Upload your image later; this box holds the space */}
          <div className="coach-avatar">
            {/* <img src={yourImage} alt="AI Coach" /> */}
            <span className="muted">Upload coach image</span>
          </div>

          <div className="chat-log">
            <div className="msg coach">
              How was your chest workout?
            </div>
            <div className="msg user">
              Felt strong! Bench moved well.
            </div>
            <div className="msg coach">
              Great! We’ll add 2.5–5 lb next session.
            </div>
          </div>

          <form className="chat-input" onSubmit={(e)=>e.preventDefault()}>
            <input type="text" placeholder="Ask your coach…" />
            <button type="submit" className="btn btn--blue">Send</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
