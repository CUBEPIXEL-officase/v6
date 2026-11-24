import * as THREE from 'three';

export type ExtraRoomId =
  | 'purple'
  | 'green'
  | 'gold'
  | 'pink'
  | 'cyan'
  | 'cyan_b1'
  | 'royalblue'
  | 'brown';

export type RoomId = 'lobby' | ExtraRoomId;

export type ViewLocation =
  | 'table'
  | 'cabinet'
  | 'door'
  | 'door2'
  | 'center'
  | 'desk'
  | 'capsule'
  | 'board';

export interface ExtraRoomDoorState {
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

export const createInitialExtraRoomState = (
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
});

// Room Dimensions (10x7m Lobby, 7x7m Colored Rooms, 12x4m Foyers)
export const ROOM_WIDTH = 10.0;
export const ROOM_HEIGHT = 3.0;
export const ROOM_DEPTH = 7.0;
export const TABLE_DEPTH = 0.70;
export const TABLE_HEIGHT = 0.95;

export const SEATED_HEIGHT = 0.68;
export const SEATED_Z = 1.15;

export const PR_SIZE = 7.0;
export const PR_HEIGHT = 3.0;
export const PR_CENTER_X = -1.5;

export const CY_WIDTH = 12.0;
export const CY_DEPTH = 4.0;
export const CY_HEIGHT = 3.0;
export const CY_CENTER_X = 1.0;
export const CY_CENTER_Z = -1.5;

export const isLobbyStyleRoom = (id: RoomId) =>
  id === 'lobby' || id === 'royalblue' || id === 'brown';

export const isFoyerRoom = (id: RoomId) => id === 'cyan' || id === 'cyan_b1';

export const LOBBY_DIAL_COLORS = [0x65c226, 0x9333ea, 0xeab308, 0x06b6d4] as const;

export const LOBBY_PLAQUE_TITLES: Record<number, string> = {
  0: '迷你像素紀念館',
  1: '練舞空間',
  2: '活動相冊書房',
  3: '樓梯',
};

export const ROOM_ATMOSPHERE: Record<
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
  lobby: {
    name: '大廳',
    floor: '1F',
    bgHex: 0x0c0907,
    ambientColor: 0xffecd6,
    ambientIntensity: 0.76,
    hemiSky: 0xfff5ea,
    hemiGround: 0x6e5a47,
    hemiIntensity: 0.46,
    envIntensity: 0.26,
  },
  purple: {
    name: '紫色房間',
    floor: '1F',
    bgHex: 0x10081c,
    ambientColor: 0xd8b4fe,
    ambientIntensity: 0.80,
    hemiSky: 0xede0ff,
    hemiGround: 0x563f73,
    hemiIntensity: 0.48,
    envIntensity: 0.28,
  },
  green: {
    name: '綠色房間',
    floor: '1F',
    bgHex: 0x081406,
    ambientColor: 0xbef292,
    ambientIntensity: 0.80,
    hemiSky: 0xe2fcd4,
    hemiGround: 0x456936,
    hemiIntensity: 0.48,
    envIntensity: 0.28,
  },
  gold: {
    name: '金色房間',
    floor: '1F',
    bgHex: 0x171005,
    ambientColor: 0xfde68a,
    ambientIntensity: 0.80,
    hemiSky: 0xfff3c4,
    hemiGround: 0x785c28,
    hemiIntensity: 0.48,
    envIntensity: 0.28,
  },
  pink: {
    name: '粉色房間',
    floor: 'B1',
    bgHex: 0x181014,
    ambientColor: 0xfff0e6,
    ambientIntensity: 0.34,
    hemiSky: 0xfff4eb,
    hemiGround: 0x8a727c,
    hemiIntensity: 0.22,
    envIntensity: 0.20,
  },
  cyan: {
    name: '二樓的門廊',
    floor: '2F',
    bgHex: 0x0c0907,
    ambientColor: 0xffecd6,
    ambientIntensity: 0.78,
    hemiSky: 0xfff5ea,
    hemiGround: 0x5c686e,
    hemiIntensity: 0.46,
    envIntensity: 0.27,
  },
  cyan_b1: {
    name: '地下一樓的門廊',
    floor: 'B1',
    bgHex: 0x0c0907,
    ambientColor: 0xffecd6,
    ambientIntensity: 0.78,
    hemiSky: 0xfff5ea,
    hemiGround: 0x5c686e,
    hemiIntensity: 0.46,
    envIntensity: 0.27,
  },
  royalblue: {
    name: '寶藍色大廳',
    floor: '2F',
    bgHex: 0x0c0907,
    ambientColor: 0xffecd6,
    ambientIntensity: 0.78,
    hemiSky: 0xfff5ea,
    hemiGround: 0x52607a,
    hemiIntensity: 0.46,
    envIntensity: 0.27,
  },
  brown: {
    name: '棕色大廳',
    floor: '2F',
    bgHex: 0x0c0907,
    ambientColor: 0xffecd6,
    ambientIntensity: 0.78,
    hemiSky: 0xfff5ea,
    hemiGround: 0x6e5844,
    hemiIntensity: 0.46,
    envIntensity: 0.27,
  },
};

