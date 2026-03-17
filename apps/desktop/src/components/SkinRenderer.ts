
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type ModelType = 'steve' | 'alex';
export type AnimState = 'idle' | 'wave' | 'walk' | 'run' | 'jump' | 'dance';

const TEX_W = 64;
const TEX_H = 64;
const OVERLAY_SCALE = 1.05;

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
const BODY_UV = cubeUV(16, 16, 8, 12, 4);
const R_ARM_STEVE_UV = cubeUV(40, 16, 4, 12, 4);
const R_ARM_ALEX_UV = cubeUV(40, 16, 3, 12, 4);
const R_LEG_UV = cubeUV(0, 16, 4, 12, 4);
const L_LEG_UV = cubeUV(16, 48, 4, 12, 4);
const L_ARM_STEVE_UV = cubeUV(32, 48, 4, 12, 4);
const L_ARM_ALEX_UV = cubeUV(32, 48, 3, 12, 4);

const HAT_UV = cubeUV(32, 0, 8, 8, 8);
const JACKET_UV = cubeUV(16, 32, 8, 12, 4);
const R_ARM_OVR_STEVE_UV = cubeUV(40, 32, 4, 12, 4);
const R_ARM_OVR_ALEX_UV = cubeUV(40, 32, 3, 12, 4);
const R_LEG_OVR_UV = cubeUV(0, 32, 4, 12, 4);
const L_LEG_OVR_UV = cubeUV(0, 48, 4, 12, 4);
const L_ARM_OVR_STEVE_UV = cubeUV(48, 48, 4, 12, 4);
const L_ARM_OVR_ALEX_UV = cubeUV(48, 48, 3, 12, 4);

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

function createLimbGroup(
  w: number, h: number, d: number,
  uv: CubeUVLayout, mat: THREE.Material,
  groupPos: [number, number, number],
  meshOffset: [number, number, number],
  scale?: number
): THREE.Group {
  const g = new THREE.BoxGeometry(w, h, d);
  applyUVs(g, uv);
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set(...meshOffset);
  if (scale) mesh.scale.set(scale, scale, scale);

  const group = new THREE.Group();
  group.position.set(...groupPos);
  group.add(mesh);
  return group;
}

function createPart(
  w: number, h: number, d: number,
  uv: CubeUVLayout, mat: THREE.Material,
  pos: [number, number, number], scale?: number
): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  applyUVs(g, uv);
  const m = new THREE.Mesh(g, mat);
  m.position.set(...pos);
  if (scale) m.scale.set(scale, scale, scale);
  return m;
}

interface AnimBones {
  head: THREE.Group;
  body: THREE.Mesh;
  rightArm: THREE.Group;
  leftArm: THREE.Group;
  rightLeg: THREE.Group;
  leftLeg: THREE.Group;
  headOvr: THREE.Group;
  bodyOvr: THREE.Mesh;
  rightArmOvr: THREE.Group;
  leftArmOvr: THREE.Group;
  rightLegOvr: THREE.Group;
  leftLegOvr: THREE.Group;
}

export class SkinRenderer {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private playerGroup: THREE.Group;
  private overlayGroup: THREE.Group;
  private baseMat: THREE.MeshStandardMaterial;
  private overlayMat: THREE.MeshStandardMaterial;
  private animId: number | null = null;
  private animOn = true;
  private clock: THREE.Clock;
  private model: ModelType = 'steve';
  private tex: THREE.Texture | null = null;
  private showOvr = true;

  private bones: AnimBones | null = null;
  private animState: AnimState = 'idle';
  private animTimer = 0;
  private nextWaveIn = 5;
  private waveProgress = 0;
  private jumpProgress = 0;
  private autoPlay = true;
  private resizeObserver: ResizeObserver | null = null;
  private visibilityObserver: IntersectionObserver | null = null;
  private isVisible = true;
  private isPaused = false;
  private lastRenderTime = 0;

