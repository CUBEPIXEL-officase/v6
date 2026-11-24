import * as THREE from 'three';

export interface LoadTextureOptions {
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  colorSpace?: THREE.ColorSpace;
  anisotropy?: number;
}

export interface RoomTextureManager {
  readonly maxAnisotropy: number;
  readonly loadingManager: THREE.LoadingManager;
  loadTexture: (url: string, opts?: LoadTextureOptions) => THREE.Texture;
  registerTexture: <T extends THREE.Texture>(tex: T) => T;
  cloneTexture: (base: THREE.Texture, repeatX: number, repeatY: number) => THREE.Texture;
  waitForPending: (timeoutMs?: number) => Promise<void>;
  getPendingCount: () => number;
  getFloorTexture: () => THREE.Texture;
  getWallTexture: () => THREE.Texture;
  getTabletopTexture: () => THREE.Texture;
  getCeilingTexture: () => THREE.Texture;
  getCarvedPlaqueTexture: (labelText: string) => THREE.Texture;
  getDoorEngraving1F: () => THREE.Texture;
  getDoorEngraving2F: () => THREE.Texture;
  getDoorEngravingB1: () => THREE.Texture;
  getGrayOakFloorBaseTex: () => THREE.Texture;
  getWhitePlasterWallBaseTex: () => THREE.Texture;
  getLightWoodBaseTex: () => THREE.Texture;
  getCoolWhiteWoodBaseTex: () => THREE.Texture;
  getWhiteOakWoodTexture: () => THREE.Texture;
  getHandwrittenZhaWuTexture: () => THREE.Texture;
  getCatScratchFabricBaseTex: () => THREE.Texture;
  getCurtainFabricBaseTex: () => THREE.Texture;
  disposeAll: () => void;
}

