import { useEffect, useState } from 'react';
import { fetchSkinTexture } from '../lib/tauri-commands';
import { getCachedSkin, setCachedSkin } from '../lib/skinCache';

interface SkinHeadViewerProps {
  uuid: string;
}

/**
 * Renders just the Minecraft head (8×8 front face + hat overlay)
 * using a pure 2D canvas, cached as a PNG data URL.
 * 
 * Zero WebGL contexts. Zero ongoing GPU cost.
 * After the first render, displays a cached <img> tag instantly.
 */
export function SkinHeadViewer({ uuid }: SkinHeadViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const cacheKey = `head:${uuid}`;


    const cached = getCachedSkin(cacheKey);
    if (cached) {
      setImageUrl(cached);
      return;
    }


    const renderHead = async () => {
      try {
        const base64Data = await fetchSkinTexture(uuid);
        if (!mounted) return;

        const img = await loadImage(base64Data);
        if (!mounted) return;

        const canvas = document.createElement('canvas');
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;


        const temp = document.createElement('canvas');
        temp.width = 64;
        temp.height = 64;
        const tctx = temp.getContext('2d')!;
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0);

        ctx.drawImage(temp, 8, 8, 8, 8, 0, 0, 8, 8);
        ctx.drawImage(temp, 40, 8, 8, 8, 0, 0, 8, 8);

        const dataUrl = canvas.toDataURL('image/png');
        setCachedSkin(cacheKey, dataUrl);

        if (mounted) {
          setImageUrl(dataUrl);
        }
      } catch (err) {
        console.error('Failed to render head skin:', err);
      }
    };

    renderHead();

    return () => {
      mounted = false;
    };
  }, [uuid]);

  if (!imageUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="w-4 h-4 border-2 border-[#1f6feb] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt="Head"
      className="w-full h-full"
      style={{ imageRendering: 'pixelated' }}
      draggable={false}
    />
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = src;
  });
}
