import React from 'react';
import * as THREE from 'three';
import {
  ExtraRoomDoorState,
  EXTRA_ROOM_THEMES,
  PR_SIZE,
  PR_HEIGHT,
  PR_CENTER_X,
} from './roomConfig';
import { RoomTextureManager } from './textureCache';
import { createPortalDoorAndDial } from './portalDoorBuilder';
import { createRirimuBagGroup } from './ririmuBagBuilder';
import {
  CBOX_W,
  BOX_W,
  BOX_H,
  BOX_D,
  createChiamoColorBoxGroup,
  getWhiteBoxMaterials,
} from './cabinetPropsBuilder';
import { MONOLOGUE_TEXT } from '../EscalatorMonologueSubpage';

export interface PinkRoomRefs {
  monologuePaperHitboxRef: React.MutableRefObject<THREE.Mesh | null>;
  beybladeBoxHitboxRef: React.MutableRefObject<THREE.Mesh | null>;
  beybladeLid1PivotRef: React.MutableRefObject<THREE.Group | null>;
  beybladeLid1OpenRef: React.MutableRefObject<boolean>;
  beybladeLid1AngleRef: React.MutableRefObject<number>;
  capsuleLightSwitchHitboxRef: React.MutableRefObject<THREE.Mesh | null>;
  capsuleSwitchBtnRef: React.MutableRefObject<THREE.Mesh | null>;
  capsuleSwitchLedMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
  capsuleCeilingLedMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
  capsuleMainLightBackRef: React.MutableRefObject<THREE.PointLight | null>;
  capsuleMainLightFrontRef: React.MutableRefObject<THREE.PointLight | null>;
  capsuleReadingLensMatRef: React.MutableRefObject<THREE.MeshStandardMaterial | null>;
  capsuleReadingLightRef: React.MutableRefObject<THREE.PointLight | null>;
  capsuleLightModeRef: React.MutableRefObject<number>;
}

