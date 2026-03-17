import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { User, Plus } from 'lucide-react';
import { SkinViewer } from '../components/SkinViewer';
import { SkinHeadViewer } from '../components/SkinHeadViewer';
import { SkinCardViewer } from '../components/SkinCardViewer';
import { SkinModelSelectorModal } from '../components/SkinModelSelectorModal';
import { invalidateSkin } from '../lib/skinCache';

interface SkinsProps {
  mcProfile: {
    username: string;
    uuid: string;
    access_token: string;
  } | null;
  onOpenSettings: () => void;
}

export function Skins({ mcProfile, onOpenSettings }: SkinsProps) {
  const { t } = useTranslation();
  const [selectedSkinUuid, setSelectedSkinUuid] = useState<string | null>(null);
  const [selectedCustomSkin, setSelectedCustomSkin] = useState<{ id: string; name: string; path: string; model: 'steve' | 'alex' } | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('yourSkins');
  const [customSkins, setCustomSkins] = useState<Array<{ id: string; name: string; path: string; model: 'steve' | 'alex' }>>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [pendingFilePath, setPendingFilePath] = useState<string | null>(null);
  const [skinRefreshKey, setSkinRefreshKey] = useState(0);

  useEffect(() => {
    const saved = localStorage.getItem('customSkins');
    if (saved) {
      try {
        setCustomSkins(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to load custom skins:', err);
      }
    }
  }, []);

  const saveCustomSkins = (skins: typeof customSkins) => {
    localStorage.setItem('customSkins', JSON.stringify(skins));
    setCustomSkins(skins);
  };

  useEffect(() => {
    if (!mcProfile) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          if (id === 'section-saved-skins') setActiveCategory('yourSkins');
          else if (id === 'section-default-skins') setActiveCategory('defaultSkins');
          else if (id === 'section-popular-skins') setActiveCategory('trendingCreatorSkins');
        }
      });
    }, {
      rootMargin: '-120px 0px -40% 0px',
      threshold: 0
    });

    const sections = ['section-saved-skins', 'section-default-skins', 'section-popular-skins'];
    sections.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [mcProfile]);

  const displayUuid = selectedSkinUuid || mcProfile?.uuid;
  const displayCustomSkin = selectedCustomSkin;

  if (!mcProfile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl flex items-center justify-center">
            <User size={48} className="text-gray-600" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">{t('skins.notLoggedIn')}</h2>
            <p className="text-gray-400">{t('skins.notLoggedInSubtitle')}</p>
          </div>

          <button
            onClick={onOpenSettings}
            className="px-6 py-3 bg-[#1f6feb] hover:bg-[#388bfd] text-white font-medium rounded-xl transition-colors"
          >
            {t('skins.loginButton')}
          </button>
        </div>
      </div>
    );
  }

  const handleSkinClick = (uuid: string) => {
    setSelectedSkinUuid(uuid);
    setSelectedCustomSkin(null);
    setApplyMessage(null);
  };

  const handleCustomSkinClick = (skin: typeof customSkins[0]) => {
    setSelectedCustomSkin(skin);
    setSelectedSkinUuid(null);
    setApplyMessage(null);
  };

  const savedSkins = [
    {
      id: 1,
      uuid: mcProfile.uuid,
      name: 'Current Skin',
      selected: true,
      isCurrent: true
    },
  ];

  const defaultSkins = [
    { id: 'steve', name: 'Steve', uuid: '8667ba71b85a4004af54457a9734eed7' },
    { id: 'alex', name: 'Alex', uuid: 'ec561538f3fd461daff5086b22154bce' },
  ];

  const popularSkins = [
    { id: 'dream', name: 'Dream', uuid: 'ec70bcaf702f4bb8b48d276fa52a780c' },
    { id: 'technoblade', name: 'Technoblade', uuid: 'b876ec32e396476ba1158438d83c67d4' },
    { id: 'yusufte', name: 'YusufTe', uuid: 'c8a106004f1a45de8219e231f27e3519' },
    { id: 'iyigunserkan', name: 'iyigunserkan', uuid: '4f555b111c114225b4506fa4ecdfad5a' },
    { id: 'xekial', name: 'Xekial_', uuid: 'c05e6d242bb14708b3176a71e2188422' },
    { id: 'bntandstik', name: 'BnTandstik', uuid: '40176ddb3f894a32b525b9e77ad2f124' },
  ];

  const handleUploadCustomSkin = async () => {
    if (!mcProfile) return;

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');

      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Skin Image',
          extensions: ['png']
        }]
      });

      if (!selected || typeof selected !== 'string') {
        return;
      }



      setPendingFilePath(selected);
      setShowModelSelector(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApplyMessage(t('skins.failedToOpenFilePicker', { error: message }));

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    }
  };

  const handleModelSelected = async (modelType: 'steve' | 'alex') => {
    if (!pendingFilePath || !mcProfile) return;

    setShowModelSelector(false);

    try {
      const fileName = pendingFilePath.split(/[\\/]/).pop() || 'Custom Skin';
      const skinName = fileName.replace('.png', '');
      const newSkin = {
        id: `custom-${Date.now()}`,
        name: skinName,
        path: pendingFilePath,
        model: modelType
      };

      saveCustomSkins([newSkin, ...customSkins]);

      setApplyMessage(t('skins.customSkinAdded'));

      setTimeout(() => {
        setApplyMessage(null);
      }, 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApplyMessage(t('skins.failedToAddSkin', { error: message }));

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    } finally {
      setPendingFilePath(null);
    }
  };

  const handleApplyCustomSkin = async (skin: typeof customSkins[0]) => {
    if (!mcProfile) return;

    setIsApplying(true);
    setApplyMessage(null);

    try {
      const { uploadSkinFromFile, readLocalSkinFile } = await import('../lib/tauri-commands');
      const { setSkinOverride } = await import('../lib/skinCache');

      await uploadSkinFromFile(mcProfile.access_token, mcProfile.uuid, skin.path, skin.model);

      // Local override bypasses Mojang CDN propagation delay
      const newTexture = await readLocalSkinFile(skin.path);
      setSkinOverride(mcProfile.uuid, newTexture);

      setApplyMessage(t('skins.applySuccess'));

      // Invalidate cache for the user's skin so it re-renders fresh
      invalidateSkin(mcProfile.uuid);

      // Force refresh the skin viewer
      setSkinRefreshKey(prev => prev + 1);

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApplyMessage(t('skins.applyFailed', { error: message }));

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    } finally {
      setIsApplying(false);
    }
  };

  const handleDeleteCustomSkin = (skinId: string) => {
    const updated = customSkins.filter(s => s.id !== skinId);
    saveCustomSkins(updated);
  };

  const handleApplySkin = async () => {
    if (!selectedSkinUuid || !mcProfile) return;

    setIsApplying(true);
    setApplyMessage(null);

    try {
      const { uploadSkin, detectSkinModel, fetchSkinTexture } = await import('../lib/tauri-commands');
      const { setSkinOverride } = await import('../lib/skinCache');

      const modelType = await detectSkinModel(selectedSkinUuid);
      await uploadSkin(mcProfile.access_token, mcProfile.uuid, selectedSkinUuid, modelType);

      // Local override bypasses Mojang CDN propagation delay
      const newTexture = await fetchSkinTexture(selectedSkinUuid);
      setSkinOverride(mcProfile.uuid, newTexture);

      setApplyMessage(t('skins.applySuccessInGame'));

      invalidateSkin(mcProfile.uuid);
      setSkinRefreshKey(prev => prev + 1);

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setApplyMessage(t('skins.applyFailed', { error: message }));

      setTimeout(() => {
        setApplyMessage(null);
      }, 5000);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Side - 3D Viewer */}
      <div className="w-[400px] flex-shrink-0 bg-[#000000] border-r border-[#1a1a1a] flex flex-col pt-[88px]">

        {/* 3D Viewer */}
        <div className="flex-1 p-4 overflow-hidden">
          {displayCustomSkin ? (
            <SkinCardViewer
              key={`custom-${displayCustomSkin.id}-${skinRefreshKey}`}
              filePath={displayCustomSkin.path}
              modelType={displayCustomSkin.model}
              animated={true}
            />
          ) : (
            <SkinViewer key={skinRefreshKey} uuid={displayUuid || ''} username={mcProfile.username} />
          )}
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-[#1a1a1a] space-y-3 bg-[#050505]/50 backdrop-blur-sm">
          {/* Apply Skin Button */}
          {
            (selectedSkinUuid && selectedSkinUuid !== mcProfile.uuid) || selectedCustomSkin ? (
              <button
                onClick={selectedCustomSkin ? () => handleApplyCustomSkin(selectedCustomSkin) : handleApplySkin}
                disabled={isApplying}
                className="w-full px-4 py-3 bg-[#1f6feb] hover:bg-[#388bfd] disabled:bg-[#1a1a1a] disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold tracking-wide rounded-xl transition-all shadow-lg shadow-[#1f6feb]/20 hover:shadow-[#1f6feb]/40 flex items-center justify-center gap-2 active:scale-[0.98]"
              >
                {isApplying ? (
                  <>
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {t('skins.applying')}
                  </>
                ) : (
                  t('skins.applyToAccount')
                )}
              </button>
            ) : null
          }

          {/* Status Message */}
          {
            applyMessage && (
              <div className={`text-xs text-center p-2 rounded ${applyMessage.includes('success')
                ? 'bg-green-500/10 text-green-400'
                : 'bg-red-500/10 text-red-400'
                }`}>
                {applyMessage}
              </div>
            )
          }

          <p className="text-xs text-gray-600 text-center">
            {t('skins.dragToRotate')}
          </p>
        </div>
      </div>

      {/* Right Side - Header + Skin Gallery */}
      <div className="flex-1 flex flex-col bg-[#000000] relative">

        {/* Top Header - Sticky Component Full Width */}
        <div className="absolute top-0 left-[-400px] right-0 h-[88px] bg-[#050505]/80 backdrop-blur-xl border-b border-[#1a1a1a] px-8 flex flex-row items-center justify-between z-10 w-[calc(100%+400px)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]">
          {/* Left profile section */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
              <SkinHeadViewer key={skinRefreshKey} uuid={mcProfile.uuid} />
            </div>
            <div className="flex flex-col justify-center">
              <h2 className="text-xl font-black text-white leading-tight tracking-tight">{mcProfile.username}</h2>
              <p className="text-[13px] text-gray-500 font-medium">{t('skins.verifiedProfile')}</p>
            </div>
          </div>

          {/* Right dynamic text section */}
          <div className="flex flex-col items-end justify-center pr-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1f6feb] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1f6feb]"></span>
              </span>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{t('skins.browsing')}</span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight animate-fade-in">{t(`skins.${activeCategory}`)}</h3>
          </div>
        </div >

        <div className="flex-1 overflow-y-auto pt-[88px]">
          <div className="p-8 space-y-12 max-w-5xl mx-auto">

            {/* Saved Skins */}
            <div id="section-saved-skins">
              <div className="flex items-center justify-between mb-5 border-b border-[#111] pb-3">
                <h3 className="text-lg font-bold text-white">{t('skins.yourSkins')}</h3>
                <span className="text-xs text-gray-500">{t('skins.savedCount', { count: savedSkins.length + customSkins.length })}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {/* Add Skin Button */}
                <button
                  onClick={handleUploadCustomSkin}
                  disabled={isApplying}
                  className="aspect-square bg-[#0a0a0a] border-2 border-dashed border-[#222] rounded-2xl hover:border-[#1f6feb]/50 hover:bg-[#1f6feb]/5 transition-all flex flex-col items-center justify-center gap-3 group shadow-inner cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="w-12 h-12 rounded-full bg-[#111] group-hover:bg-[#1f6feb]/10 flex items-center justify-center transition-colors">
                    <Plus size={24} className="text-gray-500 group-hover:text-[#1f6feb] transition-colors" />
                  </div>
                  <span className="text-sm font-medium text-gray-500 group-hover:text-[#1f6feb] transition-colors">{t('skins.uploadCustom')}</span>
                </button>

                {/* Custom Skins */}
                {customSkins.map((skin) => (
                  <div key={skin.id} className="relative group cursor-pointer">
                    <button
                      onClick={() => handleCustomSkinClick(skin)}
                      className={`w-full aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${displayCustomSkin?.id === skin.id
                        ? 'ring-2 ring-[#1f6feb] ring-offset-2 ring-offset-[#000] scale-105 shadow-[0_0_20px_rgba(31,111,235,0.2)]'
                        : 'bg-[#0a0a0a] hover:bg-[#0f0f0f] border border-[#222] shadow-inner group-hover:border-[#333] group-hover:-translate-y-1'
                        }`}
                    >
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#111] to-[#0a0a0a] flex items-center justify-center p-6">
                        <SkinCardViewer filePath={skin.path} modelType={skin.model} />
                      </div>
                    </button>
                    {displayCustomSkin?.id === skin.id && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#1f6feb] rounded-full flex items-center justify-center shadow-lg shadow-[#1f6feb]/30 z-10 scale-100 transition-transform">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Delete button - only show when not selected */}
                    {displayCustomSkin?.id !== skin.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCustomSkin(skin.id);
                        }}
                        className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <div className="mt-3 text-center">
                      <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{skin.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{skin.model === 'alex' ? t('skins.slim') : t('skins.classic')}</p>
                    </div>
                  </div>
                ))}

                {/* Current Skin */}
                {savedSkins.map((skin) => (
                  <div key={skin.id} className="relative group cursor-pointer">
                    <button
                      onClick={() => handleSkinClick(skin.uuid)}
                      className={`w-full aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${displayUuid === skin.uuid
                        ? 'ring-2 ring-[#1f6feb] ring-offset-2 ring-offset-[#000] scale-105 shadow-[0_0_20px_rgba(31,111,235,0.2)]'
                        : 'bg-[#0a0a0a] hover:bg-[#0f0f0f] border border-[#222] shadow-inner group-hover:border-[#333] group-hover:-translate-y-1'
                        }`}
                    >
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#111] to-[#0a0a0a] flex items-center justify-center p-6">
                        <SkinCardViewer key={skinRefreshKey} uuid={skin.uuid} />
                      </div>
                    </button>
                    {displayUuid === skin.uuid && (
                      <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#1f6feb] rounded-full flex items-center justify-center shadow-lg shadow-[#1f6feb]/30 z-10 scale-100 transition-transform">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <div className="mt-3 text-center">
                      <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{skin.name}</p>
                      {skin.isCurrent && (
                        <p className="text-xs text-[#1f6feb] mt-1">{t('skins.active')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Default Skins */}
            <div id="section-default-skins">
              <div className="flex items-center justify-between mb-5 border-b border-[#111] pb-3">
                <h3 className="text-xl font-bold text-gray-200">{t('skins.defaultSkins')}</h3>
                <span className="text-sm text-gray-500 font-medium bg-[#111] px-3 py-1 rounded-full border border-[#222]">{t('skins.classicBase')}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {defaultSkins.map((skin) => (
                  <div key={skin.id} className="group cursor-pointer">
                    <button
                      onClick={() => handleSkinClick(skin.uuid)}
                      className={`w-full aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${displayUuid === skin.uuid
                        ? 'ring-2 ring-[#1f6feb] ring-offset-2 ring-offset-[#000] scale-105 shadow-[0_0_20px_rgba(31,111,235,0.2)]'
                        : 'bg-[#0a0a0a] border border-[#222] shadow-inner group-hover:border-[#333] group-hover:-translate-y-1'
                        }`}
                    >
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#111] to-[#0a0a0a] flex items-center justify-center p-6">
                        <SkinCardViewer uuid={skin.uuid} />
                      </div>
                    </button>
                    <div className="mt-3 text-center">
                      <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{skin.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Popular Skins */}
            <div id="section-popular-skins">
              <div className="flex items-center justify-between mb-5 border-b border-[#111] pb-3">
                <h3 className="text-xl font-bold text-gray-200">{t('skins.trendingCreatorSkins')}</h3>
                <span className="text-sm text-gray-500 font-medium bg-[#111] px-3 py-1 rounded-full border border-[#222]">{t('skins.popular')}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {popularSkins.map((skin) => (
                  <div key={skin.id} className="group cursor-pointer">
                    <button
                      onClick={() => handleSkinClick(skin.uuid)}
                      className={`w-full aspect-square rounded-2xl overflow-hidden transition-all duration-300 ${displayUuid === skin.uuid
                        ? 'ring-2 ring-[#1f6feb] ring-offset-2 ring-offset-[#000] scale-105 shadow-[0_0_20px_rgba(31,111,235,0.2)]'
                        : 'bg-[#0a0a0a] border border-[#222] shadow-inner group-hover:border-[#333] group-hover:-translate-y-1'
                        }`}
                    >
                      <div className="w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#111] to-[#0a0a0a] flex items-center justify-center p-6">
                        <SkinCardViewer uuid={skin.uuid} />
                      </div>
                    </button>
                    <div className="mt-3 text-center">
                      <p className="text-sm font-medium text-gray-200 truncate group-hover:text-white transition-colors">{skin.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Info Card */}
            <div className="bg-[#050505] border border-[#1a1a1a] rounded-2xl p-6 shadow-inner flex flex-col md:flex-row gap-6 items-center lg:items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-[#1f6feb]/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-[#1f6feb]/20">
                  <svg className="w-6 h-6 text-[#1f6feb]" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-base font-bold text-white mb-1.5 flex items-center gap-2">
                    {t('skins.howItWorks')}
                    <span className="text-[10px] font-black tracking-widest text-[#1f6feb] uppercase px-2 py-0.5 rounded-sm bg-[#1f6feb]/10">{t('skins.guide')}</span>
                  </h4>
                  <p className="text-sm text-gray-400 leading-relaxed font-medium max-w-xl">
                    {t('skins.howItWorksDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SkinModelSelectorModal
        isOpen={showModelSelector}
        onClose={() => {
          setShowModelSelector(false);
          setPendingFilePath(null);
        }}
        onSelectModel={handleModelSelected}
      />
    </div>
  );
}
