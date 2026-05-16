import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ReactApp";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
