import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./context/AuthContext";
import "./index.css";

const el = document.getElementById("root");
if (!el) {
  throw new Error("Não foi possível iniciar a aplicação. Recarregue a página ou acesse pelo endereço oficial do serviço.");
}

createRoot(el).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
);
