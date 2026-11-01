/* Offline voxel ray-caster — renders what the campus actually looks like from a camera position.
   Used for visual QA of level design (the shipped game uses three.js/WebGL).
   npx esbuild scripts/rayrender.ts --bundle --platform=node --outfile=/tmp/rayrender.mjs --format=esm --log-level=error && node /tmp/rayrender.mjs
*/
import { writeFileSync, mkdirSync } from 'node:fs'
import { VoxelWorld, WX, WY, WZ } from '../src/engine/world'
import { generateCampus } from '../src/game/worldgen'
import { B } from '../src/engine/blocks'

const world = new VoxelWorld()
generateCampus(world)
world.computeLight()

const C: Record<number, [number, number, number]> = {
  [B.GRASS]: [111, 172, 82],
  [B.DIRT]: [138, 106, 74],
  [B.STONE]: [154, 154, 154],
  [B.CONCRETE]: [220, 216, 204],
  [B.CONCRETE_DARK]: [143, 141, 136],
  [B.BRICK]: [180, 89, 63],
  [B.BRICK_CREAM]: [224, 205, 174],
  [B.PLANK]: [185, 138, 90],
  [B.WOOD_DARK]: [107, 74, 48],
  [B.LOG]: [122, 85, 53],
  [B.LEAVES]: [79, 143, 60],
  [B.BUSH]: [63, 122, 51],
  [B.GLASS]: [191, 224, 238],
  [B.ASPHALT]: [74, 77, 85],
  [B.PAVER]: [207, 201, 189],
  [B.PAVEMENT]: [216, 212, 200],
  [B.ROOF]: [86, 88, 96],
  [B.LAMP]: [255, 242, 196],
  [B.BOOKS]: [138, 106, 74],
  [B.BED]: [232, 230, 239],
  [B.CHALKBOARD]: [44, 74, 60],
  [B.SCREEN]: [63, 111, 143],
  [B.VENDING]: [176, 58, 58],
  [B.DESK]: [217, 180, 122],
  [B.CHAIR]: [122, 90, 58],
  [B.TABLE]: [201, 160, 106],
  [B.CARPET_RED]: [143, 59, 59],
  [B.CARPET_BLUE]: [51, 80, 127],
  [B.TILE_WHITE]: [232, 232, 232],
  [B.METAL]: [176, 180, 187],
  [B.WATER]: [74, 144, 208],
  [B.SAND]: [224, 208, 166],
  [B.FLOWER]: [232, 105, 154],
  [B.FLOWER_YELLOW]: [232, 212, 90],
  [B.HEDGE]: [53, 104, 47],
  [B.NEON_PINK]: [255, 96, 190],
  [B.NEON_CYAN]: [96, 230, 255],
  [B.NEON_GREEN]: [120, 255, 160],
  [B.NEON_AMBER]: [255, 190, 90],
  [B.WHITEBOARD]: [238, 244, 248],
  [B.GYM_FLOOR]: [216, 164, 99],
  [B.GYM_MAT]: [53, 80, 122],
  [B.NOTICE_BOARD]: [176, 138, 88],
  [B.ARCADE]: [42, 47, 69],
  [B.CHECKER_A]: [230, 226, 216],
  [B.CHECKER_B]: [74, 79, 90],
  [B.WOOD_FLOOR]: [185, 138, 90],
  [B.SIGN_WOOD]: [122, 85, 53],
  [B.ACOUSTIC]: [106, 90, 82],
  [B.COFFEE_MACHINE]: [58, 63, 74],
  [B.GRASS_DARK]: [90, 148, 64],
  [B.GRAVEL]: [160, 154, 142],
  [B.DIRT_PATH]: [176, 154, 114],
  [B.POSTER]: [208, 192, 224],
  [B.CLOTH_RED]: [160, 58, 74],
  [B.COUNTER]: [232, 228, 220],
  [B.WINDOW_FRAME]: [107, 111, 120],
  [B.TOWEL]: [216, 224, 232],
  [B.GRASS_DRY]: [138, 154, 82],
  [B.STONE_DARK]: [106, 106, 106],
  [B.STONE_BRICK]: [168, 164, 154],
}

const topCol = (id: number): [number, number, number] => {
  if (id === B.GRASS) return C[B.GRASS]
  if (id === B.GRASS_DARK) return C[B.GRASS_DARK]
  if (id === B.LOG) return [194, 160, 106]
  if (id === B.BOOKS) return [185, 138, 90]
  return C[id] ?? [200, 200, 200]
}
const sideCol = (id: number): [number, number, number] => {
  if (id === B.GRASS) return [122, 106, 74]
  if (id === B.GRASS_DARK) return [104, 92, 66]
  if (id === B.BOOKS) return [150, 70, 70]
  return C[id] ?? [200, 200, 200]
}

