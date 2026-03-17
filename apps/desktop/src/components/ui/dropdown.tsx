import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface DropdownProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  minWidth?: string;
}

export function Dropdown({ label, value, options, onChange, minWidth = '160px' }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`px-3 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] text-white text-sm hover:border-[#1f6feb] transition-all duration-200 flex items-center gap-2 justify-between ${
          isOpen ? 'rounded-t-lg border-b-0 border-[#1f6feb]' : 'rounded-lg'
        }`}
        style={{ minWidth }}
      >
        <span className="text-gray-400">{label}:</span>
        <span className="flex items-center gap-1.5">
          {value}
          <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>
      
      <div 
        className={`absolute top-full left-0 right-0 bg-[#0a0a0a] border border-[#1a1a1a] border-t-0 rounded-b-lg shadow-xl z-50 overflow-hidden transition-all duration-200 origin-top ${
          isOpen 
            ? 'opacity-100 scale-y-100 translate-y-0' 
            : 'opacity-0 scale-y-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {options.map((option, index) => (
          <button
            key={option}
            onClick={() => {
              onChange(option);
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-sm transition-all duration-150 ${
              value === option
                ? 'bg-[#1f6feb] text-white'
                : 'text-gray-300 hover:bg-[#1a1a1a] hover:text-white'
            }`}
            style={{
              transitionDelay: isOpen ? `${index * 30}ms` : '0ms'
            }}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
