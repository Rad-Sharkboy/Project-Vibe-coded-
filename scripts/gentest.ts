/* Headless sanity check: generate the campus, mesh it, and verify connectivity.
   Run with: npx esbuild scripts/gentest.ts --bundle --platform=node --outfile=/tmp/gentest.mjs --format=esm && node /tmp/gentest.mjs
*/
import { VoxelWorld, WX, WY, WZ, CHUNK, CHUNKS_X, CHUNKS_Z } from '../src/engine/world'
import { generateCampus } from '../src/game/worldgen'
import { buildChunkMesh } from '../src/engine/mesher'
import { B, isSolid } from '../src/engine/blocks'

const t0 = Date.now()
const world = new VoxelWorld()
const gen = generateCampus(world)
const tGen = Date.now() - t0
console.log(`worldgen: ${tGen}ms`)

const t1 = Date.now()
world.computeLight()
console.log(`lighting: ${Date.now() - t1}ms`)

const t2 = Date.now()
let tris = 0
let verts = 0
let chunksWithMesh = 0
for (let cz = 0; cz < CHUNKS_Z; cz++) {
  for (let cx = 0; cx < CHUNKS_X; cx++) {
    const { opaque, trans } = buildChunkMesh(world, cx * CHUNK, cz * CHUNK)
    if (opaque) {
      tris += opaque.index.length / 3
      verts += opaque.position.length / 3
      chunksWithMesh++
    }
    if (trans) {
      tris += trans.index.length / 3
      verts += trans.position.length / 3
    }
  }
}
console.log(`meshing: ${Date.now() - t2}ms · ${chunksWithMesh} chunks · ${(tris / 1000).toFixed(1)}k tris · ${(verts / 1000).toFixed(1)}k verts`)

// ---------------- walkable connectivity ----------------
const walkable = (x: number, y: number, z: number) => {
  if (x < 1 || z < 1 || x >= WX - 1 || z >= WZ - 1 || y < 1 || y >= WY - 1) return false
  const feet = world.get(x, y, z)
  const head = world.get(x, y + 1, z)
  const below = world.get(x, y - 1, z)
  if (isSolid(feet) || isSolid(head)) return false
  return isSolid(below) || below === B.WATER
}
const key = (x: number, y: number, z: number) => (y * WZ + z) * WX + x
const seen = new Uint8Array(WX * WY * WZ)
const start = { x: Math.floor(gen.playerSpawn.x), y: Math.floor(gen.playerSpawn.y), z: Math.floor(gen.playerSpawn.z) }
console.log('spawn', start, 'blockAtFeet', world.get(start.x, start.y, start.z), 'below', world.get(start.x, start.y - 1, start.z))
if (!walkable(start.x, start.y, start.z)) console.log('!! spawn is not walkable')

const queue: number[] = []
const push = (x: number, y: number, z: number) => {
  const i = key(x, y, z)
  if (seen[i]) return
  if (!walkable(x, y, z)) return
  seen[i] = 1
  queue.push(i)
}
push(start.x, start.y, start.z)
let head = 0
let count = 0
while (head < queue.length) {
  const i = queue[head++]
  count++
  const y = Math.floor(i / (WX * WZ))
  const rem = i - y * WX * WZ
  const z = Math.floor(rem / WX)
  const x = rem - z * WX
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    for (const dy of [0, 1, -1, -2]) {
      if (walkable(x + dx, y + dy, z + dz)) {
        push(x + dx, y + dy, z + dz)
        break
      }
    }
  }
}
console.log(`reachable standing spots: ${count}`)

const reachableNear = (x: number, y: number, z: number, r = 3) => {
  for (let dy = -3; dy <= 3; dy++)
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        if (seen[key(Math.round(x) + dx, Math.round(y) + dy, Math.round(z) + dz)]) return true
      }
  return false
}
console.log('\nPOI reachability:')
for (const poi of gen.pois) {
  const ok = reachableNear(poi.x, poi.y, poi.z, 4)
  console.log(` ${ok ? 'ok  ' : 'MISS'} ${poi.id.padEnd(16)} ${poi.label} @ ${poi.x},${poi.y},${poi.z}`)
}
console.log('\nNPC reachability:')
for (const npc of gen.npcs) {
  const ok = reachableNear(npc.x, npc.y, npc.z, 4)
  console.log(` ${ok ? 'ok  ' : 'MISS'} ${npc.name.padEnd(14)} @ ${npc.x},${npc.y},${npc.z}`)
}
// outdoor check
console.log('\nplaza reachable:', !!seen[key(128, 17, 150)], '· lecture stage:', !!seen[key(128, 26, 48)])
console.log('upper dorm floor reachable:', !!seen[key(50, 23, 114)], '· third floor:', !!seen[key(50, 28, 114)])
console.log('probe lib stair base', !!seen[key(183, 18, 147)], 'top', !!seen[key(183, 25, 134)], 'ring', !!seen[key(181, 25, 140)])
console.log('probe union stair base', !!seen[key(204, 18, 206)], 'top', !!seen[key(191, 25, 206)], 'loft', !!seen[key(190, 25, 204)])
console.log('library mezzanine reachable:', !!seen[key(181, 25, 130)])
console.log('union loft reachable:', !!seen[key(190, 25, 204)])
