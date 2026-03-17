import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCategory: string | null;
  onCategoryChange: (category: string | null) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
}

export function FilterModal({
  isOpen,
  onClose,
  selectedCategory,
  onCategoryChange,
  sortBy,
  onSortChange,
}: FilterModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const MOD_CATEGORIES = [
    { key: 'adventure', name: t('discover.modCategories.adventure'), icon: '/category/adventure.svg' },
    { key: 'cursed', name: t('discover.modCategories.cursed'), icon: '/category/ghost.svg' },
    { key: 'decoration', name: t('discover.modCategories.decoration'), icon: '/category/deco.svg' },
    { key: 'economy', name: t('discover.modCategories.economy'), icon: '/category/eco.svg' },
    { key: 'equipment', name: t('discover.modCategories.equipment'), icon: '/category/equiq.svg' },
    { key: 'food', name: t('discover.modCategories.food'), icon: '/category/food.svg' },
    { key: 'gameMechanics', name: t('discover.modCategories.gameMechanics'), icon: '/category/mechanic.svg' },
    { key: 'library', name: t('discover.modCategories.library'), icon: '/category/lib.svg' },
    { key: 'magic', name: t('discover.modCategories.magic'), icon: '/category/magic.svg' },
    { key: 'management', name: t('discover.modCategories.management'), icon: '/category/manage.svg' },
    { key: 'minigame', name: t('discover.modCategories.minigame'), icon: '/category/game.svg' },
    { key: 'mobs', name: t('discover.modCategories.mobs'), icon: '/category/monster.svg' },
    { key: 'optimization', name: t('discover.modCategories.optimization'), icon: '/category/opti.svg' },
    { key: 'social', name: t('discover.modCategories.social'), icon: '/category/socia.svg' },
    { key: 'storage', name: t('discover.modCategories.storage'), icon: '/category/storage.svg' },
    { key: 'technology', name: t('discover.modCategories.technology'), icon: '/category/tech.svg' },
    { key: 'transportation', name: t('discover.modCategories.transportation'), icon: '/category/vehicle.svg' },
    { key: 'utility', name: t('discover.modCategories.utility'), icon: '/category/bus.svg' },
    { key: 'worldgen', name: t('discover.modCategories.worldgen'), icon: '/category/world.svg' },
  ];

  const SORT_OPTIONS = [
    { key: 'relevance', name: t('discover.sort.relevance') },
    { key: 'downloads', name: t('discover.sort.downloads') },
    { key: 'updated', name: t('discover.sort.updated') },
    { key: 'newest', name: t('discover.sort.newest') },
  ];

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('discover.filtersButton')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">Filter and sort your search results</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          
          {/* Sort By Section */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">{t('discover.sortBy')}</h3>
            <div className="grid grid-cols-2 gap-3">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  onClick={() => onSortChange(option.name)}
                  className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] ${
                    sortBy === option.name
                      ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                      : 'border-[#1a1a1a] hover:border-gray-600'
                  }`}
                >
                  <div className="font-bold text-white text-sm">{option.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Categories Section */}
          <div>
            <h3 className="text-sm font-bold text-white mb-3">{t('discover.categories')}</h3>
            
            {/* All Categories Button */}
            <button
              onClick={() => onCategoryChange(null)}
              className={`w-full mb-3 p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] flex items-center gap-3 ${
                selectedCategory === null
                  ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                  : 'border-[#1a1a1a] hover:border-gray-600'
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              <div className="font-bold text-white text-sm">{t('discover.allCategories')}</div>
            </button>

            {/* Category Grid */}
            <div className="grid grid-cols-2 gap-3">
              {MOD_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => onCategoryChange(cat.key)}
                  className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] flex items-center gap-3 ${
                    selectedCategory === cat.key
                      ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                      : 'border-[#1a1a1a] hover:border-gray-600'
                  }`}
                >
                  <img 
                    src={cat.icon} 
                    alt={cat.name}
                    className="w-5 h-5 flex-shrink-0 opacity-70"
                  />
                  <div className="font-bold text-white text-sm">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <Button
            onClick={onClose}
            className="w-full h-10 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-xl transition-colors font-bold"
          >
            {t('common.apply')}
          </Button>
        </div>
      </div>
    </div>
  );
}
