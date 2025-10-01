import { Link } from "react-router-dom";

export default function Planning() {
  return (
    <main className="main page-center">
      <section className="panel" style={{ width: "min(800px, 92vw)" }}>
        <h1>Workout Planning</h1>
        <p>Blank page — we’ll build this next.</p>
        <p style={{ marginTop: 12 }}>
          <Link to="/home">← Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
