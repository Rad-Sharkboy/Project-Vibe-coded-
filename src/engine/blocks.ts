import { TILE } from './atlas'

export type BlockDef = {
  id: number
  name: string
  top: number
  side: number
  bottom: number
  /** blocks faces of neighbours + blocks light */
  opaque: boolean
  /** light emission 0..15 */
  emit: number
  /** collision */
  solid: boolean
  /** rendered in the transparent pass */
  transparent?: boolean
  /** small/soft sound when stepped on */
  material?: 'grass' | 'stone' | 'wood' | 'metal' | 'water' | 'carpet'
}

const defs: BlockDef[] = []

function def(
  id: number,
  name: string,
  tiles: number | { top?: number; side?: number; bottom?: number },
  opts: Partial<BlockDef> = {},
) {
  const t = typeof tiles === 'number' ? { top: tiles, side: tiles, bottom: tiles } : tiles
  defs[id] = {
    id,
    name,
    top: t.top ?? TILE.stone,
    side: t.side ?? t.top ?? TILE.stone,
    bottom: t.bottom ?? t.side ?? t.top ?? TILE.stone,
    opaque: true,
    emit: 0,
    solid: true,
    ...opts,
  }
}

def(0, 'Air', TILE.stone, { opaque: false, solid: false })

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  CONCRETE: 4,
  CONCRETE_DARK: 5,
  BRICK: 6,
  BRICK_CREAM: 7,
  PLANK: 8,
  WOOD_DARK: 9,
  LOG: 10,
  LEAVES: 11,
  BUSH: 12,
  GLASS: 13,
  ASPHALT: 14,
  PAVER: 15,
  PAVEMENT: 16,
  ROOF: 17,
  LAMP: 18,
  BOOKS: 19,
  BED: 20,
  CHALKBOARD: 21,
  SCREEN: 22,
  VENDING: 23,
  DESK: 24,
  CHAIR: 25,
  TABLE: 26,
  CARPET_RED: 27,
  CARPET_BLUE: 28,
  TILE_WHITE: 29,
  METAL: 30,
  WATER: 31,
  SAND: 32,
  FLOWER: 33,
  FLOWER_YELLOW: 34,
  HEDGE: 35,
  NEON_PINK: 36,
  NEON_CYAN: 37,
  NEON_GREEN: 38,
  NEON_AMBER: 39,
  WHITEBOARD: 40,
  GYM_FLOOR: 41,
  GYM_MAT: 42,
  NOTICE_BOARD: 43,
  ARCADE: 44,
  CHECKER_A: 45,
  CHECKER_B: 46,
  WOOD_FLOOR: 47,
  SIGN_WOOD: 48,
  ACOUSTIC: 49,
  COFFEE_MACHINE: 50,
  GRASS_DARK: 51,
  GRAVEL: 52,
  DIRT_PATH: 53,
  POSTER: 54,
  CLOTH_RED: 55,
  COUNTER: 56,
  WINDOW_FRAME: 57,
  TOWEL: 58,
  GRASS_DRY: 59,
  STONE_DARK: 60,
  STONE_BRICK: 61,
} as const

