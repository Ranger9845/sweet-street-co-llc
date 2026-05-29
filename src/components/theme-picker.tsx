import { motion, AnimatePresence } from "framer-motion";
import { Platform } from "@/hooks/use-platform";

interface ThemePickerProps {
  rawPlatform: Platform;
  hasChosen: boolean;
  onChoosePlatform: () => void;
  onChooseDefault: () => void;
}

export function ThemePicker({
  rawPlatform,
  hasChosen,
  onChoosePlatform,
  onChooseDefault,
}: ThemePickerProps) {
  if (rawPlatform === "other") return null;

  const isIOS = rawPlatform === "ios";

  return (
    <AnimatePresence>
      {!hasChosen && (
        <motion.div
          key="theme-picker"
          initial={{ y: "110%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "110%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28, delay: 1.1 }}
          className="fixed bottom-0 left-0 right-0 z-[60] p-4 sm:p-6 pointer-events-none"
        >
          <div className="max-w-sm mx-auto pointer-events-auto">
            {isIOS ? (
              /* iOS card — preview of the frosted glass theme */
              <div
                className="rounded-[28px] overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  backdropFilter: "blur(28px) saturate(200%)",
                  WebkitBackdropFilter: "blur(28px) saturate(200%)",
                  border: "1px solid rgba(255,255,255,0.7)",
                  boxShadow:
                    "0 8px 40px -8px rgba(180,60,80,0.28), inset 0 1px 0 rgba(255,255,255,0.85)",
                }}
              >
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex-shrink-0 flex items-center justify-center text-xl"
                      style={{
                        background: "rgba(255,255,255,0.65)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        border: "1px solid rgba(255,255,255,0.8)",
                      }}
                    >
                      🍎
                    </div>
                    <div>
                      <p
                        className="text-[10px] font-bold tracking-[0.22em] uppercase mb-0.5"
                        style={{ color: "hsl(345 72% 52%)" }}
                      >
                        iPhone Detected
                      </p>
                      <p
                        className="text-[16px] font-semibold leading-tight"
                        style={{
                          color: "hsl(345 45% 18%)",
                          fontFamily: "var(--font-serif)",
                        }}
                      >
                        Frosted Glass Theme
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-[13px] leading-relaxed mb-4"
                    style={{ color: "hsl(345 25% 42%)" }}
                  >
                    Want translucent cards that feel native to iOS? You can always change this later.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onChoosePlatform}
                      className="flex-1 py-2.5 rounded-full text-[14px] font-semibold text-white transition-opacity active:opacity-70"
                      style={{
                        background:
                          "linear-gradient(135deg, hsl(345,75%,58%) 0%, hsl(10,72%,60%) 100%)",
                      }}
                    >
                      Use iOS Theme
                    </button>
                    <button
                      onClick={onChooseDefault}
                      className="flex-1 py-2.5 rounded-full text-[14px] font-semibold transition-opacity active:opacity-70"
                      style={{
                        background: "rgba(255,255,255,0.55)",
                        border: "1px solid rgba(0,0,0,0.08)",
                        color: "hsl(345 35% 38%)",
                      }}
                    >
                      Keep Default
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Android card — preview of Material You peach theme */
              <div
                className="rounded-[28px] overflow-hidden"
                style={{
                  background: "hsl(22 55% 95%)",
                  boxShadow:
                    "0 4px 28px -4px rgba(180,85,30,0.26), 0 1px 4px rgba(0,0,0,0.07)",
                }}
              >
                <div className="px-5 pt-5 pb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-xl"
                      style={{ background: "hsl(22 80% 86%)" }}
                    >
                      🤖
                    </div>
                    <div>
                      <p
                        className="text-[10px] font-bold tracking-[0.18em] uppercase mb-0.5"
                        style={{ color: "hsl(22 72% 44%)" }}
                      >
                        Android Detected
                      </p>
                      <p
                        className="text-[16px] font-semibold leading-tight"
                        style={{ color: "hsl(22 45% 18%)" }}
                      >
                        Material You Theme
                      </p>
                    </div>
                  </div>
                  <p
                    className="text-[13px] leading-relaxed mb-4"
                    style={{ color: "hsl(22 28% 38%)" }}
                  >
                    Try a theme that matches Google's design language — poppy peach surfaces, solid cards, and smooth Material animations.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={onChoosePlatform}
                      className="flex-1 py-2.5 rounded-full text-[14px] font-semibold text-white transition-opacity active:opacity-70"
                      style={{ background: "hsl(22 82% 48%)" }}
                    >
                      Use Material You
                    </button>
                    <button
                      onClick={onChooseDefault}
                      className="flex-1 py-2.5 rounded-full text-[14px] font-semibold transition-opacity active:opacity-70"
                      style={{
                        background: "hsl(22 50% 88%)",
                        color: "hsl(22 40% 30%)",
                      }}
                    >
                      Keep Default
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
