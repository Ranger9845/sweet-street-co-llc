import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initConsoleCapture } from "./lib/console-capture";
import { initSupabase } from "@workspace/api-client-react";

initConsoleCapture();
initSupabase(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

createRoot(document.getElementById("root")!).render(<App />);
