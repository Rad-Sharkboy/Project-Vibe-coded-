import { B, blockDef, emitOf, isOpaque, isSolid, isTransparent } from './blocks'

export const WX = 256
export const WY = 56
export const WZ = 256
export const CHUNK = 32
export const CHUNKS_X = WX / CHUNK
export const CHUNKS_Z = WZ / CHUNK

export function idx(x: number, y: number, z: number) {
  return (y * WZ + z) * WX + x
}

export class VoxelWorld {
  blocks = new Uint8Array(WX * WY * WZ)
  sky = new Uint8Array(WX * WY * WZ)
  bl = new Uint8Array(WX * WY * WZ)

  inBounds(x: number, y: number, z: number) {
    return x >= 0 && x < WX && y >= 0 && y < WY && z >= 0 && z < WZ
  }

  get(x: number, y: number, z: number) {
    if (y < 0) return B.STONE
    if (x < 0 || x >= WX || z < 0 || z >= WZ || y >= WY) return B.AIR
    return this.blocks[(y * WZ + z) * WX + x]
  }

  set(x: number, y: number, z: number, b: number) {
    if (x < 0 || x >= WX || y < 0 || y >= WY || z < 0 || z >= WZ) return
    this.blocks[(y * WZ + z) * WX + x] = b
  }

  setIfAir(x: number, y: number, z: number, b: number) {
    if (this.get(x, y, z) === B.AIR) this.set(x, y, z, b)
  }

  solidAt(x: number, y: number, z: number) {
    return isSolid(this.get(x, y, z))
  }
  opaqueAt(x: number, y: number, z: number) {
    return isOpaque(this.get(x, y, z))
  }

  /** topmost non-air y at column (or -1) */
  surfaceY(x: number, z: number) {
    for (let y = WY - 1; y >= 0; y--) {
      const b = this.get(x, y, z)
      if (b !== B.AIR && b !== B.WATER && !isTransparent(b)) return y
    }
    return -1
  }

  /** compute all lighting (call once after worldgen) */
  computeLight() {
    const { blocks, sky, bl } = this
    sky.fill(0)
    bl.fill(0)

    // 1) column skylight
    for (let z = 0; z < WZ; z++) {
      for (let x = 0; x < WX; x++) {
        let level = 15
        for (let y = WY - 1; y >= 0; y--) {
          const i = (y * WZ + z) * WX + x
          const b = blocks[i]
          if (isOpaque(b)) break
          if (b === B.WATER) level = Math.max(0, level - 3)
          if (b === B.LEAVES || b === B.BUSH || b === B.HEDGE) level = Math.max(0, level - 2)
          sky[i] = level
          if (level === 0) break
        }
      }
    }

    // 2) skylight horizontal spread
    const q: number[] = []
    const push = (i: number) => q.push(i)
    for (let i = 0; i < sky.length; i++) {
      if (sky[i] > 1) push(i)
    }
    let head = 0
    while (head < q.length) {
      const i = q[head++]
      const lv = sky[i]
      if (lv <= 1) continue
      const y = Math.floor(i / (WX * WZ))
      const rem = i - y * WX * WZ
      const z = Math.floor(rem / WX)
      const x = rem - z * WX
      // 6 neighbours
      if (x > 0) this.spreadSky(i - 1, lv, sky, blocks, q)
      if (x < WX - 1) this.spreadSky(i + 1, lv, sky, blocks, q)
      if (z > 0) this.spreadSky(i - WX, lv, sky, blocks, q)
      if (z < WZ - 1) this.spreadSky(i + WX, lv, sky, blocks, q)
      if (y > 0) this.spreadSky(i - WX * WZ, lv, sky, blocks, q)
      if (y < WY - 1) this.spreadSky(i + WX * WZ, lv, sky, blocks, q)
    }

    // 3) block light
    const bq: number[] = []
    for (let i = 0; i < blocks.length; i++) {
      const e = emitOf(blocks[i])
      if (e > 0) {
        bl[i] = e
        bq.push(i)
      }
    }
    head = 0
    while (head < bq.length) {
      const i = bq[head++]
      const lv = bl[i]
      if (lv <= 1) continue
      const y = Math.floor(i / (WX * WZ))
      const rem = i - y * WX * WZ
      const z = Math.floor(rem / WX)
      const x = rem - z * WX
      if (x > 0) this.spreadBlock(i - 1, lv, bl, blocks, bq)
      if (x < WX - 1) this.spreadBlock(i + 1, lv, bl, blocks, bq)
      if (z > 0) this.spreadBlock(i - WX, lv, bl, blocks, bq)
      if (z < WZ - 1) this.spreadBlock(i + WX, lv, bl, blocks, bq)
      if (y > 0) this.spreadBlock(i - WX * WZ, lv, bl, blocks, bq)
      if (y < WY - 1) this.spreadBlock(i + WX * WZ, lv, bl, blocks, bq)
    }
  }

