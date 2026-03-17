import { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { RainbowButton } from './ui/rainbow-button';

interface Profile {
  id: string;
  name: string;
  version: string;
  loader: string;
  icon?: string;
}

interface SelectProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProfile: (profileId: string) => void;
  onCreateNew: () => void;
  compatibleProfiles: Profile[];
  modName: string;
  modType: string;
}

export function SelectProfileModal({
  isOpen,
  onClose,
  onSelectProfile,
  onCreateNew,
  compatibleProfiles,
  modName,
  modType,
}: SelectProfileModalProps) {
  const { t } = useTranslation();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const getLoaderColor = (loader: string) => {
    const colors: { [key: string]: string } = {
      'vanilla': 'bg-gray-600',
      'fabric': 'bg-amber-600',
      'forge': 'bg-blue-600',
      'neoforge': 'bg-orange-600',
      'quilt': 'bg-purple-600',
    };
    return colors[loader] || 'bg-gray-600';
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      'mod': t('discover.filters.mods'),
      'shader': t('discover.filters.shaders'),
      'resourcepack': t('discover.filters.resourcePacks'),
      'datapack': t('discover.filters.dataPacks'),
    };
    return labels[type] || type;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('profile.selectProfile')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              {t('profile.selectProfileDesc', { name: modName, type: getTypeLabel(modType) })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {compatibleProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-16 h-16 bg-[#1f6feb]/10 rounded-full flex items-center justify-center mb-4">
                <Plus size={32} className="text-[#1f6feb]" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                {t('profile.noCompatibleProfiles')}
              </h3>
              <p className="text-sm text-gray-400 text-center mb-6 max-w-md">
                {t('profile.noCompatibleProfilesDesc', { type: getTypeLabel(modType) })}
              </p>
              <RainbowButton
                onClick={() => {
                  onCreateNew();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl text-white font-bold"
              >
                <Plus size={18} className="mr-2" />
                {t('profile.createNewProfile')}
              </RainbowButton>
            </div>
          ) : (
            <div className="space-y-3">
              {compatibleProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all border ${
                    selectedProfileId === profile.id
                      ? 'bg-[#1f6feb]/10 border-[#1f6feb]/50 shadow-lg'
                      : 'bg-[#0a0a0a] border-[#1a1a1a] hover:border-[#1f6feb]/30 hover:bg-[#1a1a1a]'
                  }`}
                >
                  {/* Profile Icon */}
                  <div className="w-14 h-14 bg-[#000000] border border-[#1a1a1a] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
                    {profile.icon ? (
                      <img src={profile.icon} alt={profile.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <span className="text-white text-xl font-black opacity-90">
                        {profile.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Profile Info */}
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-bold text-base mb-1">{profile.name}</h3>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">Minecraft {profile.version}</span>
                      {profile.loader !== 'vanilla' && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${getLoaderColor(profile.loader)} text-white font-medium`}>
                            {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Check Icon */}
                  {selectedProfileId === profile.id && (
                    <div className="w-6 h-6 bg-[#1f6feb] rounded-full flex items-center justify-center flex-shrink-0">
                      <Check size={16} className="text-white" />
                    </div>
                  )}
                </button>
              ))}

              {/* Create New Profile Option */}
              <button
                onClick={() => {
                  onCreateNew();
                  onClose();
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl transition-all border border-dashed border-[#1a1a1a] hover:border-[#1f6feb] bg-[#0a0a0a] hover:bg-[#1a1a1a] group"
              >
                <div className="w-14 h-14 bg-[#1f6feb]/10 border border-[#1f6feb]/30 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-[#1f6feb]/20 transition-colors">
                  <Plus size={24} className="text-[#1f6feb]" />
                </div>
                <div className="flex-1 text-left">
                  <h3 className="text-white font-bold text-base mb-1">{t('profile.createNewProfile')}</h3>
                  <p className="text-xs text-gray-400">{t('profile.createNewProfileDesc')}</p>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {compatibleProfiles.length > 0 && (
          <div className="px-6 py-4 border-t border-[#1a1a1a] flex items-center gap-3 bg-[#0a0a0a]">
            <Button
              onClick={onClose}
              variant="ghost"
              className="flex-1 h-10 hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-xl transition-colors font-medium"
            >
              {t('common.cancel')}
            </Button>
            <RainbowButton
              onClick={() => {
                if (selectedProfileId) {
                  onSelectProfile(selectedProfileId);
                  onClose();
                }
              }}
              disabled={!selectedProfileId}
              className="flex-1 h-10 rounded-xl text-white font-bold"
            >
              {t('profile.installToProfile')}
            </RainbowButton>
          </div>
        )}
      </div>
    </div>
  );
}
