import * as THREE from 'three';
import { RoomTextureManager } from './textureCache';

export const CBOX_W = 0.168; // 16.8 cm wide
export const CBOX_H = 0.215; // 21.5 cm tall (exact 720:920 portrait box ratio)
export const CBOX_D = 0.125; // 12.5 cm deep

export const BOX_W = 0.455;
export const BOX_H = 0.246;
export const BOX_D = 0.295;

export function createChiamoBoxPanelTexture(
  variant: 'side' | 'top' | 'back',
  texMgr: RoomTextureManager
): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = variant === 'top' ? 384 : 640;
  const ctx = c.getContext('2d');
  if (ctx) {
    const W = c.width;
    const H = c.height;
    // Satin charcoal-black outer border matching front box bezel
    ctx.fillStyle = '#1b181d';
    ctx.fillRect(0, 0, W, H);

    // Soft pastel pink/cream inner gradient panel
    const pad = 22;
    const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0.0, '#f8c8de');
    grad.addColorStop(0.5, '#fde9f2');
    grad.addColorStop(1.0, '#f3b3d2');
    ctx.fillStyle = grad;
    ctx.fillRect(pad, pad, W - pad * 2, H - pad * 2);

    // Bubblegum-pink diagonal corner accent bars matching retail box artwork
    ctx.fillStyle = '#e75f9f';
    ctx.fillRect(pad, pad, W - pad * 2, 18);
    ctx.fillRect(pad, H - pad - 18, W - pad * 2, 18);

    if (variant === 'top') {
      ctx.strokeStyle = 'rgba(40, 28, 36, 0.25)';
      ctx.lineWidth = 3;
      ctx.strokeRect(pad + 6, pad + 6, W - (pad + 6) * 2, H - (pad + 6) * 2);

      // Printed title badge centered on top lid
      ctx.fillStyle = '#e65798';
      ctx.beginPath();
      ctx.roundRect(W / 2 - 145, H / 2 - 42, 290, 84, 18);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 42px "Noto Sans JP", "PingFang TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('最愛チアモ', W / 2, H / 2);
    } else {
      // KONAMI corner badge + Bombergirl vertical/centered branding strip
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('KONAMI', pad + 14, pad + 56);

      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.fillStyle = '#2b2430';
      ctx.font = 'bold 30px "Noto Sans JP", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ボンバーガール', 0, -48);
      ctx.fillText('レインボー', 0, -10);

      ctx.fillStyle = '#e75f9f';
      ctx.beginPath();
      ctx.roundRect(-130, 18, 260, 62, 14);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 38px "Noto Sans JP", sans-serif';
      ctx.fillText('最愛チアモ', 0, 60);
      ctx.restore();

      if (variant === 'back') {
        // Subtle barcode box at bottom-right of rear face
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(W - pad - 130, H - pad - 88, 110, 56);
        ctx.fillStyle = '#18181b';
        for (let b = 0; b < 18; b++) {
          const bw = b % 3 === 0 ? 4 : 2;
          ctx.fillRect(W - pad - 122 + b * 5.2, H - pad - 82, bw, 44);
        }
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = texMgr.maxAnisotropy;
  return texMgr.registerTexture(tex);
}

