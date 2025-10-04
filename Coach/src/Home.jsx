import "./styles/home.css";

export default function Home() {
    return (
      <main className="main home-page">
        <section className="panel">
          <h1>Future Coaching</h1>
          <p>Welcome! This is a demo of the AI Future Coach!</p>
          <button
            className="btn"
            type="button"
            onClick={() => alert("Button works 🎉")}
            >
            Get Started
          </button>
        </section>
      </main>
    );
    }