export function buildPinkRoom(
  roomState: ExtraRoomDoorState,
  texMgr: RoomTextureManager,
  refs: PinkRoomRefs
): THREE.Group {
  const theme = EXTRA_ROOM_THEMES.pink;
  const coloredRoomGroup = new THREE.Group();
  roomState.roomGroup = coloredRoomGroup;

  // 1. 7x7 Gray Oak Hardwood Floor
  const cFloorTex = texMgr.cloneTexture(texMgr.getGrayOakFloorBaseTex(), 3.5, 3.5);
  const cFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(PR_SIZE, PR_SIZE),
    new THREE.MeshStandardMaterial({
      map: cFloorTex,
      color: theme.floorColor,
      roughness: 0.72,
      metalness: 0.01,
      envMapIntensity: 0.24,
    })
  );
  cFloor.rotation.x = -Math.PI / 2;
  cFloor.position.set(PR_CENTER_X, 0, 0);
  cFloor.receiveShadow = true;
  coloredRoomGroup.add(cFloor);

  // 2. 7x7 Ceiling
  const cCeilingMat = new THREE.MeshStandardMaterial({
    color: theme.ceilingColor,
    roughness: 0.96,
    metalness: 0.0,
    envMapIntensity: 0.16,
  });
  const cCeiling = new THREE.Mesh(new THREE.PlaneGeometry(PR_SIZE, PR_SIZE), cCeilingMat);
  cCeiling.position.set(PR_CENTER_X, PR_HEIGHT, 0);
  cCeiling.rotation.x = Math.PI / 2;
  coloredRoomGroup.add(cCeiling);

  // 3. Four 7x3m Matte White Plaster Walls
  const makeColoredWallMat = () => {
    const tex = texMgr.cloneTexture(texMgr.getWhitePlasterWallBaseTex(), 3.0, 1.5);
    return new THREE.MeshStandardMaterial({
      map: tex,
      color: theme.wallColor,
      roughness: 0.97,
      metalness: 0.0,
      envMapIntensity: 0.14,
    });
  };

  const cFrontWall = new THREE.Mesh(new THREE.PlaneGeometry(PR_SIZE, PR_HEIGHT), makeColoredWallMat());
  cFrontWall.position.set(PR_CENTER_X, PR_HEIGHT / 2, -PR_SIZE / 2);
  cFrontWall.receiveShadow = true;
  coloredRoomGroup.add(cFrontWall);

  const cBackWall = new THREE.Mesh(new THREE.PlaneGeometry(PR_SIZE, PR_HEIGHT), makeColoredWallMat());
  cBackWall.position.set(PR_CENTER_X, PR_HEIGHT / 2, PR_SIZE / 2);
  cBackWall.rotation.y = Math.PI;
  cBackWall.receiveShadow = true;
  coloredRoomGroup.add(cBackWall);

  const cLeftWall = new THREE.Mesh(new THREE.PlaneGeometry(PR_SIZE, PR_HEIGHT), makeColoredWallMat());
  cLeftWall.position.set(-5.0, PR_HEIGHT / 2, 0);
  cLeftWall.rotation.y = Math.PI / 2;
  cLeftWall.receiveShadow = true;
  coloredRoomGroup.add(cLeftWall);

  const cRightWall = new THREE.Mesh(new THREE.PlaneGeometry(PR_SIZE, PR_HEIGHT), makeColoredWallMat());
  cRightWall.position.set(2.0, PR_HEIGHT / 2, 0);
  cRightWall.rotation.y = -Math.PI / 2;
  cRightWall.receiveShadow = true;
  coloredRoomGroup.add(cRightWall);

  // Baseboards
  const cBaseboardMat = new THREE.MeshStandardMaterial({ color: theme.baseboardColor, roughness: 0.55 });
  [
    [PR_SIZE, 0.1, 0.04, PR_CENTER_X, 0.05, PR_SIZE / 2 - 0.02],
    [0.04, 0.1, PR_SIZE, -5.0 + 0.02, 0.05, 0],
    [0.04, 0.1, PR_SIZE, 2.0 - 0.02, 0.05, 0],
    [PR_SIZE, 0.1, 0.04, PR_CENTER_X, 0.05, -PR_SIZE / 2 + 0.02],
  ].forEach(([bw, bh, bd, bx, by, bz]) => {
    const bb = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), cBaseboardMat);
    bb.position.set(bx, by, bz);
    coloredRoomGroup.add(bb);
  });

  // Nordic White Birch Rustic Arched Wooden Door + cute bunny-eared 「阿璃的房間」 wooden plaque
  let pinkOakDoorTex: THREE.Texture | undefined;
  let pinkCutePlaqueTex: THREE.Texture | undefined;

  const oakCanvas = document.createElement('canvas');
  oakCanvas.width = 512;
  oakCanvas.height = 512;
  const oCtx = oakCanvas.getContext('2d');
  if (oCtx) {
    const oakGrad = oCtx.createLinearGradient(0, 0, 512, 0);
    oakGrad.addColorStop(0.0, '#eadbc4');
    oakGrad.addColorStop(0.25, '#f2e6d3');
    oakGrad.addColorStop(0.5, '#e8d8bf');
    oakGrad.addColorStop(0.75, '#f3e8d6');
    oakGrad.addColorStop(1.0, '#e5d4ba');
    oCtx.fillStyle = oakGrad;
    oCtx.fillRect(0, 0, 512, 512);

    for (let p = 0; p < 5; p++) {
      const px = (p * 512) / 5;
      oCtx.fillStyle = p % 2 === 0 ? 'rgba(255, 252, 246, 0.16)' : 'rgba(155, 128, 96, 0.06)';
      oCtx.fillRect(px, 0, 512 / 5, 512);
    }

    for (let x = 0; x < 512; x += 3) {
      const alpha = 0.04 + (((x * 17) % 9) / 9) * 0.06;
      oCtx.fillStyle = `rgba(148, 118, 86, ${alpha.toFixed(2)})`;
      oCtx.fillRect(x, 0, 1.4, 512);
    }

    oCtx.strokeStyle = 'rgba(142, 112, 80, 0.15)';
    oCtx.lineWidth = 1.2;
    for (let i = 0; i < 24; i++) {
      const gx = (i * 43 + 11) % 512;
      oCtx.beginPath();
      oCtx.moveTo(gx, 0);
      oCtx.bezierCurveTo(
        gx + ((i % 3) - 1) * 9,
        170,
        gx - ((i % 3) - 1) * 8,
        340,
        gx + ((i % 2) === 0 ? 4 : -4),
        512
      );
      oCtx.stroke();
    }

    oCtx.fillStyle = 'rgba(142, 112, 80, 0.18)';
    [
      [86, 132, 6, 3.2],
      [295, 248, 7.5, 3.5],
      [420, 388, 5.5, 2.8],
      [178, 412, 6.2, 3.0],
    ].forEach(([kx, ky, krx, kry]) => {
      oCtx.beginPath();
      oCtx.ellipse(kx, ky, krx, kry, 0.25, 0, Math.PI * 2);
      oCtx.fill();
    });
  }
  pinkOakDoorTex = new THREE.CanvasTexture(oakCanvas);
  pinkOakDoorTex.colorSpace = THREE.SRGBColorSpace;
  pinkOakDoorTex.wrapS = THREE.RepeatWrapping;
  pinkOakDoorTex.wrapT = THREE.RepeatWrapping;
  pinkOakDoorTex.repeat.set(1.0, 0.46);
  pinkOakDoorTex.needsUpdate = true;
  texMgr.registerTexture(pinkOakDoorTex);

  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 768;
  plaqueCanvas.height = 256;
  const pCtx = plaqueCanvas.getContext('2d');
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  plaqueTex.anisotropy = texMgr.maxAnisotropy;

  const renderCutePlaque = () => {
    if (!pCtx) return;
    const bg = pCtx.createLinearGradient(0, 0, 768, 256);
    bg.addColorStop(0.0, '#fbf1df');
    bg.addColorStop(0.5, '#fdf7eb');
    bg.addColorStop(1.0, '#f6e7cc');
    pCtx.fillStyle = bg;
    pCtx.fillRect(0, 0, 768, 256);

    for (let y = 0; y < 256; y += 5) {
      pCtx.fillStyle = y % 10 === 0 ? 'rgba(160, 118, 72, 0.06)' : 'rgba(255, 255, 255, 0.22)';
      pCtx.fillRect(0, y, 768, 1.5);
    }

    const drawRoundRect = (x: number, y: number, w: number, h: number, r: number) => {
      pCtx.beginPath();
      pCtx.moveTo(x + r, y);
      pCtx.lineTo(x + w - r, y);
      pCtx.quadraticCurveTo(x + w, y, x + w, y + r);
      pCtx.lineTo(x + w, y + h - r);
      pCtx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      pCtx.lineTo(x + r, y + h);
      pCtx.quadraticCurveTo(x, y + h, x, y + h - r);
      pCtx.lineTo(x, y + r);
      pCtx.quadraticCurveTo(x, y, x + r, y);
      pCtx.closePath();
    };

    pCtx.strokeStyle = '#f298b6';
    pCtx.lineWidth = 6;
    drawRoundRect(16, 16, 736, 224, 34);
    pCtx.stroke();

    pCtx.save();
    pCtx.setLineDash([12, 8]);
    pCtx.strokeStyle = '#f6b8cc';
    pCtx.lineWidth = 3;
    drawRoundRect(28, 28, 712, 200, 26);
    pCtx.stroke();
    pCtx.restore();

    const drawCuteHeart = (cx: number, cy: number, s: number, fill: string) => {
      pCtx.save();
      pCtx.translate(cx, cy);
      pCtx.scale(s, s);
      pCtx.fillStyle = fill;
      pCtx.beginPath();
      pCtx.moveTo(0, 12);
      pCtx.bezierCurveTo(-18, -2, -20, -18, -9, -18);
      pCtx.bezierCurveTo(-2, -18, 0, -10, 0, -10);
      pCtx.bezierCurveTo(0, -10, 2, -18, 9, -18);
      pCtx.bezierCurveTo(20, -18, 18, -2, 0, 12);
      pCtx.fill();
      pCtx.restore();
    };

    drawCuteHeart(86, 126, 1.35, '#f497b6');
    drawCuteHeart(682, 126, 1.35, '#f497b6');
    drawCuteHeart(116, 86, 0.72, '#9ecae8');
    drawCuteHeart(652, 166, 0.72, '#9ecae8');

    pCtx.textAlign = 'center';
    pCtx.textBaseline = 'middle';
    pCtx.font = '900 84px "Zen Maru Gothic", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", sans-serif';

    pCtx.fillStyle = 'rgba(244, 151, 182, 0.35)';
    pCtx.fillText('阿璃的房間', 387, 134);

    pCtx.fillStyle = '#5a3826';
    pCtx.fillText('阿璃的房間', 384, 130);

    plaqueTex.needsUpdate = true;
  };

  renderCutePlaque();
  if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => {
      renderCutePlaque();
    });
  }
  texMgr.registerTexture(plaqueTex);
  pinkCutePlaqueTex = plaqueTex;

  const cPortalDoor = createPortalDoorAndDial({
    colors: roomState.colors,
    hasColorSlot: roomState.hasColorSlot,
    initialIdx: roomState.colorIdx,
    currentAngle: roomState.currentAngle,
    showFloorLabel: true,
    floorLabelTexture: texMgr.getDoorEngravingB1(),
    accentWoodTint: theme.accentWoodTint,
    isRusticArchedOak: true,
    oakDoorTexture: pinkOakDoorTex,
    cuteRoomPlaqueTexture: pinkCutePlaqueTex,
  });
  cPortalDoor.doorGroup.position.set(-3.65, 0, -PR_SIZE / 2);
  coloredRoomGroup.add(cPortalDoor.doorGroup);

  roomState.doorHitbox = cPortalDoor.doorHitbox;
  roomState.doorLeafPivot = cPortalDoor.leafPivot;
  roomState.wheelGroup = cPortalDoor.wheelGroup;
  roomState.outerGearGroup = cPortalDoor.outerGearGroup;
  roomState.dialHitbox = cPortalDoor.dialHitbox;
  roomState.dialLight = cPortalDoor.dialLight;
  roomState.tipGemMat = cPortalDoor.tipGemMat;
  roomState.sectorMats = cPortalDoor.sectorMats;
  roomState.rimGemMats = cPortalDoor.rimGemMats;

  const cCeilingRose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.04, 24),
    new THREE.MeshStandardMaterial({ color: theme.ceilingRoseColor, roughness: 0.45, metalness: 0.5 })
  );
  cCeilingRose.position.set(PR_CENTER_X, PR_HEIGHT - 0.02, 0);
  coloredRoomGroup.add(cCeilingRose);

  const cLightRod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.010, 0.010, 0.36, 12),
    new THREE.MeshStandardMaterial({ color: 0x8f6b32, roughness: 0.32, metalness: 0.85 })
  );
  cLightRod.position.set(PR_CENTER_X, PR_HEIGHT - 0.20, 0);
  coloredRoomGroup.add(cLightRod);

  const cLampCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.15, 0.07, 24),
    new THREE.MeshStandardMaterial({ color: theme.lampCapColor, roughness: 0.38, metalness: 0.65 })
  );
  cLampCap.position.set(PR_CENTER_X, PR_HEIGHT - 0.38, 0);
  coloredRoomGroup.add(cLampCap);

  const cOverheadBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 24, 18),
    new THREE.MeshStandardMaterial({
      color: theme.bulbColor,
      emissive: theme.bulbColor,
      emissiveIntensity: 0.18,
      roughness: 0.40,
      metalness: 0.05,
    })
  );
  cOverheadBulb.scale.set(1.15, 0.85, 1.15);
  cOverheadBulb.position.set(PR_CENTER_X, PR_HEIGHT - 0.46, 0);
  coloredRoomGroup.add(cOverheadBulb);

  const cMainLight = new THREE.PointLight(theme.mainLightColor, 1.15, 24, 1.08);
  cMainLight.position.set(PR_CENTER_X, PR_HEIGHT - 0.52, 0);
  cMainLight.castShadow = true;
  cMainLight.shadow.mapSize.width = 1024;
  cMainLight.shadow.mapSize.height = 1024;
  cMainLight.shadow.bias = -0.0004;
  cMainLight.shadow.normalBias = 0.02;
  cMainLight.shadow.radius = 2.6;
  coloredRoomGroup.add(cMainLight);

  const cUpGlow = new THREE.PointLight(theme.upGlowColor, 0.20, 10, 1.18);
  cUpGlow.position.set(PR_CENTER_X, PR_HEIGHT - 0.28, 0);
  coloredRoomGroup.add(cUpGlow);

  const cDoorAccentLight = new THREE.PointLight(theme.doorAccentColor, 0.35, 9.5, 1.15);
  cDoorAccentLight.position.set(-3.65, 2.25, -2.05);
  coloredRoomGroup.add(cDoorAccentLight);

        // Shared Jewel-Case CD + Light-Blue Tabletop Display Stand Builder (CD + 淺藍立架共用模型)
        const cdStandMat = new THREE.MeshStandardMaterial({
          color: 0x93c5fd, // 淺藍色 (soft sky blue)
          roughness: 0.32,
          metalness: 0.12,
          envMapIntensity: 0.85,
        });
        const cdTrayMat = new THREE.MeshPhysicalMaterial({
          color: 0x202630,
          roughness: 0.18,
          metalness: 0.06,
          clearcoat: 0.72,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.05,
        });
        const cdCaseClearMat = new THREE.MeshPhysicalMaterial({
          color: 0xf4faff,
          roughness: 0.03,
          metalness: 0.01,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          reflectivity: 0.98,
          envMapIntensity: 1.55,
          transparent: true,
          opacity: 0.26,
          depthWrite: false,
        });
        const cdBackArtMat = new THREE.MeshStandardMaterial({
          color: 0x1f2d3d,
          roughness: 0.42,
          metalness: 0.04,
        });

        const createCdDisplayGroup = (texPath: string, scaleScalar = 1.55) => {
          const cdFrontTex = texMgr.loadTexture(texPath);
          cdFrontTex.colorSpace = THREE.SRGBColorSpace;
          cdFrontTex.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(cdFrontTex);

          const cdArtMat = new THREE.MeshPhysicalMaterial({
            map: cdFrontTex,
            roughness: 0.24,
            metalness: 0.01,
            clearcoat: 0.35,
            clearcoatRoughness: 0.16,
            envMapIntensity: 0.72,
          });

          const group = new THREE.Group();
          group.scale.setScalar(scaleScalar);

          // A-frame Tabletop Display Stand (立架) resting flush at y = 0
          const CD_STAND_TILT = -0.24;
          const CD_STAND_H = 0.146;
          const cdStandFront = new THREE.Group();
          cdStandFront.rotation.x = CD_STAND_TILT;
          cdStandFront.position.set(0, 0, 0.022);

          [-1, 1].forEach((side) => {
            const sLeg = new THREE.Mesh(
              new THREE.BoxGeometry(0.008, CD_STAND_H, 0.007),
              cdStandMat
            );
            sLeg.position.set(side * 0.028, CD_STAND_H / 2, 0);
            sLeg.rotation.z = side * 0.18;
            sLeg.castShadow = true;
            sLeg.receiveShadow = true;
            cdStandFront.add(sLeg);
          });

          const cdApex = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.014, 0.010), cdStandMat);
          cdApex.position.set(0, CD_STAND_H - 0.005, 0);
          cdStandFront.add(cdApex);

          const cdMidBar = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.008, 0.007), cdStandMat);
          cdMidBar.position.set(0, 0.066, 0);
          cdStandFront.add(cdMidBar);

          const cdLedge = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.007, 0.024), cdStandMat);
          cdLedge.position.set(0, 0.024, 0.010);
          cdLedge.castShadow = true;
          cdLedge.receiveShadow = true;
          cdStandFront.add(cdLedge);

          const cdFrontLip = new THREE.Mesh(new THREE.BoxGeometry(0.118, 0.008, 0.003), cdStandMat);
          cdFrontLip.position.set(0, 0.028, 0.021);
          cdStandFront.add(cdFrontLip);

          // Standard CD Jewel Case (14.2 × 12.5 × 1.05 cm) resting inside cradle
          const CD_W = 0.142;
          const CD_H = 0.125;
          const CD_D = 0.0105;
          const cdCaseGroup = new THREE.Group();
          cdCaseGroup.position.set(0, 0.028 + CD_H / 2, 0.009);

          const cdTrayBox = new THREE.Mesh(
            new THREE.BoxGeometry(CD_W - 0.003, CD_H - 0.003, CD_D - 0.003),
            cdTrayMat
          );
          cdTrayBox.position.z = -0.001;
          cdTrayBox.castShadow = true;
          cdTrayBox.receiveShadow = true;
          cdCaseGroup.add(cdTrayBox);

          // Jacket front insert artwork + back inlay
          const cdJacketFront = new THREE.Mesh(
            new THREE.PlaneGeometry(CD_W - 0.005, CD_H - 0.005),
            cdArtMat
          );
          cdJacketFront.position.z = CD_D / 2 - 0.0014;
          cdCaseGroup.add(cdJacketFront);

          const cdJacketBack = new THREE.Mesh(
            new THREE.PlaneGeometry(CD_W - 0.006, CD_H - 0.006),
            cdBackArtMat
          );
          cdJacketBack.rotation.y = Math.PI;
          cdJacketBack.position.z = -CD_D / 2 + 0.0002;
          cdCaseGroup.add(cdJacketBack);

          // High-gloss clear polystyrene jewel-case lid shell + molded snap tabs
          const cdClearShell = new THREE.Mesh(
            new THREE.BoxGeometry(CD_W, CD_H, CD_D),
            cdCaseClearMat
          );
          cdClearShell.renderOrder = 2;
          cdCaseGroup.add(cdClearShell);

          [-CD_H / 2 + 0.014, CD_H / 2 - 0.014].forEach((tabY) => {
            const snapTab = new THREE.Mesh(
              new THREE.BoxGeometry(0.018, 0.004, 0.0025),
              cdCaseClearMat
            );
            snapTab.position.set(0.024, tabY, CD_D / 2 + 0.0005);
            cdCaseGroup.add(snapTab);
          });

          cdStandFront.add(cdCaseGroup);
          group.add(cdStandFront);

          // Rear kickstand strut grounded cleanly at y = 0
          const cdApexPos = new THREE.Vector3(
            0,
            Math.cos(Math.abs(CD_STAND_TILT)) * (CD_STAND_H - 0.005),
            0.022 - Math.sin(Math.abs(CD_STAND_TILT)) * (CD_STAND_H - 0.005)
          );
          const cdRearFoot = new THREE.Vector3(0, 0.003, -0.046);
          const cdKickVec = new THREE.Vector3().subVectors(cdApexPos, cdRearFoot);
          const cdKickLeg = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, cdKickVec.length(), 0.007),
            cdStandMat
          );
          cdKickLeg.position.addVectors(cdApexPos, cdRearFoot).multiplyScalar(0.5);
          cdKickLeg.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            cdKickVec.clone().normalize()
          );
          cdKickLeg.castShadow = true;
          group.add(cdKickLeg);

          return group;
        };

        // 120×60 cm White-Top Tech Z-Frame White & Blue Gaming Desk (白色桌面＋Z字形科技感白藍色電競腳)
        const DESK_W = 1.20;
        const DESK_D = 0.60;
        const DESK_H = 0.74;
        const TOP_T = 0.028;
        const LEG_H = DESK_H - TOP_T;

        const deskGroup = new THREE.Group();
        deskGroup.position.set(2.0 - 0.04 - DESK_W / 2, 0, -PR_SIZE / 2 + 0.04 + DESK_D / 2);

        const deskWhiteTopMat = new THREE.MeshPhysicalMaterial({
          color: 0xfafcff,
          roughness: 0.24,
          metalness: 0.02,
          clearcoat: 0.44,
          clearcoatRoughness: 0.20,
          envMapIntensity: 0.88,
        });
        const deskFrameWhiteMat = new THREE.MeshPhysicalMaterial({
          color: 0xf4f7fb,
          roughness: 0.30,
          metalness: 0.22,
          clearcoat: 0.28,
          envMapIntensity: 0.95,
        });
        const deskTechBlueMat = new THREE.MeshStandardMaterial({
          color: 0x4db5f5,
          emissive: 0x2689cf,
          emissiveIntensity: 0.36,
          roughness: 0.24,
          metalness: 0.42,
          envMapIntensity: 1.15,
        });
        const deskInnerSteelMat = new THREE.MeshStandardMaterial({
          color: 0xdbe3ec,
          roughness: 0.22,
          metalness: 0.80,
          envMapIntensity: 1.35,
        });
        const deskDarkTrimMat = new THREE.MeshStandardMaterial({
          color: 0x2a3342,
          roughness: 0.58,
          metalness: 0.22,
          envMapIntensity: 0.75,
        });

        // Clean Matte-White Gaming Tabletop Slab + Subtle Front-Side Sky-Blue Tech Trim Line
        const desktop = new THREE.Mesh(
          new THREE.BoxGeometry(DESK_W, TOP_T, DESK_D),
          deskWhiteTopMat
        );
        desktop.position.y = DESK_H - TOP_T / 2;
        desktop.castShadow = true;
        desktop.receiveShadow = true;
        deskGroup.add(desktop);

        // Sleek chamfered white & sky-blue side edge accents along tabletop perimeter
        [-1, 1].forEach((side) => {
          const sideEdgeStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.008, 0.009, DESK_D - 0.04),
            deskTechBlueMat
          );
          sideEdgeStrip.position.set(side * (DESK_W / 2 + 0.002), DESK_H - TOP_T / 2, 0);
          deskGroup.add(sideEdgeStrip);
        });

        // Twin rear cable grommet ports on white desktop
        [-0.36, 0.36].forEach((gx) => {
          const grommetRing = new THREE.Mesh(
            new THREE.CylinderGeometry(0.025, 0.025, 0.004, 18),
            deskDarkTrimMat
          );
          grommetRing.position.set(gx, DESK_H + 0.001, -DESK_D / 2 + 0.065);
          deskGroup.add(grommetRing);

          const grommetInnerBlue = new THREE.Mesh(
            new THREE.TorusGeometry(0.023, 0.0022, 8, 20),
            deskTechBlueMat
          );
          grommetInnerBlue.rotation.x = Math.PI / 2;
          grommetInnerBlue.position.set(gx, DESK_H + 0.0025, -DESK_D / 2 + 0.065);
          deskGroup.add(grommetInnerBlue);
        });

        // Left & Right Z-Shaped Tech White & Blue Gaming Desk Legs
        const zLegOffX = DESK_W / 2 - 0.075;
        const SLED_Z_SPAN = 0.52;
        const TOP_ARM_Y = LEG_H - 0.022;
        const BOT_SLED_Y = 0.024;

        [-1, 1].forEach((side) => {
          const zLeg = new THREE.Group();
          zLeg.position.set(side * zLegOffX, 0, 0);

          // 1. Bottom horizontal sled runner (with chamfered ends + sky-blue armor stripe + leveling feet)
          const sledCore = new THREE.Mesh(
            new THREE.BoxGeometry(0.048, 0.032, SLED_Z_SPAN),
            deskFrameWhiteMat
          );
          sledCore.position.set(0, BOT_SLED_Y, 0);
          sledCore.castShadow = true;
          sledCore.receiveShadow = true;
          zLeg.add(sledCore);

          [-SLED_Z_SPAN / 2, SLED_Z_SPAN / 2].forEach((capZ) => {
            const sledNose = new THREE.Mesh(
              new THREE.BoxGeometry(0.048, 0.024, 0.026),
              deskInnerSteelMat
            );
            sledNose.position.set(0, BOT_SLED_Y - 0.004, capZ + Math.sign(capZ) * 0.010);
            sledNose.rotation.x = Math.sign(capZ) * 0.35;
            zLeg.add(sledNose);
          });

          // Side sky-blue tech stripe on sled runner
          const sledBlueInlay = new THREE.Mesh(
            new THREE.BoxGeometry(0.052, 0.010, SLED_Z_SPAN - 0.09),
            deskTechBlueMat
          );
          sledBlueInlay.position.set(0, BOT_SLED_Y, 0);
          zLeg.add(sledBlueInlay);

          // Rubber floor leveling glides at front & back of sled
          [-0.22, 0.22].forEach((fz) => {
            const glide = new THREE.Mesh(
              new THREE.CylinderGeometry(0.018, 0.021, 0.012, 14),
              deskDarkTrimMat
            );
            glide.position.set(0, 0.006, fz);
            zLeg.add(glide);
          });

          // 2. Top under-desk horizontal mounting arm
          const topArm = new THREE.Mesh(
            new THREE.BoxGeometry(0.048, 0.030, SLED_Z_SPAN - 0.02),
            deskFrameWhiteMat
          );
          topArm.position.set(0, TOP_ARM_Y, 0);
          topArm.castShadow = true;
          zLeg.add(topArm);

          const topFlangePlate = new THREE.Mesh(
            new THREE.BoxGeometry(0.095, 0.010, SLED_Z_SPAN - 0.04),
            deskInnerSteelMat
          );
          topFlangePlate.position.set(0, LEG_H - 0.005, 0);
          zLeg.add(topFlangePlate);

          const topBlueAccent = new THREE.Mesh(
            new THREE.BoxGeometry(0.052, 0.009, SLED_Z_SPAN - 0.10),
            deskTechBlueMat
          );
          topBlueAccent.position.set(0, TOP_ARM_Y, 0);
          zLeg.add(topBlueAccent);

          // 3. Diagonal Z-Spine running from upper front (+Z) down to lower rear (-Z)
          const zTopFrontPt = new THREE.Vector3(0, TOP_ARM_Y - 0.005, 0.185);
          const zBotBackPt = new THREE.Vector3(0, BOT_SLED_Y + 0.005, -0.190);
          const zDiagVec = new THREE.Vector3().subVectors(zTopFrontPt, zBotBackPt);
          const zDiagLen = zDiagVec.length();
          const zDiagQuat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            zDiagVec.clone().normalize()
          );

          const zDiagBeam = new THREE.Mesh(
            new THREE.BoxGeometry(0.046, zDiagLen, 0.068),
            deskFrameWhiteMat
          );
          zDiagBeam.position.addVectors(zTopFrontPt, zBotBackPt).multiplyScalar(0.5);
          zDiagBeam.quaternion.copy(zDiagQuat);
          zDiagBeam.castShadow = true;
          zDiagBeam.receiveShadow = true;
          zLeg.add(zDiagBeam);

          // Outer & inner tech armor plate + glowing ice-blue accent ridge on diagonal Z-beam
          const zArmorOuter = new THREE.Mesh(
            new THREE.BoxGeometry(0.054, zDiagLen * 0.72, 0.044),
            deskInnerSteelMat
          );
          zArmorOuter.position.copy(zDiagBeam.position);
          zArmorOuter.quaternion.copy(zDiagQuat);
          zLeg.add(zArmorOuter);

          const zBlueChannel = new THREE.Mesh(
            new THREE.BoxGeometry(0.057, zDiagLen * 0.64, 0.016),
            deskTechBlueMat
          );
          zBlueChannel.position.copy(zDiagBeam.position);
          zBlueChannel.quaternion.copy(zDiagQuat);
          zLeg.add(zBlueChannel);

          // Mechanical vertex gusset brackets at upper-front & lower-rear Z corners
          [zTopFrontPt, zBotBackPt].forEach((vPt) => {
            const gusset = new THREE.Mesh(
              new THREE.BoxGeometry(0.054, 0.046, 0.082),
              deskDarkTrimMat
            );
            gusset.position.copy(vPt);
            zLeg.add(gusset);
          });

          deskGroup.add(zLeg);
        });

        // Under-desk steel frame crossbeams & rear white+blue structural crossbar
        [-0.17, 0.16].forEach((rz) => {
          const underBeam = new THREE.Mesh(
            new THREE.BoxGeometry(DESK_W - 0.15, 0.024, 0.028),
            deskFrameWhiteMat
          );
          underBeam.position.set(0, LEG_H - 0.014, rz);
          underBeam.castShadow = true;
          deskGroup.add(underBeam);
        });

        const rearCrossbar = new THREE.Mesh(
          new THREE.BoxGeometry(DESK_W - 0.16, 0.042, 0.022),
          deskFrameWhiteMat
        );
        rearCrossbar.position.set(0, 0.35, -0.19);
        rearCrossbar.castShadow = true;
        deskGroup.add(rearCrossbar);

        const rearBlueStripe = new THREE.Mesh(
          new THREE.BoxGeometry(DESK_W - 0.24, 0.012, 0.025),
          deskTechBlueMat
        );
        rearBlueStripe.position.set(0, 0.35, -0.19);
        deskGroup.add(rearBlueStripe);

        // Under-desk rear cable management tray
        const cableTray = new THREE.Mesh(
          new THREE.BoxGeometry(DESK_W - 0.32, 0.036, 0.085),
          deskInnerSteelMat
        );
        cableTray.position.set(0, LEG_H - 0.065, -0.18);
        deskGroup.add(cableTray);

        coloredRoomGroup.add(deskGroup);

        // Interactive 3-Slot Beyblade X Deck Case at Left Corner of Study Desk (書桌左邊角落的 BEYBLADE X 三格陀螺收納盒，點擊打開第1格)
        const loadBeyTex = (url: string) => {
          const t = texMgr.loadTexture(url);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(t);
          return t;
        };
        const beyFrontLogoTex = loadBeyTex('/assets/beyblade_front_logo.webp');
        const beyLid1Tex = loadBeyTex('/assets/beyblade_lid_1.webp');
        const beyLid2Tex = loadBeyTex('/assets/beyblade_lid_2.webp');
        const beyLid3Tex = loadBeyTex('/assets/beyblade_lid_3.webp');
        const beyLidArtTex = loadBeyTex('/assets/beyblade_lid_art.webp');
        const beyChipTex = loadBeyTex('/assets/beyblade_chip.webp');

        const BEY_W = 0.234;
        const BEY_H = 0.082;
        const BEY_D = 0.082;
        const BEY_WALL = 0.0045;
        const BEY_INNER_W = BEY_W - BEY_WALL * 2;
        const BEY_SLOT_PITCH = BEY_INNER_W / 3;
        const BEY_LID_T = 0.0055;
        const BEY_BODY_H = BEY_H - BEY_LID_T;

        const beybladeBoxGroup = new THREE.Group();
        beybladeBoxGroup.position.set(-DESK_W / 2 + 0.165, DESK_H, -DESK_D / 2 + 0.125);
        beybladeBoxGroup.rotation.y = 0.34;

        // Materials matching frosted translucent icy-mint 3D-printed PLA & bright cyan accents
        const beyFrostedShellMat = new THREE.MeshPhysicalMaterial({
          color: 0xdff5f0,
          roughness: 0.36,
          metalness: 0.02,
          clearcoat: 0.38,
          clearcoatRoughness: 0.28,
          transparent: true,
          opacity: 0.78,
          envMapIntensity: 0.92,
        });
        const beyInnerFloorMat = new THREE.MeshStandardMaterial({
          color: 0xcbe8e2,
          roughness: 0.48,
          metalness: 0.02,
          envMapIntensity: 0.65,
        });
        const beyMintBaseMat = new THREE.MeshStandardMaterial({
          color: 0xbdebe0,
          roughness: 0.42,
          metalness: 0.03,
          envMapIntensity: 0.72,
        });
        const beyCyanAccentMat = new THREE.MeshPhysicalMaterial({
          color: 0x0e8bc7,
          roughness: 0.24,
          metalness: 0.08,
          clearcoat: 0.65,
          clearcoatRoughness: 0.14,
          envMapIntensity: 1.05,
        });
        const beySkyFrameMat = new THREE.MeshStandardMaterial({
          color: 0x359ce0,
          roughness: 0.34,
          metalness: 0.05,
          envMapIntensity: 0.85,
        });
        const beyGoldPinMat = new THREE.MeshStandardMaterial({
          color: 0xd8b44c,
          roughness: 0.24,
          metalness: 0.88,
          envMapIntensity: 1.25,
        });

        // Bottom floor slab & 4 outer frosted walls forming open-top 3-compartment housing
        const beyBottom = new THREE.Mesh(
          new THREE.BoxGeometry(BEY_W, BEY_WALL, BEY_D),
          beyInnerFloorMat
        );
        beyBottom.position.y = BEY_WALL / 2;
        beyBottom.castShadow = true;
        beyBottom.receiveShadow = true;
        beybladeBoxGroup.add(beyBottom);

        const beyFrontWall = new THREE.Mesh(
          new THREE.BoxGeometry(BEY_W, BEY_BODY_H, BEY_WALL),
          beyFrostedShellMat
        );
        beyFrontWall.position.set(0, BEY_BODY_H / 2, BEY_D / 2 - BEY_WALL / 2);
        beyFrontWall.castShadow = true;
        beyFrontWall.receiveShadow = true;
        beybladeBoxGroup.add(beyFrontWall);

        const beyBackWall = new THREE.Mesh(
          new THREE.BoxGeometry(BEY_W, BEY_BODY_H, BEY_WALL),
          beyFrostedShellMat
        );
        beyBackWall.position.set(0, BEY_BODY_H / 2, -BEY_D / 2 + BEY_WALL / 2);
        beyBackWall.castShadow = true;
        beyBackWall.receiveShadow = true;
        beybladeBoxGroup.add(beyBackWall);

        [-1, 1].forEach((side) => {
          const sideWall = new THREE.Mesh(
            new THREE.BoxGeometry(BEY_WALL, BEY_BODY_H, BEY_D - BEY_WALL * 2),
            beyFrostedShellMat
          );
          sideWall.position.set(side * (BEY_W / 2 - BEY_WALL / 2), BEY_BODY_H / 2, 0);
          sideWall.castShadow = true;
          sideWall.receiveShadow = true;
          beybladeBoxGroup.add(sideWall);

          // Bold raised cyan "X" emblem + tiny corner magnet dot on both left & right end faces
          const xEmblemGroup = new THREE.Group();
          xEmblemGroup.position.set(side * (BEY_W / 2 + 0.0018), BEY_BODY_H / 2, 0);
          xEmblemGroup.rotation.y = side * (Math.PI / 2);
          [0.58, -0.58].forEach((barAngle) => {
            const xBar = new THREE.Mesh(
              new THREE.BoxGeometry(0.011, 0.062, 0.0036),
              beyCyanAccentMat
            );
            xBar.rotation.z = barAngle;
            xBar.castShadow = true;
            xEmblemGroup.add(xBar);
          });
          const endPinDot = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0018, 0.0018, 0.002, 10),
            new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 })
          );
          endPinDot.rotation.x = Math.PI / 2;
          endPinDot.position.set(-side * (BEY_D / 2 - 0.008), BEY_BODY_H / 2 - 0.006, 0);
          xEmblemGroup.add(endPinDot);
          beybladeBoxGroup.add(xEmblemGroup);
        });

        // Two interior compartment divider walls separating Compartments 1, 2, 3
        [-0.5, 0.5].forEach((divIdx) => {
          const divider = new THREE.Mesh(
            new THREE.BoxGeometry(0.0036, BEY_BODY_H - BEY_WALL, BEY_D - BEY_WALL * 2),
            beyInnerFloorMat
          );
          divider.position.set(divIdx * BEY_SLOT_PITCH, BEY_WALL + (BEY_BODY_H - BEY_WALL) / 2, 0);
          divider.castShadow = true;
          divider.receiveShadow = true;
          beybladeBoxGroup.add(divider);
        });

        // Front raised "BEYBLADE X" nameplate + corner decorative angled ribs
        const beyFrontPlaque = new THREE.Mesh(
          new THREE.BoxGeometry(BEY_W * 0.86, BEY_BODY_H * 0.44, 0.0035),
          [
            beyMintBaseMat,
            beyMintBaseMat,
            beyMintBaseMat,
            beyMintBaseMat,
            new THREE.MeshPhysicalMaterial({
              map: beyFrontLogoTex,
              roughness: 0.34,
              metalness: 0.04,
              clearcoat: 0.32,
              envMapIntensity: 0.85,
            }),
            beyMintBaseMat,
          ]
        );
        beyFrontPlaque.position.set(0, BEY_BODY_H * 0.50, BEY_D / 2 + 0.0016);
        beyFrontPlaque.castShadow = true;
        beybladeBoxGroup.add(beyFrontPlaque);

        [-1, 1].forEach((side) => {
          for (let r = 0; r < 3; r++) {
            const rib = new THREE.Mesh(
              new THREE.BoxGeometry(0.0028, 0.011, 0.0015),
              beyFrostedShellMat
            );
            rib.position.set(
              side * (BEY_W / 2 - 0.012 - r * 0.0055),
              0.009,
              BEY_D / 2 + 0.0006
            );
            rib.rotation.z = side * 0.28;
            beybladeBoxGroup.add(rib);
          }
        });

        // Blue Translucent Beyblade X Spinning Top nestled inside Compartment #1
        const slot1CenterX = -BEY_SLOT_PITCH;
        const beyTopGroup = new THREE.Group();
        beyTopGroup.position.set(slot1CenterX, BEY_WALL + 0.002, 0.001);
        beyTopGroup.rotation.set(0.06, 0.42, -0.05);

        const beyMetalMat = new THREE.MeshStandardMaterial({
          color: 0xd7dfe8,
          roughness: 0.22,
          metalness: 0.86,
          envMapIntensity: 1.35,
        });
        const beyBlueBladeMat = new THREE.MeshPhysicalMaterial({
          color: 0x0b5eb0,
          roughness: 0.08,
          metalness: 0.06,
          clearcoat: 1.0,
          clearcoatRoughness: 0.06,
          transparent: true,
          opacity: 0.82,
          envMapIntensity: 1.45,
        });
        const beyAquaCoreMat = new THREE.MeshPhysicalMaterial({
          color: 0x26b0ee,
          roughness: 0.16,
          metalness: 0.12,
          clearcoat: 0.85,
          envMapIntensity: 1.25,
        });

        // Lower Ratchet & Bit base
        const beyBitMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.0035, 0.010, 14),
          beyAquaCoreMat
        );
        beyBitMesh.position.y = 0.005;
        beyTopGroup.add(beyBitMesh);

        const beyRatchetMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.020, 0.017, 0.007, 10),
          new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.34, metalness: 0.10 })
        );
        beyRatchetMesh.position.y = 0.011;
        beyTopGroup.add(beyRatchetMesh);

        // Die-cast silver metal blade outer wheel
        const beyMetalWheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.026, 0.024, 0.0065, 18),
          beyMetalMat
        );
        beyMetalWheel.position.y = 0.0155;
        beyMetalWheel.castShadow = true;
        beyTopGroup.add(beyMetalWheel);

        // 6 swept translucent cobalt-blue polycarbonate attack wings
        for (let wIdx = 0; wIdx < 6; wIdx++) {
          const wingAngle = (wIdx / 6) * Math.PI * 2;
          const wingMesh = new THREE.Mesh(
            new THREE.BoxGeometry(0.013, 0.0075, 0.018),
            beyBlueBladeMat
          );
          wingMesh.position.set(
            Math.cos(wingAngle) * 0.019,
            0.0185,
            Math.sin(wingAngle) * 0.019
          );
          wingMesh.rotation.y = -wingAngle + 0.48;
          wingMesh.castShadow = true;
          beyTopGroup.add(wingMesh);
        }

        // Translucent cobalt dome + cyan lock ring + circular Gear Chip graphic
        const beyDomeRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.0135, 0.0032, 10, 24),
          beyAquaCoreMat
        );
        beyDomeRing.rotation.x = Math.PI / 2;
        beyDomeRing.position.y = 0.0225;
        beyTopGroup.add(beyDomeRing);

        const beyGearChip = new THREE.Mesh(
          new THREE.CircleGeometry(0.0115, 24),
          new THREE.MeshPhysicalMaterial({
            map: beyChipTex,
            roughness: 0.14,
            clearcoat: 0.90,
            envMapIntensity: 1.15,
          })
        );
        beyGearChip.rotation.x = -Math.PI / 2;
        beyGearChip.position.y = 0.0235;
        beyTopGroup.add(beyGearChip);

        beybladeBoxGroup.add(beyTopGroup);

        // 3 Hinged Square Top Lids ("1 FIRST BEY", "2 SECOND BEY", "3 THIRD BEY")
        const LID_W = BEY_SLOT_PITCH - 0.0022;
        const LID_D = BEY_D - 0.003;
        const lidTextures = [beyLid1Tex, beyLid2Tex, beyLid3Tex];
        refs.beybladeLid1OpenRef.current = false;
        refs.beybladeLid1AngleRef.current = 0;

        lidTextures.forEach((lidTex, lIdx) => {
          const slotX = (lIdx - 1) * BEY_SLOT_PITCH;
          const lidPivot = new THREE.Group();
          // Rear hinge pivot along top-back edge of the housing
          lidPivot.position.set(slotX, BEY_BODY_H + BEY_LID_T / 2, -BEY_D / 2 + 0.002);

          const lidTopMat = new THREE.MeshPhysicalMaterial({
            map: lidTex,
            roughness: 0.34,
            metalness: 0.02,
            clearcoat: 0.28,
            clearcoatRoughness: 0.22,
            envMapIntensity: 0.85,
          });
          const lidBody = new THREE.Mesh(
            new THREE.BoxGeometry(LID_W, BEY_LID_T, LID_D),
            [
              beyMintBaseMat,
              beyMintBaseMat,
              lidTopMat,
              beyMintBaseMat,
              beyCyanAccentMat,
              beyMintBaseMat,
            ]
          );
          lidBody.position.set(0, 0, LID_D / 2);
          lidBody.castShadow = true;
          lidBody.receiveShadow = true;
          lidPivot.add(lidBody);

          // Sky-blue front latch lip accent visible along front top rim
          const lidLatch = new THREE.Mesh(
            new THREE.BoxGeometry(LID_W * 0.56, BEY_LID_T * 0.72, 0.0032),
            beyCyanAccentMat
          );
          lidLatch.position.set(0, -0.0005, LID_D + 0.0008);
          lidPivot.add(lidLatch);

          if (lIdx === 0) {
            // Underside inner blue pocket frame + Beyblade X sticker card + 2 gold magnet pins on Lid #1
            const innerFrame = new THREE.Mesh(
              new THREE.BoxGeometry(LID_W * 0.86, 0.0024, LID_D * 0.88),
              beySkyFrameMat
            );
            innerFrame.position.set(0, -BEY_LID_T / 2 - 0.0012, LID_D * 0.50);
            lidPivot.add(innerFrame);

            const innerArtPlane = new THREE.Mesh(
              new THREE.PlaneGeometry(LID_W * 0.74, LID_D * 0.78),
              new THREE.MeshPhysicalMaterial({
                map: beyLidArtTex,
                roughness: 0.22,
                metalness: 0.01,
                clearcoat: 0.72,
                clearcoatRoughness: 0.10,
                envMapIntensity: 1.05,
              })
            );
            innerArtPlane.rotation.x = Math.PI / 2;
            innerArtPlane.position.set(0, -BEY_LID_T / 2 - 0.0026, LID_D * 0.49);
            lidPivot.add(innerArtPlane);

            [-1, 1].forEach((mSide) => {
              const goldPin = new THREE.Mesh(
                new THREE.CylinderGeometry(0.0017, 0.0017, 0.0012, 12),
                beyGoldPinMat
              );
              goldPin.position.set(
                mSide * (LID_W * 0.37),
                -BEY_LID_T / 2 - 0.0025,
                LID_D * 0.89
              );
              lidPivot.add(goldPin);
            });

            refs.beybladeLid1PivotRef.current = lidPivot;
          }

          beybladeBoxGroup.add(lidPivot);
        });

        // Invisible generous raycast hitbox for clicking the Beyblade box to open/close Lid #1
        const beybladeBoxHitbox = new THREE.Mesh(
          new THREE.BoxGeometry(BEY_W + 0.04, BEY_H + 0.08, BEY_D + 0.04),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        beybladeBoxHitbox.name = 'beyblade_box_hitbox';
        beybladeBoxHitbox.position.set(0, (BEY_H + 0.06) / 2, 0);
        refs.beybladeBoxHitboxRef.current = beybladeBoxHitbox;
        beybladeBoxGroup.add(beybladeBoxHitbox);

        deskGroup.add(beybladeBoxGroup);

        // MISSY "甜·喪·蘿·莉·系·列" Cute Lolita Blind Box on Study Desk (書桌上的 MISSY 盲盒)
        const loadMissyTex = (url: string) => {
          const t = texMgr.loadTexture(url);
          t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(t);
          return t;
        };
        const missyFrontTex = loadMissyTex('/assets/box_missy_front.webp');
        const missyTopTex = loadMissyTex('/assets/box_missy_top.webp');
        const missySideTex = loadMissyTex('/assets/box_missy_side.webp');

        // Procedural matching pink-rose argyle diamond pattern for secondary side/bottom faces
        const createMissyArgyleTex = () => {
          const mc = document.createElement('canvas');
          mc.width = 256;
          mc.height = 384;
          const mctx = mc.getContext('2d');
          if (mctx) {
            mctx.fillStyle = '#c88097';
            mctx.fillRect(0, 0, 256, 384);
            const dw = 42;
            const dh = 64;
            for (let row = -1; row < 8; row++) {
              for (let col = -1; col < 8; col++) {
                const cx = col * dw + (row % 2 === 0 ? 0 : dw / 2);
                const cy = row * dh;
                mctx.fillStyle = (row + col) % 2 === 0 ? '#dca2b5' : '#ba7088';
                mctx.beginPath();
                mctx.moveTo(cx, cy - dh / 2);
                mctx.lineTo(cx + dw / 2, cy);
                mctx.lineTo(cx, cy + dh / 2);
                mctx.lineTo(cx - dw / 2, cy);
                mctx.closePath();
                mctx.fill();
              }
            }
            // Subtle white bottom label band with "CYTOYS" & barcode lines
            mctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            mctx.fillRect(46, 304, 164, 52);
            mctx.fillStyle = '#334155';
            for (let bx = 58; bx < 198; bx += 6) {
              const bw = bx % 12 === 0 ? 3 : 1.5;
              mctx.fillRect(bx, 314, bw, 28);
            }
          }
          const tex = new THREE.CanvasTexture(mc);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(tex);
          return tex;
        };
        const missyArgyleTex = createMissyArgyleTex();

        const MISSY_W = 0.112;
        const MISSY_H = 0.148;
        const MISSY_D = 0.088;
        const missyBoxGroup = new THREE.Group();

        const makeCardboardMat = (map: THREE.Texture) =>
          new THREE.MeshPhysicalMaterial({
            map,
            color: 0xffffff,
            roughness: 0.34,
            metalness: 0.02,
            clearcoat: 0.45,
            clearcoatRoughness: 0.18,
            envMapIntensity: 0.82,
          });

        const missyBoxMaterials = [
          makeCardboardMat(missySideTex),   // +X right side (spec text)
          makeCardboardMat(missyArgyleTex), // -X left side (argyle diamond)
          makeCardboardMat(missyTopTex),    // +Y top lid ("MISSY / 玩樂尋潮")
          makeCardboardMat(missyArgyleTex), // -Y bottom
          makeCardboardMat(missyFrontTex),  // +Z front ("MISSY" chibi girl)
          makeCardboardMat(missySideTex),   // -Z back (CYTOYS spec sheet)
        ];

        const missyMainBox = new THREE.Mesh(
          new THREE.BoxGeometry(MISSY_W, MISSY_H, MISSY_D),
          missyBoxMaterials
        );
        missyMainBox.position.y = MISSY_H / 2;
        missyMainBox.castShadow = true;
        missyMainBox.receiveShadow = true;
        missyBoxGroup.add(missyMainBox);

        // Subtle recessed lid-flap crease lip on top edge for crisp retail packaging relief
        const missyLidCreaseMat = new THREE.MeshStandardMaterial({
          color: 0xdfb2c2,
          roughness: 0.52,
          metalness: 0.02,
        });
        const missyTopFlapRim = new THREE.Mesh(
          new THREE.BoxGeometry(MISSY_W + 0.0012, 0.0032, MISSY_D + 0.0012),
          missyLidCreaseMat
        );
        missyTopFlapRim.position.y = MISSY_H - 0.0022;
        missyBoxGroup.add(missyTopFlapRim);

        // Subtle crisp corner fold shadow bands along top/bottom cardboard seams
        const missySeamBar = new THREE.Mesh(
          new THREE.BoxGeometry(MISSY_W - 0.008, 0.0016, 0.0024),
          missyLidCreaseMat
        );
        missySeamBar.position.set(0, MISSY_H + 0.0006, -MISSY_D / 2 + 0.008);
        // missyBoxGroup is constructed here and mounted in 1st cabinet (idx === 0), 3rd tier rightmost
        missyBoxGroup.add(missySeamBar);

        // B5 Slate-Indigo "方格筆記 / TAKE A TRIP 小雪戸温の交換日記" Notebook resting on Study Desk (桌上的筆記本)
        const notebookCoverTex = texMgr.loadTexture('/assets/desk_notebook_cover.webp');
        notebookCoverTex.colorSpace = THREE.SRGBColorSpace;
        notebookCoverTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(notebookCoverTex);

        const createNotebookPageEdgeTex = () => {
          const pc = document.createElement('canvas');
          pc.width = 256;
          pc.height = 64;
          const pctx = pc.getContext('2d');
          if (pctx) {
            pctx.fillStyle = '#f5f0e2';
            pctx.fillRect(0, 0, 256, 64);
            for (let y = 2; y < 64; y += 3) {
              pctx.fillStyle = y % 6 === 0 ? 'rgba(176, 162, 138, 0.34)' : 'rgba(255, 252, 244, 0.32)';
              pctx.fillRect(0, y, 256, 1.2);
            }
          }
          const tex = new THREE.CanvasTexture(pc);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          texMgr.registerTexture(tex);
          return tex;
        };
        const nbPageEdgeTex = createNotebookPageEdgeTex();

        const NB_W = 0.182;
        const NB_H = 0.015;
        const NB_D = 0.256;
        const COVER_T = 0.0018;
        const deskNotebookGroup = new THREE.Group();

        const nbCoverEdgeMat = new THREE.MeshStandardMaterial({
          color: 0x52586c,
          roughness: 0.86,
          metalness: 0.0,
          envMapIntensity: 0.38,
        });
        const nbCoverFrontMat = new THREE.MeshStandardMaterial({
          map: notebookCoverTex,
          color: 0xffffff,
          roughness: 0.84,
          metalness: 0.0,
          envMapIntensity: 0.40,
        });
        const nbPageBlockMat = new THREE.MeshStandardMaterial({
          map: nbPageEdgeTex,
          color: 0xf7f2e6,
          roughness: 0.92,
          metalness: 0.0,
          envMapIntensity: 0.32,
        });
        const nbSpineClothMat = new THREE.MeshStandardMaterial({
          color: 0x43495b,
          roughness: 0.90,
          metalness: 0.0,
          envMapIntensity: 0.34,
        });

        // Bottom back cover board resting flush on DESK_H
        const nbBackBoard = new THREE.Mesh(
          new THREE.BoxGeometry(NB_W, COVER_T, NB_D),
          nbCoverEdgeMat
        );
        nbBackBoard.position.y = COVER_T / 2;
        nbBackBoard.castShadow = true;
        nbBackBoard.receiveShadow = true;
        deskNotebookGroup.add(nbBackBoard);

        // Cream grid paper stack slightly inset inside top & bottom covers
        const nbPagesH = NB_H - COVER_T * 2;
        const nbPageBlock = new THREE.Mesh(
          new THREE.BoxGeometry(NB_W - 0.005, nbPagesH, NB_D - 0.005),
          nbPageBlockMat
        );
        nbPageBlock.position.set(0.001, COVER_T + nbPagesH / 2, 0);
        nbPageBlock.castShadow = true;
        nbPageBlock.receiveShadow = true;
        deskNotebookGroup.add(nbPageBlock);

        // Front cover slab + vivid matte-printed top artwork
        const nbFrontBoard = new THREE.Mesh(
          new THREE.BoxGeometry(NB_W, COVER_T, NB_D),
          [
            nbCoverEdgeMat,
            nbCoverEdgeMat,
            nbCoverFrontMat,
            nbCoverEdgeMat,
            nbCoverEdgeMat,
            nbCoverEdgeMat,
          ]
        );
        nbFrontBoard.position.y = NB_H - COVER_T / 2;
        nbFrontBoard.castShadow = true;
        nbFrontBoard.receiveShadow = true;
        deskNotebookGroup.add(nbFrontBoard);

        // Bound indigo spine strip along left edge
        const nbSpineStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.006, NB_H + 0.0005, NB_D + 0.0006),
          nbSpineClothMat
        );
        nbSpineStrip.position.set(-NB_W / 2 + 0.001, NB_H / 2, 0);
        nbSpineStrip.castShadow = true;
        deskNotebookGroup.add(nbSpineStrip);

        // Subtle cream fabric ribbon bookmark peeking out from the bottom page edge
        const nbRibbon = new THREE.Mesh(
          new THREE.BoxGeometry(0.007, 0.0012, 0.024),
          new THREE.MeshStandardMaterial({ color: 0xebe2ce, roughness: 0.88 })
        );
        nbRibbon.position.set(0.018, 0.0022, NB_D / 2 + 0.009);
        nbRibbon.rotation.y = 0.14;
        deskNotebookGroup.add(nbRibbon);

        deskNotebookGroup.position.set(-0.04, DESK_H, 0.075);
        deskNotebookGroup.rotation.y = 0.16;
        deskGroup.add(deskNotebookGroup);

        // Jumbo Support Uchiwa Fan in Clear Zippered Cover hanging on Wall Right of Room Door (門右側牆面吊掛之「Happy Valentine's Day♡」應援推扇)
        const uchiwaFrontTex = texMgr.loadTexture('/assets/uchiwa_fan_front.webp');
        uchiwaFrontTex.colorSpace = THREE.SRGBColorSpace;
        uchiwaFrontTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(uchiwaFrontTex);

        const uchiwaFanGroup = new THREE.Group();
        const UW_R = 0.148;
        const UW_SCALE_Y = 0.875;

        const uchiwaBackCardMat = new THREE.MeshStandardMaterial({
          color: 0xfaf7f2,
          roughness: 0.80,
          metalness: 0.0,
          envMapIntensity: 0.42,
        });
        const uchiwaArtMat = new THREE.MeshPhysicalMaterial({
          map: uchiwaFrontTex,
          transparent: true,
          alphaTest: 0.15,
          roughness: 0.20,
          metalness: 0.01,
          clearcoat: 0.78,
          clearcoatRoughness: 0.10,
          envMapIntensity: 1.05,
        });
        const uchiwaSkyRimMat = new THREE.MeshStandardMaterial({
          color: 0x74bbe6,
          roughness: 0.46,
          metalness: 0.03,
          envMapIntensity: 0.62,
        });
        const uchiwaHandleMat = new THREE.MeshStandardMaterial({
          color: 0xf4f6f8,
          roughness: 0.34,
          metalness: 0.04,
          envMapIntensity: 0.75,
        });
        const uchiwaVinylCoverMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.05,
          metalness: 0.01,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          reflectivity: 0.96,
          envMapIntensity: 1.45,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
        });
        const uchiwaZipRimMat = new THREE.MeshStandardMaterial({
          color: 0xe6edf5,
          roughness: 0.32,
          metalness: 0.24,
          transparent: true,
          opacity: 0.85,
        });

        // 1. Cardboard paddle body & sky-blue printed frame border
        const uchiwaDisc = new THREE.Mesh(
          new THREE.CylinderGeometry(UW_R - 0.002, UW_R - 0.002, 0.003, 48),
          uchiwaBackCardMat
        );
        uchiwaDisc.rotation.x = Math.PI / 2;
        uchiwaDisc.scale.set(1.0, 1.0, UW_SCALE_Y);
        uchiwaDisc.castShadow = true;
        uchiwaDisc.receiveShadow = true;
        uchiwaFanGroup.add(uchiwaDisc);

        const uchiwaBlueRimRing = new THREE.Mesh(
          new THREE.RingGeometry(UW_R - 0.012, UW_R - 0.001, 56),
          uchiwaSkyRimMat
        );
        uchiwaBlueRimRing.scale.set(1.0, UW_SCALE_Y, 1.0);
        uchiwaBlueRimRing.position.z = 0.0020;
        uchiwaFanGroup.add(uchiwaBlueRimRing);

        // Front idol art panel
        const uchiwaFrontMesh = new THREE.Mesh(
          new THREE.CircleGeometry(UW_R - 0.010, 56),
          uchiwaArtMat
        );
        uchiwaFrontMesh.scale.set(1.0, UW_SCALE_Y, 1.0);
        uchiwaFrontMesh.position.z = 0.0024;
        uchiwaFanGroup.add(uchiwaFrontMesh);

        // 2. Clear Protective Zippered PVC Cover Sleeve + Top Hanging Grommet Tab & Wall Hook
        const vinylOverlay = new THREE.Mesh(
          new THREE.CircleGeometry(UW_R + 0.004, 56),
          uchiwaVinylCoverMat
        );
        vinylOverlay.scale.set(1.0, UW_SCALE_Y, 1.0);
        vinylOverlay.position.z = 0.0042;
        uchiwaFanGroup.add(vinylOverlay);

        const zipperTrackArc = new THREE.Mesh(
          new THREE.TorusGeometry(UW_R + 0.003, 0.0022, 8, 56),
          uchiwaZipRimMat
        );
        zipperTrackArc.scale.set(1.0, UW_SCALE_Y, 1.0);
        zipperTrackArc.position.z = 0.0025;
        uchiwaFanGroup.add(zipperTrackArc);

        const zipPull = new THREE.Mesh(
          new THREE.BoxGeometry(0.011, 0.006, 0.005),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.72 })
        );
        zipPull.position.set(-0.020, -UW_R * UW_SCALE_Y - 0.002, 0.005);
        zipPull.rotation.z = 0.35;
        uchiwaFanGroup.add(zipPull);

        // Clear top hanging grommet tab + wall hook at 12 o'clock
        const topHookTab = new THREE.Mesh(
          new THREE.BoxGeometry(0.026, 0.020, 0.003),
          uchiwaZipRimMat
        );
        topHookTab.position.set(0.008, UW_R * UW_SCALE_Y + 0.009, 0.002);
        uchiwaFanGroup.add(topHookTab);

        const wallHookPin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0038, 0.0038, 0.014, 12),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.24, metalness: 0.85 })
        );
        wallHookPin.rotation.x = Math.PI / 2;
        wallHookPin.position.set(0.008, UW_R * UW_SCALE_Y + 0.011, -0.001);
        uchiwaFanGroup.add(wallHookPin);

        // 3. Ridged White Plastic Uchiwa Handle extending cleanly down at 6 o'clock
        const uHandleNeck = new THREE.Mesh(
          new THREE.CylinderGeometry(0.013, 0.012, 0.022, 16),
          uchiwaHandleMat
        );
        uHandleNeck.scale.set(1.0, 1.0, 0.36);
        uHandleNeck.position.set(0, -UW_R * UW_SCALE_Y - 0.002, 0.001);
        uchiwaFanGroup.add(uHandleNeck);

        const uHandleStem = new THREE.Mesh(
          new THREE.BoxGeometry(0.021, 0.132, 0.005),
          uchiwaHandleMat
        );
        uHandleStem.position.set(0, -UW_R * UW_SCALE_Y - 0.068, 0.001);
        uHandleStem.castShadow = true;
        uchiwaFanGroup.add(uHandleStem);

        [-0.005, 0, 0.005].forEach((rx) => {
          const spineRib = new THREE.Mesh(
            new THREE.BoxGeometry(0.0018, 0.118, 0.0068),
            uchiwaHandleMat
          );
          spineRib.position.set(rx, -UW_R * UW_SCALE_Y - 0.066, 0.001);
          uchiwaFanGroup.add(spineRib);
        });

        const handleSlot = new THREE.Mesh(
          new THREE.BoxGeometry(0.0065, 0.0085, 0.006),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
        );
        handleSlot.position.set(0, -UW_R * UW_SCALE_Y - 0.123, 0.0015);
        // uchiwaFanGroup is constructed here and mounted inside upper capsule pod near doorway
        uchiwaFanGroup.add(handleSlot);

        // 2-Tier Shoe Rack + 4 Pairs of Light-Blue Plush Slippers directly below Hanging Uchiwa Fan (門右側推扇下方的雙層鞋架＋四雙淺藍色毛絨拖鞋)
        const shoeRackGroup = new THREE.Group();
        const RACK_W = 0.84;
        const RACK_D = 0.28;
        const RACK_H = 0.36;
        shoeRackGroup.position.set(-2.66, 0, -PR_SIZE / 2 + 0.04 + RACK_D / 2);

        const rackFrameMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.36,
          metalness: 0.06,
          envMapIntensity: 0.72,
        });
        const rackBirchWoodTex = texMgr.cloneTexture(texMgr.getWhiteOakWoodTexture(), 1.2, 0.6);

        const rackShelfSlatMat = new THREE.MeshStandardMaterial({
          map: rackBirchWoodTex,
          color: 0xf4ede3,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.58,
        });

        // 4 Clean White Frame Posts + Side Crossbars
        const postOffX = RACK_W / 2 - 0.016;
        const postOffZ = RACK_D / 2 - 0.016;
        [
          [-postOffX, -postOffZ],
          [postOffX, -postOffZ],
          [-postOffX, postOffZ],
          [postOffX, postOffZ],
        ].forEach(([px, pz]) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.024, RACK_H, 0.024), rackFrameMat);
          post.position.set(px, RACK_H / 2, pz);
          post.castShadow = true;
          post.receiveShadow = true;
          shoeRackGroup.add(post);
        });

        const TIER_Y = [0.088, 0.288] as const;
        TIER_Y.forEach((ty) => {
          [-postOffX, postOffX].forEach((px) => {
            const sideRail = new THREE.Mesh(
              new THREE.BoxGeometry(0.018, 0.022, RACK_D - 0.02),
              rackFrameMat
            );
            sideRail.position.set(px, ty - 0.008, 0);
            shoeRackGroup.add(sideRail);
          });
          [-postOffZ, postOffZ].forEach((pz) => {
            const frontBackRail = new THREE.Mesh(
              new THREE.BoxGeometry(RACK_W - 0.02, 0.020, 0.018),
              rackFrameMat
            );
            frontBackRail.position.set(0, ty - 0.008, pz);
            frontBackRail.castShadow = true;
            shoeRackGroup.add(frontBackRail);
          });

          // 4 ventilated wooden slats forming each shoe shelf level
          [-0.088, -0.029, 0.029, 0.088].forEach((sz) => {
            const slat = new THREE.Mesh(
              new THREE.BoxGeometry(RACK_W - 0.036, 0.014, 0.042),
              rackShelfSlatMat
            );
            slat.position.set(0, ty, sz);
            slat.castShadow = true;
            slat.receiveShadow = true;
            shoeRackGroup.add(slat);
          });
        });

        // Plush fur material for 4 pairs of soft light-blue house slippers
        const slipFurCanvas = document.createElement('canvas');
        slipFurCanvas.width = 128;
        slipFurCanvas.height = 128;
        const sfCtx = slipFurCanvas.getContext('2d');
        if (sfCtx) {
          sfCtx.fillStyle = '#cbe9fa';
          sfCtx.fillRect(0, 0, 128, 128);
          for (let i = 0; i < 650; i++) {
            const sx = (i * 53) % 128;
            const sy = (i * 97) % 128;
            sfCtx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.45)' : 'rgba(130,192,230,0.42)';
            sfCtx.lineWidth = 1.4;
            sfCtx.beginPath();
            sfCtx.moveTo(sx, sy);
            sfCtx.lineTo(sx + ((i % 5) - 2) * 2.2, sy - 6);
            sfCtx.stroke();
          }
        }
        const slipFurTex = new THREE.CanvasTexture(slipFurCanvas);
        slipFurTex.colorSpace = THREE.SRGBColorSpace;
        slipFurTex.wrapS = THREE.RepeatWrapping;
        slipFurTex.wrapT = THREE.RepeatWrapping;
        slipFurTex.repeat.set(2.4, 2.4);
        texMgr.registerTexture(slipFurTex);

        const slipperBlueFurMat = new THREE.MeshPhysicalMaterial({
          map: slipFurTex,
          color: 0x9bd6f5,
          roughness: 0.95,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.64,
          sheenColor: new THREE.Color(0xe6f7ff),
          envMapIntensity: 0.36,
        });
        const slipperInnerFleeceMat = new THREE.MeshPhysicalMaterial({
          map: slipFurTex,
          color: 0xbde4fa,
          roughness: 0.96,
          metalness: 0.0,
          sheen: 0.85,
          sheenColor: new THREE.Color(0xffffff),
          envMapIntensity: 0.34,
        });
        const slipperSoleMat = new THREE.MeshStandardMaterial({
          color: 0xe6edf2,
          roughness: 0.86,
          metalness: 0.01,
          envMapIntensity: 0.40,
        });

        const createLightBluePlushSlipper = (footSign: -1 | 1) => {
          const slGrp = new THREE.Group();

          // Rounded slipper footprint sole (21.5cm long × 9.2cm wide)
          const soleShape = new THREE.Shape();
          soleShape.moveTo(0, -0.105);
          soleShape.bezierCurveTo(footSign * 0.042, -0.105, footSign * 0.044, -0.040, footSign * 0.044, 0.015);
          soleShape.bezierCurveTo(footSign * 0.048, 0.068, footSign * 0.036, 0.106, 0, 0.108);
          soleShape.bezierCurveTo(-footSign * 0.036, 0.106, -footSign * 0.042, 0.065, -footSign * 0.038, 0.010);
          soleShape.bezierCurveTo(-footSign * 0.038, -0.045, -footSign * 0.036, -0.105, 0, -0.105);

          const soleMesh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(soleShape, {
              depth: 0.014,
              bevelEnabled: true,
              bevelThickness: 0.004,
              bevelSize: 0.003,
              bevelSegments: 3,
              curveSegments: 14,
            }),
            slipperSoleMat
          );
          soleMesh.rotation.x = -Math.PI / 2;
          soleMesh.position.y = 0.004;
          soleMesh.castShadow = true;
          soleMesh.receiveShadow = true;
          slGrp.add(soleMesh);

          // Soft plush cushioned insole top pad
          const insoleMesh = new THREE.Mesh(
            new THREE.ExtrudeGeometry(soleShape, {
              depth: 0.005,
              bevelEnabled: true,
              bevelThickness: 0.003,
              bevelSize: 0.002,
              bevelSegments: 2,
              curveSegments: 12,
            }),
            slipperInnerFleeceMat
          );
          insoleMesh.rotation.x = -Math.PI / 2;
          insoleMesh.scale.set(0.92, 0.94, 1.0);
          insoleMesh.position.y = 0.020;
          insoleMesh.receiveShadow = true;
          slGrp.add(insoleMesh);

          // Fluffy domed closed-front/plush upper muff + soft fleece collar roll (毛絨鞋頭與絨毛領口)
          const vampDome = new THREE.Mesh(
            new THREE.SphereGeometry(0.046, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
            slipperBlueFurMat
          );
          vampDome.scale.set(0.95, 0.85, 1.48);
          vampDome.position.set(footSign * 0.002, 0.022, 0.036);
          vampDome.castShadow = true;
          vampDome.receiveShadow = true;
          slGrp.add(vampDome);

          // Plump plush fur collar cuff across top opening of slipper
          const furCuff = new THREE.Mesh(
            new THREE.TorusGeometry(0.038, 0.013, 10, 20),
            slipperBlueFurMat
          );
          furCuff.rotation.x = Math.PI / 2 + 0.35;
          furCuff.scale.set(1.06, 0.85, 1.0);
          furCuff.position.set(footSign * 0.002, 0.044, -0.005);
          furCuff.castShadow = true;
          slGrp.add(furCuff);

          // Subtle small fur tufts around cuff rim for authentic fluffy finish
          for (let ti = 0; ti < 10; ti++) {
            const ang = (ti / 10) * Math.PI * 2;
            const tMesh = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.011, 5), slipperBlueFurMat);
            tMesh.position.set(
              footSign * 0.002 + Math.cos(ang) * 0.042,
              0.046 + (ti % 2) * 0.004,
              -0.005 + Math.sin(ang) * 0.030
            );
            tMesh.rotation.set(Math.sin(ang) * 0.6, 0, -Math.cos(ang) * 0.6);
            slGrp.add(tMesh);
          }

          return slGrp;
        };

        // 4 Pairs arranged neatly across both tiers (2 pairs lower tier, 2 pairs upper tier)
        TIER_Y.forEach((ty, tierIdx) => {
          [-0.20, 0.20].forEach((pairX, pairIdx) => {
            const pairGroup = new THREE.Group();
            pairGroup.position.set(pairX, ty + 0.007, 0.012);
            pairGroup.rotation.y = (tierIdx === 0 ? 1 : -1) * (pairIdx === 0 ? 0.04 : -0.05);

            const leftSlip = createLightBluePlushSlipper(-1);
            leftSlip.position.set(-0.049, 0, 0);
            leftSlip.rotation.y = 0.03;
            pairGroup.add(leftSlip);

            const rightSlip = createLightBluePlushSlipper(1);
            rightSlip.position.set(0.049, 0, 0.004);
            rightSlip.rotation.y = -0.04;
            pairGroup.add(rightSlip);

            shoeRackGroup.add(pairGroup);
          });
        });

        coloredRoomGroup.add(shoeRackGroup);

        // Umbrella Stand & Translucent Aqua-Blue Vinyl Umbrella at Left Wall Corner beside Room Door (門左側牆角的雨傘桶與淡藍漸層透明雨傘)
        const umbrellaCornerGroup = new THREE.Group();
        umbrellaCornerGroup.position.set(-4.76, 0, -3.26);

        const standOuterMat = new THREE.MeshPhysicalMaterial({
          color: 0xf4f5f7,
          roughness: 0.28,
          metalness: 0.06,
          clearcoat: 0.48,
          clearcoatRoughness: 0.20,
          envMapIntensity: 0.88,
        });
        const standInnerMat = new THREE.MeshStandardMaterial({
          color: 0xcbd2da,
          roughness: 0.64,
          metalness: 0.04,
          side: THREE.BackSide,
          envMapIntensity: 0.50,
        });
        const standBaseMat = new THREE.MeshStandardMaterial({
          color: 0x475569,
          roughness: 0.68,
          metalness: 0.16,
          envMapIntensity: 0.55,
        });
        const standChromeMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.20,
          metalness: 0.88,
          envMapIntensity: 1.35,
        });

        const STAND_R = 0.112;
        const STAND_H = 0.450;

        // Weighted rubber/slate base collar & recessed drip tray at Y = 0
        const standFoot = new THREE.Mesh(
          new THREE.CylinderGeometry(STAND_R + 0.005, STAND_R + 0.007, 0.026, 32),
          standBaseMat
        );
        standFoot.position.y = 0.013;
        standFoot.castShadow = true;
        standFoot.receiveShadow = true;
        umbrellaCornerGroup.add(standFoot);

        const standTrayFloor = new THREE.Mesh(
          new THREE.CylinderGeometry(STAND_R - 0.006, STAND_R - 0.006, 0.012, 28),
          standBaseMat
        );
        standTrayFloor.position.y = 0.024;
        standTrayFloor.receiveShadow = true;
        umbrellaCornerGroup.add(standTrayFloor);

        // Hollow open-top cylindrical stand body (outer wall + inner wall + brushed metal rim)
        const standWallOuter = new THREE.Mesh(
          new THREE.CylinderGeometry(STAND_R, STAND_R - 0.004, STAND_H - 0.024, 36, 1, true),
          standOuterMat
        );
        standWallOuter.position.y = 0.024 + (STAND_H - 0.024) / 2;
        standWallOuter.castShadow = true;
        standWallOuter.receiveShadow = true;
        umbrellaCornerGroup.add(standWallOuter);

        const standWallInner = new THREE.Mesh(
          new THREE.CylinderGeometry(STAND_R - 0.005, STAND_R - 0.008, STAND_H - 0.026, 32, 1, true),
          standInnerMat
        );
        standWallInner.position.y = 0.025 + (STAND_H - 0.026) / 2;
        standWallInner.receiveShadow = true;
        umbrellaCornerGroup.add(standWallInner);

        const standTopRim = new THREE.Mesh(
          new THREE.TorusGeometry(STAND_R - 0.002, 0.007, 12, 36),
          standChromeMat
        );
        standTopRim.rotation.x = Math.PI / 2;
        standTopRim.position.y = STAND_H;
        standTopRim.castShadow = true;
        umbrellaCornerGroup.add(standTopRim);

        // Subtle mid metallic trim band for realistic household stand finish
        const standMidBand = new THREE.Mesh(
          new THREE.TorusGeometry(STAND_R - 0.001, 0.0032, 10, 36),
          standChromeMat
        );
        standMidBand.rotation.x = Math.PI / 2;
        standMidBand.position.y = 0.14;
        umbrellaCornerGroup.add(standMidBand);

        // Procedural Translucent Frosted Aqua-Blue Vinyl Canopy CanvasTexture matching reference umbrella
        const createUmbrellaCanopyTexture = () => {
          const uc = document.createElement('canvas');
          uc.width = 512;
          uc.height = 512;
          const uctx = uc.getContext('2d');
          if (uctx) {
            uctx.clearRect(0, 0, 512, 512);

            // Base vertical alpha + aqua watercolor gradient (top y=0 clear crown -> bottom y=512 misty aqua skirt)
            const bodyGrad = uctx.createLinearGradient(0, 0, 0, 512);
            bodyGrad.addColorStop(0.00, 'rgba(220, 246, 252, 0.34)');
            bodyGrad.addColorStop(0.32, 'rgba(182, 234, 246, 0.42)');
            bodyGrad.addColorStop(0.58, 'rgba(98, 194, 220, 0.72)');
            bodyGrad.addColorStop(0.84, 'rgba(122, 206, 228, 0.80)');
            bodyGrad.addColorStop(1.00, 'rgba(210, 240, 248, 0.84)');
            uctx.fillStyle = bodyGrad;
            uctx.fillRect(0, 0, 512, 512);

            // Delicate white sweeping arc line near upper vinyl panels (seen in both open & closed reference photos)
            uctx.strokeStyle = 'rgba(248, 252, 255, 0.78)';
            uctx.lineWidth = 9;
            uctx.beginPath();
            uctx.moveTo(0, 128);
            uctx.bezierCurveTo(170, 92, 340, 156, 512, 122);
            uctx.stroke();

            // Subtle icy-aqua vertical rain-streak highlights along lower half
            for (let i = 0; i < 42; i++) {
              const rx = (i * 47 + 19) % 512;
              const ry = 230 + ((i * 31) % 90);
              const rg = uctx.createLinearGradient(rx, ry, rx, 512);
              rg.addColorStop(0, 'rgba(255, 255, 255, 0)');
              rg.addColorStop(0.45, 'rgba(235, 250, 255, 0.28)');
              rg.addColorStop(1, 'rgba(255, 255, 255, 0.42)');
              uctx.fillStyle = rg;
              uctx.fillRect(rx, ry, 5 + (i % 4) * 2, 512 - ry);
            }
          }
          const tex = new THREE.CanvasTexture(uc);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(tex);
          return tex;
        };

        const umbrellaCanopyTex = createUmbrellaCanopyTexture();

        // Folded 8-Pleated Vinyl Umbrella leaning ferrule-down inside the Umbrella Stand
        const umbrellaGroup = new THREE.Group();
        const umbAquaPlasticMat = new THREE.MeshPhysicalMaterial({
          color: 0x74bcc9,
          roughness: 0.20,
          metalness: 0.04,
          clearcoat: 0.82,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.15,
        });
        const umbPaleAquaMat = new THREE.MeshPhysicalMaterial({
          color: 0xbde4ed,
          roughness: 0.24,
          metalness: 0.02,
          clearcoat: 0.72,
          envMapIntensity: 1.05,
        });
        const umbDarkRibMat = new THREE.MeshStandardMaterial({
          color: 0x262e38,
          roughness: 0.30,
          metalness: 0.78,
          envMapIntensity: 1.15,
        });
        const umbShaftSilverMat = new THREE.MeshStandardMaterial({
          color: 0xdce2e8,
          roughness: 0.18,
          metalness: 0.90,
          envMapIntensity: 1.38,
        });
        const umbClearHandleMat = new THREE.MeshPhysicalMaterial({
          color: 0xf0faff,
          roughness: 0.04,
          metalness: 0.01,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          reflectivity: 0.96,
          envMapIntensity: 1.48,
          transparent: true,
          opacity: 0.56,
          depthWrite: false,
        });
        const umbCanopyVinylMat = new THREE.MeshPhysicalMaterial({
          map: umbrellaCanopyTex,
          transparent: true,
          roughness: 0.10,
          metalness: 0.01,
          clearcoat: 0.96,
          clearcoatRoughness: 0.06,
          reflectivity: 0.92,
          envMapIntensity: 1.38,
          side: THREE.DoubleSide,
          depthWrite: false,
        });

        // 1. Mint-aqua ferrule tip resting inside stand drip tray (y = 0 .. 0.075m)
        const ferruleCone = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0085, 0.0052, 0.072, 16),
          umbAquaPlasticMat
        );
        ferruleCone.position.y = 0.036;
        ferruleCone.castShadow = true;
        umbrellaGroup.add(ferruleCone);

        const ferruleTipSphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.0052, 12, 10),
          umbAquaPlasticMat
        );
        ferruleTipSphere.position.y = 0.004;
        umbrellaGroup.add(ferruleTipSphere);

        // 2. Central metallic shaft + dark runner notch visible beneath clear vinyl
        const umbShaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0046, 0.0046, 0.665, 14),
          umbShaftSilverMat
        );
        umbShaft.position.y = 0.40;
        umbShaft.castShadow = true;
        umbrellaGroup.add(umbShaft);

        const runnerCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, 0.024, 14),
          umbDarkRibMat
        );
        runnerCollar.position.y = 0.61;
        umbrellaGroup.add(runnerCollar);

        // 3. 8 Internal folded dark ribs + protruding pale-aqua rib tips poking below canopy hem
        const CANOPY_START_Y = 0.072;
        const CANOPY_END_Y = 0.575;
        const CANOPY_LEN = CANOPY_END_Y - CANOPY_START_Y;

        for (let r = 0; r < 8; r++) {
          const ang = (r / 8) * Math.PI * 2;
          const topR = 0.044;
          const p0 = new THREE.Vector3(Math.cos(ang) * 0.008, CANOPY_START_Y + 0.01, Math.sin(ang) * 0.008);
          const p1 = new THREE.Vector3(Math.cos(ang + 0.25) * topR, CANOPY_END_Y + 0.015, Math.sin(ang + 0.25) * topR);
          const dir = new THREE.Vector3().subVectors(p1, p0);
          const rib = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0018, 0.0018, dir.length(), 6),
            umbDarkRibMat
          );
          rib.position.addVectors(p0, p1).multiplyScalar(0.5);
          rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
          umbrellaGroup.add(rib);

          const ribTip = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.0032, 0.014, 6, 8),
            umbPaleAquaMat
          );
          ribTip.position.copy(p1).add(new THREE.Vector3(0, 0.007, 0));
          ribTip.rotation.z = -Math.cos(ang + 0.25) * 0.14;
          ribTip.rotation.x = Math.sin(ang + 0.25) * 0.14;
          umbrellaGroup.add(ribTip);
        }

        // 4. Sculpted 8-Pleated Translucent Fluted Canopy Cone
        const uSeg = 64;
        const vSeg = 16;
        const uPos: number[] = [];
        const uUv: number[] = [];
        const uIdx: number[] = [];

        for (let vi = 0; vi <= vSeg; vi++) {
          const t = vi / vSeg; // 0 = tip (bottom), 1 = hem (top opening above rim)
          const py = CANOPY_START_Y + t * CANOPY_LEN;
          const baseR = THREE.MathUtils.lerp(0.0095, 0.052, Math.pow(t, 0.86));
          const pleatAmp = Math.sin(t * Math.PI * 0.82) * 0.0095 + (t > 0.7 ? (t - 0.7) * 0.014 : 0);
          const spiralTwist = t * 0.28;
          for (let ui = 0; ui <= uSeg; ui++) {
            const u = ui / uSeg;
            const theta = u * Math.PI * 2 + spiralTwist;
            const rr = baseR + Math.cos(u * Math.PI * 16) * pleatAmp;
            uPos.push(Math.cos(theta) * rr, py, Math.sin(theta) * rr);
            // Map texture v = 1 (top of texture = clear vinyl) at tip (t=0), v = 0 (aqua bottom hem) at t = 1
            uUv.push(u * 2.0, 1.0 - t);
          }
        }
        for (let vi = 0; vi < vSeg; vi++) {
          for (let ui = 0; ui < uSeg; ui++) {
            const a = vi * (uSeg + 1) + ui;
            const b = a + 1;
            const c = a + uSeg + 2;
            const d = a + uSeg + 1;
            uIdx.push(a, b, c, a, c, d);
          }
        }
        const canopyGeo = new THREE.BufferGeometry();
        canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(uPos, 3));
        canopyGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uUv, 2));
        canopyGeo.setIndex(uIdx);
        canopyGeo.computeVertexNormals();
        const canopyMesh = new THREE.Mesh(canopyGeo, umbCanopyVinylMat);
        canopyMesh.castShadow = true;
        umbrellaGroup.add(canopyMesh);

        // Fastening clear/aqua strap wrapping upper fold
        const strapRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.025, 0.0028, 8, 24),
          umbAquaPlasticMat
        );
        strapRing.rotation.x = Math.PI / 2;
        strapRing.position.y = 0.26;
        umbrellaGroup.add(strapRing);

        // 5. Aqua-teal neck collar + Clear Transparent Acrylic J-Hook Handle at Top (透明塑膠彎鉤握把)
        const handleCollar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0095, 0.0085, 0.036, 16),
          umbAquaPlasticMat
        );
        handleCollar.position.y = 0.725;
        umbrellaGroup.add(handleCollar);

        const jCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0.740, 0),
          new THREE.Vector3(0, 0.805, 0),
          new THREE.Vector3(0.014, 0.842, 0),
          new THREE.Vector3(0.042, 0.846, 0),
          new THREE.Vector3(0.064, 0.822, 0),
          new THREE.Vector3(0.062, 0.785, 0),
        ]);
        const jHandleMesh = new THREE.Mesh(
          new THREE.TubeGeometry(jCurve, 28, 0.0096, 14, false),
          umbClearHandleMat
        );
        jHandleMesh.castShadow = true;
        umbrellaGroup.add(jHandleMesh);

        const jEndCap = new THREE.Mesh(new THREE.SphereGeometry(0.0096, 12, 10), umbClearHandleMat);
        jEndCap.position.set(0.062, 0.785, 0);
        umbrellaGroup.add(jEndCap);

        // Ground tip cleanly in stand drip tray & lean handle gracefully toward room center
        umbrellaGroup.position.set(-0.028, 0.028, -0.020);
        umbrellaGroup.rotation.set(0.11, -0.52, -0.15);
        umbrellaCornerGroup.add(umbrellaGroup);

        coloredRoomGroup.add(umbrellaCornerGroup);

        // 4-Column × 3-Row Cube Shelf (四排×高三格、每格40×30公分的長方格子櫃) placed beside the desk
        const CUBE_INNER_W = 0.40;
        const CUBE_INNER_H = 0.30;
        const CUBE_DEPTH = 0.38;
        const OUTER_T = 0.032;
        const INNER_T = 0.018;
        const SHELF_COLS = 4;
        const SHELF_ROWS = 3;
        const SHELF_W = OUTER_T * 2 + SHELF_COLS * CUBE_INNER_W + (SHELF_COLS - 1) * INNER_T; // 1.718m
        const SHELF_H = OUTER_T * 2 + SHELF_ROWS * CUBE_INNER_H + (SHELF_ROWS - 1) * INNER_T; // 1.000m
        const INNER_SPAN_W = SHELF_W - OUTER_T * 2; // 1.654m
        const INNER_SPAN_H = SHELF_H - OUTER_T * 2; // 0.936m

        const cubeShelfGroup = new THREE.Group();
        const deskLeftEdgeX = 2.0 - 0.04 - DESK_W; // 0.76
        const cubeShelfCenterX = deskLeftEdgeX - 0.07 - SHELF_W / 2;
        cubeShelfGroup.position.set(
          cubeShelfCenterX,
          0,
          -PR_SIZE / 2 + 0.04 + CUBE_DEPTH / 2
        );

        const cubeWoodTex = texMgr.getCoolWhiteWoodBaseTex().clone();
        cubeWoodTex.repeat.set(1.6, 1.2);
        cubeWoodTex.needsUpdate = true;
        texMgr.registerTexture(cubeWoodTex);

        const cubeMat = new THREE.MeshStandardMaterial({
          map: cubeWoodTex,
          color: 0xf8fafc,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.58,
        });
        const cubeBackMat = new THREE.MeshStandardMaterial({
          map: cubeWoodTex,
          color: 0xe9eef4,
          roughness: 0.66,
          metalness: 0.01,
          envMapIntensity: 0.44,
        });

        // Outer top & bottom planks
        const topPlank = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W, OUTER_T, CUBE_DEPTH), cubeMat);
        topPlank.position.y = SHELF_H - OUTER_T / 2;
        topPlank.castShadow = true;
        topPlank.receiveShadow = true;
        cubeShelfGroup.add(topPlank);

        const bottomPlank = new THREE.Mesh(new THREE.BoxGeometry(SHELF_W, OUTER_T, CUBE_DEPTH), cubeMat);
        bottomPlank.position.y = OUTER_T / 2;
        bottomPlank.castShadow = true;
        bottomPlank.receiveShadow = true;
        cubeShelfGroup.add(bottomPlank);

        // Outer left & right vertical sides
        [-1, 1].forEach((side) => {
          const sidePlank = new THREE.Mesh(
            new THREE.BoxGeometry(OUTER_T, INNER_SPAN_H, CUBE_DEPTH),
            cubeMat
          );
          sidePlank.position.set(side * (SHELF_W / 2 - OUTER_T / 2), SHELF_H / 2, 0);
          sidePlank.castShadow = true;
          sidePlank.receiveShadow = true;
          cubeShelfGroup.add(sidePlank);
        });

        // 2 Inner horizontal shelves dividing into 3 equal 30cm-tall rows
        for (let r = 1; r < SHELF_ROWS; r++) {
          const hShelf = new THREE.Mesh(
            new THREE.BoxGeometry(INNER_SPAN_W, INNER_T, CUBE_DEPTH - 0.012),
            cubeMat
          );
          const sy = OUTER_T + r * CUBE_INNER_H + (r - 0.5) * INNER_T;
          hShelf.position.set(0, sy, 0.004);
          hShelf.castShadow = true;
          hShelf.receiveShadow = true;
          cubeShelfGroup.add(hShelf);
        }

        // 3 Inner vertical dividers creating 4 equal 40cm-wide columns
        [-1, 0, 1].forEach((colIdx) => {
          const vDiv = new THREE.Mesh(
            new THREE.BoxGeometry(INNER_T, INNER_SPAN_H, CUBE_DEPTH - 0.012),
            cubeMat
          );
          vDiv.position.set(colIdx * (CUBE_INNER_W + INNER_T), SHELF_H / 2, 0.004);
          vDiv.castShadow = true;
          vDiv.receiveShadow = true;
          cubeShelfGroup.add(vDiv);
        });

        // Clean recessed back panel so all 12 40x30cm cubbies read crisply
        const backPanel = new THREE.Mesh(
          new THREE.BoxGeometry(SHELF_W - 0.02, SHELF_H - 0.02, 0.012),
          cubeBackMat
        );
        backPanel.position.set(0, SHELF_H / 2, -CUBE_DEPTH / 2 + 0.006);
        backPanel.receiveShadow = true;
        cubeShelfGroup.add(backPanel);

        // 4 Light Blue-Gray Faux Cat-Scratch-Fabric Storage Baskets (淺藍灰色仿貓抓布纖維收納格/籃子) in the bottom row cubbies
        const basketFabricTex = texMgr.getCatScratchFabricBaseTex().clone();
        basketFabricTex.repeat.set(2.2, 1.8);
        basketFabricTex.needsUpdate = true;
        texMgr.registerTexture(basketFabricTex);

        const basketOuterMat = new THREE.MeshPhysicalMaterial({
          map: basketFabricTex,
          color: 0xffffff,
          roughness: 0.94,
          metalness: 0.0,
          sheen: 0.45,
          sheenRoughness: 0.78,
          sheenColor: new THREE.Color(0xdbe7f2),
          envMapIntensity: 0.34,
        });
        const basketRimMat = new THREE.MeshStandardMaterial({
          map: basketFabricTex,
          color: 0xeef3f7,
          roughness: 0.92,
          metalness: 0.0,
          envMapIntensity: 0.34,
        });
        const basketInnerMat = new THREE.MeshStandardMaterial({
          map: basketFabricTex,
          color: 0x8ea1b2,
          roughness: 0.95,
          metalness: 0.0,
          envMapIntensity: 0.30,
        });
        const basketHandleStrapMat = new THREE.MeshStandardMaterial({
          color: 0xe8e2d8,
          roughness: 0.88,
          metalness: 0.01,
          envMapIntensity: 0.36,
        });
        const basketRivetMat = new THREE.MeshStandardMaterial({
          color: 0xd1d5db,
          roughness: 0.24,
          metalness: 0.86,
          envMapIntensity: 1.30,
        });

        const BIN_W = 0.368;
        const BIN_H = 0.270;
        const BIN_D = 0.344;
        const BIN_WALL = 0.014;
        const RIM_H = 0.022;
        const RIM_THICK = 0.018;

        for (let col = 0; col < SHELF_COLS; col++) {
          const binGroup = new THREE.Group();
          const colCenterX = (-1.5 + col) * (CUBE_INNER_W + INNER_T);
          binGroup.position.set(colCenterX, OUTER_T, 0.012);

          // Bottom floor of basket
          const binBase = new THREE.Mesh(
            new THREE.BoxGeometry(BIN_W, 0.012, BIN_D),
            basketOuterMat
          );
          binBase.position.y = 0.006;
          binBase.castShadow = true;
          binBase.receiveShadow = true;
          binGroup.add(binBase);

          // Front & back woven walls
          const wallH = BIN_H - 0.012;
          const fbWallGeo = new THREE.BoxGeometry(BIN_W, wallH, BIN_WALL);
          [-1, 1].forEach((zSide) => {
            const fbWall = new THREE.Mesh(fbWallGeo, basketOuterMat);
            fbWall.position.set(0, 0.012 + wallH / 2, zSide * (BIN_D / 2 - BIN_WALL / 2));
            fbWall.castShadow = true;
            fbWall.receiveShadow = true;
            binGroup.add(fbWall);
          });

          // Left & right woven walls
          const lrWallGeo = new THREE.BoxGeometry(BIN_WALL, wallH, BIN_D - BIN_WALL * 2);
          [-1, 1].forEach((xSide) => {
            const lrWall = new THREE.Mesh(lrWallGeo, basketOuterMat);
            lrWall.position.set(xSide * (BIN_W / 2 - BIN_WALL / 2), 0.012 + wallH / 2, 0);
            lrWall.castShadow = true;
            lrWall.receiveShadow = true;
            binGroup.add(lrWall);
          });

          // Recessed darker blue inner lining floor so hollow top reads cleanly
          const innerFloor = new THREE.Mesh(
            new THREE.BoxGeometry(BIN_W - BIN_WALL * 2, 0.006, BIN_D - BIN_WALL * 2),
            basketInnerMat
          );
          innerFloor.position.y = 0.015;
          innerFloor.receiveShadow = true;
          binGroup.add(innerFloor);

          // Reinforced stitched fabric top collar/rim around upper perimeter
          const fbRimGeo = new THREE.BoxGeometry(BIN_W + 0.006, RIM_H, RIM_THICK);
          [-1, 1].forEach((zSide) => {
            const fbRim = new THREE.Mesh(fbRimGeo, basketRimMat);
            fbRim.position.set(0, BIN_H - RIM_H / 2, zSide * (BIN_D / 2 - RIM_THICK / 2 + 0.002));
            fbRim.castShadow = true;
            binGroup.add(fbRim);
          });
          const lrRimGeo = new THREE.BoxGeometry(RIM_THICK, RIM_H, BIN_D - RIM_THICK * 2 + 0.006);
          [-1, 1].forEach((xSide) => {
            const lrRim = new THREE.Mesh(lrRimGeo, basketRimMat);
            lrRim.position.set(xSide * (BIN_W / 2 - RIM_THICK / 2 + 0.002), BIN_H - RIM_H / 2, 0);
            lrRim.castShadow = true;
            binGroup.add(lrRim);
          });

          // Front woven linen pull handle strap + twin brushed rivets
          const pullStrap = new THREE.Mesh(
            new THREE.BoxGeometry(0.115, 0.022, 0.014),
            basketHandleStrapMat
          );
          pullStrap.position.set(0, BIN_H * 0.56, BIN_D / 2 + 0.006);
          pullStrap.castShadow = true;
          binGroup.add(pullStrap);

          [-0.044, 0.044].forEach((rx) => {
            const rivet = new THREE.Mesh(
              new THREE.CylinderGeometry(0.0045, 0.0045, 0.004, 12),
              basketRivetMat
            );
            rivet.rotation.x = Math.PI / 2;
            rivet.position.set(rx, BIN_H * 0.56, BIN_D / 2 + 0.014);
            binGroup.add(rivet);
          });

          cubeShelfGroup.add(binGroup);
        }

        // Takane no Nadeshiko Black Woven Pouch on Top-Left of Cube Shelf (格子櫃最上層最左邊的黑色拉鍊小包)
        const takanePouchTex = texMgr.loadTexture('/assets/takane_pouch_front.webp');
        takanePouchTex.colorSpace = THREE.SRGBColorSpace;
        takanePouchTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(takanePouchTex);

        const takanePouchGroup = new THREE.Group();
        const TP_W = 0.245;
        const TP_H = 0.184;
        const TP_D = 0.024;

        const tpBlackNylonMat = new THREE.MeshPhysicalMaterial({
          color: 0x1e2025,
          roughness: 0.82,
          metalness: 0.03,
          sheen: 0.38,
          sheenRoughness: 0.65,
          sheenColor: new THREE.Color(0x4b5563),
          envMapIntensity: 0.48,
        });
        const tpFrontPrintMat = new THREE.MeshPhysicalMaterial({
          map: takanePouchTex,
          color: 0xffffff,
          roughness: 0.80,
          metalness: 0.02,
          sheen: 0.36,
          sheenRoughness: 0.68,
          envMapIntensity: 0.48,
        });
        const tpZipMetalMat = new THREE.MeshStandardMaterial({
          color: 0x3b4250,
          roughness: 0.24,
          metalness: 0.88,
          envMapIntensity: 1.30,
        });

        // Soft cushioned rectangular body
        const tpBodyShape = new THREE.Shape();
        const tpR = 0.008;
        const tpHW = TP_W / 2 - tpR;
        const tpHH = TP_H / 2 - tpR;
        tpBodyShape.moveTo(-tpHW, -TP_H / 2);
        tpBodyShape.lineTo(tpHW, -TP_H / 2);
        tpBodyShape.quadraticCurveTo(TP_W / 2, -TP_H / 2, TP_W / 2, -tpHH);
        tpBodyShape.lineTo(TP_W / 2, tpHH);
        tpBodyShape.quadraticCurveTo(TP_W / 2, TP_H / 2, tpHW, TP_H / 2);
        tpBodyShape.lineTo(-tpHW, TP_H / 2);
        tpBodyShape.quadraticCurveTo(-TP_W / 2, TP_H / 2, -TP_W / 2, tpHH);
        tpBodyShape.lineTo(-TP_W / 2, -tpHH);
        tpBodyShape.quadraticCurveTo(-TP_W / 2, -TP_H / 2, -tpHW, -TP_H / 2);

        const tpBodyGeo = new THREE.ExtrudeGeometry(tpBodyShape, {
          depth: TP_D - 0.008,
          bevelEnabled: true,
          bevelThickness: 0.004,
          bevelSize: 0.004,
          bevelSegments: 3,
          curveSegments: 8,
        });
        const tpBodyMesh = new THREE.Mesh(tpBodyGeo, tpBlackNylonMat);
        tpBodyMesh.position.z = -(TP_D - 0.008) / 2;
        tpBodyMesh.castShadow = true;
        tpBodyMesh.receiveShadow = true;
        takanePouchGroup.add(tpBodyMesh);

        // Front woven print panel ("TAKANE NO NADESHIKO") flush on +Z front face
        const tpFrontPlane = new THREE.Mesh(
          new THREE.PlaneGeometry(TP_W - 0.006, TP_H - 0.006),
          tpFrontPrintMat
        );
        tpFrontPlane.position.z = TP_D / 2 + 0.0008;
        tpFrontPlane.receiveShadow = true;
        takanePouchGroup.add(tpFrontPlane);

        // Upper zipper track, brushed dark metal pull slider & twin top-corner webbing D-rings
        const tpZipTrack = new THREE.Mesh(
          new THREE.BoxGeometry(TP_W - 0.010, 0.006, 0.008),
          tpZipMetalMat
        );
        tpZipTrack.position.set(0, TP_H / 2 + 0.002, 0);
        takanePouchGroup.add(tpZipTrack);

        const tpZipPull = new THREE.Mesh(
          new THREE.BoxGeometry(0.016, 0.007, 0.005),
          tpZipMetalMat
        );
        tpZipPull.position.set(TP_W / 2 - 0.022, TP_H / 2 + 0.004, 0.007);
        tpZipPull.rotation.z = -0.35;
        takanePouchGroup.add(tpZipPull);

        [-1, 1].forEach((side) => {
          const webTab = new THREE.Mesh(
            new THREE.BoxGeometry(0.014, 0.016, 0.008),
            tpBlackNylonMat
          );
          webTab.position.set(side * (TP_W / 2 - 0.012), TP_H / 2 + 0.007, 0);
          takanePouchGroup.add(webTab);

          const cornerDRing = new THREE.Mesh(
            new THREE.TorusGeometry(0.0085, 0.0018, 8, 16),
            tpZipMetalMat
          );
          cornerDRing.position.set(side * (TP_W / 2 - 0.012), TP_H / 2 + 0.015, 0);
          takanePouchGroup.add(cornerDRing);
        });

        // Lean upright slightly back against rear wall and angled sideways on top-right of cube shelf (靠牆側放於格子櫃最上層右側)
        const TP_LEAN_RAD = -0.22;
        const tpLean = new THREE.Group();
        tpLean.rotation.x = TP_LEAN_RAD;
        tpLean.position.y = (TP_H / 2) * Math.cos(Math.abs(TP_LEAN_RAD)) + (TP_D / 2) * Math.sin(Math.abs(TP_LEAN_RAD)) + 0.001;
        tpLean.add(takanePouchGroup);

        const tpRoot = new THREE.Group();
        tpRoot.add(tpLean);
        tpRoot.position.set(SHELF_W / 2 - 0.165, SHELF_H, -CUBE_DEPTH / 2 + 0.044);
        tpRoot.rotation.y = -0.42;
        cubeShelfGroup.add(tpRoot);

        // Makai Ririmu Plushie Doll placed to the Left of the Black Pouch against the Rear Wall (靠牆擺放在黑色小包左方的莉莉姆娃包)
        const pinkRirimuBag = createRirimuBagGroup(false, texMgr).bagGroup;
        pinkRirimuBag.scale.setScalar(1.28);
        pinkRirimuBag.position.set(SHELF_W / 2 - 0.39, SHELF_H, -CUBE_DEPTH / 2 + 0.082);
        pinkRirimuBag.rotation.y = 0.04;
        cubeShelfGroup.add(pinkRirimuBag);

        // 3 Stacked Softly Rounded Folded SHARK T-Shirts in Cubby Column 3, Row 2 (第三直排第二格的疊衣)
        const sharkTeeTex = texMgr.loadTexture('/assets/shark_tee_folded.webp');
        sharkTeeTex.colorSpace = THREE.SRGBColorSpace;
        sharkTeeTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(sharkTeeTex);

        const shirtTopMat = new THREE.MeshPhysicalMaterial({
          map: sharkTeeTex,
          color: 0xffffff,
          roughness: 0.90,
          metalness: 0.0,
          sheen: 0.42,
          sheenRoughness: 0.78,
          sheenColor: new THREE.Color(0xffffff),
          envMapIntensity: 0.35,
        });
        const shirtSideMat = new THREE.MeshStandardMaterial({
          color: 0xf1f3f5,
          roughness: 0.92,
          metalness: 0.0,
          envMapIntensity: 0.34,
        });
        const shirtFoldShadowMat = new THREE.MeshStandardMaterial({
          color: 0xe3e7ed,
          roughness: 0.94,
          metalness: 0.0,
          envMapIntensity: 0.32,
        });

        const buildFoldedShirtSlab = (w: number, h: number, d: number) => {
          const grp = new THREE.Group();
          const geo = new THREE.BoxGeometry(w, h, d, 18, 6, 20);
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const vz = pos.getZ(i);
            const nx = vx / (w / 2);
            const ny = vy / (h / 2);
            const nz = vz / (d / 2);

            // Soft rounded garment perimeter and pillowed cloth crown
            const cornerRound = 1.0 - 0.075 * (nx * nx * nz * nz);
            const edgeBulge = 1.0 + 0.055 * (1.0 - ny * ny);
            const pillowY = (1.0 - 0.18 * nx * nx) * (1.0 - 0.16 * nz * nz);
            const crown = 0.0045 * (1.0 - nx * nx) * (1.0 - nz * nz) * ny;

            pos.setXYZ(
              i,
              vx * cornerRound * edgeBulge,
              vy * pillowY + crown,
              vz * cornerRound * edgeBulge
            );
          }
          geo.computeVertexNormals();

          const slabMesh = new THREE.Mesh(geo, [
            shirtSideMat, // +X
            shirtSideMat, // -X
            shirtTopMat,  // +Y top (face-up collar toward -Z, SHARK toward +Z)
            shirtFoldShadowMat, // -Y bottom
            shirtSideMat, // +Z front
            shirtSideMat, // -Z back
          ]);
          slabMesh.position.y = h / 2;
          slabMesh.castShadow = true;
          slabMesh.receiveShadow = true;
          grp.add(slabMesh);

          // Subtle cotton fold crease belt around waist perimeter
          const creaseBelt = new THREE.Mesh(
            new THREE.BoxGeometry(w * 1.01, 0.004, d * 0.985),
            shirtFoldShadowMat
          );
          creaseBelt.position.y = h * 0.46;
          grp.add(creaseBelt);

          return grp;
        };

        const CUBBY_COL3_X = (-1.5 + 2) * (CUBE_INNER_W + INNER_T); // +0.209m (3rd column from left)
        const CUBBY_ROW2_FLOOR_Y = OUTER_T + CUBE_INNER_H + INNER_T; // 0.350m (middle/2nd row)
        const SHIRT_W = 0.258;
        const SHIRT_H = 0.036;
        const SHIRT_D = 0.304;

        const shirtStackConfigs: Array<{ dx: number; dz: number; rotY: number; scale: number }> = [
          { dx: -0.003, dz: 0.002, rotY: 0.02, scale: 1.02 },
          { dx: 0.004, dz: -0.003, rotY: -0.035, scale: 1.00 },
          { dx: -0.001, dz: 0.003, rotY: 0.025, scale: 0.98 },
        ];
        let stackY = CUBBY_ROW2_FLOOR_Y;
        shirtStackConfigs.forEach((sc) => {
          const shirtSlab = buildFoldedShirtSlab(SHIRT_W * sc.scale, SHIRT_H, SHIRT_D * sc.scale);
          shirtSlab.position.set(CUBBY_COL3_X + sc.dx, stackY, 0.006 + sc.dz);
          shirtSlab.rotation.y = sc.rotY;
          cubeShelfGroup.add(shirtSlab);
          stackY += SHIRT_H * 0.94;
        });

        coloredRoomGroup.add(cubeShelfGroup);

        // 3 Floating Horizontal Wood Shelves (三層橫木片橫架) above the cube shelf at 45cm vertical intervals
        const WALL_SHELF_W = SHELF_W;
        const WALL_SHELF_D = 0.24;
        const WALL_SHELF_T = 0.026;
        const WALL_SHELF_STEP = 0.45;
        const wallShelfBracketMat = new THREE.MeshStandardMaterial({
          color: 0xd6d3cd,
          roughness: 0.38,
          metalness: 0.55,
        });



        for (let tier = 1; tier <= 3; tier++) {
          const shelfY = SHELF_H + tier * WALL_SHELF_STEP;
          const ledgeGroup = new THREE.Group();
          ledgeGroup.position.set(
            cubeShelfCenterX,
            shelfY,
            -PR_SIZE / 2 + WALL_SHELF_D / 2
          );

          const ledgeBoard = new THREE.Mesh(
            new THREE.BoxGeometry(WALL_SHELF_W, WALL_SHELF_T, WALL_SHELF_D),
            cubeMat
          );
          ledgeBoard.castShadow = true;
          ledgeBoard.receiveShadow = true;
          ledgeGroup.add(ledgeBoard);

          // Slim rear wall-mount brackets tucked subtly underneath the plank
          [-WALL_SHELF_W * 0.32, WALL_SHELF_W * 0.32].forEach((bx) => {
            const wallArm = new THREE.Mesh(
              new THREE.BoxGeometry(0.022, 0.068, 0.012),
              wallShelfBracketMat
            );
            wallArm.position.set(bx, -WALL_SHELF_T / 2 - 0.034, -WALL_SHELF_D / 2 + 0.006);
            ledgeGroup.add(wallArm);

            const plankArm = new THREE.Mesh(
              new THREE.BoxGeometry(0.022, 0.012, 0.14),
              wallShelfBracketMat
            );
            plankArm.position.set(bx, -WALL_SHELF_T / 2 - 0.006, -WALL_SHELF_D / 2 + 0.07);
            ledgeGroup.add(plankArm);
          });

          // Signed Suzumi Su Cards on Light-Blue A-Frame Easels along the Right Side of Bottom Horizontal Shelf (最下層橫架右側的四個同尺寸淺藍色畫架與涼海簽名立牌卡)
          if (tier === 1) {
            const LEDGE_TOP_Y = WALL_SHELF_T / 2;
            const easelLightBlueMat = new THREE.MeshStandardMaterial({
              color: 0x93c5fd, // 淺藍色 (soft sky blue)
              roughness: 0.32,
              metalness: 0.12,
              envMapIntensity: 0.90,
            });
            const easelSleeveClearMat = new THREE.MeshPhysicalMaterial({
              color: 0xbfdbfe,
              roughness: 0.04,
              metalness: 0.02,
              clearcoat: 1.0,
              clearcoatRoughness: 0.04,
              reflectivity: 0.96,
              envMapIntensity: 1.55,
              transparent: true,
              opacity: 0.48,
              depthWrite: false,
            });
            const cardBackMat = new THREE.MeshStandardMaterial({
              color: 0xf7e1ea,
              roughness: 0.68,
              metalness: 0.01,
              envMapIntensity: 0.45,
            });

            const CARD_W = 0.086;
            const CARD_H = 0.118;
            const SLEEVE_W = CARD_W + 0.008;
            const SLEEVE_H = CARD_H + 0.007;
            const EASEL_TILT = -0.25;
            const EASEL_H = 0.172;

            const apexTopWorld = new THREE.Vector3(
              0,
              Math.cos(Math.abs(EASEL_TILT)) * (EASEL_H - 0.005),
              0.024 - Math.sin(Math.abs(EASEL_TILT)) * (EASEL_H - 0.005)
            );
            const rearFootWorld = new THREE.Vector3(0, 0.003, -0.044);
            const kickVec = new THREE.Vector3().subVectors(apexTopWorld, rearFootWorld);
            const kickQuat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              kickVec.clone().normalize()
            );

            const createShelfEaselCard = (texPath: string, posX: number, rotY: number) => {
              const cardTex = texMgr.loadTexture(texPath);
              cardTex.colorSpace = THREE.SRGBColorSpace;
              cardTex.anisotropy = texMgr.maxAnisotropy;
              texMgr.registerTexture(cardTex);

              const easelGroup = new THREE.Group();
              easelGroup.position.set(posX, LEDGE_TOP_Y, 0.025);
              easelGroup.rotation.y = rotY;
              easelGroup.scale.setScalar(1.22); // 稍微放大卡片立架的尺寸

              const easelFrontFrame = new THREE.Group();
              easelFrontFrame.rotation.x = EASEL_TILT;
              easelFrontFrame.position.set(0, 0, 0.024);

              [-1, 1].forEach((side) => {
                const leg = new THREE.Mesh(
                  new THREE.BoxGeometry(0.008, EASEL_H, 0.007),
                  easelLightBlueMat
                );
                leg.position.set(side * 0.022, EASEL_H / 2, 0);
                leg.rotation.z = side * 0.18;
                leg.castShadow = true;
                leg.receiveShadow = true;
                easelFrontFrame.add(leg);
              });

              const apexBlock = new THREE.Mesh(
                new THREE.BoxGeometry(0.024, 0.014, 0.010),
                easelLightBlueMat
              );
              apexBlock.position.set(0, EASEL_H - 0.005, 0);
              apexBlock.castShadow = true;
              easelFrontFrame.add(apexBlock);

              const midBrace = new THREE.Mesh(
                new THREE.BoxGeometry(0.056, 0.008, 0.007),
                easelLightBlueMat
              );
              midBrace.position.set(0, 0.072, 0);
              easelFrontFrame.add(midBrace);

              const trayLedge = new THREE.Mesh(
                new THREE.BoxGeometry(0.104, 0.007, 0.018),
                easelLightBlueMat
              );
              trayLedge.position.set(0, 0.028, 0.008);
              trayLedge.castShadow = true;
              trayLedge.receiveShadow = true;
              easelFrontFrame.add(trayLedge);

              const trayFrontLip = new THREE.Mesh(
                new THREE.BoxGeometry(0.104, 0.007, 0.003),
                easelLightBlueMat
              );
              trayFrontLip.position.set(0, 0.032, 0.016);
              easelFrontFrame.add(trayFrontLip);

              const cardHolderGroup = new THREE.Group();
              cardHolderGroup.position.set(0, 0.032 + SLEEVE_H / 2, 0.0072);

              const sleeveSlab = new THREE.Mesh(
                new THREE.BoxGeometry(SLEEVE_W, SLEEVE_H, 0.0034),
                easelSleeveClearMat
              );
              sleeveSlab.renderOrder = 2;
              cardHolderGroup.add(sleeveSlab);

              const cardFrontMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(CARD_W, CARD_H),
                new THREE.MeshPhysicalMaterial({
                  map: cardTex,
                  roughness: 0.16,
                  metalness: 0.01,
                  clearcoat: 0.80,
                  clearcoatRoughness: 0.08,
                  envMapIntensity: 1.15,
                })
              );
              cardFrontMesh.position.z = 0.0011;
              cardFrontMesh.castShadow = true;
              cardHolderGroup.add(cardFrontMesh);

              const cardBackMesh = new THREE.Mesh(
                new THREE.PlaneGeometry(CARD_W, CARD_H),
                cardBackMat
              );
              cardBackMesh.rotation.y = Math.PI;
              cardBackMesh.position.z = -0.0011;
              cardHolderGroup.add(cardBackMesh);

              easelFrontFrame.add(cardHolderGroup);
              easelGroup.add(easelFrontFrame);

              const rearKickLeg = new THREE.Mesh(
                new THREE.BoxGeometry(0.008, kickVec.length(), 0.007),
                easelLightBlueMat
              );
              rearKickLeg.position.addVectors(apexTopWorld, rearFootWorld).multiplyScalar(0.5);
              rearKickLeg.quaternion.copy(kickQuat);
              rearKickLeg.castShadow = true;
              easelGroup.add(rearKickLeg);

              ledgeGroup.add(easelGroup);
            };

            const shelfEaselCards: Array<[string, number, number]> = [
              ['/assets/capsule_su_card.webp', WALL_SHELF_W / 2 - 0.105, -0.14],
              ['/assets/su_card_extra_1.webp', WALL_SHELF_W / 2 - 0.250, -0.10],
              ['/assets/su_card_extra_2.webp', WALL_SHELF_W / 2 - 0.395, -0.06],
              ['/assets/su_card_extra_3.webp', WALL_SHELF_W / 2 - 0.540, -0.02],
            ];
            shelfEaselCards.forEach(([path, px, ry]) => createShelfEaselCard(path, px, ry));

            // Suzumi Jewel-Case CD on Far-Left of Bottom Horizontal Shelf angled slightly toward Room Door (-X)
            const shelfSuzumiCdGroup = createCdDisplayGroup('/assets/cd_su_idol_front.webp', 1.38);
            shelfSuzumiCdGroup.position.set(-WALL_SHELF_W / 2 + 0.125, LEDGE_TOP_Y, 0.018);
            shelfSuzumiCdGroup.rotation.y = -0.24;
            ledgeGroup.add(shelfSuzumiCdGroup);
          }

          coloredRoomGroup.add(ledgeGroup);
        }

        // Balanced cozy fill light illuminating the cube shelf & floating shelves
        const shelfDisplayFillLight = new THREE.PointLight(0xfff2e4, 0.32, 4.5, 1.18);
        shelfDisplayFillLight.position.set(cubeShelfCenterX + 0.15, 1.85, -2.25);
        coloredRoomGroup.add(shelfDisplayFillLight);

        // Light-Blue Suzumi Su Hanging Scroll Tapestry near Display Shelf & Door (展示架旁靠近房門處的「高嶺のなでしこ 涼海すう」立體掛軸)
        const pinkScrollTexture = texMgr.loadTexture('/assets/pink_scroll_tex.webp');
        pinkScrollTexture.colorSpace = THREE.SRGBColorSpace;
        pinkScrollTexture.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(pinkScrollTexture);

        const pinkScrollGroup = new THREE.Group();
        const P_SCROLL_W = 0.45;
        const P_SCROLL_H = 1.30; // Exact 500 : 1440 ratio matching pink_scroll_tex.png

        const pScrollClothGeo = new THREE.PlaneGeometry(P_SCROLL_W, P_SCROLL_H, 12, 24);
        const psPos = pScrollClothGeo.attributes.position;
        for (let i = 0; i < psPos.count; i++) {
          const sx = psPos.getX(i);
          const sy = psPos.getY(i);
          const ny = (sy + P_SCROLL_H / 2) / P_SCROLL_H;
          const nx = sx / (P_SCROLL_W / 2);
          const drapeZ =
            Math.sin(ny * Math.PI) * 0.0045 +
            Math.cos(nx * Math.PI) * 0.0025 * Math.sin(ny * Math.PI);
          psPos.setY(i, sy - P_SCROLL_H / 2);
          psPos.setZ(i, 0.010 + drapeZ);
        }
        pScrollClothGeo.computeVertexNormals();

        const pScrollFrontMesh = new THREE.Mesh(
          pScrollClothGeo,
          new THREE.MeshStandardMaterial({
            map: pinkScrollTexture,
            color: 0xffffff,
            roughness: 0.78,
            metalness: 0.02,
          })
        );
        pScrollFrontMesh.castShadow = true;
        pScrollFrontMesh.receiveShadow = true;
        pinkScrollGroup.add(pScrollFrontMesh);

        const pScrollBackMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(P_SCROLL_W, P_SCROLL_H),
          new THREE.MeshStandardMaterial({
            color: 0x3b6c94,
            roughness: 0.9,
            side: THREE.FrontSide,
          })
        );
        pScrollBackMesh.position.set(0, -P_SCROLL_H / 2, 0.0085);
        pScrollBackMesh.rotation.y = Math.PI;
        pinkScrollGroup.add(pScrollBackMesh);

        const pScrollRodMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.36,
          metalness: 0.12,
        });
        const pScrollRodGeo = new THREE.CylinderGeometry(0.0085, 0.0085, P_SCROLL_W + 0.024, 16);
        pScrollRodGeo.rotateZ(Math.PI / 2);

        const pTopRod = new THREE.Mesh(pScrollRodGeo, pScrollRodMat);
        pTopRod.position.set(0, 0.004, 0.011);
        pTopRod.castShadow = true;
        pinkScrollGroup.add(pTopRod);

        const pBotRod = new THREE.Mesh(pScrollRodGeo, pScrollRodMat);
        pBotRod.position.set(0, -P_SCROLL_H - 0.004, 0.011);
        pBotRod.castShadow = true;
        pinkScrollGroup.add(pBotRod);

        const pCordCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-P_SCROLL_W / 2 + 0.016, 0.008, 0.011),
          new THREE.Vector3(-P_SCROLL_W / 4 + 0.008, 0.078, 0.007),
          new THREE.Vector3(0, 0.146, 0.004),
          new THREE.Vector3(P_SCROLL_W / 4 - 0.008, 0.078, 0.007),
          new THREE.Vector3(P_SCROLL_W / 2 - 0.016, 0.008, 0.011),
        ]);
        const pCordMesh = new THREE.Mesh(
          new THREE.TubeGeometry(pCordCurve, 24, 0.0024, 8, false),
          new THREE.MeshStandardMaterial({
            color: 0xf4f6f8,
            roughness: 0.72,
            metalness: 0.02,
          })
        );
        pCordMesh.castShadow = true;
        pinkScrollGroup.add(pCordMesh);

        const pScrollPin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0032, 0.0032, 0.016, 10),
          new THREE.MeshStandardMaterial({ color: 0xbac0c8, roughness: 0.3, metalness: 0.8 })
        );
        pScrollPin.rotation.x = Math.PI / 2;
        pScrollPin.position.set(0, 0.148, 0.005);
        pinkScrollGroup.add(pScrollPin);

        // Mounted on Front Wall directly above the Shoe Rack (鞋架上方牆面上的涼海藍色掛軸)
        pinkScrollGroup.position.set(-2.66, 2.08, -PR_SIZE / 2 + 0.008);
        pinkScrollGroup.rotation.y = 0;
        coloredRoomGroup.add(pinkScrollGroup);

        const pinkScrollSpot = new THREE.PointLight(0xfff1e2, 0.32, 3.2, 1.18);
        pinkScrollSpot.position.set(-2.66, 2.05, -2.80);
        coloredRoomGroup.add(pinkScrollSpot);

        // Light Blue-Gray Curtain on the Right Wall beside the Desk (書桌側面牆面、離天花板下30cm至桌面高74cm、寬160cm的淺藍灰色窗簾)
        const CURTAIN_W = 1.60;
        const CURTAIN_TOP_Y = PR_HEIGHT - 0.30; // 2.70m (30cm below ceiling)
        const CURTAIN_BOT_Y = DESK_H;           // 0.74m (desk top height)
        const CURTAIN_H = CURTAIN_TOP_Y - CURTAIN_BOT_Y; // 1.96m hanging drop
        const curtainGroup = new THREE.Group();
        curtainGroup.position.set(2.0 - 0.044, CURTAIN_BOT_Y + CURTAIN_H / 2, -PR_SIZE / 2 + 0.08 + CURTAIN_W / 2);

        const curtainFabTex = texMgr.getCurtainFabricBaseTex().clone();
        curtainFabTex.repeat.set(4.2, 2.4);
        curtainFabTex.needsUpdate = true;
        texMgr.registerTexture(curtainFabTex);

        const curtainGeo = new THREE.PlaneGeometry(CURTAIN_W, CURTAIN_H, 72, 10);
        const cPos = curtainGeo.attributes.position;
        for (let i = 0; i < cPos.count; i++) {
          const px = cPos.getX(i); // along curtain width [-0.80, +0.80]
          const py = cPos.getY(i); // along height [-0.98, +0.98]
          const u = Math.max(0, Math.min(1, (px + CURTAIN_W / 2) / CURTAIN_W));
          const vFromTop = Math.max(0, Math.min(1, (CURTAIN_H / 2 - py) / CURTAIN_H)); // 0 at top rod, 1 at bottom hem
          const foldAmp = 0.011 + 0.015 * Math.pow(vFromTop, 0.7);
          const pleatZ = Math.sin(u * Math.PI * 17.0) * foldAmp + Math.sin(u * Math.PI * 6.0) * 0.005;
          cPos.setZ(i, pleatZ);
        }
        cPos.needsUpdate = true;
        curtainGeo.computeVertexNormals();
        curtainGeo.computeBoundingBox();
        curtainGeo.computeBoundingSphere();

        const curtainMat = new THREE.MeshPhysicalMaterial({
          map: curtainFabTex,
          color: 0xffffff,
          roughness: 0.93,
          metalness: 0.0,
          sheen: 0.45,
          sheenRoughness: 0.78,
          sheenColor: new THREE.Color(0xeaf2f8),
          envMapIntensity: 0.32,
          side: THREE.DoubleSide,
        });
        const curtainPanel = new THREE.Mesh(curtainGeo, curtainMat);
        curtainPanel.rotation.y = -Math.PI / 2;
        curtainPanel.castShadow = true;
        curtainPanel.receiveShadow = true;
        curtainGroup.add(curtainPanel);

        // Clean Curtain Track/Rod + Wall Brackets & Finials at Y = 2.70m
        const curtainRodMat = new THREE.MeshStandardMaterial({
          color: 0xe2e6ec,
          roughness: 0.24,
          metalness: 0.84,
          envMapIntensity: 1.25,
        });
        const curtainRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.011, 0.011, CURTAIN_W + 0.12, 16),
          curtainRodMat
        );
        curtainRod.rotation.x = Math.PI / 2;
        curtainRod.position.set(0, CURTAIN_H / 2 + 0.012, 0);
        curtainRod.castShadow = true;
        curtainGroup.add(curtainRod);

        [-CURTAIN_W / 2 - 0.06, CURTAIN_W / 2 + 0.06].forEach((fz) => {
          const finial = new THREE.Mesh(
            new THREE.SphereGeometry(0.018, 12, 10),
            curtainRodMat
          );
          finial.position.set(0, CURTAIN_H / 2 + 0.012, fz);
          curtainGroup.add(finial);
        });

        [-CURTAIN_W * 0.40, CURTAIN_W * 0.40].forEach((bz) => {
          const bracket = new THREE.Mesh(
            new THREE.BoxGeometry(0.044, 0.014, 0.018),
            curtainRodMat
          );
          bracket.position.set(0.022, CURTAIN_H / 2 + 0.012, bz);
          curtainGroup.add(bracket);
        });

        coloredRoomGroup.add(curtainGroup);

        // White Gaming Chair (Rounded & Plush) with 6 Caster Wheels + Light-Blue Neck & Lumbar Pillows beside the Desk
        const gamingChairGroup = new THREE.Group();
        gamingChairGroup.position.set(1.32, 0, -2.28);
        gamingChairGroup.rotation.y = -2.28; // Angled beside/toward the desk while showcasing seat & pillows to the room

        const chairLeatherWhiteMat = new THREE.MeshStandardMaterial({
          color: 0xf9fafb,
          roughness: 0.48,
          metalness: 0.02,
          envMapIntensity: 0.60,
        });
        const chairBolsterWhiteMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.58,
        });
        const chairTrimGrayMat = new THREE.MeshStandardMaterial({
          color: 0xdbe2ea,
          roughness: 0.54,
          metalness: 0.05,
          envMapIntensity: 0.58,
        });
        const chairChromeMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.18,
          metalness: 0.90,
          envMapIntensity: 1.40,
        });
        const chairMechanismMat = new THREE.MeshStandardMaterial({
          color: 0x374151,
          roughness: 0.46,
          metalness: 0.52,
          envMapIntensity: 0.85,
        });
        const chairWheelTireMat = new THREE.MeshStandardMaterial({
          color: 0x26292e,
          roughness: 0.78,
          metalness: 0.06,
          envMapIntensity: 0.42,
        });
        const chairPillowBlueMat = new THREE.MeshPhysicalMaterial({
          color: 0x9ecae8,
          roughness: 0.88,
          metalness: 0.0,
          sheen: 0.72,
          sheenRoughness: 0.72,
          sheenColor: new THREE.Color(0xdcf0fc),
          envMapIntensity: 0.38,
        });
        const chairStrapMat = new THREE.MeshStandardMaterial({
          color: 0xcbd5e1,
          roughness: 0.80,
          envMapIntensity: 0.40,
        });

        // Helper to trace a rounded rectangle Shape
        const makeRoundedShape = (w: number, h: number, r: number) => {
          const shape = new THREE.Shape();
          const hw = w / 2;
          const hh = h / 2;
          const rad = Math.min(r, hw * 0.95, hh * 0.95);
          shape.moveTo(-hw + rad, -hh);
          shape.lineTo(hw - rad, -hh);
          shape.quadraticCurveTo(hw, -hh, hw, -hh + rad);
          shape.lineTo(hw, hh - rad);
          shape.quadraticCurveTo(hw, hh, hw - rad, hh);
          shape.lineTo(-hw + rad, hh);
          shape.quadraticCurveTo(-hw, hh, -hw, hh - rad);
          shape.lineTo(-hw, -hh + rad);
          shape.quadraticCurveTo(-hw, -hh, -hw + rad, -hh);
          return shape;
        };

        // 1. Smooth Six-Spoke Star Wheelbase + 6 Rounded Swivel Caster Wheels (圓潤六爪星形底座＋六個滾輪)
        const baseHub = new THREE.Mesh(
          new THREE.CylinderGeometry(0.052, 0.062, 0.052, 24),
          chairLeatherWhiteMat
        );
        baseHub.position.y = 0.130;
        baseHub.castShadow = true;
        gamingChairGroup.add(baseHub);

        const baseHubDome = new THREE.Mesh(
          new THREE.SphereGeometry(0.052, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
          chairLeatherWhiteMat
        );
        baseHubDome.scale.set(1, 0.45, 1);
        baseHubDome.position.y = 0.156;
        gamingChairGroup.add(baseHubDome);

        const WHEEL_RADIUS = 0.028;
        const LEG_RADIUS = 0.30;
        for (let i = 0; i < 6; i++) {
          const theta = (i * Math.PI * 2) / 6;
          const spokePivot = new THREE.Group();
          spokePivot.rotation.y = theta;

          // Smooth rounded capsule star leg sweeping down from center hub to wheel socket
          const legMesh = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.017, LEG_RADIUS - 0.06, 8, 16),
            chairLeatherWhiteMat
          );
          legMesh.position.set(0, 0.102, LEG_RADIUS * 0.50);
          legMesh.rotation.x = Math.PI / 2 + 0.19;
          legMesh.scale.set(1.15, 1.0, 0.85);
          legMesh.castShadow = true;
          legMesh.receiveShadow = true;
          spokePivot.add(legMesh);

          // Caster socket stem
          const stem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.011, 0.013, 0.040, 14),
            chairChromeMat
          );
          stem.position.set(0, 0.058, LEG_RADIUS - 0.008);
          spokePivot.add(stem);

          // Rounded hooded caster dome + twin rolling discs resting flush on Y = 0
          const casterHood = new THREE.Mesh(
            new THREE.SphereGeometry(0.026, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58),
            chairLeatherWhiteMat
          );
          casterHood.scale.set(0.88, 0.85, 1.12);
          casterHood.position.set(0, WHEEL_RADIUS + 0.008, LEG_RADIUS - 0.008);
          spokePivot.add(casterHood);

          [-0.012, 0.012].forEach((wx) => {
            const wheelDisc = new THREE.Mesh(
              new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.012, 20),
              chairWheelTireMat
            );
            wheelDisc.rotation.z = Math.PI / 2;
            wheelDisc.position.set(wx, WHEEL_RADIUS, LEG_RADIUS - 0.008);
            wheelDisc.castShadow = true;
            spokePivot.add(wheelDisc);

            const hubCap = new THREE.Mesh(
              new THREE.SphereGeometry(0.014, 14, 10),
              chairTrimGrayMat
            );
            hubCap.scale.set(0.45, 1, 1);
            hubCap.position.set(wx + (wx > 0 ? 0.004 : -0.004), WHEEL_RADIUS, LEG_RADIUS - 0.008);
            spokePivot.add(hubCap);
          });

          gamingChairGroup.add(spokePivot);
        }

        // Pneumatic gas-lift cylinder + telescopic shroud + rounded under-seat housing
        const gasRod = new THREE.Mesh(
          new THREE.CylinderGeometry(0.024, 0.026, 0.22, 18),
          chairChromeMat
        );
        gasRod.position.y = 0.25;
        gasRod.castShadow = true;
        gamingChairGroup.add(gasRod);

        const gasSleeve = new THREE.Mesh(
          new THREE.CylinderGeometry(0.034, 0.040, 0.12, 18),
          chairBolsterWhiteMat
        );
        gasSleeve.position.y = 0.205;
        gamingChairGroup.add(gasSleeve);

        const mechPlate = new THREE.Mesh(
          new THREE.CylinderGeometry(0.115, 0.105, 0.040, 20),
          chairMechanismMat
        );
        mechPlate.scale.set(1.0, 1.0, 1.12);
        mechPlate.position.set(0, 0.374, -0.01);
        mechPlate.castShadow = true;
        gamingChairGroup.add(mechPlate);

        // 2. Plush Rounded White Seat Cushion + Soft Capsule Side Bolsters
        const seatShape = makeRoundedShape(0.35, 0.44, 0.11);
        const seatGeo = new THREE.ExtrudeGeometry(seatShape, {
          depth: 0.044,
          bevelEnabled: true,
          bevelThickness: 0.032,
          bevelSize: 0.036,
          bevelSegments: 6,
          curveSegments: 20,
        });
        const seatCushion = new THREE.Mesh(seatGeo, chairLeatherWhiteMat);
        seatCushion.rotation.x = Math.PI / 2;
        seatCushion.position.set(0, 0.458, 0.02);
        seatCushion.castShadow = true;
        seatCushion.receiveShadow = true;
        gamingChairGroup.add(seatCushion);

        // Light-Blue Center Color Block extending from backrest crease onto rear half of seat cushion (椅面一半處)
        const seatPatchShape = makeRoundedShape(0.21, 0.235, 0.014);
        const seatPatchGeo = new THREE.ExtrudeGeometry(seatPatchShape, {
          depth: 0.005,
          bevelEnabled: true,
          bevelThickness: 0.002,
          bevelSize: 0.003,
          bevelSegments: 3,
          curveSegments: 12,
        });
        const seatPatchMesh = new THREE.Mesh(seatPatchGeo, chairPillowBlueMat);
        seatPatchMesh.rotation.x = Math.PI / 2;
        seatPatchMesh.position.set(0, 0.493, -0.0925);
        seatPatchMesh.receiveShadow = true;
        gamingChairGroup.add(seatPatchMesh);

        [-1, 1].forEach((side) => {
          // Plush rounded capsule bolsters framing left & right edges of seat
          const seatBolster = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.052, 0.34, 10, 18),
            chairBolsterWhiteMat
          );
          seatBolster.rotation.x = Math.PI / 2;
          seatBolster.rotation.y = side * 0.05;
          seatBolster.scale.set(1.05, 1.0, 0.92);
          seatBolster.position.set(side * 0.212, 0.455, 0.018);
          seatBolster.castShadow = true;
          seatBolster.receiveShadow = true;
          gamingChairGroup.add(seatBolster);

          // 3. Smooth Cylindrical Support + Rounded Pill-Shaped Armrests
          const armStem = new THREE.Mesh(
            new THREE.CylinderGeometry(0.015, 0.018, 0.20, 16),
            chairChromeMat
          );
          armStem.position.set(side * 0.268, 0.51, -0.01);
          armStem.castShadow = true;
          gamingChairGroup.add(armStem);

          const armPad = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.025, 0.195, 10, 18),
            chairBolsterWhiteMat
          );
          armPad.rotation.x = Math.PI / 2;
          armPad.scale.set(1.42, 1.0, 0.62);
          armPad.position.set(side * 0.270, 0.616, 0.025);
          armPad.castShadow = true;
          armPad.receiveShadow = true;
          gamingChairGroup.add(armPad);
        });

        // Curved cylindrical spine bracket connecting seat to reclined backrest
        const spineBracket = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.026, 0.14, 8, 14),
          chairMechanismMat
        );
        spineBracket.position.set(0, 0.455, -0.232);
        spineBracket.rotation.x = -0.18;
        gamingChairGroup.add(spineBracket);

        // 4. Sculpted Smoothly Curved White Backrest Silhouette + Soft Wing Bolsters + Plump Light-Blue Pillows
        const backrestPivot = new THREE.Group();
        backrestPivot.position.set(0, 0.475, -0.218);
        backrestPivot.rotation.x = -0.11; // ~6.3 deg natural recline

        // Continuous curvy racing-chair backrest outline with smooth Bézier shoulders & domed headrest
        const backShape = new THREE.Shape();
        backShape.moveTo(-0.16, 0.02);
        backShape.quadraticCurveTo(-0.21, 0.18, -0.205, 0.38);
        backShape.bezierCurveTo(-0.205, 0.52, -0.215, 0.60, -0.165, 0.67);
        backShape.quadraticCurveTo(-0.145, 0.79, 0.0, 0.805);
        backShape.quadraticCurveTo(0.145, 0.79, 0.165, 0.67);
        backShape.bezierCurveTo(0.215, 0.60, 0.205, 0.52, 0.205, 0.38);
        backShape.quadraticCurveTo(0.21, 0.18, 0.16, 0.02);
        backShape.quadraticCurveTo(0.0, -0.015, -0.16, 0.02);

        const backGeo = new THREE.ExtrudeGeometry(backShape, {
          depth: 0.044,
          bevelEnabled: true,
          bevelThickness: 0.032,
          bevelSize: 0.028,
          bevelSegments: 6,
          curveSegments: 24,
        });
        const backSculptMesh = new THREE.Mesh(backGeo, chairLeatherWhiteMat);
        backSculptMesh.position.set(0, 0.02, -0.022);
        backSculptMesh.castShadow = true;
        backSculptMesh.receiveShadow = true;
        backrestPivot.add(backSculptMesh);

        // Rounded pill-shaped harness accent slots on upper chest area
        [-0.072, 0.072].forEach((hx) => {
          const harnessSlot = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.015, 0.032, 8, 12),
            chairTrimGrayMat
          );
          harnessSlot.rotation.z = Math.PI / 2;
          harnessSlot.scale.set(1.0, 1.0, 2.2);
          harnessSlot.position.set(hx, 0.615, 0.002);
          backrestPivot.add(harnessSlot);
        });

        // Soft capsule backrest wing bolsters curving smoothly up waist & shoulders
        [-1, 1].forEach((side) => {
          const lowerWing = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.046, 0.36, 10, 18),
            chairBolsterWhiteMat
          );
          lowerWing.position.set(side * 0.202, 0.25, 0.022);
          lowerWing.rotation.z = side * 0.04;
          lowerWing.rotation.y = -side * 0.24;
          lowerWing.scale.set(0.95, 1.0, 1.15);
          lowerWing.castShadow = true;
          backrestPivot.add(lowerWing);

          const shoulderWing = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.045, 0.16, 10, 18),
            chairBolsterWhiteMat
          );
          shoulderWing.position.set(side * 0.195, 0.56, 0.020);
          shoulderWing.rotation.z = side * 0.22;
          shoulderWing.rotation.y = -side * 0.20;
          shoulderWing.scale.set(1.05, 1.0, 1.10);
          shoulderWing.castShadow = true;
          backrestPivot.add(shoulderWing);
        });

        // Light-Blue Rectangular Center Color Block extending from below neck down to the seat (頸部往下一點延伸至座墊的淺藍色色塊)
        const centerPatchShape = makeRoundedShape(0.21, 0.59, 0.014);
        const centerPatchGeo = new THREE.ExtrudeGeometry(centerPatchShape, {
          depth: 0.005,
          bevelEnabled: true,
          bevelThickness: 0.002,
          bevelSize: 0.003,
          bevelSegments: 3,
          curveSegments: 12,
        });
        const centerPatchMesh = new THREE.Mesh(centerPatchGeo, chairPillowBlueMat);
        centerPatchMesh.position.set(0, 0.310, 0.051);
        centerPatchMesh.receiveShadow = true;
        backrestPivot.add(centerPatchMesh);

        // White trim material for the bold straight vertical edge stripes on both pillows
        const pillowWhiteEdgeMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.62,
          metalness: 0.02,
        });

        // Rectangular Light-Blue Lumbar Pillow with White Sides & Wider Straight White Vertical Stripes (側面全白＋加粗白直條紋長方形靠枕)
        const lumbarGroup = new THREE.Group();
        lumbarGroup.position.set(0, 0.165, 0.090);

        const lumbarShape = makeRoundedShape(0.275, 0.145, 0.022);
        const lumbarGeo = new THREE.ExtrudeGeometry(lumbarShape, {
          depth: 0.028,
          bevelEnabled: true,
          bevelThickness: 0.020,
          bevelSize: 0.016,
          bevelSegments: 5,
          curveSegments: 16,
        });
        const lumbarMain = new THREE.Mesh(lumbarGeo, chairPillowBlueMat);
        lumbarMain.position.set(0, 0, -0.014);
        lumbarMain.castShadow = true;
        lumbarMain.receiveShadow = true;
        lumbarGroup.add(lumbarMain);

        // Wrap-around white side caps + wider straight vertical stripes along left & right edges
        const lumbarStripeGeo = new THREE.ExtrudeGeometry(makeRoundedShape(0.026, 0.146, 0.010), {
          depth: 0.031,
          bevelEnabled: true,
          bevelThickness: 0.0205,
          bevelSize: 0.0165,
          bevelSegments: 5,
          curveSegments: 12,
        });
        [-0.1255, 0.1255].forEach((ex) => {
          const whiteSideStripe = new THREE.Mesh(lumbarStripeGeo, pillowWhiteEdgeMat);
          whiteSideStripe.position.set(ex, 0, -0.0155);
          whiteSideStripe.castShadow = true;
          lumbarGroup.add(whiteSideStripe);
        });

        [-0.105, 0.105].forEach((sx) => {
          const lStrap = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.009, 0.09, 6, 10),
            chairStrapMat
          );
          lStrap.rotation.x = Math.PI / 2;
          lStrap.position.set(sx, 0, -0.068);
          lumbarGroup.add(lStrap);
        });
        backrestPivot.add(lumbarGroup);

        // Rectangular Light-Blue Neck Pillow with White Sides & Wider Straight White Vertical Stripes (稍微往下移一丁點的頸枕)
        const neckGroup = new THREE.Group();
        neckGroup.position.set(0, 0.658, 0.082);

        const neckShape = makeRoundedShape(0.215, 0.102, 0.018);
        const neckGeo = new THREE.ExtrudeGeometry(neckShape, {
          depth: 0.022,
          bevelEnabled: true,
          bevelThickness: 0.016,
          bevelSize: 0.012,
          bevelSegments: 5,
          curveSegments: 16,
        });
        const neckMain = new THREE.Mesh(neckGeo, chairPillowBlueMat);
        neckMain.position.set(0, 0, -0.011);
        neckMain.castShadow = true;
        neckMain.receiveShadow = true;
        neckGroup.add(neckMain);

        // Wrap-around white side caps + wider straight vertical stripes along left & right edges
        const neckStripeGeo = new THREE.ExtrudeGeometry(makeRoundedShape(0.022, 0.103, 0.008), {
          depth: 0.024,
          bevelEnabled: true,
          bevelThickness: 0.0165,
          bevelSize: 0.0125,
          bevelSegments: 5,
          curveSegments: 12,
        });
        [-0.0975, 0.0975].forEach((ex) => {
          const neckWhiteStripe = new THREE.Mesh(neckStripeGeo, pillowWhiteEdgeMat);
          neckWhiteStripe.position.set(ex, 0, -0.012);
          neckWhiteStripe.castShadow = true;
          neckGroup.add(neckWhiteStripe);
        });

        const neckStrap = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.012, 0.09, 6, 10),
          chairStrapMat
        );
        neckStrap.rotation.x = Math.PI / 2;
        neckStrap.position.set(0, 0.005, -0.064);
        neckGroup.add(neckStrap);

        backrestPivot.add(neckGroup);

        // Fluffy Petal-Shaped Faux-Fur Rabbit Ears Headband on Chair Backrest (參照實物形狀與毛茸茸質感之白色外耳＋淺藍色內耳髮箍兔耳)
        const createPlushFurTextures = () => {
          const cCol = document.createElement('canvas');
          cCol.width = 256;
          cCol.height = 256;
          const ctxCol = cCol.getContext('2d');

          const cBump = document.createElement('canvas');
          cBump.width = 256;
          cBump.height = 256;
          const ctxBump = cBump.getContext('2d');

          if (ctxCol && ctxBump) {
            ctxCol.fillStyle = '#f8f9fc';
            ctxCol.fillRect(0, 0, 256, 256);
            ctxBump.fillStyle = '#808080';
            ctxBump.fillRect(0, 0, 256, 256);

            // Multi-directional fine silky plush faux-fur fibers
            for (let i = 0; i < 2400; i++) {
              const x = (i * 73) % 256;
              const y = (i * 139) % 256;
              const ang = ((i * 29) % 360) * (Math.PI / 180) * 0.25 - 0.4;
              const len = 7 + (i % 7);
              const bright = i % 2 === 0;

              ctxCol.strokeStyle = bright ? 'rgba(255,255,255,0.55)' : 'rgba(218,226,238,0.42)';
              ctxCol.lineWidth = 1.4;
              ctxCol.beginPath();
              ctxCol.moveTo(x, y);
              ctxCol.lineTo(x + Math.sin(ang) * len, y - Math.cos(ang) * len);
              ctxCol.stroke();

              ctxBump.strokeStyle = bright ? 'rgba(245,245,245,0.65)' : 'rgba(55,55,55,0.55)';
              ctxBump.lineWidth = 1.6;
              ctxBump.beginPath();
              ctxBump.moveTo(x, y);
              ctxBump.lineTo(x + Math.sin(ang) * len, y - Math.cos(ang) * len);
              ctxBump.stroke();
            }
          }

          const furColorTex = new THREE.CanvasTexture(cCol);
          furColorTex.colorSpace = THREE.SRGBColorSpace;
          furColorTex.wrapS = THREE.RepeatWrapping;
          furColorTex.wrapT = THREE.RepeatWrapping;
          furColorTex.repeat.set(3.2, 3.2);

          const furBumpTex = new THREE.CanvasTexture(cBump);
          furBumpTex.wrapS = THREE.RepeatWrapping;
          furBumpTex.wrapT = THREE.RepeatWrapping;
          furBumpTex.repeat.set(3.2, 3.2);

          texMgr.registerTexture(furColorTex);
          texMgr.registerTexture(furBumpTex);
          return { furColorTex, furBumpTex };
        };

        const { furColorTex, furBumpTex } = createPlushFurTextures();
        const plushWhiteFurMat = new THREE.MeshPhysicalMaterial({
          map: furColorTex,
          bumpMap: furBumpTex,
          bumpScale: 0.0068,
          color: 0xffffff,
          roughness: 0.95,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.65,
          sheenColor: new THREE.Color(0xffffff),
          envMapIntensity: 0.35,
        });
        const plushBlueFurMat = new THREE.MeshPhysicalMaterial({
          map: furColorTex,
          bumpMap: furBumpTex,
          bumpScale: 0.0058,
          color: 0x7fd4f7,
          roughness: 0.95,
          metalness: 0.0,
          sheen: 1.0,
          sheenRoughness: 0.68,
          sheenColor: new THREE.Color(0xdcf4ff),
          envMapIntensity: 0.35,
        });

        const rabbitEarsGroup = new THREE.Group();
        rabbitEarsGroup.position.set(0, 0.808, -0.004);

        // Fluffy white fur headband arching gently over the top crest of the chair backrest
        const headbandCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.145, -0.058, 0.002),
          new THREE.Vector3(-0.105, -0.008, 0.002),
          new THREE.Vector3(0.0, 0.012, 0.002),
          new THREE.Vector3(0.105, -0.008, 0.002),
          new THREE.Vector3(0.145, -0.058, 0.002),
        ]);
        const headbandMesh = new THREE.Mesh(
          new THREE.TubeGeometry(headbandCurve, 28, 0.014, 12, false),
          plushWhiteFurMat
        );
        headbandMesh.castShadow = true;
        headbandMesh.receiveShadow = true;
        rabbitEarsGroup.add(headbandMesh);

        // Petal/paddle outer & inner ear silhouettes matching ears.jpg (narrow pinched base widening into soft plump oval tip)
        const makePetalEarShape = (scaleW: number, scaleH: number) => {
          const s = new THREE.Shape();
          s.moveTo(-0.016 * scaleW, 0);
          s.bezierCurveTo(
            -0.022 * scaleW, 0.048 * scaleH,
            -0.054 * scaleW, 0.115 * scaleH,
            -0.042 * scaleW, 0.185 * scaleH
          );
          s.bezierCurveTo(
            -0.032 * scaleW, 0.228 * scaleH,
            -0.012 * scaleW, 0.238 * scaleH,
            0, 0.238 * scaleH
          );
          s.bezierCurveTo(
            0.012 * scaleW, 0.238 * scaleH,
            0.032 * scaleW, 0.228 * scaleH,
            0.042 * scaleW, 0.185 * scaleH
          );
          s.bezierCurveTo(
            0.054 * scaleW, 0.115 * scaleH,
            0.022 * scaleW, 0.048 * scaleH,
            0.016 * scaleW, 0
          );
          s.quadraticCurveTo(0, -0.008 * scaleH, -0.016 * scaleW, 0);
          return s;
        };

        const outerPetalShape = makePetalEarShape(1.0, 1.0);
        const outerPetalGeo = new THREE.ExtrudeGeometry(outerPetalShape, {
          depth: 0.010,
          bevelEnabled: true,
          bevelThickness: 0.011,
          bevelSize: 0.0085,
          bevelSegments: 5,
          curveSegments: 24,
        });
        outerPetalGeo.translate(0, 0, -0.005);

        const innerPetalShape = makePetalEarShape(0.75, 0.87);
        const innerPetalGeo = new THREE.ExtrudeGeometry(innerPetalShape, {
          depth: 0.007,
          bevelEnabled: true,
          bevelThickness: 0.006,
          bevelSize: 0.0055,
          bevelSegments: 4,
          curveSegments: 22,
        });
        innerPetalGeo.translate(0, 0.016, 0.0075);

        // Perimeter fur tuft instances to give genuine soft fluffy rim silhouette ("毛毛的感覺")
        const whiteTuftMats: THREE.Matrix4[] = [];
        const blueTuftMats: THREE.Matrix4[] = [];
        const tuftGeo = new THREE.ConeGeometry(0.0052, 0.016, 5);
        tuftGeo.translate(0, 0.008, 0);

        const samplePetalTufts = (
          parentMatrix: THREE.Matrix4,
          targetArr: THREE.Matrix4[],
          scaleW: number,
          scaleH: number,
          zOff: number,
          steps: number
        ) => {
          const pts = makePetalEarShape(scaleW, scaleH).getSpacedPoints(steps);
          const upAxis = new THREE.Vector3(0, 1, 0);
          const localMat = new THREE.Matrix4();
          const tmpPos = new THREE.Vector3();
          const tmpQuat = new THREE.Quaternion();
          const tmpScale = new THREE.Vector3(1, 1, 1);

          for (let i = 1; i < pts.length - 1; i++) {
            const p = pts[i];
            const prev = pts[i - 1];
            const next = pts[i + 1];
            const tx = next.x - prev.x;
            const ty = next.y - prev.y;
            const outDir = new THREE.Vector3(ty, -tx, (i % 2 === 0 ? 0.25 : -0.25)).normalize();
            tmpPos.set(p.x, p.y, zOff + (i % 3 === 0 ? 0.002 : -0.002));
            tmpQuat.setFromUnitVectors(upAxis, outDir);
            const lenS = 0.78 + ((i * 17) % 10) * 0.048;
            tmpScale.set(0.95, lenS, 0.95);
            localMat.compose(tmpPos, tmpQuat, tmpScale);
            targetArr.push(new THREE.Matrix4().multiplyMatrices(parentMatrix, localMat));
          }
        };

        [-1, 1].forEach((side) => {
          const earHolder = new THREE.Group();
          earHolder.position.set(side * 0.068, 0.002, 0.002);
          earHolder.rotation.z = -side * 0.22;
          earHolder.rotation.x = 0.08;
          earHolder.updateMatrix();

          // Pinch-wrapped fur base cuff blending ear smoothly onto headband
          const baseCuff = new THREE.Mesh(
            new THREE.SphereGeometry(0.022, 14, 12),
            plushWhiteFurMat
          );
          baseCuff.scale.set(1.05, 0.95, 0.72);
          baseCuff.position.y = 0.004;
          baseCuff.castShadow = true;
          earHolder.add(baseCuff);

          const outerEarMesh = new THREE.Mesh(outerPetalGeo, plushWhiteFurMat);
          outerEarMesh.castShadow = true;
          outerEarMesh.receiveShadow = true;
          earHolder.add(outerEarMesh);

          const innerEarMesh = new THREE.Mesh(innerPetalGeo, plushBlueFurMat);
          innerEarMesh.receiveShadow = true;
          earHolder.add(innerEarMesh);

          samplePetalTufts(earHolder.matrix, whiteTuftMats, 1.07, 1.02, 0.0, 52);
          samplePetalTufts(earHolder.matrix, blueTuftMats, 0.74, 0.87, 0.011, 30);

          rabbitEarsGroup.add(earHolder);
        });

        // Subtle fluffy headband halo tufts along top arch
        const hbAxis = new THREE.Vector3(0, 1, 0);
        const hbMat4 = new THREE.Matrix4();
        const hbPos = new THREE.Vector3();
        const hbQuat = new THREE.Quaternion();
        const hbScale = new THREE.Vector3();
        for (let hi = 1; hi <= 18; hi++) {
          const ht = hi / 19;
          const pt = headbandCurve.getPointAt(ht);
          const dir = new THREE.Vector3((ht - 0.5) * 0.6, 1.0, (hi % 2 === 0 ? 0.35 : -0.35)).normalize();
          hbPos.copy(pt).addScaledVector(dir, 0.011);
          hbQuat.setFromUnitVectors(hbAxis, dir);
          hbScale.set(1.0, 0.82, 1.0);
          hbMat4.compose(hbPos, hbQuat, hbScale);
          whiteTuftMats.push(hbMat4.clone());
        }

        const whiteTuftInst = new THREE.InstancedMesh(tuftGeo, plushWhiteFurMat, whiteTuftMats.length);
        whiteTuftMats.forEach((m, idx) => whiteTuftInst.setMatrixAt(idx, m));
        whiteTuftInst.instanceMatrix.needsUpdate = true;
        rabbitEarsGroup.add(whiteTuftInst);

        const blueTuftInst = new THREE.InstancedMesh(tuftGeo, plushBlueFurMat, blueTuftMats.length);
        blueTuftMats.forEach((m, idx) => blueTuftInst.setMatrixAt(idx, m));
        blueTuftInst.instanceMatrix.needsUpdate = true;
        rabbitEarsGroup.add(blueTuftInst);

        backrestPivot.add(rabbitEarsGroup);
        gamingChairGroup.add(backrestPivot);
        coloredRoomGroup.add(gamingChairGroup);

        // Double-Deck Capsule Hotel Space Pods (靠在房間角落的上下兩座 120×120×300cm 正方形膠囊旅館太空艙，艙門面向房門 -Z，側面為整塊白橡木色木板，上艙打開、下艙貼手寫「雜物」紙條、樓梯位於艙門側)
        const POD_W = 1.20;
        const POD_H = 1.20;
        const POD_L = 3.00;
        const capsuleStackGroup = new THREE.Group();
        capsuleStackGroup.position.set(
          -5.0 + 0.04 + POD_W / 2,
          0,
          PR_SIZE / 2 - 0.04 - POD_L / 2
        );

        const capShellMat = new THREE.MeshPhysicalMaterial({
          color: 0xf4f6f9,
          roughness: 0.26,
          metalness: 0.04,
          clearcoat: 0.48,
          clearcoatRoughness: 0.16,
          envMapIntensity: 0.92,
        });
        const capBezelMat = new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          roughness: 0.20,
          metalness: 0.06,
          clearcoat: 0.56,
          clearcoatRoughness: 0.14,
          envMapIntensity: 1.0,
        });
        const capDoorMat = new THREE.MeshPhysicalMaterial({
          color: 0xebeff5,
          roughness: 0.24,
          metalness: 0.08,
          clearcoat: 0.52,
          clearcoatRoughness: 0.14,
          envMapIntensity: 0.96,
        });
        const capDarkTrimMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.48,
          metalness: 0.30,
          envMapIntensity: 0.80,
        });
        const capMetalMat = new THREE.MeshStandardMaterial({
          color: 0xd8e0ea,
          roughness: 0.20,
          metalness: 0.88,
          envMapIntensity: 1.38,
        });
        const capLedMat = new THREE.MeshBasicMaterial({
          color: 0xaee4ff,
        });
        const capInteriorLedMat = new THREE.MeshStandardMaterial({
          color: 0xfff6ea,
          emissive: 0xfff0d6,
          emissiveIntensity: 0.68,
          roughness: 0.35,
          metalness: 0.0,
        });
        refs.capsuleCeilingLedMatRef.current = capInteriorLedMat;
        const capWindowMat = new THREE.MeshPhysicalMaterial({
          color: 0xbae6fd,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.36,
          roughness: 0.10,
          metalness: 0.12,
          clearcoat: 0.90,
          envMapIntensity: 1.25,
        });

        const whiteOakTex = texMgr.cloneTexture(texMgr.getWhiteOakWoodTexture(), 1.2, 1.4);
        const capWhiteOakMat = new THREE.MeshStandardMaterial({
          map: whiteOakTex,
          color: 0xf5efe6,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.56,
        });

        const capInteriorWallMat = new THREE.MeshStandardMaterial({
          color: 0xf1f5f9,
          roughness: 0.66,
          metalness: 0.02,
          envMapIntensity: 0.45,
        });
        const capFutonMat = new THREE.MeshStandardMaterial({
          color: 0xfafbfc,
          roughness: 0.92,
          metalness: 0.0,
          envMapIntensity: 0.34,
        });

        // Crisp illuminated berth number badges ("01" lower / "02" upper)
        const createCapsuleBadgeTex = (code: string) => {
          const c = document.createElement('canvas');
          c.width = 128;
          c.height = 64;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, 128, 64);
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 3;
            ctx.strokeRect(4, 4, 120, 56);
            ctx.fillStyle = '#bae6fd';
            ctx.font = 'bold 34px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(code, 64, 34);
          }
          const tex = new THREE.CanvasTexture(c);
          tex.colorSpace = THREE.SRGBColorSpace;
          texMgr.registerTexture(tex);
          return tex;
        };

        const createRoundedRingShape = (
          outerW: number,
          outerH: number,
          outerR: number,
          innerW: number,
          innerH: number,
          innerR: number
        ) => {
          const shape = makeRoundedShape(outerW, outerH, outerR);
          const hole = new THREE.Path();
          const ihw = innerW / 2;
          const ihh = innerH / 2;
          const ir = Math.min(innerR, ihw * 0.9, ihh * 0.9);
          hole.moveTo(-ihw + ir, -ihh);
          hole.lineTo(-ihw, -ihh + ir);
          hole.lineTo(-ihw, ihh - ir);
          hole.quadraticCurveTo(-ihw, ihh, -ihw + ir, ihh);
          hole.lineTo(ihw - ir, ihh);
          hole.quadraticCurveTo(ihw, ihh, ihw, ihh - ir);
          hole.lineTo(ihw, -ihh + ir);
          hole.quadraticCurveTo(ihw, -ihh, ihw - ir, -ihh);
          hole.lineTo(-ihw + ir, -ihh);
          shape.holes.push(hole);
          return shape;
        };

        const podBezelGeo = new THREE.ExtrudeGeometry(
          createRoundedRingShape(POD_W - 0.012, POD_H - 0.012, 0.06, 0.90, 0.88, 0.14),
          {
            depth: 0.055,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.010,
            bevelSegments: 4,
            curveSegments: 16,
          }
        );

        const podLedGeo = new THREE.ExtrudeGeometry(
          createRoundedRingShape(0.925, 0.905, 0.15, 0.895, 0.875, 0.135),
          {
            depth: 0.010,
            bevelEnabled: false,
            curveSegments: 16,
          }
        );

        const podDoorGeo = new THREE.ExtrudeGeometry(
          makeRoundedShape(0.87, 0.85, 0.125),
          {
            depth: 0.024,
            bevelEnabled: true,
            bevelThickness: 0.008,
            bevelSize: 0.006,
            bevelSegments: 3,
            curveSegments: 16,
          }
        );

        const podOpenDoorGeo = new THREE.ExtrudeGeometry(
          makeRoundedShape(0.24, 0.85, 0.045),
          {
            depth: 0.024,
            bevelEnabled: true,
            bevelThickness: 0.007,
            bevelSize: 0.005,
            bevelSegments: 3,
            curveSegments: 12,
          }
        );

        const zhaWuNoteTex = texMgr.getHandwrittenZhaWuTexture();
        const zhaWuNoteMat = new THREE.MeshStandardMaterial({
          map: zhaWuNoteTex,
          roughness: 0.86,
          metalness: 0.01,
        });
        const maskingTapeMat = new THREE.MeshStandardMaterial({
          color: 0xebd9b0,
          transparent: true,
          opacity: 0.86,
          roughness: 0.65,
        });

        (['01', '02'] as const).forEach((podCode, tierIdx) => {
          const podGroup = new THREE.Group();
          podGroup.position.y = tierIdx * POD_H;
          const isUpperOpen = tierIdx === 1;

          // 1. Main 120×120×200 cm Capsule Body Housing
          if (!isUpperOpen) {
            const bodyShell = new THREE.Mesh(
              new THREE.BoxGeometry(POD_W - 0.01, POD_H - 0.016, POD_L - 0.04),
              capShellMat
            );
            bodyShell.position.set(-0.005, POD_H / 2, 0.02);
            bodyShell.castShadow = true;
            bodyShell.receiveShadow = true;
            podGroup.add(bodyShell);
          } else {
            // Hollowed Upper Capsule ('02') so the hatch opens cleanly into a furnished cozy sleeping cabin
            const wallT = 0.045;
            const shellDepth = POD_L - 0.04;
            const shellZ = 0.02;

            const podFloor = new THREE.Mesh(
              new THREE.BoxGeometry(POD_W - 0.01, wallT, shellDepth),
              capInteriorWallMat
            );
            podFloor.position.set(-0.005, wallT / 2 + 0.008, shellZ);
            podFloor.receiveShadow = true;
            podGroup.add(podFloor);

            const podCeiling = new THREE.Mesh(
              new THREE.BoxGeometry(POD_W - 0.01, wallT, shellDepth),
              capShellMat
            );
            podCeiling.position.set(-0.005, POD_H - wallT / 2 - 0.008, shellZ);
            podCeiling.castShadow = true;
            podGroup.add(podCeiling);

            const podLeftWall = new THREE.Mesh(
              new THREE.BoxGeometry(wallT, POD_H - 0.016, shellDepth),
              capInteriorWallMat
            );
            podLeftWall.position.set(-POD_W / 2 + wallT / 2, POD_H / 2, shellZ);
            podLeftWall.receiveShadow = true;
            podGroup.add(podLeftWall);

            const podRightWall = new THREE.Mesh(
              new THREE.BoxGeometry(wallT, POD_H - 0.016, shellDepth),
              capInteriorWallMat
            );
            podRightWall.position.set(POD_W / 2 - wallT / 2 - 0.01, POD_H / 2, shellZ);
            podRightWall.receiveShadow = true;
            podGroup.add(podRightWall);

            const podBackWall = new THREE.Mesh(
              new THREE.BoxGeometry(POD_W - 0.01, POD_H - 0.016, 0.05),
              capWhiteOakMat
            );
            podBackWall.position.set(-0.005, POD_H / 2, POD_L / 2 - 0.025);
            podBackWall.receiveShadow = true;
            podGroup.add(podBackWall);

            // Cozy capsule interior: full-length white futon, extended light-blue pad reaching the door, 3 fluffy marshmallow pillows, and full-length oak shelf (床墊與架子延伸至床尾門前 + 棉花糖造型枕頭×3)
            const futon = new THREE.Mesh(
              new THREE.BoxGeometry(1.06, 0.095, 2.86),
              capFutonMat
            );
            futon.position.set(0, wallT + 0.055, 0.01);
            futon.receiveShadow = true;
            futon.castShadow = true;
            podGroup.add(futon);

            // Soft plush procedural micro-fleece texture shared by the extended blue pad & marshmallow pillows
            const createMarshmallowPlushTex = () => {
              const c = document.createElement('canvas');
              c.width = 256;
              c.height = 256;
              const ctx = c.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, 256, 256);
                let s = 419;
                const rand = () => {
                  s = (s * 16807) % 2147483647;
                  return (s - 1) / 2147483646;
                };
                for (let i = 0; i < 3200; i++) {
                  const px = rand() * 256;
                  const py = rand() * 256;
                  const r = 0.8 + rand() * 1.8;
                  const bright = rand() > 0.5 ? '255,255,255' : '226,232,240';
                  ctx.fillStyle = `rgba(${bright},0.16)`;
                  ctx.beginPath();
                  ctx.arc(px, py, r, 0, Math.PI * 2);
                  ctx.fill();
                }
              }
              const t = new THREE.CanvasTexture(c);
              t.colorSpace = THREE.SRGBColorSpace;
              t.wrapS = THREE.RepeatWrapping;
              t.wrapT = THREE.RepeatWrapping;
              t.repeat.set(3, 5);
              texMgr.registerTexture(t);
              return t;
            };
            const plushTex = createMarshmallowPlushTex();

            const PAD_W = 1.03;
            const PAD_L = 2.83;
            const PAD_BEVEL = 0.012;
            const bluePadGeo = new THREE.ExtrudeGeometry(
              makeRoundedShape(PAD_W - PAD_BEVEL * 2, PAD_L - PAD_BEVEL * 2, 0.055),
              {
                depth: 0.044,
                bevelEnabled: true,
                bevelThickness: PAD_BEVEL,
                bevelSize: PAD_BEVEL,
                bevelSegments: 3,
                curveSegments: 12,
              }
            );
            bluePadGeo.rotateX(-Math.PI / 2);

            const bluePadMat = new THREE.MeshPhysicalMaterial({
              map: plushTex,
              color: 0xbcd0e2,
              roughness: 0.88,
              metalness: 0.01,
              sheen: 0.72,
              sheenRoughness: 0.76,
              sheenColor: new THREE.Color(0xeef6ff),
            });
            const blanket = new THREE.Mesh(bluePadGeo, bluePadMat);
            blanket.position.set(0, 0.1475 + PAD_BEVEL - 0.004, 0.015);
            blanket.castShadow = true;
            blanket.receiveShadow = true;
            podGroup.add(blanket);

            // Three Very Fluffy Marshmallow-Shaped Pillows (很澎軟的棉花糖造型枕頭×3)
            const PAD_TOP_Y = 0.2115;
            const buildMarshmallowPillow = (
              bodyColorHex: number,
              sheenColorHex: number,
              trimColorHex: number,
              pw: number,
              ph: number,
              pd: number,
              phase: number
            ) => {
              const pGrp = new THREE.Group();

              // Sculpted plump rounded marshmallow body from high-density sphere
              const mGeo = new THREE.SphereGeometry(0.5, 44, 30);
              const posAttr = mGeo.attributes.position;
              for (let i = 0; i < posAttr.count; i++) {
                const vx = posAttr.getX(i);
                const vy = posAttr.getY(i);
                const vz = posAttr.getZ(i);
                const nx = vx * 2.0;
                const ny = vy * 2.0;
                const nz = vz * 2.0;

                const hR = Math.hypot(nx, nz);
                const ang = Math.atan2(nz, nx);
                // Superellipsoid square-cushion roundness + plush marshmallow puffs + scalloped seam
                const cushionFill = hR > 1e-4
                  ? Math.pow(
                      Math.pow(Math.abs(nx), 2.55) + Math.pow(Math.abs(nz), 2.55),
                      1 / 2.55
                    )
                  : 0;
                const sqRatio = cushionFill > 1e-4 ? hR / cushionFill : 1.0;
                const fluffBulge = 1.0 + 0.085 * (1.0 - ny * ny);
                const puffLobe = 1.0 + 0.048 * Math.cos(ang * 4.0 + phase) * (1.0 - ny * ny * 0.85);
                const waistPinch = 1.0 - 0.032 * Math.exp(-Math.pow(ny * 3.8, 2));

                const rx = vx * sqRatio * fluffBulge * puffLobe * waistPinch;
                const rz = vz * sqRatio * fluffBulge * puffLobe * waistPinch;

                // Softly flattened bottom to sit flush + extra high pillowy loft & gentle central dimple on top
                const centerDimple = Math.exp(-(nx * nx + nz * nz) * 5.2);
                const puffCrown = 1.0 + 0.14 * (1.0 - centerDimple * 0.65);
                let ry = ny >= 0
                  ? vy * (1.16 * puffCrown - 0.18 * centerDimple * Math.abs(ny))
                  : vy * (0.72 + 0.08 * (nx * nx + nz * nz));

                posAttr.setXYZ(i, rx * pw, ry * ph, rz * pd);
              }
              mGeo.computeVertexNormals();
              mGeo.computeBoundingBox();
              const baseOffsetY = -(mGeo.boundingBox ? mGeo.boundingBox.min.y : -ph * 0.36);

              const bodyMat = new THREE.MeshPhysicalMaterial({
                map: plushTex,
                color: bodyColorHex,
                roughness: 0.91,
                metalness: 0.0,
                sheen: 1.0,
                sheenRoughness: 0.72,
                sheenColor: new THREE.Color(sheenColorHex),
              });
              const bodyMesh = new THREE.Mesh(mGeo, bodyMat);
              bodyMesh.position.y = baseOffsetY;
              bodyMesh.castShadow = true;
              bodyMesh.receiveShadow = true;
              pGrp.add(bodyMesh);

              // Continuous sewn plush piping cord around the pillow waist
              const seamPts: THREE.Vector3[] = [];
              const SEAM_STEPS = 40;
              for (let s = 0; s < SEAM_STEPS; s++) {
                const a = (s / SEAM_STEPS) * Math.PI * 2;
                const ca = Math.cos(a);
                const sa = Math.sin(a);
                const sr = Math.pow(
                  Math.pow(Math.abs(ca), 2.55) + Math.pow(Math.abs(sa), 2.55),
                  1 / 2.55
                );
                const lobe = 1.0 + 0.045 * Math.cos(a * 4.0 + phase);
                seamPts.push(
                  new THREE.Vector3(
                    (ca / sr) * (pw * 0.505) * lobe,
                    baseOffsetY + 0.002,
                    (sa / sr) * (pd * 0.505) * lobe
                  )
                );
              }
              const seamCurve = new THREE.CatmullRomCurve3(seamPts, true);
              const trimMat = new THREE.MeshStandardMaterial({
                color: trimColorHex,
                roughness: 0.62,
                metalness: 0.02,
              });
              const seamCord = new THREE.Mesh(
                new THREE.TubeGeometry(seamCurve, 48, 0.0052, 8, true),
                trimMat
              );
              seamCord.castShadow = true;
              pGrp.add(seamCord);

              // Cute fabric-covered center tuft button nestled inside the dimple
              const topY = (mGeo.boundingBox ? mGeo.boundingBox.max.y : ph * 0.48) + baseOffsetY;
              const tuftBtn = new THREE.Mesh(new THREE.SphereGeometry(0.017, 14, 10), trimMat);
              tuftBtn.scale.set(1.0, 0.52, 1.0);
              tuftBtn.position.set(0, topY - 0.024, 0);
              tuftBtn.castShadow = true;
              pGrp.add(tuftBtn);

              return pGrp;
            };

            const marshmallowConfigs: {
              body: number;
              sheen: number;
              trim: number;
              w: number;
              h: number;
              d: number;
              phase: number;
              pos: [number, number, number];
              rot: [number, number, number];
            }[] = [
              {
                // Left creamy-white marshmallow pillow
                body: 0xfffdfd,
                sheen: 0xffffff,
                trim: 0xdbeafe,
                w: 0.33,
                h: 0.175,
                d: 0.255,
                phase: 0.2,
                pos: [-0.22, PAD_TOP_Y + 0.004, 1.24],
                rot: [0.22, 0.12, -0.04],
              },
              {
                // Center plump baby-blue marshmallow pillow
                body: 0xe6f3ff,
                sheen: 0xf8fcff,
                trim: 0xffffff,
                w: 0.35,
                h: 0.185,
                d: 0.265,
                phase: 1.1,
                pos: [0.06, PAD_TOP_Y + 0.002, 1.19],
                rot: [0.17, -0.06, 0.03],
              },
              {
                // Right soft pastel-blush marshmallow pillow
                body: 0xfff0f5,
                sheen: 0xfffafc,
                trim: 0xffffff,
                w: 0.33,
                h: 0.175,
                d: 0.255,
                phase: 2.3,
                pos: [0.33, PAD_TOP_Y + 0.004, 1.25],
                rot: [0.24, -0.14, 0.04],
              },
            ];

            marshmallowConfigs.forEach((cfg) => {
              const mp = buildMarshmallowPillow(
                cfg.body,
                cfg.sheen,
                cfg.trim,
                cfg.w,
                cfg.h,
                cfg.d,
                cfg.phase
              );
              mp.position.set(...cfg.pos);
              mp.rotation.set(...cfg.rot);
              podGroup.add(mp);
            });

            // Inner white-oak bedside ledge extended all the way to the front door (架子延伸至床尾門前)
            const innerShelf = new THREE.Mesh(
              new THREE.BoxGeometry(0.14, 0.024, 2.74),
              capWhiteOakMat
            );
            innerShelf.position.set(-POD_W / 2 + wallT + 0.07, 0.42, -0.02);
            innerShelf.castShadow = true;
            innerShelf.receiveShadow = true;
            podGroup.add(innerShelf);

            [-1.12, -0.08, 0.96].forEach((bz) => {
              const shelfBracket = new THREE.Mesh(
                new THREE.BoxGeometry(0.09, 0.065, 0.024),
                capWhiteOakMat
              );
              shelfBracket.position.set(-POD_W / 2 + wallT + 0.045, 0.376, bz);
              shelfBracket.castShadow = true;
              podGroup.add(shelfBracket);
            });

            // Movie Poster taped cleanly on leftmost capsule wall directly beside/above innerShelf (膠囊艙架子最左邊牆面海報)
            const kamenPosterTex = texMgr.loadTexture('/assets/capsule_kamen_poster.webp');
            kamenPosterTex.colorSpace = THREE.SRGBColorSpace;
            kamenPosterTex.anisotropy = texMgr.maxAnisotropy;
            texMgr.registerTexture(kamenPosterTex);

            const KP_W = 0.36;
            const KP_H = 0.508;
            const kamenPosterGroup = new THREE.Group();
            kamenPosterGroup.position.set(-POD_W / 2 + wallT + 0.0025, 0.75, 1.04);
            kamenPosterGroup.rotation.y = Math.PI / 2;

            const kamenPosterMesh = new THREE.Mesh(
              new THREE.PlaneGeometry(KP_W, KP_H),
              new THREE.MeshStandardMaterial({
                map: kamenPosterTex,
                roughness: 0.78,
                metalness: 0.0,
                envMapIntensity: 0.40,
              })
            );
            kamenPosterMesh.receiveShadow = true;
            kamenPosterGroup.add(kamenPosterMesh);

            // Tiny corner masking-tape strips holding poster onto capsule wall
            [
              [-KP_W / 2 + 0.022, KP_H / 2 - 0.004, 0.38],
              [KP_W / 2 - 0.022, KP_H / 2 - 0.004, -0.38],
              [-KP_W / 2 + 0.022, -KP_H / 2 + 0.004, -0.34],
              [KP_W / 2 - 0.022, -KP_H / 2 + 0.004, 0.34],
            ].forEach(([tx, ty, rotZ]) => {
              const tapeBit = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.015), maskingTapeMat);
              tapeBit.position.set(tx, ty, 0.0008);
              tapeBit.rotation.z = rotZ;
              kamenPosterGroup.add(tapeBit);
            });

            podGroup.add(kamenPosterGroup);

            // 1. Mitered Warm-Brown Wood Photo Frame at Far Left of Inner Shelf (膠囊艙架子最左邊的木質立式相框)
            const capsulePhotoFrameTex = texMgr.loadTexture('/assets/capsule_photo_frame.webp');
            capsulePhotoFrameTex.colorSpace = THREE.SRGBColorSpace;
            capsulePhotoFrameTex.anisotropy = texMgr.maxAnisotropy;
            texMgr.registerTexture(capsulePhotoFrameTex);

            const createPhotoFrameWoodTex = (isVertical: boolean) => {
              const wc = document.createElement('canvas');
              wc.width = 256;
              wc.height = 256;
              const wctx = wc.getContext('2d');
              if (wctx) {
                wctx.fillStyle = '#7c6049';
                wctx.fillRect(0, 0, 256, 256);
                for (let i = 0; i < 120; i++) {
                  const pos = (i / 120) * 256;
                  const tone = i % 3 === 0 ? 'rgba(62, 44, 30, 0.28)' : i % 2 === 0 ? 'rgba(154, 128, 102, 0.22)' : 'rgba(92, 69, 50, 0.24)';
                  wctx.fillStyle = tone;
                  if (isVertical) wctx.fillRect(pos, 0, 2.2, 256);
                  else wctx.fillRect(0, pos, 256, 2.2);
                }
              }
              const tex = new THREE.CanvasTexture(wc);
              tex.colorSpace = THREE.SRGBColorSpace;
              texMgr.registerTexture(tex);
              return tex;
            };

            const SHELF_TOP_Y = 0.432;
            const PHOTO_W = 0.092;
            const PHOTO_H = 0.130;
            const LINER_W = 0.005;
            const MOULD_W = 0.019;
            const FRAME_OUT_W = PHOTO_W + (LINER_W + MOULD_W) * 2;
            const FRAME_OUT_H = PHOTO_H + (LINER_W + MOULD_W) * 2;
            const FRAME_TILT = -0.20;

            // 1. Mitered Warm-Brown Wood Photo Frame at Left of Inner Shelf turned 95 degrees (向右前方)
            const capsulePhotoFrameGroup = new THREE.Group();
            capsulePhotoFrameGroup.position.set(-0.482, SHELF_TOP_Y, 1.275);
            capsulePhotoFrameGroup.rotation.y = (95 * Math.PI) / 180;

            const frameTiltHolder = new THREE.Group();
            frameTiltHolder.rotation.x = FRAME_TILT;
            frameTiltHolder.position.set(0, 0.002, 0.018);

            const frameWoodHMat = new THREE.MeshStandardMaterial({
              map: createPhotoFrameWoodTex(false),
              roughness: 0.46,
              metalness: 0.04,
              envMapIntensity: 0.72,
            });
            const frameWoodVMat = new THREE.MeshStandardMaterial({
              map: createPhotoFrameWoodTex(true),
              roughness: 0.46,
              metalness: 0.04,
              envMapIntensity: 0.72,
            });
            const frameLinerMat = new THREE.MeshStandardMaterial({
              color: 0xc8ceca,
              roughness: 0.62,
              metalness: 0.02,
              envMapIntensity: 0.50,
            });
            const frameBackBoardMat = new THREE.MeshStandardMaterial({
              color: 0x3b2c22,
              roughness: 0.74,
              metalness: 0.02,
            });
            const frameGlassMat = new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              roughness: 0.03,
              metalness: 0.01,
              clearcoat: 1.0,
              clearcoatRoughness: 0.03,
              reflectivity: 0.96,
              envMapIntensity: 1.45,
              transparent: true,
              opacity: 0.16,
              depthWrite: false,
            });

            const hw = FRAME_OUT_W / 2;
            const hh = FRAME_OUT_H / 2;
            const ihw = hw - MOULD_W;
            const ihh = hh - MOULD_W;
            const frameCenterY = FRAME_OUT_H / 2;

            const makeMiterRail = (pts: [number, number][], mat: THREE.Material) => {
              const s = new THREE.Shape();
              pts.forEach(([px, py], i) => {
                if (i === 0) s.moveTo(px, py);
                else s.lineTo(px, py);
              });
              s.closePath();
              const geo = new THREE.ExtrudeGeometry(s, {
                depth: 0.011,
                bevelEnabled: true,
                bevelThickness: 0.0038,
                bevelSize: 0.0032,
                bevelSegments: 2,
              });
              geo.translate(0, 0, -0.0055);
              const mesh = new THREE.Mesh(geo, mat);
              mesh.position.y = frameCenterY;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              return mesh;
            };

            // 4 beveled mitered wood moulding rails matching reference wood grain orientation
            frameTiltHolder.add(makeMiterRail([[-hw, hh], [hw, hh], [ihw, ihh], [-ihw, ihh]], frameWoodHMat));
            frameTiltHolder.add(makeMiterRail([[-hw, -hh], [-ihw, -ihh], [ihw, -ihh], [hw, -hh]], frameWoodHMat));
            frameTiltHolder.add(makeMiterRail([[-hw, -hh], [-hw, hh], [-ihw, ihh], [-ihw, -ihh]], frameWoodVMat));
            frameTiltHolder.add(makeMiterRail([[hw, -hh], [ihw, -ihh], [ihw, ihh], [hw, hh]], frameWoodVMat));

            // 4 pale sage-grey inner bevel liner strips framing the bromaid photo
            const lw = ihw * 2;
            const lh = ihh * 2;
            const topLiner = new THREE.Mesh(new THREE.BoxGeometry(lw, LINER_W, 0.008), frameLinerMat);
            topLiner.position.set(0, frameCenterY + PHOTO_H / 2 + LINER_W / 2, 0.002);
            frameTiltHolder.add(topLiner);

            const botLiner = new THREE.Mesh(new THREE.BoxGeometry(lw, LINER_W, 0.008), frameLinerMat);
            botLiner.position.set(0, frameCenterY - PHOTO_H / 2 - LINER_W / 2, 0.002);
            frameTiltHolder.add(botLiner);

            const leftLiner = new THREE.Mesh(new THREE.BoxGeometry(LINER_W, lh, 0.008), frameLinerMat);
            leftLiner.position.set(-PHOTO_W / 2 - LINER_W / 2, frameCenterY, 0.002);
            frameTiltHolder.add(leftLiner);

            const rightLiner = new THREE.Mesh(new THREE.BoxGeometry(LINER_W, lh, 0.008), frameLinerMat);
            rightLiner.position.set(PHOTO_W / 2 + LINER_W / 2, frameCenterY, 0.002);
            frameTiltHolder.add(rightLiner);

            // Photo print + protective glass cover + dark MDF backing board
            const framePhotoMesh = new THREE.Mesh(
              new THREE.PlaneGeometry(PHOTO_W, PHOTO_H),
              new THREE.MeshPhysicalMaterial({
                map: capsulePhotoFrameTex,
                roughness: 0.22,
                metalness: 0.0,
                clearcoat: 0.55,
                clearcoatRoughness: 0.14,
                envMapIntensity: 0.85,
              })
            );
            framePhotoMesh.position.set(0, frameCenterY, 0.0012);
            frameTiltHolder.add(framePhotoMesh);

            const frameGlassPane = new THREE.Mesh(
              new THREE.PlaneGeometry(PHOTO_W + 0.002, PHOTO_H + 0.002),
              frameGlassMat
            );
            frameGlassPane.position.set(0, frameCenterY, 0.0042);
            frameGlassPane.renderOrder = 2;
            frameTiltHolder.add(frameGlassPane);

            const frameBackBoard = new THREE.Mesh(
              new THREE.BoxGeometry(FRAME_OUT_W - 0.008, FRAME_OUT_H - 0.008, 0.005),
              frameBackBoardMat
            );
            frameBackBoard.position.set(0, frameCenterY, -0.0038);
            frameBackBoard.castShadow = true;
            frameTiltHolder.add(frameBackBoard);

            capsulePhotoFrameGroup.add(frameTiltHolder);

            // Rear folding easel kickstand leg resting flush on shelf
            const pfPivotWorld = new THREE.Vector3(
              0,
              0.002 + Math.cos(Math.abs(FRAME_TILT)) * (FRAME_OUT_H * 0.62),
              0.018 - Math.sin(Math.abs(FRAME_TILT)) * (FRAME_OUT_H * 0.62) - 0.005
            );
            const pfFootWorld = new THREE.Vector3(0, 0.002, -0.044);
            const pfLegVec = new THREE.Vector3().subVectors(pfPivotWorld, pfFootWorld);
            const pfKickLeg = new THREE.Mesh(
              new THREE.BoxGeometry(0.022, pfLegVec.length(), 0.005),
              frameBackBoardMat
            );
            pfKickLeg.position.addVectors(pfPivotWorld, pfFootWorld).multiplyScalar(0.5);
            pfKickLeg.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              pfLegVec.clone().normalize()
            );
            pfKickLeg.castShadow = true;
            capsulePhotoFrameGroup.add(pfKickLeg);

            podGroup.add(capsulePhotoFrameGroup);

            // Jewel-Case CD on Inner Shelf slightly right of Photo Frame facing forward (90 deg)
            const capsuleCdGroup = createCdDisplayGroup('/assets/cd_su_utsukushiku_front.webp', 1.15);
            capsuleCdGroup.position.set(-0.482, SHELF_TOP_Y, 1.085);
            capsuleCdGroup.rotation.y = Math.PI / 2;
            podGroup.add(capsuleCdGroup);

            // 2. Uchiwa Support Fan mounted on Interior Capsule Side Wall near Doorway (膠囊艙內稍微靠門口側牆面的推扇)
            uchiwaFanGroup.scale.setScalar(1.16);
            uchiwaFanGroup.position.set(-POD_W / 2 + wallT + 0.008, 0.80, -0.92);
            uchiwaFanGroup.rotation.y = Math.PI / 2;
            podGroup.add(uchiwaFanGroup);

            // Ceiling warm-cozy LED strip + brightened capsule lights
            const ceilingLedBar = new THREE.Mesh(
              new THREE.BoxGeometry(0.54, 0.016, 2.24),
              capInteriorLedMat
            );
            ceilingLedBar.position.set(0, POD_H - wallT - 0.012, 0.06);
            podGroup.add(ceilingLedBar);

            const interiorPodLightBack = new THREE.PointLight(0xfff2e4, 0.48, 4.2, 1.14);
            interiorPodLightBack.position.set(0, POD_H - 0.22, 0.55);
            refs.capsuleMainLightBackRef.current = interiorPodLightBack;
            podGroup.add(interiorPodLightBack);

            const interiorPodLightFront = new THREE.PointLight(0xfff2e4, 0.42, 4.0, 1.16);
            interiorPodLightFront.position.set(0, POD_H - 0.22, -0.55);
            refs.capsuleMainLightFrontRef.current = interiorPodLightFront;
            podGroup.add(interiorPodLightFront);

            // Headboard Bedside Light Switch Panel & Dim Light-Blue Reading Lamp (膠囊艙床頭電燈開關＋暗淺藍光閱讀燈)
            refs.capsuleLightModeRef.current = 0;
            const headWallInnerZ = POD_L / 2 - 0.05; // 1.45m (front face of podBackWall)

            // 1. Dim Light-Blue Reading Lamp mounted on Oak Headboard above right pillow
            const readingLampGroup = new THREE.Group();
            readingLampGroup.position.set(0.34, 0.78, headWallInnerZ);

            const lampMountPlate = new THREE.Mesh(
              new THREE.CylinderGeometry(0.032, 0.034, 0.012, 20),
              capMetalMat
            );
            lampMountPlate.rotation.x = Math.PI / 2;
            lampMountPlate.position.z = -0.006;
            readingLampGroup.add(lampMountPlate);

            const lampArmStem = new THREE.Mesh(
              new THREE.CylinderGeometry(0.009, 0.009, 0.065, 12),
              capMetalMat
            );
            lampArmStem.rotation.x = Math.PI / 2;
            lampArmStem.position.set(0, 0, -0.038);
            readingLampGroup.add(lampArmStem);

            const lampHeadPivot = new THREE.Group();
            lampHeadPivot.position.set(0, -0.008, -0.072);
            lampHeadPivot.rotation.x = 0.58; // Angled downward & forward over pillows

            const lampHoodShell = new THREE.Mesh(
              new THREE.CylinderGeometry(0.022, 0.028, 0.062, 20),
              capDoorMat
            );
            lampHoodShell.castShadow = true;
            lampHeadPivot.add(lampHoodShell);

            const lampTrimCollar = new THREE.Mesh(
              new THREE.TorusGeometry(0.027, 0.0032, 8, 20),
              capMetalMat
            );
            lampTrimCollar.rotation.x = Math.PI / 2;
            lampTrimCollar.position.y = -0.031;
            lampHeadPivot.add(lampTrimCollar);

            const readingLensMat = new THREE.MeshStandardMaterial({
              color: 0x9ecae8,
              emissive: 0x7dd3fc,
              emissiveIntensity: 0,
              roughness: 0.25,
              metalness: 0.02,
            });
            refs.capsuleReadingLensMatRef.current = readingLensMat;

            const lampLensDisc = new THREE.Mesh(
              new THREE.CircleGeometry(0.025, 20),
              readingLensMat
            );
            lampLensDisc.rotation.x = Math.PI / 2;
            lampLensDisc.position.y = -0.0315;
            lampHeadPivot.add(lampLensDisc);

            readingLampGroup.add(lampHeadPivot);
            podGroup.add(readingLampGroup);

            const capsuleReadingLight = new THREE.PointLight(0x8bd8ff, 0, 2.5, 1.35);
            capsuleReadingLight.position.set(0.34, 0.70, headWallInnerZ - 0.14);
            refs.capsuleReadingLightRef.current = capsuleReadingLight;
            podGroup.add(capsuleReadingLight);

            // 2. Tactile Bedside Push-Button Switch Panel mounted directly below the reading lamp
            const switchGroup = new THREE.Group();
            switchGroup.position.set(0.34, 0.55, headWallInnerZ);

            const switchPlate = new THREE.Mesh(
              new THREE.BoxGeometry(0.088, 0.088, 0.010),
              capBezelMat
            );
            switchPlate.position.z = -0.005;
            switchPlate.castShadow = true;
            switchGroup.add(switchPlate);

            const switchBezel = new THREE.Mesh(
              new THREE.BoxGeometry(0.054, 0.054, 0.006),
              capDarkTrimMat
            );
            switchBezel.position.z = -0.011;
            switchGroup.add(switchBezel);

            const switchBtnMesh = new THREE.Mesh(
              new THREE.BoxGeometry(0.044, 0.044, 0.010),
              capDoorMat
            );
            switchBtnMesh.position.z = -0.016;
            switchBtnMesh.castShadow = true;
            refs.capsuleSwitchBtnRef.current = switchBtnMesh;
            switchGroup.add(switchBtnMesh);

            const switchLedMat = new THREE.MeshStandardMaterial({
              color: 0xfef3c7,
              emissive: 0xfde68a,
              emissiveIntensity: 0.75,
              roughness: 0.3,
            });
            refs.capsuleSwitchLedMatRef.current = switchLedMat;

            const switchLedDot = new THREE.Mesh(
              new THREE.BoxGeometry(0.018, 0.004, 0.003),
              switchLedMat
            );
            switchLedDot.position.set(0, 0.012, -0.021);
            switchGroup.add(switchLedDot);

            // Invisible generous tap hitbox for easy clicking from inside or outside the capsule
            const switchHitbox = new THREE.Mesh(
              new THREE.BoxGeometry(0.18, 0.22, 0.12),
              new THREE.MeshBasicMaterial({ visible: false })
            );
            switchHitbox.name = 'capsule_light_switch_hitbox';
            switchHitbox.position.set(0, 0.06, -0.04);
            refs.capsuleLightSwitchHitboxRef.current = switchHitbox;
            switchGroup.add(switchHitbox);

            podGroup.add(switchGroup);
          }

          // Horizontal separation reveal band (recessed behind the continuous +X oak board)
          if (tierIdx === 1) {
            const dividerReveal = new THREE.Mesh(
              new THREE.BoxGeometry(POD_W - 0.04, 0.022, POD_L - 0.04),
              capDarkTrimMat
            );
            dividerReveal.position.set(-0.01, 0, 0.015);
            podGroup.add(dividerReveal);
          }

          // 2. Square Front Capsule Facade & Hatch Facing Room Door (-Z)
          const facadeZ = -POD_L / 2;

          const frontBezel = new THREE.Mesh(podBezelGeo, capBezelMat);
          frontBezel.rotation.y = Math.PI; // Faces -Z toward the room door
          frontBezel.position.set(0, POD_H / 2, facadeZ + 0.048);
          frontBezel.castShadow = true;
          frontBezel.receiveShadow = true;
          podGroup.add(frontBezel);

          // Ice-blue LED perimeter ring framing the capsule hatch
          const ledFrame = new THREE.Mesh(podLedGeo, capLedMat);
          ledFrame.rotation.y = Math.PI;
          ledFrame.position.set(0, POD_H / 2, facadeZ + 0.010);
          podGroup.add(ledFrame);

          if (!isUpperOpen) {
            // Lower Capsule ('01'): Closed hatch door + frosted window + grab handle + handwritten 「雜物」 note
            const doorLeaf = new THREE.Mesh(podDoorGeo, capDoorMat);
            doorLeaf.rotation.y = Math.PI;
            doorLeaf.position.set(0, POD_H / 2, facadeZ + 0.036);
            doorLeaf.castShadow = true;
            doorLeaf.receiveShadow = true;
            podGroup.add(doorLeaf);

            const viewFrame = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.072, 0.42, 8, 14),
              capDarkTrimMat
            );
            viewFrame.scale.set(1.0, 1.0, 0.25);
            viewFrame.position.set(-0.18, POD_H / 2 + 0.02, facadeZ + 0.004);
            podGroup.add(viewFrame);

            const viewGlass = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.058, 0.39, 8, 14),
              capWindowMat
            );
            viewGlass.scale.set(1.0, 1.0, 0.22);
            viewGlass.position.set(-0.18, POD_H / 2 + 0.02, facadeZ + 0.001);
            podGroup.add(viewGlass);

            const doorHandle = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.011, 0.24, 6, 12),
              capMetalMat
            );
            doorHandle.position.set(0.28, POD_H / 2, facadeZ - 0.006);
            doorHandle.castShadow = true;
            podGroup.add(doorHandle);

            // Handwritten paper note 「雜物」 taped flat on lower pod door
            const zhaWuNoteMesh = new THREE.Mesh(
              new THREE.PlaneGeometry(0.25, 0.29),
              zhaWuNoteMat
            );
            zhaWuNoteMesh.rotation.y = Math.PI;
            zhaWuNoteMesh.rotation.z = 0.042;
            zhaWuNoteMesh.position.set(0.06, POD_H / 2 + 0.02, facadeZ + 0.0015);
            podGroup.add(zhaWuNoteMesh);

            const noteTape = new THREE.Mesh(
              new THREE.PlaneGeometry(0.085, 0.024),
              maskingTapeMat
            );
            noteTape.rotation.y = Math.PI;
            noteTape.rotation.z = -0.05;
            noteTape.position.set(0.054, POD_H / 2 + 0.165, facadeZ + 0.0005);
            podGroup.add(noteTape);
          } else {
            // Upper Capsule ('02'): Slid-open hatch pocket door panel tucked neatly on left edge, opening clearly into interior
            const openDoorPanel = new THREE.Mesh(podOpenDoorGeo, capDoorMat);
            openDoorPanel.rotation.y = Math.PI;
            openDoorPanel.position.set(-0.33, POD_H / 2, facadeZ + 0.036);
            openDoorPanel.castShadow = true;
            openDoorPanel.receiveShadow = true;
            podGroup.add(openDoorPanel);

            const openDoorHandle = new THREE.Mesh(
              new THREE.CapsuleGeometry(0.011, 0.24, 6, 12),
              capMetalMat
            );
            openDoorHandle.position.set(-0.235, POD_H / 2, facadeZ - 0.004);
            openDoorHandle.castShadow = true;
            podGroup.add(openDoorHandle);

            // Sleek brushed-aluminum upper/lower sliding door track rails
            [-0.43, 0.43].forEach((ty) => {
              const trackBar = new THREE.Mesh(
                new THREE.BoxGeometry(0.86, 0.012, 0.016),
                capMetalMat
              );
              trackBar.position.set(0, POD_H / 2 + ty, facadeZ + 0.022);
              podGroup.add(trackBar);
            });
          }

          // Digital keypad & glowing berth badge ("01" / "02") on front header & pillar
          const badgeMat = new THREE.MeshBasicMaterial({
            map: createCapsuleBadgeTex(podCode),
          });
          const berthBadge = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.055), badgeMat);
          berthBadge.rotation.y = Math.PI;
          berthBadge.position.set(0, POD_H - 0.088, facadeZ - 0.019);
          podGroup.add(berthBadge);

          const controlPad = new THREE.Mesh(
            new THREE.BoxGeometry(0.048, 0.085, 0.010),
            capDarkTrimMat
          );
          controlPad.position.set(0.51, POD_H / 2 + 0.05, facadeZ - 0.016);
          podGroup.add(controlPad);

          const padStatusDot = new THREE.Mesh(
            new THREE.SphereGeometry(0.007, 10, 8),
            capLedMat
          );
          padStatusDot.position.set(0.51, POD_H / 2 + 0.072, facadeZ - 0.022);
          podGroup.add(padStatusDot);

          // Lower ventilation grille louver strip
          const ventStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.42, 0.026, 0.012),
            capDarkTrimMat
          );
          ventStrip.position.set(0, 0.082, facadeZ - 0.014);
          podGroup.add(ventStrip);

          capsuleStackGroup.add(podGroup);
        });

        // Exposed +X Side Wall: One Continuous White-Oak Wooden Board (側面的整塊白橡木色木板)
        const oakSideBoard = new THREE.Mesh(
          new THREE.BoxGeometry(0.026, POD_H * 2 - 0.008, POD_L - 0.004),
          capWhiteOakMat
        );
        oakSideBoard.position.set(POD_W / 2 - 0.002, POD_H, 0.012);
        oakSideBoard.castShadow = true;
        oakSideBoard.receiveShadow = true;
        capsuleStackGroup.add(oakSideBoard);

        // Large Cork Bulletin Board (軟木佈告欄) on Outer +X Face of White-Oak Partition — light wood frame & light blue surface
        const CORK_OUTER_W = 2.72; // width
        const CORK_OUTER_H = 2.08; // height
        const CORK_BORDER = 0.044;
        const CORK_INNER_W = CORK_OUTER_W - CORK_BORDER * 2;
        const CORK_INNER_H = CORK_OUTER_H - CORK_BORDER * 2;

        const createKraftMonologueTexture = () => {
          const kc = document.createElement('canvas');
          kc.width = 512;
          kc.height = 700;
          const kctx = kc.getContext('2d');
          if (kctx) {
            kctx.fillStyle = '#f5e6cb';
            kctx.fillRect(0, 0, 512, 700);
            for (let i = 0; i < 2000; i++) {
              const x = (Math.sin(i * 13.5) * 0.5 + 0.5) * 512;
              const y = (Math.cos(i * 19.7) * 0.5 + 0.5) * 700;
              kctx.fillStyle = i % 2 === 0 ? 'rgba(180, 140, 100, 0.15)' : 'rgba(255, 255, 255, 0.2)';
              kctx.fillRect(x, y, 2 + (i % 3), 1);
            }
            kctx.fillStyle = '#452b14';
            kctx.font = 'bold 36px sans-serif';
            kctx.fillText('阿璃的獨白', 48, 72);
            kctx.font = '22px sans-serif';
            const lines = [
              '「……如果記憶也有形體，',
              '那麼它大概會像這間工作室一樣，',
              '被時間和光影細緻地包覆。',
              '',
              '每一張卡片、每一本書、每一杯溫茶，',
              '都是不願遺忘的證明。',
              '即使世界一直在流轉，',
              '這裡依舊為你保留了一方溫柔。」',
            ];
            let startY = 130;
            lines.forEach((line) => {
              kctx.fillText(line, 48, startY);
              startY += 38;
            });
          }
          const tex = new THREE.CanvasTexture(kc);
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = texMgr.maxAnisotropy;
          texMgr.registerTexture(tex);
          return tex;
        };

        const oakPosterTex = texMgr.loadTexture('/assets/capsule_oak_poster.webp');
        oakPosterTex.colorSpace = THREE.SRGBColorSpace;
        oakPosterTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(oakPosterTex);

        const corkColorCanvas = document.createElement('canvas');
        corkColorCanvas.width = 1024;
        corkColorCanvas.height = 768;
        const corkCtx = corkColorCanvas.getContext('2d');

        const corkBumpCanvas = document.createElement('canvas');
        corkBumpCanvas.width = 512;
        corkBumpCanvas.height = 384;
        const corkBCtx = corkBumpCanvas.getContext('2d');

        if (corkCtx && corkBCtx) {
          // 淺藍色底面 (Soft light blue bulletin board surface)
          corkCtx.fillStyle = '#dbeafe';
          corkCtx.fillRect(0, 0, 1024, 768);
          corkBCtx.fillStyle = '#808080';
          corkBCtx.fillRect(0, 0, 512, 384);

          const corkPalette = [
            'rgba(191, 219, 254, 0.55)',
            'rgba(219, 234, 254, 0.48)',
            'rgba(147, 197, 253, 0.40)',
            'rgba(224, 242, 254, 0.50)',
            'rgba(255, 255, 255, 0.35)',
          ];
          for (let i = 0; i < 9000; i++) {
            const cx = ((Math.sin(i * 17.13) * 0.5 + 0.5) * 1024);
            const cy = ((Math.cos(i * 29.71) * 0.5 + 0.5) * 768);
            const cw = 4 + (i % 6);
            const ch = 3 + ((i * 3) % 5);
            corkCtx.fillStyle = corkPalette[i % corkPalette.length];
            corkCtx.fillRect(cx, cy, cw, ch);

            corkBCtx.fillStyle = i % 2 === 0 ? '#b0b0b0' : '#707070';
            corkBCtx.fillRect(cx * 0.5, cy * 0.5, cw * 0.5, ch * 0.5);
          }

          // Subtle recessed shadow around inner cork perimeter
          const edgeShadow = corkCtx.createLinearGradient(0, 0, 0, 42);
          edgeShadow.addColorStop(0, 'rgba(30, 58, 138, 0.18)');
          edgeShadow.addColorStop(1, 'rgba(30, 58, 138, 0)');
          corkCtx.fillStyle = edgeShadow;
          corkCtx.fillRect(0, 0, 1024, 42);
        }

        const corkColorTex = new THREE.CanvasTexture(corkColorCanvas);
        corkColorTex.colorSpace = THREE.SRGBColorSpace;
        corkColorTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(corkColorTex);

        const corkBumpTex = new THREE.CanvasTexture(corkBumpCanvas);
        texMgr.registerTexture(corkBumpTex);

        const corkboardGroup = new THREE.Group();
        // 佈告欄下邊改為離地25公分 (0.25m). Corkboard center Y = 0.25 + CORK_OUTER_H / 2 = 0.25 + 1.04 = 1.29
        corkboardGroup.position.set(POD_W / 2 - 0.002 + 0.013, 0.25 + CORK_OUTER_H / 2, 0.012);
        corkboardGroup.rotation.y = Math.PI / 2;

        const corkFrameWoodMat = new THREE.MeshStandardMaterial({
          map: texMgr.getLightWoodBaseTex(),
          color: 0xf5eedc, // 淺白木色框 (Soft light whitish wood frame)
          roughness: 0.56,
          metalness: 0.04,
          envMapIntensity: 0.55,
        });
        const corkSurfaceMat = new THREE.MeshStandardMaterial({
          map: corkColorTex,
          bumpMap: corkBumpTex,
          bumpScale: 0.005,
          roughness: 0.90,
          metalness: 0.0,
          envMapIntensity: 0.32,
        });

        // Cork inner slab
        const corkBoardSlab = new THREE.Mesh(
          new THREE.BoxGeometry(CORK_INNER_W, CORK_INNER_H, 0.012),
          corkSurfaceMat
        );
        corkBoardSlab.position.z = 0.006;
        corkBoardSlab.receiveShadow = true;
        corkboardGroup.add(corkBoardSlab);

        // 4 Beveled Wooden Frame Rails around the Corkboard
        const frameTopBotGeo = new THREE.BoxGeometry(CORK_OUTER_W, CORK_BORDER, 0.020);
        [-1, 1].forEach((ySide) => {
          const rail = new THREE.Mesh(frameTopBotGeo, corkFrameWoodMat);
          rail.position.set(0, ySide * (CORK_OUTER_H / 2 - CORK_BORDER / 2), 0.010);
          rail.castShadow = true;
          rail.receiveShadow = true;
          corkboardGroup.add(rail);
        });
        const frameSideGeo = new THREE.BoxGeometry(CORK_BORDER, CORK_INNER_H, 0.020);
        [-1, 1].forEach((xSide) => {
          const rail = new THREE.Mesh(frameSideGeo, corkFrameWoodMat);
          rail.position.set(xSide * (CORK_OUTER_W / 2 - CORK_BORDER / 2), 0, 0.010);
          rail.castShadow = true;
          rail.receiveShadow = true;
          corkboardGroup.add(rail);
        });

        // Pushpin helper for items pinned on the corkboard
        const createPushPin = (colorHex: number) => {
          const pinGrp = new THREE.Group();
          const pinMat = new THREE.MeshPhysicalMaterial({
            color: colorHex,
            roughness: 0.28,
            metalness: 0.12,
            clearcoat: 0.6,
          });
          const head = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.005, 0.008, 12), pinMat);
          head.rotation.x = Math.PI / 2;
          head.position.z = 0.009;
          pinGrp.add(head);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 12), pinMat);
          cap.rotation.x = Math.PI / 2;
          cap.position.z = 0.013;
          pinGrp.add(cap);
          const needle = new THREE.Mesh(
            new THREE.CylinderGeometry(0.0012, 0.0012, 0.008, 8),
            new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.85, roughness: 0.2 })
          );
          needle.rotation.x = Math.PI / 2;
          needle.position.z = 0.004;
          pinGrp.add(needle);
          return pinGrp;
        };

        // 1. Exterior A3 Poster (297×420 mm) — 向左傾斜5度 (rotation.z = +0.087 rad) 移到牛皮紙右下角並稍微覆蓋
        const OAK_POSTER_W = 0.297; // A3 width
        const OAK_POSTER_H = 0.420; // A3 height
        const oakPosterGroup = new THREE.Group();
        // 30MS說明書海報移到牛皮紙右下角並在前面覆蓋部分角落
        oakPosterGroup.position.set(-0.50, 0.28, 0.023);
        oakPosterGroup.rotation.z = 0.087; // 向左傾斜5度 (+5 deg)

        const oakPosterMat = new THREE.MeshPhysicalMaterial({
          map: oakPosterTex,
          roughness: 0.42,
          metalness: 0.0,
          clearcoat: 0.24,
          clearcoatRoughness: 0.28,
          envMapIntensity: 0.55,
        });
        const oakPosterMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(OAK_POSTER_W, OAK_POSTER_H),
          oakPosterMat
        );
        oakPosterMesh.receiveShadow = true;
        oakPosterGroup.add(oakPosterMesh);

        // 4 subtle corner masking tape strips & top pushpins holding the A3 sheet flush against the corkboard
        const posterCorners: Array<[number, number, number]> = [
          [-OAK_POSTER_W / 2 + 0.014, OAK_POSTER_H / 2 - 0.005, 0.42],
          [OAK_POSTER_W / 2 - 0.014, OAK_POSTER_H / 2 - 0.005, -0.42],
          [-OAK_POSTER_W / 2 + 0.014, -OAK_POSTER_H / 2 + 0.005, -0.38],
          [OAK_POSTER_W / 2 - 0.014, -OAK_POSTER_H / 2 + 0.005, 0.38],
        ];
        posterCorners.forEach(([tx, ty, rz]) => {
          const cornerTape = new THREE.Mesh(
            new THREE.PlaneGeometry(0.042, 0.014),
            maskingTapeMat
          );
          cornerTape.position.set(tx, ty, 0.0009);
          cornerTape.rotation.z = rz;
          oakPosterGroup.add(cornerTape);
        });
        [-0.08, 0.08].forEach((px) => {
          const pPin = createPushPin(0x60a5fa);
          pPin.position.set(px, OAK_POSTER_H / 2 - 0.014, 0.001);
          oakPosterGroup.add(pPin);
        });
        corkboardGroup.add(oakPosterGroup);

        // 2. Kraft Paper Sheet with 「阿璃的獨白」 Text pinned on Corkboard (縮小一點移到左上角)
        const kraftPaperTex = createKraftMonologueTexture();
        const KRAFT_W = 0.38; // 縮小一點
        const KRAFT_H = 0.50; // 縮小一點
        const monologuePaperGroup = new THREE.Group();
        // 移到左上角 (relative to corkboard center)
        monologuePaperGroup.position.set(-0.68, 0.46, 0.017);
        monologuePaperGroup.rotation.z = 0.018;

        const kraftPaperMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(KRAFT_W, KRAFT_H),
          new THREE.MeshStandardMaterial({
            map: kraftPaperTex,
            roughness: 0.88,
            metalness: 0.0,
            envMapIntensity: 0.30,
          })
        );
        kraftPaperMesh.castShadow = true;
        kraftPaperMesh.receiveShadow = true;
        monologuePaperGroup.add(kraftPaperMesh);

        // Two red pushpins + top masking tape strip securing the kraft paper
        [-KRAFT_W / 2 + 0.045, KRAFT_W / 2 - 0.045].forEach((px) => {
          const pin = createPushPin(0xdc2626);
          pin.position.set(px, KRAFT_H / 2 - 0.018, 0.001);
          monologuePaperGroup.add(pin);
        });
        const topKraftTape = new THREE.Mesh(
          new THREE.PlaneGeometry(0.068, 0.016),
          maskingTapeMat
        );
        topKraftTape.position.set(0, KRAFT_H / 2 + 0.002, 0.0012);
        topKraftTape.rotation.z = -0.03;
        monologuePaperGroup.add(topKraftTape);

        // Invisible generous raycast hitbox for clicking the kraft paper
        const monologueHitbox = new THREE.Mesh(
          new THREE.BoxGeometry(KRAFT_W + 0.10, KRAFT_H + 0.10, 0.14),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        monologueHitbox.name = 'monologue_kraft_hitbox';
        monologueHitbox.position.set(0, 0, 0.03);
        refs.monologuePaperHitboxRef.current = monologueHitbox;
        monologuePaperGroup.add(monologueHitbox);

        corkboardGroup.add(monologuePaperGroup);

        // Small decorative pastel sticky notes & pins on left/bottom of corkboard for lived-in balance
        const decorNotes: Array<{ x: number; y: number; w: number; h: number; col: number; rz: number; pinCol: number }> = [
          { x: -0.92, y: 0.56, w: 0.17, h: 0.17, col: 0xfef08a, rz: -0.06, pinCol: 0xf472b6 },
          { x: -0.88, y: -0.22, w: 0.22, h: 0.16, col: 0xe0f2fe, rz: 0.05, pinCol: 0x38bdf8 },
          { x: 0.62, y: -0.44, w: 0.18, h: 0.18, col: 0xfce7f3, rz: -0.04, pinCol: 0xa855f7 },
        ];
        decorNotes.forEach((n) => {
          const noteMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(n.w, n.h),
            new THREE.MeshStandardMaterial({ color: n.col, roughness: 0.84, metalness: 0.0 })
          );
          noteMesh.position.set(n.x, n.y, 0.0135);
          noteMesh.rotation.z = n.rz;
          noteMesh.receiveShadow = true;
          corkboardGroup.add(noteMesh);

          const notePin = createPushPin(n.pinCol);
          notePin.position.set(n.x, n.y + n.h * 0.38, 0.014);
          corkboardGroup.add(notePin);
        });

        capsuleStackGroup.add(corkboardGroup);

        // Soft warm accent fill light illuminating the capsule side corkboard
        const corkboardFillLight = new THREE.PointLight(0xfff1e2, 0.44, 4.4, 1.15);
        corkboardFillLight.position.set(-2.45, 1.85, 1.96);
        coloredRoomGroup.add(corkboardFillLight);

        // 3. Brushed-Aluminum Front Hatch-Side Access Ladder to Upper Pod (位於艙門側的爬梯)
        const ladderGroup = new THREE.Group();
        ladderGroup.position.set(-0.45, 0, -POD_L / 2 - 0.072);

        [-0.11, 0.11].forEach((lx) => {
          const rail = new THREE.Mesh(
            new THREE.CylinderGeometry(0.013, 0.013, 1.66, 12),
            capMetalMat
          );
          rail.position.set(lx, 0.85, 0);
          rail.castShadow = true;
          ladderGroup.add(rail);

          // Horizontal standoffs bolting front ladder rails cleanly onto the capsule front frame
          [0.34, 1.18, 1.62].forEach((sy) => {
            const standoff = new THREE.Mesh(
              new THREE.CylinderGeometry(0.010, 0.010, 0.072, 10),
              capDarkTrimMat
            );
            standoff.rotation.x = Math.PI / 2;
            standoff.position.set(lx, sy, 0.036);
            ladderGroup.add(standoff);
          });
        });

        [0.28, 0.56, 0.84, 1.12, 1.40].forEach((ry) => {
          const rung = new THREE.Mesh(
            new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12),
            capDarkTrimMat
          );
          rung.rotation.z = Math.PI / 2;
          rung.position.set(0, ry, 0);
          rung.castShadow = true;
          ladderGroup.add(rung);
        });

        capsuleStackGroup.add(ladderGroup);
        coloredRoomGroup.add(capsuleStackGroup);

        // Four Lobby-style Six-Tier Cool White-Wood Cabinets (與格子櫃同色之冷白木色六層櫃×4) along Back Wall next to the bed
        const P_CAB_W = 1.12;
        const P_CAB_D = 0.44;
        const P_CAB_H = 2.16;
        const P_PLINTH_H = 0.08;
        const P_CROWN_H = 0.06;
        const P_SIDE_THICK = 0.036;
        const P_SHELF_THICK = 0.032;

        const cabLightWoodTex = texMgr.getCoolWhiteWoodBaseTex().clone();
        cabLightWoodTex.repeat.set(1.2, 1.6);
        cabLightWoodTex.needsUpdate = true;
        texMgr.registerTexture(cabLightWoodTex);

        const cabLightWoodTrimTex = texMgr.getCoolWhiteWoodBaseTex().clone();
        cabLightWoodTrimTex.repeat.set(1.4, 0.5);
        cabLightWoodTrimTex.needsUpdate = true;
        texMgr.registerTexture(cabLightWoodTrimTex);

        const lightCabBodyMat = new THREE.MeshStandardMaterial({
          map: cabLightWoodTex,
          color: 0xf8fafc,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.58,
        });
        const lightCabTrimMat = new THREE.MeshStandardMaterial({
          map: cabLightWoodTrimTex,
          color: 0xf1f5f9,
          roughness: 0.50,
          metalness: 0.02,
          envMapIntensity: 0.58,
        });
        const lightCabEdgeMat = new THREE.MeshStandardMaterial({
          map: cabLightWoodTex,
          color: 0xe7ecf2,
          roughness: 0.54,
          metalness: 0.02,
          envMapIntensity: 0.54,
        });
        const lightCabBackMat = new THREE.MeshStandardMaterial({
          map: cabLightWoodTex,
          color: 0xe3e8ef,
          roughness: 0.68,
          metalness: 0.01,
          envMapIntensity: 0.42,
        });

        const createLightWhiteSixTierCabinet = () => {
          const cab = new THREE.Group();

          const plinthCore = new THREE.Mesh(
            new THREE.BoxGeometry(P_CAB_W - 0.03, P_PLINTH_H, P_CAB_D - 0.03),
            lightCabEdgeMat
          );
          plinthCore.position.set(0, P_PLINTH_H / 2, -0.01);
          plinthCore.castShadow = true;
          plinthCore.receiveShadow = true;
          cab.add(plinthCore);

          const kickplate = new THREE.Mesh(
            new THREE.BoxGeometry(P_CAB_W + 0.01, P_PLINTH_H * 0.85, 0.024),
            lightCabTrimMat
          );
          kickplate.position.set(0, (P_PLINTH_H * 0.85) / 2, P_CAB_D / 2 - 0.008);
          cab.add(kickplate);

          const bodyHeight = P_CAB_H - P_PLINTH_H - P_CROWN_H;
          const sideGeo = new THREE.BoxGeometry(P_SIDE_THICK, bodyHeight, P_CAB_D);
          const stileGeo = new THREE.BoxGeometry(0.044, bodyHeight, 0.014);

          [-1, 1].forEach((side) => {
            const sx = side * (P_CAB_W / 2 - P_SIDE_THICK / 2);
            const sidePanel = new THREE.Mesh(sideGeo, lightCabBodyMat);
            sidePanel.position.set(sx, P_PLINTH_H + bodyHeight / 2, 0);
            sidePanel.castShadow = true;
            sidePanel.receiveShadow = true;
            cab.add(sidePanel);

            const frontStile = new THREE.Mesh(stileGeo, lightCabEdgeMat);
            frontStile.position.set(sx, P_PLINTH_H + bodyHeight / 2, P_CAB_D / 2 + 0.005);
            frontStile.castShadow = true;
            cab.add(frontStile);
          });

          const cabBack = new THREE.Mesh(
            new THREE.BoxGeometry(P_CAB_W - P_SIDE_THICK * 2 + 0.01, bodyHeight, 0.018),
            lightCabBackMat
          );
          cabBack.position.set(0, P_PLINTH_H + bodyHeight / 2, -P_CAB_D / 2 + 0.01);
          cabBack.receiveShadow = true;
          cab.add(cabBack);

          const innerSpanW = P_CAB_W - P_SIDE_THICK * 2;
          const shelfGeo = new THREE.BoxGeometry(innerSpanW, P_SHELF_THICK, P_CAB_D - 0.02);
          const shelfLipGeo = new THREE.BoxGeometry(innerSpanW, P_SHELF_THICK + 0.004, 0.014);
          const tierPitch = (bodyHeight - P_SHELF_THICK) / 6;

          for (let i = 0; i <= 6; i++) {
            const sy = P_PLINTH_H + P_SHELF_THICK / 2 + i * tierPitch;
            const shelf = new THREE.Mesh(shelfGeo, lightCabBodyMat);
            shelf.position.set(0, sy, 0.004);
            shelf.castShadow = true;
            shelf.receiveShadow = true;
            cab.add(shelf);

            const shelfLip = new THREE.Mesh(shelfLipGeo, lightCabEdgeMat);
            shelfLip.position.set(0, sy, P_CAB_D / 2 - 0.003);
            cab.add(shelfLip);
          }

          const lowerCrown = new THREE.Mesh(
            new THREE.BoxGeometry(P_CAB_W + 0.028, P_CROWN_H * 0.45, P_CAB_D + 0.022),
            lightCabEdgeMat
          );
          lowerCrown.position.set(0, P_CAB_H - P_CROWN_H + (P_CROWN_H * 0.45) / 2, 0.008);
          lowerCrown.castShadow = true;
          cab.add(lowerCrown);

          const upperCrown = new THREE.Mesh(
            new THREE.BoxGeometry(P_CAB_W + 0.06, P_CROWN_H * 0.55, P_CAB_D + 0.044),
            lightCabTrimMat
          );
          upperCrown.position.set(0, P_CAB_H - (P_CROWN_H * 0.55) / 2, 0.014);
          upperCrown.castShadow = true;
          cab.add(upperCrown);

          return cab;
        };

        const P_CAB_Z = PR_SIZE / 2 - 0.04 - 0.232;
        const P_CAB_FIRST_X = 2.0 - 0.04 - (P_CAB_W + 0.06) / 2 - 0.01;
        const P_CAB_STEP = P_CAB_W + 0.08;
        const { boxCardboardMat, boxFrontPrintMat, boxTopPrintMat, boxSeamEdgeMat } =
          getWhiteBoxMaterials(texMgr);
        for (let idx = 0; idx < 4; idx++) {
          const wallCab = createLightWhiteSixTierCabinet();
          wallCab.position.set(P_CAB_FIRST_X - idx * P_CAB_STEP, 0, P_CAB_Z);
          wallCab.rotation.y = Math.PI;

          // On the 4th cabinet (closest to capsule pods), place the identical "涼海すう" illustrated cardboard box on bottom-tier rightmost
          if (idx === 3) {
            const pWhiteBoxGroup = new THREE.Group();
            const pBoxCoreMesh = new THREE.Mesh(
              new THREE.BoxGeometry(BOX_W, BOX_H - 0.012, BOX_D),
              boxCardboardMat
            );
            pBoxCoreMesh.position.set(0, (BOX_H - 0.012) / 2, 0);
            pBoxCoreMesh.castShadow = true;
            pBoxCoreMesh.receiveShadow = true;
            pWhiteBoxGroup.add(pBoxCoreMesh);

            const pBoxFrontPlane = new THREE.Mesh(
              new THREE.PlaneGeometry(BOX_W - 0.004, BOX_H - 0.014),
              boxFrontPrintMat
            );
            pBoxFrontPlane.position.set(0, (BOX_H - 0.012) / 2, BOX_D / 2 + 0.0008);
            pBoxFrontPlane.receiveShadow = true;
            pWhiteBoxGroup.add(pBoxFrontPlane);

            const pBoxLidSlab = new THREE.Mesh(
              new THREE.BoxGeometry(BOX_W + 0.004, 0.012, BOX_D + 0.004),
              boxCardboardMat
            );
            pBoxLidSlab.position.set(0, BOX_H - 0.006, 0);
            pBoxLidSlab.castShadow = true;
            pBoxLidSlab.receiveShadow = true;
            pWhiteBoxGroup.add(pBoxLidSlab);

            const pBoxTopPlane = new THREE.Mesh(
              new THREE.PlaneGeometry(BOX_W + 0.002, BOX_D + 0.002),
              boxTopPrintMat
            );
            pBoxTopPlane.rotation.x = -Math.PI / 2;
            pBoxTopPlane.position.set(0, BOX_H + 0.0006, 0);
            pBoxTopPlane.receiveShadow = true;
            pWhiteBoxGroup.add(pBoxTopPlane);

            const pLidCreaseBar = new THREE.Mesh(
              new THREE.BoxGeometry(BOX_W + 0.005, 0.0025, 0.003),
              boxSeamEdgeMat
            );
            pLidCreaseBar.position.set(0, BOX_H - 0.012, BOX_D / 2 + 0.0015);
            pWhiteBoxGroup.add(pLidCreaseBar);

            const pCabInnerRightX = (P_CAB_W - P_SIDE_THICK * 2) / 2;
            const pBottomShelfFloorY = P_PLINTH_H + P_SHELF_THICK;
            pWhiteBoxGroup.position.set(
              pCabInnerRightX - 0.02 - BOX_W / 2,
              pBottomShelfFloorY,
              0.045
            );
            pWhiteBoxGroup.rotation.y = -0.025;
            wallCab.add(pWhiteBoxGroup);
          }

          // On the 1st cabinet (idx === 0), place 「最愛チアモ」 color box on 2nd tier leftmost & MISSY box on 3rd tier rightmost
          if (idx === 0) {
            const pCabInnerLeftX = -(P_CAB_W - P_SIDE_THICK * 2) / 2;
            const pCabInnerRightX = (P_CAB_W - P_SIDE_THICK * 2) / 2;
            const pBodyHeight = P_CAB_H - P_PLINTH_H - P_CROWN_H;
            const pTierPitch = (pBodyHeight - P_SHELF_THICK) / 6;
            const pThirdFromTopFloorY = P_PLINTH_H + P_SHELF_THICK + 3 * pTierPitch;
            const pSecondFromTopFloorY = P_PLINTH_H + P_SHELF_THICK + 4 * pTierPitch;

            // 2nd tier from top leftmost (local -X -> viewer's left)
            const pinkShelfChiamoGroup = createChiamoColorBoxGroup(texMgr);
            pinkShelfChiamoGroup.position.set(
              pCabInnerLeftX + 0.025 + CBOX_W / 2,
              pSecondFromTopFloorY,
              0.075
            );
            pinkShelfChiamoGroup.rotation.y = 0.06;
            wallCab.add(pinkShelfChiamoGroup);

            // 3rd tier from top rightmost (local +X -> viewer's right)
            missyBoxGroup.position.set(
              pCabInnerRightX - 0.025 - MISSY_W / 2,
              pThirdFromTopFloorY,
              0.085
            );
            missyBoxGroup.rotation.y = -0.14;
            wallCab.add(missyBoxGroup);
          }

          // On the 3rd cabinet (idx === 2), display the Sayuri CD flanked by 2 matching-size CDs on tabletop stands on 2nd tier from top
          if (idx === 2) {
            const pBodyHeight = P_CAB_H - P_PLINTH_H - P_CROWN_H;
            const pTierPitch = (pBodyHeight - P_SHELF_THICK) / 6;
            const pSecondFromTopFloorY = P_PLINTH_H + P_SHELF_THICK + 4 * pTierPitch;

            // Left of Sayuri CD (viewer's left = -X in wallCab local coordinates)
            const cdLeftDisplayGroup = createCdDisplayGroup('/assets/cd_bibideba_front.webp', 1.55);
            cdLeftDisplayGroup.position.set(-0.295, pSecondFromTopFloorY, 0.095);
            cdLeftDisplayGroup.rotation.y = 0.08;
            wallCab.add(cdLeftDisplayGroup);

            // Center Sayuri CD
            const cdDisplayGroup = createCdDisplayGroup('/assets/cd_cover_front.webp', 1.55);
            cdDisplayGroup.position.set(0, pSecondFromTopFloorY, 0.095);
            cdDisplayGroup.rotation.y = 0.06;
            wallCab.add(cdDisplayGroup);

            // Right of Sayuri CD (viewer's right = +X in wallCab local coordinates)
            const cdRightDisplayGroup = createCdDisplayGroup('/assets/cd_takaneko_front.webp', 1.55);
            cdRightDisplayGroup.position.set(0.295, pSecondFromTopFloorY, 0.095);
            cdRightDisplayGroup.rotation.y = -0.04;
            wallCab.add(cdRightDisplayGroup);
          }

          coloredRoomGroup.add(wallCab);
        }

        // Balanced cozy fill lights illuminating the 4 display cabinets & study desk nook
        const cabinetWallFillLight = new THREE.PointLight(0xfff0e2, 0.36, 6.2, 1.15);
        cabinetWallFillLight.position.set(-0.25, 2.05, 1.95);
        coloredRoomGroup.add(cabinetWallFillLight);

        const deskCozyFillLight = new THREE.PointLight(0xffefe4, 0.28, 4.0, 1.15);
        deskCozyFillLight.position.set(1.38, 2.22, -2.85);
        coloredRoomGroup.add(deskCozyFillLight);

        // 5 Wall Posters taped on Front Wall above the Study Desk: 1 A1 + 2 A3 + 2 A4 (書桌前牆面海報組)
        const deskWallPostersGroup = new THREE.Group();
        const DESK_WALL_Z = -PR_SIZE / 2 + 0.004;

        const createDeskWallPoster = (opts: {
          texPath: string;
          w: number;
          h: number;
          x: number;
          y: number;
          rotZ: number;
          isCutoutParchment?: boolean;
          tapeInsetX?: number;
          tapeInsetY?: number;
          tapeW?: number;
          tapeH?: number;
          uvRepeatY?: number;
          uvOffsetY?: number;
        }) => {
          const pTex = texMgr.loadTexture(opts.texPath);
          pTex.colorSpace = THREE.SRGBColorSpace;
          pTex.anisotropy = texMgr.maxAnisotropy;
          if (opts.uvRepeatY !== undefined) {
            pTex.repeat.set(1, opts.uvRepeatY);
            pTex.offset.set(0, opts.uvOffsetY ?? (1 - opts.uvRepeatY) / 2);
          }
          texMgr.registerTexture(pTex);

          const pGroup = new THREE.Group();
          pGroup.position.set(opts.x, opts.y, DESK_WALL_Z);
          pGroup.rotation.z = opts.rotZ;

          const pMat = opts.isCutoutParchment
            ? new THREE.MeshStandardMaterial({
                map: pTex,
                transparent: true,
                alphaTest: 0.35,
                roughness: 0.78,
                metalness: 0.0,
                envMapIntensity: 0.26,
              })
            : new THREE.MeshPhysicalMaterial({
                map: pTex,
                roughness: 0.44,
                metalness: 0.0,
                clearcoat: 0.18,
                clearcoatRoughness: 0.30,
                envMapIntensity: 0.34,
              });

          const pMesh = new THREE.Mesh(
            new THREE.PlaneGeometry(opts.w, opts.h),
            pMat
          );
          pMesh.receiveShadow = true;
          pGroup.add(pMesh);

          const ix = opts.tapeInsetX ?? 0.015;
          const iy = opts.tapeInsetY ?? 0.005;
          const tw = opts.tapeW ?? 0.038;
          const th = opts.tapeH ?? 0.013;
          const tapeCorners: Array<[number, number, number]> = [
            [-opts.w / 2 + ix, opts.h / 2 - iy, 0.40],
            [opts.w / 2 - ix, opts.h / 2 - iy, -0.40],
            [-opts.w / 2 + ix, -opts.h / 2 + iy, -0.36],
            [opts.w / 2 - ix, -opts.h / 2 + iy, 0.36],
          ];
          tapeCorners.forEach(([tx, ty, rz]) => {
            const tapeStrip = new THREE.Mesh(
              new THREE.PlaneGeometry(tw, th),
              maskingTapeMat
            );
            tapeStrip.position.set(tx, ty, 0.0008);
            tapeStrip.rotation.z = rz;
            pGroup.add(tapeStrip);
          });

          deskWallPostersGroup.add(pGroup);
        };

        // Shared anchor edges for crisp alignment & corner nesting (shifted up/right near corner & ceiling)
        const POSTER_GAP = 0.044;
        const WANTED_W = 0.612; // A1 scale (433:577 ratio, area = 0.50 m^2)
        const WANTED_H = 0.816;
        const WANTED_RIGHT = 1.925;
        const WANTED_TOP = 2.890;
        const WANTED_LEFT = WANTED_RIGHT - WANTED_W; // 1.313
        const WANTED_BOT = WANTED_TOP - WANTED_H;   // 2.074

        // 1. すう的通緝照片 (A1) — 偏右上角牆上
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a2.webp',
          w: WANTED_W,
          h: WANTED_H,
          x: WANTED_RIGHT - WANTED_W / 2,
          y: WANTED_TOP - WANTED_H / 2,
          rotZ: 0,
          isCutoutParchment: true,
          tapeInsetX: 0.102,
          tapeInsetY: 0.034,
          tapeW: 0.048,
          tapeH: 0.016,
        });

        // 2. 眼鏡少女 (A3) — すう的通緝照片下方，靠右對齊
        const GLASSES_GIRL_W = 0.292;
        const GLASSES_GIRL_H = 0.427;
        const GLASSES_GIRL_LEFT = WANTED_RIGHT - GLASSES_GIRL_W; // 1.598
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a3_1.webp',
          w: GLASSES_GIRL_W,
          h: GLASSES_GIRL_H,
          x: WANTED_RIGHT - GLASSES_GIRL_W / 2,
          y: WANTED_BOT - POSTER_GAP - GLASSES_GIRL_H / 2,
          rotZ: 0,
        });

        // 3. 黑眼鏡 (A4) — すう的通緝照片左邊，靠上對齊
        const BLACK_GLASSES_W = 0.216;
        const BLACK_GLASSES_H = 0.288;
        const BLACK_GLASSES_BOT = WANTED_TOP - BLACK_GLASSES_H; // 2.072
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a4_2.jpg',
          w: BLACK_GLASSES_W,
          h: BLACK_GLASSES_H,
          x: WANTED_LEFT - POSTER_GAP - BLACK_GLASSES_W / 2,
          y: WANTED_TOP - BLACK_GLASSES_H / 2,
          rotZ: 0,
        });

        // 4. 原涼海雨傘照片位替換為新海報 (A3: 751x1023) — 黑眼鏡跟通緝すう的夾角
        const NEW_POSTER_W = 0.303;
        const NEW_POSTER_H = 0.412;
        const NEW_POSTER_BOT = BLACK_GLASSES_BOT - POSTER_GAP - NEW_POSTER_H; // 1.616
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a3_2.jpg',
          w: NEW_POSTER_W,
          h: NEW_POSTER_H,
          x: WANTED_LEFT - POSTER_GAP - NEW_POSTER_W / 2,
          y: BLACK_GLASSES_BOT - POSTER_GAP - NEW_POSTER_H / 2,
          rotZ: 0,
        });

        // 5. Cos照片 (A4) — 眼鏡少女跟涼海すう的通緝照片的夾角之間
        const COS_W = 0.216;
        const COS_H = 0.288;
        const COS_LEFT = GLASSES_GIRL_LEFT - POSTER_GAP - COS_W; // 1.338
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a4_1.jpg',
          w: COS_W,
          h: COS_H,
          x: GLASSES_GIRL_LEFT - POSTER_GAP - COS_W / 2,
          y: WANTED_BOT - POSTER_GAP - COS_H / 2,
          rotZ: 0,
        });

        // 6. A3橫海報 (1364x768 16:9 A3 area) — 新替換海報與 Cos 照夾角之間
        const A3_LAND_W = 0.470;
        const A3_LAND_H = 0.265;
        const A3_LAND_RIGHT = COS_LEFT - POSTER_GAP;
        const A3_LAND_LEFT = A3_LAND_RIGHT - A3_LAND_W;
        const A3_LAND_BOT = NEW_POSTER_BOT - POSTER_GAP - A3_LAND_H;
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a3_land.jpg',
          w: A3_LAND_W,
          h: A3_LAND_H,
          x: A3_LAND_LEFT + A3_LAND_W / 2,
          y: A3_LAND_BOT + A3_LAND_H / 2,
          rotZ: 0,
        });

        // 8 & 9. 4×6小卡 移至 A3橫下方靠右對齊，白底少女插畫 A4直海報隨之一起向右移到小卡左側
        const A4_VERT_W = 0.169;
        const A4_VERT_H = 0.368;
        const A4_VERT_TOP = A3_LAND_BOT - POSTER_GAP;
        const A4_VERT_BOT = A4_VERT_TOP - A4_VERT_H;
        const CARD_4X6_W = 0.166;
        const CARD_4X6_H = 0.093;
        const CARD_4X6_LEFT = A3_LAND_RIGHT - CARD_4X6_W;
        const A4_VERT_RIGHT = CARD_4X6_LEFT - POSTER_GAP;
        const A4_VERT_LEFT = A4_VERT_RIGHT - A4_VERT_W;

        // 7. 小七夕籤 (615x2048 狹長直條) — 移至白底少女插畫的左邊，靠下對齊
        const TANZAKU_W = 0.090;
        const TANZAKU_H = 0.300;
        createDeskWallPoster({
          texPath: '/assets/desk_poster_tanzaku.jpg',
          w: TANZAKU_W,
          h: TANZAKU_H,
          x: A4_VERT_LEFT - POSTER_GAP - TANZAKU_W / 2,
          y: A4_VERT_BOT + TANZAKU_H / 2,
          rotZ: 0,
          tapeInsetX: 0.011,
          tapeInsetY: 0.004,
          tapeW: 0.022,
          tapeH: 0.008,
        });

        // 8. A4直白底少女插畫海報 (1080x2348 直幅插畫, A4 area = 0.0622 m^2)
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a4_vert.jpg',
          w: A4_VERT_W,
          h: A4_VERT_H,
          x: A4_VERT_RIGHT - A4_VERT_W / 2,
          y: A4_VERT_TOP - A4_VERT_H / 2,
          rotZ: 0,
          tapeInsetX: 0.013,
          tapeInsetY: 0.005,
          tapeW: 0.032,
          tapeH: 0.011,
        });

        // 9. 4×6小卡 (972x547 16:9 海洋鯨魚寫真, 4×6 inch area) — A3橫下方靠右對齊
        createDeskWallPoster({
          texPath: '/assets/desk_poster_4x6.jpg',
          w: CARD_4X6_W,
          h: CARD_4X6_H,
          x: A3_LAND_RIGHT - CARD_4X6_W / 2,
          y: A4_VERT_TOP - CARD_4X6_H / 2,
          rotZ: 0,
          tapeInsetX: 0.011,
          tapeInsetY: 0.004,
          tapeW: 0.026,
          tapeH: 0.009,
        });

        // 10. 應援棒舞台照 (寬度 = 整張4×6小卡 + Cos照的一半寬 = 0.274m，保持標準 A4 1:√2 比例) — 擺在小卡跟 Cos 照片下方
        const BELOW_A4_W = Number((CARD_4X6_W + COS_W / 2).toFixed(3)); // 0.274m
        const BELOW_A4_H = Number((BELOW_A4_W * Math.SQRT2).toFixed(3)); // 0.387m
        const CARD_BOT = A4_VERT_TOP - CARD_4X6_H;
        const COS_BOT = WANTED_BOT - POSTER_GAP - COS_H;
        const COS_RIGHT = GLASSES_GIRL_LEFT - POSTER_GAP;
        const BELOW_A4_LEFT = CARD_4X6_LEFT;
        const BELOW_A4_CENTER_X = BELOW_A4_LEFT + BELOW_A4_W / 2;
        const BELOW_A4_TOP = Math.min(CARD_BOT, COS_BOT) - POSTER_GAP;
        const belowUvRepeatY = Math.SQRT2 / (1567 / 1044); // ~0.9422 (zero distortion)
        createDeskWallPoster({
          texPath: '/assets/desk_poster_a4_land_below.jpg',
          w: BELOW_A4_W,
          h: BELOW_A4_H,
          x: BELOW_A4_CENTER_X,
          y: BELOW_A4_TOP - BELOW_A4_H / 2,
          rotZ: 0,
          uvRepeatY: belowUvRepeatY,
          uvOffsetY: (1 - belowUvRepeatY) / 2,
        });

        coloredRoomGroup.add(deskWallPostersGroup);

        // Light-Blue Studio Softbox Light on Tripod Stand positioned between 4th Cabinet and Capsule Pods, turned toward the Desk (朝向書桌方向)
        const studioLightGroup = new THREE.Group();
        studioLightGroup.position.set(-3.295, 0, P_CAB_Z - 0.19);
        studioLightGroup.rotation.y = Math.PI - 0.56;

        const studioBlueMat = new THREE.MeshPhysicalMaterial({
          color: 0x90ccf2,
          roughness: 0.36,
          metalness: 0.14,
          clearcoat: 0.25,
          envMapIntensity: 0.85,
        });
        const studioBlueDeepMat = new THREE.MeshStandardMaterial({
          color: 0x6fb4e3,
          roughness: 0.38,
          metalness: 0.20,
          envMapIntensity: 0.90,
        });
        const studioChromeMat = new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.18,
          metalness: 0.90,
          envMapIntensity: 1.40,
        });
        const studioDarkMat = new THREE.MeshStandardMaterial({
          color: 0x334155,
          roughness: 0.56,
          metalness: 0.24,
          envMapIntensity: 0.65,
        });
        const studioDiffuserMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xfff3e2,
          emissiveIntensity: 0.18,
          roughness: 0.42,
          metalness: 0.0,
        });

        // 3 Splayed Tripod Legs with Spider Braces & Floor Rubber Feet
        const LEG_HUB_Y = 0.54;
        const LEG_SPREAD_R = 0.29;
        for (let li = 0; li < 3; li++) {
          const ang = (li * Math.PI * 2) / 3 + Math.PI / 6;
          const fx = Math.cos(ang) * LEG_SPREAD_R;
          const fz = Math.sin(ang) * LEG_SPREAD_R;

          const startPt = new THREE.Vector3(Math.cos(ang) * 0.026, LEG_HUB_Y, Math.sin(ang) * 0.026);
          const endPt = new THREE.Vector3(fx, 0.016, fz);
          const legDir = new THREE.Vector3().subVectors(endPt, startPt);
          const legLen = legDir.length();
          const legQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), legDir.clone().normalize());
          const legTube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.010, legLen, 12), studioBlueMat);
          legTube.position.addVectors(startPt, endPt).multiplyScalar(0.5);
          legTube.quaternion.copy(legQuat);
          legTube.castShadow = true;
          studioLightGroup.add(legTube);

          // Rubber floor tip grounded cleanly at Y = 0
          const footCap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.028, 12), studioDarkMat);
          footCap.position.set(fx, 0.014, fz);
          footCap.castShadow = true;
          studioLightGroup.add(footCap);

          // Central diagonal spider brace
          const braceStart = new THREE.Vector3(0, 0.23, 0);
          const braceEnd = new THREE.Vector3().lerpVectors(startPt, endPt, 0.48);
          const braceDir = new THREE.Vector3().subVectors(braceEnd, braceStart);
          const braceMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.006, 0.006, braceDir.length(), 8),
            studioChromeMat
          );
          braceMesh.position.addVectors(braceStart, braceEnd).multiplyScalar(0.5);
          braceMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), braceDir.normalize());
          studioLightGroup.add(braceMesh);
        }

        // Central Telescoping Stand Pole & Collars
        const lowerHub = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.045, 16), studioBlueDeepMat);
        lowerHub.position.y = 0.23;
        studioLightGroup.add(lowerHub);

        const upperLegCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.030, 0.056, 16), studioBlueDeepMat);
        upperLegCollar.position.y = LEG_HUB_Y;
        upperLegCollar.castShadow = true;
        studioLightGroup.add(upperLegCollar);

        const lowerPole = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.80, 14), studioBlueMat);
        lowerPole.position.y = 0.62;
        lowerPole.castShadow = true;
        studioLightGroup.add(lowerPole);

        const midClutch = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.046, 14), studioBlueDeepMat);
        midClutch.position.y = 1.02;
        studioLightGroup.add(midClutch);

        const midKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.028, 12), studioChromeMat);
        midKnob.rotation.z = Math.PI / 2;
        midKnob.position.set(0.028, 1.02, 0);
        studioLightGroup.add(midKnob);

        const upperMast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.44, 14), studioChromeMat);
        upperMast.position.y = 1.24;
        upperMast.castShadow = true;
        studioLightGroup.add(upperMast);

        // Tilted U-Bracket Yoke + Softbox Studio Light Head
        const yokeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.018, 0.04, 14), studioBlueDeepMat);
        yokeBase.position.y = 1.46;
        studioLightGroup.add(yokeBase);

        const yokeBar = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.018, 0.028), studioBlueDeepMat);
        yokeBar.position.y = 1.485;
        studioLightGroup.add(yokeBar);

        [-0.15, 0.15].forEach((ax) => {
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.14, 0.026), studioBlueDeepMat);
          arm.position.set(ax, 1.545, 0);
          studioLightGroup.add(arm);

          const tiltKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.024, 12), studioBlueMat);
          tiltKnob.rotation.z = Math.PI / 2;
          tiltKnob.position.set(ax + (ax > 0 ? 0.018 : -0.018), 1.60, 0);
          studioLightGroup.add(tiltKnob);
        });

        const softboxHead = new THREE.Group();
        softboxHead.position.set(0, 1.60, 0.02);
        softboxHead.rotation.x = 0.16; // Slight downward aim into room

        // Tapered Rectangular Softbox Hood (built from frustum-like prism via scaled 4-sided CylinderGeometry rotated 45deg)
        const SB_W = 0.56;
        const SB_H = 0.42;
        const SB_D = 0.25;
        const softboxShellGeo = new THREE.CylinderGeometry(0.5, 0.20, SB_D, 4, 1);
        softboxShellGeo.rotateY(Math.PI / 4);
        softboxShellGeo.scale(SB_W / Math.SQRT1_2, 1.0, SB_H / Math.SQRT1_2);
        softboxShellGeo.rotateX(Math.PI / 2);
        const softboxShell = new THREE.Mesh(softboxShellGeo, studioBlueMat);
        softboxShell.position.z = 0.03;
        softboxShell.castShadow = true;
        softboxShell.receiveShadow = true;
        softboxHead.add(softboxShell);

        // Front Softbox Bezel Frame & Glowing White Diffuser Cloth
        const frontOuterRim = new THREE.Mesh(
          new THREE.BoxGeometry(SB_W + 0.018, SB_H + 0.018, 0.022),
          studioBlueDeepMat
        );
        frontOuterRim.position.z = SB_D / 2 + 0.03;
        softboxHead.add(frontOuterRim);

        const frontDiffuser = new THREE.Mesh(
          new THREE.BoxGeometry(SB_W - 0.022, SB_H - 0.022, 0.016),
          studioDiffuserMat
        );
        frontDiffuser.position.z = SB_D / 2 + 0.036;
        softboxHead.add(frontDiffuser);

        // Rear Ventilated Light-Blue Lamp Housing + Control Switch
        const rearLampHousing = new THREE.Mesh(
          new THREE.CylinderGeometry(0.088, 0.082, 0.16, 20),
          studioBlueDeepMat
        );
        rearLampHousing.rotation.x = Math.PI / 2;
        rearLampHousing.position.z = -SB_D / 2 - 0.04;
        rearLampHousing.castShadow = true;
        softboxHead.add(rearLampHousing);

        const rearCap = new THREE.Mesh(
          new THREE.CylinderGeometry(0.068, 0.088, 0.035, 20),
          studioBlueMat
        );
        rearCap.rotation.x = Math.PI / 2;
        rearCap.position.z = -SB_D / 2 - 0.135;
        softboxHead.add(rearCap);

        const rearVentRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.072, 0.008, 8, 20),
          studioDarkMat
        );
        rearVentRing.position.z = -SB_D / 2 - 0.115;
        softboxHead.add(rearVentRing);

        // Warm Studio Fill + Targeted Key SpotLight aimed toward Study Desk & Chair
        const studioSpotGlow = new THREE.PointLight(0xfff1e0, 0.32, 4.5, 1.15);
        studioSpotGlow.position.set(0, 0, SB_D / 2 + 0.24);
        softboxHead.add(studioSpotGlow);

        const studioKeySpot = new THREE.SpotLight(0xfff3e5, 1.05, 8.0, Math.PI * 0.28, 0.72, 1.12);
        studioKeySpot.position.set(0, 0, SB_D / 2 + 0.08);
        studioKeySpot.target.position.set(1.22, 0.74, -2.82);
        softboxHead.add(studioKeySpot);
        coloredRoomGroup.add(studioKeySpot.target);

        studioLightGroup.add(softboxHead);
        coloredRoomGroup.add(studioLightGroup);

        // Cozy Blue-Gray Beanbag Chair placed in front of the 1st Cabinet (第一個櫃子前方的藍灰色懶骨頭)
        const beanbagTexCanvas = document.createElement('canvas');
        beanbagTexCanvas.width = 256;
        beanbagTexCanvas.height = 256;
        const bbCtx = beanbagTexCanvas.getContext('2d');
        if (bbCtx) {
          bbCtx.fillStyle = '#6f859c';
          bbCtx.fillRect(0, 0, 256, 256);
          for (let y = 0; y < 256; y += 3) {
            bbCtx.fillStyle = y % 6 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(28,42,58,0.07)';
            bbCtx.fillRect(0, y, 256, 1.5);
          }
          for (let x = 0; x < 256; x += 3) {
            bbCtx.fillStyle = x % 6 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(28,42,58,0.06)';
            bbCtx.fillRect(x, 0, 1.5, 256);
          }
          for (let i = 0; i < 900; i++) {
            const rx = (i * 73) % 256;
            const ry = (i * 139) % 256;
            bbCtx.fillStyle = i % 2 === 0 ? 'rgba(195,215,232,0.08)' : 'rgba(42,58,74,0.08)';
            bbCtx.fillRect(rx, ry, 2, 2);
          }
        }
        const beanbagFabricTex = new THREE.CanvasTexture(beanbagTexCanvas);
        beanbagFabricTex.colorSpace = THREE.SRGBColorSpace;
        beanbagFabricTex.wrapS = THREE.RepeatWrapping;
        beanbagFabricTex.wrapT = THREE.RepeatWrapping;
        beanbagFabricTex.repeat.set(3.2, 3.2);
        texMgr.registerTexture(beanbagFabricTex);

        const beanbagMat = new THREE.MeshPhysicalMaterial({
          map: beanbagFabricTex,
          color: 0xffffff,
          roughness: 0.92,
          metalness: 0.0,
          sheen: 0.80,
          sheenRoughness: 0.70,
          sheenColor: new THREE.Color(0xc5d8ea),
          envMapIntensity: 0.35,
        });
        const beanbagSeamMat = new THREE.MeshStandardMaterial({
          color: 0x586d82,
          roughness: 0.90,
          metalness: 0.01,
          envMapIntensity: 0.36,
        });

        // 稍微放大懶骨頭跟地毯尺寸
        const beanbagGroup = new THREE.Group();
        const BB_R = 0.48;
        const bbGeo = new THREE.SphereGeometry(BB_R, 32, 24); // 放大懶骨頭尺寸
        const bbPos = bbGeo.attributes.position;
        for (let i = 0; i < bbPos.count; i++) {
          let x = bbPos.getX(i);
          const y = bbPos.getY(i);
          let z = bbPos.getZ(i);

          // Normalize vertically across [0, 1] for BB_R = 0.48, then flatten base & sculpt organic teardrop slouch
          const ny = THREE.MathUtils.clamp((y + BB_R) / (BB_R * 2), 0, 1); // 0 at bottom, 1 at top
          const rHoriz = Math.hypot(x, z);
          const angle = Math.atan2(z, x);

          // Wider plumped lower cushion skirt, tapering softly toward upper peak
          const skirtFactor = 1.06 - Math.pow(ny, 1.45) * 0.44 + Math.sin(ny * Math.PI) * 0.14;
          x *= skirtFactor;
          z *= skirtFactor * 1.04;

          // Subtle 6-panel stitched seam creases around perimeter
          const goreRipple = 1.0 - 0.022 * Math.pow(Math.abs(Math.sin(angle * 3.0)), 3.0) * Math.sin(ny * Math.PI);
          x *= goreRipple;
          z *= goreRipple;

          // Slouching backrest peak toward -Z local rear, cozy sunken seat hollow toward +Z front
          let sculptedY = ny * 0.56;
          if (ny < 0.14) {
            // Flat grounded base pad
            sculptedY = ny * 0.22;
          } else {
            // Backrest rise & forward seat dimple (seat faces +Z)
            const nz = z / BB_R;
            const seatDip = Math.max(0, nz + 0.12) * Math.sin(ny * Math.PI) * 0.11;
            const backPeak = Math.max(0, -nz + 0.18) * Math.pow(ny, 1.35) * 0.17;
            const radialDamp = Math.min(1, rHoriz / 0.28);
            sculptedY = sculptedY - seatDip * (1.0 - 0.35 * radialDamp) + backPeak;
          }
          z -= Math.pow(ny, 1.6) * 0.10;

          bbPos.setXYZ(i, x, Math.max(0, sculptedY), z);
        }
        bbPos.needsUpdate = true;
        bbGeo.computeVertexNormals();
        bbGeo.computeBoundingBox();
        bbGeo.computeBoundingSphere();

        const bbBodyMesh = new THREE.Mesh(bbGeo, beanbagMat);
        bbBodyMesh.castShadow = true;
        bbBodyMesh.receiveShadow = true;
        beanbagGroup.add(bbBodyMesh);

        // Stitched upper piping ring & fabric carry handle loop at backrest crown
        const bbPipingRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.165, 0.0085, 8, 28),
          beanbagSeamMat
        );
        bbPipingRing.rotation.x = Math.PI / 2 - 0.24;
        bbPipingRing.position.set(0, 0.515, -0.095);
        beanbagGroup.add(bbPipingRing);

        const bbHandleLoop = new THREE.Mesh(
          new THREE.TorusGeometry(0.034, 0.0085, 8, 16, Math.PI),
          beanbagSeamMat
        );
        bbHandleLoop.position.set(0, 0.582, -0.108);
        bbHandleLoop.rotation.x = -0.25;
        bbHandleLoop.castShadow = true;
        beanbagGroup.add(bbHandleLoop);

        // 地毯移到懶骨頭右前方 櫃子前面一點的位置 並放大尺寸
        beanbagGroup.position.set(1.15, 0, 1.85); // 移近櫃子前方
        beanbagGroup.rotation.y = Math.PI + 0.38;
        coloredRoomGroup.add(beanbagGroup);

        // Light-Blue Short-Pile Round Rug (地毯移到懶骨頭右前方 櫃子前面一點的位置 並放大尺寸)
        const rugColorCanvas = document.createElement('canvas');
        rugColorCanvas.width = 512;
        rugColorCanvas.height = 512;
        const rugCtx = rugColorCanvas.getContext('2d');

        const rugBumpCanvas = document.createElement('canvas');
        rugBumpCanvas.width = 512;
        rugBumpCanvas.height = 512;
        const rugBCtx = rugBumpCanvas.getContext('2d');

        if (rugCtx && rugBCtx) {
          const radGrad = rugCtx.createRadialGradient(256, 256, 20, 256, 256, 260);
          radGrad.addColorStop(0.0, '#c6e7fa');
          radGrad.addColorStop(0.65, '#bae0f6');
          radGrad.addColorStop(1.0, '#add6ef');
          rugCtx.fillStyle = radGrad;
          rugCtx.fillRect(0, 0, 512, 512);

          rugBCtx.fillStyle = '#808080';
          rugBCtx.fillRect(0, 0, 512, 512);

          for (let i = 0; i < 16000; i++) {
            const fx = (i * 197 + (i % 7) * 13) % 512;
            const fy = (i * 313 + (i % 11) * 17) % 512;
            const light = i % 3 === 0;
            rugCtx.fillStyle = light
              ? 'rgba(236, 249, 255, 0.34)'
              : i % 2 === 0
                ? 'rgba(138, 194, 228, 0.28)'
                : 'rgba(176, 222, 246, 0.25)';
            rugCtx.fillRect(fx, fy, 2.2, 1.8);

            rugBCtx.fillStyle = light ? '#b8b8b8' : '#555555';
            rugBCtx.fillRect(fx, fy, 2, 2);
          }
        }
        const rugColorTex = new THREE.CanvasTexture(rugColorCanvas);
        rugColorTex.colorSpace = THREE.SRGBColorSpace;
        rugColorTex.anisotropy = texMgr.maxAnisotropy;
        texMgr.registerTexture(rugColorTex);

        const rugBumpTex = new THREE.CanvasTexture(rugBumpCanvas);
        rugBumpTex.wrapS = THREE.RepeatWrapping;
        rugBumpTex.wrapT = THREE.RepeatWrapping;
        rugBumpTex.repeat.set(2.5, 2.5);
        texMgr.registerTexture(rugBumpTex);

        const centerRugGroup = new THREE.Group();
        const RUG_R = 1.35; // 放大地毯尺寸 (from 1.12 to 1.35)

        const rugBacking = new THREE.Mesh(
          new THREE.CylinderGeometry(RUG_R, RUG_R, 0.008, 64),
          new THREE.MeshStandardMaterial({ color: 0x9ac3dc, roughness: 0.92 })
        );
        rugBacking.position.y = 0.004;
        rugBacking.receiveShadow = true;
        centerRugGroup.add(rugBacking);

        const rugPileMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(RUG_R - 0.006, RUG_R - 0.002, 0.012, 64),
          new THREE.MeshPhysicalMaterial({
            map: rugColorTex,
            bumpMap: rugBumpTex,
            bumpScale: 0.004,
            color: 0xffffff,
            roughness: 0.95,
            metalness: 0.0,
            sheen: 0.92,
            sheenRoughness: 0.68,
            sheenColor: new THREE.Color(0xeaf7ff),
            envMapIntensity: 0.34,
          })
        );
        rugPileMesh.position.y = 0.014;
        rugPileMesh.receiveShadow = true;
        centerRugGroup.add(rugPileMesh);

        // Overlocked bound edge trim ring around the circular short-pile rug
        const rugBoundEdge = new THREE.Mesh(
          new THREE.TorusGeometry(RUG_R - 0.004, 0.010, 10, 72),
          new THREE.MeshStandardMaterial({
            color: 0xdaf0fc,
            roughness: 0.90,
            metalness: 0.0,
            envMapIntensity: 0.35,
          })
        );
        rugBoundEdge.rotation.x = Math.PI / 2;
        rugBoundEdge.scale.set(1.0, 1.0, 0.65);
        rugBoundEdge.position.y = 0.013;
        rugBoundEdge.receiveShadow = true;
        centerRugGroup.add(rugBoundEdge);

        // 地毯往右前方拉一點 (X = 0.54, Z = 1.44)，讓整張圓形地毯完整落在地上不穿牆也不撞櫃子
        centerRugGroup.position.set(0.54, 0, 1.44);
        coloredRoomGroup.add(centerRugGroup);

  return coloredRoomGroup;
}
