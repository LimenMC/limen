import { useState, useEffect } from 'react';
import { X, Download, ExternalLink } from 'lucide-react';
import { checkForUpdates, downloadUpdate, type UpdateInfo } from '../lib/tauri-commands';
import { Button } from './ui/button';

export function UpdateNotification() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Check for updates on mount
    const checkUpdates = async () => {
      try {
        const info = await checkForUpdates();
        if (info.available) {
          setUpdateInfo(info);
          setIsVisible(true);
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
      }
    };

    checkUpdates();

    // Check every 6 hours
    const interval = setInterval(checkUpdates, 6 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDownload = async () => {
    if (!updateInfo?.download_url) return;
    
    try {
      setIsDownloading(true);
      await downloadUpdate(updateInfo.download_url);
    } catch (err) {
      console.error('Failed to download update:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isVisible || !updateInfo) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 bg-[#0a0a0a] border border-[#1f6feb] rounded-xl shadow-2xl shadow-[#1f6feb]/20 overflow-hidden animate-slideIn">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1f6feb] to-[#388bfd] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Download size={18} className="text-white" />
          <h3 className="text-white font-bold text-sm">Update Available</h3>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white/80 hover:text-white transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-3">
          <p className="text-white text-sm font-semibold mb-1">
            Version {updateInfo.latest_version} is now available!
          </p>
          <p className="text-gray-400 text-xs">
            You're currently on version {updateInfo.current_version}
          </p>
        </div>

        {updateInfo.release_notes && (
          <div className="mb-4 p-3 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a] max-h-32 overflow-y-auto">
            <p className="text-xs text-gray-300 whitespace-pre-wrap">
              {updateInfo.release_notes.slice(0, 200)}
              {updateInfo.release_notes.length > 200 && '...'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex-1 bg-[#1f6feb] hover:bg-[#388bfd] text-white font-semibold text-sm py-2 rounded-lg transition-all"
          >
            {isDownloading ? (
              'Opening...'
            ) : (
              <>
                <Download size={14} className="mr-1.5" />
                Download Update
              </>
            )}
          </Button>
          <Button
            onClick={() => setIsVisible(false)}
            className="px-4 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-400 hover:text-white border border-[#2a2a2a] font-semibold text-sm py-2 rounded-lg transition-all"
          >
            Later
          </Button>
        </div>

        {updateInfo.download_url && (
          <a
            href={updateInfo.download_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 mt-3 text-xs text-[#1f6feb] hover:text-[#388bfd] transition-colors"
          >
            <ExternalLink size={12} />
            View on GitHub
          </a>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }

        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