const solidAt = (x: number, y: number, z: number) => {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return false
  const id = world.blocks[(y * WZ + z) * WX + x]
  return id !== 0 && id !== B.GLASS && id !== B.WATER
}
const idAt = (x: number, y: number, z: number) => {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return 0
  return world.blocks[(y * WZ + z) * WX + x]
}
const lightAt = (x: number, y: number, z: number) => {
  if (x < 0 || y < 0 || z < 0 || x >= WX || y >= WY || z >= WZ) return [15, 0]
  const i = (y * WZ + z) * WX + x
  return [world.sky[i], world.bl[i]]
}

const SUN: [number, number, number] = (() => {
  const v: [number, number, number] = [0.42, 0.78, 0.34]
  const l = Math.hypot(v[0], v[1], v[2])
  return [v[0] / l, v[1] / l, v[2] / l]
})()

type Cam = { pos: [number, number, number]; yaw: number; pitch: number }

function render(file: string, cam: Cam, W = 480, H = 270, fov = 74, hour = 11) {
  const aspect = W / H
  const ty = Math.tan((fov * Math.PI) / 360)
  const dirF: [number, number, number] = [Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), -Math.cos(cam.yaw) * Math.cos(cam.pitch)]
  const right: [number, number, number] = [Math.cos(cam.yaw), 0, Math.sin(cam.yaw)]
  const up: [number, number, number] = [
    right[1] * dirF[2] - right[2] * dirF[1],
    right[2] * dirF[0] - right[0] * dirF[2],
    right[0] * dirF[1] - right[1] * dirF[0],
  ]
  // day factor
  const night = hour < 6 || hour > 20 ? 1 : hour < 7.5 ? (7.5 - hour) / 1.5 : hour > 18.5 ? (hour - 18.5) / 1.5 : 0
  const day = 1 - night
  const skyTop: [number, number, number] = [70 + 30 * day, 130 + 62 * day, 220 + 22 * day]
  const skyHor: [number, number, number] = [150 + 90 * day, 186 + 60 * day, 226 + 22 * day]
  const canopy = new Uint8Array(W * H * 3)
  const dists = new Float32Array(W * H)

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const sx = (px + 0.5) / W * 2 - 1
      const sy = 1 - (py + 0.5) / H * 2
      let dx = dirF[0] + right[0] * sx * ty * aspect + up[0] * sy * ty
      let dy = dirF[1] + right[1] * sx * ty * aspect + up[1] * sy * ty
      let dz = dirF[2] + right[2] * sx * ty * aspect + up[2] * sy * ty
      const dl = Math.hypot(dx, dy, dz)
      dx /= dl
      dy /= dl
      dz /= dl

      // sky background
      let uy = dy
      const horizonMix = Math.min(1, Math.max(0, (uy + 0.06) / 0.42))
      let r = skyHor[0] + (skyTop[0] - skyHor[0]) * horizonMix
      let g = skyHor[1] + (skyTop[1] - skyHor[1]) * horizonMix
      let b = skyHor[2] + (skyTop[2] - skyHor[2]) * horizonMix
      if (night > 0.2 && uy > 0.02) {
        // stars
        const h = ((px * 733 + py * 977) % 1000) / 1000
        if (h > 0.988) {
          const s = 200 * night
          r += s
          g += s
          b += s
        }
      }

      // DDA
      let t = 0
      let ix = Math.floor(cam.pos[0])
      let iy = Math.floor(cam.pos[1])
      let iz = Math.floor(cam.pos[2])
      const stepX = dx > 0 ? 1 : -1
      const stepY = dy > 0 ? 1 : -1
      const stepZ = dz > 0 ? 1 : -1
      const tDeltaX = Math.abs(1 / (dx || 1e-9))
      const tDeltaY = Math.abs(1 / (dy || 1e-9))
      const tDeltaZ = Math.abs(1 / (dz || 1e-9))
      let tMaxX = ((dx > 0 ? ix + 1 - cam.pos[0] : cam.pos[0] - ix) || 1e-6) * tDeltaX
      let tMaxY = ((dy > 0 ? iy + 1 - cam.pos[1] : cam.pos[1] - iy) || 1e-6) * tDeltaY
      let tMaxZ = ((dz > 0 ? iz + 1 - cam.pos[2] : cam.pos[2] - iz) || 1e-6) * tDeltaZ
      let n: [number, number, number] = [0, 1, 0]
      let hit = 0
      let transCol: [number, number, number] | null = null
      let transTint = 0
      for (let i = 0; i < 520; i++) {
        const block = idAt(ix, iy, iz)
        if (block === B.GLASS || block === B.WATER) {
          if (!transCol) {
            transCol = block === B.WATER ? C[B.WATER] : C[B.GLASS]
            transTint = block === B.WATER ? 0.72 : 0.3
          }
        } else if (solidAt(ix, iy, iz)) {
          hit = block
          break
        }
        if (tMaxX < tMaxY && tMaxX < tMaxZ) {
          ix += stepX
          t = tMaxX
          tMaxX += tDeltaX
          n = [-stepX, 0, 0]
        } else if (tMaxY < tMaxZ) {
          iy += stepY
          t = tMaxY
          tMaxY += tDeltaY
          n = [0, -stepY, 0]
        } else {
          iz += stepZ
          t = tMaxZ
          tMaxZ += tDeltaZ
          n = [0, 0, -stepZ]
        }
        if (t > 240) break
      }
      dists[py * W + px] = t

      if (hit) {
        const base = n[1] > 0 ? topCol(hit) : n[1] < 0 ? sideCol(hit) : sideCol(hit)
        // face shading
        const faceShade = n[1] > 0 ? 1.0 : n[1] < 0 ? 0.55 : 0.82
        const ndl = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2])
        // light of the air cell the ray came from
        const [sl, bl] = lightAt(ix - n[0], iy - n[1], iz - n[2])
        const skyL = sl / 15
        const blkL = bl / 15
        const ambient = 0.3 + 0.7 * Math.pow(skyL, 0.8)
        const sun = ndl * 0.42 * Math.pow(skyL, 1.6) * (0.35 + 0.65 * day)
        const lum = Math.max(ambient + sun, 0.22 + 0.78 * blkL) * faceShade
        // pixel noise
        const noise = 0.94 + 0.12 * (((ix * 31 + iy * 17 + iz * 13) % 7) / 7)
        const glowR = blkL * 26
        r = base[0] * lum * noise + glowR * 1.1 + (1 - day) * 6 * skyL
        g = base[1] * lum * noise + glowR * 0.8 + (1 - day) * 8 * skyL
        b = base[2] * lum * noise + glowR * 0.45 + (1 - day) * 16 * skyL
        if (hit === B.LAMP || hit === B.NEON_CYAN || hit === B.NEON_PINK || hit === B.NEON_GREEN || hit === B.NEON_AMBER || hit === B.SCREEN) {
          r = Math.min(255, r * 1.4 + 30)
          g = Math.min(255, g * 1.35 + 24)
          b = Math.min(255, b * 1.3 + 18)
        }
        // fog
        const fog = Math.min(1, Math.pow(Math.max(0, t - 24) / 150, 1.35))
        r = r + (skyHor[0] * 0.94 - r) * fog
        g = g + (skyHor[1] * 0.94 - g) * fog
        b = b + (skyHor[2] * 0.94 - b) * fog
      }
      if (transCol) {
        const a = transTint
        const tr = transCol[0] * (0.55 + 0.45 * day)
        const tg = transCol[1] * (0.55 + 0.45 * day)
        const tb = transCol[2] * (0.55 + 0.45 * day)
        r = r * (1 - a) + tr * a
        g = g * (1 - a) + tg * a
        b = b * (1 - a) + tb * a
      }
      const o = (py * W + px) * 3
      canopy[o] = Math.max(0, Math.min(255, r))
      canopy[o + 1] = Math.max(0, Math.min(255, g))
      canopy[o + 2] = Math.max(0, Math.min(255, b))
    }
  }
  const header = Buffer.from(`P6\n${W} ${H}\n255\n`, 'ascii')
  writeFileSync(file, Buffer.concat([header, Buffer.from(canopy)]))
  console.log('wrote', file)
}

