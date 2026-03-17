import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { StatusNotification } from './components/StatusNotification';
import { SettingsModal } from './components/SettingsModal';
import { LoginRequiredModal } from './components/LoginRequiredModal';
import { UpdateNotification } from './components/UpdateNotification';
import { Home } from './pages/Home';
import { Discover } from './pages/Discover';
import { Archive } from './pages/Archive';
import { Skins } from './pages/Skins';
import { useAuth } from './hooks/useAuth';
import { useDownloadProgress } from './hooks/useDownloadProgress';
import { useDiscordActivity } from './hooks/useDiscordActivity';
import { getUniqueProfileName } from './lib/utils';
import { useProfileActions, type Profile } from './hooks/useProfileActions';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('home');
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginRequired, setShowLoginRequired] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(t('discover.sort.relevance'));
  const [archivedProfiles, setArchivedProfiles] = useState<Profile[]>([]);

  const { mcProfile, setMcProfile, mcStatus, setMcStatus } = useAuth();
  useDownloadProgress(setMcStatus);
  useDiscordActivity(activeTab);
  const { handleLaunchProfile, handleArchiveProfile } = useProfileActions(
    mcProfile,
    setMcStatus,
    setShowLoginRequired
  );

  useEffect(() => {
    const loadArchivedProfiles = async () => {
      try {
        const { getArchivedProfiles } = await import('./lib/tauri-commands');
        const archived = await getArchivedProfiles();
        setArchivedProfiles(
          archived.map((p: any) => ({
            ...p,
            lastPlayed: p.last_played ? new Date(p.last_played) : undefined,
            archivedAt: p.archived_at ? new Date(p.archived_at) : undefined,
          }))
        );
      } catch (err) {
        console.error('Failed to load archived profiles:', err);
      }
    };

    loadArchivedProfiles();
  }, []);

  const reloadArchivedProfiles = async () => {
    try {
      const { getArchivedProfiles } = await import('./lib/tauri-commands');
      const archived = await getArchivedProfiles();
      setArchivedProfiles(
        archived.map((p: any) => ({
          ...p,
          lastPlayed: p.last_played ? new Date(p.last_played) : undefined,
          archivedAt: p.archived_at ? new Date(p.archived_at) : undefined,
        }))
      );
    } catch (err) {
      console.error('Failed to reload archived profiles:', err);
    }
  };

  const onArchiveProfile = async (profile: Profile) => {
    await handleArchiveProfile(profile, reloadArchivedProfiles);
  };

  const handleRestoreProfile = async (id: string) => {
    try {
      setMcStatus(t('archive.restoringProfile'));

      const { restoreProfile } = await import('./lib/tauri-commands');
      const restoredProfile = await restoreProfile(id);

      // Load current profiles from backend
      const { getMinecraftProfiles, saveMinecraftProfiles } = await import('./lib/tauri-commands');
      const currentProfiles = await getMinecraftProfiles();

      const finalName = getUniqueProfileName(restoredProfile.name, currentProfiles);

      const profileToRestore = {
        id: restoredProfile.id,
        name: finalName,
        version: restoredProfile.version,
        loader: restoredProfile.loader,
        loader_version: restoredProfile.loader_version,
        icon: restoredProfile.icon,
      };

      const updatedProfiles = [...currentProfiles, profileToRestore];
      await saveMinecraftProfiles(updatedProfiles);

      setMcStatus(t('archive.profileRestored'));
      await reloadArchivedProfiles();

      // Trigger a custom event to notify Home component
      window.dispatchEvent(new Event('profilesChanged'));

      // Clear status after 3 seconds
      setTimeout(() => setMcStatus(''), 3000);
    } catch (err) {
      console.error('Failed to restore profile:', err);
      setMcStatus(`${t('common.error')}: Failed to restore profile`);
    }
  };

  const handleDeleteForever = async (id: string) => {
    try {
      const { deleteArchivedProfile } = await import('./lib/tauri-commands');
      await deleteArchivedProfile(id);
      await reloadArchivedProfiles();
    } catch (err) {
      console.error('Failed to delete archived profile:', err);
      setMcStatus(`${t('common.error')}: Failed to delete profile`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-black text-white overflow-hidden p-0">
      <TitleBar
        activeTab={activeTab}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <div className="flex-1 flex overflow-hidden bg-black pb-0 pr-0">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenSettings={() => setShowSettings(true)}
        />

        <main className="flex-1 flex overflow-hidden bg-[#050505] border-t border-l border-[#1a1a1a] rounded-tl-[1.5rem] shadow-2xl relative">
          {activeTab === 'home' && (
            <Home
              onLaunchProfile={handleLaunchProfile}
              onArchiveProfile={onArchiveProfile}
              downloadProgress={mcStatus}
            />
          )}
          {activeTab === 'discover' && (
            <Discover
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              sortBy={sortBy}
              onSortChange={setSortBy}
            />
          )}
          {activeTab === 'archive' && (
            <Archive
              archivedProfiles={archivedProfiles}
              onRestore={handleRestoreProfile}
              onDeleteForever={handleDeleteForever}
            />
          )}
          {activeTab === 'skins' && (
            <Skins mcProfile={mcProfile} onOpenSettings={() => setShowSettings(true)} />
          )}
        </main>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        mcProfile={mcProfile}
        setMcProfile={setMcProfile}
      />

      <LoginRequiredModal
        isOpen={showLoginRequired}
        onClose={() => setShowLoginRequired(false)}
        onLogin={() => {
          setShowLoginRequired(false);
          setShowSettings(true);
        }}
      />

      {mcStatus && <StatusNotification message={mcStatus} />}

      <UpdateNotification />
    </div>
  );
}

export default App;