  private spreadSky(ni: number, lv: number, sky: Uint8Array, blocks: Uint8Array, q: number[]) {
    const b = blocks[ni]
    if (isOpaque(b)) return
    const dec = b === B.WATER ? 3 : b === B.LEAVES || b === B.BUSH || b === B.HEDGE ? 2 : 1
    const target = lv - dec
    if (target > sky[ni]) {
      sky[ni] = target
      if (target > 1) q.push(ni)
    }
  }

  private spreadBlock(ni: number, lv: number, bl: Uint8Array, blocks: Uint8Array, q: number[]) {
    const b = blocks[ni]
    if (isOpaque(b)) return
    const dec = b === B.WATER ? 3 : 1
    const target = lv - dec
    if (target > bl[ni]) {
      bl[ni] = target
      if (target > 1) q.push(ni)
    }
  }

  /** Quick local relight after a block edit */
  relight(cx: number, cy: number, cz: number, radius = 16) {
    const x0 = Math.max(0, cx - radius)
    const x1 = Math.min(WX - 1, cx + radius)
    const y0 = Math.max(0, cy - radius)
    const y1 = Math.min(WY - 1, cy + radius)
    const z0 = Math.max(0, cz - radius)
    const z1 = Math.min(WZ - 1, cz + radius)
    const { blocks, sky, bl } = this

    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const i = idx(x, y, z)
          sky[i] = 0
          if (!isOpaque(blocks[i])) {
            // vertical skylight from top down
            let lv = 15
            for (let yy = WY - 1; yy >= y; yy--) {
              const ii = idx(x, yy, z)
              const b = blocks[ii]
              if (isOpaque(b)) {
                lv = 0
                break
              }
              if (b === B.WATER) lv = Math.max(0, lv - 3)
              if (b === B.LEAVES || b === B.BUSH) lv = Math.max(0, lv - 2)
              if (lv === 0) break
            }
            sky[i] = lv
          }
        }

    // seeds: region interior sky, boundary lights (outside region) and emitters
    const q: number[] = []
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++)
        for (let x = x0; x <= x1; x++) {
          const i = idx(x, y, z)
          if (sky[i] > 1) q.push(i)
          const e = emitOf(blocks[i])
          if (e > 0) {
            bl[i] = e
            q.push(i)
          }
        }
    // boundary blocklight inject
    const inject = (x: number, y: number, z: number) => {
      if (x < 0 || x >= WX || y < 0 || y >= WY || z < 0 || z >= WZ) return
      const i = idx(x, y, z)
      if (bl[i] > 0) q.push(i)
      if (sky[i] > 0) q.push(i)
    }
    for (let y = y0; y <= y1; y++)
      for (let z = z0; z <= z1; z++) {
        inject(x0 - 1, y, z)
        inject(x1 + 1, y, z)
      }
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        inject(x, y, z0 - 1)
        inject(x, y, z1 + 1)
      }
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        inject(x, y0 - 1, z)
        inject(x, y1 + 1, z)
      }

    let head = 0
    while (head < q.length) {
      const i = q[head++]
      const y = Math.floor(i / (WX * WZ))
      const rem = i - y * WX * WZ
      const z = Math.floor(rem / WX)
      const x = rem - z * WX
      const sv = sky[i]
      const bv = bl[i]
      const nb = [x > 0 ? i - 1 : -1, x < WX - 1 ? i + 1 : -1, z > 0 ? i - WX : -1, z < WZ - 1 ? i + WX : -1, y > 0 ? i - WX * WZ : -1, y < WY - 1 ? i + WX * WZ : -1]
      for (const ni of nb) {
        if (ni < 0) continue
        const b = blocks[ni]
        if (isOpaque(b)) continue
        const dec = b === B.WATER ? 3 : 1
        let pushed = false
        if (sv > 1 && sv - dec > sky[ni]) {
          sky[ni] = sv - dec
          pushed = true
        }
        if (bv > 1 && bv - dec > bl[ni]) {
          bl[ni] = bv - dec
          pushed = true
        }
        if (pushed && (sky[ni] > 1 || bl[ni] > 1)) q.push(ni)
      }
    }
  }
}
