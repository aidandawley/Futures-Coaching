import { Link } from "react-router-dom";

export default function Food() {
  return (
    <main className="main page-center">
      <section className="panel" style={{ width: "min(800px, 92vw)" }}>
        <h1>Food Tracker</h1>
        <p>Blank page — coming soon.</p>
        <p style={{ marginTop: 12 }}>
          <Link to="/home">← Back to Home</Link>
        </p>
      </section>
    </main>
  );
}
