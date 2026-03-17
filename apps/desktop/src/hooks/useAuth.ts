import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useTranslation } from 'react-i18next';
import { authenticateMicrosoft } from '../lib/tauri-commands';

export interface McProfile {
  username: string;
  uuid: string;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
}

export function useAuth() {
  const { t } = useTranslation();
  const [mcProfile, setMcProfile] = useState<McProfile | null>(null);
  const [mcStatus, setMcStatus] = useState('');

  useEffect(() => {
    const unlistenAuth = listen('auth-code-received', async (event: any) => {
      try {
        setMcStatus(t('settings.messages.authenticating'));

        const profile = await authenticateMicrosoft(event.payload);

        setMcProfile(profile);
        setMcStatus(t('settings.messages.loggedInAs', { username: profile.username }));
        
        setTimeout(() => {
          setMcStatus('');
        }, 3000);
      } catch (err) {
        console.error('Auth error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setMcStatus(`${t('common.error')}: ${errorMessage}`);
        
        setTimeout(() => {
          setMcStatus('');
        }, 5000);
      }
    });

    return () => {
      unlistenAuth.then(fn => fn());
    };
  }, [t]);

  useEffect(() => {
    loadCurrentProfile();
    
    // Check and refresh token every hour to keep it alive
    // Microsoft refresh tokens expire after 90 days of inactivity
    // By checking hourly, we ensure the token never becomes inactive
    const interval = setInterval(async () => {
      try {
        const { checkAndRefreshToken } = await import('../lib/tauri-commands');
        const profile = await checkAndRefreshToken();
        
        if (profile) {
          setMcProfile(profile);
        }
        // Never clear profile automatically, only on manual logout
      } catch (err) {
        console.error('Failed to refresh token:', err);
        // Keep current profile even on error
      }
    }, 60 * 60 * 1000); // Check every hour
    
    return () => clearInterval(interval);
  }, [t]);

  const loadCurrentProfile = async () => {
    try {
      const { checkAndRefreshToken } = await import('../lib/tauri-commands');
      const profile = await checkAndRefreshToken();
      
      if (profile) {
        setMcProfile(profile);
        const message = t('settings.messages.loggedInAs', { username: profile.username });
        setMcStatus(message);
        
        setTimeout(() => {
          setMcStatus('');
        }, 3000);
      } else {
        setMcProfile(null);
        setMcStatus('');
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setMcProfile(null);
      setMcStatus('');
    }
  };

  return { mcProfile, setMcProfile, mcStatus, setMcStatus };
}
