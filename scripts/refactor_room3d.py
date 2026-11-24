#!/usr/bin/env python3
import re
import shutil

src_path = 'src/components/Room3DScene.tsx'
bak_path = 'src/components/Room3DScene.tsx.bak'

# Restore from backup first
shutil.copyfile(bak_path, src_path)

with open(src_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports with correct relative path: ./room3d/...
old_import = """import { EscalatorMonologueSubpage, MONOLOGUE_TEXT } from './EscalatorMonologueSubpage';"""
new_import = """import { EscalatorMonologueSubpage, MONOLOGUE_TEXT } from './EscalatorMonologueSubpage';
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
import { buildPinkRoom } from './room3d/buildPinkRoom';"""

assert old_import in content, "old_import not found"
content = content.replace(old_import, new_import, 1)

# 2. Remove duplicate constants and types from the top
old_constants = """  // Room Dimensions (房間的寬度 10*7米)
  const ROOM_WIDTH = 10.0; // 寬度 10 米
  const ROOM_HEIGHT = 3.0; // 挑高 3 米
  const ROOM_DEPTH = 7.0;  // 深度 7 米
  const TABLE_DEPTH = 0.70; // 牆邊木桌深度
  const TABLE_HEIGHT = 0.95; // 牆邊木桌高度

  // Key Seated Position (直接坐在茶几南側坐墊前)
  const SEATED_HEIGHT = 0.68; // 坐姿視線高度
  const SEATED_Z = 1.15; // 圓形茶几南側坐墊位置 (圓几半徑 0.85m + 坐墊中心 0.30m)

  type ExtraRoomId = 'purple' | 'green' | 'gold' | 'pink' | 'cyan' | 'cyan_b1' | 'royalblue' | 'brown';
  type RoomId = 'lobby' | ExtraRoomId;"""

new_constants = """  const texMgrRef = useRef<RoomTextureManager | null>(null);
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
  };"""

assert old_constants in content, "old_constants not found"
content = content.replace(old_constants, new_constants, 1)

# 3. Remove duplicate ExtraRoomDoorState and createInitialExtraRoomState declarations
old_state_def = """  interface ExtraRoomDoorState {
    roomGroup: THREE.Group | null;
    doorHitbox: THREE.Mesh | null;
    doorLeafPivot: THREE.Group | null;
    wheelGroup: THREE.Group | null;
    outerGearGroup: THREE.Group | null;
    dialHitbox: THREE.Mesh | null;
    dialLight: THREE.PointLight | null;
    tipGemMat: THREE.MeshStandardMaterial | null;
    plaqueMat: THREE.MeshStandardMaterial | null;
    plaqueTitles?: Partial<Record<number, string>>;
    defaultPlaqueTitle?: string;
    sectorMats: THREE.MeshStandardMaterial[];
    rimGemMats: THREE.MeshStandardMaterial[];
    colors: readonly [number, number, number, number];
    hasColorSlot: readonly [boolean, boolean, boolean, boolean];
    colorIdx: number;
    currentAngle: number;
    targetAngle: number;
  }
  const createInitialExtraRoomState = (
    colors: readonly [number, number, number, number] = [0xe8eef5, 0x111216, 0x111216, 0x111216],
    hasColorSlot: readonly [boolean, boolean, boolean, boolean] = [true, false, false, false],
    initialIdx = 0,
    initialAngle = 0
  ): ExtraRoomDoorState => ({
    roomGroup: null,
    doorHitbox: null,
    doorLeafPivot: null,
    wheelGroup: null,
    outerGearGroup: null,
    dialHitbox: null,
    dialLight: null,
    tipGemMat: null,
    plaqueMat: null,
    sectorMats: [],
    rimGemMats: [],
    colors,
    hasColorSlot,
    colorIdx: initialIdx,
    currentAngle: initialAngle,
    targetAngle: initialAngle,
  });"""

assert old_state_def in content, "old_state_def not found"
content = content.replace(old_state_def, "", 1)

# 4. In useEffect, after renderer is created, create texMgr
old_after_renderer = """    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvScene = new RoomEnvironment();
    const roomEnvRT = pmremGenerator.fromScene(roomEnvScene, 0.04);
    scene.environment = roomEnvRT.texture;
    scene.environmentIntensity = 0.26;
    roomEnvScene.dispose();
    pmremGenerator.dispose();

    container.appendChild(renderer.domElement);"""

new_after_renderer = """    renderer.shadowMap.enabled = true;
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
    getCarvedPlaqueTextureRef.current = texMgr.getCarvedPlaqueTexture;"""

assert old_after_renderer in content, "old_after_renderer not found"
content = content.replace(old_after_renderer, new_after_renderer, 1)

# 5. Replace procedural textures and inline createPortalDoorAndDial with texMgr calls
p_start_marker = "    // --- 2. PROCEDURAL TEXTURES (USER REQUEST: 牆壁跟地板顏色變深) ---"
p_end_marker = "    // 1. Dark Wood Floor"

idx_p_start = content.find(p_start_marker)
idx_p_end = content.find(p_end_marker)
assert idx_p_start != -1 and idx_p_end != -1, "Procedural texture block not found"

replacement_p = """    // --- 2. TEXTURES VIA CENTRALIZED TEXTURE MANAGER ---
    const floorTexture = texMgr.getFloorTexture();
    const wallTexture = texMgr.getWallTexture();
    const tabletopTexture = texMgr.getTabletopTexture();
    const ceilingTexture = texMgr.getCeilingTexture();
    const extraRoomTexturesToDispose: THREE.Texture[] = [];
    const textureLoader = new THREE.TextureLoader();

    // --- 3. ROOM ARCHITECTURE (大廳 - 10x7m) ---
    const roomGroup = new THREE.Group();
    lobbyRoomGroupRef.current = roomGroup;

"""
content = content[:idx_p_start] + replacement_p + content[idx_p_end:]

# 6. Replace inline createPortalDoorAndDial in Lobby with call to imported createPortalDoorAndDial
door_block_start = "    // --- 3B. CLOSED PORTAL DOOR (\"1F\" / \"2F\" / ROOM NAME CARVED) & STEAMPUNK DIAL BUILDER ---"
door_block_end = "    lobbyDoorHitboxRef.current = lobbyPortalDoor.doorHitbox;"

idx_d_start = content.find(door_block_start)
idx_d_end = content.find(door_block_end)
assert idx_d_start != -1 and idx_d_end != -1, "Door block not found"

replacement_door = """    // --- 3B. CLOSED PORTAL DOOR (\"1F\" / \"2F\" / ROOM NAME CARVED) & STEAMPUNK DIAL BUILDER ---
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

"""
content = content[:idx_d_start] + replacement_door + content[idx_d_end:]

# 7. Replace Lobby texture loader calls with WebP
content = content.replace("textureLoader.load('/assets/vinyl_center_tex.png')", "texMgr.loadTexture('/assets/vinyl_center_tex.webp')")
content = content.replace("textureLoader.load('/assets/suzumi_scroll_tex.png')", "texMgr.loadTexture('/assets/suzumi_scroll_tex.webp')")
content = content.replace("textureLoader.load('/assets/round_fan_tex.png')", "texMgr.loadTexture('/assets/round_fan_tex.webp')")
content = content.replace("textureLoader.load('/assets/display_rack_poster.png')", "texMgr.loadTexture('/assets/display_rack_poster.webp')")
content = content.replace("textureLoader.load('/assets/slytherin_banner_tex.png')", "texMgr.loadTexture('/assets/slytherin_banner_tex.webp')")
content = content.replace("textureLoader.load('/assets/umiri_desk_sign_tex.png')", "texMgr.loadTexture('/assets/umiri_desk_sign_tex.webp')")

# 8. Replace lines for Ririmu Bag, Chiamo Box, and White Box in Lobby
props_start_marker = "    // --- 4E-2b. MAKAI RIRIMU PLUSHIE POUCH ON TEA TABLE BESIDE LAMP"
props_end_marker = "    // Warm fill light highlighting both 6-tier dark wood cabinets"

idx_pr_start = content.find(props_start_marker)
idx_pr_end = content.find(props_end_marker)
assert idx_pr_start != -1 and idx_pr_end != -1, "Props block not found"

replacement_props = """    // --- 4E-2b. MAKAI RIRIMU PLUSHIE POUCH ON TEA TABLE BESIDE LAMP ---
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

"""
content = content[:idx_pr_start] + replacement_props + content[idx_pr_end:]

# 9. Replace the massive 7,000-line secondary rooms and pink room block
sec_start_marker = "    // --- 5B. NEW EMPTY 7x7m ROOMS: PURPLE, GREEN & GOLD ROOMS (7x7公尺空屋) ---"
sec_end_marker = "    // --- 6. ANIMATION & RENDER LOOP ---"

idx_sec_start = content.find(sec_start_marker)
idx_sec_end = content.find(sec_end_marker)
assert idx_sec_start != -1 and idx_sec_end != -1, "Secondary rooms block not found"

content = content[:idx_sec_start] + "    // Secondary rooms are lazily built on demand when entered\n\n" + content[idx_sec_end:]

# 10. Clean up unused texture disposals in cleanup
dispose_block_start = "      ririmuFrontTex.dispose();"
dispose_block_end = "      whiteBoxTopTexture.dispose();\n"
idx_disp_start = content.find(dispose_block_start)
idx_disp_end = content.find(dispose_block_end)
if idx_disp_start != -1 and idx_disp_end != -1:
    content = content[:idx_disp_start] + content[idx_disp_end + len(dispose_block_end):]

# 11. Add texMgr.disposeAll() in cleanup
old_cleanup = """    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (portalSwapTimeoutRef.current !== null) window.clearTimeout(portalSwapTimeoutRef.current);
      if (portalFadeEndTimeoutRef.current !== null) window.clearTimeout(portalFadeEndTimeoutRef.current);"""

new_cleanup = """    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      if (portalSwapTimeoutRef.current !== null) window.clearTimeout(portalSwapTimeoutRef.current);
      if (portalFadeEndTimeoutRef.current !== null) window.clearTimeout(portalFadeEndTimeoutRef.current);
      texMgrRef.current?.disposeAll();"""

assert old_cleanup in content, "old_cleanup not found"
content = content.replace(old_cleanup, new_cleanup, 1)

# 12. Update handleEnterPortalRoom to call buildSecondaryRoomOnDemand
old_enter_logic = """        const isLobby = targetRoom === 'lobby';
        activeRoomRef.current = targetRoom;"""

new_enter_logic = """        if (targetRoom !== 'lobby') {
          buildSecondaryRoomOnDemand(targetRoom);
        }
        const isLobby = targetRoom === 'lobby';
        activeRoomRef.current = targetRoom;"""

assert old_enter_logic in content, "old_enter_logic not found"
content = content.replace(old_enter_logic, new_enter_logic, 1)

# 13. Add a loading bar overlay in JSX
old_jsx_container = """      {/* 3D WebGL Canvas */}
      <div 
        ref={containerRef} 
        className={`absolute inset-0 w-full h-full touch-none ${
          isFoyerRoom(activeRoom)
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing'
        }`} 
      />"""

new_jsx_container = """      {/* 3D WebGL Canvas */}
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
      )}"""

assert old_jsx_container in content, "old_jsx_container not found"
content = content.replace(old_jsx_container, new_jsx_container, 1)

with open(src_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully refactored Room3DScene.tsx! New length:", len(content))
