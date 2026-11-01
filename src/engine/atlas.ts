import * as THREE from 'three'
import { hash2 } from './noise'

/** Atlas is 16x16 tiles, each 32px => 512x512, with pixel-art painted procedurally. */
export const ATLAS_TILES = 16
export const TILE_PX = 32
export const ATLAS_PX = ATLAS_TILES * TILE_PX

export const TILE = {
  grassTop: 0,
  grassSide: 1,
  dirt: 2,
  stone: 3,
  stoneBrick: 4,
  concrete: 5,
  concreteDark: 6,
  brick: 7,
  brickCream: 8,
  plank: 9,
  woodDark: 10,
  log: 11,
  logTop: 12,
  leaves: 13,
  bush: 14,
  glass: 15,
  asphalt: 16,
  paver: 17,
  pavement: 18,
  roof: 19,
  lamp: 20,
  books: 21,
  bed: 22,
  chalkboard: 23,
  screen: 24,
  vending: 25,
  vendingSide: 26,
  desk: 27,
  chair: 28,
  tableTop: 29,
  carpetRed: 30,
  carpetBlue: 31,
  tileWhite: 32,
  metal: 33,
  water: 34,
  sand: 35,
  flower: 36,
  hedge: 37,
  neonPink: 38,
  neonCyan: 39,
  whiteboard: 40,
  gymFloor: 41,
  noticeBoard: 42,
  arcade: 43,
  checkerA: 44,
  checkerB: 45,
  woodFloor: 46,
  signWood: 47,
  acoustic: 48,
  coffee: 49,
  grassDark: 50,
  gravel: 51,
  poster: 52,
  clothRed: 53,
  counter: 54,
  windowFrame: 55,
  gymMat: 56,
  dirtPath: 57,
  flowerYellow: 58,
  towel: 59,
  grassDry: 60,
  neonGreen: 61,
  neonAmber: 62,
  stoneDark: 63,
} as const

type RGB = [number, number, number]
type Painter = (g: TileGrid) => void

class TileGrid {
  data: Uint8ClampedArray
  ox: number
  oy: number
  seed: number
  constructor(data: Uint8ClampedArray, ox: number, oy: number, seed: number) {
    this.data = data
    this.ox = ox
    this.oy = oy
    this.seed = seed
  }
  set(x: number, y: number, c: RGB, a = 255) {
    if (x < 0 || y < 0 || x > 15 || y > 15) return
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const px = this.ox + x * 2 + dx
        const py = this.oy + y * 2 + dy
        const i = (py * ATLAS_PX + px) * 4
        this.data[i] = c[0]
        this.data[i + 1] = c[1]
        this.data[i + 2] = c[2]
        this.data[i + 3] = a
      }
    }
  }
  n(x: number, y: number) {
    return hash2(this.ox + x * 7, this.oy + y * 13, this.seed)
  }
  fill(c: RGB, a = 255) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, c, a)
  }
  /** fill with per-pixel brightness jitter */
  fillNoise(base: RGB, amount = 16, a = 255) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = (this.n(x, y) - 0.5) * 2 * amount
        this.set(x, y, [clamp(base[0] + d), clamp(base[1] + d), clamp(base[2] + d)], a)
      }
    }
  }
  /** sprinkle short specks of colour */
  specks(c: RGB, density = 0.2, size = 1, a = 255) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (this.n(x + 41, y + 17) < density) {
          for (let sy = 0; sy < size; sy++)
            for (let sx = 0; sx < size; sx++) if (this.n(x + sx, y + sy + 7) < 0.8) this.set(x + sx, y + sy, c, a)
        }
      }
    }
  }
  rect(x0: number, y0: number, x1: number, y1: number, c: RGB, a = 255) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c, a)
  }
  lineH(y: number, c: RGB, a = 255) {
    for (let x = 0; x < 16; x++) this.set(x, y, c, a)
  }
  lineV(x: number, c: RGB, a = 255) {
    for (let y = 0; y < 16; y++) this.set(x, y, c, a)
  }
}

