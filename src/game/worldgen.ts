import { B } from '../engine/blocks'
import { fbm2, mulberry32 } from '../engine/noise'
import { VoxelWorld, WX, WY, WZ } from '../engine/world'

export type POI = {
  id: string
  type: string
  x: number
  y: number
  z: number
  label: string
  prompt: string
  radius?: number
  data?: Record<string, unknown>
}

export type Zone = { id: string; name: string; x0: number; z0: number; x1: number; z1: number }

export type NpcSpawn = {
  id: string
  name: string
  role: string
  x: number
  y: number
  z: number
  area: [number, number, number, number]
  shirt: number
  pants: number
  skin: number
  hair: number
  hairStyle: 'short' | 'long' | 'bun' | 'cap' | 'curly'
  idle?: boolean
  yaw?: number
}

export type GenResult = {
  playerSpawn: { x: number; y: number; z: number; yaw: number }
  pois: POI[]
  npcs: NpcSpawn[]
  zones: Zone[]
}

const C = 128
const GY = 16 // surface block height of the campus plateau

export function generateCampus(world: VoxelWorld): GenResult {
  return new CampusGen(world).run()
}

class CampusGen {
  w: VoxelWorld
  pois: POI[] = []
  npcs: NpcSpawn[] = []
  zones: Zone[] = []
  rng = mulberry32(20240917)

  constructor(world: VoxelWorld) {
    this.w = world
  }