def(B.GRASS, 'Grass', { top: TILE.grassTop, side: TILE.grassSide, bottom: TILE.dirt }, { material: 'grass' })
def(B.DIRT, 'Dirt', TILE.dirt, { material: 'grass' })
def(B.STONE, 'Stone', TILE.stone, { material: 'stone' })
def(B.STONE_BRICK, 'Stone Brick', TILE.stoneBrick, { material: 'stone' })
def(B.STONE_DARK, 'Dark Stone', TILE.stone, { material: 'stone' })
def(B.CONCRETE, 'Concrete', TILE.concrete, { material: 'stone' })
def(B.CONCRETE_DARK, 'Dark Concrete', TILE.concreteDark, { material: 'stone' })
def(B.BRICK, 'Brick', TILE.brick, { material: 'stone' })
def(B.BRICK_CREAM, 'Cream Brick', TILE.brickCream, { material: 'stone' })
def(B.PLANK, 'Planks', TILE.plank, { material: 'wood' })
def(B.WOOD_DARK, 'Dark Wood', TILE.woodDark, { material: 'wood' })
def(B.LOG, 'Log', { top: TILE.logTop, side: TILE.log, bottom: TILE.logTop }, { material: 'wood' })
def(B.LEAVES, 'Leaves', TILE.leaves, { material: 'grass' })
def(B.BUSH, 'Bush', TILE.bush, { material: 'grass' })
def(B.GLASS, 'Glass', TILE.glass, { opaque: false, transparent: true, emit: 2, material: 'metal' })
def(B.ASPHALT, 'Asphalt', TILE.asphalt, { material: 'stone' })
def(B.PAVER, 'Pavers', TILE.paver, { material: 'stone' })
def(B.PAVEMENT, 'Pavement', TILE.pavement, { material: 'stone' })
def(B.ROOF, 'Roof', TILE.roof, { material: 'stone' })
def(B.LAMP, 'Lamp', TILE.lamp, { emit: 15, material: 'metal' })
def(B.BOOKS, 'Bookshelf', { top: TILE.plank, side: TILE.books, bottom: TILE.plank }, { material: 'wood' })
def(B.BED, 'Bed', { top: TILE.bed, side: TILE.bed, bottom: TILE.plank }, { material: 'carpet' })
def(B.CHALKBOARD, 'Chalkboard', { top: TILE.woodDark, side: TILE.chalkboard, bottom: TILE.woodDark }, { material: 'wood' })
def(B.SCREEN, 'Screen', { top: TILE.metal, side: TILE.screen, bottom: TILE.metal }, { emit: 6, material: 'metal' })
def(B.VENDING, 'Vending Machine', { top: TILE.vendingSide, side: TILE.vending, bottom: TILE.vendingSide }, { material: 'metal' })
def(B.DESK, 'Desk', { top: TILE.desk, side: TILE.desk, bottom: TILE.plank }, { material: 'wood' })
def(B.CHAIR, 'Chair', TILE.chair, { material: 'wood' })
def(B.TABLE, 'Table', { top: TILE.tableTop, side: TILE.tableTop, bottom: TILE.metal }, { material: 'wood' })
def(B.CARPET_RED, 'Red Carpet', TILE.carpetRed, { material: 'carpet' })
def(B.CARPET_BLUE, 'Blue Carpet', TILE.carpetBlue, { material: 'carpet' })
def(B.TILE_WHITE, 'Tiles', TILE.tileWhite, { material: 'stone' })
def(B.METAL, 'Metal', TILE.metal, { material: 'metal' })
def(B.WATER, 'Water', TILE.water, { opaque: false, transparent: true, solid: false, material: 'water' })
def(B.SAND, 'Sand', TILE.sand, { material: 'grass' })
def(B.FLOWER, 'Flowers', { top: TILE.flower, side: TILE.grassSide, bottom: TILE.dirt }, { material: 'grass' })
def(B.FLOWER_YELLOW, 'Sunflowers', { top: TILE.flowerYellow, side: TILE.grassSide, bottom: TILE.dirt }, { material: 'grass' })
def(B.HEDGE, 'Hedge', TILE.hedge, { material: 'grass' })
def(B.NEON_PINK, 'Neon Pink', TILE.neonPink, { emit: 14, material: 'metal' })
def(B.NEON_CYAN, 'Neon Cyan', TILE.neonCyan, { emit: 14, material: 'metal' })
def(B.NEON_GREEN, 'Neon Green', TILE.neonGreen, { emit: 14, material: 'metal' })
def(B.NEON_AMBER, 'Neon Amber', TILE.neonAmber, { emit: 14, material: 'metal' })
def(B.WHITEBOARD, 'Whiteboard', { top: TILE.metal, side: TILE.whiteboard, bottom: TILE.metal }, { material: 'metal' })
def(B.GYM_FLOOR, 'Gym Floor', TILE.gymFloor, { material: 'wood' })
def(B.GYM_MAT, 'Gym Mat', TILE.gymMat, { material: 'carpet' })
def(B.NOTICE_BOARD, 'Notice Board', { top: TILE.woodDark, side: TILE.noticeBoard, bottom: TILE.woodDark }, { material: 'wood' })
def(B.ARCADE, 'Arcade Cabinet', { top: TILE.vendingSide, side: TILE.arcade, bottom: TILE.vendingSide }, { emit: 4, material: 'metal' })
def(B.CHECKER_A, 'Checker A', TILE.checkerA, { material: 'stone' })
def(B.CHECKER_B, 'Checker B', TILE.checkerB, { material: 'stone' })
def(B.WOOD_FLOOR, 'Wood Floor', TILE.woodFloor, { material: 'wood' })
def(B.SIGN_WOOD, 'Sign', TILE.signWood, { material: 'wood' })
def(B.ACOUSTIC, 'Acoustic Panel', TILE.acoustic, { material: 'carpet' })
def(B.COFFEE_MACHINE, 'Coffee Machine', { top: TILE.metal, side: TILE.coffee, bottom: TILE.metal }, { emit: 5, material: 'metal' })
def(B.GRASS_DARK, 'Wild Grass', { top: TILE.grassDark, side: TILE.grassSide, bottom: TILE.dirt }, { material: 'grass' })
def(B.GRASS_DRY, 'Dry Grass', { top: TILE.grassDry, side: TILE.grassSide, bottom: TILE.dirt }, { material: 'grass' })
def(B.GRAVEL, 'Gravel', TILE.gravel, { material: 'stone' })
def(B.DIRT_PATH, 'Dirt Path', { top: TILE.dirtPath, side: TILE.dirt, bottom: TILE.dirt }, { material: 'grass' })
def(B.POSTER, 'Poster', { top: TILE.woodDark, side: TILE.poster, bottom: TILE.woodDark }, { material: 'carpet' })
def(B.CLOTH_RED, 'Red Cloth', TILE.clothRed, { material: 'carpet' })
def(B.COUNTER, 'Counter', { top: TILE.counter, side: TILE.counter, bottom: TILE.metal }, { material: 'stone' })
def(B.WINDOW_FRAME, 'Window Frame', TILE.windowFrame, { material: 'metal' })
def(B.TOWEL, 'Towels', TILE.towel, { material: 'carpet' })

export const BLOCKS: BlockDef[] = defs

export function blockDef(id: number): BlockDef {
  return defs[id] ?? defs[0]
}
export function isOpaque(id: number) {
  return id !== 0 && defs[id] ? defs[id].opaque : false
}
export function isSolid(id: number) {
  return id !== 0 && defs[id] ? defs[id].solid : false
}
export function isTransparent(id: number) {
  return id !== 0 && !!defs[id]?.transparent
}
export function emitOf(id: number) {
  return defs[id]?.emit ?? 0
}
export function blockName(id: number) {
  return defs[id]?.name ?? 'Unknown'
}

/** Blocks available in the build hotbar */
export const BUILDABLE = [
  B.GRASS,
  B.PLANK,
  B.BRICK,
  B.CONCRETE,
  B.GLASS,
  B.LAMP,
  B.LEAVES,
  B.NEON_PINK,
  B.NEON_CYAN,
  B.CARPET_BLUE,
  B.BOOKS,
  B.STONE_BRICK,
  B.WOOD_FLOOR,
  B.FLOWER,
  B.WATER,
  B.METAL,
]
