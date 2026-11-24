import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { X } from 'lucide-react';
import { EventCalendar, CATEGORY_COLORS, getEventsForDate } from './EventCalendar';
import { EscalatorMonologueSubpage, MONOLOGUE_TEXT } from './EscalatorMonologueSubpage';
import {
  RoomId,
  ExtraRoomId,
  ViewLocation,
  ROOM_WIDTH,
  ROOM_HEIGHT,
  ROOM_DEPTH,
  TABLE_DEPTH,
  TABLE_HEIGHT,
  SEATED_HEIGHT,
  SEATED_Z,
  PR_SIZE,
  PR_HEIGHT,
  PR_CENTER_X,
  CY_WIDTH,
  CY_DEPTH,
  CY_HEIGHT,
  CY_CENTER_X,
  CY_CENTER_Z,
  EXTRA_ROOM_THEMES,
  LOBBY_2F_THEMES,
  ROOM_ATMOSPHERE,
  LOBBY_DIAL_COLORS,
  LOBBY_PLAQUE_TITLES,
  ExtraRoomDoorState,
  createInitialExtraRoomState,
} from './room3d/roomConfig';
import {
  createRoomTextureManager,
  RoomTextureManager,
} from './room3d/textureCache';
import { createPortalDoorAndDial } from './room3d/portalDoorBuilder';
import { createRirimuBagGroup } from './room3d/ririmuBagBuilder';
import {
  CBOX_W,
  BOX_W,
  createChiamoColorBoxGroup,
  createWhiteBoxGroup,
} from './room3d/cabinetPropsBuilder';
import {
  buildSimpleColoredRoom,
  buildFoyerRoom,
  buildLobbyLogic2FRoom,
} from './room3d/buildSecondaryRooms';
import { buildPinkRoom } from './room3d/buildPinkRoom';

interface Room3DSceneProps {
  onExitRoom?: () => void;
  onOpenMenu?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
  playFootstep?: () => void;
}

