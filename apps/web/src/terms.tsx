import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { TermsPage } from "./pages/TermsPage";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TermsPage />
  </StrictMode>,
);