  constructor(container: HTMLElement, options?: { preserveDrawingBuffer?: boolean }) {

    this.scene = new THREE.Scene();
    this.scene.background = null;

    const w = container.clientWidth || 400;
    const h = container.clientHeight || 400;

    this.camera = new THREE.PerspectiveCamera(
      45, w / h, 0.1, 1000
    );
    this.camera.position.set(0, 16, 45);

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      preserveDrawingBuffer: options?.preserveDrawingBuffer ?? false,
    });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    container.appendChild(this.renderer.domElement);


    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 80;
    this.controls.target.set(0, 16, 0);
    this.controls.update();

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.6);
    d1.position.set(5, 20, 10);
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
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.playerGroup = new THREE.Group();
    this.overlayGroup = new THREE.Group();
    this.playerGroup.renderOrder = 0;
    this.overlayGroup.renderOrder = 1;
    this.scene.add(this.playerGroup);
    this.scene.add(this.overlayGroup);

    this.clock = new THREE.Clock();

    this.resizeObserver = new ResizeObserver((entries) => {

      for (const entry of entries) {
        if (entry.target === container) {
          const w = entry.contentRect.width || container.clientWidth;
          const h = entry.contentRect.height || container.clientHeight;
          if (!w || !h) return;
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        }
      }
    });
    this.resizeObserver.observe(container);

    this.buildModel();
    this.setupVisibilityObserver(container);
    this.animate();

  }

  loadSkin(dataUrl: string): void {
    const img = new Image();
    img.onload = () => {

      const c = document.createElement('canvas');
      c.width = 64; c.height = 64;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      if (img.height === 32) this.convertLegacy(ctx);

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
      this.buildModel();

    };
    img.onerror = () => { };
    img.crossOrigin = 'anonymous';
    img.src = dataUrl;
  }

  setModelType(t: ModelType): void {
    if (this.model === t) return;
    this.model = t;
    this.buildModel();
  }

  setOverlayVisible(v: boolean): void {
    this.showOvr = v;
    this.overlayGroup.visible = v;
  }

  setAnimationEnabled(v: boolean): void {
    this.animOn = v;
    if (!v) this.resetPose();
  }

  setControlsEnabled(v: boolean): void {
    this.controls.enabled = v;
  }

  setCameraPosition(x: number, y: number, z: number): void {
    this.camera.position.set(x, y, z);
    this.controls.update();
  }

  setCameraZoom(zoom: number): void {
    this.camera.zoom = zoom;
    this.camera.updateProjectionMatrix();
  }

  setCharacterRotation(y: number): void {
    this.playerGroup.rotation.y = y;
    this.overlayGroup.rotation.y = y;
  }

  setCharacterPosition(x: number, y: number, z: number): void {
    this.playerGroup.position.set(x, y, z);
    this.overlayGroup.position.set(x, y, z);
  }

  setAnimation(state: AnimState): void {
    this.animState = state;
    this.animTimer = 0;
    this.waveProgress = 0;
    this.jumpProgress = 0;
    this.autoPlay = (state === 'idle');
    this.resetPose();
  }

  getAnimation(): AnimState {
    return this.animState;
  }

  getModelType(): ModelType {
    return this.model;
  }

  dispose(): void {
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    this.animId = null;
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.visibilityObserver) {
      this.visibilityObserver.disconnect();
      this.visibilityObserver = null;
    }
    this.controls.dispose();
    this.disposeGroupChildren(this.playerGroup);
    this.disposeGroupChildren(this.overlayGroup);
    this.renderer.domElement.parentElement?.removeChild(this.renderer.domElement);
    this.renderer.dispose();
    this.scene.clear();
    this.baseMat.dispose();
    this.overlayMat.dispose();
    this.tex?.dispose();
    this.bones = null;
  }

  private setupVisibilityObserver(container: HTMLElement): void {
    this.visibilityObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          this.isVisible = entry.isIntersecting;
          
          if (entry.isIntersecting && this.isPaused) {
            this.resume();
          } else if (!entry.isIntersecting && !this.isPaused) {
            this.pause();
          }
        });
      },
      { threshold: 0.1 }
    );
    
    this.visibilityObserver.observe(container);
  }

  private pause(): void {
    this.isPaused = true;
  }

  private resume(): void {
    this.isPaused = false;
    this.clock.start();
  }

  private convertLegacy(ctx: CanvasRenderingContext2D): void {
    this.mirrorRegion(ctx, 0, 16, 16, 16, 16, 48);
    this.mirrorRegion(ctx, 40, 16, 16, 16, 32, 48);
  }

  private mirrorRegion(
    ctx: CanvasRenderingContext2D,
    sx: number, sy: number, sw: number, sh: number,
    dx: number, dy: number
  ): void {
    const d = ctx.getImageData(sx, sy, sw, sh);
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    const tc = tmp.getContext('2d')!;
    tc.putImageData(d, 0, 0);
    ctx.save();
    ctx.translate(dx + sw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  }

  private disposeGroupChildren(group: THREE.Group): void {
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
      }
    });
    group.clear();
  }

  private buildModel(): void {
    this.disposeGroupChildren(this.playerGroup);
    this.disposeGroupChildren(this.overlayGroup);

    const alex = this.model === 'alex';
    const aw = alex ? 3 : 4;
    const ax = 4 + aw / 2;

    const bm = this.baseMat, om = this.overlayMat;

    const headGroup = createLimbGroup(8, 8, 8, HEAD_UV, bm, [0, 24, 0], [0, 4, 0]);
    const headOvrGroup = createLimbGroup(8, 8, 8, HAT_UV, om, [0, 24, 0], [0, 4, 0], OVERLAY_SCALE);

    const bodyMesh = createPart(8, 12, 4, BODY_UV, bm, [0, 18, 0]);
    const bodyOvrMesh = createPart(8, 12, 4, JACKET_UV, om, [0, 18, 0], OVERLAY_SCALE);

    const rArmGroup = createLimbGroup(
      aw, 12, 4,
      alex ? R_ARM_ALEX_UV : R_ARM_STEVE_UV,
      bm, [-ax, 24, 0], [0, -6, 0]
    );
    const rArmOvrGroup = createLimbGroup(
      aw, 12, 4,
      alex ? R_ARM_OVR_ALEX_UV : R_ARM_OVR_STEVE_UV,
      om, [-ax, 24, 0], [0, -6, 0], OVERLAY_SCALE
    );

    const lArmGroup = createLimbGroup(
      aw, 12, 4,
      alex ? L_ARM_ALEX_UV : L_ARM_STEVE_UV,
      bm, [ax, 24, 0], [0, -6, 0]
    );
    const lArmOvrGroup = createLimbGroup(
      aw, 12, 4,
      alex ? L_ARM_OVR_ALEX_UV : L_ARM_OVR_STEVE_UV,
      om, [ax, 24, 0], [0, -6, 0], OVERLAY_SCALE
    );

    const rLegGroup = createLimbGroup(4, 12, 4, R_LEG_UV, bm, [-2, 12, 0], [0, -6, 0]);
    const rLegOvrGroup = createLimbGroup(4, 12, 4, R_LEG_OVR_UV, om, [-2, 12, 0], [0, -6, 0], OVERLAY_SCALE);

    const lLegGroup = createLimbGroup(4, 12, 4, L_LEG_UV, bm, [2, 12, 0], [0, -6, 0]);
    const lLegOvrGroup = createLimbGroup(4, 12, 4, L_LEG_OVR_UV, om, [2, 12, 0], [0, -6, 0], OVERLAY_SCALE);

    this.playerGroup.add(headGroup, bodyMesh, rArmGroup, lArmGroup, rLegGroup, lLegGroup);
    this.overlayGroup.add(headOvrGroup, bodyOvrMesh, rArmOvrGroup, lArmOvrGroup, rLegOvrGroup, lLegOvrGroup);
    this.overlayGroup.visible = this.showOvr;

    this.bones = {
      head: headGroup,
      body: bodyMesh,
      rightArm: rArmGroup,
      leftArm: lArmGroup,
      rightLeg: rLegGroup,
      leftLeg: lLegGroup,
      headOvr: headOvrGroup,
      bodyOvr: bodyOvrMesh,
      rightArmOvr: rArmOvrGroup,
      leftArmOvr: lArmOvrGroup,
      rightLegOvr: rLegOvrGroup,
      leftLegOvr: lLegOvrGroup,
    };

    this.animTimer = 0;
    this.waveProgress = 0;
    this.jumpProgress = 0;
    this.nextWaveIn = 3 + Math.random() * 4;
  }

  private resetPose(): void {
    if (!this.bones) return;
    const b = this.bones;

    b.head.rotation.set(0, 0, 0);
    b.headOvr.rotation.set(0, 0, 0);
    b.rightArm.rotation.set(0, 0, 0);
    b.rightArmOvr.rotation.set(0, 0, 0);
    b.leftArm.rotation.set(0, 0, 0);
    b.leftArmOvr.rotation.set(0, 0, 0);
    b.rightLeg.rotation.set(0, 0, 0);
    b.rightLegOvr.rotation.set(0, 0, 0);
    b.leftLeg.rotation.set(0, 0, 0);
    b.leftLegOvr.rotation.set(0, 0, 0);

    this.playerGroup.rotation.set(0, 0, 0);
    this.overlayGroup.rotation.set(0, 0, 0);
    this.playerGroup.scale.set(1, 1, 1);
    this.overlayGroup.scale.set(1, 1, 1);
    this.playerGroup.position.set(0, 0, 0);
    this.overlayGroup.position.set(0, 0, 0);
  }

  private syncBone(base: THREE.Group | THREE.Mesh, ovr: THREE.Group | THREE.Mesh): void {
    ovr.rotation.copy(base.rotation);
  }

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate);

    if (this.isPaused || !this.isVisible) {
      return;
    }

    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    let needsRender = false;

    if (this.animOn && this.bones) {
      this.animTimer += dt;
      this.updateAnimation(t, dt);
      needsRender = true;
    }

    if (this.controls.enabled) {
      const controlsChanged = this.controls.update();
      if (controlsChanged) needsRender = true;
    }

    if (this.animState === 'idle' && !needsRender) {
      const now = Date.now();
      if (now - this.lastRenderTime < 66) return;
      this.lastRenderTime = now;
    }

    if (needsRender || this.animOn) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  private updateAnimation(t: number, dt: number): void {
    const b = this.bones!;

    switch (this.animState) {
      case 'idle':
        this.animateIdle(t, b);
        if (this.autoPlay) {
          this.nextWaveIn -= dt;
          if (this.nextWaveIn <= 0) {
            const r = Math.random();
            if (r < 0.5) {
              this.animState = 'wave';
              this.waveProgress = 0;
            } else {
              this.animState = 'jump';
              this.jumpProgress = 0;
            }
          }
        }
        break;
      case 'wave':
        this.animateWave(t, dt, b);
        break;
      case 'walk':
        this.animateWalk(t, b, 2.5, 0.6, false);
        break;
      case 'run':
        this.animateRun(t, b);
        break;
      case 'jump':
        this.animateJump(t, dt, b);
        break;
      case 'dance':
        this.animateDance(t, b);
        break;
    }

    this.syncBone(b.head, b.headOvr);
    this.syncBone(b.rightArm, b.rightArmOvr);
    this.syncBone(b.leftArm, b.leftArmOvr);
    this.syncBone(b.rightLeg, b.rightLegOvr);
    this.syncBone(b.leftLeg, b.leftLegOvr);
  }

  private animateIdle(t: number, b: AnimBones): void {
    const breathe = 1 + Math.sin(t * 1.8) * 0.004;
    this.playerGroup.scale.y = breathe;
    this.overlayGroup.scale.y = breathe;

    const sway = Math.sin(t * 0.4) * 0.04;
    this.playerGroup.rotation.y = sway;
    this.overlayGroup.rotation.y = sway;

    b.head.rotation.y = Math.sin(t * 0.7) * 0.12;
    b.head.rotation.x = Math.sin(t * 0.5) * 0.05;

    b.rightArm.rotation.x = Math.sin(t * 0.8) * 0.04;
    b.rightArm.rotation.z = Math.sin(t * 0.6) * 0.02 + 0.03;
    b.leftArm.rotation.x = Math.sin(t * 0.8 + 0.5) * 0.04;
    b.leftArm.rotation.z = -(Math.sin(t * 0.6 + 0.3) * 0.02 + 0.03);

    const bob = Math.sin(t * 1.8) * 0.05;
    this.playerGroup.position.y = bob;
    this.overlayGroup.position.y = bob;
  }

  private animateWave(t: number, dt: number, b: AnimBones): void {
    this.waveProgress += dt;
    const waveDuration = 3.8;
    const progress = this.waveProgress / waveDuration;

    if (progress >= 1.0) {
      if (this.autoPlay) {
        this.animState = 'idle';
        this.nextWaveIn = 6 + Math.random() * 8;
      }
      this.waveProgress = 0;
      return;
    }

    const breathe = 1 + Math.sin(t * 1.8) * 0.004;
    this.playerGroup.scale.y = breathe;
    this.overlayGroup.scale.y = breathe;

    const bob = Math.sin(t * 1.8) * 0.05;
    this.playerGroup.position.y = bob;
    this.overlayGroup.position.y = bob;

    let raise: number;
    if (progress < 0.12) {
      raise = this.easeOutCubic(progress / 0.12);
    } else if (progress < 0.82) {
      raise = 1;
    } else {
      raise = 1 - this.easeInCubic((progress - 0.82) / 0.18);
    }

    const raiseZ = -2.4 * raise;
    let waveOsc = 0;
    if (progress >= 0.10 && progress < 0.84) {
      const waveT = (progress - 0.10) / 0.74;
      const waveEnvelope = Math.sin(waveT * Math.PI);
      waveOsc = Math.sin(waveT * Math.PI * 9) * 0.35 * waveEnvelope;
    }

    b.rightArm.rotation.z = raiseZ + waveOsc;
    b.rightArm.rotation.x = -0.15 * raise;
    b.head.rotation.z = -0.12 * raise;
  }

  private animateWalk(t: number, b: AnimBones, speed: number, amplitude: number, isRun: boolean): void {
    const s = t * speed;
    const legSwing = Math.sin(s) * amplitude;
    b.rightLeg.rotation.x = legSwing;
    b.leftLeg.rotation.x = -legSwing;

    const armSwing = Math.sin(s) * amplitude * 1.1;
    b.rightArm.rotation.x = -armSwing;
    b.leftArm.rotation.x = armSwing;

    const bobHeight = Math.abs(Math.sin(s)) * (isRun ? 1.5 : 0.5);
    this.playerGroup.position.y = bobHeight;
    this.overlayGroup.position.y = bobHeight;
  }

  private animateRun(t: number, b: AnimBones): void {
    this.animateWalk(t, b, 5.5, 1.1, true);
  }

  private animateJump(_t: number, dt: number, b: AnimBones): void {
    this.jumpProgress += dt;
    const jumpDuration = 1.6;
    const progress = this.jumpProgress / jumpDuration;

    if (progress >= 1.0) {
      if (this.autoPlay) {
        this.animState = 'idle';
        this.nextWaveIn = 5 + Math.random() * 6;
      }
      this.jumpProgress = 0;
      this.resetPose();
      return;
    }

    const crouchEnd = 0.18;
    const peakTime = 0.50;
    const landStart = 0.80;
    const peakHeight = 14;
    const crouchDepth = -2.0;

    let jumpY = 0;

    if (progress < crouchEnd) {
      const p = progress / crouchEnd;
      const ease = Math.sin(p * Math.PI * 0.5);
      jumpY = crouchDepth * ease;
    } else if (progress < landStart) {
      const airTime = landStart - crouchEnd;
      const p = (progress - crouchEnd) / airTime;
      const parabola = 4 * p * (1 - p);
      const liftOff = (1 - p) * crouchDepth * (1 - Math.min(p * 5, 1));
      jumpY = parabola * peakHeight + liftOff;
    } else {
      const p = (progress - landStart) / (1.0 - landStart);
      const impact = Math.sin(p * Math.PI) * 1.5 * (1 - p);
      jumpY = -impact;
    }

    this.playerGroup.position.y = jumpY;
    this.overlayGroup.position.y = jumpY;


    let bodyTilt = 0;
    if (progress < crouchEnd) {
      const p = progress / crouchEnd;
      bodyTilt = 0.12 * Math.sin(p * Math.PI * 0.5);
    } else if (progress < peakTime) {
      const p = (progress - crouchEnd) / (peakTime - crouchEnd);
      bodyTilt = 0.12 * (1 - p) - 0.08 * p;
    } else if (progress < landStart) {
      const p = (progress - peakTime) / (landStart - peakTime);
      bodyTilt = -0.08 + 0.15 * p;
    } else {
      const p = (progress - landStart) / (1.0 - landStart);
      bodyTilt = 0.07 * Math.sin(p * Math.PI) * (1 - p * 0.5);
    }
    this.playerGroup.rotation.x = bodyTilt;
    this.overlayGroup.rotation.x = bodyTilt;


    if (progress < crouchEnd) {
      const p = Math.sin((progress / crouchEnd) * Math.PI * 0.5);
      b.rightArm.rotation.x = 0.6 * p;
      b.leftArm.rotation.x = 0.6 * p;
      b.rightArm.rotation.z = 0.15 * p;
      b.leftArm.rotation.z = -0.15 * p;
    } else if (progress < peakTime) {
      const p = this.easeOutCubic((progress - crouchEnd) / (peakTime - crouchEnd));
      b.rightArm.rotation.x = 0.6 - 1.5 * p;
      b.leftArm.rotation.x = 0.6 - 1.5 * p;
      b.rightArm.rotation.z = 0.15 + 0.55 * p;
      b.leftArm.rotation.z = -0.15 - 0.55 * p;
    } else if (progress < landStart) {
      const p = (progress - peakTime) / (landStart - peakTime);
      b.rightArm.rotation.x = -0.9 + 0.6 * p;
      b.leftArm.rotation.x = -0.9 + 0.6 * p;
      b.rightArm.rotation.z = 0.7 - 0.3 * p;
      b.leftArm.rotation.z = -0.7 + 0.3 * p;
    } else {
      const p = this.easeOutCubic((progress - landStart) / (1.0 - landStart));
      b.rightArm.rotation.x = -0.3 * (1 - p);
      b.leftArm.rotation.x = -0.3 * (1 - p);
      b.rightArm.rotation.z = 0.4 * (1 - p);
      b.leftArm.rotation.z = -0.4 * (1 - p);
    }


    if (progress < crouchEnd) {
      const p = Math.sin((progress / crouchEnd) * Math.PI * 0.5);
      b.rightLeg.rotation.x = -0.5 * p;
      b.leftLeg.rotation.x = -0.5 * p;
      b.rightLeg.rotation.z = -0.06 * p;
      b.leftLeg.rotation.z = 0.06 * p;
    } else if (progress < crouchEnd + 0.08) {
      const p = this.easeOutCubic((progress - crouchEnd) / 0.08);
      b.rightLeg.rotation.x = -0.5 * (1 - p);
      b.leftLeg.rotation.x = -0.5 * (1 - p);
      b.rightLeg.rotation.z = -0.06 * (1 - p);
      b.leftLeg.rotation.z = 0.06 * (1 - p);
    } else if (progress < peakTime) {
      const p = (progress - crouchEnd - 0.08) / (peakTime - crouchEnd - 0.08);
      b.rightLeg.rotation.x = 0.2 * p;
      b.leftLeg.rotation.x = -0.25 * p;
      b.rightLeg.rotation.z = -0.04 * p;
      b.leftLeg.rotation.z = 0.04 * p;
    } else if (progress < landStart) {
      const p = (progress - peakTime) / (landStart - peakTime);
      b.rightLeg.rotation.x = 0.2 - 0.5 * p;
      b.leftLeg.rotation.x = -0.25 + 0.05 * p;
      b.rightLeg.rotation.z = -0.04;
      b.leftLeg.rotation.z = 0.04;
    } else {
      const p = (progress - landStart) / (1.0 - landStart);
      const bend = Math.sin(p * Math.PI) * (1 - p * 0.3);
      b.rightLeg.rotation.x = -0.3 * (1 - p) - 0.35 * bend;
      b.leftLeg.rotation.x = -0.2 * (1 - p) - 0.35 * bend;
      b.rightLeg.rotation.z = -0.04 * (1 - p);
      b.leftLeg.rotation.z = 0.04 * (1 - p);
    }


    if (progress < crouchEnd) {
      const p = progress / crouchEnd;
      b.head.rotation.x = 0.2 * Math.sin(p * Math.PI * 0.5);
    } else if (progress < peakTime) {
      const p = this.easeOutCubic((progress - crouchEnd) / (peakTime - crouchEnd));
      b.head.rotation.x = 0.2 * (1 - p) - 0.25 * p;
    } else if (progress < landStart) {
      const p = (progress - peakTime) / (landStart - peakTime);
      b.head.rotation.x = -0.25 + 0.4 * p;
    } else {
      const p = this.easeOutCubic((progress - landStart) / (1.0 - landStart));
      b.head.rotation.x = 0.15 * (1 - p);
    }
    b.head.rotation.y = 0;
    b.head.rotation.z = 0;


    if (progress >= landStart) {
      const p = (progress - landStart) / (1.0 - landStart);
      const squish = Math.sin(p * Math.PI) * 0.06 * (1 - p);
      this.playerGroup.scale.set(1 + squish * 0.5, 1 - squish, 1 + squish * 0.5);
      this.overlayGroup.scale.set(1 + squish * 0.5, 1 - squish, 1 + squish * 0.5);
    } else {
      this.playerGroup.scale.set(1, 1, 1);
      this.overlayGroup.scale.set(1, 1, 1);
    }

    this.playerGroup.rotation.y = 0;
    this.overlayGroup.rotation.y = 0;
    this.playerGroup.rotation.z = 0;
    this.overlayGroup.rotation.z = 0;
  }

  private animateDance(t: number, b: AnimBones): void {
    const bpm = 120;
    const beatTime = 60 / bpm;
    const patternTime = beatTime * 4;
    const phase = (t % patternTime) / patternTime;

    const bounceY = Math.abs(Math.sin(t * Math.PI * (bpm / 30))) * 1.8;
    this.playerGroup.position.y = bounceY;
    this.overlayGroup.position.y = bounceY;

    const squash = 1 - Math.abs(Math.sin(t * Math.PI * (bpm / 30))) * 0.04;
    this.playerGroup.scale.y = squash;
    this.overlayGroup.scale.y = squash;
    this.playerGroup.scale.x = 1 + (1 - squash) * 0.5;
    this.overlayGroup.scale.x = 1 + (1 - squash) * 0.5;

    if (phase < 0.25) {
      const p = phase / 0.25;
      const ease = Math.sin(p * Math.PI);

      this.playerGroup.rotation.z = 0.15 * ease;
      this.overlayGroup.rotation.z = 0.15 * ease;

      b.rightArm.rotation.z = -1.8 * ease;
      b.rightArm.rotation.x = -0.3 * ease;
      b.leftArm.rotation.z = -0.1;
      b.leftArm.rotation.x = 0.3 * ease;

      b.rightLeg.rotation.x = 0;
      b.rightLeg.rotation.z = -0.1 * ease;
      b.leftLeg.rotation.x = -0.2 * ease;
      b.leftLeg.rotation.z = 0;

      b.head.rotation.z = 0.15 * ease;
      b.head.rotation.y = 0.2 * ease;

    } else if (phase < 0.5) {
      const p = (phase - 0.25) / 0.25;
      const ease = Math.sin(p * Math.PI);

      this.playerGroup.rotation.z = -0.15 * ease;
      this.overlayGroup.rotation.z = -0.15 * ease;

      b.leftArm.rotation.z = 1.8 * ease;
      b.leftArm.rotation.x = -0.3 * ease;
      b.rightArm.rotation.z = 0.1;
      b.rightArm.rotation.x = 0.3 * ease;

      b.leftLeg.rotation.x = 0;
      b.leftLeg.rotation.z = 0.1 * ease;
      b.rightLeg.rotation.x = -0.2 * ease;
      b.rightLeg.rotation.z = 0;

      b.head.rotation.z = -0.15 * ease;
      b.head.rotation.y = -0.2 * ease;

    } else if (phase < 0.75) {
      const p = (phase - 0.5) / 0.25;
      const ease = Math.sin(p * Math.PI);

      this.playerGroup.rotation.z = 0;
      this.overlayGroup.rotation.z = 0;

      b.rightArm.rotation.z = (-0.8 - 0.4 * Math.sin(p * Math.PI * 2)) * ease;
      b.rightArm.rotation.x = 0;
      b.leftArm.rotation.z = (0.8 + 0.4 * Math.sin(p * Math.PI * 2)) * ease;
      b.leftArm.rotation.x = 0;

      b.rightLeg.rotation.x = 0.5 * Math.sin(p * Math.PI * 2);
      b.leftLeg.rotation.x = -0.5 * Math.sin(p * Math.PI * 2);
      b.rightLeg.rotation.z = 0;
      b.leftLeg.rotation.z = 0;

      b.head.rotation.z = 0;
      b.head.rotation.y = Math.sin(p * Math.PI * 2) * 0.3;
      b.head.rotation.x = -0.1 * ease;

    } else {
      const p = (phase - 0.75) / 0.25;
      const ease = Math.sin(p * Math.PI);

      this.playerGroup.rotation.y = p * Math.PI * 2;
      this.overlayGroup.rotation.y = p * Math.PI * 2;
      this.playerGroup.rotation.z = 0;
      this.overlayGroup.rotation.z = 0;

      b.rightArm.rotation.z = -2.0 * ease;
      b.rightArm.rotation.x = Math.sin(p * Math.PI * 4) * 0.3;
      b.leftArm.rotation.z = 2.0 * ease;
      b.leftArm.rotation.x = Math.sin(p * Math.PI * 4 + Math.PI) * 0.3;

      b.rightLeg.rotation.x = 0;
      b.leftLeg.rotation.x = 0;
      b.rightLeg.rotation.z = -0.05 * ease;
      b.leftLeg.rotation.z = 0.05 * ease;

      b.head.rotation.z = Math.sin(p * Math.PI * 4) * 0.15;
      b.head.rotation.y = 0;
      b.head.rotation.x = -0.1 * ease;
    }

    this.playerGroup.rotation.x = 0;
    this.overlayGroup.rotation.x = 0;
  }

  private easeOutCubic(x: number): number {
    return 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  }

  private easeInCubic(x: number): number {
    const cx = Math.max(0, Math.min(1, x));
    return cx * cx * cx;
  }
}
