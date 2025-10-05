import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ping } from "./lib/api";
import logo from "./assets/Logo2.png";
import "./styles/home.css";

export default function HomePage() {
  const navigate = useNavigate();

  // ping backend and show status
  const [status, setStatus] = useState("checking…");
  useEffect(() => {
    ping()
      .then((res) => setStatus(`API says: ${res.message}`))
      .catch((err) => setStatus(`API error: ${err.message}`));
  }, []);

  return (
    <main className="main home-page">
      <div className="logo-card">
        <img src={logo} alt="Future Coaching logo" className="logo-lg" />
      </div>

      <div className="spacer" aria-hidden />

      <div className="container">
        <p className="welcome-mini">
          Welcome — today is <strong>MM/DD/YYYY, HH:MM</strong>
        </p>

        {/* temporary status line to verify backend connection */}
        <p className="welcome-mini">{status}</p>

        <section className="tiles">
          <button className="tile" type="button" onClick={() => navigate("/planning")}>
            <h2>
              Workout Planning <span className="emoji">💭</span>
            </h2>
            <p>Create and edit your workout split and learn about different workouts.</p>
          </button>

          <button className="tile" type="button" onClick={() => navigate("/tracker")}>
            <h2>Workout Tracker 📝</h2>
            <p>Track your workouts to achieve progressive overload.</p>
          </button>

          <button className="tile" type="button" onClick={() => navigate("/food")}>
            <h2>Food Tracker 🍖</h2>
            <p>Document your macro nutrient and calorie intakes.</p>
          </button>

          <button className="tile" type="button">
            <h2>Coming Soon🔒</h2>
            <p></p>
          </button>
        </section>
      </div>
    </main>
  );
}
