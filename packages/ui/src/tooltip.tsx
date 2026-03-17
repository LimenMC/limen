import { useState, useRef, useEffect, ReactNode } from 'react';

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

export function Tooltip({ content, children, position = 'top', delay = 300 }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<number>();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let x = 0;
    let y = 0;

    switch (position) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 10;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 10;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - 10;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 10;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    const padding = 8;
    x = Math.max(padding, Math.min(x, window.innerWidth - tooltipRect.width - padding));
    y = Math.max(padding, Math.min(y, window.innerHeight - tooltipRect.height - padding));

    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible]);

  const getArrowStyles = () => {
    const base = 'absolute w-2 h-2 bg-[#0a0a0a] border-[#1a1a1a] rotate-45';
    
    switch (position) {
      case 'top':
        return `${base} bottom-[-4px] left-1/2 -translate-x-1/2 border-r border-b`;
      case 'bottom':
        return `${base} top-[-4px] left-1/2 -translate-x-1/2 border-l border-t`;
      case 'left':
        return `${base} right-[-4px] top-1/2 -translate-y-1/2 border-r border-t`;
      case 'right':
        return `${base} left-[-4px] top-1/2 -translate-y-1/2 border-l border-b`;
      default:
        return base;
    }
  };

  const getAnimationClass = () => {
    switch (position) {
      case 'top':
        return isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2';
      case 'bottom':
        return isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2';
      case 'left':
        return isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2';
      case 'right':
        return isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2';
      default:
        return '';
    }
  };

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[9999] px-3 py-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] text-white text-xs font-medium whitespace-nowrap transition-all duration-150 pointer-events-none ${getAnimationClass()}`}
          style={{
            left: `${coords.x}px`,
            top: `${coords.y}px`,
          }}
        >
          {content}
          <div className={getArrowStyles()} />
        </div>
      )}
    </>
  );
}