const out = '/tmp/shots'
mkdirSync(out, { recursive: true })

// 0 = looking toward -Z ("north")
render(`${out}/01-spawn.ppm`, { pos: [47.5, 19.6, 120.5], yaw: 0.18, pitch: -0.02 })
render(`${out}/02-plaza.ppm`, { pos: [128.5, 18.6, 152], yaw: 0, pitch: 0.0 })
render(`${out}/03-aerial.ppm`, { pos: [128, 104, 236], yaw: 0, pitch: -0.5 }, 560, 315, 86)
render(`${out}/04-lecture.ppm`, { pos: [128.5, 26.6, 76], yaw: 0, pitch: -0.06 })
render(`${out}/05-library.ppm`, { pos: [198.5, 19.6, 148], yaw: 0, pitch: 0.06 })
render(`${out}/06-union.ppm`, { pos: [192.5, 19.6, 194], yaw: Math.PI * 0.94, pitch: 0.12 })
render(`${out}/07-cafe.ppm`, { pos: [116.5, 19.6, 208], yaw: 0, pitch: 0.0 })
render(`${out}/08-gym.ppm`, { pos: [59.5, 19.6, 210], yaw: 0, pitch: 0.02 })
render(`${out}/09-pond.ppm`, { pos: [188.5, 20.6, 78], yaw: 0, pitch: -0.06 }, 480, 270, 74, 18.7)
render(`${out}/10-dorm-ext.ppm`, { pos: [57.5, 21.6, 168], yaw: 0, pitch: 0.08 })
render(`${out}/11-field.ppm`, { pos: [60.5, 20.6, 100], yaw: 0, pitch: 0.0 })
render(`${out}/12-union-loft.ppm`, { pos: [205.5, 26.6, 204], yaw: Math.PI * 1.15, pitch: -0.05 })
