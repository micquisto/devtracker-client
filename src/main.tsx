import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// App.jsx
import AppShell from "./AppShell";

export default function App() {
  return <AppShell />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
