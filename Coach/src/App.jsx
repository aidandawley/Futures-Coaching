import { Routes, Route } from "react-router-dom";
import Landing from "./Landing.jsx";
import HomePage from "./HomePage.jsx";
import Planning from "./Planning.jsx";
import Tracker from "./Tracker.jsx";
import Food from "./Food.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/planning" element={<Planning />} />
      <Route path="/tracker" element={<Tracker />} />
      <Route path="/food" element={<Food />} />
      <Route path="/home" element={<HomePage />} />
    </Routes>
  );
}
