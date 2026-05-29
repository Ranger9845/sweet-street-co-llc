import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMotionPrefs } from "@/hooks/use-motion-prefs";

type Origin =
  | DOMRect
  | { x: number; y: number; width?: number; height?: number };

type Flight = {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
};

type Ctx = {
  flyToCart: (origin: Origin) => void;
  registerCartTarget: (el: HTMLElement | null) => void;
};

const CartFlyContext = createContext<Ctx | null>(null);

const FLIGHT_MS_DESKTOP = 1100;
const FLIGHT_MS_MOBILE = 750;

export function CartFlyProvider({ children }: { children: ReactNode }) {
  const targetRef = useRef<HTMLElement | null>(null);
  const idRef = useRef(0);
  const [flights, setFlights] = useState<Flight[]>([]);
  const { reduced, lowPower } = useMotionPrefs();
  const flightMs = lowPower ? FLIGHT_MS_MOBILE : FLIGHT_MS_DESKTOP;

  const flyToCart = useCallback((origin: Origin) => {
    const target = targetRef.current;
    if (!target) return;

    // Reduced motion: skip the flying cup entirely, just pulse the cart icon.
    if (reduced) {
      target.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.2)" }, { transform: "scale(1)" }],
        { duration: 220, easing: "ease-out" },
      );
      return;
    }

    const t = target.getBoundingClientRect();
    const fromX = origin.x + (("width" in origin ? origin.width : 0) ?? 0) / 2;
    const fromY = origin.y + (("height" in origin ? origin.height : 0) ?? 0) / 2;
    const toX = t.left + t.width / 2;
    const toY = t.top + t.height / 2;

    const id = ++idRef.current;
    setFlights((f) => [...f, { id, from: { x: fromX, y: fromY }, to: { x: toX, y: toY } }]);
    window.setTimeout(() => {
      setFlights((f) => f.filter((x) => x.id !== id));
    }, flightMs + 100);

    window.setTimeout(() => {
      target.animate(
        [
          { transform: "scale(1)" },
          { transform: "scale(1.35) rotate(-6deg)" },
          { transform: "scale(0.92) rotate(3deg)" },
          { transform: "scale(1)" },
        ],
        { duration: 480, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
      );
    }, flightMs - 80);
  }, [reduced, flightMs]);

  const registerCartTarget = useCallback((el: HTMLElement | null) => {
    targetRef.current = el;
  }, []);

  return (
    <CartFlyContext.Provider value={{ flyToCart, registerCartTarget }}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
            <AnimatePresence>
              {flights.map((f) => {
                const midX = (f.from.x + f.to.x) / 2;
                // arc up by 25% of the vertical distance + a constant lift
                const lift = Math.max(80, Math.abs(f.from.y - f.to.y) * 0.35);
                const midY = Math.min(f.from.y, f.to.y) - lift;
                return (
                  <motion.div
                    key={f.id}
                    className="absolute"
                    style={{ width: 90, height: 116, marginLeft: -45, marginTop: -58, willChange: "transform, opacity" }}
                    initial={{ x: f.from.x, y: f.from.y, scale: 0.35, opacity: 0, rotate: -18 }}
                    animate={{
                      x: [f.from.x, midX, f.to.x],
                      y: [f.from.y, midY, f.to.y],
                      scale: [0.5, 1.45, 0.6],
                      opacity: [0, 1, 1, 0.25],
                      rotate: [-18, 10, -4],
                    }}
                    transition={{
                      duration: flightMs / 1000,
                      ease: [0.4, 0, 0.2, 1],
                      opacity: { times: [0, 0.18, 0.85, 1] },
                    }}
                  >
                    <FlyingCup />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body
        )}
    </CartFlyContext.Provider>
  );
}

export function useCartFly() {
  const ctx = useContext(CartFlyContext);
  if (!ctx) throw new Error("useCartFly must be used within CartFlyProvider");
  return ctx;
}

function FlyingCup() {
  return (
    <svg viewBox="0 0 60 80" width="100%" height="100%" aria-hidden>
      <defs>
        <linearGradient id="fly-cup-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(14 85% 72%)" />
          <stop offset="100%" stopColor="hsl(14 80% 55%)" />
        </linearGradient>
      </defs>
      {/* liquid */}
      <path
        d="M11 22 L49 22 L45 74 Q30 78 15 74 Z"
        fill="url(#fly-cup-grad)"
      />
      {/* cup outline */}
      <path
        d="M10 20 L50 20 L46 76 Q30 80 14 76 Z"
        fill="none"
        stroke="hsl(14 60% 30%)"
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
      {/* rim */}
      <ellipse
        cx={30}
        cy={20}
        rx={20}
        ry={3.5}
        fill="none"
        stroke="hsl(14 60% 30%)"
        strokeWidth={2.2}
      />
      {/* straw */}
      <rect
        x={32}
        y={4}
        width={5}
        height={22}
        rx={1.5}
        fill="hsl(340 75% 65%)"
        stroke="hsl(14 60% 30%)"
        strokeWidth={1.2}
      />
      {/* sparkle */}
      <circle cx={20} cy={36} r={2} fill="rgba(255,255,255,0.75)" />
      <circle cx={36} cy={48} r={1.4} fill="rgba(255,255,255,0.6)" />
    </svg>
  );
}
