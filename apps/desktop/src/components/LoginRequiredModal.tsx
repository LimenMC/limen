import { X, User, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RainbowButton } from './ui/rainbow-button';
import { Button } from './ui/button';

interface LoginRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: () => void;
}

export function LoginRequiredModal({ isOpen, onClose, onLogin }: LoginRequiredModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertCircle size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">
                {t('loginRequired.title')}
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                {t('loginRequired.subtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-[#1f6feb]/10 rounded-full flex items-center justify-center border-4 border-[#1f6feb]/20">
              <User size={36} className="text-[#1f6feb]" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-white">
              {t('loginRequired.message')}
            </h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              {t('loginRequired.description')}
            </p>
          </div>

          {/* Features */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              {t('loginRequired.benefits')}
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 bg-[#1f6feb] rounded-full"></div>
                {t('loginRequired.benefit1')}
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 bg-[#1f6feb] rounded-full"></div>
                {t('loginRequired.benefit2')}
              </li>
              <li className="flex items-center gap-2 text-sm text-gray-300">
                <div className="w-1.5 h-1.5 bg-[#1f6feb] rounded-full"></div>
                {t('loginRequired.benefit3')}
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <RainbowButton
              onClick={onLogin}
              className="w-full h-12 rounded-xl text-white font-bold"
            >
              {t('loginRequired.loginButton')}
            </RainbowButton>
            <Button
              onClick={onClose}
              variant="ghost"
              className="w-full h-10 hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-xl transition-colors font-medium"
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
