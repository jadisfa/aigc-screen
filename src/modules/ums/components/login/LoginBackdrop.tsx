import { memo, useEffect, useState } from "react";
import Aurora from "@/shared/components/react-bits/Aurora";

const AURORA_STOPS = ["#8B5CF6", "#A855F7", "#C4B5FD"];

/** 少量色块，用径向渐变自身羽化，避免 CSS filter:blur 在高分屏上的合成成本 */
const LOGIN_BUBBLES = [
  { size: 220, left: "8%", top: "16%", color: "rgba(124, 58, 237, 0.22)", duration: 28, delay: 0, driftX: 16, driftY: -28 },
  { size: 180, left: "72%", top: "10%", color: "rgba(236, 72, 153, 0.16)", duration: 24, delay: 1.2, driftX: -18, driftY: 22 },
  { size: 160, left: "48%", top: "64%", color: "rgba(59, 130, 246, 0.14)", duration: 30, delay: 0.6, driftX: 12, driftY: -18 },
  { size: 96, left: "84%", top: "48%", color: "rgba(45, 212, 191, 0.18)", duration: 20, delay: 0.8, driftX: 10, driftY: 16 },
] as const;

function prefersReducedMotion() {
  return typeof window !== "undefined"
    && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export const LoginBackdrop = memo(function LoginBackdrop() {
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <>
      {!reduceMotion ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-75 contain-paint">
            <Aurora
              className="h-full w-full"
              colorStops={AURORA_STOPS}
              amplitude={1.35}
              blend={0.88}
              speed={0.95}
              maxDrawSize={1280}
            />
          </div>
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden contain-paint" aria-hidden>
            {LOGIN_BUBBLES.map((bubble, index) => (
              <span
                key={`login-bubble-${index}`}
                className="absolute rounded-full"
                style={{
                  width: bubble.size,
                  height: bubble.size,
                  left: bubble.left,
                  top: bubble.top,
                  background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45) 0%, ${bubble.color} 46%, transparent 74%)`,
                  opacity: bubble.size >= 160 ? 0.9 : 0.85,
                  animation: `login-bubble-float ${bubble.duration}s ease-in-out ${bubble.delay}s infinite`,
                  ["--bubble-dx" as string]: `${bubble.driftX}px`,
                  ["--bubble-dy" as string]: `${bubble.driftY}px`,
                  ["--bubble-opacity" as string]: bubble.size >= 160 ? "0.82" : "0.9",
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{
          background:
            "linear-gradient(105deg, rgba(248,246,252,0.62) 0%, rgba(248,246,252,0.38) 40%, rgba(248,246,252,0.28) 100%)",
        }}
      />
    </>
  );
});
