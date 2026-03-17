import * as React from "react"
import { cn } from "@limen/utils"

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: number
  onValueChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const percentage = ((value - min) / (max - min)) * 100

    return (
      <div className="relative w-full">
        <input
          type="range"
          ref={ref}
          value={value}
          onChange={(e) => onValueChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step}
          className={cn(
            "w-full h-2 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer",
            "focus:outline-none focus:ring-2 focus:ring-[#1f6feb] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white",
            "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1f6feb]",
            "[&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg",
            "[&::-webkit-slider-thumb]:transition-all [&::-webkit-slider-thumb]:hover:scale-110",
            "[&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#1f6feb]",
            "[&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg",
            "[&::-moz-range-thumb]:transition-all [&::-moz-range-thumb]:hover:scale-110",
            className
          )}
          style={{
            background: `linear-gradient(to right, #1f6feb 0%, #1f6feb ${percentage}%, #1a1a1a ${percentage}%, #1a1a1a 100%)`
          }}
          {...props}
        />
      </div>
    )
  }
)

Slider.displayName = "Slider"

export { Slider }
