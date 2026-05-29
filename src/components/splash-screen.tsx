import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart } from "lucide-react";

export function SplashScreen({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center select-none pointer-events-none"
          style={{
            background: "linear-gradient(160deg, hsl(345,65%,87%) 0%, hsl(20,80%,91%) 60%, hsl(340,55%,89%) 100%)",
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.03 }}
          transition={{ duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Soft background circles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute -top-24 -left-24 h-96 w-96 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(350,70%,80%,0.35) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.08, 1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full"
              style={{ background: "radial-gradient(circle, hsl(20,90%,78%,0.3) 0%, transparent 70%)" }}
              animate={{ scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
          </div>

          {/* Logo */}
          <motion.img
            src="/logo.png"
            alt="Sweet Street"
            className="relative h-32 w-auto object-contain drop-shadow-xl mb-8"
            initial={{ scale: 0.65, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.34, 1.45, 0.64, 1] }}
          />

          {/* Tagline */}
          <motion.p
            className="relative font-serif text-xl font-semibold tracking-wide"
            style={{ color: "hsl(345,40%,28%)" }}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            Bringing our community together
          </motion.p>

          {/* Hearts + second line */}
          <motion.div
            className="relative flex items-center gap-2.5 mt-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ delay: 1, duration: 0.45, repeat: Infinity, repeatDelay: 1.3 }}
            >
              <Heart
                className="h-4 w-4"
                style={{ fill: "hsl(350,70%,55%)", color: "hsl(350,70%,55%)" }}
              />
            </motion.span>

            <span
              className="text-base font-semibold"
              style={{ color: "hsl(14,75%,50%)" }}
            >
              one drink at a time
            </span>

            <motion.span
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ delay: 1.2, duration: 0.45, repeat: Infinity, repeatDelay: 1.3 }}
            >
              <Heart
                className="h-4 w-4"
                style={{ fill: "hsl(350,70%,55%)", color: "hsl(350,70%,55%)" }}
              />
            </motion.span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