export interface ExtraRoomTheme {
  floorColor: number;
  ceilingColor: number;
  wallColor: number;
  baseboardColor: number;
  accentWoodTint: number;
  ceilingRoseColor: number;
  lampCapColor: number;
  bulbColor: number;
  mainLightColor: number;
  upGlowColor: number;
  doorAccentColor: number;
}

export const EXTRA_ROOM_THEMES: Record<'purple' | 'green' | 'gold' | 'pink', ExtraRoomTheme> = {
  purple: {
    floorColor: 0x8f74b3,
    ceilingColor: 0x5c3e82,
    wallColor: 0xa78bfa,
    baseboardColor: 0x1b0e29,
    accentWoodTint: 0x1d1124,
    ceilingRoseColor: 0x1c0f29,
    lampCapColor: 0x2a183b,
    bulbColor: 0xf5ebff,
    mainLightColor: 0xd8b4fe,
    upGlowColor: 0xc084fc,
    doorAccentColor: 0xd8b4fe,
  },
  green: {
    floorColor: 0x639e4b,
    ceilingColor: 0x3a6328,
    wallColor: 0x84cc52,
    baseboardColor: 0x101f0c,
    accentWoodTint: 0x12220e,
    ceilingRoseColor: 0x11210c,
    lampCapColor: 0x1c3615,
    bulbColor: 0xf0fde8,
    mainLightColor: 0xbef292,
    upGlowColor: 0x86efac,
    doorAccentColor: 0xbef292,
  },
  gold: {
    floorColor: 0xb38b3e,
    ceilingColor: 0x6e511c,
    wallColor: 0xf5c84c,
    baseboardColor: 0x241908,
    accentWoodTint: 0x261a09,
    ceilingRoseColor: 0x241907,
    lampCapColor: 0x3d2a0d,
    bulbColor: 0xfff8dc,
    mainLightColor: 0xfde68a,
    upGlowColor: 0xfbbf24,
    doorAccentColor: 0xfde68a,
  },
  pink: {
    floorColor: 0xf4f1ed,
    ceilingColor: 0xf0ebe6,
    wallColor: 0xf4f0ec,
    baseboardColor: 0xded6cf,
    accentWoodTint: 0x2d1420,
    ceilingRoseColor: 0x3b1c29,
    lampCapColor: 0x59293d,
    bulbColor: 0xfff5e4,
    mainLightColor: 0xffeede,
    upGlowColor: 0xffe4d0,
    doorAccentColor: 0xffebd6,
  },
};

export const LOBBY_2F_THEMES: Record<
  'royalblue' | 'brown',
  {
    floorColor: number;
    wallColor: number;
    ceilingColor: number;
    baseboardColor: number;
    accentWoodTint: number;
  }
> = {
  royalblue: {
    floorColor: 0x7b92c4,
    wallColor: 0x4f74c9,
    ceilingColor: 0xc2d1eb,
    baseboardColor: 0x0f182e,
    accentWoodTint: 0x101930,
  },
  brown: {
    floorColor: 0xb38a62,
    wallColor: 0xc28c59,
    ceilingColor: 0xebd9c5,
    baseboardColor: 0x24160b,
    accentWoodTint: 0x26170b,
  },
};
