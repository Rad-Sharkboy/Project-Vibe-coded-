import { BLOCKS, emitOf, isOpaque, isTransparent } from './blocks'
import { CHUNK, VoxelWorld, WX, WY, WZ, idx } from './world'

export type MeshData = {
  position: Float32Array
  normal: Int8Array
  uv: Float32Array
  light: Uint8Array
  glow: Uint8Array
  emit: Uint8Array
  tile: Uint8Array
  index: Uint32Array
}

class Builder {
  pos: number[] = []
  nrm: number[] = []
  uv: number[] = []
  light: number[] = []
  glow: number[] = []
  emit: number[] = []
  tile: number[] = []
  idx: number[] = []
  count = 0

  vertex(
    px: number,
    py: number,
    pz: number,
    nx: number,
    ny: number,
    nz: number,
    u: number,
    v: number,
    sky: number,
    blk: number,
    ao: number,
    emit: number,
    tile: number,
  ) {
    this.pos.push(px, py, pz)
    this.nrm.push(nx, ny, nz)
    this.uv.push(u, v)
    const aoF = AO_FACTOR[ao]
    // skylight: cool, blocklight: warm
    const s = (sky / 15) * aoF
    this.light.push(Math.min(255, s * 244) | 0, Math.min(255, s * 252) | 0, Math.min(255, s * 255) | 0)
    const g = (blk / 15) * (0.65 + 0.35 * aoF)
    this.glow.push(Math.min(255, g * 255) | 0, Math.min(255, g * 186) | 0, Math.min(255, g * 122) | 0)
    this.emit.push(Math.min(255, emit * 17) | 0)
    this.tile.push(tile)
    return this.count++
  }

  build(): MeshData | null {
    if (this.idx.length === 0) return null
    return {
      position: new Float32Array(this.pos),
      normal: new Int8Array(this.nrm),
      uv: new Float32Array(this.uv),
      light: new Uint8Array(this.light),
      glow: new Uint8Array(this.glow),
      emit: new Uint8Array(this.emit),
      tile: new Uint8Array(this.tile),
      index: new Uint32Array(this.idx),
    }
  }
}

const AO_FACTOR = [0.42, 0.62, 0.82, 1.0]

const MAX_FACE = 4096
const maskBlock = new Int32Array(MAX_FACE)
const maskSign = new Int8Array(MAX_FACE)
const maskTile = new Int32Array(MAX_FACE)
const maskEmit = new Uint8Array(MAX_FACE)
const maskSky = new Uint8Array(MAX_FACE * 4)
const maskBlk = new Uint8Array(MAX_FACE * 4)
const maskAO = new Uint8Array(MAX_FACE * 4)

function faceVisible(selfId: number, neighborId: number) {
  if (selfId === 0) return false
  if (isOpaque(neighborId)) return false
  if (selfId === neighborId && isTransparent(selfId)) return false
  return true
}

