import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';

export function useDownloadProgress(setMcStatus: (status: string) => void) {
  useEffect(() => {
    const unlistenProgress = listen('download-progress', (event: any) => {
      const data = event.payload as any;
      if (data.progress !== undefined) {
        setMcStatus(`${data.message} (${data.progress}%)`);
      } else {
        setMcStatus(data.message || data);
      }
    });

    return () => {
      unlistenProgress.then(fn => fn());
    };
  }, [setMcStatus]);
}
