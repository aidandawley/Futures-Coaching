import { Link } from "react-router-dom";
import "./styles/food.css";
import coachImg from "./assets/Coach.png";

export default function Food() {
  // purely presentational right now — no state/logic required yet
  return (
    <main className="food-page">
      <div className="food-grid">
        {/* LEFT — goals / notepad */}
        <aside className="panel-dark notes-panel">
          <header className="panel-head">
            <h2>Goals</h2>
          </header>

          <textarea
            className="notes-input"
            placeholder="Write today's nutrition goals…"
          />

          <ul className="notes-tips muted">
            <li>Tip: set protein first, then split remaining calories.</li>
            <li>Tip: aim for whole foods & fiber.</li>
          </ul>

          <Link className="back-link" to="/home">← Back to Home</Link>
        </aside>

        {/* CENTER — food log (scrolls inside this panel) */}
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
            {/* example entry card */}
            <article className="entry-card">
              <div className="entry-head">
                <div className="title">Entry #1</div>
                <div className="time muted">12:00 PM</div>
              </div>

              <div className="metrics">
                <div className="metric">
                  <div className="label">Calories</div>
                  <div className="value">450</div>
                  <div className="unit">kcal</div>
                </div>
                <div className="metric">
                  <div className="label">Protein</div>
                  <div className="value">35</div>
                  <div className="unit">g</div>
                </div>
                <div className="metric">
                  <div className="label">Carbs</div>
                  <div className="value">48</div>
                  <div className="unit">g</div>
                </div>
                <div className="metric">
                  <div className="label">Fat</div>
                  <div className="value">14</div>
                  <div className="unit">g</div>
                </div>
              </div>
            </article>

            {/* another sample entry to show the layout */}
            <article className="entry-card">
              <div className="entry-head">
                <div className="title">Entry #2</div>
                <div className="time muted">7:30 PM</div>
              </div>

              <div className="metrics">
                <div className="metric">
                  <div className="label">Calories</div>
                  <div className="value">620</div>
                  <div className="unit">kcal</div>
                </div>
                <div className="metric">
                  <div className="label">Protein</div>
                  <div className="value">42</div>
                  <div className="unit">g</div>
                </div>
                <div className="metric">
                  <div className="label">Carbs</div>
                  <div className="value">70</div>
                  <div className="unit">g</div>
                </div>
                <div className="metric">
                  <div className="label">Fat</div>
                  <div className="value">20</div>
                  <div className="unit">g</div>
                </div>
              </div>
            </article>

            {/* add more (placeholder — no logic yet) */}
            <button className="entry-card add" type="button">
              <span className="plus">＋</span>
              <span>Add Entry</span>
            </button>
          </div>
        </section>

        {/* RIGHT — AI coach lane */}
        <aside className="panel-dark coach-panel">
          <header className="panel-head">
            <h2>AI Coach</h2>
          </header>

          <div className="coach-avatar has-image">
            <img src={coachImg} alt="AI Coach" />
            <span className="muted">Upload coach image</span>
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
