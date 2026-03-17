import { useEffect } from 'react';
import { updateDiscordActivity } from '../lib/tauri-commands';

export function useDiscordActivity(activeTab: string) {
  useEffect(() => {
    const updateRpcActivity = async () => {
      try {
        if (activeTab === 'home') {
          await updateDiscordActivity('idle');
        } else if (activeTab === 'discover') {
          await updateDiscordActivity('browsing');
        } else if (activeTab === 'archive') {
          await updateDiscordActivity('idle');
        } else if (activeTab === 'skins') {
          await updateDiscordActivity('idle');
        }
      } catch (err) {
        console.error('Failed to update Discord activity:', err);
      }
    };

    updateRpcActivity();
  }, [activeTab]);
}