export function createRoomTextureManager(
  renderer: THREE.WebGLRenderer,
  onProgress?: (progress: number, loaded: number, total: number) => void
): RoomTextureManager {
  const maxAnisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const urlCache = new Map<string, THREE.Texture>();
  const ownedTextures = new Set<THREE.Texture>();
  const carvedPlaqueCache = new Map<string, THREE.Texture>();

  let pendingCount = 0;
  let idleWaiters: Array<() => void> = [];
  let disposed = false;

  const notifyIdleWaitersIfDone = () => {
    if (pendingCount <= 0) {
      pendingCount = 0;
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  };

  const loadingManager = new THREE.LoadingManager(
    () => {
      pendingCount = 0;
      onProgress?.(1, 1, 1);
      notifyIdleWaitersIfDone();
    },
    (_url, itemsLoaded, itemsTotal) => {
      const total = Math.max(1, itemsTotal);
      pendingCount = Math.max(0, itemsTotal - itemsLoaded);
      onProgress?.(Math.min(1, itemsLoaded / total), itemsLoaded, itemsTotal);
      if (itemsLoaded >= itemsTotal) {
        notifyIdleWaitersIfDone();
      }
    },
    () => {
      // Keep error non-blocking so a missing or slow asset never stalls loading
      pendingCount = Math.max(0, pendingCount - 1);
      notifyIdleWaitersIfDone();
    }
  );

  loadingManager.onStart = (_url, itemsLoaded, itemsTotal) => {
    const total = Math.max(1, itemsTotal);
    pendingCount = Math.max(pendingCount, itemsTotal - itemsLoaded);
    onProgress?.(Math.min(1, itemsLoaded / total), itemsLoaded, itemsTotal);
  };

  const textureLoader = new THREE.TextureLoader(loadingManager);

  const registerTexture = <T extends THREE.Texture>(tex: T): T => {
    ownedTextures.add(tex);
    return tex;
  };

  const loadTexture = (url: string, opts?: LoadTextureOptions): THREE.Texture => {
    const wrapS = opts?.wrapS ?? THREE.ClampToEdgeWrapping;
    const wrapT = opts?.wrapT ?? THREE.ClampToEdgeWrapping;
    const colorSpace = opts?.colorSpace ?? THREE.SRGBColorSpace;
    const cacheKey = `${url}|${wrapS}|${wrapT}|${colorSpace}`;

    const existing = urlCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    pendingCount += 1;
    const tex = textureLoader.load(
      url,
      () => {
        if (disposed) {
          tex.dispose();
          return;
        }
        tex.needsUpdate = true;
      },
      undefined,
      () => {
        // Error callback handled by LoadingManager as well
      }
    );
    tex.colorSpace = colorSpace;
    tex.wrapS = wrapS;
    tex.wrapT = wrapT;
    tex.anisotropy = opts?.anisotropy ?? maxAnisotropy;
    urlCache.set(cacheKey, tex);
    ownedTextures.add(tex);
    return tex;
  };

  const cloneTexture = (
    base: THREE.Texture,
    repeatX: number,
    repeatY: number
  ): THREE.Texture => {
    const cloned = base.clone();
    cloned.repeat.set(repeatX, repeatY);
    cloned.needsUpdate = true;
    ownedTextures.add(cloned);
    return cloned;
  };

  const waitForPending = (timeoutMs = 3500): Promise<void> => {
    if (pendingCount <= 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(done, timeoutMs);
      idleWaiters.push(done);
    });
  };

  // --- Procedural Base Textures (lazy memoized) ---
  let floorTex: THREE.Texture | null = null;
  let wallTex: THREE.Texture | null = null;
  let tabletopTex: THREE.Texture | null = null;
  let ceilingTex: THREE.Texture | null = null;
  let grayOakTex: THREE.Texture | null = null;
  let whitePlasterTex: THREE.Texture | null = null;
  let lightWoodTex: THREE.Texture | null = null;
  let coolWhiteWoodTex: THREE.Texture | null = null;
  let whiteOakTex: THREE.Texture | null = null;
  let zhaWuTex: THREE.Texture | null = null;
  let catScratchTex: THREE.Texture | null = null;
  let curtainTex: THREE.Texture | null = null;

  const getFloorTexture = (): THREE.Texture => {
    if (floorTex) return floorTex;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#140c07';
    ctx.fillRect(0, 0, 1024, 1024);

    const rows = 16;
    const rowHeight = 1024 / rows;
    const plankCols = 4;
    const colWidth = 1024 / plankCols;
    const woodPalette = [
      '#28160d', '#201108', '#2d190f', '#190d06',
      '#23130b', '#1c0e07', '#2a170e', '#1e0f08',
    ];

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight;
      const colShift = (r % 2) * (colWidth / 2);

      for (let c = -1; c <= plankCols; c++) {
        const x = c * colWidth + colShift;
        const colorIdx = Math.floor(
          (Math.sin(r * 12.3 + c * 33.7) * 0.5 + 0.5) * woodPalette.length
        );
        ctx.fillStyle = woodPalette[colorIdx % woodPalette.length];
        ctx.fillRect(x + 1, y + 1, colWidth - 2, rowHeight - 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        for (let g = 3; g < rowHeight - 3; g += 5) {
          ctx.fillRect(x + 2, y + g, colWidth - 4, 1.5);
        }
        ctx.fillStyle = 'rgba(180, 120, 80, 0.05)';
        for (let g = 6; g < rowHeight - 3; g += 8) {
          ctx.fillRect(x + 2, y + g, colWidth - 4, 1);
        }

        ctx.fillStyle = 'rgba(4, 2, 1, 0.8)';
        ctx.fillRect(x, y + rowHeight - 2, colWidth, 2);
        ctx.fillRect(x + colWidth - 2, y, 2, rowHeight);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 5);
    floorTex = registerTexture(texture);
    return floorTex;
  };

  const getWallTexture = (): THREE.Texture => {
    if (wallTex) return wallTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#080402';
    ctx.fillRect(0, 0, 512, 512);

    const numSlats = 16;
    const slatWidth = 512 / numSlats;
    const gap = 3;

    for (let s = 0; s < numSlats; s++) {
      const x = s * slatWidth;
      const w = slatWidth - gap;

      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0.0, '#3b2214');
      grad.addColorStop(0.2, '#2c180d');
      grad.addColorStop(0.8, '#1e0f07');
      grad.addColorStop(1.0, '#120703');

      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, w, 512);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      for (let gx = 3; gx < w - 2; gx += 4) {
        ctx.fillRect(x + gx, 0, 1.2, 512);
      }
      ctx.fillStyle = 'rgba(180, 110, 60, 0.12)';
      ctx.fillRect(x + 1, 0, 1.5, 512);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    wallTex = registerTexture(texture);
    return wallTex;
  };

  const getTabletopTexture = (): THREE.Texture => {
    if (tabletopTex) return tabletopTex;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0, '#26140b');
    bgGrad.addColorStop(0.5, '#301a0e');
    bgGrad.addColorStop(1, '#201008');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 512);

    for (let y = 0; y < 512; y += 3) {
      const alpha = Math.sin(y * 0.1) * 0.04 + 0.12;
      ctx.fillStyle = `rgba(10, 5, 2, ${alpha})`;
      ctx.fillRect(0, y, 1024, 1.5);
    }

    ctx.fillStyle = 'rgba(210, 150, 90, 0.05)';
    ctx.fillRect(0, 40, 1024, 60);
    ctx.fillRect(0, 260, 1024, 50);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    tabletopTex = registerTexture(texture);
    return tabletopTex;
  };

  const getCeilingTexture = (): THREE.Texture => {
    if (ceilingTex) return ceilingTex;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#14100c';
    ctx.fillRect(0, 0, 256, 256);

    ctx.fillStyle = 'rgba(255, 240, 225, 0.02)';
    for (let i = 0; i < 400; i++) {
      const rx = ((Math.sin(i * 19.3) * 0.5 + 0.5) * 256);
      const ry = ((Math.cos(i * 37.7) * 0.5 + 0.5) * 256);
      ctx.fillRect(rx, ry, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    ceilingTex = registerTexture(texture);
    return ceilingTex;
  };

  const createCarvedFloorTexture = (floorText: string): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    const bg = ctx.createLinearGradient(0, 0, 768, 192);
    bg.addColorStop(0, '#2a160b');
    bg.addColorStop(0.5, '#331c0f');
    bg.addColorStop(1, '#200f07');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 768, 192);

    for (let y = 0; y < 192; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(0,0,0,0.22)' : 'rgba(180,120,70,0.06)';
      ctx.fillRect(0, y, 768, 1.5);
    }

    ctx.strokeStyle = 'rgba(10, 4, 2, 0.85)';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, 740, 164);
    ctx.strokeStyle = 'rgba(215, 165, 92, 0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(19, 19, 730, 154);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isAsciiCode = /^[A-Z0-9]+$/.test(floorText);
    let fontSize = isAsciiCode
      ? 106
      : floorText.length <= 2
        ? 96
        : floorText.length <= 4
          ? 84
          : floorText.length <= 5
            ? 74
            : floorText.length <= 6
              ? 68
              : 62;
    const fontStack = isAsciiCode
      ? 'Georgia, "Times New Roman", serif'
      : '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", Georgia, serif';
    ctx.font = `bold ${fontSize}px ${fontStack}`;
    while (ctx.measureText(floorText).width > 668 && fontSize > 32) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px ${fontStack}`;
    }

    ctx.fillStyle = 'rgba(232, 184, 110, 0.82)';
    ctx.fillText(floorText, 385, 100);

    ctx.fillStyle = 'rgba(5, 2, 1, 0.92)';
    ctx.fillText(floorText, 383, 95);

    ctx.fillStyle = '#cfa05a';
    ctx.fillText(floorText, 384, 97);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    return registerTexture(tex);
  };

  const getCarvedPlaqueTexture = (labelText: string): THREE.Texture => {
    const existing = carvedPlaqueCache.get(labelText);
    if (existing) return existing;
    const tex = createCarvedFloorTexture(labelText);
    carvedPlaqueCache.set(labelText, tex);
    return tex;
  };

  const getDoorEngraving1F = () => getCarvedPlaqueTexture('1F');
  const getDoorEngraving2F = () => getCarvedPlaqueTexture('2F');
  const getDoorEngravingB1 = () => getCarvedPlaqueTexture('B1');

  const getGrayOakFloorBaseTex = (): THREE.Texture => {
    if (grayOakTex) return grayOakTex;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#484540';
    ctx.fillRect(0, 0, 1024, 1024);

    const rows = 16;
    const rowHeight = 1024 / rows;
    const plankCols = 4;
    const colWidth = 1024 / plankCols;
    const grayOakPalette = [
      '#75716b', '#6c6862', '#7d7973', '#635f59',
      '#706c66', '#79756f', '#67635d', '#6e6a64',
    ];

    for (let r = 0; r < rows; r++) {
      const y = r * rowHeight;
      const colShift = (r % 2) * (colWidth / 2);
      for (let c = -1; c <= plankCols; c++) {
        const x = c * colWidth + colShift;
        const colorIdx = Math.floor(
          (Math.sin(r * 12.3 + c * 33.7) * 0.5 + 0.5) * grayOakPalette.length
        );
        ctx.fillStyle = grayOakPalette[colorIdx % grayOakPalette.length];
        ctx.fillRect(x + 1, y + 1, colWidth - 2, rowHeight - 2);

        ctx.fillStyle = 'rgba(34, 31, 28, 0.28)';
        for (let g = 3; g < rowHeight - 3; g += 4.5) {
          ctx.fillRect(x + 2, y + g, colWidth - 4, 1.4);
        }
        ctx.fillStyle = 'rgba(218, 214, 208, 0.14)';
        for (let g = 6; g < rowHeight - 3; g += 8) {
          ctx.fillRect(x + 2, y + g, colWidth - 4, 1.1);
        }

        ctx.fillStyle = 'rgba(36, 33, 30, 0.68)';
        ctx.fillRect(x, y + rowHeight - 2, colWidth, 2);
        ctx.fillRect(x + colWidth - 2, y, 2, rowHeight);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    grayOakTex = registerTexture(texture);
    return grayOakTex;
  };

  const getWhitePlasterWallBaseTex = (): THREE.Texture => {
    if (whitePlasterTex) return whitePlasterTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#e5e7e9';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 460; i++) {
      const px = (Math.sin(i * 19.7 + 1.3) * 0.5 + 0.5) * 512;
      const py = (Math.cos(i * 31.1 + 2.7) * 0.5 + 0.5) * 512;
      const rad = 14 + ((i * 17) % 34);
      const isLight = i % 2 === 0;
      const grad = ctx.createRadialGradient(px, py, 2, px, py, rad);
      grad.addColorStop(0, isLight ? 'rgba(248, 250, 252, 0.24)' : 'rgba(192, 197, 204, 0.26)');
      grad.addColorStop(1, 'rgba(229, 231, 233, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }

    for (let i = 0; i < 2200; i++) {
      const gx = (Math.sin(i * 47.3) * 0.5 + 0.5) * 512;
      const gy = (Math.cos(i * 73.9) * 0.5 + 0.5) * 512;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255, 255, 255, 0.26)' : 'rgba(162, 168, 176, 0.22)';
      ctx.fillRect(gx, gy, 1.6, 1.6);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    whitePlasterTex = registerTexture(texture);
    return whitePlasterTex;
  };

  const getLightWoodBaseTex = (): THREE.Texture => {
    if (lightWoodTex) return lightWoodTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, '#f4ede3');
    grad.addColorStop(0.5, '#f8f2ea');
    grad.addColorStop(1.0, '#ece3d6');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = 'rgba(165, 148, 130, 0.15)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 1.2);
    }
    ctx.fillStyle = 'rgba(255, 252, 247, 0.35)';
    for (let y = 2; y < 512; y += 9) {
      ctx.fillRect(0, y, 512, 1.0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    lightWoodTex = registerTexture(texture);
    return lightWoodTex;
  };

  const getCoolWhiteWoodBaseTex = (): THREE.Texture => {
    if (coolWhiteWoodTex) return coolWhiteWoodTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, '#eef2f6');
    grad.addColorStop(0.5, '#f6f8fb');
    grad.addColorStop(1.0, '#e7ecf2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = 'rgba(128, 138, 152, 0.13)';
    for (let y = 0; y < 512; y += 4) {
      ctx.fillRect(0, y, 512, 1.2);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
    for (let y = 2; y < 512; y += 9) {
      ctx.fillRect(0, y, 512, 1.0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    coolWhiteWoodTex = registerTexture(texture);
    return coolWhiteWoodTex;
  };

  const getWhiteOakWoodTexture = (): THREE.Texture => {
    if (whiteOakTex) return whiteOakTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0.0, '#dfd0b8');
    grad.addColorStop(0.32, '#e8dcc8');
    grad.addColorStop(0.68, '#d8c7ad');
    grad.addColorStop(1.0, '#e5d8c2');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4; i++) {
      const px = i * 128;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 250, 240, 0.14)' : 'rgba(155, 132, 102, 0.08)';
      ctx.fillRect(px, 0, 128, 512);
      ctx.fillStyle = 'rgba(130, 108, 82, 0.16)';
      ctx.fillRect(px, 0, 1.5, 512);
    }

    for (let x = 0; x < 512; x += 3) {
      const alpha = 0.05 + (((x * 19) % 7) / 7) * 0.08;
      ctx.fillStyle = `rgba(138, 114, 86, ${alpha.toFixed(2)})`;
      ctx.fillRect(x, 0, 1.4, 512);
    }

    ctx.strokeStyle = 'rgba(128, 105, 78, 0.13)';
    ctx.lineWidth = 1.1;
    for (let i = 0; i < 26; i++) {
      const gx = (i * 41 + 17) % 512;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.bezierCurveTo(
        gx + ((i % 3) - 1) * 8,
        170,
        gx - ((i % 3) - 1) * 7,
        340,
        gx + ((i % 2) === 0 ? 4 : -4),
        512
      );
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    whiteOakTex = registerTexture(texture);
    return whiteOakTex;
  };

  const getHandwrittenZhaWuTexture = (): THREE.Texture => {
    if (zhaWuTex) return zhaWuTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#fcf9ee';
    ctx.fillRect(0, 0, 512, 600);

    const paperGrad = ctx.createLinearGradient(0, 0, 512, 600);
    paperGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    paperGrad.addColorStop(1, 'rgba(218, 206, 182, 0.25)');
    ctx.fillStyle = paperGrad;
    ctx.fillRect(0, 0, 512, 600);

    ctx.strokeStyle = 'rgba(170, 188, 208, 0.32)';
    ctx.lineWidth = 2;
    for (let y = 135; y <= 545; y += 68) {
      ctx.beginPath();
      ctx.moveTo(42, y);
      ctx.lineTo(470, y);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(180, 168, 146, 0.45)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 596);

    ctx.save();
    ctx.strokeStyle = '#1e242c';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const strokePath = (pts: [number, number][], width: number, ctrlIdx?: number) => {
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 2) {
        ctx.lineTo(pts[1][0], pts[1][1]);
      } else if (pts.length === 3 && ctrlIdx === undefined) {
        ctx.quadraticCurveTo(pts[1][0], pts[1][1], pts[2][0], pts[2][1]);
      } else {
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i][0], pts[i][1]);
        }
      }
      ctx.stroke();
    };

    ctx.translate(256, 315);
    ctx.rotate(-0.035);
    ctx.translate(-256, -315);

    strokePath([[178, 92], [186, 114]], 10.5);
    strokePath([[132, 126], [182, 120], [234, 117]], 9.5);
    strokePath([[162, 134], [150, 155], [134, 174]], 8.5);
    strokePath([[157, 152], [176, 171]], 8.5);
    strokePath([[210, 131], [198, 154], [182, 172]], 8.5);
    strokePath([[204, 150], [228, 169]], 8.5);

    strokePath([[134, 198], [184, 194], [230, 191]], 9.5);
    strokePath([[182, 178], [181, 232], [182, 286]], 10);
    strokePath([[180, 199], [158, 235], [130, 266]], 9);
    strokePath([[186, 208], [218, 240]], 8.5);

    strokePath([[284, 96], [266, 146], [244, 184]], 9.5);
    strokePath([[265, 142], [264, 212], [264, 286]], 10);
    strokePath([[326, 98], [336, 122]], 9.5);
    strokePath([[268, 135], [326, 130], [374, 127]], 9.5);
    strokePath([[324, 133], [323, 206], [323, 268]], 9.5);
    strokePath([[268, 178], [322, 174], [364, 171]], 8.5);
    strokePath([[268, 222], [322, 218], [364, 215]], 8.5);
    strokePath([[266, 272], [328, 268], [382, 266]], 10);

    strokePath([[154, 358], [146, 392], [134, 422]], 9.5);
    strokePath([[149, 396], [186, 390], [220, 385]], 9.5);
    strokePath([[186, 338], [184, 444], [183, 542]], 10.5);
    strokePath([[134, 466], [180, 446], [224, 428]], 9.5);

    strokePath([[274, 340], [258, 382], [238, 418]], 9.5);
    strokePath(
      [
        [262, 382],
        [326, 376],
        [374, 372],
        [366, 462],
        [350, 526],
        [322, 502],
      ],
      10
    );
    strokePath([[298, 380], [276, 428], [248, 468]], 9);
    strokePath([[334, 378], [304, 442], [260, 508]], 9.5);

    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    zhaWuTex = registerTexture(texture);
    return zhaWuTex;
  };

  const getCatScratchFabricBaseTex = (): THREE.Texture => {
    if (catScratchTex) return catScratchTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#a7b8c7';
    ctx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 3) {
      ctx.fillStyle = y % 6 === 0 ? 'rgba(232, 240, 247, 0.22)' : 'rgba(104, 122, 140, 0.20)';
      ctx.fillRect(0, y, 512, 1.4);
    }
    for (let x = 0; x < 512; x += 3) {
      ctx.fillStyle = x % 6 === 0 ? 'rgba(238, 244, 250, 0.20)' : 'rgba(98, 116, 134, 0.18)';
      ctx.fillRect(x, 0, 1.4, 512);
    }

    for (let i = 0; i < 1400; i++) {
      const fx = (Math.sin(i * 41.7) * 0.5 + 0.5) * 504;
      const fy = (Math.cos(i * 67.3) * 0.5 + 0.5) * 510;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 248, 252, 0.16)' : 'rgba(88, 106, 124, 0.16)';
      ctx.fillRect(fx, fy, 4 + (i % 5), 1.2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    catScratchTex = registerTexture(texture);
    return catScratchTex;
  };

  const getCurtainFabricBaseTex = (): THREE.Texture => {
    if (curtainTex) return curtainTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return registerTexture(new THREE.Texture());

    ctx.fillStyle = '#aebfcc';
    ctx.fillRect(0, 0, 512, 512);

    for (let x = 0; x < 512; x += 3) {
      ctx.fillStyle = x % 6 === 0 ? 'rgba(234, 241, 248, 0.16)' : 'rgba(110, 128, 145, 0.14)';
      ctx.fillRect(x, 0, 1.3, 512);
    }
    for (let y = 0; y < 512; y += 4) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(0, y, 512, 1.0);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    curtainTex = registerTexture(texture);
    return curtainTex;
  };

  const disposeAll = () => {
    disposed = true;
    idleWaiters.forEach((resolve) => resolve());
    idleWaiters = [];
    ownedTextures.forEach((tex) => tex.dispose());
    ownedTextures.clear();
    urlCache.clear();
    carvedPlaqueCache.clear();
  };

  return {
    maxAnisotropy,
    loadingManager,
    loadTexture,
    registerTexture,
    cloneTexture,
    waitForPending,
    getPendingCount: () => pendingCount,
    getFloorTexture,
    getWallTexture,
    getTabletopTexture,
    getCeilingTexture,
    getCarvedPlaqueTexture,
    getDoorEngraving1F,
    getDoorEngraving2F,
    getDoorEngravingB1,
    getGrayOakFloorBaseTex,
    getWhitePlasterWallBaseTex,
    getLightWoodBaseTex,
    getCoolWhiteWoodBaseTex,
    getWhiteOakWoodTexture,
    getHandwrittenZhaWuTexture,
    getCatScratchFabricBaseTex,
    getCurtainFabricBaseTex,
    disposeAll,
  };
}