export function buildChunkMesh(world: VoxelWorld, ox: number, oz: number): { opaque: MeshData | null; trans: MeshData | null } {
  const opaque = new Builder()
  const trans = new Builder()
  const dims = [CHUNK, WY, CHUNK]
  const blocks = world.blocks
  const skyArr = world.sky
  const blArr = world.bl

  // local -> world block id
  const gx = (x: number) => ox + x
  const gz = (z: number) => oz + z

  const getB = (x: number, y: number, z: number) => {
    if (y < 0) return 1
    if (y >= WY) return 0
    if (x < 0 || z < 0 || x >= CHUNK || z >= CHUNK) {
      const wx = ox + x
      const wz = oz + z
      if (wx < 0 || wz < 0 || wx >= WX || wz >= WZ) return 1
      return blocks[(y * WZ + wz) * WX + wx]
    }
    return blocks[(y * WZ + gz(z)) * WX + gx(x)]
  }
  const getSky = (x: number, y: number, z: number) => {
    if (y >= WY) return 15
    if (y < 0) return 0
    const wx = ox + x
    const wz = oz + z
    if (wx < 0 || wz < 0 || wx >= WX || wz >= WZ) return 15
    return skyArr[(y * WZ + wz) * WX + wx]
  }
  const getBl = (x: number, y: number, z: number) => {
    if (y >= WY || y < 0) return 0
    const wx = ox + x
    const wz = oz + z
    if (wx < 0 || wz < 0 || wx >= WX || wz >= WZ) return 0
    return blArr[(y * WZ + wz) * WX + wx]
  }

  const p = [0, 0, 0]
  const qn = [0, 0, 0]
  const du = [0, 0, 0]
  const dv = [0, 0, 0]

  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3
    const v = (d + 2) % 3
    const ddu = dims[u]
    const ddv = dims[v]
    const ddd = dims[d]
    const n = ddu * ddv
    if (n > MAX_FACE) throw new Error('mask too small')
    du[0] = du[1] = du[2] = 0
    dv[0] = dv[1] = dv[2] = 0
    du[u] = 1
    dv[v] = 1

    for (let xd = -1; xd < ddd; xd++) {
      let n2 = 0
      for (let iv = 0; iv < ddv; iv++) {
        for (let iu = 0; iu < ddu; iu++) {
          p[0] = p[1] = p[2] = 0
          p[d] = xd
          p[u] = iu
          p[v] = iv
          qn[0] = p[0]
          qn[1] = p[1]
          qn[2] = p[2]
          qn[d] = xd + 1
          const aId = getB(p[0], p[1], p[2])
          const bId = getB(qn[0], qn[1], qn[2])

          const faceA = faceVisible(aId, bId) // a's +d face
          const faceB = faceVisible(bId, aId) // b's -d face
          if (!faceA && !faceB) {
            maskBlock[n2] = 0
            n2++
            continue
          }

          let cell = n2
          if (faceA) {
            maskBlock[cell] = aId
            maskSign[cell] = 1
            const bd = BLOCKS[aId]
            maskTile[cell] = d === 0 ? bd.side : d === 2 ? bd.side : bd.top
            maskEmit[cell] = emitOf(aId)
            // light comes from the air cell in front of the face (b)
            fillCorners(cell, qn, du, dv)
          } else {
            maskBlock[cell] = bId
            maskSign[cell] = -1
            const bd = BLOCKS[bId]
            maskTile[cell] = d === 0 ? bd.side : d === 2 ? bd.side : bd.bottom
            maskEmit[cell] = emitOf(bId)
            fillCorners(cell, p, du, dv)
          }
          n2++
        }
      }

      // greedy merge
      for (let iv = 0; iv < ddv; iv++) {
        for (let iu = 0; iu < ddu; iu++) {
          const k = iv * ddu + iu
          const id = maskBlock[k]
          if (id === 0) continue
          let w = 1
          while (iu + w < ddu && matches(k, k + w)) w++
          let h = 1
          outer: while (iv + h < ddv) {
            for (let t = 0; t < w; t++) {
              if (!matches(k, k + h * ddu + t)) break outer
            }
            h++
          }

          // clear merged cells
          for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) maskBlock[(iv + yy) * ddu + iu + xx] = 0
          }

          const sign = maskSign[k]
          const tile = maskTile[k]
          const emit = maskEmit[k]
          const target = isTransparent(id) ? trans : opaque
          const start: [number, number, number] = [0, 0, 0]
          start[d] = xd + 1
          start[u] = iu
          start[v] = iv
          const plane = xd + 1
          // 4 corner offsets in (u,v)
          const oxs = [0, w, w, 0]
          const ovs = [0, 0, h, h]
          const ai = target.count
          for (let c = 0; c < 4; c++) {
            const px = start[0] + du[0] * oxs[c] + dv[0] * ovs[c]
            const py = start[1] + du[1] * oxs[c] + dv[1] * ovs[c]
            const pz = start[2] + du[2] * oxs[c] + dv[2] * ovs[c]
            // uv
            let uu = 0
            let vv = 0
            if (d === 1) {
              uu = px
              vv = pz
            } else if (d === 0) {
              uu = pz
              vv = py
            } else {
              uu = px
              vv = py
            }
            let nx = 0
            let ny = 0
            let nz = 0
            if (d === 0) nx = sign
            else if (d === 1) ny = sign
            else nz = sign
            target.vertex(
              px,
              py,
              pz,
              nx,
              ny,
              nz,
              uu,
              vv,
              maskSky[k * 4 + c],
              maskBlk[k * 4 + c],
              maskAO[k * 4 + c],
              emit,
              tile,
            )
          }
          void plane
          if (sign > 0) {
            target.idx.push(ai, ai + 1, ai + 2, ai, ai + 2, ai + 3)
          } else {
            target.idx.push(ai, ai + 3, ai + 2, ai, ai + 2, ai + 1)
          }

          iu += w - 1
        }
      }
    }
  }

  return { opaque: opaque.build(), trans: trans.build() }

  function matches(k1: number, k2: number) {
    if (maskBlock[k2] !== maskBlock[k1]) return false
    if (maskSign[k2] !== maskSign[k1]) return false
    if (maskTile[k2] !== maskTile[k1]) return false
    for (let c = 0; c < 4; c++) {
      if (maskSky[k1 * 4 + c] !== maskSky[k2 * 4 + c]) return false
      if (maskBlk[k1 * 4 + c] !== maskBlk[k2 * 4 + c]) return false
      if (maskAO[k1 * 4 + c] !== maskAO[k2 * 4 + c]) return false
    }
    return true
  }

  function fillCorners(cell: number, front: number[], duv: number[], dvv: number[]) {
    const base = cell * 4
    const sgnU = [1, -1, 1, -1]
    const sgnV = [1, 1, -1, -1]
    const s = getSky(front[0], front[1], front[2])
    const b = getBl(front[0], front[1], front[2])
    for (let c = 0; c < 4; c++) {
      const su = sgnU[c]
      const sv = sgnV[c]
      const s1x = front[0] + duv[0] * su
      const s1y = front[1] + duv[1] * su
      const s1z = front[2] + duv[2] * su
      const s2x = front[0] + dvv[0] * sv
      const s2y = front[1] + dvv[1] * sv
      const s2z = front[2] + dvv[2] * sv
      const cx = s1x + dvv[0] * sv
      const cy = s1y + dvv[1] * sv
      const cz = s1z + dvv[2] * sv
      const o1 = isOpaque(getB(s1x, s1y, s1z)) ? 1 : 0
      const o2 = isOpaque(getB(s2x, s2y, s2z)) ? 1 : 0
      const oc = isOpaque(getB(cx, cy, cz)) ? 1 : 0
      const ao = o1 && o2 ? 0 : 3 - (o1 + o2 + oc)
      maskAO[base + c] = ao
      maskSky[base + c] = s
      maskBlk[base + c] = b
    }
  }
}

export const chunkWorldIndex = idx