function clamp(v: number) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}
function shade(c: RGB, f: number): RGB {
  return [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)]
}
function mixc(a: RGB, b: RGB, t: number): RGB {
  return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)]
}

const C = {
  grass: [104, 172, 78] as RGB,
  grassDark: [74, 132, 62] as RGB,
  dirt: [126, 88, 56] as RGB,
  stone: [138, 142, 148] as RGB,
  concrete: [226, 222, 210] as RGB,
  concreteDark: [150, 148, 144] as RGB,
  brick: [176, 92, 74] as RGB,
  brickCream: [224, 204, 172] as RGB,
  wood: [176, 132, 88] as RGB,
  woodDark: [110, 78, 52] as RGB,
  leaf: [72, 142, 66] as RGB,
  neonPink: [255, 92, 168] as RGB,
  neonCyan: [86, 224, 255] as RGB,
  water: [64, 142, 210] as RGB,
}

const painters: Record<number, Painter> = {
  [TILE.grassTop]: (g) => {
    g.fillNoise(C.grass, 18)
    g.specks(C.grassDark, 0.22)
    g.specks([132, 196, 96], 0.12)
  },
  [TILE.grassSide]: (g) => {
    g.fillNoise(C.dirt, 14)
    for (let x = 0; x < 16; x++) {
      const h = 3 + Math.floor(g.n(x, 3) * 4)
      for (let y = 0; y < h; y++) g.set(x, y, shade(C.grass, 0.85 + g.n(x, y) * 0.3))
      if (g.n(x, 9) > 0.7) g.set(x, h, C.grass)
    }
  },
  [TILE.dirt]: (g) => {
    g.fillNoise(C.dirt, 16)
    g.specks(shade(C.dirt, 0.7), 0.2)
    g.specks([156, 116, 80], 0.1)
  },
  [TILE.stone]: (g) => {
    g.fillNoise(C.stone, 14)
    g.specks(shade(C.stone, 0.72), 0.18, 2)
    g.specks(shade(C.stone, 1.18), 0.1)
  },
  [TILE.stoneBrick]: (g) => {
    g.fillNoise([158, 156, 150], 8)
    const mortar: RGB = [110, 110, 108]
    for (let y = 0; y < 16; y += 8) {
      g.lineH(y, mortar)
      for (let x = 0; x < 16; x += 8) {
        const off = y % 16 === 0 ? 0 : 4
        g.lineV((x + off) % 16, mortar)
      }
    }
    g.specks(shade([158, 156, 150], 0.9), 0.12)
  },
  [TILE.concrete]: (g) => {
    g.fillNoise(C.concrete, 7)
    g.lineH(15, shade(C.concrete, 0.9))
    g.lineH(0, shade(C.concrete, 1.03))
    g.specks(shade(C.concrete, 0.95), 0.05)
  },
  [TILE.concreteDark]: (g) => {
    g.fillNoise(C.concreteDark, 9)
    g.specks(shade(C.concreteDark, 0.86), 0.1)
  },
  [TILE.brick]: (g) => {
    g.fillNoise(shade(C.brick, 0.95), 8)
    const mortar: RGB = [206, 196, 184]
    const bw = 8
    const bh = 4
    for (let row = 0; row < 4; row++) {
      g.lineH(row * bh, mortar)
      const off = row % 2 === 0 ? 0 : bw / 2
      for (let bx = 0; bx < 16 + bw; bx += bw) g.lineV((bx + off) % 16, mortar)
      for (let x = 0; x < 16; x++) {
        for (let y = row * bh + 1; y < row * bh + bh; y++) {
          if (g.n(x + row * 3, y) > 0.75) g.set(x, y, shade(C.brick, 1.1))
        }
      }
    }
  },
  [TILE.brickCream]: (g) => {
    g.fillNoise(shade(C.brickCream, 0.97), 7)
    const mortar: RGB = [206, 200, 188]
    for (let row = 0; row < 4; row++) {
      g.lineH(row * 4, mortar)
      const off = row % 2 === 0 ? 0 : 4
      for (let bx = 0; bx < 20; bx += 8) g.lineV((bx + off) % 16, mortar)
    }
  },
  [TILE.plank]: (g) => {
    g.fillNoise(C.wood, 9)
    for (let y = 0; y < 16; y += 4) {
      g.lineH(y, shade(C.wood, 0.72))
      for (let x = 0; x < 16; x++) {
        if (g.n(x, y + 1) > 0.82) g.set(x, y + 2, shade(C.wood, 0.86))
      }
    }
  },
  [TILE.woodDark]: (g) => {
    g.fillNoise(C.woodDark, 10)
    for (let y = 0; y < 16; y += 5) g.lineH(y, shade(C.woodDark, 0.78))
    g.specks(shade(C.woodDark, 1.14), 0.08)
  },
  [TILE.log]: (g) => {
    g.fillNoise([132, 96, 60], 10)
    for (let x = 0; x < 16; x++) {
      if (x % 4 === 0) for (let y = 0; y < 16; y++) if (g.n(x, y) > 0.25) g.set(x, y, [104, 74, 46])
    }
  },
  [TILE.logTop]: (g) => {
    g.fillNoise([158, 118, 74], 8)
    const cxp = 7.5
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - cxp, y - cxp)
        if (Math.abs((d % 3) - 1.5) < 0.45) g.set(x, y, [118, 84, 52])
      }
  },
  [TILE.leaves]: (g) => {
    g.fillNoise(C.leaf, 22)
    g.specks(shade(C.leaf, 0.68), 0.3, 2)
    g.specks(shade(C.leaf, 1.22), 0.16)
  },
  [TILE.bush]: (g) => {
    g.fillNoise(shade(C.leaf, 0.9), 20)
    g.specks([48, 104, 48], 0.28, 2)
    g.specks([132, 188, 96], 0.12)
  },
  [TILE.glass]: (g) => {
    g.fill([186, 224, 240], 120)
    for (let i = 0; i < 16; i++) {
      g.set(i, 0, [236, 248, 255], 210)
      g.set(0, i, [236, 248, 255], 210)
      g.set(i, 15, [150, 190, 210], 190)
      g.set(15, i, [150, 190, 210], 190)
    }
    // diagonal highlight
    for (let i = 0; i < 10; i++) g.set(3 + i, 12 - i, [255, 255, 255], 110)
    for (let i = 0; i < 5; i++) g.set(8 + i, 13 - i, [255, 255, 255], 70)
  },
  [TILE.windowFrame]: (g) => {
    g.fillNoise([236, 236, 232], 5)
    for (let i = 0; i < 16; i++) {
      g.set(i, 0, [170, 172, 168])
      g.set(i, 15, [170, 172, 168])
      g.set(0, i, [170, 172, 168])
      g.set(15, i, [170, 172, 168])
    }
  },
  [TILE.asphalt]: (g) => {
    g.fillNoise([62, 64, 70], 10)
    g.specks([88, 92, 100], 0.14)
    g.specks([44, 46, 52], 0.12)
  },
  [TILE.paver]: (g) => {
    g.fillNoise([200, 194, 182], 7)
    g.lineH(0, [176, 170, 158])
    g.lineH(8, [176, 170, 158])
    g.lineV(0, [176, 170, 158])
    g.lineV(8, [176, 170, 158])
    g.rect(9, 9, 15, 15, [206, 200, 188])
    g.rect(1, 1, 7, 7, [206, 200, 188])
    g.specks([184, 178, 166], 0.06)
  },
  [TILE.pavement]: (g) => {
    g.fillNoise([188, 186, 180], 6)
    g.lineH(0, [162, 160, 154])
    g.lineV(0, [162, 160, 154])
    g.specks([170, 168, 162], 0.05)
  },
  [TILE.roof]: (g) => {
    g.fillNoise([86, 88, 96], 8)
    for (let y = 0; y < 16; y += 4) {
      g.lineH(y, [64, 66, 74])
      for (let x = 0; x < 16; x += 8) g.lineV((x + (y % 8 === 0 ? 0 : 4)) % 16, [70, 72, 80])
    }
  },
  [TILE.lamp]: (g) => {
    g.fill([255, 246, 214])
    g.rect(2, 2, 13, 13, [255, 255, 236])
    g.rect(0, 0, 15, 0, [214, 206, 180])
    g.rect(0, 15, 15, 15, [214, 206, 180])
    for (let i = 0; i < 16; i++) {
      g.set(i, 7, [255, 255, 255])
      g.set(7, i, [255, 255, 255])
    }
  },
  [TILE.books]: (g) => {
    g.fillNoise([124, 92, 62], 8)
    const cols: RGB[] = [
      [186, 74, 72],
      [68, 106, 168],
      [206, 162, 68],
      [86, 148, 106],
      [150, 96, 168],
      [224, 224, 216],
    ]
    for (let shelf = 0; shelf < 3; shelf++) {
      const y0 = 1 + shelf * 5
      g.rect(0, y0 + 4, 15, y0 + 4, [96, 70, 46])
      let x = 0
      while (x < 16) {
        const w = 1 + Math.floor(g.n(x, shelf) * 3)
        const c = cols[Math.floor(g.n(x + 5, shelf + 2) * cols.length)]
        const h = 3 + Math.floor(g.n(x + 2, shelf) * 2)
        for (let bx = x; bx < Math.min(16, x + w); bx++)
          for (let y = y0 + 4 - h; y < y0 + 4; y++) g.set(bx, y, shade(c, 0.85 + g.n(bx, y) * 0.3))
        x += w
      }
    }
  },
  [TILE.bed]: (g) => {
    g.fillNoise([228, 228, 236], 6)
    g.rect(0, 0, 15, 3, [246, 246, 250])
    g.rect(0, 4, 15, 5, [198, 202, 214])
    // blanket
    for (let y = 6; y < 16; y++)
      for (let x = 0; x < 16; x++) g.set(x, y, shade([92, 138, 200], 0.9 + g.n(x, y) * 0.2))
    g.rect(0, 6, 15, 7, [120, 164, 220])
  },
  [TILE.chalkboard]: (g) => {
    g.fillNoise([38, 58, 48], 6)
    for (let i = 0; i < 22; i++) {
      const x = Math.floor(g.n(i, 3) * 14) + 1
      const y = Math.floor(g.n(i, 9) * 12) + 2
      g.set(x, y, [214, 224, 216])
      g.set(x + 1, y, [190, 204, 196])
      if (i % 3 === 0) g.set(x, y + 1, [200, 212, 204])
    }
    for (let i = 0; i < 6; i++) g.set(2 + i, 13, [226, 232, 226])
  },
  [TILE.screen]: (g) => {
    g.fill([22, 26, 40])
    g.rect(1, 1, 14, 14, [46, 108, 168])
    for (let i = 0; i < 14; i++) g.set(i + 1, 4, [126, 196, 236])
    for (let i = 0; i < 9; i++) g.set(i + 2, 7, [200, 226, 244])
    for (let i = 0; i < 6; i++) g.set(i + 2, 10, [160, 200, 230])
  },
  [TILE.vending]: (g) => {
    g.fillNoise([40, 46, 58], 6)
    g.rect(1, 1, 14, 9, [88, 196, 226])
    const cols: RGB[] = [
      [230, 90, 90],
      [240, 196, 84],
      [120, 210, 140],
      [236, 240, 250],
    ]
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 4; c++) {
        const bx = 2 + c * 3
        const by = 2 + r * 3
        const col = cols[(r * 4 + c) % cols.length]
        g.rect(bx, by, bx + 1, by + 2, col)
        g.set(bx, by + 2, shade(col, 0.7))
      }
    g.rect(1, 11, 14, 14, [26, 30, 40])
    g.rect(2, 12, 13, 13, [70, 78, 94])
    g.rect(12, 11, 14, 11, [180, 220, 240])
  },
  [TILE.vendingSide]: (g) => {
    g.fillNoise([46, 52, 64], 7)
    g.rect(0, 0, 15, 1, [66, 74, 88])
    g.rect(0, 11, 15, 11, [30, 34, 44])
  },
  [TILE.desk]: (g) => {
    g.fillNoise([196, 156, 108], 7)
    for (let y = 0; y < 16; y += 4) g.lineH(y, [168, 128, 84])
    g.rect(0, 0, 15, 0, [216, 180, 132])
  },
  [TILE.chair]: (g) => {
    g.fillNoise([70, 92, 130], 8)
    g.rect(0, 0, 15, 2, [96, 124, 168])
    for (let y = 3; y < 16; y += 5) g.lineH(y, [52, 70, 100])
  },
  [TILE.tableTop]: (g) => {
    g.fillNoise([228, 226, 220], 6)
    for (let x = 2; x < 16; x += 5) for (let y = 0; y < 16; y++) if (g.n(x, y) > 0.4) g.set(x, y, [206, 204, 198])
    g.lineH(0, [246, 246, 240])
  },
  [TILE.carpetRed]: (g) => {
    g.fillNoise([142, 62, 72], 9)
    g.specks([122, 48, 58], 0.2)
    g.specks([164, 82, 92], 0.1)
  },
  [TILE.carpetBlue]: (g) => {
    g.fillNoise([58, 78, 118], 9)
    g.specks([48, 66, 102], 0.2)
    g.specks([78, 100, 142], 0.1)
  },
  [TILE.tileWhite]: (g) => {
    g.fillNoise([234, 236, 238], 4)
    g.lineH(0, [212, 214, 218])
    g.lineV(0, [212, 214, 218])
    g.lineH(8, [216, 218, 222])
    g.lineV(8, [216, 218, 222])
  },
  [TILE.metal]: (g) => {
    g.fillNoise([162, 168, 176], 8)
    g.rect(0, 0, 15, 1, [190, 196, 204])
    g.rect(0, 14, 15, 15, [120, 126, 136])
    for (let i = 0; i < 16; i += 6) g.set(i, 7, [116, 122, 132])
  },
  [TILE.water]: (g) => {
    g.fillNoise(C.water, 12, 205)
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const w = Math.sin((x + y * 2) * 0.9) + Math.sin(x * 1.7 - y)
        if (w > 1.3) g.set(x, y, [126, 196, 240], 190)
      }
  },
  [TILE.sand]: (g) => {
    g.fillNoise([218, 202, 158], 9)
    g.specks([198, 182, 138], 0.2)
  },
  [TILE.flower]: (g) => {
    g.fillNoise(C.grass, 16)
    g.specks(C.grassDark, 0.2)
    const spots = [
      [3, 4],
      [10, 3],
      [6, 10],
      [12, 11],
    ]
    for (const [x, y] of spots) {
      g.set(x, y, [244, 244, 240])
      g.set(x + 1, y, [226, 214, 228])
      g.set(x, y + 1, [228, 216, 232])
      g.set(x + 1, y + 1, [210, 200, 216])
    }
  },
  [TILE.flowerYellow]: (g) => {
    g.fillNoise(C.grass, 16)
    g.specks(C.grassDark, 0.2)
    const spots = [
      [3, 5],
      [9, 3],
      [7, 11],
      [12, 9],
      [4, 12],
    ]
    for (const [x, y] of spots) {
      g.set(x, y, [250, 214, 92])
      g.set(x + 1, y, [236, 190, 70])
      g.set(x, y + 1, [240, 200, 76])
      g.set(x + 1, y + 1, [222, 176, 62])
    }
  },
  [TILE.hedge]: (g) => {
    g.fillNoise([64, 118, 62], 18)
    g.specks([44, 92, 46], 0.3, 2)
    g.specks([96, 152, 82], 0.14)
  },
  [TILE.neonPink]: (g) => {
    g.fill(C.neonPink)
    g.rect(1, 1, 14, 14, [255, 156, 206])
    g.rect(3, 3, 12, 12, [255, 214, 236])
    g.rect(6, 6, 9, 9, [255, 250, 253])
  },
  [TILE.neonCyan]: (g) => {
    g.fill(C.neonCyan)
    g.rect(1, 1, 14, 14, [150, 240, 255])
    g.rect(3, 3, 12, 12, [212, 250, 255])
    g.rect(6, 6, 9, 9, [252, 255, 255])
  },
  [TILE.neonGreen]: (g) => {
    g.fill([104, 236, 148])
    g.rect(2, 2, 13, 13, [168, 255, 196])
    g.rect(5, 5, 10, 10, [232, 255, 240])
  },
  [TILE.neonAmber]: (g) => {
    g.fill([255, 190, 92])
    g.rect(2, 2, 13, 13, [255, 218, 152])
    g.rect(5, 5, 10, 10, [255, 244, 220])
  },
  [TILE.whiteboard]: (g) => {
    g.fillNoise([248, 250, 252], 3)
    g.rect(0, 0, 15, 15, [214, 218, 224])
    g.rect(1, 1, 14, 14, [250, 252, 254])
    for (let i = 0; i < 8; i++) g.set(2 + i, 5, [86, 132, 196])
    for (let i = 0; i < 10; i++) g.set(3 + i, 8, [138, 148, 162])
    for (let i = 0; i < 6; i++) g.set(4 + i, 11, [138, 148, 162])
    g.rect(2, 3, 5, 3, [220, 90, 90])
  },
  [TILE.gymFloor]: (g) => {
    g.fillNoise([204, 156, 96], 8)
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x++) if (g.n(x, y) > 0.5) g.set(x, y, [188, 140, 84])
    g.lineH(0, [170, 124, 72])
    g.lineV(0, [170, 124, 72])
  },
  [TILE.gymMat]: (g) => {
    g.fillNoise([58, 76, 92], 7)
    g.specks([46, 62, 76], 0.16)
    g.rect(0, 0, 15, 0, [80, 100, 118])
  },
  [TILE.noticeBoard]: (g) => {
    g.fillNoise([150, 116, 78], 7)
    const cols: RGB[] = [
      [246, 240, 218],
      [250, 220, 140],
      [176, 214, 240],
      [240, 190, 200],
      [200, 236, 196],
    ]
    for (let i = 0; i < 7; i++) {
      const w = 3 + Math.floor(g.n(i, 2) * 3)
      const h = 3 + Math.floor(g.n(i, 6) * 3)
      const x = 1 + Math.floor(g.n(i, 11) * (14 - w))
      const y = 1 + Math.floor(g.n(i, 17) * (14 - h))
      const c = cols[i % cols.length]
      g.rect(x, y, x + w, y + h, c)
      for (let k = 1; k < h; k++) for (let kx = x + 1; kx < x + w; kx++) if (g.n(kx, y + k) > 0.6) g.set(kx, y + k, shade(c, 0.7))
      g.set(x + 1, y, [220, 80, 80])
    }
  },
  [TILE.arcade]: (g) => {
    g.fillNoise([34, 38, 56], 6)
    g.rect(1, 1, 14, 8, [26, 20, 46])
    for (let i = 0; i < 14; i++) g.set(i + 1, 3, [255, 108, 210])
    for (let c = 0; c < 4; c++) g.set(3 + c * 3, 6, [120, 255, 230])
    g.rect(1, 9, 14, 10, [70, 60, 110])
    g.rect(4, 12, 7, 14, [255, 208, 96])
    g.rect(10, 12, 12, 14, [230, 96, 130])
  },
  [TILE.checkerA]: (g) => {
    g.fillNoise([238, 238, 234], 4)
  },
  [TILE.checkerB]: (g) => {
    g.fillNoise([58, 62, 74], 5)
  },
  [TILE.woodFloor]: (g) => {
    g.fillNoise([186, 146, 100], 7)
    for (let y = 0; y < 16; y += 3) {
      g.lineH(y, [156, 118, 78])
      for (let x = 0; x < 16; x++) if (g.n(x, y + 1) > 0.8) g.set(x, y + 1, [168, 128, 86])
    }
    for (let x = 0; x < 16; x += 5) g.lineV(x, [172, 132, 90])
  },
  [TILE.signWood]: (g) => {
    g.fillNoise([138, 98, 62], 7)
    g.rect(1, 1, 14, 14, [166, 122, 78])
    for (let i = 0; i < 10; i++) g.set(3 + i, 5, [92, 66, 42])
    for (let i = 0; i < 7; i++) g.set(4 + i, 8, [92, 66, 42])
    for (let i = 0; i < 4; i++) g.set(5 + i, 11, [92, 66, 42])
  },
  [TILE.acoustic]: (g) => {
    g.fillNoise([86, 78, 96], 6)
    for (let y = 0; y < 16; y += 3) for (let x = 0; x < 16; x++) g.set(x, y, [70, 64, 80])
  },
  [TILE.coffee]: (g) => {
    g.fillNoise([52, 54, 62], 5)
    g.rect(1, 1, 14, 6, [30, 32, 40])
    g.rect(3, 2, 6, 4, [255, 186, 92])
    g.rect(9, 2, 12, 4, [120, 220, 255])
    g.rect(2, 8, 13, 12, [74, 62, 56])
    g.rect(6, 13, 9, 14, [214, 214, 210])
    g.rect(4, 9, 5, 10, [246, 246, 240])
    g.rect(11, 9, 12, 10, [246, 246, 240])
  },
  [TILE.grassDark]: (g) => {
    g.fillNoise(shade(C.grass, 0.86), 16)
    g.specks(C.grassDark, 0.24)
  },
  [TILE.grassDry]: (g) => {
    g.fillNoise([164, 172, 96], 16)
    g.specks([136, 146, 76], 0.22)
  },
  [TILE.gravel]: (g) => {
    g.fillNoise([146, 142, 134], 14)
    g.specks([116, 112, 106], 0.3, 2)
    g.specks([180, 176, 168], 0.2)
  },
  [TILE.dirtPath]: (g) => {
    g.fillNoise([152, 126, 92], 12)
    g.specks([128, 102, 72], 0.25)
    g.specks([176, 150, 112], 0.12)
  },
  [TILE.poster]: (g) => {
    g.fillNoise([36, 34, 48], 5)
    g.rect(1, 1, 14, 14, [26, 24, 36])
    g.rect(2, 2, 13, 6, [236, 88, 152])
    g.rect(2, 8, 13, 8, [96, 224, 255])
    for (let i = 0; i < 9; i++) g.set(4 + i, 11, [226, 226, 236])
    for (let i = 0; i < 5; i++) g.set(4 + i, 13, [180, 180, 196])
  },
  [TILE.clothRed]: (g) => {
    g.fillNoise([176, 64, 72], 10)
    g.specks([150, 48, 56], 0.2)
  },
  [TILE.counter]: (g) => {
    g.fillNoise([226, 224, 218], 5)
    g.rect(0, 0, 15, 2, [246, 246, 242])
    for (let x = 0; x < 16; x += 5) g.lineV(x, [198, 196, 190])
  },
  [TILE.towel]: (g) => {
    g.fillNoise([226, 232, 240], 8)
    g.rect(0, 5, 15, 7, [184, 206, 226])
    g.rect(0, 11, 15, 12, [184, 206, 226])
  },
}

export function createAtlasTexture(): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_PX
  canvas.height = ATLAS_PX
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(ATLAS_PX, ATLAS_PX)
  const data = img.data

  for (let tileId = 0; tileId < ATLAS_TILES * ATLAS_TILES; tileId++) {
    const tx = tileId % ATLAS_TILES
    const ty = Math.floor(tileId / ATLAS_TILES)
    const g = new TileGrid(data, tx * TILE_PX, ty * TILE_PX, 1337 + tileId * 977)
    const painter = painters[tileId]
    if (painter) painter(g)
    else g.fill([255, 0, 255])
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestMipmapLinearFilter
  tex.generateMipmaps = true
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 8
  tex.needsUpdate = true
  return tex
}

/** UV rect for a tile, inset slightly to avoid bleeding */
export function tileUV(tileId: number) {
  const tx = tileId % ATLAS_TILES
  const ty = Math.floor(tileId / ATLAS_TILES)
  const size = 1 / ATLAS_TILES
  const inset = 0.0006
  return {
    u0: tx * size + inset,
    v1: 1 - ty * size - inset,
    u1: (tx + 1) * size - inset,
    v0: 1 - (ty + 1) * size + inset,
  }
}
