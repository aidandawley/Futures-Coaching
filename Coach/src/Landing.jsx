import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  return (
    <main className="main landing-center">
      <section className="panel hero-card">
        <h1>Future Coaching</h1>
        <p>Welcome! This is a demo of the AI Future Coach!</p>
        <button className="btn" type="button" onClick={() => navigate("/home")}>
          Get Started
        </button>
      </section>
    </main>
  );
}