export function createChiamoColorBoxGroup(texMgr: RoomTextureManager): THREE.Group {
  const boxGrp = new THREE.Group();

  const chiamoBoxFrontTex = texMgr.loadTexture('/assets/chiamo_box_front.webp');
  const chiamoBoxSideTex = createChiamoBoxPanelTexture('side', texMgr);
  const chiamoBoxTopTex = createChiamoBoxPanelTexture('top', texMgr);
  const chiamoBoxBackTex = createChiamoBoxPanelTexture('back', texMgr);

  const glossBoxSideMat = new THREE.MeshPhysicalMaterial({
    map: chiamoBoxSideTex,
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.48,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.85,
  });
  const glossBoxTopMat = new THREE.MeshPhysicalMaterial({
    map: chiamoBoxTopTex,
    roughness: 0.28,
    metalness: 0.02,
    clearcoat: 0.48,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.85,
  });
  const glossBoxFrontMat = new THREE.MeshPhysicalMaterial({
    map: chiamoBoxFrontTex,
    roughness: 0.20,
    metalness: 0.02,
    clearcoat: 0.58,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.92,
  });
  const glossBoxBackMat = new THREE.MeshPhysicalMaterial({
    map: chiamoBoxBackTex,
    roughness: 0.30,
    metalness: 0.02,
    clearcoat: 0.40,
    envMapIntensity: 0.80,
  });
  const boxBottomMat = new THREE.MeshStandardMaterial({
    color: 0x1e1b20,
    roughness: 0.78,
    envMapIntensity: 0.45,
  });

  const boxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(CBOX_W, CBOX_H, CBOX_D),
    [
      glossBoxSideMat,  // +X
      glossBoxSideMat,  // -X
      glossBoxTopMat,   // +Y
      boxBottomMat,     // -Y
      glossBoxFrontMat, // +Z front cover art
      glossBoxBackMat,  // -Z rear
    ]
  );
  boxMesh.position.y = CBOX_H / 2;
  boxMesh.castShadow = true;
  boxMesh.receiveShadow = true;
  boxGrp.add(boxMesh);

  // Subtle glossy cardboard top tuck-flap crease strip & clear round retail seal sticker
  const creaseStrip = new THREE.Mesh(
    new THREE.BoxGeometry(CBOX_W + 0.001, 0.0015, 0.002),
    new THREE.MeshStandardMaterial({ color: 0x2f2832, roughness: 0.5 })
  );
  creaseStrip.position.set(0, CBOX_H - 0.012, CBOX_D / 2 + 0.0005);
  boxGrp.add(creaseStrip);

  const sealSticker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.009, 0.009, 0.001, 16),
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.46,
      roughness: 0.12,
      clearcoat: 0.9,
    })
  );
  sealSticker.position.set(0, CBOX_H + 0.0005, CBOX_D / 2 - 0.008);
  boxGrp.add(sealSticker);

  return boxGrp;
}

