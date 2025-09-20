import { motion, AnimatePresence } from "framer-motion";
import { useRef } from "react";
export function TickerCount({ value, colorClass }: { value: number; colorClass: string }) {
  const previous = useRef(value);
  const direction = useRef(0); // 1 = up, -1 = down

  if (value !== previous.current) {
    direction.current = value > previous.current ? 1 : -1;
    previous.current = value;
  }

  return (
    <div className="relative h-[60px] w-full flex items-center justify-center overflow-hidden">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={value}
          initial={{
            y: direction.current === 1 ? 40 : -40,
            opacity: 0,
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            textAlign: "center",
          }}
          animate={{
            y: 0,
            opacity: 1,
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            textAlign: "center",
          }}
          exit={{
            y: direction.current === 1 ? -40 : 40,
            opacity: 0,
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            textAlign: "center",
          }}
          transition={{ duration: 0.32, type: "tween", ease: [0.4, 0.7, 0.2, 1] }}
          className={`text-5xl font-extrabold mb-2 drop-shadow ${colorClass}`}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
