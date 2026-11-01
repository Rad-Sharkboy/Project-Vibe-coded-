/* Headless movement/physics probe: proves WASD actually follows the camera basis.
   npx esbuild scripts/playtest.ts --bundle --platform=node --outfile=/tmp/playtest.mjs --format=esm --log-level=error && node /tmp/playtest.mjs
*/
import { VoxelWorld, WX, WY, WZ } from '../src/engine/world'
import { generateCampus } from '../src/game/worldgen'
import * as THREE from 'three'
import { Player, InputState } from '../src/engine/player'

const world = new VoxelWorld()
const gen = generateCampus(world)

const idle: InputState = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false }
const press = (over: Partial<InputState>): InputState => ({ ...idle, ...over })

function simulate(p: Player, input: InputState, seconds: number) {
  const dt = 1 / 60
  for (let i = 0; i < Math.round(seconds / dt); i++) p.update(dt, input, world)
}

// Take the basis straight from the real camera, so we test what the player actually sees.
function basis(yaw: number, pitch = 0) {
  const cam = new THREE.PerspectiveCamera()
  const probe = new Player()
  probe.spawn(0, 0, 0, yaw)
  probe.pitch = pitch
  probe.applyToCamera(cam)
  cam.updateMatrixWorld(true)
  const fwd = new THREE.Vector3()
  cam.getWorldDirection(fwd)
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0).normalize()
  return {
    fwd: { x: fwd.x, z: fwd.z, y: fwd.y },
    right: { x: right.x, z: right.z },
  }
}

const START = { x: 60.5, y: 18.2, z: 60.5 } // open field
let fails = 0

for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 0.9, -2.2]) {
  // ---- forward ----
  const p = new Player()
  p.spawn(START.x, START.y, START.z, yaw)
  simulate(p, idle, 0.3) // settle on the ground
  const from = p.pos.clone()
  simulate(p, press({ forward: true }), 1.0)
  const d = { x: p.pos.x - from.x, z: p.pos.z - from.z }
  const b = basis(yaw)
  const bPitch = basis(yaw, 0.4)
  const len = Math.hypot(d.x, d.z) || 1e-9
  const fwdDot = (d.x * b.fwd.x + d.z * b.fwd.z) / len
  const rightDot = (d.x * b.right.x + d.z * b.right.z) / len
  const ok = fwdDot > 0.95 && len > 2
  if (!ok) fails++
  const flatFwd = Math.hypot(b.fwd.x, b.fwd.z) || 1e-9
  const fwdFlatDot = (d.x * b.fwd.x + d.z * b.fwd.z) / (len * flatFwd)
  console.log(
    `yaw ${(yaw * 180 / Math.PI).toFixed(0).padStart(4)}°  W → ${len.toFixed(2)}m  alongCameraForward ${fwdFlatDot.toFixed(3)}  side ${rightDot.toFixed(3)}  ${ok ? 'ok' : 'FAIL'}`,
  )
  void bPitch

  // ---- strafe right ----
  const p2 = new Player()
  p2.spawn(START.x, START.y, START.z, yaw)
  simulate(p2, idle, 0.3)
  const from2 = p2.pos.clone()
  simulate(p2, press({ right: true }), 1.0)
  const d2 = { x: p2.pos.x - from2.x, z: p2.pos.z - from2.z }
  const len2 = Math.hypot(d2.x, d2.z) || 1e-9
  const rightDot2 = (d2.x * b.right.x + d2.z * b.right.z) / len2
  const ok2 = rightDot2 > 0.95 && len2 > 2
  if (!ok2) fails++
  console.log(`          D → travelled ${len2.toFixed(2)}m  alongRight ${rightDot2.toFixed(3)}  ${ok2 ? 'ok' : 'FAIL'}`)
}

// ---- jump apex + landing ----
{
  const p = new Player()
  p.spawn(START.x, START.y, START.z, 0)
  simulate(p, idle, 0.4)
  const groundY = p.pos.y
  let apex = -Infinity
  const dt = 1 / 60
  for (let i = 0; i < 90; i++) {
    p.update(dt, press({ jump: i < 3 }), world)
    apex = Math.max(apex, p.pos.y)
  }
  const landed = Math.abs(p.pos.y - groundY) < 0.01
  const height = apex - groundY
  const ok = height > 0.9 && height < 2.2 && landed
  if (!ok) fails++
  console.log(`jump: apex ${height.toFixed(2)} blocks, landed back at ground ${landed} ${ok ? 'ok' : 'FAIL'}`)
}

// ---- walking into a wall stops you ----
{
  // face the dorm south wall (z = 152) from the courtyard side
  const p = new Player()
  p.spawn(57.5, 18.2, 158.5, Math.PI) // yaw PI faces +Z, wall is at z=152 => turn around
  p.yaw = 0 // face -Z toward the building
  simulate(p, idle, 0.3)
  const z0 = p.pos.z
  simulate(p, press({ forward: true }), 2.0)
  const moved = Math.abs(p.pos.z - z0)
  const blocked = moved < 7
  if (!blocked) fails++
  console.log(`wall: moved ${moved.toFixed(2)}m into the dorm wall (should stop) ${blocked ? 'ok' : 'FAIL'}`)
}

// ---- stairs / step-up assist ----
{
  const p = new Player()
  // inside the dorm corridor, walk toward the stair hall
  p.spawn(57.5, 18.2, 140.5, 0)
  simulate(p, idle, 0.3)
  const y0 = p.pos.y
  simulate(p, press({ forward: true }), 3.0)
  const climbed = p.pos.y - y0
  console.log(`stairs: height gained walking north up the corridor ${climbed.toFixed(2)}`)
}

// ---- does the player spawn cleanly (not inside a block)? ----
{
  const p = new Player()
  p.spawn(gen.playerSpawn.x, gen.playerSpawn.y, gen.playerSpawn.z, gen.playerSpawn.yaw)
  let stuck = false
  for (let i = 0; i < 120; i++) {
    p.update(1 / 60, idle, world)
  }
  const eye = p.pos.y + p.eyeHeight
  const inside = world.solidAt(Math.floor(p.pos.x), Math.floor(eye), Math.floor(p.pos.z))
  stuck = p.pos.y < 5 || inside
  if (stuck) fails++
  console.log(`spawn: settled at y=${p.pos.y.toFixed(2)} eyeClear=${!inside} ${stuck ? 'FAIL' : 'ok'}`)
}

console.log(fails === 0 ? '\nall movement probes passed' : `\n${fails} movement probe(s) FAILED`)
process.exit(fails === 0 ? 0 : 1)
