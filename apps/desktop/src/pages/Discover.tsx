import { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { searchMods } from '../lib/tauri-commands';
import type { UnifiedMod } from '../types/tauri';
import { ModDetail } from './ModDetail';
import { FilterModal } from '../components/FilterModal';
import { SelectProfileModal } from '../components/SelectProfileModal';
import { Filter } from '../components/icons';
import { StatusNotification } from '../components/StatusNotification';

interface DiscoverProps {
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  sortBy: string;
  onSortChange: (sort: string) => void;
  profileFilter?: {
    gameVersion: string;
    loader?: string;
    projectType: string;
  };
  profileId?: string;
  installedModIds?: string[];
  onModInstalled?: (mod: { id: string; name: string; version: string; icon_url: string | null; type: string }) => void;
}

export function Discover({ searchQuery, sortBy, onSortChange, profileFilter, profileId, installedModIds = [], onModInstalled }: DiscoverProps) {
  const { t } = useTranslation();
  const [items, setItems] = useState<UnifiedMod[]>([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState(profileFilter?.projectType || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedMod, setSelectedMod] = useState<UnifiedMod | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [installingMods, setInstallingMods] = useState<Map<string, { name: string; progress: string }>>(new Map());
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isSelectProfileModalOpen, setIsSelectProfileModalOpen] = useState(false);
  const [selectedModForInstall, setSelectedModForInstall] = useState<UnifiedMod | null>(null);
  const [compatibleProfiles, setCompatibleProfiles] = useState<any[]>([]);
  const activeDownloadsRef = useRef(0);
  const MAX_CONCURRENT_DOWNLOADS = 3;
  const itemsPerPage = 15;

  const CATEGORIES = [
    { id: 'all', name: t('discover.filters.all'), type: 'all' },
    { id: 'mods', name: t('discover.filters.mods'), type: 'mod' },
    { id: 'modpacks', name: t('discover.filters.modpacks'), type: 'modpack' },
    { id: 'servers', name: t('discover.filters.servers'), type: 'servers' },
    { id: 'shaders', name: t('discover.filters.shaders'), type: 'shader' },
    { id: 'resourcepacks', name: t('discover.filters.resourcePacks'), type: 'resourcepack' },
    { id: 'datapacks', name: t('discover.filters.dataPacks'), type: 'datapack' },
  ];

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

  useEffect(() => {
    let cancelled = false;

    const performSearch = async () => {
      try {
        setLoading(true);
        setNotification(null);

        const typeMapping: { [key: string]: string } = {
          'all': 'all', 'mods': 'mod', 'mod': 'mod', 'modpacks': 'modpack',
          'modpack': 'modpack', 'servers': 'minecraft_java_server', 'server': 'minecraft_java_server',
          'shaders': 'shader', 'shader': 'shader',
          'resourcepacks': 'resourcepack', 'resourcepack': 'resourcepack',
          'datapacks': 'datapack', 'datapack': 'datapack',
        };

        const projectType = typeMapping[selectedType] || 'all';

        const sortMapping: { [key: string]: string } = {
          [t('discover.sort.relevance')]: 'relevance',
          [t('discover.sort.downloads')]: 'downloads',
          [t('discover.sort.updated')]: 'updated',
          [t('discover.sort.newest')]: 'newest',
          'Relevance': 'relevance',
          'Downloads': 'downloads',
          'Updated': 'updated',
          'Newest': 'newest',
        };

        const index = sortMapping[sortBy] || 'relevance';
        const query = searchQuery || '';
        const offset = (currentPage - 1) * itemsPerPage;

        const facets_array: string[][] = [];

        if (projectType !== 'all') {
          facets_array.push([`project_type:${projectType}`]);
        }

        if (selectedCategory) {
          facets_array.push([`categories:${selectedCategory}`]);
        }

        if (profileFilter?.gameVersion) {
          facets_array.push([`versions:${profileFilter.gameVersion}`]);
        }

        if (profileFilter?.loader) {
          facets_array.push([`categories:${profileFilter.loader}`]);
        }

        const results = await searchMods({
          query,
          source: 'modrinth',
          facets: facets_array.length > 0 ? JSON.stringify(facets_array) : undefined,
          index,
          limit: itemsPerPage,
          offset,
        });

        if (!cancelled) {
          setItems(results);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Search error:', err);
          setNotification(t('discover.failedToSearch'));
          setTimeout(() => setNotification(null), 5000);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    if (searchQuery) {
      const timeoutId = setTimeout(performSearch, 300);
      return () => { cancelled = true; clearTimeout(timeoutId); };
    } else {
      performSearch();
      return () => { cancelled = true; };
    }
  }, [searchQuery, selectedType, selectedCategory, sortBy, profileFilter, currentPage, itemsPerPage, t]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType, selectedCategory, sortBy, profileFilter]);

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) return `${(downloads / 1000000).toFixed(1)}M`;
    if (downloads >= 1000) return `${(downloads / 1000).toFixed(1)}K`;
    return downloads.toString();
  };

  const handlePlayServer = async (server: UnifiedMod) => {
    setNotification(`${t('discover.connectingToServer')}: ${server.name}`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleInstall = async (mod: UnifiedMod, targetProfileId?: string, targetProfileFilter?: { gameVersion: string; loader?: string; projectType: string }) => {
    // Check concurrent download limit
    if (activeDownloadsRef.current >= MAX_CONCURRENT_DOWNLOADS) {
      setNotification(`Maximum ${MAX_CONCURRENT_DOWNLOADS} concurrent downloads. Please wait...`);
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    activeDownloadsRef.current += 1;

    if (profileFilter?.projectType === 'modpack' || (!profileFilter && selectedType === 'modpacks')) {
      try {
        setInstallingMods(prev => new Map(prev).set(mod.id, { name: mod.name, progress: 'Fetching versions...' }));

        const { getModVersions, installModpack } = await import('../lib/tauri-commands');
        const versions = await getModVersions({
          mod_id: mod.id,
          source: 'modrinth',
        });

        if (versions.length === 0) {
          setNotification(t('discover.noCompatibleVersion'));
          setTimeout(() => setNotification(null), 5000);
          setInstallingMods(prev => {
            const next = new Map(prev);
            next.delete(mod.id);
            return next;
          });
          activeDownloadsRef.current -= 1;
          return;
        }

        setInstallingMods(prev => new Map(prev).set(mod.id, { name: mod.name, progress: 'Creating profile...' }));

        const latestVersion = versions[0];

        const gameVersion = latestVersion.game_versions[0] || '1.21.1';
        const loader = latestVersion.loaders[0] || 'fabric';

        const currentProfiles = JSON.parse(localStorage.getItem('limen_profiles') || '[]');
        let finalName = mod.name;
        let counter = 1;
        while (currentProfiles.some((p: any) => p.name === finalName)) {
          finalName = `${mod.name} (${counter})`;
          counter++;
        }

        const newProfileId = Date.now().toString();
        const newProfile = {
          id: newProfileId,
          name: finalName,
          version: gameVersion,
          loader: loader,
          loaderVersion: '',
          icon: mod.icon_url || undefined,
        };

        const updatedProfiles = [...currentProfiles, newProfile];
        localStorage.setItem('limen_profiles', JSON.stringify(updatedProfiles));

        window.dispatchEvent(new Event('storage'));

        setInstallingMods(prev => new Map(prev).set(mod.id, { name: mod.name, progress: 'Installing modpack...' }));

        const result = await installModpack(mod.id, mod.name, newProfileId);

        if (result.installed_mods && result.installed_mods.length > 0) {
          localStorage.setItem(`profile_${newProfileId}_mods`, JSON.stringify(result.installed_mods));
        }

        setNotification(`${t('discover.modpackProfileCreated')}: ${finalName}`);
        setTimeout(() => setNotification(null), 5000);

        window.location.reload();
      } catch (err) {
        console.error('Modpack install error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setNotification(`${t('discover.failedToInstall')} ${errorMessage}`);
        setTimeout(() => setNotification(null), 5000);
      } finally {
        setInstallingMods(prev => {
          const next = new Map(prev);
          next.delete(mod.id);
          return next;
        });
        activeDownloadsRef.current -= 1;
      }
      return;
    }

    // If no profile filter and no target profile, show profile selector
    if (!profileFilter && !targetProfileId) {
      // Open modal immediately
      setSelectedModForInstall(mod);
      setIsSelectProfileModalOpen(true);
      
      // Load profiles from Rust backend in background
      const loadProfiles = async () => {
        try {
          const { getMinecraftProfiles, getModVersions } = await import('../lib/tauri-commands');
          const backendProfiles = await getMinecraftProfiles();
          
          if (backendProfiles && backendProfiles.length > 0) {
            // Get mod versions to check compatibility
            const versions = await getModVersions({
              mod_id: mod.id,
              source: 'modrinth',
            });
            
            // Extract supported game versions and loaders from mod versions
            const supportedVersions = new Set<string>();
            const supportedLoaders = new Set<string>();
            
            versions.forEach((v: any) => {
              v.game_versions?.forEach((gv: string) => supportedVersions.add(gv));
              v.loaders?.forEach((l: string) => supportedLoaders.add(l.toLowerCase()));
            });
            
            // Filter compatible profiles
            const compatibleProfilesList = backendProfiles
              .filter((p: any) => {
                // Check if profile version is supported
                const versionMatch = supportedVersions.has(p.version);
                
                // Check if profile loader is supported (vanilla is always compatible)
                const loaderMatch = p.loader === 'vanilla' || 
                                   supportedLoaders.size === 0 || 
                                   supportedLoaders.has(p.loader.toLowerCase());
                
                return versionMatch && loaderMatch;
              })
              .map((p: any) => ({
                id: p.id,
                name: p.name,
                version: p.version,
                loader: p.loader,
                loaderVersion: p.loader_version,
                icon: p.icon,
              }));
            
            setCompatibleProfiles(compatibleProfilesList);
          } else {
            setCompatibleProfiles([]);
          }
        } catch (err) {
          console.error('Failed to load profiles:', err);
          setCompatibleProfiles([]);
        }
      };
      
      loadProfiles();
      activeDownloadsRef.current -= 1;
      return;
    }

    const finalProfileId = targetProfileId || profileId;
    const finalProfileFilter = targetProfileFilter || profileFilter;

    if (!finalProfileId || !finalProfileFilter) {
      setNotification(t('discover.installFromProfile'));
      setTimeout(() => setNotification(null), 5000);
      activeDownloadsRef.current -= 1;
      return;
    }
    try {
      setInstallingMods(prev => new Map(prev).set(mod.id, { name: mod.name, progress: 'Fetching versions...' }));
      
      const { getModVersions, downloadMod, getLimenConfig } = await import('../lib/tauri-commands');
      const versionsParams: any = {
        mod_id: mod.id,
        source: 'modrinth',
        game_versions: [finalProfileFilter.gameVersion],
      };

      if (finalProfileFilter.loader) {
        versionsParams.loaders = [finalProfileFilter.loader];
      }

      const versions = await getModVersions(versionsParams);

      if (versions.length === 0) {
        setNotification(t('discover.noCompatibleVersion'));
        setTimeout(() => setNotification(null), 5000);
        setInstallingMods(prev => {
          const next = new Map(prev);
          next.delete(mod.id);
          return next;
        });
        activeDownloadsRef.current -= 1;
        return;
      }

      const latestVersion = versions[0];
      const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0];
      if (!primaryFile) {
        setNotification(t('discover.noDownloadFile'));
        setTimeout(() => setNotification(null), 5000);
        setInstallingMods(prev => {
          const next = new Map(prev);
          next.delete(mod.id);
          return next;
        });
        activeDownloadsRef.current -= 1;
        return;
      }

      setInstallingMods(prev => new Map(prev).set(mod.id, { name: mod.name, progress: 'Downloading...' }));

      const limenDir = await getLimenConfig();

      let folderName = 'mods';
      if (finalProfileFilter.projectType === 'resourcepack') {
        folderName = 'resourcepacks';
      } else if (finalProfileFilter.projectType === 'shader') {
        folderName = 'shaderpacks';
      } else if (finalProfileFilter.projectType === 'datapack') {
        folderName = 'datapacks';
      }

      const destinationDir = `${limenDir}/profiles/${finalProfileId}/${folderName}`;

      await downloadMod({
        download_url: primaryFile.url,
        filename: primaryFile.filename,
        destination: destinationDir,
      });

      if (onModInstalled) {
        onModInstalled({
          id: mod.id,
          name: mod.name,
          version: latestVersion.version_number,
          icon_url: mod.icon_url,
          type: finalProfileFilter.projectType,
        });
      }

      setNotification(`${mod.name} ${t('discover.installedSuccessfully')}`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error('Install error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setNotification(`${t('discover.failedToInstall')} ${errorMessage}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setInstallingMods(prev => {
        const next = new Map(prev);
        next.delete(mod.id);
        return next;
      });
      activeDownloadsRef.current -= 1;
    }
  };

  if (selectedMod) {
    return (
      <ModDetail
        mod={selectedMod}
        onBack={() => setSelectedMod(null)}
        profileId={profileId}
        profileFilter={profileFilter}
      />
    );
  }

  return (
    <div className="flex-1 flex w-full h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {!profileFilter && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 overflow-x-auto pb-2 flex-1">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedType(cat.id)}
                    className={`px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${selectedType === cat.id
                      ? 'bg-[#1f6feb]/10 text-[#1f6feb] border-[#1f6feb]/30'
                      : 'bg-[#0a0a0a] text-gray-400 hover:text-white hover:bg-[#1a1a1a] border-[#1a1a1a]'
                      }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFilterModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#1f6feb] text-gray-400 hover:text-white transition-all flex items-center gap-2"
                >
                  <Filter size={16} />
                  <span className="text-sm font-bold">{t('discover.filtersButton')}</span>
                </button>
              </div>
            </div>
          )}

          {profileFilter && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 px-4 py-3 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg">
                <div className="text-sm">
                  <span className="text-gray-400">{t('discover.filteringFor')}</span>
                  <span className="text-white ml-2 font-medium">{profileFilter.gameVersion}</span>
                  {profileFilter.loader && (
                    <>
                      <span className="text-gray-600 mx-2">•</span>
                      <span className="text-white font-medium">
                        {profileFilter.loader.charAt(0).toUpperCase() + profileFilter.loader.slice(1)}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setIsFilterModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] hover:border-[#1f6feb] text-gray-400 hover:text-white transition-all flex items-center gap-2"
              >
                <Filter size={16} />
                <span className="text-sm font-bold">{t('discover.filtersButton')}</span>
              </button>
            </div>
          )}

          {notification && (
            <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3">
              <p className="text-gray-300 text-sm">{notification}</p>
            </div>
          )}

          {installingMods.size > 0 && (
            <div className="space-y-2">
              {Array.from(installingMods.entries()).map(([modId, info]) => (
                <div key={modId} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-3 flex items-center gap-3">
                  <Loader2 className="text-[#1f6feb] animate-spin flex-shrink-0" size={16} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{info.name}</p>
                    <p className="text-gray-400 text-xs">{info.progress}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="text-[#1f6feb] animate-spin" size={40} />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-gray-400 text-lg mb-2">{t('discover.startExploring')}</p>
              <p className="text-gray-500 text-sm">{t('discover.startExploringSubtitle')}</p>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => {
                  // Check if this specific item is a server
                  const isServerItem = item.project_type === 'minecraft_java_server';

                  return isServerItem ? (
                    // Server Card Design
                    <div
                      key={item.id}
                      onClick={() => setSelectedMod(item)}
                      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#1f6feb] transition-all duration-200 cursor-pointer group"
                    >
                      <div className="flex">
                        {/* Server Icon */}
                        <div className="w-32 h-32 flex-shrink-0 bg-[#000000] overflow-hidden m-5 rounded-xl border border-[#1a1a1a] relative">
                          <img
                            src={item.icon_url || `https://via.placeholder.com/128x128/1f6feb/ffffff?text=${item.name.charAt(0)}`}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {/* Online indicator */}
                          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#1a1a1a]">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                            <span className="text-emerald-500 text-[10px] font-bold tracking-wider">ONLINE</span>
                          </div>
                        </div>

                        {/* Server Info */}
                        <div className="flex-1 py-5 pr-6 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-xl mb-1 group-hover:text-[#1f6feb] transition-colors truncate">
                                  {item.name}
                                </h3>
                                <p className="text-sm text-gray-400">
                                  {t('discover.by')} <span className="text-gray-300 font-medium">{item.author}</span>
                                </p>
                              </div>
                              <button
                                className="ml-4 px-6 py-2 bg-[#1a1a1a] hover:bg-[#1f6feb] border border-[#2a2a2a] hover:border-[#1f6feb] text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePlayServer(item);
                                }}
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                                {t('discover.play')}
                              </button>
                            </div>
                            <p className="text-sm text-gray-400 line-clamp-2 leading-relaxed">{item.description}</p>
                          </div>

                          {/* Server Stats */}
                          <div className="flex items-center justify-between mt-4">
                            <div className="flex items-center gap-2">
                              {item.categories.slice(0, 3).map((cat) => (
                                <span key={cat} className="px-2.5 py-1 bg-[#111] rounded-lg border border-[#222] text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                                  {cat}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center">
                              {/* Active Players */}
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#111] rounded-lg border border-[#222]">
                                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                                </svg>
                                <div className="flex items-baseline gap-1.5">
                                  {item.players_online !== undefined && item.players_online !== null ? (
                                    <span className="text-emerald-500 font-bold text-sm">
                                      {formatDownloads(item.players_online)}
                                    </span>
                                  ) : (
                                    <div className="h-4 w-10 bg-[#222] rounded animate-pulse"></div>
                                  )}
                                  <span className="text-gray-500 text-[10px] uppercase tracking-wider font-semibold">{t('discover.playersOnline')}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Regular Mod/Modpack Card Design
                    <div
                      key={item.id}
                      onClick={() => setSelectedMod(item)}
                      className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#1f6feb] transition-all duration-200 cursor-pointer group flex"
                    >
                      <div className="w-28 h-28 flex-shrink-0 bg-[#000000] overflow-hidden m-5 rounded-xl border border-[#1a1a1a]">
                        <img
                          src={item.icon_url || `https://via.placeholder.com/128x128/0ea5e9/ffffff?text=${item.name.charAt(0)}`}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 py-5 pr-6 flex flex-col justify-center">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-white font-bold text-lg mb-1 group-hover:text-[#1f6feb] transition-colors truncate">
                              {item.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {t('discover.by')} <span className="text-gray-300 font-medium">{item.author}</span>
                            </p>
                          </div>
                          <button
                            className={`ml-4 px-5 py-2 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 flex-shrink-0 border ${installedModIds.includes(item.id)
                              ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-600/20'
                              : 'bg-[#1a1a1a] border-[#2a2a2a] hover:bg-[#1f6feb] hover:border-[#1f6feb]'
                              }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!installedModIds.includes(item.id)) {
                                handleInstall(item);
                              }
                            }}
                            disabled={installingMods.has(item.id) || installedModIds.includes(item.id)}
                          >
                            <Download size={16} />
                            {installingMods.has(item.id)
                              ? t('discover.installing')
                              : installedModIds.includes(item.id)
                                ? t('discover.installed')
                                : t('discover.install')}
                          </button>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2 mb-3 leading-relaxed">{item.description}</p>
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.categories.slice(0, 3).map((cat) => (
                              <span key={cat} className="px-2.5 py-1 bg-[#111] rounded-lg border border-[#222] text-[11px] text-gray-400 font-medium uppercase tracking-wide">
                                {cat}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Download size={14} className="text-gray-400" />
                              <span>{formatDownloads(item.downloads)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock size={14} className="text-gray-400" />
                              <span>{t('discover.updated')}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1a1a] transition-colors"
                >
                  {t('discover.previous')}
                </button>
                <div className="flex items-center gap-2">
                  {currentPage > 1 && (
                    <button
                      onClick={() => setCurrentPage(currentPage - 1)}
                      className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white hover:bg-[#1a1a1a] transition-colors"
                    >
                      {currentPage - 1}
                    </button>
                  )}
                  <button className="w-10 h-10 rounded-xl bg-[#1f6feb] text-white font-medium border border-[#1f6feb]">
                    {currentPage}
                  </button>
                  {items.length === itemsPerPage && (
                    <button
                      onClick={() => setCurrentPage(currentPage + 1)}
                      className="w-10 h-10 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white hover:bg-[#1a1a1a] transition-colors"
                    >
                      {currentPage + 1}
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={items.length < itemsPerPage}
                  className="px-4 py-2 rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#1a1a1a] transition-colors"
                >
                  {t('discover.next')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <aside className="w-56 bg-black border-l border-[#1a1a1a] overflow-y-auto p-3">
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">{t('discover.categories')}</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all border flex items-center gap-2 ${selectedCategory === null ? 'bg-[#1f6feb]/10 border-[#1f6feb]/20 text-[#1f6feb] font-bold' : 'text-gray-400 hover:text-white hover:bg-[#0a0a0a] border-transparent'
                  }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                {t('discover.allCategories')}
              </button>
              {MOD_CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setSelectedCategory(cat.key)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all border flex items-center gap-2 ${selectedCategory === cat.key ? 'bg-[#1f6feb]/10 border-[#1f6feb]/20 text-[#1f6feb] font-bold' : 'text-gray-400 hover:text-white hover:bg-[#0a0a0a] border-transparent'
                    }`}
                >
                  <img 
                    src={cat.icon} 
                    alt={cat.name}
                    className="w-4 h-4 flex-shrink-0 opacity-70"
                  />
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <FilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        sortBy={sortBy}
        onSortChange={onSortChange}
      />

      <SelectProfileModal
        isOpen={isSelectProfileModalOpen}
        onClose={() => {
          setIsSelectProfileModalOpen(false);
          setSelectedModForInstall(null);
        }}
        onSelectProfile={(profileId) => {
          if (selectedModForInstall) {
            // Load profile from backend
            const loadProfile = async () => {
              try {
                const { getMinecraftProfiles } = await import('../lib/tauri-commands');
                const backendProfiles = await getMinecraftProfiles();
                const selectedProfile = backendProfiles.find((p: any) => p.id === profileId);
                
                if (selectedProfile) {
                  const profileFilter = {
                    gameVersion: selectedProfile.version,
                    loader: selectedProfile.loader !== 'vanilla' ? selectedProfile.loader : undefined,
                    projectType: selectedModForInstall?.project_type || 'mod',
                  };
                  
                  handleInstall(selectedModForInstall, profileId, profileFilter);
                }
              } catch (err) {
                console.error('Failed to load profile:', err);
              }
            };
            
            loadProfile();
          }
        }}
        onCreateNew={() => {
          // TODO: Open NewProfileModal with pre-filled version from mod
          setNotification(t('profile.createNewProfileFirst'));
          setTimeout(() => setNotification(null), 5000);
        }}
        compatibleProfiles={compatibleProfiles}
        modName={selectedModForInstall?.name || ''}
        modType={selectedModForInstall?.project_type || 'mod'}
      />

      {notification && <StatusNotification message={notification} />}
    </div>
  );
}