  // ---------------------------------------------------------------- primitives
  set(x: number, y: number, z: number, b: number) {
    this.w.set(Math.round(x), Math.round(y), Math.round(z), b)
  }
  get(x: number, y: number, z: number) {
    return this.w.get(Math.round(x), Math.round(y), Math.round(z))
  }
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: number) {
    const ax = Math.min(x0, x1)
    const bx = Math.max(x0, x1)
    const ay = Math.min(y0, y1)
    const by = Math.max(y0, y1)
    const az = Math.min(z0, z1)
    const bz = Math.max(z0, z1)
    for (let y = ay; y <= by; y++) for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) this.w.set(x, y, z, b)
  }
  hollow(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, wall: number, floor: number, ceil: number) {
    this.fill(x0, y0, z0, x1, y1, z1, B.AIR)
    this.fill(x0, y0, z0, x1, y0, z1, floor)
    this.fill(x0, y1, z0, x1, y1, z1, ceil)
    for (let y = y0 + 1; y < y1; y++) {
      for (let x = x0; x <= x1; x++) {
        this.set(x, y, z0, wall)
        this.set(x, y, z1, wall)
      }
      for (let z = z0; z <= z1; z++) {
        this.set(x0, y, z, wall)
        this.set(x1, y, z, wall)
      }
    }
  }
  windowsZ(x: number, z0: number, z1: number, ys: number[], spacing = 4) {
    for (let z = z0 + 2; z <= z1 - 2; z += spacing) {
      for (const y of ys) {
        this.set(x, y, z, B.GLASS)
        this.set(x, y, z + 1, B.GLASS)
      }
    }
  }
  windowsX(z: number, x0: number, x1: number, ys: number[], spacing = 4) {
    for (let x = x0 + 2; x <= x1 - 2; x += spacing) {
      for (const y of ys) {
        this.set(x, y, z, B.GLASS)
        this.set(x + 1, y, z, B.GLASS)
      }
    }
  }
  neonBar(x: number, y: number, z: number, len: number, axis: 'x' | 'z', b: number) {
    for (let i = 0; i < len; i++) {
      if (axis === 'x') this.set(x + i, y, z, b)
      else this.set(x, y, z + i, b)
    }
  }
  groundY(x: number, z: number) {
    for (let y = WY - 1; y >= 0; y--) {
      const b = this.get(x, y, z)
      if (b !== B.AIR && b !== B.WATER && b !== B.LEAVES && b !== B.BUSH) return y
    }
    return GY
  }

  // ---------------------------------------------------------------- props
  tree(x: number, z: number, size = 1) {
    const baseY = this.groundY(x, z)
    const h = Math.round((4 + this.rng() * 3) * size)
    for (let y = baseY + 1; y <= baseY + h; y++) this.set(x, y, z, B.LOG)
    const top = baseY + h
    const r = 2 + Math.round(this.rng() * 2 * size)
    for (let dy = -2; dy <= 2; dy++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.sqrt(dx * dx + dz * dz + dy * dy * 1.7)
          if (d <= r + this.rng() * 0.7 && this.get(x + dx, top + dy, z + dz) === B.AIR) {
            this.set(x + dx, top + dy, z + dz, B.LEAVES)
          }
        }
    for (let i = 0; i <= 2; i++) this.set(x, top - 2 + i, z, B.LOG)
  }
  pine(x: number, z: number) {
    const baseY = this.groundY(x, z)
    const h = 7 + Math.round(this.rng() * 4)
    for (let y = baseY + 1; y <= baseY + h; y++) this.set(x, y, z, B.LOG)
    let r = 3
    for (let y = baseY + 3; y <= baseY + h + 1; y += 2) {
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) + Math.abs(dz) <= r && this.get(x + dx, y, z + dz) === B.AIR) {
            this.set(x + dx, y, z + dz, B.LEAVES)
          }
        }
      r = Math.max(1, r - 1)
    }
  }
  bush(x: number, z: number, block = B.BUSH) {
    const y = this.groundY(x, z)
    if (this.get(x, y, z) !== B.GRASS && this.get(x, y, z) !== B.GRASS_DARK) return
    this.set(x, y + 1, z, block)
    if (this.rng() > 0.5) this.set(x + 1, y + 1, z, block)
    if (this.rng() > 0.6) this.set(x, y + 2, z, block)
  }
  flowers(x: number, z: number, r = 3) {
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (this.rng() > 0.7) {
          const y = this.groundY(x + dx, z + dz)
          if (this.get(x + dx, y, z + dz) === B.GRASS)
            this.set(x + dx, y, z + dz, this.rng() > 0.5 ? B.FLOWER : B.FLOWER_YELLOW)
        }
      }
  }
  lampPost(x: number, z: number) {
    const y = this.groundY(x, z)
    for (let i = 1; i <= 4; i++) this.set(x, y + i, z, B.METAL)
    this.set(x, y + 5, z, B.LAMP)
    this.set(x + 1, y + 5, z, B.METAL)
    this.set(x + 1, y + 4, z, B.LAMP)
  }
  bench(x: number, z: number, axis: 'x' | 'z') {
    const y = this.groundY(x, z)
    if (axis === 'x') {
      this.fill(x - 2, y + 1, z, x + 2, y + 1, z, B.PLANK)
      this.fill(x - 2, y + 2, z - 1, x + 2, y + 2, z - 1, B.PLANK)
    } else {
      this.fill(x, y + 1, z - 2, x, y + 1, z + 2, B.PLANK)
      this.fill(x - 1, y + 2, z - 2, x - 1, y + 2, z + 2, B.PLANK)
    }
  }
  picnicTable(x: number, z: number) {
    const y = this.groundY(x, z)
    this.fill(x - 2, y + 2, z - 1, x + 2, y + 2, z + 1, B.PLANK)
    for (const [dx, dz] of [
      [-2, -1],
      [2, -1],
      [-2, 1],
      [2, 1],
    ])
      this.set(x + dx, y + 1, z + dz, B.WOOD_DARK)
    this.fill(x - 2, y + 1, z - 2, x + 2, y + 1, z - 2, B.PLANK)
    this.fill(x - 2, y + 1, z + 2, x + 2, y + 1, z + 2, B.PLANK)
  }
  bikeRack(x: number, z: number, n = 4) {
    const y = this.groundY(x, z)
    for (let i = 0; i < n; i++) {
      this.set(x + i * 2, y + 1, z, B.METAL)
      this.set(x + i * 2, y + 2, z, B.METAL)
      this.set(x + i * 2 + 1, y + 2, z, B.METAL)
    }
  }
  acUnit(x: number, y: number, z: number) {
    this.fill(x, y, z, x + 2, y + 1, z + 1, B.METAL)
    this.set(x + 1, y + 1, z, B.CONCRETE_DARK)
  }
  stairs(x0: number, x1: number, zStart: number, zStep: number, baseFloorY: number, steps: number, ceilY: number) {
    // clear the stair shaft first
    const zEnd0 = zStart + (steps - 1) * zStep
    const ca = Math.min(zStart, zEnd0) - 1
    const cb = Math.max(zStart, zEnd0) + 1
    this.fill(x0, baseFloorY + 1, ca, x1, ceilY - 1, cb, B.AIR)
    for (let i = 0; i < steps; i++) {
      const z0 = zStart + i * zStep
      const z1 = z0 + (zStep > 0 ? 1 : -1)
      for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) {
        for (let x = x0; x <= x1; x++) {
          for (let y = baseFloorY; y <= baseFloorY + 1 + i; y++) this.set(x, y, z, B.CONCRETE)
        }
      }
    }
    const zEnd = zStart + (steps - 1) * zStep
    const za = Math.min(zStart, zEnd) - 1
    const zb = Math.max(zStart, zEnd) + 1
    this.fill(x0, ceilY, za, x1, ceilY, zb, B.AIR)
    for (let x = x0; x <= x1; x++) this.set(x, ceilY + 1, zb, B.LAMP)
  }

  stairsX(xStart: number, xStep: number, z0: number, z1: number, baseFloorY: number, steps: number, ceilY: number) {
    const xEnd = xStart + (steps - 1) * xStep
    const ca = Math.min(xStart, xEnd) - 1
    const cb = Math.max(xStart, xEnd) + 1
    this.fill(ca, baseFloorY + 1, z0, cb, ceilY - 1, z1, B.AIR)
    for (let i = 0; i < steps; i++) {
      const xa = xStart + i * xStep
      const xb = xa + (xStep > 0 ? 1 : -1)
      for (let x = Math.min(xa, xb); x <= Math.max(xa, xb); x++)
        for (let z = z0; z <= z1; z++)
          for (let y = baseFloorY; y <= baseFloorY + 1 + i; y++) this.set(x, y, z, B.CONCRETE)
    }
    this.fill(ca, ceilY, z0, cb, ceilY, z1, B.AIR)
    for (let z = z0; z <= z1; z++) this.set(cb, ceilY + 1, z, B.LAMP)
  }

  // ---------------------------------------------------------------- terrain
  terrain() {
    for (let z = 0; z < WZ; z++) {
      for (let x = 0; x < WX; x++) {
        const dx = x - C
        const dz = z - C
        const dist = Math.hypot(dx, dz)
        const outside = Math.min(1, Math.max(0, (dist - 106) / 32))
        const hill = fbm2(x * 0.013, z * 0.013, 4, 4242) * 22 - 8
        const roll = (fbm2(x * 0.045, z * 0.045, 3, 999) - 0.5) * 2.2
        let h = GY + Math.round(hill * outside + roll * (1 - outside))
        h = Math.max(4, Math.min(34, h))
        const pdx = (x - 188) / 26
        const pdz = (z - 62) / 19
        const pd = pdx * pdx + pdz * pdz
        let water = false
        if (pd < 1.35) {
          h = 14 - Math.min(2, Math.round((1 - pd) * 4))
          if (pd < 0.95) water = true
        }
        for (let y = 0; y <= h; y++) {
          let b: number
          if (y === h) {
            if (water || (pd < 1.2 && h <= 14)) b = B.SAND
            else if (h > 24) b = B.STONE
            else if (h > 20) b = B.GRASS_DRY
            else b = B.GRASS
          } else if (y > h - 4) b = h > 22 ? B.STONE : B.DIRT
          else b = B.STONE
          this.w.set(x, y, z, b)
        }
        if (water) for (let y = h + 1; y <= 13; y++) this.w.set(x, y, z, B.WATER)
      }
    }
    this.zones.push({ id: 'wilds', name: 'The Wilds', x0: 0, z0: 0, x1: WX, z1: WZ })
  }

  flatten(x0: number, z0: number, x1: number, z1: number, surface: number = B.GRASS, y: number = GY) {
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        for (let yy = y + 1; yy < WY; yy++) this.w.set(x, yy, z, B.AIR)
        this.w.set(x, y, z, surface)
        this.w.set(x, y - 1, z, B.DIRT)
      }
  }

  // ---------------------------------------------------------------- paths + plaza
  paths() {
    this.flatten(16, C - 5, WX - 16, C + 4, B.PAVER)
    this.flatten(C - 5, 16, C + 4, WZ - 16, B.PAVER)
    for (let x = 16; x <= WX - 16; x++) {
      this.set(x, GY, C - 6, B.CONCRETE)
      this.set(x, GY, C + 5, B.CONCRETE)
    }
    for (let z = 16; z <= WZ - 16; z++) {
      this.set(C - 6, GY, z, B.CONCRETE)
      this.set(C + 5, GY, z, B.CONCRETE)
    }
    this.flatten(78, 122, 118, 130, B.PAVER)
    this.flatten(104, 76, 112, 124, B.PAVER)
    this.flatten(138, 122, 180, 130, B.PAVER)
    this.flatten(122, 138, 130, 180, B.PAVER)
    this.flatten(136, 150, 172, 172, B.PAVER)
    this.flatten(76, 150, 128, 178, B.PAVER)
    this.flatten(228, C - 14, 234, C + 26, B.ASPHALT)
    this.flatten(212, C + 8, 234, C + 14, B.ASPHALT)
  }

  plaza() {
    const r = 26
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.hypot(dx, dz)
        if (d > r) continue
        const x = C + dx
        const z = C + dz
        let b: number = B.PAVER
        if (d > r - 2) b = B.CONCRETE
        else if ((Math.floor(dx / 4) + Math.floor(dz / 4)) % 2 === 0) b = B.PAVEMENT
        this.set(x, GY, z, b)
        for (let y = GY + 1; y < GY + 14; y++) this.set(x, y, z, B.AIR)
        if (d < 8.5) {
          this.set(x, GY, z, B.STONE_BRICK)
          this.set(x, GY - 1, z, B.STONE_BRICK)
          if (d < 6.2) {
            this.set(x, GY + 1, z, B.WATER)
            this.set(x, GY, z, B.WATER)
          }
          if (d > 6.2 && d < 7.4) this.set(x, GY + 1, z, B.CONCRETE)
        }
      }
    for (let y = GY + 1; y <= GY + 4; y++) this.fill(C - 1, y, C - 1, C + 1, y, C + 1, B.STONE_BRICK)
    this.fill(C - 1, GY + 5, C - 1, C + 1, GY + 5, C + 1, B.NEON_CYAN)
    this.set(C, GY + 6, C, B.NEON_CYAN)
    this.set(C, GY + 7, C, B.WATER)

    for (const [bx, bz] of [
      [C - 20, C - 20],
      [C + 20, C - 20],
      [C - 20, C + 20],
      [C + 20, C + 20],
    ]) {
      this.flatten(bx - 4, bz - 4, bx + 4, bz + 4, B.GRASS)
      for (let i = -4; i <= 4; i++) {
        this.set(bx + i, GY, bz - 4, B.STONE_BRICK)
        this.set(bx + i, GY, bz + 4, B.STONE_BRICK)
        this.set(bx - 4, GY, bz + i, B.STONE_BRICK)
        this.set(bx + 4, GY, bz + i, B.STONE_BRICK)
      }
      this.flowers(bx, bz, 3)
      this.tree(bx, bz, 1.2)
    }
    for (const ang of [0.4, 1.9, 3.6, 5.2]) {
      this.bench(Math.round(C + Math.cos(ang) * 17), Math.round(C + Math.sin(ang) * 17), 'x')
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      this.lampPost(Math.round(C + Math.cos(a) * 23), Math.round(C + Math.sin(a) * 23))
    }
    this.zones.push({ id: 'plaza', name: 'The Quad', x0: C - 28, z0: C - 28, x1: C + 28, z1: C + 28 })
    this.pois.push({
      id: 'fountain',
      type: 'fountain',
      x: C,
      y: GY + 1,
      z: C,
      label: 'Founders Fountain',
      prompt: 'Toss a coin into the fountain',
      radius: 9,
    })
    ;[0.9, 2.4, 4.1, 5.6].forEach((ang, i) => {
      this.pois.push({
        id: 'bench' + i,
        type: 'bench',
        x: Math.round(C + Math.cos(ang) * 19),
        y: GY + 1,
        z: Math.round(C + Math.sin(ang) * 19),
        label: 'Quad Bench',
        prompt: 'Sit and watch campus life',
        radius: 2.8,
      })
    })
  }

  // ---------------------------------------------------------------- dorm
  dorm() {
    const x0 = 36
    const x1 = 78
    const z0 = 104
    const z1 = 152
    this.flatten(x0 - 2, z0 - 2, x1 + 2, z1 + 2, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)

    const floors = [
      { fy: GY + 1, cy: GY + 6, fx: B.WOOD_FLOOR },
      { fy: GY + 6, cy: GY + 11, fx: B.CARPET_RED },
      { fy: GY + 11, cy: GY + 16, fx: B.CARPET_BLUE },
    ]

    for (const f of floors) {
      for (let y = f.fy; y < f.cy; y++) {
        for (let x = x0; x <= x1; x++) {
          this.set(x, y, z0, B.BRICK)
          this.set(x, y, z1, B.BRICK)
        }
        for (let z = z0; z <= z1; z++) {
          this.set(x0, y, z, B.BRICK)
          this.set(x1, y, z, B.BRICK)
        }
      }
      const wy = [f.fy + 2, f.fy + 3]
      this.windowsZ(x0, z0, z1, wy, 6)
      this.windowsZ(x1, z0, z1, wy, 6)
      this.windowsX(z0, x0, x1, wy, 6)
      this.windowsX(z1, x0, x1, wy, 6)
      for (let x = x0; x <= x1; x++) {
        this.set(x, f.cy - 1, z0, B.BRICK_CREAM)
        this.set(x, f.cy - 1, z1, B.BRICK_CREAM)
      }
      for (let z = z0; z <= z1; z++) {
        this.set(x0, f.cy - 1, z, B.BRICK_CREAM)
        this.set(x1, f.cy - 1, z, B.BRICK_CREAM)
      }
      this.fill(x0, f.fy, z0, x1, f.fy, z1, f.fx)
      this.fill(x0, f.cy, z0, x1, f.cy, z1, B.CONCRETE)
    }

    // roof + parapet + roof plant
    this.fill(x0, GY + 16, z0, x1, GY + 16, z1, B.ROOF)
    for (let x = x0; x <= x1; x++) {
      this.set(x, GY + 17, z0, B.CONCRETE_DARK)
      this.set(x, GY + 17, z1, B.CONCRETE_DARK)
    }
    for (let z = z0; z <= z1; z++) {
      this.set(x0, GY + 17, z, B.CONCRETE_DARK)
      this.set(x1, GY + 17, z, B.CONCRETE_DARK)
    }
    this.acUnit(x0 + 6, GY + 17, z0 + 8)
    this.acUnit(x1 - 10, GY + 17, z1 - 14)
    this.neonBar(x0 + 14, GY + 17, z1 - 18, 8, 'x', B.NEON_CYAN)

    // interior: corridor spine + entry hall
    const cx0 = 55
    const cx1 = 60
    for (const f of floors) {
      const fy2 = f.fy + 1
      this.fill(x0 + 1, fy2, z0 + 1, x1 - 1, f.cy - 1, z1 - 1, B.AIR)
      for (let z = z0 + 4; z <= z1 - 3; z++) {
        for (let y = fy2; y < f.cy; y++) {
          this.set(cx0 - 1, y, z, B.PLANK)
          this.set(cx1 + 1, y, z, B.PLANK)
        }
      }
      for (let x = x0 + 1; x < cx0 - 1; x++) {
        for (let y = fy2; y < f.cy; y++) this.set(x, y, 126, B.PLANK)
      }
      for (let x = cx1 + 2; x < x1; x++) {
        for (let y = fy2; y < f.cy; y++) {
          this.set(x, y, 125, B.PLANK)
          this.set(x, y, 131, B.PLANK)
        }
      }
      for (const dz of [112, 140]) {
        for (let x of [cx0 - 1, cx1 + 1]) {
          this.set(x, fy2, dz, B.AIR)
          this.set(x, fy2 + 1, dz, B.AIR)
          this.set(x, fy2, dz + 1, B.AIR)
          this.set(x, fy2 + 1, dz + 1, B.AIR)
        }
      }
      for (let z = z0 + 6; z < z1 - 4; z += 7) {
        this.set(cx0 + 2, f.cy - 1, z, B.LAMP)
        this.set(cx0 + 3, f.cy - 1, z, B.LAMP)
        if (z % 2 === 0) this.set(cx0 + 4, fy2 + 1, z, B.POSTER)
      }
      // opening from the spine into the entry hall
      for (let z = 126; z <= 130; z++)
        for (let y = fy2; y <= fy2 + 2; y++) this.set(cx1 + 1, y, z, B.AIR)
      // doorway into the stair hall
      for (let z = 116; z <= 117; z++)
        for (let y = fy2; y <= fy2 + 1; y++) this.set(cx1 + 1, y, z, B.AIR)
      this.fill(cx0 + 1, f.fy, 127, cx1 - 1, f.fy, 129, B.CARPET_BLUE)
      this.set(cx0 + 2, fy2, 138, B.CHAIR)
      this.set(cx1 - 1, fy2, 138, B.CHAIR)
      this.set(cx0 + 2, fy2, 136, B.TABLE)
    }

    // stair hall (east-north room): two flights, one per floor
    this.stairs(64, 70, 123, -2, GY + 1, 5, GY + 6)
    this.stairs(72, 76, 123, -2, GY + 6, 5, GY + 11)

    // rooms
    for (let f = 0; f < 3; f++) {
      const fy = GY + 1 + f * 5
      for (const rx of [41, 65]) {
        for (const rz of [116, 140]) {
          if (rx === 65 && rz === 116) continue
          this.roomFurniture(rx, rz, fy, f === 0 && rx === 41 && rz === 116)
        }
      }
    }

    // entrance (east) + canopy + neon
    const entZ = 128
    this.fill(x1, GY + 1, entZ - 2, x1, GY + 4, entZ + 2, B.AIR)
    this.fill(x1, GY + 1, entZ - 2, x1, GY + 1, entZ + 2, B.TILE_WHITE)
    for (const z of [entZ - 2, entZ + 2]) {
      for (let y = GY + 2; y <= GY + 4; y++) this.set(x1, y, z, B.GLASS)
    }
    this.fill(x1 + 1, GY + 5, entZ - 4, x1 + 5, GY + 5, entZ + 4, B.CONCRETE)
    for (const cz of [entZ - 4, entZ + 4]) {
      for (let y = GY + 1; y <= GY + 4; y++) this.set(x1 + 5, y, cz, B.CONCRETE_DARK)
    }
    this.fill(x1 + 1, GY, entZ - 3, x1 + 5, GY, entZ + 3, B.PAVEMENT)
    this.neonBar(x1 + 1, GY + 8, entZ - 5, 11, 'z', B.NEON_PINK)
    this.neonBar(x1 + 1, GY + 7, entZ - 3, 7, 'z', B.NEON_CYAN)
    this.fill(x1 + 1, GY + 9, entZ - 6, x1 + 1, GY + 11, entZ + 6, B.SIGN_WOOD)

    // courtyard
    this.picnicTable(90, 118)
    this.picnicTable(90, 138)
    this.bench(84, 108, 'z')
    this.bench(84, 148, 'z')
    this.bikeRack(82, 104)
    for (let i = 0; i < 5; i++) this.tree(84 + (i % 2) * 12, 100 - i * 6)
    this.lampPost(84, 128)
    this.lampPost(96, 110)
    this.lampPost(96, 146)

    this.zones.push({ id: 'dorm', name: 'Halcyon Hall', x0: x0 - 4, z0: z0 - 4, x1: x1 + 8, z1: z1 + 4 })
    this.zones.push({ id: 'yourRoom', name: 'Your Room (214)', x0: 37, z0: 105, x1: 54, z1: 126 })
    this.pois.push({
      id: 'bed',
      type: 'bed',
      x: 42,
      y: GY + 2,
      z: 116,
      label: 'Your Bed',
      prompt: 'Sleep until morning',
      radius: 2.8,
    })
    this.pois.push({
      id: 'desk',
      type: 'study',
      x: 45,
      y: GY + 2,
      z: 119,
      label: 'Your Desk',
      prompt: 'Study for a bit',
      radius: 2.6,
    })
    this.pois.push({
      id: 'dormLobby',
      type: 'phone',
      x: 57,
      y: GY + 2,
      z: 138,
      label: 'Corridor Notice Wall',
      prompt: 'Read notices',
      radius: 3,
    })
    this.npcs.push({
      id: 'juno',
      name: 'Juno',
      role: 'Roommate',
      x: 49,
      y: GY + 2,
      z: 112,
      area: [38, 106, 52, 124],
      shirt: 0xf25f8c,
      pants: 0x2f3a56,
      skin: 0xc98a5e,
      hair: 0x2b2118,
      hairStyle: 'curly',
      idle: true,
      yaw: Math.PI * 0.75,
    })
  }

  roomFurniture(rx: number, rz: number, fy: number, isPlayerRoom: boolean) {
    const y = fy + 1
    this.fill(rx - 1, y, rz - 1, rx, y, rz + 1, B.BED)
    if (isPlayerRoom) this.fill(rx - 1, y, rz + 2, rx, y, rz + 2, B.BED)
    this.fill(rx + 2, y, rz + 2, rx + 3, y, rz + 2, B.DESK)
    this.set(rx + 2, y, rz + 3, B.CHAIR)
    this.fill(rx + 2, fy, rz - 1, rx + 4, fy, rz, B.CARPET_BLUE)
    this.set(rx + 1, fy + 4, rz, B.LAMP)
    this.set(rx + 3, fy + 4, rz + 2, B.LAMP)
    this.set(rx + 4, y, rz + 3, B.BUSH)
    this.set(rx - 2, y, rz - 2, B.CHAIR)
    if (this.rng() > 0.4) this.set(rx + 4, y, rz - 2, B.BOOKS)
    if (this.rng() > 0.5) this.set(rx - 1, fy + 3, rz + 2, B.POSTER)
  }

  // ---------------------------------------------------------------- lecture hall
  lectureHall() {
    const x0 = 104
    const x1 = 152
    const z0 = 44
    const z1 = 80
    this.flatten(x0 - 3, z0 - 3, x1 + 3, z1 + 3, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)
    const fy = GY + 1
    const top = GY + 17
    this.hollow(x0, fy, z0, x1, top, z1, B.BRICK_CREAM, B.WOOD_FLOOR, B.ROOF)

    for (const wy of [fy + 3, fy + 4, fy + 5, fy + 6]) {
      this.windowsZ(x0, z0, z1, [wy], 6)
      this.windowsZ(x1, z0, z1, [wy], 6)
    }
    for (const wy of [fy + 6, fy + 7, fy + 8]) this.windowsX(z0, x0, x1, [wy], 5)

    // tiered audience bowl, rising toward a raised stage at the north
    for (let t = 0; t < 9; t++) {
      const tz = z1 - 6 - t * 3
      const th = fy + t
      for (let z = tz - 2; z <= tz; z++)
        for (let x = x0 + 3; x <= x1 - 3; x++)
          for (let y = fy; y <= th; y++) this.set(x, y, z, y === th ? B.GYM_FLOOR : B.CONCRETE_DARK)
      for (let x = x0 + 5; x <= x1 - 5; x += 2) {
        if (x >= 123 && x <= 133) continue
        this.set(x, th + 1, tz, B.CHAIR)
        if (x % 6 === 0) this.set(x, th + 1, tz - 1, B.DESK)
      }
    }
    // stage platform at the top tier level
    const stageTop = fy + 8
    this.fill(x0 + 3, fy, z0 + 3, x1 - 3, stageTop - 1, z0 + 6, B.CONCRETE_DARK)
    this.fill(x0 + 3, stageTop, z0 + 3, x1 - 3, stageTop, z0 + 6, B.GYM_FLOOR)
    // lectern + chalkboard + projector screen
    this.fill(x0 + 19, stageTop + 1, z0 + 5, x0 + 22, stageTop + 2, z0 + 6, B.WOOD_DARK)
    this.set(x0 + 20, stageTop + 3, z0 + 5, B.METAL)
    this.set(x0 + 20, stageTop + 4, z0 + 5, B.LAMP)
    this.fill(x0 + 10, fy + 10, z0, x1 - 10, fy + 15, z0, B.CHALKBOARD)
    this.fill(x0 + 16, fy + 11, z0 + 1, x1 - 16, fy + 15, z0 + 1, B.SCREEN)
    for (let z = z0 + 5; z < z1 - 5; z += 4) {
      this.fill(x0, fy + 9, z, x0, fy + 13, z + 1, B.ACOUSTIC)
      this.fill(x1, fy + 9, z, x1, fy + 13, z + 1, B.ACOUSTIC)
    }
    for (let z = z0 + 6; z < z1 - 4; z += 6)
      for (let x = x0 + 8; x < x1 - 6; x += 10) {
        this.set(x, top - 1, z, B.LAMP)
        this.set(x + 1, top - 1, z, B.LAMP)
      }
    const entX = 128
    this.fill(entX - 3, fy + 1, z1, entX + 3, fy + 4, z1, B.AIR)
    this.fill(entX - 2, fy + 2, z1, entX + 2, fy + 4, z1, B.GLASS)
    this.fill(entX - 4, GY + 5, z1 + 1, entX + 4, GY + 5, z1 + 4, B.CONCRETE)
    for (const sx of [entX - 4, entX + 4]) for (let y = fy; y <= GY + 4; y++) this.set(sx, y, z1 + 4, B.CONCRETE_DARK)
    this.neonBar(entX - 6, GY + 8, z1 + 1, 13, 'x', B.NEON_CYAN)
    this.fill(entX - 7, GY + 6, z1 + 1, entX + 7, GY + 7, z1 + 1, B.SIGN_WOOD)
    this.fill(entX - 7, GY, z1 + 1, entX + 7, GY, z1 + 5, B.PAVEMENT)
    for (const cx of [entX - 8, entX + 8]) for (let y = GY + 1; y <= GY + 12; y++) this.set(cx, y, z1 + 3, B.CONCRETE)
    this.lampPost(entX - 14, z1 + 8)
    this.lampPost(entX + 14, z1 + 8)
    this.tree(x0 - 6, z1 + 2, 1.4)
    this.tree(x1 + 6, z1 + 2, 1.4)

    this.zones.push({ id: 'lecture', name: 'Vox Hall', x0: x0 - 4, z0: z0 - 4, x1: x1 + 4, z1: z1 + 10 })
    this.pois.push({
      id: 'podium',
      type: 'podium',
      x: x0 + 20,
      y: fy + 9,
      z: z0 + 4,
      label: 'The Podium',
      prompt: 'Take the lectern',
      radius: 3.2,
    })
    this.pois.push({
      id: 'lectureSeat',
      type: 'seat',
      x: 128,
      y: fy + 1,
      z: z1 - 12,
      label: 'Lecture Seat',
      prompt: 'Sit in on a lecture',
      radius: 5,
    })
    this.npcs.push({
      id: 'vox',
      name: 'Prof. Ada Vox',
      role: 'Lecturer, CompSci',
      x: x0 + 20,
      y: fy + 9,
      z: z0 + 3,
      area: [x0 + 11, z0 + 3, x0 + 30, z0 + 9],
      shirt: 0x2f4f7a,
      pants: 0x23283a,
      skin: 0xe0b089,
      hair: 0xd9d4c8,
      hairStyle: 'bun',
      idle: true,
      yaw: Math.PI,
    })
  }

  // ---------------------------------------------------------------- library
  library() {
    const x0 = 178
    const x1 = 218
    const z0 = 100
    const z1 = 150
    this.flatten(x0 - 3, z0 - 3, x1 + 3, z1 + 3, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)
    const fy = GY + 1
    const mid = GY + 8
    const top = GY + 15
    this.hollow(x0, fy, z0, x1, mid, z1, B.BRICK_CREAM, B.WOOD_FLOOR, B.WOOD_FLOOR)
    this.hollow(x0, mid, z0, x1, top, z1, B.BRICK_CREAM, B.WOOD_FLOOR, B.ROOF)
    for (const wy of [fy + 2, fy + 3, mid + 2, mid + 3]) {
      this.windowsZ(x0, z0, z1, [wy], 5)
      this.windowsZ(x1, z0, z1, [wy], 5)
      this.windowsX(z0, x0, x1, [wy], 5)
      this.windowsX(z1, x0, x1, [wy], 5)
    }
    // mezzanine opening + railing
    this.fill(x0 + 6, mid, z0 + 8, x1 - 6, mid, z1 - 8, B.AIR)
    for (let x = x0 + 6; x <= x1 - 6; x++) {
      this.set(x, mid, z0 + 8, B.PLANK)
      this.set(x, mid, z1 - 8, B.PLANK)
      if (x % 3 === 0) {
        this.set(x, mid + 1, z0 + 8, B.METAL)
        this.set(x, mid + 1, z1 - 8, B.METAL)
      }
    }
    // ground floor stacks
    for (let z = z0 + 5; z <= z1 - 5; z += 5)
      for (let x = x0 + 4; x <= x1 - 4; x += 7) {
        this.fill(x, fy + 1, z, x + 3, fy + 3, z, B.BOOKS)
        this.fill(x, fy + 1, z + 1, x + 3, fy + 3, z + 1, B.BOOKS)
      }
    // upper reading room — furniture sits on the ring balcony
    for (const [fz0, fz1] of [
      [z0 + 2, z0 + 6],
      [z1 - 6, z1 - 2],
    ]) {
      for (let x = x0 + 7; x <= x1 - 7; x += 8) {
        if (x > x1 - 12 && fz0 === z0 + 2) continue
        this.fill(x, mid + 1, fz0, x + 1, mid + 1, fz1, B.TABLE)
        for (let z = fz0; z <= fz1; z += 2) {
          this.set(x - 1, mid + 1, z, z % 4 === 0 ? B.CHAIR : B.CHAIR)
        }
        this.set(x, mid + 3, fz0, B.LAMP)
      }
    }
    // ground floor reading tables
    for (let z = z0 + 14; z <= z1 - 10; z += 8)
      for (let x = x0 + 6; x <= x1 - 12; x += 10) {
        this.fill(x, fy + 1, z, x + 2, fy + 1, z + 1, B.WOOD_DARK)
        this.set(x - 1, fy + 1, z, B.CHAIR)
        this.set(x + 3, fy + 1, z + 1, B.CHAIR)
        this.set(x, fy + 3, z, B.LAMP)
      }
    // stairs up (back-west corner)
    this.stairs(x0 + 4, x0 + 6, z1 - 4, -2, fy, 7, mid)
    // checkout desk
    this.fill(x0 + 14, fy + 1, z0 + 6, x0 + 18, fy + 1, z0 + 7, B.COUNTER)
    this.set(x0 + 16, fy + 2, z0 + 6, B.METAL)
    this.set(x0 + 16, fy + 3, z0 + 6, B.LAMP)
    this.fill(x0 + 12, fy + 1, z0 + 4, x0 + 13, fy + 3, z0 + 4, B.BOOKS)
    for (let z = z0 + 6; z < z1 - 4; z += 7)
      for (let x = x0 + 6; x < x1 - 4; x += 8) {
        this.set(x, mid - 1, z, B.LAMP)
        this.set(x + 1, mid - 1, z, B.LAMP)
        this.set(x, top - 1, z, B.LAMP)
      }
    // quiet zone marker
    this.fill(x0 + 8, fy, z0 + 20, x0 + 16, fy, z0 + 28, B.CARPET_RED)

    const entZ = 126
    this.fill(x0, fy + 1, entZ - 3, x0, fy + 4, entZ + 3, B.AIR)
    this.fill(x0, fy + 2, entZ - 2, x0, fy + 4, entZ + 2, B.GLASS)
    this.fill(x0 - 4, GY + 5, entZ - 5, x0 - 1, GY + 5, entZ + 5, B.CONCRETE)
    this.neonBar(x0 - 1, GY + 8, entZ - 6, 13, 'z', B.NEON_CYAN)
    this.neonBar(x0 - 1, GY + 7, entZ - 4, 9, 'z', B.NEON_PINK)
    this.fill(x0 - 1, GY + 9, entZ - 7, x0 - 1, GY + 12, entZ + 7, B.SIGN_WOOD)
    this.lampPost(x0 - 6, entZ - 10)
    this.lampPost(x0 - 6, entZ + 10)
    this.flowers(x0 - 5, entZ + 13)

    this.zones.push({ id: 'library', name: 'The Archive', x0: x0 - 5, z0: z0 - 3, x1: x1 + 3, z1: z1 + 3 })
    this.pois.push({
      id: 'libraryDesk',
      type: 'library',
      x: x0 + 16,
      y: fy + 1,
      z: z0 + 9,
      label: 'Checkout Desk',
      prompt: 'Talk to the librarian',
      radius: 3,
    })
    this.pois.push({
      id: 'studyTable',
      type: 'study',
      x: x0 + 11,
      y: fy + 1,
      z: z0 + 22,
      label: 'Quiet Zone Table',
      prompt: 'Study in the quiet zone',
      radius: 3,
    })
    this.pois.push({
      id: 'lostBook',
      type: 'book',
      x: x1 - 8,
      y: fy + 2,
      z: z1 - 9,
      label: 'Misfiled Book',
      prompt: 'Pick up the glowing book',
      radius: 3,
    })
    this.npcs.push({
      id: 'mira',
      name: 'Mira',
      role: 'Library RA',
      x: x0 + 16,
      y: fy + 1,
      z: z0 + 10,
      area: [x0 + 13, z0 + 5, x0 + 19, z0 + 9],
      shirt: 0x3f8f7a,
      pants: 0x2b3540,
      skin: 0x8d5a3b,
      hair: 0x1c1712,
      hairStyle: 'long',
      idle: true,
      yaw: 0,
    })
    this.npcs.push({
      id: 'nadia',
      name: 'Nadia',
      role: 'Study Group Lead',
      x: x0 + 12,
      y: fy + 1,
      z: z0 + 24,
      area: [x0 + 8, z0 + 18, x0 + 16, z0 + 28],
      shirt: 0xd9b04a,
      pants: 0x3a3048,
      skin: 0xb87a4a,
      hair: 0x3a2a1c,
      hairStyle: 'short',
    })
  }

  // ---------------------------------------------------------------- cafeteria
  cafeteria() {
    const x0 = 96
    const x1 = 136
    const z0 = 178
    const z1 = 214
    this.flatten(x0 - 3, z0 - 3, x1 + 3, z1 + 3, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)
    const fy = GY + 1
    const top = GY + 11
    this.hollow(x0, fy, z0, x1, top, z1, B.BRICK, B.TILE_WHITE, B.ROOF)
    for (let x = x0 + 4; x <= x1 - 4; x += 5)
      for (let y = fy + 2; y <= fy + 6; y++) {
        this.set(x, y, z0, B.GLASS)
        this.set(x + 1, y, z0, B.GLASS)
      }
    for (const y of [fy + 2, fy + 4, fy + 6])
      for (let x = x0 + 2; x <= x1 - 2; x++)
        if (this.get(x, y, z0) !== B.GLASS) this.set(x, y, z0, B.WINDOW_FRAME)
    // counter + kitchen
    this.fill(x0 + 4, fy + 1, z1 - 7, x1 - 4, fy + 1, z1 - 5, B.COUNTER)
    this.fill(x0 + 4, fy + 2, z1 - 7, x1 - 4, fy + 2, z1 - 7, B.COUNTER)
    for (let x = x0 + 1; x <= x1 - 1; x++)
      for (let y = fy + 1; y < top; y++)
        if (this.get(x, y, z1 - 3) === B.AIR) this.set(x, y, z1 - 3, B.TILE_WHITE)
    this.fill(x0 + 6, fy + 1, z1 - 3, x0 + 10, fy + 3, z1 - 3, B.AIR)
    this.fill(x0 + 6, fy + 1, z1 - 3, x0 + 10, fy + 1, z1 - 3, B.COUNTER)
    for (const cx of [x0 + 14, x0 + 20]) {
      this.fill(cx, fy + 3, z1 - 7, cx + 1, fy + 3, z1 - 7, B.COFFEE_MACHINE)
      this.set(cx, fy + 2, z1 - 6, B.METAL)
    }
    this.fill(x0 + 26, fy + 3, z1 - 7, x0 + 29, fy + 3, z1 - 7, B.VENDING)
    // tables
    for (let z = z0 + 8; z <= z1 - 12; z += 6)
      for (let x = x0 + 6; x <= x1 - 8; x += 7) {
        this.fill(x, fy + 1, z, x + 1, fy + 1, z + 1, B.TABLE)
        this.set(x - 1, fy + 1, z, B.CHAIR)
        this.set(x + 2, fy + 1, z + 1, B.CHAIR)
        this.set(x, fy + 1, z - 1, B.CHAIR)
        this.set(x + 1, fy + 1, z + 2, B.CHAIR)
      }
    for (let z = z0 + 6; z < z1 - 4; z += 6)
      for (let x = x0 + 5; x < x1 - 4; x += 7) this.set(x, top - 1, z, B.LAMP)
    this.neonBar(x0 + 6, fy + 6, z1 - 4, 10, 'x', B.NEON_AMBER)
    this.neonBar(x0 + 20, fy + 6, z1 - 4, 8, 'x', B.NEON_PINK)
    this.fill(x0 + 18, fy + 7, z1 - 4, x0 + 27, fy + 9, z1 - 4, B.SIGN_WOOD)

    const entX = 116
    this.fill(entX - 3, fy + 1, z0, entX + 3, fy + 4, z0, B.AIR)
    this.fill(entX - 2, fy + 2, z0, entX + 2, fy + 4, z0, B.GLASS)
    this.fill(entX - 5, GY + 5, z0 - 4, entX + 5, GY + 5, z0 - 1, B.CLOTH_RED)
    for (const sx of [entX - 5, entX + 5]) for (let y = fy; y <= GY + 4; y++) this.set(sx, y, z0 - 4, B.METAL)
    this.neonBar(entX - 6, GY + 8, z0 - 1, 13, 'x', B.NEON_AMBER)
    this.picnicTable(entX - 12, z0 - 8)
    this.picnicTable(entX + 12, z0 - 8)
    this.picnicTable(entX, z0 - 14)
    this.flowers(entX - 8, z0 - 4)
    this.flowers(entX + 8, z0 - 4)
    this.lampPost(entX - 16, z0 - 4)
    this.lampPost(entX + 16, z0 - 4)
    this.bench(x0 - 5, z0 + 10, 'z')
    this.tree(x0 - 6, z0 + 22, 1.3)
    this.tree(x1 + 6, z0 + 16, 1.3)

    this.zones.push({ id: 'cafeteria', name: 'The Grind', x0: x0 - 6, z0: z0 - 16, x1: x1 + 6, z1: z1 + 3 })
    this.pois.push({
      id: 'coffee',
      type: 'coffee',
      x: x0 + 20,
      y: fy + 1,
      z: z1 - 8,
      label: 'The Grind Espresso Bar',
      prompt: 'Buy a coffee (¤3)',
      radius: 3.6,
    })
    this.pois.push({
      id: 'vending',
      type: 'vending',
      x: x0 + 28,
      y: fy + 1,
      z: z1 - 8,
      label: 'Vending Machine',
      prompt: 'Buy a snack (¤2)',
      radius: 3,
    })
    this.pois.push({
      id: 'cafeteriaTable',
      type: 'social',
      x: x0 + 13,
      y: fy + 1,
      z: z0 + 14,
      label: 'Lunch Table',
      prompt: 'Sit with some strangers',
      radius: 4,
    })
    this.npcs.push({
      id: 'ravi',
      name: 'Ravi',
      role: 'Barista',
      x: x0 + 22,
      y: fy + 1,
      z: z1 - 9,
      area: [x0 + 16, z1 - 10, x0 + 32, z1 - 8],
      shirt: 0x6b4a2f,
      pants: 0x2b2b33,
      skin: 0x8a5a3a,
      hair: 0x171310,
      hairStyle: 'cap',
      idle: true,
      yaw: Math.PI,
    })
    this.npcs.push({
      id: 'studentCafe',
      name: 'Tomas',
      role: 'First-year, Film',
      x: x0 + 10,
      y: fy + 1,
      z: z0 + 20,
      area: [x0 + 6, z0 + 8, x1 - 8, z1 - 12],
      shirt: 0x8f6dc4,
      pants: 0x36324a,
      skin: 0xd8a878,
      hair: 0x6b3f1f,
      hairStyle: 'long',
    })
  }

  // ---------------------------------------------------------------- student union
  union() {
    const x0 = 170
    const x1 = 214
    const z0 = 172
    const z1 = 216
    this.flatten(x0 - 3, z0 - 3, x1 + 3, z1 + 3, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)
    const fy = GY + 1
    const top = GY + 14
    this.hollow(x0, fy, z0, x1, top, z1, B.CONCRETE, B.CARPET_BLUE, B.ROOF)
    for (const wy of [fy + 2, fy + 3, fy + 4, fy + 9, fy + 10]) {
      this.windowsX(z0, x0, x1, [wy], 4)
      this.windowsX(z1, x0, x1, [wy], 4)
      this.windowsZ(x0, z0, z1, [wy], 4)
      this.windowsZ(x1, z0, z1, [wy], 4)
    }
    // corner loft upstairs (arcade mezzanine) + stair flight
    this.fill(x0 + 16, GY + 8, z1 - 18, x1 - 2, GY + 8, z1 - 2, B.WOOD_FLOOR)
    for (let x = x0 + 16; x <= x1 - 2; x++) this.set(x, GY + 9, z1 - 18, x % 2 === 0 ? B.METAL : B.PLANK)
    for (let z = z1 - 18; z <= z1 - 2; z++) this.set(x0 + 16, GY + 9, z, z % 2 === 0 ? B.METAL : B.PLANK)
    this.stairsX(x1 - 10, -2, z1 - 11, z1 - 8, fy, 7, GY + 8)
    for (const [tx, tz] of [
      [x0 + 22, z1 - 14],
      [x0 + 30, z1 - 14],
      [x0 + 38, z1 - 14],
    ]) {
      this.fill(tx, GY + 9, tz, tx + 1, GY + 9, tz + 1, B.TABLE)
      this.set(tx - 1, GY + 9, tz, B.CHAIR)
      this.set(tx + 2, GY + 9, tz + 1, B.CHAIR)
      this.set(tx, GY + 11, tz, B.LAMP)
    }
    this.neonBar(x0 + 18, GY + 9, z1 - 19, 12, 'x', B.NEON_CYAN)
    // arcade corner
    for (let i = 0; i < 4; i++) {
      this.set(x0 + 4 + i * 2, fy + 1, z1 - 4, B.ARCADE)
      this.set(x0 + 4 + i * 2, fy + 2, z1 - 4, B.ARCADE)
    }
    this.neonBar(x0 + 3, GY + 5, z1 - 3, 9, 'x', B.NEON_PINK)
    this.neonBar(x0 + 3, GY + 4, z1 - 5, 9, 'x', B.NEON_CYAN)
    // sofas
    for (const [sx, sz] of [
      [x0 + 8, z0 + 10],
      [x0 + 8, z0 + 16],
      [x1 - 12, z0 + 8],
    ]) {
      this.fill(sx, fy + 1, sz, sx + 4, fy + 1, sz + 1, B.CLOTH_RED)
      this.fill(sx, fy + 2, sz - 1, sx + 4, fy + 2, sz - 1, B.CLOTH_RED)
      this.fill(sx, fy + 1, sz - 1, sx + 4, fy + 1, sz - 1, B.WOOD_DARK)
      this.set(sx + 2, fy + 1, sz + 3, B.TABLE)
    }
    // stage
    this.fill(x1 - 14, fy + 1, z0 + 14, x1 - 3, fy + 1, z0 + 26, B.WOOD_DARK)
    this.neonBar(x1 - 14, GY + 7, z0 + 13, 12, 'x', B.NEON_PINK)
    this.set(x1 - 8, fy + 2, z0 + 20, B.LAMP)
    // notice board
    for (let x = x0 + 16; x <= x0 + 22; x++) this.set(x, fy + 3, z0 + 1, B.NOTICE_BOARD)
    this.fill(x0 + 15, fy + 1, z0 + 1, x0 + 23, fy + 2, z0 + 1, B.WOOD_DARK)
    // info desk
    this.fill(x0 + 16, fy + 1, z0 + 8, x0 + 22, fy + 1, z0 + 9, B.COUNTER)
    this.set(x0 + 19, fy + 2, z0 + 8, B.METAL)
    // tables
    for (let z = z0 + 6; z <= z0 + 20; z += 6)
      for (let x = x0 + 26; x <= x1 - 6; x += 8) {
        this.fill(x, fy + 1, z, x + 1, fy + 1, z + 1, B.TABLE)
        this.set(x - 1, fy + 1, z, B.CHAIR)
        this.set(x + 2, fy + 1, z + 1, B.CHAIR)
      }
    for (let z = z0 + 6; z < z1 - 4; z += 7)
      for (let x = x0 + 6; x < x1 - 4; x += 9) {
        this.set(x, top - 1, z, B.LAMP)
        this.set(x + 1, top - 1, z, B.LAMP)
      }
    for (let x = x0 + 6; x < x1 - 6; x += 8) this.set(x, GY + 8 - 1, z0 + 6, B.LAMP)

    const entZ = 194
    this.fill(x0, fy + 1, entZ - 4, x0, fy + 5, entZ + 4, B.AIR)
    this.fill(x0, fy + 3, entZ - 3, x0, fy + 5, entZ + 3, B.GLASS)
    this.fill(x0 - 5, GY + 6, entZ - 6, x0 - 1, GY + 6, entZ + 6, B.CONCRETE)
    this.neonBar(x0 - 1, GY + 10, entZ - 8, 17, 'z', B.NEON_PINK)
    this.neonBar(x0 - 1, GY + 8, entZ - 5, 11, 'z', B.NEON_CYAN)
    this.fill(x0 - 1, GY + 11, entZ - 9, x0 - 1, GY + 14, entZ + 9, B.SIGN_WOOD)
    this.flatten(x0 - 14, entZ - 10, x0 - 2, entZ + 10, B.PAVER)
    this.bench(x0 - 8, entZ - 10, 'x')
    this.bench(x0 - 8, entZ + 10, 'x')
    this.lampPost(x0 - 12, entZ - 14)
    this.lampPost(x0 - 12, entZ + 14)
    this.tree(x0 - 8, z0 - 6, 1.3)
    this.tree(x1 + 6, z1 + 6, 1.5)

    this.zones.push({ id: 'union', name: 'The Hive', x0: x0 - 16, z0: z0 - 6, x1: x1 + 4, z1: z1 + 4 })
    this.pois.push({
      id: 'noticeBoard',
      type: 'notice',
      x: x0 + 19,
      y: fy + 1,
      z: z0 + 2,
      label: 'Club Notice Board',
      prompt: 'Browse club posters',
      radius: 3.4,
    })
    this.pois.push({
      id: 'arcade',
      type: 'arcade',
      x: x0 + 7,
      y: fy + 1,
      z: z1 - 5,
      label: 'Arcade Row',
      prompt: 'Play "Voxel Kart" (¤2)',
      radius: 3.4,
    })
    this.pois.push({
      id: 'unionStage',
      type: 'stage',
      x: x1 - 8,
      y: fy + 2,
      z: z0 + 20,
      label: 'Open Mic Stage',
      prompt: 'Grab the mic',
      radius: 3.4,
    })
    this.pois.push({
      id: 'lounge',
      type: 'social',
      x: x0 + 10,
      y: fy + 1,
      z: z0 + 14,
      label: 'Lounge Sofa',
      prompt: 'Chill with the regulars',
      radius: 3,
    })
    this.npcs.push({
      id: 'kai',
      name: 'Kai',
      role: 'Arcade Champion',
      x: x0 + 8,
      y: fy + 1,
      z: z1 - 6,
      area: [x0 + 4, z1 - 10, x0 + 16, z1 - 4],
      shirt: 0x38c9a8,
      pants: 0x24303c,
      skin: 0xd8a878,
      hair: 0x1b1611,
      hairStyle: 'cap',
      idle: true,
      yaw: Math.PI * 1.5,
    })
    this.npcs.push({
      id: 'dean',
      name: 'Dean Okafor',
      role: 'Dean of Students',
      x: x0 + 19,
      y: fy + 1,
      z: z0 + 11,
      area: [x0 + 15, z0 + 5, x0 + 24, z0 + 16],
      shirt: 0x4a3f6b,
      pants: 0x2a2636,
      skin: 0x6b4228,
      hair: 0x120f0c,
      hairStyle: 'short',
      idle: true,
      yaw: 0.6,
    })
  }

  // ---------------------------------------------------------------- gym
  gym() {
    const x0 = 36
    const x1 = 82
    const z0 = 176
    const z1 = 214
    this.flatten(x0 - 3, z0 - 3, x1 + 3, z1 + 3, B.GRASS)
    this.fill(x0, GY, z0, x1, GY, z1, B.CONCRETE)
    const fy = GY + 1
    const top = GY + 14
    this.hollow(x0, fy, z0, x1, top, z1, B.CONCRETE, B.GYM_FLOOR, B.ROOF)
    for (const wy of [fy + 6, fy + 7]) {
      this.windowsX(z0, x0, x1, [wy], 4)
      this.windowsX(z1, x0, x1, [wy], 4)
      this.windowsZ(x0, z0, z1, [wy], 4)
      this.windowsZ(x1, z0, z1, [wy], 4)
    }
    // court lines
    for (let x = x0 + 4; x <= x1 - 4; x++) {
      this.set(x, GY, z0 + 6, B.CHECKER_A)
      this.set(x, GY, z1 - 6, B.CHECKER_A)
      this.set(x, GY, Math.round((z0 + z1) / 2), B.CHECKER_A)
    }
    for (let z = z0 + 6; z <= z1 - 6; z++) {
      this.set(x0 + 4, GY, z, B.CHECKER_A)
      this.set(x1 - 4, GY, z, B.CHECKER_A)
    }
    for (let dx = -4; dx <= 4; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        const d = Math.hypot(dx, dz)
        if (d > 3.4 && d < 4.2) this.set(128 - 40 + dx, GY, 196 + dz, B.CHECKER_B)
      }
    // hoops
    for (const hx of [x0 + 6, x1 - 6]) {
      for (let y = fy + 4; y <= fy + 6; y++) this.set(hx, y, 196, B.METAL)
      this.set(hx, fy + 6, 196, B.NEON_AMBER)
      this.set(hx, GY, 194, B.METAL)
      this.set(hx, GY, 198, B.METAL)
    }
    // weight zone
    this.fill(x0 + 30, GY, z1 - 12, x1 - 3, GY, z1 - 4, B.GYM_MAT)
    for (let i = 0; i < 5; i++) {
      this.fill(x0 + 32 + i * 3, fy + 1, z1 - 10, x0 + 33 + i * 3, fy + 1, z1 - 10, B.METAL)
      this.set(x0 + 32 + i * 3, fy + 1, z1 - 9, B.METAL)
    }
    // bleachers
    for (let i = 0; i < 4; i++) {
      this.fill(x0 + 4, fy + 1 + i, z0 + 1 + i, x0 + 20, fy + 1 + i, z0 + 1 + i, B.PLANK)
      for (let y = fy; y <= fy + i; y++) this.fill(x0 + 4, y, z0 + 1 + i, x0 + 20, y, z0 + 1 + i, B.CONCRETE_DARK)
    }
    for (let x = x0 + 4; x <= x0 + 18; x++) this.set(x, fy + 1, z1 - 1, B.METAL)
    this.fill(x1, fy + 2, z0 + 4, x1, fy + 6, z0 + 14, B.GLASS)
    for (let z = z0 + 5; z < z1 - 4; z += 6)
      for (let x = x0 + 6; x < x1 - 4; x += 9) {
        this.set(x, top - 1, z, B.LAMP)
        this.set(x + 1, top - 1, z, B.LAMP)
      }
    const entX = 60
    this.fill(entX - 3, fy + 1, z0, entX + 3, fy + 4, z0, B.AIR)
    this.fill(entX - 2, fy + 2, z0, entX + 2, fy + 4, z0, B.GLASS)
    this.fill(entX - 5, GY + 5, z0 - 4, entX + 5, GY + 5, z0 - 1, B.CONCRETE)
    this.neonBar(entX - 6, GY + 8, z0 - 1, 13, 'x', B.NEON_GREEN)
    this.fill(entX - 7, GY + 9, z0 - 1, entX + 7, GY + 10, z0 - 1, B.SIGN_WOOD)
    this.lampPost(entX - 12, z0 - 6)
    this.lampPost(entX + 12, z0 - 6)
    this.bikeRack(x0 - 2, z0 + 6)
    this.tree(x0 - 6, z1 + 6, 1.4)
    this.tree(x1 + 6, z0 + 10, 1.4)

    this.zones.push({ id: 'gym', name: 'Iron Lotus Rec Centre', x0: x0 - 6, z0: z0 - 8, x1: x1 + 6, z1: z1 + 4 })
    this.pois.push({
      id: 'gymWeights',
      type: 'gym',
      x: x0 + 34,
      y: fy + 1,
      z: z1 - 7,
      label: 'Weight Bench',
      prompt: 'Lift something heavy',
      radius: 3.6,
    })
    this.pois.push({
      id: 'gymHoop',
      type: 'hoop',
      x: 128 - 40,
      y: fy + 1,
      z: 196,
      label: 'Basketball Half-Court',
      prompt: 'Shoot some hoops',
      radius: 4,
    })
    this.npcs.push({
      id: 'coach',
      name: 'Coach Bianchi',
      role: 'Head Coach',
      x: x0 + 32,
      y: fy + 1,
      z: z1 - 8,
      area: [x0 + 28, z1 - 12, x1 - 4, z1 - 4],
      shirt: 0xe05a4a,
      pants: 0x2b3240,
      skin: 0xd8a878,
      hair: 0x3a2a1c,
      hairStyle: 'short',
      idle: true,
      yaw: Math.PI * 0.9,
    })
    this.npcs.push({
      id: 'studentGym',
      name: 'Priya',
      role: 'Track & Field',
      x: 128 - 36,
      y: fy + 1,
      z: 190,
      area: [x0 + 6, z0 + 8, x1 - 8, z1 - 8],
      shirt: 0xff8a3d,
      pants: 0x2b3240,
      skin: 0x9c6440,
      hair: 0x1a1512,
      hairStyle: 'bun',
    })
  }

  // ---------------------------------------------------------------- sports field
  field() {
    const x0 = 24
    const x1 = 96
    const z0 = 26
    const z1 = 96
    this.flatten(x0, z0, x1, z1, B.GRASS)
    const midx = Math.round((x0 + x1) / 2)
    const midz = Math.round((z0 + z1) / 2)
    for (let x = x0 + 4; x <= x1 - 4; x++)
      for (let z = z0 + 4; z <= z1 - 4; z++) {
        if (Math.floor((z - z0) / 6) % 2 === 0) this.set(x, GY, z, B.GRASS_DARK)
      }
    for (let x = x0 + 5; x <= x1 - 5; x++) {
      this.set(x, GY, z0 + 5, B.CHECKER_A)
      this.set(x, GY, z1 - 5, B.CHECKER_A)
      this.set(x, GY, midz, B.CHECKER_A)
    }
    for (let z = z0 + 5; z <= z1 - 5; z++) {
      this.set(x0 + 5, GY, z, B.CHECKER_A)
      this.set(x1 - 5, GY, z, B.CHECKER_A)
    }
    for (let dx = -8; dx <= 8; dx++)
      for (let dz = -8; dz <= 8; dz++) {
        const d = Math.hypot(dx, dz)
        if (d > 7 && d < 7.8) this.set(midx + dx, GY, midz + dz, B.CHECKER_A)
      }
    for (const gx of [x0 + 5, x1 - 5]) {
      for (let dz = -6; dz <= 6; dz++) {
        this.set(gx, GY + 1, midz + dz, B.METAL)
        this.set(gx, GY + 2, midz + dz, B.METAL)
      }
      for (let y = GY + 1; y <= GY + 3; y++) {
        this.set(gx, y, midz - 6, B.METAL)
        this.set(gx, y, midz + 6, B.METAL)
      }
      this.fill(gx, GY + 3, midz - 6, gx, GY + 3, midz + 6, B.METAL)
    }
    for (let i = 0; i < 5; i++) {
      this.fill(x0 + 12, GY + 1 + i, z1 - 6 + i, x1 - 12, GY + 1 + i, z1 - 6 + i, B.PLANK)
      for (let y = GY; y <= GY + i; y++) this.fill(x0 + 12, y, z1 - 6 + i, x1 - 12, y, z1 - 6 + i, B.CONCRETE_DARK)
    }
    for (const bz of [z0 + 12, z1 - 14]) this.fill(midx - 8, GY + 1, bz, midx + 8, GY + 1, bz, B.PLANK)
    for (const [lx, lz] of [
      [x0 + 8, z0 + 8],
      [x1 - 8, z0 + 8],
      [x0 + 8, z1 - 8],
    ])
      this.lampPost(lx, lz)
    this.bikeRack(x0 + 6, z0 - 4)
    this.zones.push({ id: 'field', name: 'Voxel Park Pitch', x0: x0 - 2, z0: z0 - 2, x1: x1 + 2, z1: z1 + 4 })
    this.pois.push({
      id: 'fieldBall',
      type: 'ball',
      x: midx,
      y: GY + 1,
      z: midz,
      label: 'Match Ball',
      prompt: 'Kick the ball around',
      radius: 3.4,
    })
    this.npcs.push({
      id: 'studentField',
      name: 'Marco',
      role: 'Midfielder',
      x: midx + 10,
      y: GY + 1,
      z: midz + 8,
      area: [x0 + 8, z0 + 8, x1 - 8, z1 - 14],
      shirt: 0x2f8fd0,
      pants: 0xffffff,
      skin: 0xd0a074,
      hair: 0x241a12,
      hairStyle: 'short',
    })
  }

  // ---------------------------------------------------------------- pond + bus
  pondProps() {
    const dx = 188
    const dz = 40
    for (let x = dx - 6; x <= dx + 6; x++)
      for (let z = dz - 8; z <= dz - 6; z++) this.set(x, 15, z, B.PLANK)
    for (const px of [dx - 6, dx + 6]) {
      for (let z = dz - 8; z <= dz - 6; z++) for (let y = 11; y <= 15; y++) this.set(px, y, z, B.LOG)
    }
    this.bench(dx - 12, dz - 4, 'x')
    this.bench(dx + 12, dz - 4, 'x')
    this.lampPost(dx - 10, dz - 12)
    this.lampPost(dx + 10, dz - 12)
    for (let i = 0; i < 40; i++) {
      const a = this.rng() * Math.PI * 2
      const r = 20 + this.rng() * 7
      const x = Math.round(dx + Math.cos(a) * r)
      const z = Math.round(66 + Math.sin(a) * r * 0.8)
      if (this.get(x, 13, z) === B.WATER) {
        this.set(x, 14, z, B.BUSH)
        if (this.rng() > 0.6) this.set(x, 15, z, B.BUSH)
      }
    }
    for (let i = 0; i < 20; i++) {
      const x = dx + Math.round((this.rng() - 0.5) * 30)
      const z = 66 + Math.round((this.rng() - 0.5) * 20)
      if (this.get(x, 13, z) === B.WATER) this.set(x, 13, z, B.LEAVES)
    }
    for (const [tx, tz] of [
      [dx - 20, 88],
      [dx + 18, 84],
      [dx - 14, 34],
      [dx + 22, 36],
    ])
      this.pine(tx, tz)
    this.zones.push({ id: 'pond', name: 'Mirror Pond', x0: dx - 30, z0: 34, x1: dx + 30, z1: 96 })
    this.pois.push({
      id: 'pondDock',
      type: 'pond',
      x: dx,
      y: 16,
      z: dz - 7,
      label: 'Mirror Pond Dock',
      prompt: 'Sit on the dock',
      radius: 4,
    })
  }

  busStop() {
    const x = 224
    const z = 130
    this.flatten(214, 118, 238, 142, B.PAVEMENT)
    this.fill(x - 5, GY + 4, z, x + 5, GY + 4, z + 3, B.METAL)
    for (const [px, pz] of [
      [x - 5, z],
      [x + 5, z],
      [x + 5, z + 3],
      [x - 5, z + 1],
    ]) {
      for (let y = GY + 1; y <= GY + 3; y++) this.set(px, y, pz, B.METAL)
    }
    this.set(x, GY + 4, z + 3, B.LAMP)
    this.fill(x - 3, GY + 1, z + 1, x + 2, GY + 1, z + 1, B.PLANK)
    this.fill(x - 4, GY + 2, z + 1, x + 3, GY + 2, z + 1, B.GLASS)
    this.neonBar(x - 4, GY + 3, z - 1, 9, 'x', B.NEON_CYAN)
    // parked shuttle
    this.fill(214, GY + 1, 148, 232, GY + 4, 152, B.METAL)
    this.fill(216, GY + 2, 149, 222, GY + 3, 151, B.GLASS)
    this.fill(224, GY + 2, 149, 230, GY + 3, 151, B.GLASS)
    this.fill(215, GY + 1, 148, 231, GY + 1, 152, B.CONCRETE_DARK)
    for (const wx of [217, 226]) {
      this.set(wx, GY, 149, B.STONE_DARK)
      this.set(wx, GY, 151, B.STONE_DARK)
    }
    this.neonBar(216, GY + 5, 149, 8, 'x', B.NEON_AMBER)
    this.zones.push({ id: 'bus', name: 'Campus Loop Stop', x0: 210, z0: 116, x1: 240, z1: 150 })
    this.pois.push({
      id: 'busStop',
      type: 'bus',
      x: x - 4,
      y: GY + 1,
      z: z + 2,
      label: 'Campus Loop Shuttle',
      prompt: 'Ride the shuttle to the Quad',
      radius: 4,
    })
  }

  props() {
    for (let x = 24; x <= 232; x += 16) {
      if (Math.abs(x - C) < 30) continue
      this.tree(x, C - 9 + (this.rng() > 0.5 ? 0 : 1))
      this.tree(x, C + 9 - (this.rng() > 0.5 ? 0 : 1))
    }
    for (let z = 40; z <= 216; z += 18) {
      if (Math.abs(z - C) < 30) continue
      this.tree(C - 9, z)
      this.tree(C + 9, z)
    }
    for (let i = 0; i < 280; i++) {
      const a = this.rng() * Math.PI * 2
      const r = 102 + this.rng() * 22
      const x = Math.round(C + Math.cos(a) * r)
      const z = Math.round(C + Math.sin(a) * r)
      const b = this.get(x, GY, z)
      if (b === B.GRASS || b === B.GRASS_DARK || b === B.GRASS_DRY) {
        if (this.rng() > 0.45) this.tree(x, z, 0.9 + this.rng() * 0.7)
        else this.bush(x, z)
      }
    }
    const avoid = (x: number, z: number) => {
      for (const zn of this.zones) {
        if (x > zn.x0 - 2 && x < zn.x1 + 2 && z > zn.z0 - 2 && z < zn.z1 + 2) return true
      }
      return false
    }
    for (let i = 0; i < 90; i++) {
      const x = 20 + Math.floor(this.rng() * 216)
      const z = 20 + Math.floor(this.rng() * 216)
      if (avoid(x, z)) continue
      if (this.get(x, GY, z) !== B.GRASS) continue
      const r = this.rng()
      if (r > 0.74) this.tree(x, z, 0.9 + this.rng() * 0.6)
      else if (r > 0.48) this.bush(x, z)
      else this.flowers(x, z, 2)
    }
    for (let x = 34; x <= 222; x += 24) {
      this.lampPost(x, C - 8)
      this.lampPost(x + 12, C + 8)
    }
    for (let z = 36; z <= 220; z += 26) {
      this.lampPost(C - 8, z)
      this.lampPost(C + 8, z)
    }
    for (let i = -18; i <= 18; i++) {
      if (Math.abs(i) % 5 !== 0) {
        this.set(C + i, GY + 1, C - 28, B.HEDGE)
        this.set(C + i, GY + 1, C + 28, B.HEDGE)
      }
    }
    this.fill(C - 8, GY + 1, 236, C + 8, GY + 1, 237, B.SIGN_WOOD)
    this.fill(C - 8, GY + 2, 236, C - 6, GY + 3, 236, B.STONE_BRICK)
    this.fill(C + 6, GY + 2, 236, C + 8, GY + 3, 236, B.STONE_BRICK)
  }

  run(): GenResult {
    this.terrain()
    this.paths()
    this.plaza()
    this.dorm()
    this.lectureHall()
    this.library()
    this.cafeteria()
    this.union()
    this.gym()
    this.field()
    this.pondProps()
    this.busStop()
    this.props()

    const crowd: Array<[string, string, [number, number, number, number]]> = [
      ['student1', 'Aisha', [C - 20, C - 20, C + 20, C + 20]],
      ['student2', 'Ben', [C - 24, C - 6, C + 24, C + 20]],
      ['student3', 'Chloe', [80, 108, 108, 132]],
      ['student4', 'Dmitri', [180, 104, 212, 146]],
      ['student5', 'Eun-ji', [100, 180, 130, 208]],
      ['student6', 'Farid', [174, 178, 208, 210]],
      ['student7', 'Greta', [40, 180, 76, 208]],
      ['student8', 'Hugo', [30, 30, 90, 90]],
      ['student9', 'Imani', [C - 30, 60, C + 30, 100]],
      ['student10', 'Jonas', [150, 200, 200, 230]],
      ['student11', 'Keiko', [C - 20, C - 40, C + 20, C - 20]],
    ]
    const shirts = [0xf25f8c, 0x3f8f7a, 0xd9b04a, 0x8f6dc4, 0x38c9a8, 0xff8a3d, 0x5d8ce0, 0xe05a4a]
    const skins = [0xd8a878, 0x8d5a3b, 0xe0b089, 0x6b4228, 0xb87a4a, 0xc98a5e]
    const hairs = [0x1b1611, 0x3a2a1c, 0x6b3f1f, 0xd9d4c8, 0x241a12]
    const styles: Array<'short' | 'long' | 'bun' | 'cap' | 'curly'> = ['short', 'long', 'bun', 'cap', 'curly']
    crowd.forEach(([id, name, area], i) => {
      this.npcs.push({
        id,
        name,
        role: ['First-year, Art', 'Second-year, Physics', 'Third-year, Law', 'Exchange, Music', 'Fourth-year, Design'][i % 5],
        x: area[0] + 4 + Math.floor(this.rng() * Math.max(1, area[2] - area[0] - 8)),
        y: GY + 1,
        z: area[1] + 4 + Math.floor(this.rng() * Math.max(1, area[3] - area[1] - 8)),
        area,
        shirt: shirts[i % shirts.length],
        pants: [0x2f3a56, 0x2b3240, 0x36324a, 0x24303c][i % 4],
        skin: skins[i % skins.length],
        hair: hairs[i % hairs.length],
        hairStyle: styles[i % styles.length],
      })
    })

    return {
      playerSpawn: { x: 47.5, y: GY + 2, z: 114.5, yaw: 0.18 },
      pois: this.pois,
      npcs: this.npcs,
      zones: this.zones,
    }
  }
}