export const Room3DScene: React.FC<Room3DSceneProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  // User Request: "刪除抬頭 降低左右視角轉動 將視角轉動方式從360度改為T字(左右 下視角)"
  const CENTER_YAW = 0; 
  const YAW_RANGE_HALF = (20 * Math.PI) / 180; // 降低左右視角轉動：左右各 20° (共 40° 視角)

  const getYawRangeHalf = () => {
    const cam = cameraRef.current;
    if (!cam) return YAW_RANGE_HALF;
    if (!isLobbyStyleRoom(activeRoomRef.current)) {
      return THREE.MathUtils.degToRad(72);
    }
    const halfFovYRad = THREE.MathUtils.degToRad(cam.fov * 0.5);
    const halfFovXRad = Math.atan(Math.tan(halfFovYRad) * cam.aspect);
    // Keep desktop at ±20°, while allowing narrow/portrait viewports to pan smoothly to the left wall corner (~62° horizontal edge)
    return Math.max(YAW_RANGE_HALF, THREE.MathUtils.degToRad(62) - halfFovXRad);
  };

  const MIN_PITCH = (-26 * Math.PI) / 180; // 下視角：俯視茶几茶具與檯燈 (~26 degrees down)
  const MAX_PITCH = 0; // 刪除抬頭：平視水平線為頂限，不可抬頭 (0 degrees)

  const texMgrRef = useRef<RoomTextureManager | null>(null);
  const builtRoomsRef = useRef<Set<RoomId>>(new Set(['lobby']));
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [isSceneReady, setIsSceneReady] = useState<boolean>(false);

  // --- ON-DEMAND SECONDARY ROOM BUILDER ---
  const buildSecondaryRoomOnDemand = (roomId: ExtraRoomId) => {
    if (builtRoomsRef.current.has(roomId)) return;
    const scene = sceneRef.current;
    const texMgr = texMgrRef.current;
    if (!scene || !texMgr) return;

    if (roomId === 'purple' || roomId === 'green' || roomId === 'gold') {
      const grp = buildSimpleColoredRoom(roomId, extraRoomsRef.current[roomId], texMgr);
      grp.visible = activeRoomRef.current === roomId;
      scene.add(grp);
      builtRoomsRef.current.add(roomId);
    } else if (roomId === 'pink') {
      const grp = buildPinkRoom(extraRoomsRef.current.pink, texMgr, {
        monologuePaperHitboxRef,
        beybladeBoxHitboxRef,
        beybladeLid1PivotRef,
        beybladeLid1OpenRef,
        beybladeLid1AngleRef,
        capsuleLightSwitchHitboxRef,
        capsuleSwitchBtnRef,
        capsuleSwitchLedMatRef,
        capsuleCeilingLedMatRef,
        capsuleMainLightBackRef,
        capsuleMainLightFrontRef,
        capsuleReadingLensMatRef,
        capsuleReadingLightRef,
        capsuleLightModeRef,
      });
      grp.visible = activeRoomRef.current === 'pink';
      scene.add(grp);
      builtRoomsRef.current.add('pink');
    } else if (roomId === 'cyan') {
      const grp = buildFoyerRoom('cyan', extraRoomsRef.current.cyan, cyanFarDoorRef.current, texMgr);
      grp.visible = activeRoomRef.current === 'cyan';
      scene.add(grp);
      builtRoomsRef.current.add('cyan');
    } else if (roomId === 'cyan_b1') {
      const grp = buildFoyerRoom('cyan_b1', extraRoomsRef.current.cyan_b1, cyanB1FarDoorRef.current, texMgr);
      grp.visible = activeRoomRef.current === 'cyan_b1';
      scene.add(grp);
      builtRoomsRef.current.add('cyan_b1');
    } else if (roomId === 'royalblue' || roomId === 'brown') {
      const grp = buildLobbyLogic2FRoom(roomId, extraRoomsRef.current[roomId], texMgr);
      grp.visible = activeRoomRef.current === roomId;
      scene.add(grp);
      builtRoomsRef.current.add(roomId);
    }
  };
  const isLobbyStyleRoom = (id: RoomId) => id === 'lobby' || id === 'royalblue' || id === 'brown';
  const isFoyerRoom = (id: RoomId) => id === 'cyan' || id === 'cyan_b1';

  // Game, Camera Location, Active Portal Room & Light State
  const [isLampOn, setIsLampOn] = useState(true);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const isCalendarModalOpenRef = useRef(false);
  const [isMonologueOpen, setIsMonologueOpen] = useState(false);
  const isMonologueOpenRef = useRef(false);
  const [viewLocation, setViewLocation] = useState<
    'table' | 'cabinet' | 'door' | 'door2' | 'center' | 'desk' | 'capsule' | 'board'
  >('table');
  const viewLocationRef = useRef<
    'table' | 'cabinet' | 'door' | 'door2' | 'center' | 'desk' | 'capsule' | 'board'
  >('table');
  const [activeRoom, setActiveRoom] = useState<RoomId>('lobby');
  const activeRoomRef = useRef<RoomId>('lobby');
  const [isCyanFloorDialogOpen, setIsCyanFloorDialogOpen] = useState(false);
  const isCyanFloorDialogOpenRef = useRef(false);
  const [isPinkNavOpen, setIsPinkNavOpen] = useState(false);
  const enterPortalRoomRef = useRef<
    ((targetRoom: RoomId, spawnView?: 'table' | 'door' | 'door2') => void) | null
  >(null);
  const portalVeilRef = useRef<HTMLDivElement | null>(null);
  const portalSwapTimeoutRef = useRef<number | null>(null);
  const portalFadeEndTimeoutRef = useRef<number | null>(null);

  // Camera & Raycaster Refs
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const lobbyRoomGroupRef = useRef<THREE.Group | null>(null);
  const wallCalendarHitboxRef = useRef<THREE.Mesh | null>(null);
  const monologuePaperHitboxRef = useRef<THREE.Mesh | null>(null);
  const beybladeBoxHitboxRef = useRef<THREE.Mesh | null>(null);
  const beybladeLid1PivotRef = useRef<THREE.Group | null>(null);
  const beybladeLid1OpenRef = useRef<boolean>(false);
  const beybladeLid1AngleRef = useRef<number>(0);

  // Upper Capsule Bedside Light Switch & Dim Light-Blue Reading Light Refs
  const capsuleLightSwitchHitboxRef = useRef<THREE.Mesh | null>(null);
  const capsuleSwitchBtnRef = useRef<THREE.Mesh | null>(null);
  const capsuleSwitchLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const capsuleCeilingLedMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const capsuleMainLightBackRef = useRef<THREE.PointLight | null>(null);
  const capsuleMainLightFrontRef = useRef<THREE.PointLight | null>(null);
  const capsuleReadingLensMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const capsuleReadingLightRef = useRef<THREE.PointLight | null>(null);
  const capsuleLightModeRef = useRef<number>(0); // 0: 原本頂燈, 1: 暗淺藍閱讀燈, 2: 雙燈齊亮, 3: 全關

  // Table Lamp 3D Object Refs for interactive tap & light control
  const lampGroupRef = useRef<THREE.Group | null>(null);
  const lampHitboxRef = useRef<THREE.Mesh | null>(null);
  const lampLightRef = useRef<THREE.PointLight | null>(null);
  const lampBulbMatRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const lampShadeMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const pouchFrontMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const pouchSideMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null);

  // Lobby Door (大廳, 亮銀色) & Circular Steampunk 4-Color Portal Dial Refs
  const lobbyDoorHitboxRef = useRef<THREE.Mesh | null>(null);
  const lobbyDoorLeafPivotRef = useRef<THREE.Group | null>(null);
  const portalWheelRef = useRef<THREE.Group | null>(null);
  const portalOuterGearRef = useRef<THREE.Group | null>(null);
  const portalHitboxRef = useRef<THREE.Mesh | null>(null);
  const portalPointLightRef = useRef<THREE.PointLight | null>(null);
  const portalGemMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const lobbyPlaqueMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const getCarvedPlaqueTextureRef = useRef<((labelText: string) => THREE.Texture) | null>(null);
  const portalSectorMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const portalRimGemMatsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  const portalColorIdxRef = useRef<number>(0); // 0: 草綠色, 1: 紫色, 2: 金色, 3: 青色
  const portalCurrentAngleRef = useRef<number>(0);
  const portalTargetAngleRef = useRef<number>(0);

  // Colored Portal Rooms (紫色 / 綠色 / 金色 / 青色) & Steampunk Dial Refs

  const extraRoomsRef = useRef<Record<ExtraRoomId, ExtraRoomDoorState>>({
    purple: createInitialExtraRoomState(),
    green: createInitialExtraRoomState(),
    gold: createInitialExtraRoomState(),
    pink: createInitialExtraRoomState(),
    cyan: createInitialExtraRoomState(
      [0x111216, 0x111216, 0x111216, 0x06b6d4],
      [false, false, false, true],
      3,
      Math.PI / 2
    ),
    cyan_b1: createInitialExtraRoomState(
      [0xc2410c, 0x111216, 0x111216, 0x06b6d4], // 上: 深橘色, 右/下: 黑色(不可用), 左: 青色(回一樓大廳)
      [true, false, false, true],
      3,
      Math.PI / 2
    ),
    royalblue: createInitialExtraRoomState(
      [0xe8eef5, 0x111216, 0x111216, 0x111216], // Top: 銀色(回二樓門廊), 其餘三個黑色
      [true, false, false, false],
      0,
      0
    ),
    brown: createInitialExtraRoomState(
      [0xe8eef5, 0x111216, 0x111216, 0x111216], // Top: 銀色(回二樓門廊), 其餘三個黑色
      [true, false, false, false],
      0,
      0
    ),
  });
  // Secondary far-end door inside the 12x4m 2F Foyer (二樓的門廊, on the 4m right-side wall)
  const cyanFarDoorRef = useRef<ExtraRoomDoorState>(
    createInitialExtraRoomState(
      [0x1d4ed8, 0xaa7a4a, 0x111216, 0x111216], // 寶藍色, 略深淺棕色, 黑色(不可用), 黑色(不可用)
      [true, true, false, false],
      0,
      0
    )
  );
  // Secondary far-end door inside the 12x4m B1 Foyer (B1 門廊, on the 4m right-side wall)
  const cyanB1FarDoorRef = useRef<ExtraRoomDoorState>(
    createInitialExtraRoomState(
      [0x324b8f, 0x111216, 0x111216, 0xf9a8d4], // 上: 深湖藍紫色, 右/下: 黑色(不可用), 左: 淺粉色
      [true, false, false, true],
      0,
      0
    )
  );
  const doorRattleTimerRef = useRef<number>(0);

  // Tap vs Drag tracking for 3D Object Interaction
  const touchStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const touchStartTime = useRef<number>(0);
  const touchHasMoved = useRef<boolean>(false);
  const lastTouchTimeRef = useRef<number>(0);

  const mouseStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const mouseStartTime = useRef<number>(0);
  const mouseHasMoved = useRef<boolean>(false);

  // Touch look tracking (enabled immediately while seated)
  const lookTouchIdRef = useRef<number | null>(null);
  const lookLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Desktop mouse look tracking (enabled immediately while seated)
  const isMouseDownRef = useRef(false);
  const mouseLastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Camera angles (starts centered at 0, T-shape rotation active)
  const cameraYawRef = useRef<number>(CENTER_YAW);
  const cameraPitchRef = useRef<number>(0);
  const targetYawRef = useRef<number>(CENTER_YAW);
  const targetPitchRef = useRef<number>(0);

  // Player position: directly seated at tea table cushion
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, SEATED_HEIGHT, SEATED_Z));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // --- 1. SCENE SETUP (DARK COZY MOOD) ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0c0907);
    scene.fog = new THREE.FogExp2(0x0c0907, 0.016);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(65, width / height, 0.02, 80);
    camera.position.copy(playerPosRef.current);
    camera.rotation.order = 'YXZ';
    camera.rotation.y = CENTER_YAW;
    camera.rotation.x = 0;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    rendererRef.current = renderer;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.90;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvScene = new RoomEnvironment();
    const roomEnvRT = pmremGenerator.fromScene(roomEnvScene, 0.04);
    scene.environment = roomEnvRT.texture;
    scene.environmentIntensity = 0.26;
    roomEnvScene.dispose();
    pmremGenerator.dispose();

    container.appendChild(renderer.domElement);

    const texMgr = createRoomTextureManager(renderer, (progress) => {
      setLoadProgress(Math.round(progress * 100));
      if (progress >= 1) {
        setIsSceneReady(true);
      }
    });
    texMgrRef.current = texMgr;
    getCarvedPlaqueTextureRef.current = texMgr.getCarvedPlaqueTexture;

    // --- 2. TEXTURES VIA CENTRALIZED TEXTURE MANAGER ---
    const floorTexture = texMgr.getFloorTexture();
    const wallTexture = texMgr.getWallTexture();
    const tabletopTexture = texMgr.getTabletopTexture();
    const ceilingTexture = texMgr.getCeilingTexture();
    const extraRoomTexturesToDispose: THREE.Texture[] = [];
    const textureLoader = new THREE.TextureLoader();

    // --- 3. ROOM ARCHITECTURE (大廳 - 10x7m) ---
    const roomGroup = new THREE.Group();
    lobbyRoomGroupRef.current = roomGroup;

    // 1. Dark Wood Floor
    const floorGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.58,
      metalness: 0.03,
      envMapIntensity: 0.32,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    roomGroup.add(floor);

    // 2. Ceiling
    const ceilingGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH);
    const ceilingMat = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.9,
      metalness: 0.02,
    });
    const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
    ceiling.position.y = ROOM_HEIGHT;
    ceiling.rotation.x = Math.PI / 2;
    roomGroup.add(ceiling);

    // 3. Dark Vertical Wood Slat Walls
    const makeWallMat = (repeatX: number, repeatY: number) => {
      const tex = wallTexture.clone();
      tex.repeat.set(repeatX, repeatY);
      tex.needsUpdate = true;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.58,
        metalness: 0.08,
      });
    };

    // Front Wall (Z = -ROOM_DEPTH / 2)
    const frontWallGeo = new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT);
    const frontWallMat = makeWallMat(ROOM_WIDTH * 2.2, 1);
    const frontWall = new THREE.Mesh(frontWallGeo, frontWallMat);
    frontWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_DEPTH / 2);
    frontWall.receiveShadow = true;
    roomGroup.add(frontWall);

    // Left Wall (X = -ROOM_WIDTH / 2)
    const leftWallGeo = new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT);
    const leftWallMat = makeWallMat(ROOM_DEPTH * 2.2, 1);
    const leftWall = new THREE.Mesh(leftWallGeo, leftWallMat);
    leftWall.position.set(-ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    roomGroup.add(leftWall);

    // Right Wall (X = ROOM_WIDTH / 2)
    const rightWallGeo = new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT);
    const rightWallMat = makeWallMat(ROOM_DEPTH * 2.2, 1);
    const rightWall = new THREE.Mesh(rightWallGeo, rightWallMat);
    rightWall.position.set(ROOM_WIDTH / 2, ROOM_HEIGHT / 2, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    roomGroup.add(rightWall);

    // Back Wall with Entrance Doorway (Z = ROOM_DEPTH / 2)
    const doorwayWidth = 1.6;
    const doorwayHeight = 2.3;
    const backWallSideWidth = (ROOM_WIDTH - doorwayWidth) / 2;
    const backWallMat = makeWallMat(backWallSideWidth * 2.2, 1);

    // Left back wall segment
    const bwLeftGeo = new THREE.PlaneGeometry(backWallSideWidth, ROOM_HEIGHT);
    const bwLeft = new THREE.Mesh(bwLeftGeo, backWallMat);
    bwLeft.position.set(-ROOM_WIDTH / 2 + backWallSideWidth / 2, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
    bwLeft.rotation.y = Math.PI;
    roomGroup.add(bwLeft);

    // Right back wall segment
    const bwRightGeo = new THREE.PlaneGeometry(backWallSideWidth, ROOM_HEIGHT);
    const bwRight = new THREE.Mesh(bwRightGeo, backWallMat);
    bwRight.position.set(ROOM_WIDTH / 2 - backWallSideWidth / 2, ROOM_HEIGHT / 2, ROOM_DEPTH / 2);
    bwRight.rotation.y = Math.PI;
    roomGroup.add(bwRight);

    // Lintel header above doorway
    const bwHeaderGeo = new THREE.PlaneGeometry(doorwayWidth, ROOM_HEIGHT - doorwayHeight);
    const bwHeader = new THREE.Mesh(bwHeaderGeo, backWallMat);
    bwHeader.position.set(0, ROOM_HEIGHT - (ROOM_HEIGHT - doorwayHeight) / 2, ROOM_DEPTH / 2);
    bwHeader.rotation.y = Math.PI;
    roomGroup.add(bwHeader);

    // Dark Door Frame
    const doorFrameMat = new THREE.MeshStandardMaterial({
      color: 0x1f120a,
      roughness: 0.5,
      metalness: 0.1,
    });
    const framePillarGeo = new THREE.BoxGeometry(0.12, doorwayHeight, 0.16);
    const frameL = new THREE.Mesh(framePillarGeo, doorFrameMat);
    frameL.position.set(-doorwayWidth / 2 + 0.05, doorwayHeight / 2, ROOM_DEPTH / 2);
    roomGroup.add(frameL);

    const frameR = new THREE.Mesh(framePillarGeo, doorFrameMat);
    frameR.position.set(doorwayWidth / 2 - 0.05, doorwayHeight / 2, ROOM_DEPTH / 2);
    roomGroup.add(frameR);

    const frameTopGeo = new THREE.BoxGeometry(doorwayWidth, 0.1, 0.16);
    const frameT = new THREE.Mesh(frameTopGeo, doorFrameMat);
    frameT.position.set(0, doorwayHeight, ROOM_DEPTH / 2);
    roomGroup.add(frameT);

    // Open Door Leaf (The door behind the player)
    const doorLeafGeo = new THREE.BoxGeometry(1.35, 2.25, 0.07);
    const doorLeafMat = new THREE.MeshStandardMaterial({
      color: 0x2c170d,
      roughness: 0.42,
      metalness: 0.08,
    });
    const doorLeaf = new THREE.Mesh(doorLeafGeo, doorLeafMat);
    doorLeaf.position.set(0.68, 1.13, 0);

    const doorPivot = new THREE.Group();
    doorPivot.position.set(-doorwayWidth / 2 + 0.1, 0, ROOM_DEPTH / 2);
    doorPivot.rotation.y = -Math.PI * 0.42; // open into room
    doorPivot.add(doorLeaf);

    // Brass Doorknob
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      roughness: 0.22,
      metalness: 0.9,
    });
    const knobGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const doorKnob = new THREE.Mesh(knobGeo, brassMat);
    doorKnob.position.set(1.22, 1.05, 0.06);
    doorPivot.add(doorKnob);

    roomGroup.add(doorPivot);

    // Dark Baseboards
    const baseboardMat = new THREE.MeshStandardMaterial({ color: 0x180d07, roughness: 0.55 });
    const bbL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, ROOM_DEPTH), baseboardMat);
    bbL.position.set(-ROOM_WIDTH / 2 + 0.02, 0.05, 0);
    roomGroup.add(bbL);
    const bbR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, ROOM_DEPTH), baseboardMat);
    bbR.position.set(ROOM_WIDTH / 2 - 0.02, 0.05, 0);
    roomGroup.add(bbR);
    const bbB1 = new THREE.Mesh(new THREE.BoxGeometry(backWallSideWidth, 0.1, 0.04), baseboardMat);
    bbB1.position.set(-ROOM_WIDTH / 2 + backWallSideWidth / 2, 0.05, ROOM_DEPTH / 2 - 0.02);
    roomGroup.add(bbB1);
    const bbB2 = new THREE.Mesh(new THREE.BoxGeometry(backWallSideWidth, 0.1, 0.04), baseboardMat);
    bbB2.position.set(ROOM_WIDTH / 2 - backWallSideWidth / 2, 0.05, ROOM_DEPTH / 2 - 0.02);
    roomGroup.add(bbB2);

    // --- 3B. CLOSED PORTAL DOOR ("1F" / "2F" / ROOM NAME CARVED) & STEAMPUNK DIAL BUILDER ---
    const doorEngravingTex = texMgr.getDoorEngraving1F();
    const door2FEngravingTex = texMgr.getDoorEngraving2F();
    const doorB1EngravingTex = texMgr.getDoorEngravingB1();

    const lobbyPortalDoor = createPortalDoorAndDial({
      colors: LOBBY_DIAL_COLORS,
      hasColorSlot: [true, true, true, true],
      initialIdx: portalColorIdxRef.current,
      currentAngle: portalCurrentAngleRef.current,
      showFloorLabel: true,
      floorLabelTexture: texMgr.getCarvedPlaqueTexture(
        LOBBY_PLAQUE_TITLES[portalColorIdxRef.current] ?? '1F'
      ),
    });
    lobbyPortalDoor.doorGroup.position.set(-3.65, 0, -ROOM_DEPTH / 2);
    roomGroup.add(lobbyPortalDoor.doorGroup);

    lobbyDoorHitboxRef.current = lobbyPortalDoor.doorHitbox;
    lobbyDoorLeafPivotRef.current = lobbyPortalDoor.leafPivot;
    portalWheelRef.current = lobbyPortalDoor.wheelGroup;
    portalOuterGearRef.current = lobbyPortalDoor.outerGearGroup;
    portalHitboxRef.current = lobbyPortalDoor.dialHitbox;
    portalPointLightRef.current = lobbyPortalDoor.dialLight;
    portalGemMatRef.current = lobbyPortalDoor.tipGemMat;
    portalSectorMatsRef.current = lobbyPortalDoor.sectorMats;
    portalRimGemMatsRef.current = lobbyPortalDoor.rimGemMats;
    lobbyPlaqueMatRef.current = lobbyPortalDoor.plaqueMat;

    // --- 4. WALL-SIDE WOODEN TABLE (牆邊木桌 - 寬度縮小，移去舊物件，置放盆栽) ---
    const tableGroup = new THREE.Group();
    const TABLE_WIDTH = 2.6; // 寬度稍微縮小 (由原本滿牆 4.6m 縮為 2.6m，兩側留出空間)
    const TABLE_TOP_THICK = 0.055;

    const tableMat = new THREE.MeshStandardMaterial({
      map: tabletopTexture,
      roughness: 0.35,
      metalness: 0.05,
    });

    const tableDarkWoodMat = new THREE.MeshStandardMaterial({
      color: 0x22120a,
      roughness: 0.48,
      metalness: 0.05,
    });

    // Tabletop Slab
    const topGeo = new THREE.BoxGeometry(TABLE_WIDTH, TABLE_TOP_THICK, TABLE_DEPTH);
    const tableTop = new THREE.Mesh(topGeo, tableMat);
    tableTop.position.set(0, TABLE_HEIGHT - TABLE_TOP_THICK / 2, 0);
    tableTop.castShadow = true;
    tableTop.receiveShadow = true;
    tableGroup.add(tableTop);

    // Front apron rail
    const apronGeo = new THREE.BoxGeometry(TABLE_WIDTH - 0.12, 0.07, 0.035);
    const apronFront = new THREE.Mesh(apronGeo, tableDarkWoodMat);
    apronFront.position.set(0, TABLE_HEIGHT - TABLE_TOP_THICK - 0.035, TABLE_DEPTH / 2 - 0.04);
    tableGroup.add(apronFront);

    // 4 Clean Corner Legs
    const legThick = 0.065;
    const legHeight = TABLE_HEIGHT - TABLE_TOP_THICK;
    const legGeo = new THREE.BoxGeometry(legThick, legHeight, legThick);

    const legPositions = [
      [-TABLE_WIDTH / 2 + 0.06, legHeight / 2, -TABLE_DEPTH / 2 + 0.06],
      [TABLE_WIDTH / 2 - 0.06, legHeight / 2, -TABLE_DEPTH / 2 + 0.06],
      [-TABLE_WIDTH / 2 + 0.06, legHeight / 2, TABLE_DEPTH / 2 - 0.06],
      [TABLE_WIDTH / 2 - 0.06, legHeight / 2, TABLE_DEPTH / 2 - 0.06],
    ];
    legPositions.forEach(([lx, ly, lz]) => {
      const leg = new THREE.Mesh(legGeo, tableDarkWoodMat);
      leg.position.set(lx, ly, lz);
      leg.castShadow = true;
      tableGroup.add(leg);
    });

    // --- 4A-1. BLACK VINYL RECORD & BLONDE WOOD EASEL ON WALL TABLE CENTER (牆邊木桌正中間黑膠唱片與底座) ---
    const vinylCenterTexture = texMgr.loadTexture('/assets/vinyl_center_tex.webp');
    vinylCenterTexture.colorSpace = THREE.SRGBColorSpace;
    vinylCenterTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const createVinylDiscFaceTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      // Deep satin-black vinyl base
      ctx.fillStyle = '#121317';
      ctx.fillRect(0, 0, 1024, 1024);

      // Anisotropic radial sheen reflection across vinyl tracks
      const sheen = ctx.createConicGradient(0.45, 512, 512);
      sheen.addColorStop(0.0, 'rgba(255,255,255,0.04)');
      sheen.addColorStop(0.18, 'rgba(255,255,255,0.0)');
      sheen.addColorStop(0.42, 'rgba(255,255,255,0.065)');
      sheen.addColorStop(0.58, 'rgba(255,255,255,0.0)');
      sheen.addColorStop(0.85, 'rgba(255,255,255,0.05)');
      sheen.addColorStop(1.0, 'rgba(255,255,255,0.04)');
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, 1024, 1024);

      // Subtle concentric LP micro-grooves from outer rim inward to label margin
      for (let r = 268; r <= 504; r += 3) {
        ctx.beginPath();
        ctx.arc(512, 512, r, 0, Math.PI * 2);
        const trackBand = r % 63 < 4 ? 0.08 : (r % 9 === 0 ? 0.045 : 0.018);
        ctx.strokeStyle = `rgba(255, 255, 255, ${trackBand})`;
        ctx.lineWidth = r % 63 < 4 ? 1.8 : 1.0;
        ctx.stroke();
      }

      // Expressive cyan metallic marker autograph "み UMIR 2026." on lower-right vinyl ring
      ctx.save();
      ctx.strokeStyle = '#18beff';
      ctx.fillStyle = '#18beff';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Cursive "み" loop + star finial matching reference photo
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(765, 592);
      ctx.quadraticCurveTo(815, 586, 835, 586);
      ctx.bezierCurveTo(800, 635, 762, 682, 742, 690);
      ctx.bezierCurveTo(722, 698, 725, 658, 765, 646);
      ctx.bezierCurveTo(822, 630, 895, 648, 902, 706);
      ctx.bezierCurveTo(906, 738, 875, 756, 845, 748);
      ctx.stroke();

      // Diagonal downward crossing stroke of "み"
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(862, 580);
      ctx.quadraticCurveTo(846, 672, 795, 732);
      ctx.stroke();

      // Tiny 5-point star accent at end of cursive tail
      const sx = 843;
      const sy = 747;
      ctx.beginPath();
      for (let p = 0; p < 10; p++) {
        const ang = (p * Math.PI) / 5 - Math.PI / 2;
        const rad = p % 2 === 0 ? 11 : 5;
        const px = sx + Math.cos(ang) * rad;
        const py = sy + Math.sin(ang) * rad;
        if (p === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();

      // Hand-lettered "UMIR" & "2026." on right margin next to "み"
      ctx.translate(932, 608);
      ctx.rotate(0.08);
      ctx.font = 'bold 34px "Comic Sans MS", "Trebuchet MS", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('UMIR', 0, 0);
      ctx.font = 'bold 26px "Comic Sans MS", "Trebuchet MS", sans-serif';
      ctx.fillText('2026.', 4, 34);
      ctx.restore();

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const vinylDiscFaceTexture = createVinylDiscFaceTexture();

    const vinylEaselGroup = new THREE.Group();
    vinylEaselGroup.position.set(0, TABLE_HEIGHT, 0.02);

    const easelWoodMat = new THREE.MeshStandardMaterial({
      color: 0xe2cca6,
      roughness: 0.58,
      metalness: 0.03,
    });
    const easelPinMat = new THREE.MeshStandardMaterial({
      color: 0x9c825a,
      roughness: 0.45,
      metalness: 0.25,
    });

    // 1. Mini Blonde Wood A-Frame Easel Stand (grounded at y = 0 on tabletop)
    const EASEL_LEAN = -0.19; // ~11 deg backward lean
    const easelFrontFrame = new THREE.Group();
    easelFrontFrame.position.set(0, 0, 0.035);
    easelFrontFrame.rotation.x = EASEL_LEAN;

    // Left & Right splayed A-frame legs
    const frontLegGeo = new THREE.BoxGeometry(0.015, 0.225, 0.015);
    [-1, 1].forEach((side) => {
      const fLeg = new THREE.Mesh(frontLegGeo, easelWoodMat);
      fLeg.position.set(side * 0.068, 0.112, 0);
      fLeg.rotation.z = side * 0.18;
      fLeg.castShadow = true;
      fLeg.receiveShadow = true;
      easelFrontFrame.add(fLeg);
    });

    // Top crossbeam tying A-frame shoulders
    const easelTopBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.115, 0.014, 0.014),
      easelWoodMat
    );
    easelTopBar.position.set(0, 0.205, 0);
    easelTopBar.castShadow = true;
    easelFrontFrame.add(easelTopBar);

    // Front horizontal shelf ledge cradling the vinyl disc bottom rim
    const easelLedge = new THREE.Mesh(
      new THREE.BoxGeometry(0.205, 0.014, 0.030),
      easelWoodMat
    );
    easelLedge.position.set(0, 0.056, 0.012);
    easelLedge.castShadow = true;
    easelLedge.receiveShadow = true;
    easelFrontFrame.add(easelLedge);

    // Subtle front lip stopper on the ledge so the record sits securely
    const easelLedgeLip = new THREE.Mesh(
      new THREE.BoxGeometry(0.205, 0.008, 0.005),
      easelWoodMat
    );
    easelLedgeLip.position.set(0, 0.065, 0.0245);
    easelFrontFrame.add(easelLedgeLip);

    // 2. Grooved Black 12" Vinyl Disc + Center Illustration Sticker resting on the easel ledge
    const DISC_R = 0.182;
    const discAssembly = new THREE.Group();
    // 往上移以配合放大後的半徑，穩穩坐在展示架橫桿凹槽上
    discAssembly.position.set(0, 0.063 + DISC_R * 1.32, 0.0115);

    const vinylBodyMat = new THREE.MeshStandardMaterial({
      color: 0x101115,
      roughness: 0.34,
      metalness: 0.18,
    });
    const vinylRimCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(DISC_R, DISC_R, 0.0046, 64),
      vinylBodyMat
    );
    vinylRimCylinder.rotation.x = Math.PI / 2;
    vinylRimCylinder.castShadow = true;
    vinylRimCylinder.receiveShadow = true;
    discAssembly.add(vinylRimCylinder);

    // Front circular grooved vinyl surface + cyan "み UMIR 2026." autograph
    const vinylFrontFace = new THREE.Mesh(
      new THREE.CircleGeometry(DISC_R - 0.001, 64),
      new THREE.MeshStandardMaterial({
        map: vinylDiscFaceTexture,
        color: 0xffffff,
        roughness: 0.30,
        metalness: 0.14,
      })
    );
    vinylFrontFace.position.z = 0.0026;
    vinylFrontFace.receiveShadow = true;
    discAssembly.add(vinylFrontFace);

    // Center "保持可愛漫研社" illustrated round vinyl sticker
    const vinylCenterLabel = new THREE.Mesh(
      new THREE.CircleGeometry(DISC_R * 0.505, 64),
      new THREE.MeshStandardMaterial({
        map: vinylCenterTexture,
        color: 0xffffff,
        roughness: 0.44,
        metalness: 0.03,
        transparent: true,
        alphaTest: 0.12,
      })
    );
    vinylCenterLabel.position.z = 0.0033;
    vinylCenterLabel.receiveShadow = true;
    discAssembly.add(vinylCenterLabel);
    discAssembly.scale.setScalar(1.32); // 放大黑唱片的尺寸

    easelFrontFrame.add(discAssembly);
    vinylEaselGroup.add(easelFrontFrame);

    // Rear A-frame hinged support leg brace touching tabletop at y = 0
    const rearLegGroup = new THREE.Group();
    rearLegGroup.position.set(0, 0.195, -0.004);
    rearLegGroup.rotation.x = 0.44;
    [-1, 1].forEach((side) => {
      const rLeg = new THREE.Mesh(
        new THREE.BoxGeometry(0.013, 0.215, 0.013),
        easelWoodMat
      );
      rLeg.position.set(side * 0.045, -0.105, 0);
      rLeg.rotation.z = side * 0.12;
      rLeg.castShadow = true;
      rearLegGroup.add(rLeg);
    });
    const rearBrace = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.012, 0.012),
      easelWoodMat
    );
    rearBrace.position.set(0, -0.12, 0);
    rearLegGroup.add(rearBrace);
    vinylEaselGroup.add(rearLegGroup);

    // Tiny metal hinge pins joining front & rear easel struts
    [-1, 1].forEach((side) => {
      const pin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0035, 0.0035, 0.022, 10),
        easelPinMat
      );
      pin.rotation.z = Math.PI / 2;
      pin.position.set(side * 0.048, 0.198, -0.002);
      vinylEaselGroup.add(pin);
    });

    // Soft warm spotlight illuminating the centered vinyl record & wooden easel
    const vinylSpot = new THREE.PointLight(0xffeed6, 1.05, 3.6, 1.2);
    vinylSpot.position.set(0, 0.68, 0.42);
    vinylSpot.castShadow = true;
    vinylEaselGroup.add(vinylSpot);

    tableGroup.add(vinylEaselGroup);

    // --- 4A-1b. STACKED TRIPLE-CAT TRASH BIN AT FAR-LEFT OF WALL TABLE (牆邊桌面最左側貓貓垃圾桶) ---
    const createCatFaceTexture = (variant: 'apricot' | 'white' | 'red') => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      ctx.clearRect(0, 0, 512, 256);
      const cx = 256;
      const cy = 128;

      // Whiskers & cheeks common setup
      const whiskerColor =
        variant === 'red' ? '#f7f7f7' : variant === 'white' ? '#ebb24c' : '#181818';
      ctx.strokeStyle = whiskerColor;
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      [-1, 1].forEach((side) => {
        ctx.beginPath();
        ctx.moveTo(cx + side * 112, cy + 4);
        ctx.lineTo(cx + side * 158, cy - 6);
        ctx.moveTo(cx + side * 112, cy + 24);
        ctx.lineTo(cx + side * 160, cy + 28);
        ctx.stroke();
      });

      // Rosy pink oval blush cheeks + tiny highlight dashes
      [-1, 1].forEach((side) => {
        const bx = cx + side * 78;
        const by = cy + 28;
        ctx.fillStyle = '#eb7c98';
        ctx.beginPath();
        ctx.ellipse(bx, by, 22, 13, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd0dc';
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(bx - 5, by - 4);
        ctx.lineTo(bx - 5, by + 4);
        ctx.moveTo(bx + 5, by - 4);
        ctx.lineTo(bx + 5, by + 4);
        ctx.stroke();
      });

      if (variant === 'red') {
        // Large cartoon white-sclera eyes with forward black pupils
        [-1, 1].forEach((side) => {
          const ex = cx + side * 52;
          const ey = cy - 10;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#181818';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(ex, ey, 22, 26, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#141414';
          ctx.beginPath();
          ctx.ellipse(ex - side * 4, ey + 2, 12, 16, 0, 0, Math.PI * 2);
          ctx.fill();
        });
        // Outlined pink Y-nose & smile
        ctx.strokeStyle = '#f8f8f8';
        ctx.fillStyle = '#e56f89';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy + 16);
        ctx.lineTo(cx + 8, cy + 16);
        ctx.lineTo(cx, cy + 26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy + 26);
        ctx.lineTo(cx, cy + 38);
        ctx.stroke();
      } else if (variant === 'white') {
        // Shiny dark eyes with crescent specular highlights
        [-1, 1].forEach((side) => {
          const ex = cx + side * 52;
          const ey = cy - 8;
          ctx.fillStyle = '#161618';
          ctx.beginPath();
          ctx.ellipse(ex, ey, 21, 23, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(ex + 6, ey - 5, 7.5, 0, Math.PI * 2);
          ctx.fill();
        });
        // Tiny oval black nose
        ctx.fillStyle = '#161618';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 16, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Happy ^ ^ squinting eyes + cheerful pink open mouth
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 6.5;
        ctx.lineCap = 'round';
        [-1, 1].forEach((side) => {
          const ex = cx + side * 52;
          ctx.beginPath();
          ctx.arc(ex, cy - 2, 19, Math.PI * 1.15, Math.PI * 1.85);
          ctx.stroke();
        });
        // Cute open mouth with pink tongue
        ctx.fillStyle = '#d96b86';
        ctx.strokeStyle = '#181818';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx - 20, cy + 16);
        ctx.quadraticCurveTo(cx, cy + 22, cx + 20, cy + 16);
        ctx.quadraticCurveTo(cx + 16, cy + 52, cx, cy + 52);
        ctx.quadraticCurveTo(cx - 16, cy + 52, cx - 20, cy + 16);
        ctx.fill();
        ctx.stroke();
        // Little nose dot
        ctx.fillStyle = '#181818';
        ctx.beginPath();
        ctx.arc(cx, cy + 10, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const catFaceApricotTex = createCatFaceTexture('apricot');
    const catFaceWhiteTex = createCatFaceTexture('white');
    const catFaceRedTex = createCatFaceTexture('red');

    const catBinGroup = new THREE.Group();
    const CAT_R = 0.115;
    const CAT_H = 0.084;

    // 1. Matte black stepped circular foot ring
    const catBaseRing = new THREE.Mesh(
      new THREE.CylinderGeometry(CAT_R * 0.92, CAT_R * 0.97, 0.018, 36),
      new THREE.MeshStandardMaterial({ color: 0x16171a, roughness: 0.55, metalness: 0.06 })
    );
    catBaseRing.position.y = 0.009;
    catBaseRing.castShadow = true;
    catBaseRing.receiveShadow = true;
    catBinGroup.add(catBaseRing);

    // Cushion drum Lathe profile (vertical bulge matching stacked plush-plastic bin tiers)
    const makeCatHeadProfile = (rMax: number, h: number, rOff = 0) => [
      new THREE.Vector2(rMax * 0.72 + rOff, 0.0),
      new THREE.Vector2(rMax * 0.91 + rOff, h * 0.12),
      new THREE.Vector2(rMax + rOff, h * 0.48),
      new THREE.Vector2(rMax * 0.92 + rOff, h * 0.86),
      new THREE.Vector2(rMax * 0.74 + rOff, h),
    ];

    const catHeadGeo = new THREE.LatheGeometry(makeCatHeadProfile(CAT_R, CAT_H), 40);
    catHeadGeo.computeVertexNormals();
    const catFacePatchGeo = new THREE.LatheGeometry(
      makeCatHeadProfile(CAT_R, CAT_H, 0.0014),
      28,
      -0.60,
      1.20
    );
    const catEarGeo = new THREE.ConeGeometry(0.022, 0.032, 16);

    const catTiers: Array<{
      y: number;
      color: number;
      faceTex: THREE.Texture;
    }> = [
      { y: 0.016, color: 0xeeb56e, faceTex: catFaceApricotTex },
      { y: 0.016 + CAT_H * 0.94, color: 0xeef2ee, faceTex: catFaceWhiteTex },
      { y: 0.016 + CAT_H * 1.88, color: 0xb71d23, faceTex: catFaceRedTex },
    ];

    catTiers.forEach((tier) => {
      const tierGroup = new THREE.Group();
      tierGroup.position.y = tier.y;

      const shellMat = new THREE.MeshPhysicalMaterial({
        color: tier.color,
        roughness: 0.16,
        metalness: 0.04,
        clearcoat: 0.92,
        clearcoatRoughness: 0.12,
      });

      const body = new THREE.Mesh(catHeadGeo, shellMat);
      body.castShadow = true;
      body.receiveShadow = true;
      tierGroup.add(body);

      // Curved front face graphic patch hugging the chubby cheek curvature
      const faceMesh = new THREE.Mesh(
        catFacePatchGeo,
        new THREE.MeshStandardMaterial({
          map: tier.faceTex,
          color: 0xffffff,
          roughness: 0.22,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      tierGroup.add(faceMesh);

      // Two sculpted front-facing triangular cat ears
      [-1, 1].forEach((side) => {
        const ear = new THREE.Mesh(catEarGeo, shellMat);
        ear.scale.set(1.0, 1.0, 0.72);
        ear.position.set(side * 0.056, CAT_H * 0.96, 0.068);
        ear.rotation.set(0.18, 0, -side * 0.16);
        ear.castShadow = true;
        tierGroup.add(ear);
      });

      catBinGroup.add(tierGroup);
    });

    // Dark recessed inner bin rim at the top of the red cat head
    const binTopRim = new THREE.Mesh(
      new THREE.CylinderGeometry(CAT_R * 0.72, CAT_R * 0.72, 0.008, 32),
      new THREE.MeshStandardMaterial({ color: 0x161619, roughness: 0.65 })
    );
    binTopRim.position.y = 0.016 + CAT_H * 2.86;
    catBinGroup.add(binTopRim);

    catBinGroup.position.set(-1.12, TABLE_HEIGHT, 0.05);
    catBinGroup.rotation.y = 0.12; // Subtle welcoming angle toward viewer
    tableGroup.add(catBinGroup);

    // --- 4A-1c. NINTENDO SWITCH 2 + IINE CHARGING DOCK RIGHT OF CAT BIN (貓貓垃圾桶右側 Switch 2 主機底座) ---
    const createSwitchDockLogoTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 320;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      ctx.fillStyle = '#24262b';
      ctx.fillRect(0, 0, 512, 320);

      // Embossed black/glossy "Switch 2" icon + "2" + NINTENDO SWITCH wordmark
      ctx.fillStyle = '#0c0d10';
      ctx.strokeStyle = '#0c0d10';
      // Left Joy-Con silhouette icon
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(172, 62, 36, 76, [14, 2, 2, 14]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(190, 86, 6, 0, Math.PI * 2);
      ctx.fill();
      // Right Joy-Con silhouette icon
      ctx.beginPath();
      ctx.roundRect(216, 62, 36, 76, [2, 14, 14, 2]);
      ctx.fill();
      ctx.fillStyle = '#24262b';
      ctx.beginPath();
      ctx.arc(234, 108, 7, 0, Math.PI * 2);
      ctx.fill();

      // Big "2" beside Joy-Con emblem
      ctx.fillStyle = '#0c0d10';
      ctx.font = '900 84px "Arial Black", "Helvetica Neue", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('2', 268, 138);

      // NINTENDO / SWITCH wordmark centered beneath
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px "Helvetica Neue", sans-serif';
      ctx.fillText('N I N T E N D O', 256, 174);
      ctx.font = '900 32px "Arial Black", "Helvetica Neue", sans-serif';
      ctx.fillText('SWITCH', 256, 208);

      // Subtle lower dock horizontal groove seam + tiny TV icon on left
      ctx.strokeStyle = '#181a1e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 246);
      ctx.lineTo(512, 246);
      ctx.stroke();

      ctx.strokeStyle = '#6b707a';
      ctx.lineWidth = 2;
      ctx.strokeRect(24, 266, 16, 11);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const createIineBaseLogoTex = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 96;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      ctx.fillStyle = '#1d1f24';
      ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#d4d8e0';
      ctx.font = 'italic 900 28px "Arial Black", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IINE', 128, 48);

      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return tex;
    };

    const switchDockLogoTex = createSwitchDockLogoTex();
    const iineBaseLogoTex = createIineBaseLogoTex();

    const switch2Group = new THREE.Group();
    const swDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1d1f24,
      roughness: 0.48,
      metalness: 0.10,
    });
    const swShieldMat = new THREE.MeshStandardMaterial({
      color: 0x24262b,
      roughness: 0.52,
      metalness: 0.08,
    });
    const swScreenMat = new THREE.MeshPhysicalMaterial({
      color: 0x090b0f,
      roughness: 0.08,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    });
    const swGreyTrimMat = new THREE.MeshStandardMaterial({
      color: 0x898e96,
      roughness: 0.38,
      metalness: 0.25,
    });
    const swCyanMat = new THREE.MeshStandardMaterial({
      color: 0x42b8e8,
      roughness: 0.32,
      metalness: 0.08,
    });
    const swOrangeMat = new THREE.MeshStandardMaterial({
      color: 0xe85a32,
      roughness: 0.32,
      metalness: 0.08,
    });

    // 1. Wide IINE Charging Base Platform (grounded at y = 0)
    const DOCK_BASE_W = 0.232;
    const DOCK_BASE_H = 0.032;
    const DOCK_BASE_D = 0.084;
    const baseFoot = new THREE.Mesh(
      new THREE.BoxGeometry(DOCK_BASE_W, 0.005, DOCK_BASE_D),
      swDarkMat
    );
    baseFoot.position.set(0, 0.0025, 0);
    switch2Group.add(baseFoot);

    // Light grey bottom perimeter accent band
    const baseGreyLine = new THREE.Mesh(
      new THREE.BoxGeometry(DOCK_BASE_W + 0.001, 0.0035, DOCK_BASE_D + 0.001),
      swGreyTrimMat
    );
    baseGreyLine.position.set(0, 0.0065, 0);
    switch2Group.add(baseGreyLine);

    const baseUpperBody = new THREE.Mesh(
      new THREE.BoxGeometry(DOCK_BASE_W, DOCK_BASE_H - 0.008, DOCK_BASE_D),
      swDarkMat
    );
    baseUpperBody.position.set(0, 0.008 + (DOCK_BASE_H - 0.008) / 2, 0);
    baseUpperBody.castShadow = true;
    baseUpperBody.receiveShadow = true;
    switch2Group.add(baseUpperBody);

    // Raised curved front center IINE arch hump + logo face
    const iineHump = new THREE.Mesh(
      new THREE.BoxGeometry(0.072, 0.011, DOCK_BASE_D * 0.45),
      swDarkMat
    );
    iineHump.position.set(0, DOCK_BASE_H + 0.0045, DOCK_BASE_D * 0.27);
    switch2Group.add(iineHump);

    const iineLogoFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.056, 0.022),
      new THREE.MeshStandardMaterial({ map: iineBaseLogoTex, roughness: 0.45 })
    );
    iineLogoFace.position.set(0, 0.022, DOCK_BASE_D / 2 + 0.0008);
    switch2Group.add(iineLogoFace);

    // Front-right USB-A & USB-C recessed dark ports
    const usbPortMat = new THREE.MeshStandardMaterial({ color: 0x090a0c, roughness: 0.4, metalness: 0.4 });
    const usbAPort = new THREE.Mesh(new THREE.BoxGeometry(0.013, 0.007, 0.002), usbPortMat);
    usbAPort.position.set(0.068, 0.018, DOCK_BASE_D / 2 + 0.0008);
    switch2Group.add(usbAPort);
    const usbCPort = new THREE.Mesh(new THREE.BoxGeometry(0.009, 0.004, 0.002), usbPortMat);
    usbCPort.position.set(0.088, 0.018, DOCK_BASE_D / 2 + 0.0008);
    switch2Group.add(usbCPort);

    // 2. Upright Rounded Nintendo Switch 2 Front Dock Shield (with embossed 2 / NINTENDO SWITCH logo)
    const SHIELD_W = 0.184;
    const SHIELD_H = 0.106;
    const shieldShape = new THREE.Shape();
    const shw = SHIELD_W / 2;
    const sr = 0.016;
    shieldShape.moveTo(-shw, 0);
    shieldShape.lineTo(shw, 0);
    shieldShape.lineTo(shw, SHIELD_H - sr);
    shieldShape.quadraticCurveTo(shw, SHIELD_H, shw - sr, SHIELD_H);
    shieldShape.lineTo(-shw + sr, SHIELD_H);
    shieldShape.quadraticCurveTo(-shw, SHIELD_H, -shw, SHIELD_H - sr);
    shieldShape.closePath();

    const dockShieldGeo = new THREE.ExtrudeGeometry(shieldShape, {
      depth: 0.016,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 2,
    });
    const dockShieldMesh = new THREE.Mesh(dockShieldGeo, swShieldMat);
    dockShieldMesh.position.set(0, DOCK_BASE_H - 0.002, 0.008);
    dockShieldMesh.castShadow = true;
    dockShieldMesh.receiveShadow = true;
    switch2Group.add(dockShieldMesh);

    const dockShieldFrontLogo = new THREE.Mesh(
      new THREE.PlaneGeometry(SHIELD_W - 0.012, SHIELD_H - 0.010),
      new THREE.MeshStandardMaterial({ map: switchDockLogoTex, roughness: 0.52 })
    );
    dockShieldFrontLogo.position.set(0, DOCK_BASE_H + SHIELD_H / 2 - 0.002, 0.0265);
    switch2Group.add(dockShieldFrontLogo);

    // 3. Docked Nintendo Switch 2 Console Body (peeking cleanly above the front shield!)
    const CONSOLE2_W = 0.194;
    const CONSOLE2_H = 0.120;
    const console2Body = new THREE.Mesh(
      new THREE.BoxGeometry(CONSOLE2_W, CONSOLE2_H, 0.012),
      swScreenMat
    );
    console2Body.position.set(0, DOCK_BASE_H + 0.010 + CONSOLE2_H / 2, -0.006);
    console2Body.castShadow = true;
    switch2Group.add(console2Body);

    // 4. Left & Right Joy-Con 2 Controllers with Signature Cyan & Orange Stick Collars
    const JC_W = 0.036;
    const JC_H = 0.120;
    const makeJoyConGeo = (isLeft: boolean) => {
      const shape = new THREE.Shape();
      const hw = JC_W / 2;
      const hh = JC_H / 2;
      const r = 0.017;
      if (isLeft) {
        shape.moveTo(hw, -hh);
        shape.lineTo(-hw + r, -hh);
        shape.quadraticCurveTo(-hw, -hh, -hw, -hh + r);
        shape.lineTo(-hw, hh - r);
        shape.quadraticCurveTo(-hw, hh, -hw + r, hh);
        shape.lineTo(hw, hh);
      } else {
        shape.moveTo(-hw, -hh);
        shape.lineTo(hw - r, -hh);
        shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
        shape.lineTo(hw, hh - r);
        shape.quadraticCurveTo(hw, hh, hw - r, hh);
        shape.lineTo(-hw, hh);
      }
      shape.closePath();
      return new THREE.ExtrudeGeometry(shape, {
        depth: 0.013,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 2,
      });
    };

    const btnMat = new THREE.MeshStandardMaterial({ color: 0x2b2e35, roughness: 0.42 });
    const stickCapMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.35 });

    // Left Joy-Con 2
    const leftJCGroup = new THREE.Group();
    leftJCGroup.position.set(-CONSOLE2_W / 2 - JC_W / 2 + 0.002, DOCK_BASE_H + 0.010 + JC_H / 2, -0.011);
    const leftJCMesh = new THREE.Mesh(makeJoyConGeo(true), swDarkMat);
    leftJCMesh.castShadow = true;
    leftJCGroup.add(leftJCMesh);

    // Cyan-ring Left Thumbstick
    const lRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20), swCyanMat);
    lRing.rotation.x = Math.PI / 2;
    lRing.position.set(-0.001, 0.028, 0.0155);
    leftJCGroup.add(lRing);
    const lStick = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 20), stickCapMat);
    lStick.rotation.x = Math.PI / 2;
    lStick.position.set(-0.001, 0.028, 0.018);
    leftJCGroup.add(lStick);

    // Left 4 D-pad buttons
    [
      [0, 0.008],
      [0, -0.008],
      [-0.008, 0],
      [0.008, 0],
    ].forEach(([bx, by]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0032, 0.0032, 0.003, 12), btnMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(bx - 0.001, by - 0.002, 0.0155);
      leftJCGroup.add(b);
    });
    switch2Group.add(leftJCGroup);

    // Right Joy-Con 2
    const rightJCGroup = new THREE.Group();
    rightJCGroup.position.set(CONSOLE2_W / 2 + JC_W / 2 - 0.002, DOCK_BASE_H + 0.010 + JC_H / 2, -0.011);
    const rightJCMesh = new THREE.Mesh(makeJoyConGeo(false), swDarkMat);
    rightJCMesh.castShadow = true;
    rightJCGroup.add(rightJCMesh);

    // Right X/Y/A/B diamond buttons
    [
      [0, 0.009],
      [0, -0.009],
      [-0.009, 0],
      [0.009, 0],
    ].forEach(([bx, by]) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.003, 12), btnMat);
      b.rotation.x = Math.PI / 2;
      b.position.set(bx + 0.001, by + 0.026, 0.0155);
      rightJCGroup.add(b);
    });

    // Coral-orange-ring Right Thumbstick
    const rRing = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.004, 20), swOrangeMat);
    rRing.rotation.x = Math.PI / 2;
    rRing.position.set(0.001, -0.004, 0.0155);
    rightJCGroup.add(rRing);
    const rStick = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.006, 20), stickCapMat);
    rStick.rotation.x = Math.PI / 2;
    rStick.position.set(0.001, -0.004, 0.018);
    rightJCGroup.add(rStick);
    switch2Group.add(rightJCGroup);

    switch2Group.position.set(-0.65, TABLE_HEIGHT, 0.05);
    switch2Group.rotation.y = 0.08;
    tableGroup.add(switch2Group);

    tableGroup.position.set(0, 0, -ROOM_DEPTH / 2 + TABLE_DEPTH / 2);
    roomGroup.add(tableGroup);



    // --- 4A-3. SUZUMI SU HANGING SCROLL TAPESTRY MOVED TO ORIGINAL WOODEN PLAQUE LOCATION (涼海紅色掛軸移至原木牌位置 X = -0.82) ---
    const suzumiScrollTexture = texMgr.loadTexture('/assets/suzumi_scroll_tex.webp');
    suzumiScrollTexture.colorSpace = THREE.SRGBColorSpace;
    suzumiScrollTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const suzumiScrollGroup = new THREE.Group();
    const SCROLL2_W = 0.45;
    const SCROLL2_H = 1.20; // Exact 600 : 1600 ratio matching tapestry artwork

    // 1. Subdivided gently draping tapestry cloth mesh
    const scroll2ClothGeo = new THREE.PlaneGeometry(SCROLL2_W, SCROLL2_H, 12, 24);
    const s2Pos = scroll2ClothGeo.attributes.position;
    for (let i = 0; i < s2Pos.count; i++) {
      const sx = s2Pos.getX(i);
      const sy = s2Pos.getY(i);
      const ny = (sy + SCROLL2_H / 2) / SCROLL2_H; // 0 bottom .. 1 top
      const nx = sx / (SCROLL2_W / 2); // -1 .. +1
      // Very gentle vertical cloth drape wave so it doesn't look flat
      const drapeZ =
        Math.sin(ny * Math.PI) * 0.0045 +
        Math.cos(nx * Math.PI) * 0.0025 * Math.sin(ny * Math.PI);
      s2Pos.setY(i, sy - SCROLL2_H / 2); // Pivot at top rod y = 0
      s2Pos.setZ(i, 0.010 + drapeZ);
    }
    scroll2ClothGeo.computeVertexNormals();

    const suzumiFrontMesh = new THREE.Mesh(
      scroll2ClothGeo,
      new THREE.MeshStandardMaterial({
        map: suzumiScrollTexture,
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0.03,
      })
    );
    suzumiFrontMesh.castShadow = true;
    suzumiFrontMesh.receiveShadow = true;
    suzumiScrollGroup.add(suzumiFrontMesh);

    // 2. Dark burgundy back cloth lining for realistic edge thickness
    const suzumiBackMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SCROLL2_W, SCROLL2_H),
      new THREE.MeshStandardMaterial({
        color: 0x1b0e14,
        roughness: 0.9,
        side: THREE.FrontSide,
      })
    );
    suzumiBackMesh.position.set(0, -SCROLL2_H / 2, 0.0085);
    suzumiBackMesh.rotation.y = Math.PI;
    suzumiScrollGroup.add(suzumiBackMesh);

    // 3. Top & Bottom matte black horizontal scroll rods with end caps
    const scroll2RodMat = new THREE.MeshStandardMaterial({
      color: 0x141418,
      roughness: 0.42,
      metalness: 0.14,
    });
    const scroll2RodGeo = new THREE.CylinderGeometry(0.0085, 0.0085, SCROLL2_W + 0.024, 16);
    scroll2RodGeo.rotateZ(Math.PI / 2);

    const topRod2 = new THREE.Mesh(scroll2RodGeo, scroll2RodMat);
    topRod2.position.set(0, 0.004, 0.011);
    topRod2.castShadow = true;
    suzumiScrollGroup.add(topRod2);

    const botRod2 = new THREE.Mesh(scroll2RodGeo, scroll2RodMat);
    botRod2.position.set(0, -SCROLL2_H - 0.004, 0.011);
    botRod2.castShadow = true;
    suzumiScrollGroup.add(botRod2);

    // 4. Crisp white hanging cord triangle rising from top dowel ends to wall pin
    const cordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-SCROLL2_W / 2 + 0.016, 0.008, 0.011),
      new THREE.Vector3(-SCROLL2_W / 4 + 0.008, 0.078, 0.007),
      new THREE.Vector3(0, 0.146, 0.004),
      new THREE.Vector3(SCROLL2_W / 4 - 0.008, 0.078, 0.007),
      new THREE.Vector3(SCROLL2_W / 2 - 0.016, 0.008, 0.011),
    ]);
    const cordMesh = new THREE.Mesh(
      new THREE.TubeGeometry(cordCurve, 24, 0.0024, 8, false),
      new THREE.MeshStandardMaterial({
        color: 0xedeff2,
        roughness: 0.72,
        metalness: 0.02,
      })
    );
    cordMesh.castShadow = true;
    suzumiScrollGroup.add(cordMesh);

    // 5. Small silver wall pin/nail at hanging apex
    const scroll2Pin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0032, 0.0032, 0.016, 10),
      new THREE.MeshStandardMaterial({ color: 0xbac0c8, roughness: 0.3, metalness: 0.8 })
    );
    scroll2Pin.rotation.x = Math.PI / 2;
    scroll2Pin.position.set(0, 0.148, 0.005);
    suzumiScrollGroup.add(scroll2Pin);

    // Mount on front wall to the right of the lobby door where the studio wooden plaque was originally placed (X = -2.54)
    suzumiScrollGroup.position.set(-2.54, 2.35, -ROOM_DEPTH / 2);
    roomGroup.add(suzumiScrollGroup);

    // Gentle warm spotlight illuminating the hanging scroll
    const suzumiScrollSpot = new THREE.PointLight(0xffeed6, 0.85, 3.2, 1.25);
    suzumiScrollSpot.position.set(-2.54, 2.10, -ROOM_DEPTH / 2 + 0.72);
    roomGroup.add(suzumiScrollSpot);

    // --- 4A-4. INTERACTIVE EVENT CALENDAR ON FRONT WALL RIGHT END (活動行事曆月曆 — 擺在原涼海紅色掛軸處 X = 1.06) ---
    const createWallCalendarTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Texture();

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth();
      const todayNum = now.getDate();

      // Deep dark-navy paper page matching CubeLendar aesthetic
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1360);
      bgGrad.addColorStop(0, '#0a162b');
      bgGrad.addColorStop(0.28, '#071224');
      bgGrad.addColorStop(1, '#0b1830');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1024, 1360);

      // Subtle pixel grid overlay
      ctx.strokeStyle = 'rgba(135, 206, 235, 0.07)';
      ctx.lineWidth = 1.5;
      for (let gx = 0; gx < 1024; gx += 32) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, 1360);
        ctx.stroke();
      }
      for (let gy = 0; gy < 1360; gy += 32) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(1024, gy);
        ctx.stroke();
      }

      // Outer sky-blue double frame border
      ctx.strokeStyle = 'rgba(135, 206, 235, 0.55)';
      ctx.lineWidth = 5;
      ctx.strokeRect(28, 34, 968, 1292);

      // Header top band
      ctx.fillStyle = 'rgba(20, 42, 78, 0.88)';
      ctx.fillRect(32, 38, 960, 238);

      // Spiral binding punch holes across very top
      for (let h = 0; h < 11; h++) {
        const hx = 102 + h * 82;
        ctx.fillStyle = '#030812';
        ctx.beginPath();
        ctx.arc(hx, 68, 11, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = '#87CEEB';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('CUBELENDAR // 紡塊像素', 70, 138);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 54px "PingFang TC", "Microsoft JhengHei", sans-serif';
      ctx.fillText('活動行事曆', 70, 204);

      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFD700';
      ctx.font = '900 62px monospace';
      ctx.fillText(`${year}.${String(month + 1).padStart(2, '0')}`, 954, 198);

      // Category Legend Dots Strip
      const categories = Object.values(CATEGORY_COLORS);
      const pillW = 128;
      categories.forEach((cat, idx) => {
        const px = 64 + idx * (pillW + 4);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(px, 294, pillW, 44);
        ctx.fillStyle = cat.hex;
        ctx.beginPath();
        ctx.arc(px + 18, 316, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 19px "PingFang TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(cat.label, px + 32, 323);
      });

      // Weekday Headers (Mon..Sun)
      const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
      const gridLeft = 56;
      const gridTop = 368;
      const cellW = 124;
      const cellH = 122;
      const colGap = 8;
      const rowGap = 10;

      weekdays.forEach((wd, idx) => {
        const cx = gridLeft + idx * (cellW + colGap) + cellW / 2;
        ctx.textAlign = 'center';
        ctx.fillStyle = idx >= 5 ? '#FF94B2' : '#94a3b8';
        ctx.font = 'bold 28px "PingFang TC", "Microsoft JhengHei", sans-serif';
        ctx.fillText(wd, cx, gridTop + 26);
      });

      // Month Grid Cells
      const firstDay = new Date(year, month, 1);
      let firstDow = firstDay.getDay();
      firstDow = firstDow === 0 ? 6 : firstDow - 1;
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let cell = 0; cell < 42; cell++) {
        const row = Math.floor(cell / 7);
        const col = cell % 7;
        const cx = gridLeft + col * (cellW + colGap);
        const cy = gridTop + 52 + row * (cellH + rowGap);

        const dayOffset = cell - firstDow + 1;
        const isCurrentMonth = dayOffset >= 1 && dayOffset <= daysInMonth;
        const dObj = new Date(year, month, dayOffset);
        const dYear = dObj.getFullYear();
        const dMonth = String(dObj.getMonth() + 1).padStart(2, '0');
        const dDay = String(dObj.getDate()).padStart(2, '0');
        const dateStr = `${dYear}-${dMonth}-${dDay}`;
        const dayEvents = getEventsForDate(dateStr);
        const isToday = isCurrentMonth && dayOffset === todayNum;

        ctx.fillStyle = isToday
          ? 'rgba(135, 206, 235, 0.24)'
          : dayEvents.length > 0 && isCurrentMonth
            ? `${CATEGORY_COLORS[dayEvents[0].category].hex}22`
            : 'rgba(255, 255, 255, 0.035)';
        ctx.fillRect(cx, cy, cellW, cellH);

        ctx.strokeStyle = isToday
          ? '#87CEEB'
          : dayEvents.length > 0 && isCurrentMonth
            ? `${CATEGORY_COLORS[dayEvents[0].category].hex}99`
            : 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = isToday ? 3.5 : 1.5;
        ctx.strokeRect(cx, cy, cellW, cellH);

        ctx.textAlign = 'center';
        ctx.fillStyle = isCurrentMonth
          ? isToday
            ? '#ffffff'
            : dayEvents.length > 0
              ? CATEGORY_COLORS[dayEvents[0].category].hex
              : '#e2e8f0'
          : 'rgba(255, 255, 255, 0.22)';
        ctx.font = `900 ${isToday ? 38 : 34}px monospace`;
        ctx.fillText(String(dObj.getDate()), cx + cellW / 2, cy + 56);

        if (dayEvents.length > 0) {
          const dots = dayEvents.slice(0, 3);
          const totalW = (dots.length - 1) * 18;
          dots.forEach((ev, di) => {
            ctx.fillStyle = CATEGORY_COLORS[ev.category].hex;
            ctx.beginPath();
            ctx.arc(cx + cellW / 2 - totalW / 2 + di * 18, cy + 92, 6, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      // Bottom interactive callout bar
      ctx.fillStyle = 'rgba(135, 206, 235, 0.14)';
      ctx.fillRect(56, 1244, 912, 56);
      ctx.strokeStyle = 'rgba(135, 206, 235, 0.45)';
      ctx.lineWidth = 2;
      ctx.strokeRect(56, 1244, 912, 56);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#bae6fd';
      ctx.font = 'bold 26px "PingFang TC", "Microsoft JhengHei", sans-serif';
      ctx.fillText('點擊月曆查看完整活動行事曆 ↗', 512, 1281);

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      return texture;
    };

    const wallCalendarTexture = createWallCalendarTexture();
    const wallCalendarGroup = new THREE.Group();
    const CAL_W = 0.52;
    const CAL_H = 0.69;

    // 1. Dark walnut/slate backing board slightly larger than paper stack
    const calBackBoard = new THREE.Mesh(
      new THREE.BoxGeometry(CAL_W + 0.036, CAL_H + 0.044, 0.012),
      new THREE.MeshStandardMaterial({ color: 0x1c130d, roughness: 0.56, metalness: 0.08 })
    );
    calBackBoard.position.set(0, 0, 0.008);
    calBackBoard.castShadow = true;
    calBackBoard.receiveShadow = true;
    wallCalendarGroup.add(calBackBoard);

    // 2. Layered paper page stack beneath top calendar sheet
    const calPaperStack = new THREE.Mesh(
      new THREE.BoxGeometry(CAL_W, CAL_H, 0.009),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85, metalness: 0.0 })
    );
    calPaperStack.position.set(0, -0.004, 0.018);
    calPaperStack.castShadow = true;
    calPaperStack.receiveShadow = true;
    wallCalendarGroup.add(calPaperStack);

    // 3. Printed front calendar sheet
    const calFrontSheet = new THREE.Mesh(
      new THREE.PlaneGeometry(CAL_W, CAL_H),
      new THREE.MeshStandardMaterial({
        map: wallCalendarTexture,
        color: 0xffffff,
        roughness: 0.58,
        metalness: 0.04,
      })
    );
    calFrontSheet.position.set(0, -0.004, 0.0235);
    calFrontSheet.receiveShadow = true;
    wallCalendarGroup.add(calFrontSheet);

    // 4. Top twin-wire silver spiral rings
    const calSpiralMat = new THREE.MeshStandardMaterial({
      color: 0xdbe2ea,
      roughness: 0.24,
      metalness: 0.86,
    });
    const spiralRingGeo = new THREE.TorusGeometry(0.011, 0.0022, 8, 18);
    for (let i = 0; i < 11; i++) {
      const sx = -CAL_W / 2 + 0.038 + i * ((CAL_W - 0.076) / 10);
      const ring = new THREE.Mesh(spiralRingGeo, calSpiralMat);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(sx, CAL_H / 2 - 0.008, 0.022);
      wallCalendarGroup.add(ring);
    }

    // 5. Top hanging wire & wall nail pin
    const calCordCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.14, CAL_H / 2 + 0.014, 0.014),
      new THREE.Vector3(0, CAL_H / 2 + 0.095, 0.006),
      new THREE.Vector3(0.14, CAL_H / 2 + 0.014, 0.014),
    ]);
    const calCordMesh = new THREE.Mesh(
      new THREE.TubeGeometry(calCordCurve, 18, 0.0020, 8, false),
      calSpiralMat
    );
    wallCalendarGroup.add(calCordMesh);

    const calNailPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0036, 0.0036, 0.018, 10),
      calSpiralMat
    );
    calNailPin.rotation.x = Math.PI / 2;
    calNailPin.position.set(0, CAL_H / 2 + 0.096, 0.006);
    wallCalendarGroup.add(calNailPin);

    // 6. Invisible generous hitbox for easy tapping/clicking
    const wallCalendarHitbox = new THREE.Mesh(
      new THREE.BoxGeometry(CAL_W + 0.14, CAL_H + 0.16, 0.14),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    wallCalendarHitbox.name = 'wall_calendar_hitbox';
    wallCalendarHitbox.position.set(0, 0, 0.03);
    wallCalendarHitboxRef.current = wallCalendarHitbox;
    wallCalendarGroup.add(wallCalendarHitbox);

    wallCalendarGroup.position.set(1.06, 1.84, -ROOM_DEPTH / 2);
    roomGroup.add(wallCalendarGroup);

    // Warm accent spotlight illuminating the front-right Event Calendar
    const wallCalendarSpot = new THREE.PointLight(0xffeed6, 0.85, 3.2, 1.25);
    wallCalendarSpot.position.set(1.06, 2.15, -ROOM_DEPTH / 2 + 0.72);
    roomGroup.add(wallCalendarSpot);

    // --- 4B. ENLARGED CIRCULAR WOODEN TEA TABLE & TABLE LAMP (放大並改為圓形木茶几，附設雅緻檯燈) ---
    const centerTeaGroup = new THREE.Group();
    centerTeaGroup.position.set(0, 0, 0); // Exact center of the room

    const TEA_TABLE_RADIUS = 0.85; // 圓形茶几半徑 (直徑 1.7m，大器且舒適)
    const TEA_TABLE_HEIGHT = 0.36; // 茶几高度
    const TEA_TABLE_TOP_THICK = 0.045; // 實木厚度

    // Circular Tabletop Slab
    const teaTopGeo = new THREE.CylinderGeometry(TEA_TABLE_RADIUS, TEA_TABLE_RADIUS, TEA_TABLE_TOP_THICK, 48);
    const teaTop = new THREE.Mesh(teaTopGeo, tableMat);
    teaTop.position.set(0, TEA_TABLE_HEIGHT - TEA_TABLE_TOP_THICK / 2, 0);
    teaTop.castShadow = true;
    teaTop.receiveShadow = true;
    centerTeaGroup.add(teaTop);

    // Beveled Round Edge Trim
    const roundRimGeo = new THREE.TorusGeometry(TEA_TABLE_RADIUS, 0.018, 16, 48);
    const roundRimMesh = new THREE.Mesh(roundRimGeo, tableDarkWoodMat);
    roundRimMesh.position.set(0, TEA_TABLE_HEIGHT - TEA_TABLE_TOP_THICK / 2, 0);
    roundRimMesh.rotation.x = Math.PI / 2;
    centerTeaGroup.add(roundRimMesh);

    // 4 Curved / Angled Sturdy Wooden Legs under Round Table
    const legRadius = TEA_TABLE_RADIUS - 0.20;
    const roundLegHeight = TEA_TABLE_HEIGHT - TEA_TABLE_TOP_THICK;
    const roundLegGeo = new THREE.BoxGeometry(0.065, roundLegHeight, 0.065);
    
    [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].forEach((angle) => {
      const lx = Math.cos(angle) * legRadius;
      const lz = Math.sin(angle) * legRadius;
      const leg = new THREE.Mesh(roundLegGeo, tableDarkWoodMat);
      leg.position.set(lx, roundLegHeight / 2, lz);
      leg.rotation.y = -angle;
      leg.castShadow = true;
      centerTeaGroup.add(leg);
    });

    // Cross brace frame under the tabletop
    const braceGeo = new THREE.BoxGeometry(legRadius * 2, 0.035, 0.035);
    const brace1 = new THREE.Mesh(braceGeo, tableDarkWoodMat);
    brace1.position.set(0, 0.12, 0);
    brace1.rotation.y = Math.PI * 0.25;
    centerTeaGroup.add(brace1);

    const brace2 = new THREE.Mesh(braceGeo, tableDarkWoodMat);
    brace2.position.set(0, 0.12, 0);
    brace2.rotation.y = Math.PI * 0.75;
    centerTeaGroup.add(brace2);

    // --- TABLE LAMP ON TEA TABLE (User Request: 在茶几上擺上一個檯燈) ---
    const lampGroup = new THREE.Group();
    // Positioned gracefully on the round tea table (slightly offset to the left-rear to frame the tea tray)
    lampGroup.position.set(-0.35, TEA_TABLE_HEIGHT, -0.15);

    // 1. Heavy dark bronze/ceramic lamp base
    const lampBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1b1512,
      roughness: 0.35,
      metalness: 0.25,
    });
    const lampBaseGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.032, 24);
    const lampBase = new THREE.Mesh(lampBaseGeo, lampBaseMat);
    lampBase.position.y = 0.016;
    lampBase.castShadow = true;
    lampGroup.add(lampBase);

    // Brass accent ring above base
    const brassRingGeo = new THREE.TorusGeometry(0.08, 0.01, 12, 24);
    const brassRing = new THREE.Mesh(brassRingGeo, brassMat);
    brassRing.position.y = 0.034;
    brassRing.rotation.x = Math.PI / 2;
    lampGroup.add(brassRing);

    // 2. Sculpted wooden/ceramic stem neck
    const lampStemGeo = new THREE.CylinderGeometry(0.020, 0.040, 0.16, 16);
    const lampStem = new THREE.Mesh(lampStemGeo, tableDarkWoodMat);
    lampStem.position.y = 0.115;
    lampStem.castShadow = true;
    lampGroup.add(lampStem);

    // 3. Washi Paper / Pleated Drum Lampshade (透光和紙燈罩)
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0xfff0dc,
      roughness: 0.85,
      side: THREE.DoubleSide,
    });
    const lampShadeGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.20, 24, 1, true);
    const lampShade = new THREE.Mesh(lampShadeGeo, lampShadeMat);
    lampShade.position.y = 0.27;
    lampShade.castShadow = true;
    lampGroup.add(lampShade);

    // Dark wood top & bottom shade rims
    const shadeRimTop = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.007, 12, 24), tableDarkWoodMat);
    shadeRimTop.position.y = 0.37;
    shadeRimTop.rotation.x = Math.PI / 2;
    lampGroup.add(shadeRimTop);

    const shadeRimBottom = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.007, 12, 24), tableDarkWoodMat);
    shadeRimBottom.position.y = 0.17;
    shadeRimBottom.rotation.x = Math.PI / 2;
    lampGroup.add(shadeRimBottom);

    // Internal soft incandescent bulb
    const lampBulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.024, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffeacc })
    );
    lampBulb.position.y = 0.26;
    lampGroup.add(lampBulb);

    // Table Lamp Point Light casting warm intimate glow on the tabletop & surroundings
    const tableLampLight = new THREE.PointLight(0xffdf9a, isLampOn ? 2.8 : 0, 5.2, 1.25);
    tableLampLight.position.y = 0.27;
    tableLampLight.castShadow = true;
    lampGroup.add(tableLampLight);

    // Dedicated invisible interaction hitbox around the lamp for responsive tap/click
    const lampHitboxGeo = new THREE.CylinderGeometry(0.172, 0.172, 0.52, 16);
    const lampHitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const lampHitbox = new THREE.Mesh(lampHitboxGeo, lampHitboxMat);
    lampHitbox.position.y = 0.24;
    lampHitbox.name = 'lamp_hitbox';
    lampGroup.add(lampHitbox);
    lampHitboxRef.current = lampHitbox;

    // Save refs for dynamic toggle and tap detection
    lampLightRef.current = tableLampLight;
    lampBulbMatRef.current = lampBulb.material as THREE.MeshBasicMaterial;
    lampShadeMatRef.current = lampShadeMat;
    lampGroupRef.current = lampGroup;

    centerTeaGroup.add(lampGroup);

    // --- 40CM ROUND PADDLE FAN ON TEA TABLE (優化版 40 公分直徑圓扇) ---
    const fanTexture = texMgr.loadTexture('/assets/round_fan_tex.webp');
    fanTexture.colorSpace = THREE.SRGBColorSpace;
    fanTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const fanGroup = new THREE.Group();
    const FAN_RADIUS = 0.20; // Diameter = 40 cm (0.40 m)

    const fanPlasticMat = new THREE.MeshStandardMaterial({
      color: 0x131418,
      roughness: 0.56,
      metalness: 0.08,
    });
    const fanPrintMat = new THREE.MeshPhysicalMaterial({
      map: fanTexture,
      color: 0xffffff,
      roughness: 0.30,
      metalness: 0.02,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      alphaTest: 0.45,
    });

    // 1. Solid PP plastic backing core disk (40 cm diameter)
    const fanCoreGeo = new THREE.CylinderGeometry(FAN_RADIUS - 0.001, FAN_RADIUS - 0.001, 0.0020, 64);
    fanCoreGeo.rotateX(Math.PI / 2);
    const fanCore = new THREE.Mesh(fanCoreGeo, fanPlasticMat);
    fanCore.castShadow = true;
    fanCore.receiveShadow = true;
    fanGroup.add(fanCore);

    // 2. Crisp 1024px printed laminated circular fan face
    const fanFace = new THREE.Mesh(new THREE.CircleGeometry(FAN_RADIUS - 0.001, 64), fanPrintMat);
    fanFace.position.z = 0.0015;
    fanFace.receiveShadow = true;
    fanGroup.add(fanFace);

    // 3. Outer molded black plastic rim framing the artwork cleanly without covering edge lettering
    const fanRim = new THREE.Mesh(new THREE.TorusGeometry(FAN_RADIUS + 0.0022, 0.0038, 14, 72), fanPlasticMat);
    fanRim.castShadow = true;
    fanGroup.add(fanRim);

    // 4. Flared neck junction joining blade bottom edge into ribbed handle
    const neckShape = new THREE.Shape();
    neckShape.moveTo(-0.044, -FAN_RADIUS + 0.004);
    neckShape.lineTo(0.044, -FAN_RADIUS + 0.004);
    neckShape.quadraticCurveTo(0.020, -FAN_RADIUS - 0.020, 0.015, -FAN_RADIUS - 0.045);
    neckShape.lineTo(-0.015, -FAN_RADIUS - 0.045);
    neckShape.quadraticCurveTo(-0.020, -FAN_RADIUS - 0.020, -0.044, -FAN_RADIUS + 0.004);
    neckShape.closePath();

    const neckGeo = new THREE.ExtrudeGeometry(neckShape, {
      depth: 0.0056,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 2,
    });
    neckGeo.translate(0, 0, -0.0028);
    const fanNeck = new THREE.Mesh(neckGeo, fanPlasticMat);
    fanNeck.castShadow = true;
    fanGroup.add(fanNeck);

    // Molded V-shaped structural gusset ribs along neck junction
    [-0.014, 0, 0.014].forEach((offsetX, idx) => {
      const neckRib = new THREE.Mesh(new THREE.BoxGeometry(0.0022, 0.044, 0.0082), fanPlasticMat);
      neckRib.position.set(offsetX * 0.65, -FAN_RADIUS - 0.018, 0);
      neckRib.rotation.z = (idx - 1) * -0.28;
      fanGroup.add(neckRib);
    });

    // 5. Ribbed black handle shaft
    const HANDLE_LEN = 0.145;
    const handleBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.030, HANDLE_LEN, 0.0068),
      fanPlasticMat
    );
    handleBar.position.set(0, -FAN_RADIUS - 0.042 - HANDLE_LEN / 2 + 0.01, 0);
    handleBar.castShadow = true;
    fanGroup.add(handleBar);

    const ribGeo = new THREE.BoxGeometry(0.0024, HANDLE_LEN + 0.012, 0.0092);
    [-0.010, -0.0035, 0.0035, 0.010].forEach((rx) => {
      const rib = new THREE.Mesh(ribGeo, fanPlasticMat);
      rib.position.set(rx, -FAN_RADIUS - 0.042 - HANDLE_LEN / 2 + 0.01, 0);
      fanGroup.add(rib);
    });

    // 6. Tail circular medallion ring + mini character sticker at end of handle
    const TAIL_Y = -FAN_RADIUS - 0.042 - HANDLE_LEN - 0.018;
    const tailRing = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.0040, 14, 40), fanPlasticMat);
    tailRing.position.set(0, TAIL_Y, 0);
    tailRing.castShadow = true;
    fanGroup.add(tailRing);

    const tailBackingGeo = new THREE.CylinderGeometry(0.031, 0.031, 0.0044, 36);
    tailBackingGeo.rotateX(Math.PI / 2);
    const tailBacking = new THREE.Mesh(tailBackingGeo, fanPlasticMat);
    tailBacking.position.set(0, TAIL_Y, 0);
    fanGroup.add(tailBacking);

    const tailSticker = new THREE.Mesh(new THREE.CircleGeometry(0.029, 36), fanPrintMat);
    tailSticker.position.set(0, TAIL_Y, 0.0028);
    fanGroup.add(tailSticker);

    // Lay flat face-up on the right half of the tea table, angled neatly toward the seated viewer
    fanGroup.position.set(0.25, TEA_TABLE_HEIGHT + 0.0055, 0.01);
    fanGroup.rotation.set(-Math.PI / 2, 0, 0.22);
    centerTeaGroup.add(fanGroup);

    // --- Floor Cushions (小坐墊 / 環繞圓几的和室厚坐墊) ---
    const cushionMatCharcoal = new THREE.MeshStandardMaterial({
      color: 0x2d2823, // 深炭灰織物
      roughness: 0.85,
    });
    const cushionMatEarth = new THREE.MeshStandardMaterial({
      color: 0x3a3229, // 溫暖大地色麻布
      roughness: 0.85,
    });

    const cushionGeo = new THREE.CylinderGeometry(0.22, 0.23, 0.065, 24);
    const CUSHION_DISTANCE = TEA_TABLE_RADIUS + 0.30; // 1.15m from center

    const cushionPositions = [
      // South cushion (南側 - 面朝茶几與前方盆栽，玩家落座處)
      { x: 0, z: CUSHION_DISTANCE, mat: cushionMatEarth },
      // North cushion (北側)
      { x: 0, z: -CUSHION_DISTANCE, mat: cushionMatCharcoal },
      // East cushion (東側)
      { x: CUSHION_DISTANCE, z: 0, mat: cushionMatEarth },
      // West cushion (西側)
      { x: -CUSHION_DISTANCE, z: 0, mat: cushionMatCharcoal },
    ];

    cushionPositions.forEach((pos) => {
      const cushionGroup = new THREE.Group();
      cushionGroup.position.set(pos.x, 0.0325, pos.z);

      const cushion = new THREE.Mesh(cushionGeo, pos.mat);
      cushion.castShadow = true;
      cushion.receiveShadow = true;
      cushionGroup.add(cushion);

      // Center tuft button
      const buttonGeo = new THREE.SphereGeometry(0.016, 10, 8);
      const buttonMat = new THREE.MeshStandardMaterial({ color: 0x16120e, roughness: 0.6 });
      const button = new THREE.Mesh(buttonGeo, buttonMat);
      button.position.y = 0.033;
      button.scale.set(1, 0.4, 1);
      cushionGroup.add(button);

      centerTeaGroup.add(cushionGroup);
    });

    roomGroup.add(centerTeaGroup);

    // --- 4F. 180CM STANDING DISPLAY RACK ON FAR-LEFT SIDE (左側盡頭側面的 180 公分立牌展架) ---
    const displayRackGroup = new THREE.Group();
    const RACK_TOTAL_H = 1.80; // Real-world 180 cm height
    const FOOT_H = 0.012;
    const FRAME_BAR = 0.032;
    const FRAME_DEPTH = 0.038;
    const POSTER_W = 0.745;
    const POSTER_H = 1.614; // Exact 720 : 1560 (1 : 2.167) ratio matching photo
    const RACK_W = POSTER_W + FRAME_BAR * 2; // ~0.809 m
    const BASE_D = 0.44;

    const displayPosterTexture = texMgr.loadTexture('/assets/display_rack_poster.webp');
    displayPosterTexture.colorSpace = THREE.SRGBColorSpace;
    displayPosterTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const rackMetalMat = new THREE.MeshStandardMaterial({
      color: 0x16171b,
      roughness: 0.36,
      metalness: 0.65,
    });
    const rackBaseMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e24,
      roughness: 0.46,
      metalness: 0.52,
    });
    const rackFootMat = new THREE.MeshStandardMaterial({
      color: 0x0b0b0d,
      roughness: 0.85,
      metalness: 0.05,
    });

    // 1. Four low rubber floor pads grounded flush at Y = 0
    const footGeo = new THREE.CylinderGeometry(0.020, 0.022, FOOT_H, 12);
    [
      [-RACK_W / 2 + 0.05, -BASE_D / 2 + 0.05],
      [RACK_W / 2 - 0.05, -BASE_D / 2 + 0.05],
      [-RACK_W / 2 + 0.05, BASE_D / 2 - 0.05],
      [RACK_W / 2 - 0.05, BASE_D / 2 - 0.05],
    ].forEach(([fx, fz]) => {
      const foot = new THREE.Mesh(footGeo, rackFootMat);
      foot.position.set(fx, FOOT_H / 2, fz);
      displayRackGroup.add(foot);
    });

    // 2. Weighted Sloped Black Steel Wedge Base (Y = 0.012m up to bottom of frame)
    const FRAME_BOTTOM_Y = RACK_TOTAL_H - (POSTER_H + FRAME_BAR * 2); // ~0.122m
    const wedgeShape = new THREE.Shape();
    wedgeShape.moveTo(-BASE_D / 2, 0);
    wedgeShape.lineTo(BASE_D / 2, 0);
    wedgeShape.lineTo(BASE_D / 2, 0.028);
    wedgeShape.lineTo(0.055, FRAME_BOTTOM_Y - FOOT_H + 0.014);
    wedgeShape.lineTo(-0.055, FRAME_BOTTOM_Y - FOOT_H + 0.014);
    wedgeShape.lineTo(-BASE_D / 2, 0.028);
    wedgeShape.closePath();

    const wedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
      depth: RACK_W,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    });
    // Rotate so extruded span aligns along X centered at 0, and profile lies in Y-Z plane
    wedgeGeo.rotateY(Math.PI / 2);
    wedgeGeo.translate(-RACK_W / 2, FOOT_H, 0);
    const wedgeBase = new THREE.Mesh(wedgeGeo, rackBaseMat);
    wedgeBase.castShadow = true;
    wedgeBase.receiveShadow = true;
    displayRackGroup.add(wedgeBase);

    // 3. Outer Matte-Black Aluminum Poster Frame (exact top at Y = 1.800 m)
    const FRAME_BODY_H = POSTER_H + FRAME_BAR * 2; // 1.678 m
    const topBar = new THREE.Mesh(
      new THREE.BoxGeometry(RACK_W, FRAME_BAR, FRAME_DEPTH),
      rackMetalMat
    );
    topBar.position.set(0, RACK_TOTAL_H - FRAME_BAR / 2, 0);
    topBar.castShadow = true;
    displayRackGroup.add(topBar);

    const bottomBar = new THREE.Mesh(
      new THREE.BoxGeometry(RACK_W, FRAME_BAR, FRAME_DEPTH),
      rackMetalMat
    );
    bottomBar.position.set(0, FRAME_BOTTOM_Y + FRAME_BAR / 2, 0);
    bottomBar.castShadow = true;
    displayRackGroup.add(bottomBar);

    const sideStileGeo = new THREE.BoxGeometry(FRAME_BAR, FRAME_BODY_H, FRAME_DEPTH);
    [-1, 1].forEach((side) => {
      const stile = new THREE.Mesh(sideStileGeo, rackMetalMat);
      stile.position.set(side * (POSTER_W / 2 + FRAME_BAR / 2), FRAME_BOTTOM_Y + FRAME_BODY_H / 2, 0);
      stile.castShadow = true;
      stile.receiveShadow = true;
      displayRackGroup.add(stile);
    });

    // 4. Solid Steel Backing Panel Inside Frame
    const posterCenterY = FRAME_BOTTOM_Y + FRAME_BAR + POSTER_H / 2;
    const rackBackPanel = new THREE.Mesh(
      new THREE.BoxGeometry(POSTER_W + 0.006, POSTER_H + 0.006, 0.012),
      rackBaseMat
    );
    rackBackPanel.position.set(0, posterCenterY, -0.004);
    rackBackPanel.castShadow = true;
    displayRackGroup.add(rackBackPanel);

    // 5. Front Printed CubePixel / Umiri Recruitment Poster Graphic
    const posterFrontMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(POSTER_W, POSTER_H),
      new THREE.MeshStandardMaterial({
        map: displayPosterTexture,
        color: 0xffffff,
        roughness: 0.38,
        metalness: 0.04,
      })
    );
    posterFrontMesh.position.set(0, posterCenterY, 0.006);
    posterFrontMesh.receiveShadow = true;
    displayRackGroup.add(posterFrontMesh);

    // Place sideways flush along the left wall at the far end of the room (左側盡頭側面)
    displayRackGroup.position.set(-ROOM_WIDTH / 2 + 0.38, 0, -2.92);
    displayRackGroup.rotation.y = Math.PI / 2;
    roomGroup.add(displayRackGroup);

    // Warm subtle corner fill light illuminating the 180cm display stand
    const displayRackLight = new THREE.PointLight(0xffebd0, 1.05, 4.5, 1.25);
    displayRackLight.position.set(-ROOM_WIDTH / 2 + 1.20, 2.25, -2.65);
    roomGroup.add(displayRackLight);

    // --- 4D. RIGHT-WALL HANGING SCROLL BANNER (右側櫃旁牆面的立體掛軸) ---
    const scrollGroup = new THREE.Group();
    const SCROLL_W = 0.56;
    const SCROLL_H = 1.75; // Ratio ~1 : 3.125 matching the reference banner photo
    const SHOULDER_RATIO = 1138 / 1600; // Vertical straight sides end at 71.1%
    const TIP_RATIO = 1588 / 1600; // V-tip vertex at 99.25%
    const scrollTexture = texMgr.loadTexture('/assets/slytherin_banner_tex.webp');
    scrollTexture.colorSpace = THREE.SRGBColorSpace;
    scrollTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // Build subdivided pentagonal cloth mesh with subtle natural fabric wave & packaging fold creases
    const buildBannerClothGeo = (zOffset: number, flipFacing: boolean) => {
      const cols = 12;
      const rows = 40;
      const positions: number[] = [];
      const uvs: number[] = [];
      const indices: number[] = [];

      for (let r = 0; r <= rows; r++) {
        const t = (r / rows) * TIP_RATIO;
        const y = -t * SCROLL_H;
        const halfWidthFrac =
          t <= SHOULDER_RATIO
            ? 1.0
            : Math.max(0.002, 1 - (t - SHOULDER_RATIO) / (TIP_RATIO - SHOULDER_RATIO));

        // Gentle cloth drape & faint horizontal fold ridges seen in the reference photo
        const topPinned = Math.min(1, t / 0.08);
        const foldRidge =
          Math.exp(-Math.pow((t - 0.27) * 42, 2)) * 0.0045 +
          Math.exp(-Math.pow((t - 0.52) * 42, 2)) * 0.0055 +
          Math.exp(-Math.pow((t - 0.74) * 42, 2)) * 0.0045;

        for (let c = 0; c <= cols; c++) {
          const sNorm = c / cols - 0.5; // -0.5 .. +0.5
          const x = sNorm * SCROLL_W * halfWidthFrac;

          const centerCrease = (1 - Math.min(1, Math.abs(sNorm) * 6)) * 0.0045 * topPinned;
          const lateralBillow = Math.cos(sNorm * Math.PI) * 0.007 * topPinned;
          const z = zOffset + lateralBillow + centerCrease + foldRidge * topPinned;

          positions.push(x, y, z);

          // Map cleanly onto the rectified pentagon area inside slytherin_banner_tex.png
          const u = 0.498 + (x / SCROLL_W) * (500 / 512);
          const v = 1.0 - t;
          uvs.push(u, v);
        }
      }

      const stride = cols + 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = r * stride + c;
          const b = a + 1;
          const d = (r + 1) * stride + c;
          const e = d + 1;
          if (!flipFacing) {
            indices.push(a, d, b);
            indices.push(b, d, e);
          } else {
            indices.push(a, b, d);
            indices.push(b, e, d);
          }
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      return geo;
    };

    // 1. Front printed teal cloth face
    const scrollFrontGeo = buildBannerClothGeo(0.005, false);
    const scrollFrontMat = new THREE.MeshStandardMaterial({
      map: scrollTexture,
      color: 0xffffff,
      roughness: 0.76,
      metalness: 0.04,
      alphaTest: 0.45,
      transparent: false,
      side: THREE.FrontSide,
    });
    const scrollFrontMesh = new THREE.Mesh(scrollFrontGeo, scrollFrontMat);
    scrollFrontMesh.castShadow = true;
    scrollFrontMesh.receiveShadow = true;
    scrollGroup.add(scrollFrontMesh);

    // 2. Back dark cloth lining so the banner has realistic thickness from oblique corner angles
    const scrollBackGeo = buildBannerClothGeo(0.001, true);
    const scrollBackMat = new THREE.MeshStandardMaterial({
      color: 0x092420,
      roughness: 0.88,
      metalness: 0.02,
      side: THREE.FrontSide,
    });
    const scrollBackMesh = new THREE.Mesh(scrollBackGeo, scrollBackMat);
    scrollGroup.add(scrollBackMesh);

    // 3. Top stitched black fabric sleeve band (matches black top header bar in photo)
    const SLEEVE_H = 0.042;
    const sleeveGeo = new THREE.BoxGeometry(SCROLL_W + 0.006, SLEEVE_H, 0.014);
    const sleeveMat = new THREE.MeshStandardMaterial({
      color: 0x0e0f12,
      roughness: 0.84,
      metalness: 0.05,
    });
    const sleeveMesh = new THREE.Mesh(sleeveGeo, sleeveMat);
    sleeveMesh.position.set(0, -SLEEVE_H / 2 + 0.002, 0.005);
    sleeveMesh.castShadow = true;
    scrollGroup.add(sleeveMesh);

    // 4. Internal top horizontal dowel rod subtly emerging from both sleeve ends
    const rodGeo = new THREE.CylinderGeometry(0.0055, 0.0055, SCROLL_W + 0.016, 14);
    rodGeo.rotateZ(Math.PI / 2);
    const rodMat = new THREE.MeshStandardMaterial({
      color: 0x18120e,
      roughness: 0.45,
      metalness: 0.12,
    });
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.position.set(0, -SLEEVE_H / 2 + 0.002, 0.004);
    scrollGroup.add(rodMesh);

    // 5. Left & Right metallic brass grommet eyelets + wall pins in the top black strip
    const grommetGeo = new THREE.TorusGeometry(0.011, 0.0034, 10, 22);
    const pinGeo = new THREE.CylinderGeometry(0.0032, 0.0032, 0.024, 10);
    pinGeo.rotateX(Math.PI / 2);
    const pinMat = new THREE.MeshStandardMaterial({
      color: 0x3b352c,
      roughness: 0.35,
      metalness: 0.8,
    });

    [-1, 1].forEach((side) => {
      const gx = side * (SCROLL_W / 2 - 0.025);
      const gy = -SLEEVE_H / 2 + 0.002;

      const grommet = new THREE.Mesh(grommetGeo, brassMat);
      grommet.position.set(gx, gy, 0.0125);
      scrollGroup.add(grommet);

      const wallPin = new THREE.Mesh(pinGeo, pinMat);
      wallPin.position.set(gx, gy, 0.003);
      scrollGroup.add(wallPin);
    });

    // Mount green hanging flag in the center of the front wall above desk area, behind black vinyl record
    scrollGroup.position.set(0, ROOM_HEIGHT - 0.02, -ROOM_DEPTH / 2 + 0.012);
    scrollGroup.rotation.y = 0;
    roomGroup.add(scrollGroup);

    const scrollAccentLight = new THREE.PointLight(0xffebd0, 0.92, 3.8, 1.3);
    scrollAccentLight.position.set(0, ROOM_HEIGHT - 0.35, -ROOM_DEPTH / 2 + 0.65);
    roomGroup.add(scrollAccentLight);

    // Lobby Bulletin Board on right wall (原本綠掛旗的地方) - 代表最新資訊功能
    const lobbyBulletinGroup = new THREE.Group();
    const LOBBY_BB_W = 1.35;
    const LOBBY_BB_H = 1.70;
    const LOBBY_BB_BORDER = 0.044;
    const LOBBY_BB_INNER_W = LOBBY_BB_W - LOBBY_BB_BORDER * 2;
    const LOBBY_BB_INNER_H = LOBBY_BB_H - LOBBY_BB_BORDER * 2;

    const createCherryWoodTextures = () => {
      const cCanvas = document.createElement('canvas');
      cCanvas.width = 1024;
      cCanvas.height = 1024;
      const ctx = cCanvas.getContext('2d');
      const bCanvas = document.createElement('canvas');
      bCanvas.width = 512;
      bCanvas.height = 512;
      const bCtx = bCanvas.getContext('2d');
      if (ctx && bCtx) {
        // 櫻花木色底 (Warm cherry wood base - 櫻花木色)
        ctx.fillStyle = '#caa092';
        ctx.fillRect(0, 0, 1024, 1024);
        bCtx.fillStyle = '#808080';
        bCtx.fillRect(0, 0, 512, 512);

        const cherryPalette = [
          '#b98172', '#d5a99c', '#c69183', '#dda799', '#bf8677', '#cfa194', '#b37869'
        ];
        const numPlanks = 8;
        const plankH = 1024 / numPlanks;
        for (let p = 0; p < numPlanks; p++) {
          const py = p * plankH;
          const tone = cherryPalette[p % cherryPalette.length];
          ctx.fillStyle = tone;
          ctx.fillRect(0, py + 1, 1024, plankH - 2);

          for (let g = 0; g < 36; g++) {
            const gy = py + (g / 36) * plankH;
            ctx.fillStyle = g % 2 === 0 ? 'rgba(120, 58, 44, 0.16)' : 'rgba(255, 230, 220, 0.18)';
            ctx.fillRect(0, gy, 1024, 1.5);
            bCtx.fillStyle = g % 2 === 0 ? '#6e6e6e' : '#929292';
            bCtx.fillRect(0, gy * 0.5, 512, 1);
          }

          for (let f = 0; f < 250; f++) {
            const fx = Math.random() * 1024;
            const fy = py + Math.random() * plankH;
            const fw = 12 + Math.random() * 45;
            ctx.fillStyle = Math.random() > 0.5 ? 'rgba(110, 50, 38, 0.12)' : 'rgba(255, 235, 225, 0.16)';
            ctx.fillRect(fx, fy, fw, 1);
          }
        }
      }
      const colorTex = new THREE.CanvasTexture(cCanvas);
      colorTex.colorSpace = THREE.SRGBColorSpace;
      colorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      extraRoomTexturesToDispose.push(colorTex);

      const bumpTex = new THREE.CanvasTexture(bCanvas);
      extraRoomTexturesToDispose.push(bumpTex);

      return { colorTex, bumpTex };
    };

    const { colorTex: lobbyCherryColorTex, bumpTex: lobbyCherryBumpTex } = createCherryWoodTextures();

    // 胡桃木色的框 (Walnut Wood Frame)
    const lobbyBBFrameMat = new THREE.MeshStandardMaterial({
      map: tabletopTexture,
      color: 0x362013,
      roughness: 0.52,
      metalness: 0.04,
    });
    // 櫻花木色的底 (Cherry Wood Surface - 空白布告欄，無任何釘紙)
    const lobbyBBSurfaceMat = new THREE.MeshStandardMaterial({
      map: lobbyCherryColorTex,
      bumpMap: lobbyCherryBumpTex,
      bumpScale: 0.003,
      roughness: 0.58,
      metalness: 0.02,
    });
    const lobbyBBSlab = new THREE.Mesh(
      new THREE.BoxGeometry(LOBBY_BB_INNER_W, LOBBY_BB_INNER_H, 0.012),
      lobbyBBSurfaceMat
    );
    lobbyBBSlab.position.z = 0.006;
    lobbyBBSlab.receiveShadow = true;
    lobbyBulletinGroup.add(lobbyBBSlab);

    [-1, 1].forEach((ySide) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(LOBBY_BB_W, LOBBY_BB_BORDER, 0.020), lobbyBBFrameMat);
      rail.position.set(0, ySide * (LOBBY_BB_H / 2 - LOBBY_BB_BORDER / 2), 0.010);
      lobbyBulletinGroup.add(rail);
    });
    [-1, 1].forEach((xSide) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(LOBBY_BB_BORDER, LOBBY_BB_INNER_H, 0.020), lobbyBBFrameMat);
      rail.position.set(xSide * (LOBBY_BB_W / 2 - LOBBY_BB_BORDER / 2), 0, 0.010);
      lobbyBulletinGroup.add(rail);
    });

    // 預設設定成「沒有東西在上面 也不可互動」 (Blank & non-interactive)

    lobbyBulletinGroup.position.set(ROOM_WIDTH / 2 - 0.016, 1.35, -2.52);
    lobbyBulletinGroup.rotation.y = -Math.PI / 2;
    roomGroup.add(lobbyBulletinGroup);

    const lobbyBulletinAccentLight = new THREE.PointLight(0xffebd0, 0.85, 3.8, 1.3);
    lobbyBulletinAccentLight.position.set(ROOM_WIDTH / 2 - 0.75, 1.85, -2.52);
    roomGroup.add(lobbyBulletinAccentLight);

    // --- 4E. TWIN SIX-TIER DEEP DARK WOOD CABINETS (畫面右邊鏡頭底部的並排六層深木櫃) ---
    const CAB_W = 1.12;
    const CAB_D = 0.44;
    const CAB_H = 2.16;
    const PLINTH_H = 0.08;
    const CROWN_H = 0.06;
    const SIDE_THICK = 0.036;
    const SHELF_THICK = 0.032;
    const CAB_X = 3.95;
    const CAB2_X = CAB_X - (CAB_W + 0.08); // 2.75: identical cabinet directly to the left (0.02m crown seam)
    const CAB_Z = -3.26; // Back sits flush near front wall (-3.48), front face at -3.04

    const cabDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1a0d07,
      roughness: 0.52,
      metalness: 0.06,
    });
    const cabBackMat = new THREE.MeshStandardMaterial({
      color: 0x110804,
      roughness: 0.72,
      metalness: 0.03,
    });

    const createSixTierCabinet = () => {
      const cab = new THREE.Group();

      // 1. Grounded Plinth Base + Front Kickplate Trim
      const plinthCore = new THREE.Mesh(
        new THREE.BoxGeometry(CAB_W - 0.03, PLINTH_H, CAB_D - 0.03),
        cabDarkMat
      );
      plinthCore.position.set(0, PLINTH_H / 2, -0.01);
      plinthCore.castShadow = true;
      plinthCore.receiveShadow = true;
      cab.add(plinthCore);

      const kickplate = new THREE.Mesh(
        new THREE.BoxGeometry(CAB_W + 0.01, PLINTH_H * 0.85, 0.024),
        tableDarkWoodMat
      );
      kickplate.position.set(0, (PLINTH_H * 0.85) / 2, CAB_D / 2 - 0.008);
      cab.add(kickplate);

      // 2. Left & Right Vertical Side Panels + Front Stile Molding
      const bodyHeight = CAB_H - PLINTH_H - CROWN_H; // 2.02m
      const sideGeo = new THREE.BoxGeometry(SIDE_THICK, bodyHeight, CAB_D);
      const stileGeo = new THREE.BoxGeometry(0.044, bodyHeight, 0.014);

      [-1, 1].forEach((side) => {
        const sx = side * (CAB_W / 2 - SIDE_THICK / 2);
        const sidePanel = new THREE.Mesh(sideGeo, tableMat);
        sidePanel.position.set(sx, PLINTH_H + bodyHeight / 2, 0);
        sidePanel.castShadow = true;
        sidePanel.receiveShadow = true;
        cab.add(sidePanel);

        const frontStile = new THREE.Mesh(stileGeo, cabDarkMat);
        frontStile.position.set(sx, PLINTH_H + bodyHeight / 2, CAB_D / 2 + 0.005);
        frontStile.castShadow = true;
        cab.add(frontStile);
      });

      // 3. Recessed Deep Dark Wood Back Panel
      const cabBack = new THREE.Mesh(
        new THREE.BoxGeometry(CAB_W - SIDE_THICK * 2 + 0.01, bodyHeight, 0.018),
        cabBackMat
      );
      cabBack.position.set(0, PLINTH_H + bodyHeight / 2, -CAB_D / 2 + 0.01);
      cabBack.receiveShadow = true;
      cab.add(cabBack);

      // 4. Seven Horizontal Shelves Creating Six Distinct Open Tiers (六層分隔層板)
      const innerSpanW = CAB_W - SIDE_THICK * 2;
      const shelfGeo = new THREE.BoxGeometry(innerSpanW, SHELF_THICK, CAB_D - 0.02);
      const shelfLipGeo = new THREE.BoxGeometry(innerSpanW, SHELF_THICK + 0.004, 0.014);
      const tierPitch = (bodyHeight - SHELF_THICK) / 6; // 6 equal vertical bays

      for (let i = 0; i <= 6; i++) {
        const sy = PLINTH_H + SHELF_THICK / 2 + i * tierPitch;
        const shelf = new THREE.Mesh(shelfGeo, tableMat);
        shelf.position.set(0, sy, 0.004);
        shelf.castShadow = true;
        shelf.receiveShadow = true;
        cab.add(shelf);

        const shelfLip = new THREE.Mesh(shelfLipGeo, cabDarkMat);
        shelfLip.position.set(0, sy, CAB_D / 2 - 0.003);
        cab.add(shelfLip);
      }

      // 5. Stepped Crown Cornice Trim along Top Edge
      const lowerCrown = new THREE.Mesh(
        new THREE.BoxGeometry(CAB_W + 0.028, CROWN_H * 0.45, CAB_D + 0.022),
        cabDarkMat
      );
      lowerCrown.position.set(0, CAB_H - CROWN_H + (CROWN_H * 0.45) / 2, 0.008);
      lowerCrown.castShadow = true;
      cab.add(lowerCrown);

      const upperCrown = new THREE.Mesh(
        new THREE.BoxGeometry(CAB_W + 0.06, CROWN_H * 0.55, CAB_D + 0.044),
        tableDarkWoodMat
      );
      upperCrown.position.set(0, CAB_H - (CROWN_H * 0.55) / 2, 0.014);
      upperCrown.castShadow = true;
      cab.add(upperCrown);

      return cab;
    };

    const cabinetGroup = createSixTierCabinet();
    cabinetGroup.position.set(CAB_X, 0, CAB_Z);
    roomGroup.add(cabinetGroup);

    const cabinetGroupLeft = createSixTierCabinet();
    cabinetGroupLeft.position.set(CAB2_X, 0, CAB_Z);

    // --- 4E-2. ACRYLIC DESK SIGN HOLDER ON 2ND TIER FROM TOP (左邊櫃子從上數下來第二層最左側壓克力立牌) ---
    const signCardTexture = texMgr.loadTexture('/assets/umiri_desk_sign_tex.webp');
    signCardTexture.colorSpace = THREE.SRGBColorSpace;
    signCardTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const acrylicSignGroup = new THREE.Group();
    const CARD_W = 0.288;
    const CARD_H = 0.204; // Exact 1600 : 1131 ratio matching source card artwork
    const ACRYLIC_W = CARD_W + 0.016; // Clear acrylic border around card
    const ACRYLIC_H = CARD_H + 0.016;
    const TILT_RAD = -0.19; // ~11 deg backward lean like L-shaped tabletop holder

    const acrylicClearMat = new THREE.MeshPhysicalMaterial({
      color: 0xbfdbfe,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const acrylicRimMat = new THREE.MeshStandardMaterial({
      color: 0xdce6f5,
      roughness: 0.14,
      metalness: 0.12,
      transparent: true,
      opacity: 0.55,
    });

    // 1. Flat clear acrylic L-foot base plate resting flush on shelf surface Y = 0
    const footDepth = 0.082;
    const signBasePlate = new THREE.Mesh(
      new THREE.BoxGeometry(ACRYLIC_W, 0.005, footDepth),
      acrylicClearMat
    );
    signBasePlate.position.set(0, 0.0025, -footDepth * 0.34);
    acrylicSignGroup.add(signBasePlate);

    // Subtle crisp acrylic front foot rim bar
    const baseFrontEdge = new THREE.Mesh(
      new THREE.BoxGeometry(ACRYLIC_W, 0.005, 0.004),
      acrylicRimMat
    );
    baseFrontEdge.position.set(0, 0.0025, footDepth * 0.16);
    acrylicSignGroup.add(baseFrontEdge);

    // 2. Tilted acrylic sleeve + sandwiched cardstock backing + crisp printed front artwork
    const signTiltPivot = new THREE.Group();
    signTiltPivot.position.set(0, 0.005, 0.008);
    signTiltPivot.rotation.x = TILT_RAD;

    const signCenterY = ACRYLIC_H / 2;

    // Rear clear acrylic plate
    const acrylicBackSheet = new THREE.Mesh(
      new THREE.BoxGeometry(ACRYLIC_W, ACRYLIC_H, 0.003),
      acrylicClearMat
    );
    acrylicBackSheet.position.set(0, signCenterY, -0.003);
    signTiltPivot.add(acrylicBackSheet);

    // Opaque cardstock backing behind printed face
    const cardBacking = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshStandardMaterial({ color: 0xf4f1fa, roughness: 0.85, side: THREE.DoubleSide })
    );
    cardBacking.position.set(0, signCenterY, -0.0005);
    cardBacking.rotation.y = Math.PI;
    signTiltPivot.add(cardBacking);

    // Printed front card graphic
    const cardFront = new THREE.Mesh(
      new THREE.PlaneGeometry(CARD_W, CARD_H),
      new THREE.MeshStandardMaterial({
        map: signCardTexture,
        color: 0xffffff,
        roughness: 0.36,
        metalness: 0.02,
      })
    );
    cardFront.position.set(0, signCenterY, 0.0002);
    cardFront.castShadow = true;
    cardFront.receiveShadow = true;
    signTiltPivot.add(cardFront);

    // Front protective clear acrylic cover plate
    const acrylicFrontSheet = new THREE.Mesh(
      new THREE.BoxGeometry(ACRYLIC_W, ACRYLIC_H, 0.0025),
      acrylicClearMat
    );
    acrylicFrontSheet.position.set(0, signCenterY, 0.0028);
    signTiltPivot.add(acrylicFrontSheet);

    // Crisp outer beveled acrylic rim highlights (top, left, right) matching photo sleeve edges
    const topRimStrip = new THREE.Mesh(
      new THREE.BoxGeometry(ACRYLIC_W, 0.003, 0.008),
      acrylicRimMat
    );
    topRimStrip.position.set(0, ACRYLIC_H - 0.0015, 0);
    signTiltPivot.add(topRimStrip);

    const sideRimGeo = new THREE.BoxGeometry(0.003, ACRYLIC_H, 0.008);
    [-1, 1].forEach((side) => {
      const sideRim = new THREE.Mesh(sideRimGeo, acrylicRimMat);
      sideRim.position.set(side * (ACRYLIC_W / 2 - 0.0015), signCenterY, 0);
      signTiltPivot.add(sideRim);
    });

    acrylicSignGroup.add(signTiltPivot);

    // Position at far-left of 2nd shelf bay from the top (shelf index i = 4 top surface)
    const cabBodyH = CAB_H - PLINTH_H - CROWN_H;
    const cabTierPitch = (cabBodyH - SHELF_THICK) / 6;
    const secondFromTopFloorY = PLINTH_H + SHELF_THICK + 4 * cabTierPitch;
    const cabInnerLeftX = -(CAB_W - SIDE_THICK * 2) / 2;

    acrylicSignGroup.position.set(
      cabInnerLeftX + 0.022 + ACRYLIC_W / 2,
      secondFromTopFloorY,
      0.06
    );
    acrylicSignGroup.rotation.y = 0.05;
    cabinetGroupLeft.add(acrylicSignGroup);

    // --- 4E-2b. MAKAI RIRIMU PLUSHIE POUCH ON TEA TABLE BESIDE LAMP ---
    const ririmuResult = createRirimuBagGroup(true, texMgr, isLampOn);
    pouchFrontMatRef.current = ririmuResult.pouchFrontMat;
    pouchSideMatRef.current = ririmuResult.pouchSideMat;
    const ririmuBagGroup = ririmuResult.bagGroup;
    ririmuBagGroup.position.set(-0.195, TEA_TABLE_HEIGHT, -0.080);
    ririmuBagGroup.rotation.y = 0.30;
    centerTeaGroup.add(ririmuBagGroup);

    // --- 4E-2B. BOMBERGIRL RAINBOW 「最愛チアモ」 COLOR RETAIL FIGURE BOX ---
    const chiamoNewGroup = createChiamoColorBoxGroup(texMgr);
    chiamoNewGroup.position.set(
      cabInnerLeftX + 0.025 + CBOX_W / 2,
      secondFromTopFloorY,
      0.075
    );
    cabinetGroup.add(chiamoNewGroup);

    // --- 4E-3. WHITE ILLUSTRATED CARDBOARD STORAGE BOX ---
    const whiteBoxGroup = createWhiteBoxGroup(texMgr);
    const cabInnerRightX = (CAB_W - SIDE_THICK * 2) / 2;
    const bottomShelfFloorY = PLINTH_H + SHELF_THICK;
    whiteBoxGroup.position.set(
      cabInnerRightX - 0.02 - BOX_W / 2,
      bottomShelfFloorY,
      0.045
    );
    whiteBoxGroup.rotation.y = -0.025;
    cabinetGroup.add(whiteBoxGroup);

    // Warm fill light highlighting both 6-tier dark wood cabinets
    const cabinetAccentLight = new THREE.PointLight(0xffebd0, 1.35, 7.0, 1.15);
    cabinetAccentLight.position.set((CAB_X + CAB2_X) / 2, 2.28, CAB_Z + 1.15);
    roomGroup.add(cabinetAccentLight);

    scene.add(roomGroup);

    // --- 5. WARM LIGHTING RIG (MAIN LOBBY ROOM) ---
    const ambientLight = new THREE.AmbientLight(0xffecd6, 0.76);
    ambientLightRef.current = ambientLight;
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xfff5ea, 0x6e5a47, 0.46);
    hemiLightRef.current = hemiLight;
    scene.add(hemiLight);

    // Ceiling Main Downlight (10m x 7m room coverage)
    const ceilingDownlight = new THREE.PointLight(0xffebd2, 2.25, 24, 1.1);
    ceilingDownlight.position.set(0, ROOM_HEIGHT - 0.25, 0);
    ceilingDownlight.castShadow = true;
    ceilingDownlight.shadow.mapSize.width = 1024;
    ceilingDownlight.shadow.mapSize.height = 1024;
    ceilingDownlight.shadow.bias = -0.001;
    roomGroup.add(ceilingDownlight);

    // Wooden Ceiling Fixture
    const fixGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.05, 24);
    const fixMat = new THREE.MeshStandardMaterial({ color: 0x22130a, roughness: 0.5 });
    const fixture = new THREE.Mesh(fixGeo, fixMat);
    fixture.position.set(0, ROOM_HEIGHT - 0.025, 0);
    roomGroup.add(fixture);

    const diffGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.02, 24);
    const diffMat = new THREE.MeshBasicMaterial({ color: 0xefe6cc });
    const diffuser = new THREE.Mesh(diffGeo, diffMat);
    diffuser.position.set(0, ROOM_HEIGHT - 0.055, 0);
    roomGroup.add(diffuser);

    // Hanging Wooden Pendant Lamp above Center Tea Table
    const pendantGroup = new THREE.Group();
    pendantGroup.position.set(0, ROOM_HEIGHT, 0);

    const cordGeo = new THREE.CylinderGeometry(0.005, 0.005, 1.4, 8);
    const cordMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const cord = new THREE.Mesh(cordGeo, cordMat);
    cord.position.y = -0.7;
    pendantGroup.add(cord);

    const shadeGeo = new THREE.CylinderGeometry(0.24, 0.34, 0.32, 16);
    const shadeMat = new THREE.MeshStandardMaterial({ color: 0x28180c, roughness: 0.6 });
    const shade = new THREE.Mesh(shadeGeo, shadeMat);
    shade.position.y = -1.50;
    pendantGroup.add(shade);

    // Warm golden glow illuminating the tea table
    const teaTablePendantLight = new THREE.PointLight(0xffdfa4, 1.75, 7.5, 1.2);
    teaTablePendantLight.position.set(0, -1.55, 0);
    teaTablePendantLight.castShadow = true;
    pendantGroup.add(teaTablePendantLight);

    roomGroup.add(pendantGroup);

    // Directional wall wash highlighting the front wall slats & bonsai
    const wallWashLight = new THREE.DirectionalLight(0xffe8cf, 0.65);
    wallWashLight.position.set(0, 3.5, -2.0);
    wallWashLight.target = frontWall;
    roomGroup.add(wallWashLight);

    // Doorway spill light from outside behind the player
    const doorLight = new THREE.PointLight(0xffcf88, 1.30, 12);
    doorLight.position.set(0, 2.0, ROOM_DEPTH / 2 - 0.4);
    roomGroup.add(doorLight);

    // Secondary rooms are lazily built on demand when entered

    // --- 6. ANIMATION & RENDER LOOP ---
    let animationId: number;
    const clock = new THREE.Clock();

    const TABLE_VIEW_POS = new THREE.Vector3(0, SEATED_HEIGHT, SEATED_Z);
    const CABINET_VIEW_POS = new THREE.Vector3((CAB_X + CAB2_X) / 2, 1.10, CAB_Z + 2.75);
    const DOOR_VIEW_POS = new THREE.Vector3(-3.65, 1.28, -1.62);
    const CYAN_DOOR2_VIEW_POS = new THREE.Vector3(5.12, 1.28, CY_CENTER_Z);
    const ROOM_CENTER_POS = new THREE.Vector3(PR_CENTER_X, 1.38, 0);
    const PINK_DESK_VIEW_POS = new THREE.Vector3(0.76, 1.30, -2.18);
    const PINK_CAPSULE_VIEW_POS = new THREE.Vector3(-4.36, 1.78, 2.95);
    const PINK_BOARD_VIEW_POS = new THREE.Vector3(-1.72, 1.28, 1.96);

    const renderLoop = () => {
      const delta = Math.min(clock.getDelta(), 0.1);

      // Smoothly move camera between tea table, 6-tier cabinet, doors, desk, capsule pod, corkboard, and center of colored rooms
      const targetPos =
        viewLocationRef.current === 'cabinet'
          ? CABINET_VIEW_POS
          : viewLocationRef.current === 'door'
            ? DOOR_VIEW_POS
            : viewLocationRef.current === 'door2'
              ? CYAN_DOOR2_VIEW_POS
              : viewLocationRef.current === 'center'
                ? ROOM_CENTER_POS
                : viewLocationRef.current === 'desk'
                  ? PINK_DESK_VIEW_POS
                  : viewLocationRef.current === 'capsule'
                    ? PINK_CAPSULE_VIEW_POS
                    : viewLocationRef.current === 'board'
                      ? PINK_BOARD_VIEW_POS
                      : TABLE_VIEW_POS;
      playerPosRef.current.x = THREE.MathUtils.damp(playerPosRef.current.x, targetPos.x, 4.6, delta);
      playerPosRef.current.y = THREE.MathUtils.damp(playerPosRef.current.y, targetPos.y, 4.6, delta);
      playerPosRef.current.z = THREE.MathUtils.damp(playerPosRef.current.z, targetPos.z, 4.6, delta);

      cameraYawRef.current = THREE.MathUtils.damp(cameraYawRef.current, targetYawRef.current, 7.5, delta);
      cameraPitchRef.current = THREE.MathUtils.damp(cameraPitchRef.current, targetPitchRef.current, 7.5, delta);
      camera.position.copy(playerPosRef.current);
      camera.rotation.z = 0;
      camera.rotation.y = cameraYawRef.current;
      camera.rotation.x = cameraPitchRef.current;
      camera.updateMatrixWorld();

      // Smooth clockwise damped rotation for Lobby & Colored Rooms' steampunk pointers & outer gear rings
      if (portalWheelRef.current) {
        portalCurrentAngleRef.current = THREE.MathUtils.damp(
          portalCurrentAngleRef.current,
          portalTargetAngleRef.current,
          10.5,
          delta
        );
        portalWheelRef.current.rotation.z = portalCurrentAngleRef.current;
        if (portalOuterGearRef.current) {
          portalOuterGearRef.current.rotation.z = -0.5 * portalCurrentAngleRef.current;
        }
      }
      const animateDialState = (rs: ExtraRoomDoorState) => {
        if (rs.wheelGroup) {
          rs.currentAngle = THREE.MathUtils.damp(rs.currentAngle, rs.targetAngle, 10.5, delta);
          rs.wheelGroup.rotation.z = rs.currentAngle;
          if (rs.outerGearGroup) {
            rs.outerGearGroup.rotation.z = -0.5 * rs.currentAngle;
          }
        }
      };
      (['purple', 'green', 'gold', 'pink', 'cyan', 'cyan_b1', 'royalblue', 'brown'] as const).forEach((roomId) => {
        animateDialState(extraRoomsRef.current[roomId]);
      });
      animateDialState(cyanFarDoorRef.current);
      animateDialState(cyanB1FarDoorRef.current);

      // Smooth damped open/close animation for Beyblade X Compartment #1 lid on Pink Room desk
      if (beybladeLid1PivotRef.current) {
        const targetLidAngle = beybladeLid1OpenRef.current ? -1.72 : 0;
        beybladeLid1AngleRef.current = THREE.MathUtils.damp(
          beybladeLid1AngleRef.current,
          targetLidAngle,
          9.5,
          delta
        );
        beybladeLid1PivotRef.current.rotation.x = beybladeLid1AngleRef.current;
      }

      // Brief hinge rattle when clicking a locked door (pointer color doesn't match a room)
      if (doorRattleTimerRef.current > 0) {
        doorRattleTimerRef.current = Math.max(0, doorRattleTimerRef.current - delta);
        const wobble = Math.sin(doorRattleTimerRef.current * 42) * 0.014 * (doorRattleTimerRef.current / 0.35);
        if (lobbyDoorLeafPivotRef.current) lobbyDoorLeafPivotRef.current.rotation.y = wobble;
        (['purple', 'green', 'gold', 'pink', 'cyan', 'cyan_b1', 'royalblue', 'brown'] as const).forEach((roomId) => {
          const pivot = extraRoomsRef.current[roomId].doorLeafPivot;
          if (pivot) pivot.rotation.y = wobble;
        });
        if (cyanFarDoorRef.current.doorLeafPivot) cyanFarDoorRef.current.doorLeafPivot.rotation.y = wobble;
        if (cyanB1FarDoorRef.current.doorLeafPivot) cyanB1FarDoorRef.current.doorLeafPivot.rotation.y = wobble;
      } else {
        if (lobbyDoorLeafPivotRef.current) lobbyDoorLeafPivotRef.current.rotation.y = 0;
        (['purple', 'green', 'gold', 'pink', 'cyan', 'cyan_b1', 'royalblue', 'brown'] as const).forEach((roomId) => {
          const pivot = extraRoomsRef.current[roomId].doorLeafPivot;
          if (pivot) pivot.rotation.y = 0;
        });
        if (cyanFarDoorRef.current.doorLeafPivot) cyanFarDoorRef.current.doorLeafPivot.rotation.y = 0;
        if (cyanB1FarDoorRef.current.doorLeafPivot) cyanB1FarDoorRef.current.doorLeafPivot.rotation.y = 0;
      }

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(renderLoop);
    };

    animationId = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCalendarModalOpenRef.current) {
          isCalendarModalOpenRef.current = false;
          setIsCalendarModalOpen(false);
        }
        if (isMonologueOpenRef.current) {
          isMonologueOpenRef.current = false;
          setIsMonologueOpen(false);
        }
        if (isCyanFloorDialogOpenRef.current) {
          isCyanFloorDialogOpenRef.current = false;
          setIsCyanFloorDialogOpen(false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (portalSwapTimeoutRef.current !== null) window.clearTimeout(portalSwapTimeoutRef.current);
      if (portalFadeEndTimeoutRef.current !== null) window.clearTimeout(portalFadeEndTimeoutRef.current);
      texMgrRef.current?.disposeAll();

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry) obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });

      floorTexture.dispose();
      wallTexture.dispose();
      tabletopTexture.dispose();
      ceilingTexture.dispose();
      enterPortalRoomRef.current = null;
      getCarvedPlaqueTextureRef.current = null;
      doorEngravingTex.dispose();
      door2FEngravingTex.dispose();
      doorB1EngravingTex.dispose();
      extraRoomTexturesToDispose.forEach((tex) => tex.dispose());
      wallCalendarTexture.dispose();
      scrollTexture.dispose();
      displayPosterTexture.dispose();
      fanTexture.dispose();
      vinylCenterTexture.dispose();
      vinylDiscFaceTexture.dispose();
      suzumiScrollTexture.dispose();
      catFaceApricotTex.dispose();
      catFaceWhiteTex.dispose();
      catFaceRedTex.dispose();
      switchDockLogoTex.dispose();
      iineBaseLogoTex.dispose();
      roomEnvRT.dispose();
      rendererRef.current = null;
      renderer.dispose();

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [CENTER_YAW, SEATED_Z, SEATED_HEIGHT]);

  // Toggle Table Lamp when tapped
  const handleToggleLamp = () => {
    setIsLampOn((prev) => {
      const next = !prev;
      if (lampLightRef.current) {
        lampLightRef.current.intensity = next ? 2.8 : 0;
      }
      if (lampBulbMatRef.current) {
        lampBulbMatRef.current.color.set(next ? 0xffeacc : 0x221a12);
      }
      if (lampShadeMatRef.current) {
        lampShadeMatRef.current.color.set(next ? 0xfff0dc : 0x4a3a2e);
        lampShadeMatRef.current.emissive = new THREE.Color(next ? 0x332211 : 0x000000);
      }
      if (pouchFrontMatRef.current) {
        pouchFrontMatRef.current.roughness = next ? 0.22 : 0.36;
        pouchFrontMatRef.current.clearcoat = next ? 0.96 : 0.32;
        pouchFrontMatRef.current.clearcoatRoughness = next ? 0.08 : 0.24;
        pouchFrontMatRef.current.specularIntensity = next ? 1.0 : 0.42;
      }
      if (pouchSideMatRef.current) {
        pouchSideMatRef.current.roughness = next ? 0.24 : 0.36;
        pouchSideMatRef.current.clearcoat = next ? 0.85 : 0.32;
        pouchSideMatRef.current.clearcoatRoughness = next ? 0.10 : 0.24;
        pouchSideMatRef.current.specularIntensity = next ? 0.95 : 0.42;
      }
      return next;
    });
  };

    // Rotate steampunk pointer clockwise on a dial state
    const LOBBY_DIAL_COLORS = [0x65c226, 0x9333ea, 0xeab308, 0x06b6d4] as const; // 草綠色, 紫色, 金色, 青色
    const LOBBY_PLAQUE_TITLES: Record<number, string> = {
      0: '迷你像素紀念館',
      1: '練舞空間',
      2: '活動相冊書房',
      3: '樓梯',
    };

    const cycleDialState = (roomState: ExtraRoomDoorState) => {
      const nextIdx = (roomState.colorIdx + 1) % 4;
      roomState.colorIdx = nextIdx;
      roomState.targetAngle -= Math.PI / 2;
      const isSlotActive = roomState.hasColorSlot[nextIdx];
      const activeHex = roomState.colors[nextIdx];

      roomState.sectorMats.forEach((mat, idx) => {
        if (roomState.hasColorSlot[idx]) {
          const isSelected = idx === nextIdx;
          mat.emissiveIntensity = isSelected ? 0.92 : 0.10;
          mat.roughness = isSelected ? 0.16 : 0.34;
        } else {
          mat.emissiveIntensity = 0.01;
          mat.roughness = 0.78;
        }
      });
      roomState.rimGemMats.forEach((mat, idx) => {
        mat.emissiveIntensity = roomState.hasColorSlot[idx] ? (idx === nextIdx ? 1.0 : 0.14) : 0.01;
      });
      if (roomState.tipGemMat) {
        roomState.tipGemMat.color.setHex(activeHex);
        roomState.tipGemMat.emissive.setHex(isSlotActive ? activeHex : 0x050508);
        roomState.tipGemMat.emissiveIntensity = isSlotActive ? 1.0 : 0.02;
      }
      if (roomState.dialLight) {
        roomState.dialLight.color.setHex(isSlotActive ? activeHex : 0x22222c);
        roomState.dialLight.intensity = isSlotActive ? 0.72 : 0.12;
      }
      if (roomState.plaqueMat && (roomState.plaqueTitles || roomState.defaultPlaqueTitle)) {
        const nextTitle = roomState.plaqueTitles?.[nextIdx] ?? roomState.defaultPlaqueTitle;
        const tex = nextTitle ? getCarvedPlaqueTextureRef.current?.(nextTitle) : undefined;
        if (tex) {
          roomState.plaqueMat.map = tex;
          roomState.plaqueMat.needsUpdate = true;
        }
      }
    };

    const handleCyclePortalColor = (dialTarget?: ExtraRoomDoorState) => {
      if (dialTarget) {
        cycleDialState(dialTarget);
      } else if (activeRoomRef.current === 'lobby') {
        const nextIdx = (portalColorIdxRef.current + 1) % 4;
        portalColorIdxRef.current = nextIdx;
        portalTargetAngleRef.current -= Math.PI / 2;
        const activeHex = LOBBY_DIAL_COLORS[nextIdx];

        portalSectorMatsRef.current.forEach((mat, idx) => {
          const isActive = idx === nextIdx;
          mat.emissiveIntensity = isActive ? 0.90 : 0.09;
          mat.roughness = isActive ? 0.16 : 0.36;
        });
        portalRimGemMatsRef.current.forEach((mat, idx) => {
          mat.emissiveIntensity = idx === nextIdx ? 1.0 : 0.12;
        });
        if (portalGemMatRef.current) {
          portalGemMatRef.current.color.setHex(activeHex);
          portalGemMatRef.current.emissive.setHex(activeHex);
        }
        if (portalPointLightRef.current) {
          portalPointLightRef.current.color.setHex(activeHex);
          portalPointLightRef.current.intensity = 0.68;
        }
        if (lobbyPlaqueMatRef.current) {
          const nextTitle = LOBBY_PLAQUE_TITLES[nextIdx] ?? '1F';
          const tex = getCarvedPlaqueTextureRef.current?.(nextTitle);
          if (tex) {
            lobbyPlaqueMatRef.current.map = tex;
            lobbyPlaqueMatRef.current.needsUpdate = true;
          }
        }
      } else {
        cycleDialState(extraRoomsRef.current[activeRoomRef.current]);
      }

      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(14); } catch {}
      }
    };

    const ROOM_ATMOSPHERE: Record<
      RoomId,
      {
        name: string;
        floor: '1F' | '2F' | 'B1';
        bgHex: number;
        ambientColor: number;
        ambientIntensity: number;
        hemiSky: number;
        hemiGround: number;
        hemiIntensity: number;
        envIntensity: number;
      }
    > = {
      lobby: { name: '大廳', floor: '1F', bgHex: 0x0c0907, ambientColor: 0xffecd6, ambientIntensity: 0.76, hemiSky: 0xfff5ea, hemiGround: 0x6e5a47, hemiIntensity: 0.46, envIntensity: 0.26 },
      purple: { name: '紫色房間', floor: '1F', bgHex: 0x10081c, ambientColor: 0xd8b4fe, ambientIntensity: 0.80, hemiSky: 0xede0ff, hemiGround: 0x563f73, hemiIntensity: 0.48, envIntensity: 0.28 },
      green: { name: '綠色房間', floor: '1F', bgHex: 0x081406, ambientColor: 0xbef292, ambientIntensity: 0.80, hemiSky: 0xe2fcd4, hemiGround: 0x456936, hemiIntensity: 0.48, envIntensity: 0.28 },
      gold: { name: '金色房間', floor: '1F', bgHex: 0x171005, ambientColor: 0xfde68a, ambientIntensity: 0.80, hemiSky: 0xfff3c4, hemiGround: 0x785c28, hemiIntensity: 0.48, envIntensity: 0.28 },
      pink: { name: '粉色房間', floor: 'B1', bgHex: 0x181014, ambientColor: 0xfff0e6, ambientIntensity: 0.34, hemiSky: 0xfff4eb, hemiGround: 0x8a727c, hemiIntensity: 0.22, envIntensity: 0.20 },
      cyan: { name: '二樓的門廊', floor: '2F', bgHex: 0x0c0907, ambientColor: 0xffecd6, ambientIntensity: 0.78, hemiSky: 0xfff5ea, hemiGround: 0x5c686e, hemiIntensity: 0.46, envIntensity: 0.27 },
      cyan_b1: { name: '地下一樓的門廊', floor: 'B1', bgHex: 0x0c0907, ambientColor: 0xffecd6, ambientIntensity: 0.78, hemiSky: 0xfff5ea, hemiGround: 0x5c686e, hemiIntensity: 0.46, envIntensity: 0.27 },
      royalblue: { name: '寶藍色大廳', floor: '2F', bgHex: 0x0c0907, ambientColor: 0xffecd6, ambientIntensity: 0.78, hemiSky: 0xfff5ea, hemiGround: 0x52607a, hemiIntensity: 0.46, envIntensity: 0.27 },
      brown: { name: '棕色大廳', floor: '2F', bgHex: 0x0c0907, ambientColor: 0xffecd6, ambientIntensity: 0.78, hemiSky: 0xfff5ea, hemiGround: 0x6e5844, hemiIntensity: 0.46, envIntensity: 0.27 },
    };

    // Switch behind-the-door room seamlessly across 1F, 2F & B1 rooms
    const handleEnterPortalRoom = (
      targetRoom: RoomId,
      spawnView: 'table' | 'door' | 'door2' = 'door'
    ) => {
      if (portalSwapTimeoutRef.current !== null) window.clearTimeout(portalSwapTimeoutRef.current);
      if (portalFadeEndTimeoutRef.current !== null) window.clearTimeout(portalFadeEndTimeoutRef.current);

      if (portalVeilRef.current) {
        portalVeilRef.current.style.opacity = '0.94';
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([16, 40, 22]); } catch {}
      }

      portalSwapTimeoutRef.current = window.setTimeout(() => {
        if (targetRoom !== 'lobby') {
          buildSecondaryRoomOnDemand(targetRoom);
        }
        const isLobby = targetRoom === 'lobby';
        activeRoomRef.current = targetRoom;
        setActiveRoom(targetRoom);
        setIsPinkNavOpen(false);

        if (lobbyRoomGroupRef.current) lobbyRoomGroupRef.current.visible = isLobby;
        (['purple', 'green', 'gold', 'pink', 'cyan', 'cyan_b1', 'royalblue', 'brown'] as const).forEach((roomId) => {
          const rg = extraRoomsRef.current[roomId].roomGroup;
          if (rg) rg.visible = targetRoom === roomId;
        });

        const atmo = ROOM_ATMOSPHERE[targetRoom];
        if (sceneRef.current) {
          sceneRef.current.background = new THREE.Color(atmo.bgHex);
          sceneRef.current.fog = new THREE.FogExp2(atmo.bgHex, targetRoom === 'pink' ? 0.011 : 0.016);
          sceneRef.current.environmentIntensity = atmo.envIntensity;
        }
        if (rendererRef.current) {
          rendererRef.current.toneMappingExposure = targetRoom === 'pink' ? 0.78 : 0.90;
        }
        if (ambientLightRef.current) {
          ambientLightRef.current.color.setHex(atmo.ambientColor);
          ambientLightRef.current.intensity = atmo.ambientIntensity;
        }
        if (hemiLightRef.current) {
          hemiLightRef.current.color.setHex(atmo.hemiSky);
          hemiLightRef.current.groundColor.setHex(atmo.hemiGround);
          hemiLightRef.current.intensity = atmo.hemiIntensity;
        }

        viewLocationRef.current = spawnView;
        setViewLocation(spawnView);
        if (spawnView === 'table') {
          playerPosRef.current.set(0, SEATED_HEIGHT, SEATED_Z);
          targetYawRef.current = CENTER_YAW;
          cameraYawRef.current = CENTER_YAW;
        } else if (spawnView === 'door2') {
          playerPosRef.current.set(5.12, 1.28, -1.5);
          targetYawRef.current = -Math.PI / 2;
          cameraYawRef.current = -Math.PI / 2;
        } else {
          playerPosRef.current.set(-3.65, 1.28, -1.62);
          targetYawRef.current = CENTER_YAW;
          cameraYawRef.current = CENTER_YAW;
        }
        targetPitchRef.current = 0;
        cameraPitchRef.current = 0;

        portalFadeEndTimeoutRef.current = window.setTimeout(() => {
          if (portalVeilRef.current) {
            portalVeilRef.current.style.opacity = '0';
          }
        }, 60);
      }, 180);
    };
    enterPortalRoomRef.current = handleEnterPortalRoom;

    // Raycast tap handler: Dial spin, Portal Door room swap, Wall Calendar, Monologue Kraft Paper & Table Lamp toggle
    const handleSceneTap = (clientX: number, clientY: number): boolean => {
      if (isCyanFloorDialogOpenRef.current || isCalendarModalOpenRef.current || isMonologueOpenRef.current) {
        return false;
      }

      if (!containerRef.current || !cameraRef.current) return false;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), cameraRef.current);

      const triggerLockedRattle = () => {
        doorRattleTimerRef.current = 0.35;
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([12, 30, 12]); } catch {}
        }
      };

      const currentRoom = activeRoomRef.current;

      // 1. Check active room's circular steampunk dial(s) FIRST (mounted on front of door)
      if (currentRoom === 'lobby') {
        if (portalHitboxRef.current && raycasterRef.current.intersectObject(portalHitboxRef.current, false).length > 0) {
          handleCyclePortalColor();
          return true;
        }
      } else if (currentRoom === 'cyan' || currentRoom === 'cyan_b1') {
        const foyerDials = [
          extraRoomsRef.current[currentRoom],
          currentRoom === 'cyan' ? cyanFarDoorRef.current : cyanB1FarDoorRef.current,
        ];
        for (const ds of foyerDials) {
          if (ds.dialHitbox && raycasterRef.current.intersectObject(ds.dialHitbox, false).length > 0) {
            handleCyclePortalColor(ds);
            return true;
          }
        }
      } else {
        const dialHitbox = extraRoomsRef.current[currentRoom].dialHitbox;
        if (dialHitbox && raycasterRef.current.intersectObject(dialHitbox, false).length > 0) {
          handleCyclePortalColor();
          return true;
        }
      }

      // 2. Check active room's portal door click: swap room behind door if pointer color matches
      if (currentRoom === 'lobby') {
        if (lobbyDoorHitboxRef.current && raycasterRef.current.intersectObject(lobbyDoorHitboxRef.current, false).length > 0) {
          const lobbyDestinationByColorIdx: Record<number, ExtraRoomId | undefined> = {
            0: 'green',  // 草綠色 -> 綠色房間
            1: 'purple', // 紫色 -> 紫色房間
            2: 'gold',   // 金色 -> 金色房間
            3: 'cyan',   // 青色 -> 跳出「上樓」(2F門廊) / 「下樓」(B1門廊) 對話框
          };
          const dest = lobbyDestinationByColorIdx[portalColorIdxRef.current];
          if (dest === 'cyan') {
            isCyanFloorDialogOpenRef.current = true;
            setIsCyanFloorDialogOpen(true);
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate(14); } catch {}
            }
          } else if (dest) {
            handleEnterPortalRoom(dest, 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      } else if (currentRoom === 'cyan') {
        const nearDoor = extraRoomsRef.current.cyan;
        const farDoor = cyanFarDoorRef.current;
        if (nearDoor.doorHitbox && raycasterRef.current.intersectObject(nearDoor.doorHitbox, false).length > 0) {
          // Near door (12m wall): only Left (idx 3) is Cyan -> returns to Lobby; others are Black
          if (nearDoor.colorIdx === 3) {
            handleEnterPortalRoom('lobby', 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
        if (farDoor.doorHitbox && raycasterRef.current.intersectObject(farDoor.doorHitbox, false).length > 0) {
          // Far door (4m end wall): Top (0)=寶藍色, Right (1)=棕色 -> 複製「大廳邏輯」空大廳(預設面對門); Bottom/Left=黑色
          if (farDoor.colorIdx === 0) {
            handleEnterPortalRoom('royalblue', 'door');
          } else if (farDoor.colorIdx === 1) {
            handleEnterPortalRoom('brown', 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      } else if (currentRoom === 'cyan_b1') {
        const nearDoor = extraRoomsRef.current.cyan_b1;
        const farDoor = cyanB1FarDoorRef.current;
        if (nearDoor.doorHitbox && raycasterRef.current.intersectObject(nearDoor.doorHitbox, false).length > 0) {
          // Near door (12m wall): Top (0)=深橘色, Left (3)=青色 -> returns to Lobby; Right/Bottom=黑色
          if (nearDoor.colorIdx === 3) {
            handleEnterPortalRoom('lobby', 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
        if (farDoor.doorHitbox && raycasterRef.current.intersectObject(farDoor.doorHitbox, false).length > 0) {
          // Far door (4m end wall): Top (0)=深湖藍紫色, Left (3)=淺粉色 -> 粉色房間, Right/Bottom=黑色
          if (farDoor.colorIdx === 3) {
            handleEnterPortalRoom('pink', 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      } else if (currentRoom === 'pink') {
        const doorHitbox = extraRoomsRef.current.pink.doorHitbox;
        if (doorHitbox && raycasterRef.current.intersectObject(doorHitbox, false).length > 0) {
          // Top (idx 0) is Silver -> returns directly to 地下一樓的門廊 facing Door 2
          if (extraRoomsRef.current.pink.colorIdx === 0) {
            handleEnterPortalRoom('cyan_b1', 'door2');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      } else if (currentRoom === 'royalblue' || currentRoom === 'brown') {
        const doorHitbox = extraRoomsRef.current[currentRoom].doorHitbox;
        if (doorHitbox && raycasterRef.current.intersectObject(doorHitbox, false).length > 0) {
          // Top (idx 0) is Silver -> returns directly to 二樓的門廊 facing Door 2
          if (extraRoomsRef.current[currentRoom].colorIdx === 0) {
            handleEnterPortalRoom('cyan', 'door2');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      } else {
        const doorHitbox = extraRoomsRef.current[currentRoom].doorHitbox;
        if (doorHitbox && raycasterRef.current.intersectObject(doorHitbox, false).length > 0) {
          if (extraRoomsRef.current[currentRoom].colorIdx === 0) {
            handleEnterPortalRoom('lobby', 'door');
          } else {
            triggerLockedRattle();
          }
          return true;
        }
      }

      // 3. Lobby Wall Calendar tap (活動行事曆)
      if (currentRoom === 'lobby' && wallCalendarHitboxRef.current) {
        const calHits = raycasterRef.current.intersectObject(wallCalendarHitboxRef.current, false);
        if (calHits.length > 0) {
          isCalendarModalOpenRef.current = true;
          setIsCalendarModalOpen(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch {}
          }
          return true;
        }
      }

      // 4. Pink Room Corkboard Kraft Paper tap (阿璃的獨白)
      if (currentRoom === 'pink' && monologuePaperHitboxRef.current) {
        const monoHits = raycasterRef.current.intersectObject(monologuePaperHitboxRef.current, false);
        if (monoHits.length > 0) {
          isMonologueOpenRef.current = true;
          setIsMonologueOpen(true);
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(15); } catch {}
          }
          return true;
        }
      }

      // 4b. Pink Room Desk Beyblade X Box tap (點擊打開/關閉第一個格子)
      if (currentRoom === 'pink' && beybladeBoxHitboxRef.current) {
        const beyHits = raycasterRef.current.intersectObject(beybladeBoxHitboxRef.current, false);
        if (beyHits.length > 0) {
          beybladeLid1OpenRef.current = !beybladeLid1OpenRef.current;
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(14); } catch {}
          }
          return true;
        }
      }

      // 4c. Pink Room Upper Capsule Bedside Light Switch tap (膠囊艙床頭開關切換：頂燈 / 暗淺藍閱讀燈 / 雙燈 / 全關)
      if (currentRoom === 'pink' && capsuleLightSwitchHitboxRef.current) {
        const swHits = raycasterRef.current.intersectObject(capsuleLightSwitchHitboxRef.current, false);
        if (swHits.length > 0) {
          const nextMode = (capsuleLightModeRef.current + 1) % 4;
          capsuleLightModeRef.current = nextMode;
          const mainOn = nextMode === 0 || nextMode === 2;
          const readingOn = nextMode === 1 || nextMode === 2;

          if (capsuleMainLightBackRef.current) {
            capsuleMainLightBackRef.current.intensity = mainOn ? 0.48 : 0;
          }
          if (capsuleMainLightFrontRef.current) {
            capsuleMainLightFrontRef.current.intensity = mainOn ? 0.42 : 0;
          }
          if (capsuleCeilingLedMatRef.current) {
            capsuleCeilingLedMatRef.current.color.setHex(mainOn ? 0xfff6ea : 0x475569);
            capsuleCeilingLedMatRef.current.emissive.setHex(mainOn ? 0xfff0d6 : 0x000000);
            capsuleCeilingLedMatRef.current.emissiveIntensity = mainOn ? 0.68 : 0;
          }
          if (capsuleReadingLightRef.current) {
            capsuleReadingLightRef.current.intensity = readingOn ? 0.44 : 0;
          }
          if (capsuleReadingLensMatRef.current) {
            capsuleReadingLensMatRef.current.color.setHex(readingOn ? 0xdbeafe : 0x9ecae8);
            capsuleReadingLensMatRef.current.emissive.setHex(0x7dd3fc);
            capsuleReadingLensMatRef.current.emissiveIntensity = readingOn ? 0.90 : 0;
          }
          if (capsuleSwitchBtnRef.current) {
            capsuleSwitchBtnRef.current.position.z = nextMode % 2 === 1 ? -0.014 : -0.016;
            capsuleSwitchBtnRef.current.rotation.x = nextMode % 2 === 1 ? 0.08 : -0.04;
          }
          if (capsuleSwitchLedMatRef.current) {
            if (nextMode === 0) {
              capsuleSwitchLedMatRef.current.color.setHex(0xfef3c7);
              capsuleSwitchLedMatRef.current.emissive.setHex(0xfde68a);
              capsuleSwitchLedMatRef.current.emissiveIntensity = 0.75;
            } else if (nextMode === 1) {
              capsuleSwitchLedMatRef.current.color.setHex(0xbae6fd);
              capsuleSwitchLedMatRef.current.emissive.setHex(0x38bdf8);
              capsuleSwitchLedMatRef.current.emissiveIntensity = 0.85;
            } else if (nextMode === 2) {
              capsuleSwitchLedMatRef.current.color.setHex(0xe0f2fe);
              capsuleSwitchLedMatRef.current.emissive.setHex(0x7dd3fc);
              capsuleSwitchLedMatRef.current.emissiveIntensity = 0.95;
            } else {
              capsuleSwitchLedMatRef.current.color.setHex(0x64748b);
              capsuleSwitchLedMatRef.current.emissive.setHex(0x38bdf8);
              capsuleSwitchLedMatRef.current.emissiveIntensity = 0.22;
            }
          }
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(14); } catch {}
          }
          return true;
        }
      }

      if (activeRoomRef.current === 'lobby' && viewLocationRef.current === 'table') {
        // 5. Check Table Lamp tap
        if (lampGroupRef.current) {
          const lampHits = raycasterRef.current.intersectObjects(lampGroupRef.current.children, true);
          if (lampHits.length > 0) {
            handleToggleLamp();
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              try { navigator.vibrate(18); } catch {}
            }
            return true;
          }
        }
      }

      return false;
    };

  // Helper: normalize yaw into [-PI, PI] so returning to door takes the shortest turn
  const normalizeCurrentYaw = () => {
    const twoPi = Math.PI * 2;
    cameraYawRef.current = (((cameraYawRef.current + Math.PI) % twoPi) + twoPi) % twoPi - Math.PI;
  };

  // Move smoothly inside Lobby (tea table, door, cabinet)
  const handleToggleViewLocation = (target: 'door' | 'cabinet') => {
    if (isCyanFloorDialogOpenRef.current) {
      isCyanFloorDialogOpenRef.current = false;
      setIsCyanFloorDialogOpen(false);
    }
    normalizeCurrentYaw();
    const next: 'table' | 'cabinet' | 'door' | 'door2' | 'center' =
      viewLocationRef.current === target ? 'table' : target;
    viewLocationRef.current = next;
    setViewLocation(next);
    targetYawRef.current = CENTER_YAW;
    targetPitchRef.current = 0;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }
  };

  // Close or confirm the 1F Lobby Cyan door floor-choice dialog
  const handleCloseCyanFloorDialog = () => {
    isCyanFloorDialogOpenRef.current = false;
    setIsCyanFloorDialogOpen(false);
  };

  const handleSelectCyanFloor = (targetFoyer: 'cyan' | 'cyan_b1') => {
    isCyanFloorDialogOpenRef.current = false;
    setIsCyanFloorDialogOpen(false);
    enterPortalRoomRef.current?.(targetFoyer, 'door');
  };

  // Move smoothly inside non-lobby rooms:
  // - Cyan Foyers (2F / B1) swap between the two doors
  // - Royalblue & Brown 2F Lobby-logic rooms toggle between center round table and door
  // - Other 7x7 rooms toggle between door and center
  const handleToggleRoomCenterOrDoor = () => {
    normalizeCurrentYaw();
    if (isFoyerRoom(activeRoomRef.current)) {
      const next: 'door' | 'door2' = viewLocationRef.current === 'door2' ? 'door' : 'door2';
      viewLocationRef.current = next;
      setViewLocation(next);
      targetYawRef.current = next === 'door2' ? -Math.PI / 2 : CENTER_YAW;
      targetPitchRef.current = 0;
    } else if (activeRoomRef.current === 'royalblue' || activeRoomRef.current === 'brown') {
      const next: 'table' | 'door' = viewLocationRef.current === 'door' ? 'table' : 'door';
      viewLocationRef.current = next;
      setViewLocation(next);
      targetYawRef.current = CENTER_YAW;
      targetPitchRef.current = 0;
    } else {
      const next: 'door' | 'center' = viewLocationRef.current === 'center' ? 'door' : 'center';
      viewLocationRef.current = next;
      setViewLocation(next);
      targetYawRef.current = CENTER_YAW;
      targetPitchRef.current = 0;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }
  };

  // Smoothly navigate inside Pink Room (desk, upper capsule interior, corkboard, room center, or front door)
  const handleSelectPinkView = (target: 'desk' | 'capsule' | 'board' | 'center' | 'door') => {
    normalizeCurrentYaw();
    viewLocationRef.current = target;
    setViewLocation(target);
    if (target === 'desk') {
      targetYawRef.current = -0.42;
      targetPitchRef.current = -0.08;
    } else if (target === 'capsule') {
      targetYawRef.current = CENTER_YAW;
      targetPitchRef.current = -0.04;
    } else if (target === 'board') {
      targetYawRef.current = Math.PI / 2;
      targetPitchRef.current = -0.02;
    } else {
      targetYawRef.current = CENTER_YAW;
      targetPitchRef.current = 0;
    }
    setIsPinkNavOpen(false);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(15); } catch {}
    }
  };

  // Apply look rotation: Lobby-style rooms (lobby, royalblue, brown) preserve T-shape bounds;
  // Cyan Foyers (2F & B1) lock camera angle; other rooms allow 360° horizontal + slight vertical
  const applyLookDelta = (deltaX: number, deltaY: number, sensitivity: number) => {
    if (
      isFoyerRoom(activeRoomRef.current) ||
      isCyanFloorDialogOpenRef.current ||
      isCalendarModalOpenRef.current ||
      isMonologueOpenRef.current
    ) {
      return;
    }
    targetYawRef.current -= deltaX * sensitivity;
    targetPitchRef.current -= deltaY * sensitivity;

    if (isLobbyStyleRoom(activeRoomRef.current)) {
      const yawHalf = getYawRangeHalf();
      targetYawRef.current = THREE.MathUtils.clamp(
        targetYawRef.current,
        CENTER_YAW - yawHalf,
        CENTER_YAW + yawHalf
      );
      targetPitchRef.current = THREE.MathUtils.clamp(targetPitchRef.current, MIN_PITCH, MAX_PITCH);
    } else {
      const isPink = activeRoomRef.current === 'pink';
      const OTHER_MIN_PITCH = ((isPink ? -22 : -14) * Math.PI) / 180;
      const OTHER_MAX_PITCH = ((isPink ? 18 : 14) * Math.PI) / 180;
      targetPitchRef.current = THREE.MathUtils.clamp(
        targetPitchRef.current,
        OTHER_MIN_PITCH,
        OTHER_MAX_PITCH
      );
    }
  };

  // --- TOUCH HANDLERS (T-SHAPE IN LOBBY, 360° IN OTHER ROOMS + TAP INTERACTION) ---
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchTimeRef.current = performance.now();
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
      touchStartTime.current = performance.now();
      touchHasMoved.current = false;

      lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
      lookTouchIdRef.current = touch.identifier;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchTimeRef.current = performance.now();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const dx = touch.clientX - touchStartPos.current.x;
        const dy = touch.clientY - touchStartPos.current.y;
        if (Math.hypot(dx, dy) > 8) {
          touchHasMoved.current = true;
        }

        const deltaX = touch.clientX - lookLastPosRef.current.x;
        const deltaY = touch.clientY - lookLastPosRef.current.y;
        lookLastPosRef.current = { x: touch.clientX, y: touch.clientY };
        applyLookDelta(deltaX, deltaY, 0.0032);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    lastTouchTimeRef.current = performance.now();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === lookTouchIdRef.current) {
        const duration = performance.now() - touchStartTime.current;
        if (!touchHasMoved.current && duration < 400) {
          handleSceneTap(touch.clientX, touch.clientY);
        }
        lookTouchIdRef.current = null;
      }
    }
  };

  // --- DESKTOP MOUSE LOOK + SCENE OBJECT CLICK ---
  const handleMouseDown = (e: React.MouseEvent) => {
    if (performance.now() - lastTouchTimeRef.current < 600) return;
    mouseStartPos.current = { x: e.clientX, y: e.clientY };
    mouseStartTime.current = performance.now();
    mouseHasMoved.current = false;
    mouseLastPosRef.current = { x: e.clientX, y: e.clientY };
    isMouseDownRef.current = true;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (performance.now() - lastTouchTimeRef.current < 600) return;
    const dx = e.clientX - mouseStartPos.current.x;
    const dy = e.clientY - mouseStartPos.current.y;
    if (Math.hypot(dx, dy) > 6) {
      mouseHasMoved.current = true;
    }

    if (isMouseDownRef.current) {
      const deltaX = e.clientX - mouseLastPosRef.current.x;
      const deltaY = e.clientY - mouseLastPosRef.current.y;
      mouseLastPosRef.current = { x: e.clientX, y: e.clientY };
      applyLookDelta(deltaX, deltaY, 0.0026);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (performance.now() - lastTouchTimeRef.current < 600) return;
    isMouseDownRef.current = false;
    const duration = performance.now() - mouseStartTime.current;
    if (!mouseHasMoved.current && duration < 400) {
      handleSceneTap(e.clientX, e.clientY);
    }
  };

  const handleMouseLeave = () => {
    isMouseDownRef.current = false;
  };

  const handleCloseCalendarModal = () => {
    isCalendarModalOpenRef.current = false;
    setIsCalendarModalOpen(false);
  };

  const handleCloseMonologue = () => {
    isMonologueOpenRef.current = false;
    setIsMonologueOpen(false);
  };

  return (
    <div 
      className="absolute inset-0 w-full h-full select-none overflow-hidden bg-[#0c0907] touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* 3D WebGL Canvas */}
      <div 
        ref={containerRef} 
        className={`absolute inset-0 w-full h-full touch-none ${
          isFoyerRoom(activeRoom)
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing'
        }`} 
      />

      {!isSceneReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0c0907]/90 backdrop-blur-sm pointer-events-none transition-opacity duration-500">
          <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-amber-200 transition-all duration-300"
              style={{ width: `${Math.max(10, loadProgress)}%` }}
            />
          </div>
          <p className="text-xs tracking-widest text-amber-100/70 font-mono">
            載入空間材質 {loadProgress}%
          </p>
        </div>
      )}

      {/* Center Subtle Focus Ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-25">
        <div className="w-2.5 h-2.5 rounded-full border border-amber-300/70 bg-white/15 shadow-sm" />
      </div>

      {/* Portal Door Room-Switch Cross-Dissolve Veil */}
      <div
        ref={portalVeilRef}
        style={{ opacity: 0, transition: 'opacity 180ms ease-in-out' }}
        className="absolute inset-0 z-40 bg-[#0b0712] pointer-events-none"
      />

      {/* Bottom-Right Navigation Buttons */}
      {activeRoom === 'lobby' && (
        <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleViewLocation('door');
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="px-4 py-2.5 rounded-lg bg-[#1c110a]/90 border border-amber-500/45 text-amber-100 text-sm font-medium tracking-wide shadow-[0_4px_16px_rgba(0,0,0,0.55)] hover:bg-[#2a1a10] hover:border-amber-400/75 active:scale-95 transition-all cursor-pointer select-none"
          >
            {viewLocation === 'door' ? '回到茶几前面' : '去門前'}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleViewLocation('cabinet');
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className="px-4 py-2.5 rounded-lg bg-[#1c110a]/90 border border-amber-500/45 text-amber-100 text-sm font-medium tracking-wide shadow-[0_4px_16px_rgba(0,0,0,0.55)] hover:bg-[#2a1a10] hover:border-amber-400/75 active:scale-95 transition-all cursor-pointer select-none"
          >
            {viewLocation === 'cabinet' ? '回到茶几前面' : '去櫃子前面'}
          </button>
        </div>
      )}

      {/* 1F Lobby Cyan Portal Door Floor-Choice Dialog (上樓 / 下樓) */}
      {activeRoom === 'lobby' && isCyanFloorDialogOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4"
          onClick={(e) => {
            e.stopPropagation();
            handleCloseCyanFloorDialog();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="選擇前往樓層"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[300px] rounded-2xl bg-[#160e09]/95 border border-cyan-400/50 p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)]"
          >
            <p className="text-xs font-medium tracking-[0.18em] text-cyan-300/80 mb-1">
              青色傳送門
            </p>
            <h2 className="text-base font-semibold text-amber-50 tracking-wide mb-4">
              請選擇前往樓層
            </h2>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectCyanFloor('cyan')}
                className="w-full py-3 px-4 rounded-xl bg-[#0b2530] border border-cyan-400/60 text-cyan-50 text-sm font-semibold tracking-wider shadow-[0_4px_14px_rgba(6,182,212,0.18)] hover:bg-[#113747] hover:border-cyan-300 active:scale-95 transition-all cursor-pointer select-none flex items-center justify-between"
              >
                <span>上樓</span>
                <span className="text-xs font-normal text-cyan-200/80">2F 門廊</span>
              </button>
              <button
                type="button"
                onClick={() => handleSelectCyanFloor('cyan_b1')}
                className="w-full py-3 px-4 rounded-xl bg-[#0b2530] border border-cyan-400/60 text-cyan-50 text-sm font-semibold tracking-wider shadow-[0_4px_14px_rgba(6,182,212,0.18)] hover:bg-[#113747] hover:border-cyan-300 active:scale-95 transition-all cursor-pointer select-none flex items-center justify-between"
              >
                <span>下樓</span>
                <span className="text-xs font-normal text-cyan-200/80">B1 門廊</span>
              </button>
              <button
                type="button"
                onClick={handleCloseCyanFloorDialog}
                className="mt-1 w-full py-2 px-4 rounded-lg bg-transparent border border-amber-500/25 text-amber-200/75 text-xs tracking-wider hover:bg-white/5 hover:text-amber-100 active:scale-95 transition-all cursor-pointer select-none"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lobby Wall Event Calendar Modal (活動行事曆彈窗) */}
      {isCalendarModalOpen && (
        <div
          className="fixed inset-0 z-[9000] flex items-center justify-center bg-[#020817]/88 p-3 sm:p-6 overflow-y-auto"
          onClick={(e) => {
            e.stopPropagation();
            handleCloseCalendarModal();
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="紡塊像素活動行事曆"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-[#040d1e] border border-sky-300/30 shadow-[0_24px_70px_rgba(0,0,0,0.85)]"
          >
            <button
              type="button"
              onClick={handleCloseCalendarModal}
              aria-label="關閉行事曆"
              className="sticky top-3 float-right mr-3 mt-3 z-20 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/15 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <EventCalendar mode="all" />
          </div>
        </div>
      )}

      {/* Pink Room Monologue Enlarged Modal (阿璃的獨白放大閱讀) */}
      {isMonologueOpen && (
        <div
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <EscalatorMonologueSubpage onClose={handleCloseMonologue} />
        </div>
      )}

      {/* Non-Lobby Rooms Bottom-Right Button(s) */}
      {activeRoom !== 'lobby' && activeRoom === 'pink' && (
        <div
          className="absolute bottom-5 right-5 z-30 flex flex-col items-end"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {/* Compact Unified Light-Blue Pixel-Heart Container Button UI */}
          <div
            className={`flex flex-col items-end transition-all duration-200 ${
              isPinkNavOpen
                ? 'bg-[#0d1c2e]/92 backdrop-blur-md border border-sky-300/55 rounded-xl p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.62)] gap-1'
                : ''
            }`}
          >
            {isPinkNavOpen && (
              <div className="flex flex-col gap-1 w-full min-w-[114px]">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPinkView('desk');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide active:scale-95 transition-all cursor-pointer select-none border text-center ${
                    viewLocation === 'desk'
                      ? 'bg-[#1c4069] border-sky-200 text-white shadow-[0_0_10px_rgba(154,221,255,0.35)]'
                      : 'bg-[#12263f]/85 border-sky-300/35 text-sky-100 hover:bg-[#193557] hover:border-sky-200/75'
                  }`}
                >
                  去書桌前
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPinkView('capsule');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide active:scale-95 transition-all cursor-pointer select-none border text-center ${
                    viewLocation === 'capsule'
                      ? 'bg-[#1c4069] border-sky-200 text-white shadow-[0_0_10px_rgba(154,221,255,0.35)]'
                      : 'bg-[#12263f]/85 border-sky-300/35 text-sky-100 hover:bg-[#193557] hover:border-sky-200/75'
                  }`}
                >
                  去膠囊艙裡
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPinkView('board');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide active:scale-95 transition-all cursor-pointer select-none border text-center ${
                    viewLocation === 'board'
                      ? 'bg-[#1c4069] border-sky-200 text-white shadow-[0_0_10px_rgba(154,221,255,0.35)]'
                      : 'bg-[#12263f]/85 border-sky-300/35 text-sky-100 hover:bg-[#193557] hover:border-sky-200/75'
                  }`}
                >
                  去佈告欄前
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPinkView(viewLocation === 'center' ? 'door' : 'center');
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium tracking-wide active:scale-95 transition-all cursor-pointer select-none border text-center ${
                    viewLocation === 'center'
                      ? 'bg-[#1c4069] border-sky-200 text-white shadow-[0_0_10px_rgba(154,221,255,0.35)]'
                      : 'bg-[#12263f]/85 border-sky-300/35 text-sky-100 hover:bg-[#193557] hover:border-sky-200/75'
                  }`}
                >
                  {viewLocation === 'center' ? '去門前' : '去房間正中央'}
                </button>
              </div>
            )}

            <button
              type="button"
              aria-label="房間位置選單"
              onClick={(e) => {
                e.stopPropagation();
                setIsPinkNavOpen((prev) => !prev);
                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  try { navigator.vibrate(12); } catch {}
                }
              }}
              className={`group flex items-center justify-center rounded-lg transition-all duration-200 cursor-pointer select-none active:scale-90 ${
                isPinkNavOpen
                  ? 'w-full py-1 bg-white/5 hover:bg-white/10 border border-sky-200/25'
                  : 'px-2 py-2 bg-[#0d1c2e]/90 backdrop-blur-md border border-sky-300/55 shadow-[0_4px_16px_rgba(0,0,0,0.58)] hover:bg-[#152d49] hover:border-sky-200/85 hover:scale-105'
              }`}
            >
              <div
                className={`grid grid-cols-7 gap-[1.5px] p-0.5 transition-all duration-300 ${
                  isPinkNavOpen
                    ? 'scale-105 drop-shadow-[0_0_12px_rgba(154,221,255,0.65)] opacity-100'
                    : 'opacity-90 group-hover:opacity-100 drop-shadow-[0_0_8px_rgba(154,221,255,0.45)]'
                }`}
              >
                {[
                  0, 1, 1, 0, 1, 1, 0,
                  1, 2, 2, 1, 2, 2, 1,
                  1, 2, 2, 2, 2, 2, 1,
                  1, 2, 2, 2, 2, 2, 1,
                  0, 1, 2, 2, 2, 1, 0,
                  0, 0, 1, 2, 1, 0, 0,
                  0, 0, 0, 1, 0, 0, 0,
                ].map((pixel, idx) => (
                  <div
                    key={idx}
                    className="w-[5px] h-[5px]"
                    style={{
                      backgroundColor:
                        pixel === 1 ? '#FFFFFF' : pixel === 2 ? '#9ADDFF' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </button>
          </div>
        </div>
      )}

      {activeRoom !== 'lobby' && activeRoom !== 'pink' && (
        <div className="absolute bottom-5 right-5 z-30 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleRoomCenterOrDoor();
            }}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseUp={(e) => e.stopPropagation()}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium tracking-wide shadow-[0_4px_16px_rgba(0,0,0,0.55)] active:scale-95 transition-all cursor-pointer select-none border ${
              activeRoom === 'green'
                ? 'bg-[#0f1f0c]/90 border-lime-400/50 text-lime-100 hover:bg-[#193314] hover:border-lime-300/80'
                : activeRoom === 'gold'
                  ? 'bg-[#241907]/90 border-amber-400/55 text-amber-100 hover:bg-[#38270c] hover:border-amber-300/85'
                  : isFoyerRoom(activeRoom)
                    ? 'bg-[#081c24]/90 border-cyan-400/55 text-cyan-100 hover:bg-[#0e2d3a] hover:border-cyan-300/85'
                    : activeRoom === 'royalblue'
                      ? 'bg-[#0c1633]/90 border-blue-400/55 text-blue-100 hover:bg-[#14234f] hover:border-blue-300/85'
                      : activeRoom === 'brown'
                        ? 'bg-[#21150b]/90 border-amber-600/55 text-amber-100 hover:bg-[#332011] hover:border-amber-500/85'
                        : 'bg-[#1b1028]/90 border-purple-400/50 text-purple-100 hover:bg-[#29173d] hover:border-purple-300/80'
            }`}
          >
            {isFoyerRoom(activeRoom)
              ? '去另一邊的門'
              : activeRoom === 'royalblue' || activeRoom === 'brown'
                ? viewLocation === 'door'
                  ? '去茶几前面'
                  : '回去門口'
                : viewLocation === 'center'
                  ? '去門前'
                  : '去房間正中央'}
          </button>
        </div>
      )}
    </div>
  );
};

