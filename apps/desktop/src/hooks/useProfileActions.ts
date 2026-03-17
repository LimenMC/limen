import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getMinecraftVersions } from '../lib/tauri-commands';
import type { McProfile } from './useAuth';

export interface Profile {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion: string;
  icon?: string;
  lastPlayed?: Date;
  archivedAt?: Date;
}

interface LaunchProgressPayload {
  stage: string;
  message: string;
}

export function useProfileActions(
  mcProfile: McProfile | null,
  setMcStatus: (status: string) => void,
  setShowLoginRequired: (show: boolean) => void
) {
  const { t } = useTranslation();

  useEffect(() => {
    const unlisten = listen<LaunchProgressPayload>('launch-progress', (event) => {
      const { message } = event.payload;
      setMcStatus(message);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setMcStatus]);

  const handleLaunchProfile = async (profile: {
    version: string;
    loader?: string;
    loaderVersion?: string;
    id: string;
    name: string;
  }) => {
    try {
      if (!mcProfile || !mcProfile.uuid || !mcProfile.access_token) {
        setShowLoginRequired(true);
        return;
      }

      setMcStatus(t('settings.messages.preparingLaunch'));

      if (!profile.loader || profile.loader === 'vanilla') {
        const versions = await getMinecraftVersions();
        if (!versions.includes(profile.version)) {
          setMcStatus(t('settings.messages.versionNotFound'));
          return;
        }
      }

      const { launchWithLoader } = await import('../lib/tauri-commands');

      await launchWithLoader(
        profile.version,
        profile.loader || 'vanilla',
        profile.loaderVersion || '',
        mcProfile.username,
        mcProfile.uuid,
        mcProfile.access_token,
        profile.id,
        profile.name
      );

      setTimeout(() => setMcStatus(''), 5000);
    } catch (err) {
      console.error('Launch error:', err);
      let errorMessage = t('common.error') + ': ';

      if (err instanceof Error) {
        errorMessage += err.message;
      } else if (typeof err === 'string') {
        errorMessage += err;
      } else if (err && typeof err === 'object') {
        errorMessage += JSON.stringify(err);
      } else {
        errorMessage += String(err);
      }

      setMcStatus(errorMessage);
      setTimeout(() => setMcStatus(''), 5000);
    }
  };

  const handleArchiveProfile = async (profile: Profile, onSuccess: () => void) => {
    try {
      const { archiveProfile } = await import('../lib/tauri-commands');
      await archiveProfile(
        profile.id,
        profile.name,
        profile.version,
        profile.loader,
        profile.loaderVersion,
        profile.icon
      );
      onSuccess();
    } catch (err) {
      console.error('Failed to archive profile:', err);
      setMcStatus(`${t('common.error')}: Failed to archive profile`);
    }
  };

  return { handleLaunchProfile, handleArchiveProfile };
}
