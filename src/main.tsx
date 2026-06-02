import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initConsoleCapture } from "./lib/console-capture";

initConsoleCapture();

createRoot(document.getElementById("root")!).render(<App />);
