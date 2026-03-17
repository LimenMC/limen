import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/tooltip';
import { Window } from '@tauri-apps/api/window';

interface TitleBarProps {
  activeTab: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function TitleBar({ activeTab, searchQuery, onSearchChange }: TitleBarProps) {
  const { t } = useTranslation();
  const appWindow = Window.getCurrent();

  return (
    <div data-tauri-drag-region className="h-16 flex items-center justify-between px-5 select-none bg-black">
      <div data-tauri-drag-region className="flex items-center gap-4 flex-1">
        <div data-tauri-drag-region className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Limen Logo"
            className="w-7 h-7 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = 'flex';
            }}
          />
          <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg items-center justify-center hidden">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <span className="font-semibold text-base">Limen</span>
        </div>

        {activeTab === 'discover' ? (
          <div data-tauri-drag-region className="flex items-center justify-center flex-1 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('discover.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-1.5 bg-[#000000] border border-[#1a1a1a] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#1f6feb] transition-colors text-sm"
              />
            </div>
          </div>
        ) : (
          <div data-tauri-drag-region className="flex-1" />
        )}
      </div>

      <div className="flex items-center gap-1 ml-4">
        <Tooltip content={t('window.minimize')} position="bottom">
          <button
            onClick={() => appWindow.minimize()}
            className="p-2.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors flex items-center justify-center"
          >
            <img src="/title-bar/minimize.svg" alt="Minimize" className="w-[18px] h-[18px] -translate-y-1" />
          </button>
        </Tooltip>

        <Tooltip content={t('window.maximize')} position="bottom">
          <button
            onClick={() => appWindow.toggleMaximize()}
            className="p-2.5 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
          >
            <img src="/title-bar/expand.svg" alt="Maximize" className="w-4 h-4" />
          </button>
        </Tooltip>

        <Tooltip content={t('window.close')} position="bottom">
          <button
            onClick={() => appWindow.close()}
            className="p-2.5 rounded-lg hover:bg-red-600 text-gray-400 hover:text-white transition-colors"
          >
            <img src="/title-bar/close.svg" alt="Close" className="w-[18px] h-[18px]" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
