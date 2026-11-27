import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Showcase from "./Showcase";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main style={{ maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui" }}>
      <h1>react-svg-worldmap-regions</h1>
      <p>Zoom in to see states and provinces.</p>
      <Showcase />
    </main>
  </StrictMode>,
);
