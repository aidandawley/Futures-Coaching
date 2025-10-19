import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles/globals.css";
import "./App.css";
import "./styles/components.css";
import { getOrCreateClientUser } from "./lib/user";


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);



getOrCreateClientUser("guest").then((userId) => {
  window.FC_USER_ID = userId;

  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App userId={userId} />
    </React.StrictMode>
  );
});