export function createWhiteBoxTopTexture(texMgr: RoomTextureManager): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Base bright corrugated matte cardboard off-white
  ctx.fillStyle = '#f0efe9';
  ctx.fillRect(0, 0, 512, 384);

  // Subtle micro fiber flecks
  for (let i = 0; i < 480; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 384;
    const len = 1.2 + Math.random() * 2.8;
    const ang = Math.random() * Math.PI;
    ctx.strokeStyle = Math.random() > 0.5 ? 'rgba(80, 75, 70, 0.08)' : 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  // Faint cardboard top flap fold lines & clear packaging tape strip across center
  ctx.strokeStyle = 'rgba(140, 132, 120, 0.22)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(256, 0);
  ctx.lineTo(256, 384);
  ctx.stroke();

  // Clear packing tape sheen strip down center seam
  const tapeGrad = ctx.createLinearGradient(216, 0, 296, 0);
  tapeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 0.0)');
  tapeGrad.addColorStop(0.3, 'rgba(255, 255, 245, 0.18)');
  tapeGrad.addColorStop(0.5, 'rgba(255, 255, 250, 0.25)');
  tapeGrad.addColorStop(0.7, 'rgba(255, 255, 245, 0.18)');
  tapeGrad.addColorStop(1.0, 'rgba(255, 255, 250, 0.0)');
  ctx.fillStyle = tapeGrad;
  ctx.fillRect(216, 0, 80, 384);

  // Subtle stamp of cat paw print motif
  const drawPawStamp = (cx: number, cy: number, scale: number, angle: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#181818';

    ctx.beginPath();
    ctx.ellipse(0, 12, 22, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    const toes: Array<[number, number, number, number, number]> = [
      [-26, -12, 9, 12, -0.35],
      [-9, -24, 9, 13, -0.1],
      [10, -24, 9, 13, 0.1],
      [26, -12, 9, 12, 0.35],
    ];
    toes.forEach(([tx, ty, rx, ry, rot]) => {
      ctx.beginPath();
      ctx.ellipse(tx, ty, rx, ry, rot, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  };

  drawPawStamp(128, 128, 0.72, -0.22);
  drawPawStamp(218, 108, 0.68, 0.15);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = texMgr.maxAnisotropy;
  return texMgr.registerTexture(tex);
}

export interface WhiteBoxMaterials {
  boxCardboardMat: THREE.MeshStandardMaterial;
  boxSeamEdgeMat: THREE.MeshStandardMaterial;
  boxFrontPrintMat: THREE.MeshStandardMaterial;
  boxTopPrintMat: THREE.MeshStandardMaterial;
}

export function getWhiteBoxMaterials(texMgr: RoomTextureManager): WhiteBoxMaterials {
  const whiteBoxFrontTexture = texMgr.loadTexture('/assets/white_box_front.webp');
  const whiteBoxTopTexture = createWhiteBoxTopTexture(texMgr);

  const boxCardboardMat = new THREE.MeshStandardMaterial({
    color: 0xe6e5df,
    roughness: 0.90,
    metalness: 0.01,
    envMapIntensity: 0.40,
  });
  const boxSeamEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xd5d3cb,
    roughness: 0.92,
    metalness: 0.01,
    envMapIntensity: 0.38,
  });
  const boxFrontPrintMat = new THREE.MeshStandardMaterial({
    map: whiteBoxFrontTexture,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.01,
    envMapIntensity: 0.46,
  });
  const boxTopPrintMat = new THREE.MeshStandardMaterial({
    map: whiteBoxTopTexture,
    color: 0xffffff,
    roughness: 0.86,
    metalness: 0.01,
    envMapIntensity: 0.42,
  });

  return {
    boxCardboardMat,
    boxSeamEdgeMat,
    boxFrontPrintMat,
    boxTopPrintMat,
  };
}

export function createWhiteBoxGroup(texMgr: RoomTextureManager): THREE.Group {
  const mats = getWhiteBoxMaterials(texMgr);
  const whiteBoxGroup = new THREE.Group();

  // 1. Main white corrugated box body (bottom-center grounded pivot)
  const boxCoreMesh = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_W, BOX_H - 0.012, BOX_D),
    mats.boxCardboardMat
  );
  boxCoreMesh.position.set(0, (BOX_H - 0.012) / 2, 0);
  boxCoreMesh.castShadow = true;
  boxCoreMesh.receiveShadow = true;
  whiteBoxGroup.add(boxCoreMesh);

  // 2. Printed illustrated front face panel (polygonOffset prevents z-fighting)
  const boxFrontPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(BOX_W - 0.004, BOX_H - 0.014),
    mats.boxFrontPrintMat
  );
  boxFrontPlane.position.set(0, (BOX_H - 0.012) / 2, BOX_D / 2 + 0.0008);
  boxFrontPlane.receiveShadow = true;
  whiteBoxGroup.add(boxFrontPlane);

  // 3. Top hinged lid overhang slab + stamped corrugated top texture
  const boxLidSlab = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_W + 0.004, 0.012, BOX_D + 0.004),
    mats.boxCardboardMat
  );
  boxLidSlab.position.set(0, BOX_H - 0.006, 0);
  boxLidSlab.castShadow = true;
  boxLidSlab.receiveShadow = true;
  whiteBoxGroup.add(boxLidSlab);

  const boxTopPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(BOX_W + 0.002, BOX_D + 0.002),
    mats.boxTopPrintMat
  );
  boxTopPlane.rotation.x = -Math.PI / 2;
  boxTopPlane.position.set(0, BOX_H + 0.0006, 0);
  boxTopPlane.receiveShadow = true;
  whiteBoxGroup.add(boxTopPlane);

  // 4. Subtle dark crease line along top lid tuck seam + corner fold ribs
  const lidCreaseBar = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_W + 0.005, 0.0025, 0.003),
    mats.boxSeamEdgeMat
  );
  lidCreaseBar.position.set(0, BOX_H - 0.012, BOX_D / 2 + 0.0015);
  whiteBoxGroup.add(lidCreaseBar);

  return whiteBoxGroup;
}
