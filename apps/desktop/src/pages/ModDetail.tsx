import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Heart, Github, BookOpen, ExternalLink, Clock, User, Tag, MoreVertical } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { open } from '@tauri-apps/plugin-shell';
import { Button } from '../components/ui/button';
import { SelectProfileModal } from '../components/SelectProfileModal';
import { getModDetails, getModVersions } from '../lib/tauri-commands';
import type { UnifiedMod, ModVersion } from '../types/tauri';

interface ModDetailProps {
  mod: UnifiedMod;
  onBack: () => void;
  profileId?: string;
  profileFilter?: {
    gameVersion: string;
    loader?: string;
    projectType: string;
  };
}

export function ModDetail({ mod: initialMod, onBack, profileId, profileFilter }: ModDetailProps) {
  const { t } = useTranslation();
  const [mod, setMod] = useState<UnifiedMod>(initialMod);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('description');
  const [installing, setInstalling] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [isSelectProfileModalOpen, setIsSelectProfileModalOpen] = useState(false);
  const [compatibleProfiles, setCompatibleProfiles] = useState<any[]>([]);

  // Check if this is a server
  const isServer = mod.project_type === 'minecraft_java_server';

  const openUrl = async (url: string) => {
    try {
      await open(url);
    } catch (err) {
      console.error('Failed to open URL:', err);
    }
  };

  const handleInstall = async (targetProfileId?: string, targetProfileFilter?: { gameVersion: string; loader?: string; projectType: string }) => {
    if (installing) return;

    // If no profile filter and no target profile, show profile selector
    if (!profileFilter && !targetProfileId) {
      // Open modal immediately
      setIsSelectProfileModalOpen(true);
      
      // Load profiles in background
      const loadProfiles = async () => {
        try {
          const { getMinecraftProfiles, getModVersions } = await import('../lib/tauri-commands');
          const backendProfiles = await getMinecraftProfiles();
          
          if (backendProfiles && backendProfiles.length > 0) {
            const versions = await getModVersions({
              mod_id: mod.id,
              source: 'modrinth',
            });
            
            const supportedVersions = new Set<string>();
            const supportedLoaders = new Set<string>();
            
            versions.forEach((v: any) => {
              v.game_versions?.forEach((gv: string) => supportedVersions.add(gv));
              v.loaders?.forEach((l: string) => supportedLoaders.add(l.toLowerCase()));
            });
            
            const compatibleProfilesList = backendProfiles
              .filter((p: any) => {
                const versionMatch = supportedVersions.has(p.version);
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
      return;
    }

    const finalProfileId = targetProfileId || profileId;
    const finalProfileFilter = targetProfileFilter || profileFilter;

    if (!finalProfileId || !finalProfileFilter) {
      setNotification(t('discover.installFromProfile'));
      setTimeout(() => setNotification(null), 5000);
      return;
    }

    try {
      setInstalling(true);
      setNotification(t('discover.installing'));
      
      const { getModVersions, downloadMod, getLimenConfig } = await import('../lib/tauri-commands');
      const versionsParams: any = {
        mod_id: mod.id,
        source: 'modrinth',
        game_versions: [finalProfileFilter.gameVersion],
      };

      if (finalProfileFilter.loader) {
        versionsParams.loaders = [finalProfileFilter.loader];
      }

      const versionList = await getModVersions(versionsParams);

      if (versionList.length === 0) {
        setNotification(t('discover.noCompatibleVersion'));
        setTimeout(() => setNotification(null), 5000);
        return;
      }

      const latestVersion = versionList[0];
      const primaryFile = latestVersion.files.find(f => f.primary) || latestVersion.files[0];
      if (!primaryFile) {
        setNotification(t('discover.noDownloadFile'));
        setTimeout(() => setNotification(null), 5000);
        return;
      }

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

      setNotification(`${mod.name} ${t('discover.installedSuccessfully')}`);
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      console.error('Install error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setNotification(`${t('discover.failedToInstall')} ${errorMessage}`);
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    loadFullDetails();
  }, [initialMod.id]);

  const loadFullDetails = async () => {
    setLoading(true);
    try {
      const [details, versionList] = await Promise.all([
        getModDetails({ mod_id: initialMod.id, source: 'modrinth' }),
        getModVersions({ mod_id: initialMod.id, source: 'modrinth' })
      ]);
      
      setMod(details);
      setVersions(versionList);
    } catch (err) {
      console.error('Failed to load full details:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDownloads = (downloads: number): string => {
    if (downloads >= 1000000) {
      return `${(downloads / 1000000).toFixed(1)}M`;
    } else if (downloads >= 1000) {
      return `${(downloads / 1000).toFixed(1)}K`;
    }
    return downloads.toString();
  };

  const getVersionTypeColor = (type: string): string => {
    switch (type) {
      case 'release':
        return 'bg-[#1f6feb]';
      case 'beta':
        return 'bg-[#1f6feb]';
      case 'alpha':
        return 'bg-[#f85149]';
      default:
        return 'bg-[#1a1a1a]';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full bg-[#050505]">
      <div className="max-w-none mx-auto px-8 py-8 w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-8 font-semibold"
        >
          <ArrowLeft size={18} />
          <span>{t('modDetail.backToDiscover')}</span>
        </button>

        {/* Header Section */}
        <div className="flex items-start gap-6 border-b border-[#1a1a1a] pb-8 mb-6">
          <div className="w-28 h-28 rounded-3xl bg-[#000000] overflow-hidden flex-shrink-0 border border-[#1a1a1a] shadow-lg">
            <img
              src={mod.icon_url || `https://via.placeholder.com/128x128/0ea5e9/ffffff?text=${mod.name.charAt(0)}`}
              alt={mod.name}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <h1 className="text-4xl font-black text-white mb-2 truncate">{mod.name}</h1>
            <p className="text-gray-400 text-lg mb-4 line-clamp-2 font-medium">{mod.description}</p>

            <div className="flex items-center gap-6 text-sm">
              {isServer && mod.players_online !== undefined && mod.players_online !== null ? (
                // Server stats
                <>
                  <div className="flex items-center gap-2 text-green-400">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="text-white font-bold">{formatDownloads(mod.players_online)}</span>
                    <span className="text-gray-400">{t('discover.playersOnline')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Download size={18} />
                    <span className="text-white font-bold">{formatDownloads(mod.downloads)}</span>
                    <span className="text-gray-400">{t('discover.totalJoins')}</span>
                  </div>
                </>
              ) : (
                // Regular mod/modpack stats
                <>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Download size={18} />
                    <span className="text-white font-bold">{formatDownloads(mod.downloads)}</span>
                  </div>
                  {mod.followers && (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Heart size={18} />
                      <span className="text-white font-bold">{formatDownloads(mod.followers)}</span>
                    </div>
                  )}
                </>
              )}
              {mod.categories && mod.categories.length > 0 && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Tag size={16} />
                  <span className="px-3 py-1 bg-[#1a1a1a] rounded-full text-xs font-bold text-gray-300">
                    {mod.categories[0]}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 pt-2">
            {isServer ? (
              <Button className="bg-[#1a1a1a] hover:bg-[#1f6feb] border border-[#2a2a2a] hover:border-[#1f6feb] text-white gap-2 px-6 py-6 text-base font-bold rounded-xl shadow-lg shadow-[#1f6feb]/20 transition-all">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
                {t('discover.play')}
              </Button>
            ) : (
              <Button 
                className="bg-[#1f6feb] hover:bg-[#388bfd] text-white gap-2 px-6 py-6 text-base font-bold rounded-xl shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handleInstall()}
                disabled={installing}
              >
                <Download size={20} />
                {installing ? t('discover.installing') : t('modDetail.install')}
              </Button>
            )}
            <button className="p-3 text-gray-400 hover:text-white hover:bg-[#1a1a1a] rounded-xl transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="mb-8 flex items-center gap-1 w-full max-w-none mx-auto px-8">
          <div className="flex p-1.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl">
            <button
              onClick={() => setActiveTab('description')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'description'
                ? 'bg-[#1f6feb]/10 text-[#1f6feb] border-[#1f6feb]/30'
                : 'text-gray-400 hover:text-white border-transparent'
                }`}
            >
              {t('modDetail.tabs.description')}
            </button>
            <button
              onClick={() => setActiveTab('versions')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'versions'
                ? 'bg-[#1f6feb]/10 text-[#1f6feb] border-[#1f6feb]/30'
                : 'text-gray-400 hover:text-white border-transparent'
                }`}
            >
              {t('modDetail.tabs.versions')}
            </button>
            <button
              onClick={() => setActiveTab('gallery')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all border ${activeTab === 'gallery'
                ? 'bg-[#1f6feb]/10 text-[#1f6feb] border-[#1f6feb]/30'
                : 'text-gray-400 hover:text-white border-transparent'
                }`}
            >
              {t('modDetail.tabs.gallery')}
            </button>
          </div>
        </div>

        <div className="max-w-none mx-auto px-8 w-full">
          {activeTab === 'description' && (
            <div className="space-y-6">
              {/* Server Info Card - Only for servers */}
              {isServer && (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 shadow-lg">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-16 h-16 bg-[#111] border border-[#222] rounded-xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-white mb-3">{t('modDetail.serverInfo')}</h3>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        {mod.players_online !== undefined && mod.players_online !== null && (
                          <div>
                            <p className="text-gray-400 text-sm mb-1">{t('discover.playersOnline')}</p>
                            <p className="text-2xl font-bold text-emerald-500">{formatDownloads(mod.players_online)}</p>
                          </div>
                        )}
                        {mod.recommended_version && (
                          <div>
                            <p className="text-gray-400 text-sm mb-1">{t('modDetail.recommendedVersion')}</p>
                            <p className="text-lg font-bold text-gray-200">{mod.recommended_version}</p>
                          </div>
                        )}
                      </div>
                      {mod.supported_versions && mod.supported_versions.length > 0 && (
                        <div>
                          <p className="text-gray-400 text-sm mb-2">{t('modDetail.supportedVersions')}</p>
                          <div className="flex flex-wrap gap-2">
                            {mod.supported_versions.slice(0, 8).map((version) => (
                              <span key={version} className="px-2 py-1 bg-[#1a1a1a] rounded text-xs text-gray-300 font-medium">
                                {version}
                              </span>
                            ))}
                            {mod.supported_versions.length > 8 && (
                              <span className="px-2 py-1 bg-[#1a1a1a] rounded text-xs text-gray-400">
                                +{mod.supported_versions.length - 8} {t('modDetail.moreVersions')}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                {mod.source_url && (
                  <Button
                    className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-[#1a1a1a] gap-2 rounded-lg"
                    onClick={() => openUrl(mod.source_url!)}
                  >
                    <Github size={16} />
                    {t('modDetail.links.source')}
                  </Button>
                )}
                {mod.discord_url && (
                  <Button
                    className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-[#1a1a1a] gap-2 rounded-lg"
                    onClick={() => openUrl(mod.discord_url!)}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    {t('modDetail.links.discord')}
                  </Button>
                )}
                {mod.wiki_url && (
                  <Button
                    className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-[#1a1a1a] gap-2 rounded-lg"
                    onClick={() => openUrl(mod.wiki_url!)}
                  >
                    <BookOpen size={16} />
                    {t('modDetail.links.wiki')}
                  </Button>
                )}
                {mod.issues_url && (
                  <Button
                    className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border border-[#1a1a1a] gap-2 rounded-lg"
                    onClick={() => openUrl(mod.issues_url!)}
                  >
                    <ExternalLink size={16} />
                    {t('modDetail.links.issues')}
                  </Button>
                )}
              </div>

              <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-3xl p-8 shadow-sm">
                {mod.body ? (
                  <div className="prose prose-invert prose-modrinth max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {mod.body}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-gray-300 leading-relaxed font-medium">{mod.description}</p>
                )}
              </div>

              {mod.gallery && mod.gallery.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white">{t('modDetail.galleryPreview')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mod.gallery.slice(0, 4).map((image, index) => (
                      <div key={index} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#1f6feb] transition-colors">
                        <img
                          src={image.url}
                          alt={image.title || `Gallery image ${index + 1}`}
                          className="w-full aspect-[2/1] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => openUrl(image.raw_url || image.url)}
                        />
                        {image.title && (
                          <div className="p-3">
                            <p className="text-white font-medium">{image.title}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {mod.gallery.length > 4 && (
                    <button
                      onClick={() => setActiveTab('gallery')}
                      className="text-[#1f6feb] hover:text-[#388bfd] text-sm font-medium"
                    >
                      {t('modDetail.viewAllImages', { count: mod.gallery.length })}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <User size={16} />
                    <span className="text-sm">{t('modDetail.info.author')}</span>
                  </div>
                  <p className="text-white font-medium">{mod.author}</p>
                </div>
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-400 mb-2">
                    <Clock size={16} />
                    <span className="text-sm">{t('modDetail.info.lastUpdated')}</span>
                  </div>
                  <p className="text-white font-medium">{new Date(mod.date_modified).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'versions' && (
            <div className="space-y-3">
              {loading ? (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 text-center">
                  <p className="text-gray-400">{t('modDetail.loadingVersions')}</p>
                </div>
              ) : versions.length > 0 ? (
                versions.map((version) => (
                  <div key={version.id} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 hover:border-[#1f6feb] transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-white font-semibold">{version.name}</h3>
                          <span className={`px-2 py-0.5 rounded text-xs text-white font-medium ${getVersionTypeColor(version.version_type)}`}>
                            {version.version_type}
                          </span>
                        </div>
                        <p className="text-gray-400 text-sm mb-3">
                          <span className="text-gray-500">{t('modDetail.version')}</span> {version.version_number}
                        </p>
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Download size={14} />
                            <span className="font-medium">{formatDownloads(version.downloads)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <Clock size={14} />
                            <span className="font-medium">{new Date(version.date_published).toLocaleDateString()}</span>
                          </div>
                          {version.game_versions && version.game_versions.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500 font-medium">Minecraft:</span>
                              <div className="flex items-center gap-1 flex-wrap">
                                {version.game_versions.slice(0, 3).map((gv, idx) => (
                                  <span key={`${gv}-${idx}`} className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs text-gray-300 font-medium">
                                    {gv}
                                  </span>
                                ))}
                                {version.game_versions.length > 3 && (
                                  <span className="px-2 py-0.5 bg-[#1a1a1a] border border-[#2a2a2a] rounded text-xs text-gray-400 font-medium">
                                    +{version.game_versions.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {version.loaders && version.loaders.length > 0 && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500 font-medium">Loader:</span>
                              <div className="flex items-center gap-1">
                                {version.loaders.map((loader, idx) => (
                                  <span key={`${loader}-${idx}`} className="px-2 py-0.5 bg-[#1f6feb]/20 border border-[#1f6feb]/30 rounded text-xs text-[#1f6feb] font-bold uppercase">
                                    {loader}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button className="bg-[#1f6feb] hover:bg-[#388bfd] text-white gap-2 flex-shrink-0">
                        <Download size={16} />
                        {t('modDetail.download')}
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-6 text-center">
                  <p className="text-gray-400">{t('modDetail.noVersions')}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'gallery' && (
            <div>
              {mod.gallery && mod.gallery.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mod.gallery.map((image, index) => (
                    <div key={index} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg overflow-hidden hover:border-[#1f6feb] transition-colors">
                      <img
                        src={image.url}
                        alt={image.title || `Gallery image ${index + 1}`}
                        className="w-full aspect-[2/1] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => openUrl(image.raw_url || image.url)}
                      />
                      {(image.title || image.description) && (
                        <div className="p-4">
                          {image.title && (
                            <h3 className="text-white font-semibold mb-2">{image.title}</h3>
                          )}
                          {image.description && (
                            <p className="text-gray-400 text-sm mb-3">{image.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-gray-500 text-xs">
                            <Clock size={14} />
                            <span>{new Date(image.created).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-12 text-center">
                  <p className="text-gray-400">{t('modDetail.noGallery')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 bg-[#0a0a0a] border border-[#1a1a1a] rounded-lg p-4 shadow-lg z-50 max-w-md">
          <p className="text-white text-sm">{notification}</p>
        </div>
      )}

      {/* Profile Selection Modal */}
      <SelectProfileModal
        isOpen={isSelectProfileModalOpen}
        onClose={() => {
          setIsSelectProfileModalOpen(false);
        }}
        onSelectProfile={(selectedProfileId) => {
          const loadProfile = async () => {
            try {
              const { getMinecraftProfiles } = await import('../lib/tauri-commands');
              const backendProfiles = await getMinecraftProfiles();
              const selectedProfile = backendProfiles.find((p: any) => p.id === selectedProfileId);
              
              if (selectedProfile) {
                const profileFilterData = {
                  gameVersion: selectedProfile.version,
                  loader: selectedProfile.loader !== 'vanilla' ? selectedProfile.loader : undefined,
                  projectType: mod.project_type || 'mod',
                };
                
                handleInstall(selectedProfileId, profileFilterData);
              }
            } catch (err) {
              console.error('Failed to load profile:', err);
            }
          };
          
          loadProfile();
        }}
        onCreateNew={() => {
          setNotification(t('profile.createNewProfileFirst'));
          setTimeout(() => setNotification(null), 5000);
        }}
        compatibleProfiles={compatibleProfiles}
        modName={mod.name}
        modType={mod.project_type || 'mod'}
      />
    </div>
  );
}
