import { useState, useEffect, useRef } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { RainbowButton } from './ui/rainbow-button';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: {
    id: string;
    name: string;
    icon?: string;
  };
  onSave: (id: string, name: string, icon?: string) => void;
}

export function EditProfileModal({ isOpen, onClose, profile, onSave }: EditProfileModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.name);
  const [icon, setIcon] = useState(profile.icon || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(profile.name);
      setIcon(profile.icon || '');
    }
  }, [isOpen, profile]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if (name.trim()) {
      onSave(profile.id, name.trim(), icon);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('profile.edit')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">Update your profile settings</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Profile Icon */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-20 h-20 rounded-2xl bg-[#000000] border border-[#2a2a2a] overflow-hidden flex items-center justify-center transition-all group-hover:border-[#1f6feb] shadow-lg">
                {icon ? (
                  <img src={icon} alt="Profile" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                ) : (
                  <ImageIcon size={32} className="text-[#333]" />
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-[#1f6feb]/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center border border-[#1f6feb]/50"
              >
                <Upload size={24} className="text-white drop-shadow-md" />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">{t('profile.uploadIcon')}</p>
          </div>

          {/* Profile Name */}
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 shadow-inner">
            <label className="text-sm text-gray-400 mb-2 block font-medium">
              {t('profile.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('profile.namePlaceholder')}
              className="w-full px-4 py-2.5 bg-[#000000] border border-[#222] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#1f6feb] transition-all text-base font-medium shadow-inner"
              autoFocus
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] flex items-center gap-4 bg-[#0a0a0a]">
          <Button
            onClick={onClose}
            variant="ghost"
            className="flex-1 h-10 hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-xl transition-colors font-medium border border-[#1a1a1a] hover:border-[#2a2a2a]"
          >
            {t('common.cancel')}
          </Button>
          <RainbowButton
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 h-10 rounded-xl text-white font-bold text-sm"
          >
            {t('common.save')}
          </RainbowButton>
        </div>
      </div>
    </div>
  );
}
