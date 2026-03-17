import { useEffect, useRef, useState } from 'react';
import { fetchSkinTexture, detectSkinModel, readLocalSkinFile } from '../lib/tauri-commands';
import { getCachedSkin, setCachedSkin } from '../lib/skinCache';
import { SkinRenderer, ModelType } from './SkinRenderer';

interface SkinCardViewerProps {
  uuid?: string;
  filePath?: string;
  modelType?: ModelType;
  animated?: boolean;
}

let renderQueue: Promise<void> = Promise.resolve();

function enqueueRender<T>(fn: () => Promise<T>): Promise<T> {
  const task = renderQueue.then(fn, fn);
  renderQueue = task.then(() => { }, () => { });
  return task;
}

export function SkinCardViewer({ uuid, filePath, modelType, animated = false }: SkinCardViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SkinRenderer | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // ── 3D Animated mode (main viewer panel, single interactive instance) ──
  useEffect(() => {
    if (!animated || !containerRef.current) return;

    let mounted = true;

    const init = async () => {
      try {
        if (rendererRef.current) {
          rendererRef.current.dispose();
          rendererRef.current = null;
        }

        const renderer = new SkinRenderer(containerRef.current!);
        rendererRef.current = renderer;
        setLoading(true);

        let base64Data: string;
        let detectedModel: ModelType;

        if (uuid) {
          detectedModel = await detectSkinModel(uuid);
          if (!mounted || !rendererRef.current) return;
          base64Data = await fetchSkinTexture(uuid);
        } else if (filePath && modelType) {
          detectedModel = modelType;
          base64Data = await readLocalSkinFile(filePath);
        } else {
          throw new Error('Either uuid or filePath+modelType must be provided');
        }

        if (!mounted || !rendererRef.current) return;

        rendererRef.current.setModelType(detectedModel);
        rendererRef.current.loadSkin(base64Data);

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('Failed to load skin card:', err);
        if (mounted) setLoading(false);
      }
    };

    init();
    return () => { mounted = false; };
  }, [uuid, filePath, modelType, animated]);


  useEffect(() => {
    if (!animated) return;
    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, [animated]);


  useEffect(() => {
    if (animated) return;

    let mounted = true;
    const cacheKey = uuid ? `card:${uuid}` : `card:file:${filePath}`;

    const cached = getCachedSkin(cacheKey);
    if (cached) {
      setImageUrl(cached);
      setLoading(false);
      return;
    }


    const renderSnapshot = async () => {
      try {
        setLoading(true);

        let base64Data: string;
        let detectedModel: ModelType;

        if (uuid) {
          detectedModel = await detectSkinModel(uuid);
          if (!mounted) return;
          base64Data = await fetchSkinTexture(uuid);
        } else if (filePath && modelType) {
          detectedModel = modelType;
          base64Data = await readLocalSkinFile(filePath);
        } else {
          throw new Error('Either uuid or filePath+modelType must be provided');
        }

        if (!mounted) return;


        const dataUrl = await enqueueRender(async () => {

          const offscreen = document.createElement('div');
          offscreen.style.width = '512px';
          offscreen.style.height = '512px';
          offscreen.style.position = 'fixed';
          offscreen.style.left = '-9999px';
          offscreen.style.top = '-9999px';
          offscreen.style.pointerEvents = 'none';
          offscreen.style.visibility = 'hidden';
          document.body.appendChild(offscreen);


          void offscreen.offsetHeight;

          try {

            const renderer = new SkinRenderer(offscreen, { preserveDrawingBuffer: true });
            renderer.setAnimationEnabled(false);
            renderer.setControlsEnabled(false);
            renderer.setCameraPosition(-3, 22, 34);
            renderer.setCharacterPosition(0, -6, 0);
            renderer.setCameraZoom(1.15);
            renderer.setCharacterRotation(-0.4);
            renderer.setModelType(detectedModel);
            renderer.loadSkin(base64Data);


            await waitForSkinRender(base64Data);


            const canvas = offscreen.querySelector('canvas');
            const captured = canvas?.toDataURL('image/png') || '';


            renderer.dispose();

            return captured;
          } finally {
            document.body.removeChild(offscreen);
          }
        });

        if (!mounted || !dataUrl) return;


        setCachedSkin(cacheKey, dataUrl);

        if (mounted) {
          setImageUrl(dataUrl);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to render skin snapshot:', err);
        if (mounted) setLoading(false);
      }
    };

    renderSnapshot();
    return () => { mounted = false; };
  }, [uuid, filePath, modelType, animated]);


  if (animated) {
    return (
      <div
        ref={containerRef}
        className="w-full h-full relative"
        style={{ background: 'transparent' }}
      >
        {loading && <LoadingSpinner />}
      </div>
    );
  }


  return (
    <div className="w-full h-full relative flex items-center justify-center">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Skin"
          className="w-full h-full object-contain"
          draggable={false}
        />
      ) : loading ? (
        <LoadingSpinner />
      ) : null}
    </div>
  );
}



function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center z-10">
      <div className="w-8 h-8 border-2 border-[#1f6feb] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
}

/**
 * Wait for a skin data URL image to decode, then wait 2 animation frames
 * so the SkinRenderer has fully processed and rendered the skin.
 */
function waitForSkinRender(dataUrl: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    };
    img.onerror = () => resolve(); // proceed anyway
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  });
}
