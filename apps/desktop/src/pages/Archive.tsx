import { useTranslation } from 'react-i18next';
import { RotateCcw } from 'lucide-react';
import HoldButton from '../components/kokonutui/hold-button';

interface Profile {
  id: string;
  name: string;
  version: string;
  loader: string;
  loaderVersion: string;
  icon?: string;
  lastPlayed?: Date;
  archivedAt?: Date;
}

interface ArchiveProps {
  archivedProfiles: Profile[];
  onRestore: (id: string) => void;
  onDeleteForever: (id: string) => void;
}

export function Archive({ archivedProfiles, onRestore, onDeleteForever }: ArchiveProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col w-full h-full bg-[#050505]">
      {/* Header */}
      <div className="p-8 border-b border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="flex items-center justify-between mx-auto w-full px-4">
          <div>
            <h1 className="text-3xl font-black text-white mb-2">{t('archive.title')}</h1>
            <p className="text-base text-gray-400 font-medium">{t('archive.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto w-full px-4">
          {archivedProfiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-24 h-24 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center mb-6">
                <img 
                  src="/general/archive.svg" 
                  alt="Archive"
                  className="w-10 h-10 opacity-40"
                />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">{t('archive.noArchived')}</h2>
              <p className="text-gray-500 text-sm max-w-md">{t('archive.noArchivedSubtitle')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-6">
              {archivedProfiles.map((profile) => (
                <div
                  key={profile.id}
                  className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden hover:border-[#1f6feb] transition-all duration-300 group shadow-lg hover:shadow-[0_0_20px_rgba(31,111,235,0.1)]"
                >
                  <div className="p-5">
                    {/* Profile Info */}
                    <div className="flex items-center gap-4 mb-5">
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

                    {/* Archived Date */}
                    {profile.archivedAt && (
                      <div className="mb-5 pb-5 border-b border-[#1a1a1a]">
                        <p className="text-xs text-gray-500 font-medium tracking-wide uppercase">
                          Archived: {profile.archivedAt.toLocaleDateString()}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRestore(profile.id)}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-[#1f6feb] hover:bg-[#1a5ecf] text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        <RotateCcw size={16} />
                        {t('archive.restore')}
                      </button>
                      <HoldButton
                        onComplete={() => onDeleteForever(profile.id)}
                        variant="red"
                        size="sm"
                        className="flex-1 h-[42px] rounded-xl"
                      >
                        {t('archive.deleteForever')}
                      </HoldButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
