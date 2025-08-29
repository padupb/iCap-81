import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Set dark mode by default
document.documentElement.classList.add("dark");

// Add error boundary and loading feedback
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

try {
  const root = createRoot(rootElement);
  root.render(<App />);
  console.log("✅ React app initialized successfully");
} catch (error) {
  console.error("❌ Error initializing React app:", error);
  rootElement.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial, sans-serif;">
      <div style="text-align: center;">
        <h2>Erro ao carregar aplicação</h2>
        <p>Verifique o console para mais detalhes</p>
      </div>
    </div>
  `;
}
