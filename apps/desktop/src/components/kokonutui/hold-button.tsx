import { cva, type VariantProps } from "class-variance-authority";
import { Trash2Icon, Loader2 } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const holdButtonVariants = cva(
  "relative touch-none overflow-hidden transition-all duration-300 active:scale-95",
  {
    variants: {
      variant: {
        red: "bg-[#000000] text-gray-400 hover:text-red-400 border border-[#1a1a1a] hover:border-red-600/50",
        zinc: "bg-[#000000] text-gray-400 border border-[#1a1a1a] hover:bg-[#1a1a1a] hover:text-white",
      },
      size: {
        sm: "px-3 py-2 rounded-lg text-sm font-normal",
        md: "px-6 py-3 rounded-xl text-sm font-normal",
      }
    },
    defaultVariants: {
      variant: "zinc",
      size: "md"
    },
  }
);

interface HoldButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof holdButtonVariants> {
  holdDuration?: number;
  onComplete?: () => void;
  loading?: boolean;
  iconOnly?: boolean;
}

export default function HoldButton({
  className,
  variant = "zinc",
  size = "md",
  holdDuration: propHoldDuration,
  onComplete,
  loading,
  children,
  iconOnly = false,
  ...props
}: HoldButtonProps) {
  const { t } = useTranslation();
  const [isHolding, setIsHolding] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [holdDuration, setHoldDuration] = useState(() => {
    // Load from localStorage or use prop or default
    const saved = localStorage.getItem('hold_duration');
    return propHoldDuration || (saved ? Number(saved) : 3000);
  });
  const controls = useAnimation();

  // Listen for hold duration changes from settings
  useEffect(() => {
    const handleDurationChange = (e: CustomEvent<number>) => {
      setHoldDuration(e.detail);
    };

    window.addEventListener('holdDurationChanged', handleDurationChange as EventListener);

    return () => {
      window.removeEventListener('holdDurationChanged', handleDurationChange as EventListener);
    };
  }, []);

  // Update from localStorage on mount if no prop provided
  useEffect(() => {
    if (!propHoldDuration) {
      const saved = localStorage.getItem('hold_duration');
      if (saved) {
        setHoldDuration(Number(saved));
      }
    }
  }, [propHoldDuration]);

  async function handleHoldStart() {
    if (loading || completed) return;
    setIsHolding(true);
    controls.set({ width: "0%" });
    await controls.start({
      width: "100%",
      transition: {
        duration: holdDuration / 1000,
        ease: "linear",
      },
    });

    // Hold completed
    setIsHolding(false);
    setCompleted(true);
    onComplete?.();

    // Reset after a short delay
    setTimeout(() => {
      setCompleted(false);
      controls.set({ width: "0%" });
    }, 1000);
  }

  function handleHoldEnd() {
    if (completed) return;
    setIsHolding(false);
    controls.stop();
    controls.start({
      width: "0%",
      transition: { duration: 0.2 },
    });
  }

  return (
    <button
      className={cn(holdButtonVariants({ variant, size, className }))}
      onMouseDown={handleHoldStart}
      onMouseLeave={handleHoldEnd}
      onMouseUp={handleHoldEnd}
      onTouchCancel={handleHoldEnd}
      onTouchEnd={handleHoldEnd}
      onTouchStart={handleHoldStart}
      type="button"
      {...props}
    >
      <motion.div
        animate={controls}
        className={cn("absolute top-0 left-0 h-full z-0", {
          "bg-red-600/30": variant === "red",
          "bg-[#0ea5e9]/20": variant === "zinc",
        })}
        initial={{ width: "0%" }}
      />
      <span className="relative z-10 flex items-center justify-center gap-2">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : variant === "red" ? (
          <Trash2Icon className="h-3.5 w-3.5" />
        ) : null}
        {!iconOnly && (isHolding ? t('holdButton.holding') : children)}
      </span>
    </button>
  );
}
