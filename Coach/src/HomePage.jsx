import logo from "./assets/Logo.png";
export default function HomePage() {
    return (
      <main className="main">
        {/* fixed logo at the top-center */}
        <img src={logo} alt="Future Coaching logo" className="logo-lg" />
  
        {/* ensures all content starts below the fixed logo */}
        <div className="spacer" aria-hidden />
  
        <div className="container">
          <p className="welcome-mini">
            Welcome — today is <strong>MM/DD/YYYY, HH:MM</strong>
          </p>
  
          <section className="tiles">
            <button className="tile" type="button"><h2>Option One</h2><p>Short description.</p></button>
            <button className="tile" type="button"><h2>Option Two</h2><p>Another action.</p></button>
            <button className="tile" type="button"><h2>Option Three</h2><p>One-line outcome.</p></button>
            <button className="tile" type="button"><h2>Option Four</h2><p>Big nav button.</p></button>
          </section>
        </div>
      </main>
    );
  }