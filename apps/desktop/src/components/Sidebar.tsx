import { Home, Compass, Shirt, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Tooltip } from './ui/tooltip';
import { Archive } from './icons/Archive';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activeTab, onTabChange, onOpenSettings }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-[72px] flex flex-col items-center py-4 gap-3 bg-black">
      <div className="flex-1 flex flex-col gap-2">
        <Tooltip content={t('nav.home')} position="right">
          <button
            onClick={() => onTabChange('home')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === 'home'
                ? 'bg-[#1f6feb] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Home size={20} />
          </button>
        </Tooltip>

        <Tooltip content={t('nav.discover')} position="right">
          <button
            onClick={() => onTabChange('discover')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === 'discover'
                ? 'bg-[#1f6feb] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Compass size={20} />
          </button>
        </Tooltip>

        <Tooltip content={t('nav.archive')} position="right">
          <button
            onClick={() => onTabChange('archive')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === 'archive'
                ? 'bg-[#1f6feb] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Archive size={20} />
          </button>
        </Tooltip>

        <Tooltip content={t('nav.skins')} position="right">
          <button
            onClick={() => onTabChange('skins')}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              activeTab === 'skins'
                ? 'bg-[#1f6feb] text-white'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <Shirt size={20} />
          </button>
        </Tooltip>
      </div>

      <Tooltip content={t('nav.settings')} position="right">
        <button
          onClick={onOpenSettings}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors text-gray-400 hover:text-white hover:bg-[#1a1a1a]"
        >
          <Settings size={20} />
        </button>
      </Tooltip>
    </aside>
  );
}
