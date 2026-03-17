import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Plus, Package, Palette, Sparkles, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GradientButton from '../components/kokonutui/gradient-button';
import HoldButton from '../components/kokonutui/hold-button';
import { Discover } from './Discover';

interface Profile {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion: string;
  icon?: string;
  lastPlayed?: Date;
}

interface InstalledMod {
  id: string;
  name: string;
  version: string;
  icon_url: string | null;
  type: 'mod' | 'resourcepack' | 'shader' | 'datapack';
}

interface ProfileDetailProps {
  profile: Profile;
  onBack: () => void;
  onLaunch: () => void;
}

const getProfileModsKey = (profileId: string) => `profile_${profileId}_mods`;

export function ProfileDetail({ profile, onBack, onLaunch }: ProfileDetailProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'mods' | 'resourcepacks' | 'shaders' | 'datapacks'>('mods');
  const [showDiscover, setShowDiscover] = useState(false);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(t('discover.sort.relevance'));

  const loadInstalledMods = useCallback(async () => {
    try {
      // First try to load from Rust backend
      const { getProfileMods } = await import('../lib/tauri-commands');
      const modsFromBackend = await getProfileMods(profile.id);
      
      if (modsFromBackend && modsFromBackend.length > 0) {
        setInstalledMods(modsFromBackend);
        return;
      }
      
      // If no mods found, try scanning the mods directory
      const { scanInstalledMods } = await import('../lib/tauri-commands');
      const scannedMods = await scanInstalledMods(profile.id);
      
      if (scannedMods && scannedMods.length > 0) {
        setInstalledMods(scannedMods);
        return;
      }
      
      // Fallback to localStorage for backward compatibility
      const saved = localStorage.getItem(getProfileModsKey(profile.id));
      if (saved) {
        const parsed = JSON.parse(saved);
        setInstalledMods(parsed);
      } else {
        setInstalledMods([]);
      }
    } catch (err) {
      console.error('Failed to load installed mods:', err);
      
      // Fallback to localStorage
      try {
        const saved = localStorage.getItem(getProfileModsKey(profile.id));
        if (saved) {
          const parsed = JSON.parse(saved);
          setInstalledMods(parsed);
        } else {
          setInstalledMods([]);
        }
      } catch (e) {
        console.error('Failed to load from localStorage:', e);
        setInstalledMods([]);
      }
    }
  }, [profile.id]);

  useEffect(() => {
    loadInstalledMods();

    const handleModsChanged = () => loadInstalledMods();
    window.addEventListener('profileModsChanged', handleModsChanged);
    
    // Poll for updates every 2 seconds while downloading
    const interval = setInterval(() => {
      loadInstalledMods();
    }, 2000);

    return () => {
      window.removeEventListener('profileModsChanged', handleModsChanged);
      clearInterval(interval);
    };
  }, [loadInstalledMods]);

  const saveInstalledMods = async (mods: InstalledMod[]) => {
    try {
      // Save to Rust backend
      const { saveProfileMods } = await import('../lib/tauri-commands');
      await saveProfileMods(profile.id, mods);
      
      // Also save to localStorage for backward compatibility
      localStorage.setItem(getProfileModsKey(profile.id), JSON.stringify(mods));
      
      window.dispatchEvent(new Event('profileModsChanged'));
    } catch (err) {
      console.error('Failed to save installed mods:', err);
      
      // Fallback to localStorage only
      try {
        localStorage.setItem(getProfileModsKey(profile.id), JSON.stringify(mods));
        window.dispatchEvent(new Event('profileModsChanged'));
      } catch (e) {
        console.error('Failed to save to localStorage:', e);
      }
    }
  };

  const addInstalledMod = (mod: { id: string; name: string; version: string; icon_url: string | null; type: string }) => {
    setInstalledMods(prevMods => {
      // Check if mod already exists
      if (prevMods.some(m => m.id === mod.id)) {
        return prevMods;
      }
      
      const installedMod: InstalledMod = {
        ...mod,
        type: mod.type as 'mod' | 'resourcepack' | 'shader' | 'datapack',
      };
      const newMods = [...prevMods, installedMod];
      
      // Save asynchronously without blocking state update
      saveInstalledMods(newMods);
      
      return newMods;
    });
  };

  const removeInstalledMod = async (modId: string) => {
    try {
      // Find the mod to get its filename
      const mod = installedMods.find(m => m.id === modId);
      if (!mod) {
        console.error('Mod not found:', modId);
        return;
      }
      
      // Call Rust command to remove both file and JSON entry
      const { removeMod } = await import('../lib/tauri-commands');
      await removeMod(profile.id, modId, mod.version);
      
      // Update local state
      const newMods = installedMods.filter(m => m.id !== modId);
      setInstalledMods(newMods);
      
      // Also update localStorage for backward compatibility
      localStorage.setItem(getProfileModsKey(profile.id), JSON.stringify(newMods));
      
      window.dispatchEvent(new Event('profileModsChanged'));
    } catch (err) {
      console.error('Failed to remove mod:', err);
      
      // Fallback to old behavior (only remove from state)
      const newMods = installedMods.filter(m => m.id !== modId);
      saveInstalledMods(newMods);
    }
  };

  const TABS = [
    { id: 'mods', name: t('profileDetail.tabs.mods'), icon: Package, type: 'mod' },
    { id: 'resourcepacks', name: t('profileDetail.tabs.resourcePacks'), icon: Palette, type: 'resourcepack' },
    { id: 'shaders', name: t('profileDetail.tabs.shaders'), icon: Sparkles, type: 'shader' },
    { id: 'datapacks', name: t('profileDetail.tabs.dataPacks'), icon: FileText, type: 'datapack' },
  ];

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

  const filteredMods = useMemo(() => {
    const typeMap: { [key: string]: string } = {
      'mods': 'mod',
      'resourcepacks': 'resourcepack',
      'shaders': 'shader',
      'datapacks': 'datapack',
    };
    return installedMods.filter(mod => mod.type === typeMap[activeTab]);
  }, [installedMods, activeTab]);

  if (showDiscover) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] bg-[#000000]">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={() => setShowDiscover(false)}
                className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('profileDetail.searchPlaceholder', { type: TABS.find(t => t.id === activeTab)?.name.toLowerCase() })}
                    className="w-full pl-4 pr-4 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#1f6feb] transition-colors text-sm"
                  />
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-400">
              {profile.name} • {profile.version} • {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)}
            </div>
          </div>
        </div>

        {/* Filtered Discover */}
        <Discover
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortBy={sortBy}
          onSortChange={setSortBy}
          profileFilter={{
            gameVersion: profile.version,
            loader: activeTab === 'mods' ? profile.loader : undefined,
            projectType: TABS.find(t => t.id === activeTab)?.type || 'mod',
          }}
          profileId={profile.id}
          installedModIds={installedMods.map(m => m.id)}
          onModInstalled={addInstalledMod}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1a1a1a] bg-[#000000]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-14 h-14 bg-[#000000] border border-[#1a1a1a] rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-inner">
              {profile.icon ? (
                <img src={profile.icon} alt={profile.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
              ) : (
                <span className="text-white text-2xl font-black opacity-90">
                  {profile.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">{profile.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-400">Minecraft {profile.version}</span>
                {profile.loader !== 'vanilla' && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${getLoaderColor(profile.loader)} text-white font-medium`}>
                      {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)} {profile.loaderVersion}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <GradientButton
            onClick={onLaunch}
            label={t('home.playNow')}
            variant="emerald"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-[#1a1a1a] bg-[#000000]">
        <div className="flex items-center gap-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === tab.id
                  ? 'bg-[#1f6feb] text-white'
                  : 'bg-[#0a0a0a] text-gray-400 hover:text-white hover:bg-[#1a1a1a] border border-[#1a1a1a]'
                  }`}
              >
                <Icon size={16} />
                {tab.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredMods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-20 h-20 bg-[#0a0a0a] rounded-full flex items-center justify-center mb-4">
              {(() => {
                const Icon = TABS.find(t => t.id === activeTab)?.icon || Package;
                return <Icon size={32} className="text-gray-600" />;
              })()}
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              {t('profileDetail.noInstalled', { type: TABS.find(t => t.id === activeTab)?.name })}
            </h3>
            <p className="text-gray-400 text-sm mb-6">
              {t('profileDetail.addToEnhance', { type: TABS.find(t => t.id === activeTab)?.name.toLowerCase() })}
            </p>
            <button
              onClick={() => setShowDiscover(true)}
              className="px-6 py-3 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              {t('profileDetail.browse', { type: TABS.find(t => t.id === activeTab)?.name })}
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {t('profileDetail.installed', { type: TABS.find(t => t.id === activeTab)?.name, count: filteredMods.length })}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadInstalledMods}
                  className="px-4 py-2 bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-[#1a1a1a] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
                  </svg>
                  {t('common.refresh')}
                </button>
                <button
                  onClick={() => setShowDiscover(true)}
                  className="px-4 py-2 bg-[#1f6feb] hover:bg-[#388bfd] text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Plus size={16} />
                  {t('profileDetail.addMore')}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMods.map((mod) => (
                <div
                  key={mod.id}
                  className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl overflow-hidden hover:border-[#1f6feb] transition-all group relative"
                >
                  <div className="absolute top-3 right-3 z-10">
                    <HoldButton
                      variant="red"
                      size="sm"
                      className="!p-2"
                      onComplete={() => removeInstalledMod(mod.id)}
                      iconOnly
                    >
                      <span className="sr-only">{t('profileDetail.remove')}</span>
                    </HoldButton>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-16 h-16 bg-black rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={mod.icon_url || `https://via.placeholder.com/64x64/0ea5e9/ffffff?text=${mod.name.charAt(0)}`}
                          alt={mod.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://via.placeholder.com/64x64/0ea5e9/ffffff?text=${mod.name.charAt(0)}`;
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <h3 className="text-white font-semibold text-base truncate group-hover:text-[#1f6feb] transition-colors mb-1">
                          {mod.name}
                        </h3>
                        <p className="text-xs text-gray-500">{mod.version}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
