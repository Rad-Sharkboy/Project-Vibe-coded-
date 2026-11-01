import { VoxelWorld, WX, WY } from '../src/engine/world'
import { generateCampus } from '../src/game/worldgen'
const w = new VoxelWorld()
generateCampus(w)
w.computeLight()
const idx = (x: number, y: number, z: number) => (y * WY * 0 + z) === -1 ? 0 : (y * 256 + z) * WX + x
const probe = (label: string, x: number, y: number, z: number) => {
  const i = (y * 256 + z) * WX + x
  console.log(label, `(${x},${y},${z})`, 'sky', w.sky[i], 'bl', w.bl[i], 'block', w.blocks[i])
}
probe('room-center', 47, 19, 114)
probe('room-lamp1', 42, 21, 116)
probe('room-floor', 47, 18, 120)
probe('plaza-out', 128, 18, 128)
probe('lecture-stage', 124, 26, 48)
probe('library', 198, 19, 146)
probe('union-loft', 190, 27, 210)
let sumBl = 0
let sumSky = 0
for (let i = 0; i < w.blocks.length; i++) { if (w.bl[i] > 0) sumBl++; if (w.sky[i] > 0) sumSky++ }
console.log('lit cells: blocklight', sumBl, 'skylight', sumSky, 'of', w.blocks.length)
