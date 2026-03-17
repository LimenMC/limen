import { useState, useEffect, useMemo, memo } from 'react';
import { Plus, Edit2, Trash2, FolderArchive, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RainbowButton } from '../components/ui/rainbow-button';
import GradientButton from '../components/kokonutui/gradient-button';
import HoldButton from '../components/kokonutui/hold-button';
import { ContextMenu } from '../components/ui/context-menu';
import { NewProfileModal } from '../components/NewProfileModal';
import { EditProfileModal } from '../components/EditProfileModal';
import { ProfileDetail } from './ProfileDetail';
import { getUniqueProfileName } from '../lib/utils';

interface Profile {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion: string;
  icon?: string;
  lastPlayed?: Date;
}

interface HomeProps {
  onLaunchProfile: (profile: Profile) => void;
  onArchiveProfile: (profile: Profile) => void;
  downloadProgress?: string;
}

interface ProfileCardProps {
  profile: Profile;
  onLaunch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isPlaying?: boolean;
  playDuration?: number;
}

const ProfileCard = memo(({ profile, onLaunch, onEdit, onDelete, onClick, onContextMenu, isPlaying, playDuration }: ProfileCardProps) => {
  const { t } = useTranslation();

  const formattedDuration = useMemo(() => {
    if (!playDuration) return '';
    
    const hours = Math.floor(playDuration / 3600);
    const minutes = Math.floor((playDuration % 3600) / 60);
    const secs = playDuration % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }, [playDuration]);

  return (
    <div
      className="relative bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#1f6feb] transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(31,111,235,0.1)] flex flex-col h-full"
      onContextMenu={onContextMenu}
    >
      {/* Content */}
      <div className="p-5 flex flex-col flex-1">
        {/* Header - Clickable */}
        <div
          className="group flex items-center gap-4 mb-5 cursor-pointer"
          onClick={onClick}
        >
          <div className="w-16 h-16 bg-[#000000] border border-[#1a1a1a] group-hover:border-[#1f6feb]/50 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors shadow-inner overflow-hidden">
            {profile.icon ? (
              <img src={profile.icon} alt={profile.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
            ) : (
              <span className="text-white text-2xl font-black opacity-90">
                {profile.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-xl truncate mb-1 group-hover:text-[#1f6feb] transition-colors">{profile.name}</h3>
            <p className="text-sm text-gray-400 font-medium">
              Minecraft {profile.version}
              {profile.loader !== 'vanilla' && (
                <span className="ml-1.5 opacity-80">
                  • {profile.loader.charAt(0).toUpperCase() + profile.loader.slice(1)}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Last Played */}
        {profile.lastPlayed && (
          <div className="mb-5 pb-5 border-b border-[#1a1a1a]">
            <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
              {t('home.lastPlayed')}: {profile.lastPlayed.toLocaleDateString()}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3 mt-auto">
          <GradientButton
            onClick={onLaunch}
            label={isPlaying ? t('home.playingFor', { duration: formattedDuration }) : t('home.playNow')}
            variant="emerald"
            className="w-full h-12 rounded-xl text-base"
            disabled={isPlaying}
          />

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="flex-1 px-3 py-2.5 rounded-xl bg-[#0a0a0a] hover:bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#1a1a1a] transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Edit2 size={16} />
              {t('common.edit')}
            </button>
            <HoldButton
              onComplete={onDelete}
              variant="red"
              size="sm"
              className="flex-1 h-[42px] rounded-xl"
            >
              {t('holdButton.delete')}
            </HoldButton>
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if these change
  return (
    prevProps.profile.id === nextProps.profile.id &&
    prevProps.profile.name === nextProps.profile.name &&
    prevProps.profile.icon === nextProps.profile.icon &&
    prevProps.profile.version === nextProps.profile.version &&
    prevProps.profile.loader === nextProps.profile.loader &&
    prevProps.isPlaying === nextProps.isPlaying &&
    prevProps.playDuration === nextProps.playDuration
  );
});

ProfileCard.displayName = 'ProfileCard';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function Home({ onLaunchProfile, onArchiveProfile, downloadProgress }: HomeProps) {
  const { t } = useTranslation();

  const loadProfiles = async (): Promise<Profile[]> => {
    try {
      // First try to load from Rust backend
      const { getMinecraftProfiles } = await import('../lib/tauri-commands');
      const backendProfiles = await getMinecraftProfiles();
      
      if (backendProfiles && backendProfiles.length > 0) {
        return backendProfiles.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          loader: p.loader,
          loaderVersion: p.loader_version,
          icon: p.icon,
          lastPlayed: p.last_played ? new Date(p.last_played) : undefined,
        }));
      }
      
      // Migrate from localStorage if exists
      const saved = localStorage.getItem('limen_profiles');
      if (saved) {
        const parsed = JSON.parse(saved);
        const profiles = parsed.map((p: any) => ({
          id: p.id,
          name: p.name,
          version: p.version,
          loader: p.loader,
          loader_version: p.loaderVersion,
          icon: p.icon,
          last_played: p.lastPlayed ? new Date(p.lastPlayed).getTime() : undefined,
        }));
        
        // Save to backend
        const { saveMinecraftProfiles } = await import('../lib/tauri-commands');
        await saveMinecraftProfiles(profiles);
        
        // Clear localStorage after migration
        localStorage.removeItem('limen_profiles');
        
        return parsed.map((p: any) => ({
          ...p,
          loaderVersion: p.loaderVersion,
          lastPlayed: p.lastPlayed ? new Date(p.lastPlayed) : undefined,
        }));
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
    
    // Return default profile
    return [
      {
        id: '1',
        name: 'Vanilla',
        version: '1.21.1',
        loader: 'vanilla',
        loaderVersion: '',
        lastPlayed: new Date(),
      },
    ];
  };

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [currentSession, setCurrentSession] = useState<{ profile_id: string; profile_name: string; start_time: number; pid?: number } | null>(null);
  const [playDuration, setPlayDuration] = useState<number>(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; profile: Profile } | null>(null);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles().then(setProfiles);
  }, []);

  const debouncedProfiles = useDebounce(profiles, 1000);

  useEffect(() => {
    if (debouncedProfiles.length === 0) return;
    
    const saveProfiles = async () => {
      try {
        const { saveMinecraftProfiles } = await import('../lib/tauri-commands');
        const backendProfiles = debouncedProfiles.map(p => ({
          id: p.id,
          name: p.name,
          version: p.version,
          loader: p.loader,
          loader_version: p.loaderVersion,
          icon: p.icon,
          last_played: p.lastPlayed ? p.lastPlayed.getTime() : undefined,
        }));
        await saveMinecraftProfiles(backendProfiles);
      } catch (err) {
        console.error('Failed to save profiles:', err);
      }
    };
    
    saveProfiles();
  }, [debouncedProfiles]);

  useEffect(() => {
    const handleStorageChange = async () => {
      const updatedProfiles = await loadProfiles();
      setProfiles(updatedProfiles);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('profilesChanged', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('profilesChanged', handleStorageChange);
    };
  }, []);

  // Poll game session status
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { getCurrentSession, getPlayDuration } = await import('../lib/tauri-commands');
        const session = await getCurrentSession();
        setCurrentSession(session);

        if (session) {
          const duration = await getPlayDuration();
          setPlayDuration(duration || 0);
        }
      } catch (err) {
        console.error('Failed to check session:', err);
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateProfile = (name: string, version: string, loader: string, loaderVersion: string, icon?: string) => {
    const finalName = getUniqueProfileName(name, profiles);

    const newProfile: Profile = {
      id: Date.now().toString(),
      name: finalName,
      version,
      loader,
      loaderVersion,
      icon,
    };

    setProfiles([...profiles, newProfile]);
    setShowCreateModal(false);
  };

  const handleDeleteProfile = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      onArchiveProfile(profile);
      setProfiles(profiles.filter(p => p.id !== id));
    }
  };

  const handleEditProfile = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    if (profile) {
      setEditingProfile(profile);
      setShowEditModal(true);
    }
  };

  const handleSaveProfile = (id: string, name: string, icon?: string) => {
    setProfiles(profiles.map(p =>
      p.id === id ? { ...p, name, icon } : p
    ));
    setShowEditModal(false);
    setEditingProfile(null);
  };

  const handleDuplicateProfile = (profile: Profile) => {
    const finalName = getUniqueProfileName(profile.name, profiles, '(Copy)');

    const newProfile: Profile = {
      ...profile,
      id: Date.now().toString(),
      name: finalName,
      lastPlayed: undefined,
    };

    const updatedProfiles = [...profiles, newProfile];
    setProfiles(updatedProfiles);

    try {
      localStorage.setItem('limen_profiles', JSON.stringify(updatedProfiles));
    } catch (err) {
      console.error('Failed to save profiles:', err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, profile: Profile) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      profile,
    });
  };

  if (selectedProfile) {
    return (
      <ProfileDetail
        profile={selectedProfile}
        onBack={() => setSelectedProfile(null)}
        onLaunch={() => onLaunchProfile(selectedProfile)}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-[#050505]">
      {/* Header */}
      <div className="p-8 border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="flex items-center justify-between mx-auto w-full px-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">{t('home.title')}</h1>
            <p className="text-base text-gray-400 font-medium">{t('home.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <RainbowButton
              onClick={() => setShowCreateModal(true)}
              size="lg"
              className="gap-2 rounded-xl text-base px-6 shadow-lg shadow-cyan-500/10"
            >
              <Plus size={20} />
              {t('home.newProfile')}
            </RainbowButton>
          </div>
        </div>
      </div>

      {/* Profiles Grid */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full px-4">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                onLaunch={() => onLaunchProfile(profile)}
                onEdit={() => handleEditProfile(profile.id)}
                onDelete={() => handleDeleteProfile(profile.id)}
                onClick={() => setSelectedProfile(profile)}
                onContextMenu={(e) => handleContextMenu(e, profile)}
                isPlaying={currentSession?.profile_id === profile.id}
                playDuration={currentSession?.profile_id === profile.id ? playDuration : 0}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Create Profile Modal */}
      <NewProfileModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProfile}
        downloadProgress={downloadProgress}
      />

      {/* Edit Profile Modal */}
      {editingProfile && (
        <EditProfileModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingProfile(null);
          }}
          profile={editingProfile}
          onSave={handleSaveProfile}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: t('common.edit'),
              icon: <Edit2 size={16} />,
              onClick: () => handleEditProfile(contextMenu.profile.id),
            },
            {
              label: t('home.duplicate'),
              icon: <Copy size={16} />,
              onClick: () => handleDuplicateProfile(contextMenu.profile),
            },
            {
              label: t('home.archive'),
              icon: <FolderArchive size={16} />,
              onClick: () => handleDeleteProfile(contextMenu.profile.id),
            },
            {
              label: t('common.delete'),
              icon: <Trash2 size={16} />,
              onClick: () => handleDeleteProfile(contextMenu.profile.id),
              variant: 'danger' as const,
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
