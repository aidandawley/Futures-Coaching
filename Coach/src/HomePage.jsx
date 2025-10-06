import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ping } from "./lib/api";
import logo from "./assets/Logo2.png";
import "./styles/home.css";
import { listWorkoutsByUser, createWorkout } from "./lib/api";


export default function HomePage() {
  const navigate = useNavigate();

  // ping backend and show status
  
  const [status, setStatus] = useState("checking…");
  const [workoutCount, setWorkoutCount] = useState(null);

  useEffect(() => {
    ping()
      .then((res) => setStatus(`API says: ${res.message}`))
      .catch((err) => setStatus(`API error: ${err.message}`));
      
  }, []);


  useEffect(() => {
    listWorkoutsByUser(1)
      .then((rows) => setWorkoutCount(rows.length))
      .catch((err) => {
        console.error("workouts error:", err);
        setWorkoutCount(0);
      });
  }, []);
  
  async function handleAddWorkout() {
    try {
      // simple demo payload; you can make a real form later
      await createWorkout({ user_id: 1, title: "New Workout", notes: "" });
      // refresh the count
      const rows = await listWorkoutsByUser(1);
      setWorkoutCount(rows.length);
    } catch (err) {
      console.error("create workout error:", err);
      setStatus(`Create workout error: ${err.message}`);
    }
  }
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

        <p className="welcome-mini">
        {workoutCount === null ? "Loading workouts…" : `You have ${workoutCount} workout(s).`}
        </p>

        {/* temporary status line to verify backend connection */}
        <p className="welcome-mini">{status}</p>

        <button className="tile" type="button" onClick={handleAddWorkout}>
          <h2>Add Workout ➕</h2>
          <p>Quick test add (user 1)</p>
        </button>


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
