import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Normal, Slim } from './icons';

interface SkinModelSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel: (model: 'steve' | 'alex') => void;
}

export function SkinModelSelectorModal({ isOpen, onClose, onSelectModel }: SkinModelSelectorModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('skins.selectSkinModel')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">{t('skins.selectSkinModelDesc')}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => onSelectModel('steve')}
              className="flex flex-col items-center gap-3 p-6 bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#1f6feb] rounded-xl transition-all group shadow-inner"
            >
              <div className="w-16 h-16 bg-[#1f6feb]/10 rounded-lg flex items-center justify-center group-hover:bg-[#1f6feb]/20 transition-colors text-gray-400 group-hover:text-[#1f6feb]">
                <Normal size={40} />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">Steve</p>
                <p className="text-xs text-gray-500">{t('skins.steveDesc')}</p>
              </div>
            </button>

            <button
              onClick={() => onSelectModel('alex')}
              className="flex flex-col items-center gap-3 p-6 bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-[#1a1a1a] hover:border-[#1f6feb] rounded-xl transition-all group shadow-inner"
            >
              <div className="w-16 h-16 bg-[#1f6feb]/10 rounded-lg flex items-center justify-center group-hover:bg-[#1f6feb]/20 transition-colors text-gray-400 group-hover:text-[#1f6feb]">
                <Slim size={40} />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">Alex</p>
                <p className="text-xs text-gray-500">{t('skins.alexDesc')}</p>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] bg-[#0a0a0a]">
          <Button
            onClick={onClose}
            variant="ghost"
            className="w-full h-10 hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-xl transition-colors font-medium border border-[#1a1a1a] hover:border-[#2a2a2a]"
          >
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
