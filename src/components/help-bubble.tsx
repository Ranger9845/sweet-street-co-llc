import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";

export function HelpBubble({ isOwner = false }: { isOwner?: boolean }) {
  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("open-feedback-widget", { detail: { isOwner } }));
  };

  return (
    <motion.button
      onClick={handleClick}
      className="fixed left-4 top-1/2 z-40 flex flex-col items-center gap-1 bg-primary text-white rounded-full px-2.5 py-3 shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors"
      style={{ transform: "translateY(-50%)" }}
      initial={{ opacity: 0, x: -20 }}
      animate={{
        opacity: 1,
        x: 0,
        y: ["-50%", "calc(-50% - 4px)", "-50%", "calc(-50% + 4px)", "-50%"],
      }}
      transition={{
        opacity: { duration: 0.3 },
        x: { duration: 0.3 },
        y: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 },
      }}
      aria-label="Send us feedback"
      title="Send us feedback"
    >
      <HelpCircle className="h-4 w-4 flex-shrink-0" />
      <span
        className="text-[10px] font-semibold tracking-wide"
        style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
      >
        Help
      </span>
    </motion.button>
  );
}
