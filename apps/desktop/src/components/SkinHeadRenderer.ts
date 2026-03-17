import * as THREE from 'three';

const TEX_W = 64;
const TEX_H = 64;

interface Rect { x: number; y: number; w: number; h: number; }

interface CubeUVLayout {
  top: Rect;
  bottom: Rect;
  front: Rect;
  back: Rect;
  right: Rect;
  left: Rect;
}

function cubeUV(ox: number, oy: number, w: number, h: number, d: number): CubeUVLayout {
  return {
    top: { x: ox + d, y: oy, w, h: d },
    bottom: { x: ox + d + w, y: oy, w, h: d },
    right: { x: ox, y: oy + d, w: d, h },
    front: { x: ox + d, y: oy + d, w, h },
    left: { x: ox + d + w, y: oy + d, w: d, h },
    back: { x: ox + 2 * d + w, y: oy + d, w, h },
  };
}

const HEAD_UV = cubeUV(0, 0, 8, 8, 8);
const HAT_UV = cubeUV(32, 0, 8, 8, 8);

function setFaceUV(
  arr: Float32Array, face: number, r: Rect,
  flipU = false, flipV = false
): void {
  const off = face * 8;
  let u0 = r.x / TEX_W;
  let u1 = (r.x + r.w) / TEX_W;
  let v0 = 1 - (r.y + r.h) / TEX_H;
  let v1 = 1 - r.y / TEX_H;
  if (flipU) { const t = u0; u0 = u1; u1 = t; }
  if (flipV) { const t = v0; v0 = v1; v1 = t; }

  arr[off + 0] = u0; arr[off + 1] = v1;
  arr[off + 2] = u1; arr[off + 3] = v1;
  arr[off + 4] = u0; arr[off + 5] = v0;
  arr[off + 6] = u1; arr[off + 7] = v0;
}

function applyUVs(geom: THREE.BoxGeometry, uv: CubeUVLayout): void {
  const attr = geom.getAttribute('uv') as THREE.BufferAttribute;
  const a = attr.array as Float32Array;

  setFaceUV(a, 0, uv.left);
  setFaceUV(a, 1, uv.right);
  setFaceUV(a, 2, uv.top);
  setFaceUV(a, 3, uv.bottom, true, true);
  setFaceUV(a, 4, uv.front);
  setFaceUV(a, 5, uv.back);

  attr.needsUpdate = true;
}

export class SkinHeadRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private headMesh: THREE.Mesh | null = null;
  private hatMesh: THREE.Mesh | null = null;
  private baseMat: THREE.MeshStandardMaterial;
  private overlayMat: THREE.MeshStandardMaterial;
  private tex: THREE.Texture | null = null;
  private animId: number | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private isVisible = true;
  private isPaused = false;
  private lastRenderTime = 0;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = null;

    const w = container.clientWidth || 128;
    const h = container.clientHeight || 128;

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 20);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp'
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);


    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.6);
    d1.position.set(5, 10, 10);
    this.scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xffffff, 0.4);
    d2.position.set(-5, 5, -10);
    this.scene.add(d2);


    this.baseMat = new THREE.MeshStandardMaterial({
      side: THREE.FrontSide,
      alphaTest: 0.5,
      metalness: 0,
      roughness: 1,
      flatShading: false,
    });
    this.overlayMat = new THREE.MeshStandardMaterial({
      side: THREE.FrontSide,
      transparent: true,
      alphaTest: 0.5,
      metalness: 0,
      roughness: 1,
      flatShading: false,
      depthWrite: false,
      depthTest: true,
    });

    this.buildHead();
    this.setupVisibilityObserver(container);
    this.animate();
  }

  loadSkin(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);

      const t = new THREE.CanvasTexture(c);
      t.magFilter = THREE.NearestFilter;
      t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.anisotropy = 1;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;

      this.tex?.dispose();
      this.tex = t;
      this.baseMat.map = t;
      this.baseMat.needsUpdate = true;
      this.overlayMat.map = t;
      this.overlayMat.needsUpdate = true;
    };
    img.onerror = (e) => console.error('Head image load error:', e);
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  }

  dispose(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
    this.renderer.domElement.parentElement?.removeChild(this.renderer.domElement);
    this.renderer.dispose();
    this.scene.clear();
    this.baseMat.dispose();
    this.overlayMat.dispose();
    this.tex?.dispose();
  }

  private setupVisibilityObserver(container: HTMLElement): void {
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          
          if (entry.isIntersecting && this.isPaused) {
            this.isPaused = false;
          } else if (!entry.isIntersecting && !this.isPaused) {
            this.isPaused = true;
          }
        });
      },
      { threshold: 0.1 }
    );
    
    this.visibilityObserver.observe(container);
  }

  private buildHead(): void {

    const headGeom = new THREE.BoxGeometry(8, 8, 8);
    applyUVs(headGeom, HEAD_UV);
    this.headMesh = new THREE.Mesh(headGeom, this.baseMat);
    this.scene.add(this.headMesh);


    const hatGeom = new THREE.BoxGeometry(8, 8, 8);
    applyUVs(hatGeom, HAT_UV);
    this.hatMesh = new THREE.Mesh(hatGeom, this.overlayMat);
    this.hatMesh.scale.set(1.05, 1.05, 1.05);
    this.scene.add(this.hatMesh);


    this.headMesh.rotation.y = Math.PI * 0.2;
    this.headMesh.rotation.x = -Math.PI * 0.05;
    this.hatMesh.rotation.y = Math.PI * 0.2;
    this.hatMesh.rotation.x = -Math.PI * 0.05;
  }

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate);
    
    if (this.isPaused || !this.isVisible) {
      return;
    }
    
    const now = Date.now();
    if (now - this.lastRenderTime < 66) return;
    this.lastRenderTime = now;
    
    this.renderer.render(this.scene, this.camera);
  };
}
