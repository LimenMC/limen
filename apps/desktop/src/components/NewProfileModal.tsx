import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { RainbowButton } from './ui/rainbow-button';
import {
  getMinecraftVersions,
  getFabricVersionsForGame,
  getQuiltVersionsForGame,
  getForgeVersions,
  getNeoforgeVersions
} from '../lib/tauri-commands';
import type { LoaderInfo } from '../types/tauri';

interface NewProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, version: string, loader: string, loaderVersion: string, icon?: string) => void;
  downloadProgress?: string;
}

export function NewProfileModal({ isOpen, onClose, onCreate, downloadProgress }: NewProfileModalProps) {
  const { t } = useTranslation();
  const [profileName, setProfileName] = useState('');
  const [profileIcon, setProfileIcon] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  // Set default to fabric as requested by many modern users, or vanilla
  const [selectedLoader, setSelectedLoader] = useState<'vanilla' | 'fabric' | 'forge' | 'neoforge' | 'quilt'>('vanilla');
  const [selectedLoaderVersion, setSelectedLoaderVersion] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [loaderVersions, setLoaderVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingLoaders, setLoadingLoaders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const LOADERS = [
    { id: 'vanilla', name: 'Vanilla', hover: 'hover:border-gray-500 hover:bg-gray-500/5', active: 'bg-gray-500/10 border-gray-500/50 text-gray-300', text: 'text-gray-400' },
    { id: 'fabric', name: 'Fabric', hover: 'hover:border-amber-500 hover:bg-amber-500/5', active: 'bg-amber-500/10 border-amber-500/50 text-amber-400', text: 'text-amber-500/70' },
    { id: 'quilt', name: 'Quilt', hover: 'hover:border-purple-500 hover:bg-purple-500/5', active: 'bg-purple-500/10 border-purple-500/50 text-purple-400', text: 'text-purple-500/70' },
    { id: 'forge', name: 'Forge', hover: 'hover:border-blue-500 hover:bg-blue-500/5', active: 'bg-blue-500/10 border-blue-500/50 text-blue-400', text: 'text-blue-500/70' },
    { id: 'neoforge', name: 'NeoForge', hover: 'hover:border-orange-500 hover:bg-orange-500/5', active: 'bg-orange-500/10 border-orange-500/50 text-orange-400', text: 'text-orange-500/70' },
  ];

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedVersion && selectedLoader !== 'vanilla') {
      loadLoaderVersions();
    } else {
      setLoaderVersions([]);
      setSelectedLoaderVersion('');
    }
  }, [selectedVersion, selectedLoader]);

  const loadVersions = async () => {
    try {
      setLoading(true);
      const allVersions = await getMinecraftVersions();

      // Filter only release versions
      const releaseVersions = allVersions.filter(version => {
        return /^\d+\.\d+(\.\d+)?$/.test(version);
      });

      setVersions(releaseVersions);
      if (releaseVersions.length > 0) {
        setSelectedVersion(releaseVersions[0]);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadLoaderVersions = async () => {
    try {
      setLoadingLoaders(true);
      setLoaderVersions([]);
      setSelectedLoaderVersion('');

      let versions: string[] = [];

      switch (selectedLoader) {
        case 'fabric': {
          const fabricVersions = await getFabricVersionsForGame(selectedVersion);
          versions = fabricVersions.map((v: LoaderInfo) => v.loader.version);
          break;
        }
        case 'quilt': {
          const quiltVersions = await getQuiltVersionsForGame(selectedVersion);
          versions = quiltVersions.map((v: LoaderInfo) => v.loader.version).reverse(); // Latest first
          break;
        }
        case 'forge': {
          // Forge API now requires game version parameter
          const forgeVersions = await getForgeVersions(selectedVersion);
          versions = forgeVersions.reverse(); // Latest first
          break;
        }
        case 'neoforge': {
          // NeoForge versions are filtered by MC version on the frontend
          const neoforgeVersions = await getNeoforgeVersions();
          // NeoForge version format: "21.1.77" where 21.1 = MC 1.21.1
          // MC 1.21.1 → NeoForge 21.1.x
          // MC 1.20.1 → NeoForge 20.1.x
          const mcParts = selectedVersion.split('.');
          if (mcParts.length >= 2) {
            // MC 1.21.1 → "21.1"
            const mcMajor = mcParts[1]; // "21"
            const mcMinor = mcParts[2] || '0'; // "1"
            const targetPrefix = `${mcMajor}.${mcMinor}`;

            versions = neoforgeVersions
              .filter(v => {
                // NeoForge 21.1.77 → check if starts with "21.1"
                return v.startsWith(targetPrefix + '.');
              })
              .reverse(); // Latest first
          } else {
            versions = neoforgeVersions.reverse();
          }
          break;
        }
      }

      setLoaderVersions(versions);
      if (versions.length > 0) {
        setSelectedLoaderVersion(versions[0]);
      }
    } catch (err) {
      console.error('Failed to load loader versions:', err);
    } finally {
      setLoadingLoaders(false);
    }
  };

  const handleCreate = () => {
    if (!profileName.trim() || !selectedVersion) return;
    if (selectedLoader !== 'vanilla' && !selectedLoaderVersion) return;

    onCreate(
      profileName.trim(),
      selectedVersion,
      selectedLoader,
      selectedLoaderVersion || '',
      profileIcon || undefined
    );

    setProfileName('');
    setProfileIcon('');
    setSearchQuery('');
    setSelectedLoader('vanilla');
    setSelectedLoaderVersion('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredVersions = versions.filter(version =>
    version.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('profile.create')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">Create a new customizable game profile</p>
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
          <div className="space-y-4">

            {/* Profile Icon & Name */}
            <div className="flex gap-4 items-start bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-4 shadow-inner">
              {/* Profile Icon */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div className="relative group">
                  <div className="w-16 h-16 rounded-xl bg-[#000000] border border-[#2a2a2a] overflow-hidden flex items-center justify-center transition-all group-hover:border-[#1f6feb] shadow-lg">
                    {profileIcon ? (
                      <img src={profileIcon} alt="Profile" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <ImageIcon size={24} className="text-[#333]" />
                    )}
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-[#1f6feb]/20 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center border border-[#1f6feb]/50"
                  >
                    <Upload size={20} className="text-white drop-shadow-md" />
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
              <div className="flex-1 mt-1">
                <label className="text-sm text-gray-400 mb-2 block font-medium">
                  {t('profile.name')}
                </label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder={t('profile.namePlaceholder')}
                  className="w-full px-4 py-2.5 bg-[#000000] border border-[#222] rounded-xl text-white placeholder-gray-600 focus:outline-none focus:border-[#1f6feb] transition-all text-base font-medium shadow-inner"
                />
              </div>
            </div>

            {/* Mod Loader Selection */}
            <div>
              <label className="text-sm text-gray-400 mb-2 block font-medium">
                {t('profile.modLoader')}
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {LOADERS.map((loader) => (
                  <button
                    key={loader.id}
                    onClick={() => setSelectedLoader(loader.id as any)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border shadow-sm ${selectedLoader === loader.id
                      ? loader.active.replace('text-', 'text-white border-') // make text white, use color for border
                      : `bg-[#0a0a0a] border-[#1a1a1a] ${loader.text} ${loader.hover}`
                      }`}
                  >
                    {loader.name}
                  </button>
                ))}
              </div>
            </div>

            <div className={`grid grid-cols-1 ${selectedLoader !== 'vanilla' ? 'md:grid-cols-2' : ''} gap-4 min-h-[220px]`}>

              {/* Minecraft Version */}
              <div className="flex flex-col">
                <label className="text-sm text-gray-400 mb-2 block font-medium">
                  {t('profile.version')}
                </label>

                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl flex flex-col flex-1 overflow-hidden transition-all focus-within:border-[#1f6feb] shadow-inner">
                  <div className="px-4 py-3 border-b border-[#1a1a1a] bg-[#000000]">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('profile.searchVersions')}
                      className="w-full bg-transparent text-sm text-white placeholder-gray-600 font-medium focus:outline-none"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[180px]">
                    {loading ? (
                      <div className="flex items-center justify-center h-full min-h-[100px]">
                        <Loader2 className="text-[#1f6feb] animate-spin" size={24} />
                      </div>
                    ) : filteredVersions.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 text-sm">
                        {t('profile.noVersions')}
                      </div>
                    ) : (
                      <div className="p-2 space-y-1">
                        {filteredVersions.map((version) => (
                          <button
                            key={version}
                            onClick={() => setSelectedVersion(version)}
                            className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all font-medium ${selectedVersion === version
                              ? 'bg-[#1f6feb]/15 text-[#1f6feb] shadow-sm border border-[#1f6feb]/30'
                              : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-transparent'
                              }`}
                          >
                            {version}
                            {version === versions[0] && (
                              <span className="ml-2 text-xs opacity-70 border border-current px-1.5 py-0.5 rounded-full">
                                {t('profile.latest')}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Loader Version */}
              {selectedLoader !== 'vanilla' && (
                <div className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-2 block font-medium flex items-center gap-2">
                    {t('profile.loaderVersion', { loader: selectedLoader.charAt(0).toUpperCase() + selectedLoader.slice(1) })}
                  </label>

                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl flex flex-col flex-1 overflow-hidden shadow-inner pt-2">
                    <div className="flex-1 overflow-y-auto max-h-[212px]">
                      {loadingLoaders ? (
                        <div className="flex items-center justify-center h-full min-h-[100px]">
                          <Loader2 className="text-[#1f6feb] animate-spin" size={24} />
                        </div>
                      ) : loaderVersions.length === 0 ? (
                        <div className="flex items-center justify-center p-6 h-full text-center text-gray-500 text-sm">
                          {t('profile.noLoaderVersions')}
                        </div>
                      ) : (
                        <div className="p-2 space-y-1">
                          {loaderVersions.map((version) => (
                            <button
                              key={version}
                              onClick={() => setSelectedLoaderVersion(version)}
                              className={`w-full px-4 py-2.5 text-left text-sm rounded-lg transition-all font-medium border ${selectedLoaderVersion === version
                                ? 'bg-[#1f6feb]/15 text-[#1f6feb] shadow-sm border-[#1f6feb]/30'
                                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a] border-transparent'
                                }`}
                            >
                              {version}
                              {version === loaderVersions[0] && (
                                <span className="ml-2 text-xs opacity-70 border border-current px-1.5 py-0.5 rounded-full">
                                  {t('profile.latest')}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1a1a1a] flex flex-col gap-3 bg-[#0a0a0a]">
          {downloadProgress && (
            <div className="px-4 py-3 bg-[#1f6feb]/10 border border-[#1f6feb]/30 rounded-xl">
              <p className="text-sm text-[#1f6feb] font-medium text-center">
                {downloadProgress}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                onClose();
                setProfileName('');
                setProfileIcon('');
                setSearchQuery('');
                setSelectedLoader('vanilla');
                setSelectedLoaderVersion('');
              }}
              variant="ghost"
              className="flex-1 h-10 hover:bg-[#1a1a1a] text-gray-400 hover:text-white rounded-xl transition-colors font-medium"
            >
              {t('common.cancel')}
            </Button>
            <RainbowButton
              onClick={handleCreate}
              disabled={!profileName.trim() || !selectedVersion || (selectedLoader !== 'vanilla' && !selectedLoaderVersion)}
              className="flex-1 h-10 rounded-xl text-white font-bold"
            >
              {t('profile.createProfile')}
            </RainbowButton>
          </div>
        </div>

      </div>
    </div>
  );
}
