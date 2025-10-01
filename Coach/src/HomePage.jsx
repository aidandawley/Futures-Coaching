import { useNavigate } from "react-router-dom";
import logo from "./assets/Logo.png";
export default function HomePage() {
  const navigate = useNavigate();
    return (
      <main className="main">
        
        <img src={logo} alt="Future Coaching logo" className="logo-lg" />
  
       
        <div className="spacer" aria-hidden />
  
        <div className="container">
          <p className="welcome-mini">
            Welcome — today is <strong>MM/DD/YYYY, HH:MM</strong>
          </p>
  
          <section className="tiles">
          <button
    className="tile"
    type="button"
    onClick={() => navigate("/planning")}
  >
    <h2>Workout Planning <span className="emoji">💭</span></h2>
    <p>Create and edit your workout split and learn about different workouts.</p>
  </button>
            <button className="tile" type="button"><h2>Workout Tracker 📝</h2><p>Track your workouts to achieve progressive overload.</p></button>
            <button className="tile" type="button"><h2>Food Tracker 🍖</h2><p>Document your macro nutrient and calorie intakes.</p></button>
            <button className="tile" type="button"><h2>Coming Soon🔒</h2><p></p></button>
          </section>
        </div>
      </main>
    );
  }