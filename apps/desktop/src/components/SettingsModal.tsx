import { useState, useEffect } from 'react';
import { X, Loader2, User, Settings, Coffee } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { open } from '@tauri-apps/plugin-dialog';
import {
  getMinecraftVersions,
  getAppVersion,
  openMicrosoftLogin,
  logout,
  enableDiscordRpc,
  disableDiscordRpc,
  getJavaInstallations,
  setCustomJavaPath,
  resetJavaPath,
  getSystemMemory,
  getJavaMemory,
  saveJavaMemory,
  type JavaInstallation,
} from '../lib/tauri-commands';

interface McProfile {
  username: string;
  uuid: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcProfile: McProfile | null;
  setMcProfile: (profile: McProfile | null) => void;
}

export function SettingsModal({ isOpen, onClose, mcProfile, setMcProfile }: SettingsModalProps) {
  const { t, i18n } = useTranslation();
  const [appVersion, setAppVersion] = useState('');
  const [mcLoading, setMcLoading] = useState(false);
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(true);
  const [javaInstallations, setJavaInstallations] = useState<JavaInstallation[]>([]);
  const [javaLoading, setJavaLoading] = useState(false);
  const [javaMemory, setJavaMemory] = useState(4096); // Default 4GB in MB
  const [maxMemory, setMaxMemory] = useState(16384); // Default max 16GB, will be updated from system
  const [holdDuration, setHoldDuration] = useState(3000); // Default 3 seconds

  const [activeTab, setActiveTab] = useState('account');

  useEffect(() => {
    if (isOpen) {
      loadMinecraftData();
      loadJavaInstallations();
      loadSystemMemory();
      loadJavaMemory();
      const savedRpcState = localStorage.getItem('discord_rpc_enabled');
      if (savedRpcState !== null) {
        setDiscordRpcEnabled(savedRpcState === 'true');
      }
      const savedHoldDuration = localStorage.getItem('hold_duration');
      if (savedHoldDuration) {
        setHoldDuration(Number(savedHoldDuration));
      }
    }
  }, [isOpen]);

  const loadJavaMemory = async () => {
    try {
      const memory = await getJavaMemory();
      setJavaMemory(memory);
      
      // If loaded memory exceeds max, adjust it
      if (maxMemory > 0 && memory > maxMemory) {
        const adjustedMemory = Math.min(memory, maxMemory);
        setJavaMemory(adjustedMemory);
        await saveJavaMemory(adjustedMemory);
      }
    } catch {
      // Silently fallback to default 4GB if command not implemented
      setJavaMemory(4096);
    }
  };

  const loadSystemMemory = async () => {
    try {
      const totalMemoryMB = await getSystemMemory();
      // Set max to 75% of total RAM (leave some for OS)
      const maxAllowedMB = Math.floor(totalMemoryMB * 0.75);
      setMaxMemory(maxAllowedMB);
      
      // If saved memory exceeds max, adjust it
      const memory = await getJavaMemory();
      if (memory > maxAllowedMB) {
        const adjustedMemory = Math.min(memory, maxAllowedMB);
        setJavaMemory(adjustedMemory);
        await saveJavaMemory(adjustedMemory);
      }
    } catch {
      // Silently fallback to 16GB max if command not implemented
      setMaxMemory(16384);
    }
  };

  const loadMinecraftData = async () => {
    try {
      await getMinecraftVersions();
      const version = await getAppVersion();
      setAppVersion(version);
    } catch (err) {
      console.error('Failed to load Minecraft data:', err);
    }
  };

  const loadJavaInstallations = async () => {
    try {
      setJavaLoading(true);
      const installations = await getJavaInstallations();
      setJavaInstallations(installations);
    } catch (err) {
      console.error('Failed to load Java installations:', err);
    } finally {
      setJavaLoading(false);
    }
  };

  const handleSetCustomJavaPath = async (version: number) => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Java Executable',
          extensions: ['exe']
        }]
      });

      if (selected && typeof selected === 'string') {
        await setCustomJavaPath(version, selected);
        await loadJavaInstallations();
      }
    } catch (err) {
      console.error('Failed to set Java path:', err);
    }
  };

  const handleResetJavaPath = async (version: number) => {
    try {
      await resetJavaPath(version);
      await loadJavaInstallations();
    } catch (err) {
      console.error('Failed to reset Java path:', err);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setMcLoading(true);
      await openMicrosoftLogin();
    } catch (err) {
      console.error('Login error:', err);
    } finally {
      setMcLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setMcProfile(null);
      localStorage.removeItem('minecraft_profile');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleToggleDiscordRpc = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableDiscordRpc();
      } else {
        await disableDiscordRpc();
      }
      setDiscordRpcEnabled(enabled);
      localStorage.setItem('discord_rpc_enabled', enabled.toString());
    } catch (err) {
      console.error('Failed to toggle Discord RPC:', err);
    }
  };

  const handleMemoryChange = async (value: number) => {
    setJavaMemory(value);
    try {
      await saveJavaMemory(value);
    } catch {
      // Silently fail if command not implemented
    }
  };

  const handleHoldDurationChange = (value: number) => {
    setHoldDuration(value);
    localStorage.setItem('hold_duration', value.toString());
    // Dispatch event to notify all HoldButtons
    window.dispatchEvent(new CustomEvent('holdDurationChanged', { detail: value }));
  };

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb} MB`;
  };

  if (!isOpen) return null;

  const TABS = [
    { id: 'account', icon: User, label: t('settings.account.title') },
    { id: 'general', icon: Settings, label: t('settings.general.title') },
    { id: 'java', icon: Coffee, label: t('settings.java.title') },
  ];

  return (
    <div className="fixed inset-0 bg-blue-950/20 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl w-full max-w-4xl h-[650px] shadow-2xl flex flex-col relative overflow-hidden">

        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#1a1a1a] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#0a0a0a] to-[#0f0f0f]">
          <div>
            <h2 className="text-xl font-black text-white mb-0.5">
              {t('settings.title')}
            </h2>
            <p className="text-xs text-gray-500 font-medium">Manage your launcher settings</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-[#1a1a1a] text-gray-400 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Main Split Content */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Sidebar Menu */}
          <div className="w-64 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col p-4 flex-shrink-0">
            <nav className="flex-1 space-y-1.5 mt-2">
              {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive
                      ? 'bg-[#1f6feb] text-white shadow-md' // Matches Modrinth's filled green pill style but with Limen Blue
                      : 'text-gray-400 hover:bg-[#1a1a1a] hover:text-gray-200'
                      }`}
                  >
                    <tab.icon size={18} className={isActive ? 'text-white' : 'text-gray-400'} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            {/* App Branding Info */}
            <div className="mt-auto px-2 flex items-center gap-3 text-xs text-gray-500 font-medium">
              <img
                src="/logo.png"
                alt="Limen Logo"
                className="w-8 h-8 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'block';
                }}
              />
              <Coffee size={28} className="text-[#1a1a1a] hidden" />
              <div>
                <p className="font-semibold text-gray-400">Limen</p>
                <p className="text-gray-600">v{appVersion || '0.0.0'}</p>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-[#050505]">

            {activeTab === 'account' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">{t('settings.account.title')}</h3>
                  <p className="text-gray-400 text-sm font-medium">{t('settings.account.description')}</p>
                </div>

                <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 shadow-sm">
                  {mcProfile ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                          <User size={24} className="text-gray-400" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">{t('settings.account.loggedInAs')}</p>
                          <p className="text-white font-bold text-lg leading-tight">{mcProfile.username}</p>
                          <p className="text-xs text-gray-400 mt-1 font-mono">{mcProfile.uuid}</p>
                        </div>
                      </div>
                      <Button
                        onClick={handleLogout}
                        className="bg-[#1a1a1a] hover:bg-red-900/50 text-red-500 hover:text-red-400 border border-[#2a2a2a] hover:border-red-900/50 px-6 py-2.5 rounded-lg font-semibold transition-all"
                      >
                        {t('settings.account.logout')}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <Button
                        onClick={handleMicrosoftLogin}
                        disabled={mcLoading}
                        className="w-full bg-[#1f6feb] hover:bg-[#388bfd] text-white gap-2 h-14 text-base font-bold rounded-xl shadow-lg shadow-blue-500/10"
                      >
                        {mcLoading ? <Loader2 size={20} className="animate-spin" /> : null}
                        {t('settings.account.loginMicrosoft')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">{t('settings.general.title')}</h3>
                  <p className="text-gray-400 text-sm font-medium">{t('settings.general.description')}</p>
                </div>

                <div className="space-y-6">
                  {/* Language Card (Mocking Modrinth's theme card style) */}
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-bold text-white">{t('settings.general.language')}</label>

                    {/* Translation Warning */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-200/90">
                      {t('settings.translationWarning')}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* English Option */}
                      <button
                        onClick={() => {
                          i18n.changeLanguage('en');
                          localStorage.setItem('language', 'en');
                        }}
                        className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] ${i18n.language === 'en'
                          ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                          : 'border-[#1a1a1a] hover:border-gray-600'
                          }`}
                      >
                        <div className="font-bold text-white mb-1">English</div>
                        <div className="text-xs text-gray-500">English (US)</div>
                      </button>

                      {/* Turkish Option */}
                      <button
                        onClick={() => {
                          i18n.changeLanguage('tr');
                          localStorage.setItem('language', 'tr');
                        }}
                        className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] ${i18n.language === 'tr'
                          ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                          : 'border-[#1a1a1a] hover:border-gray-600'
                          }`}
                      >
                        <div className="font-bold text-white mb-1">Türkçe</div>
                        <div className="text-xs text-gray-500">Turkish (Turkey)</div>
                      </button>

                      {/* Chinese Option */}
                      <button
                        onClick={() => {
                          i18n.changeLanguage('zh');
                          localStorage.setItem('language', 'zh');
                        }}
                        className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] ${i18n.language === 'zh'
                          ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                          : 'border-[#1a1a1a] hover:border-gray-600'
                          }`}
                      >
                        <div className="font-bold text-white mb-1">中文</div>
                        <div className="text-xs text-gray-500">Chinese (Simplified)</div>
                      </button>

                      {/* German Option */}
                      <button
                        onClick={() => {
                          i18n.changeLanguage('de');
                          localStorage.setItem('language', 'de');
                        }}
                        className={`p-4 rounded-xl border text-left transition-all bg-[#0a0a0a] ${i18n.language === 'de'
                          ? 'border-[#1f6feb] ring-1 ring-[#1f6feb] shadow-[0_0_15px_rgba(31,111,235,0.15)] bg-[#1f6feb]/5'
                          : 'border-[#1a1a1a] hover:border-gray-600'
                          }`}
                      >
                        <div className="font-bold text-white mb-1">Deutsch</div>
                        <div className="text-xs text-gray-500">German (Germany)</div>
                      </button>
                    </div>
                  </div>

                  {/* Memory Slider */}
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="text-sm font-bold text-white mb-1 block">{t('settings.general.javaMemory')}</label>
                        <p className="text-xs text-gray-500 font-medium">{t('settings.general.javaMemoryDescription')}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{formatMemory(javaMemory)}</div>
                        <div className="text-xs text-gray-500">
                          {javaMemory <= 2048 && 'Minimum'}
                          {javaMemory > 2048 && javaMemory <= 4096 && 'Recommended'}
                          {javaMemory > 4096 && javaMemory <= 6144 && 'High'}
                          {javaMemory > 6144 && 'Extreme'}
                        </div>
                      </div>
                    </div>
                    <Slider
                      value={javaMemory}
                      onValueChange={handleMemoryChange}
                      min={1024}
                      max={maxMemory}
                      step={512}
                      className="mt-4"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>1 GB</span>
                      <span>{formatMemory(maxMemory)}</span>
                    </div>
                  </div>

                  {/* Discord RPC */}
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 mt-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-bold text-white mb-1 block">{t('settings.general.discordRpc')}</label>
                        <p className="text-xs text-gray-500 font-medium">{t('settings.general.discordRpcDescription')}</p>
                      </div>
                      <button
                        onClick={() => handleToggleDiscordRpc(!discordRpcEnabled)}
                        className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${discordRpcEnabled ? 'bg-[#1f6feb]' : 'bg-[#1a1a1a]'
                          }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${discordRpcEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Hold Button Duration */}
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6 mt-8">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <label className="text-sm font-bold text-white mb-1 block">{t('settings.general.holdButtonDuration')}</label>
                        <p className="text-xs text-gray-500 font-medium">{t('settings.general.holdButtonDurationDescription')}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">{(holdDuration / 1000).toFixed(1)}s</div>
                        <div className="text-xs text-gray-500">
                          {holdDuration <= 1500 && t('settings.general.holdDurationQuick')}
                          {holdDuration > 1500 && holdDuration <= 3000 && t('settings.general.holdDurationNormal')}
                          {holdDuration > 3000 && t('settings.general.holdDurationSafe')}
                        </div>
                      </div>
                    </div>
                    <Slider
                      value={holdDuration}
                      onValueChange={handleHoldDurationChange}
                      min={500}
                      max={5000}
                      step={100}
                      className="mt-4"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-2">
                      <span>0.5s</span>
                      <span>5s</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'java' && (
              <div className="space-y-6 max-w-2xl">
                <div>
                  <h3 className="text-2xl font-black text-white mb-2">{t('settings.java.title')}</h3>
                  <p className="text-gray-400 text-sm font-medium">{t('settings.java.description')}</p>
                </div>

                {javaLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-[#1f6feb]" size={32} />
                  </div>
                ) : javaInstallations.length === 0 ? (
                  <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-8 text-center">
                    <Coffee size={48} className="mx-auto text-gray-600 mb-4" />
                    <p className="text-gray-400 font-medium">{t('settings.java.noInstallations')}</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {javaInstallations.map((java) => (
                      <div key={java.version} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-[#1a1a1a] rounded-lg flex items-center justify-center">
                              <Coffee size={24} className="text-[#1f6feb]" />
                            </div>
                            <div>
                              <h4 className="text-white font-bold text-lg">{t('settings.java.version', { version: java.version })}</h4>
                              <span className={`text-xs px-2 py-1 rounded ${java.is_custom
                                  ? 'bg-[#1f6feb]/20 text-[#1f6feb]'
                                  : 'bg-[#1a1a1a] text-gray-400'
                                }`}>
                                {java.is_custom ? t('settings.java.custom') : t('settings.java.system')}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleSetCustomJavaPath(java.version)}
                              className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white border border-[#2a2a2a] px-4 py-2 rounded-lg text-sm font-semibold"
                            >
                              {t('settings.java.setCustomPath')}
                            </Button>
                            {java.is_custom && (
                              <Button
                                onClick={() => handleResetJavaPath(java.version)}
                                className="bg-[#1a1a1a] hover:bg-red-900/50 text-red-500 hover:text-red-400 border border-[#2a2a2a] hover:border-red-900/50 px-4 py-2 rounded-lg text-sm font-semibold"
                              >
                                {t('settings.java.reset')}
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="bg-[#000000] border border-[#1a1a1a] rounded-lg p-3">
                          <p className="text-xs text-gray-500 font-semibold mb-1">{t('settings.java.path')}</p>
                          <p className="text-sm text-gray-300 font-mono break-all">{java.path}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
