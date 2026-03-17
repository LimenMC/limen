import { useEffect, useRef, useState } from 'react';
import { User, Hand, Footprints, Zap, ArrowUp, Music } from 'lucide-react';
import { fetchSkinTexture, detectSkinModel } from '../lib/tauri-commands';
import { SkinRenderer, AnimState } from './SkinRenderer';

interface SkinViewerProps {
  uuid: string;
  username: string;
}

export function SkinViewer({ uuid }: SkinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SkinRenderer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [animation, setAnimation] = useState<AnimState>('idle');

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {

        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }


        const renderer = new SkinRenderer(containerRef.current!);
        rendererRef.current = renderer;

        setStatus('loading');


        const modelType = await detectSkinModel(uuid);
        if (!mounted || !rendererRef.current) return;

        rendererRef.current.setModelType(modelType);

        const base64Data = await fetchSkinTexture(uuid);
        if (!mounted || !rendererRef.current) return;

        rendererRef.current.loadSkin(base64Data);

        if (mounted) {
          setStatus('ready');
          setError(null);
        }
      } catch (err: any) {
        console.error('Error loading skin:', err);
        if (mounted) {
          setError(err?.message || 'Failed to load skin');
          setStatus('error');
        }
      }
    };

    init();

    return () => {
      mounted = false;
    };
  }, [uuid]);


  useEffect(() => {
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setAnimation(animation);
  }, [animation]);

  const animationIcons = {
    idle: User,
    wave: Hand,
    walk: Footprints,
    run: Zap,
    jump: ArrowUp,
    dance: Music,
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="relative flex-1 min-h-0">
        <div
          ref={containerRef}
          className="w-full h-full rounded-lg overflow-hidden"
          style={{ background: 'transparent' }}
        />

        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-[#1f6feb] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-gray-400">Loading skin...</p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                <span className="text-red-400 text-xl">✕</span>
              </div>
              <p className="text-sm text-red-400">Failed to load</p>
              <p className="text-xs text-gray-500">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 px-2 shrink-0 min-h-[40px]">
        {status === 'ready' && (
          <div className="grid grid-cols-6 gap-2">
            {(['idle', 'wave', 'walk', 'run', 'jump', 'dance'] as AnimState[]).map((anim) => {
              const Icon = animationIcons[anim];
              return (
                <button
                  key={anim}
                  onClick={() => setAnimation(anim)}
                  className={`aspect-square rounded-lg transition-all flex items-center justify-center ${animation === anim
                    ? 'bg-[#1f6feb] scale-105'
                    : 'bg-[#0a0a0a] hover:bg-[#1a1a1a] border border-[#1a1a1a]'
                    }`}
                  title={anim.charAt(0).toUpperCase() + anim.slice(1)}
                >
                  <Icon size={16} className={animation === anim ? 'text-white' : 'text-gray-400'} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
