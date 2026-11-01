import * as THREE from 'three'
import { B, blockDef } from './blocks'
import { clamp01, damp } from './noise'
import { VoxelWorld, WX, WY, WZ } from './world'

export type InputState = {
  forward: boolean
  back: boolean
  left: boolean
  right: boolean
  jump: boolean
  sprint: boolean
  crouch: boolean
}

export type RayHit = { x: number; y: number; z: number; nx: number; ny: number; nz: number; dist: number }

/** Amanatides & Woo voxel DDA */
export function raycastVoxel(world: VoxelWorld, origin: THREE.Vector3, dir: THREE.Vector3, maxDist = 6): RayHit | null {
  let x = Math.floor(origin.x)
  let y = Math.floor(origin.y)
  let z = Math.floor(origin.z)
  const stepX = dir.x > 0 ? 1 : -1
  const stepY = dir.y > 0 ? 1 : -1
  const stepZ = dir.z > 0 ? 1 : -1
  const tDeltaX = Math.abs(1 / (dir.x || 1e-9))
  const tDeltaY = Math.abs(1 / (dir.y || 1e-9))
  const tDeltaZ = Math.abs(1 / (dir.z || 1e-9))
  let tMaxX = ((dir.x > 0 ? x + 1 - origin.x : origin.x - x) || 1e-9) * tDeltaX
  let tMaxY = ((dir.y > 0 ? y + 1 - origin.y : origin.y - y) || 1e-9) * tDeltaY
  let tMaxZ = ((dir.z > 0 ? z + 1 - origin.z : origin.z - z) || 1e-9) * tDeltaZ
  let nx = 0
  let ny = 0
  let nz = 0
  let t = 0
  for (let i = 0; i < 256; i++) {
    const b = world.get(x, y, z)
    if (b !== B.AIR && b !== B.WATER) {
      return { x, y, z, nx, ny, nz, dist: t }
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX
      t = tMaxX
      tMaxX += tDeltaX
      nx = -stepX
      ny = 0
      nz = 0
    } else if (tMaxY < tMaxZ) {
      y += stepY
      t = tMaxY
      tMaxY += tDeltaY
      nx = 0
      ny = -stepY
      nz = 0
    } else {
      z += stepZ
      t = tMaxZ
      tMaxZ += tDeltaZ
      nx = 0
      ny = 0
      nz = -stepZ
    }
    if (t > maxDist) break
    if (y < 0 || y >= WY) break
  }
  return null
}

export class Player {
  pos = new THREE.Vector3()
  vel = new THREE.Vector3()
  yaw = 0
  pitch = 0
  onGround = false
  inWater = false
  crouching = false
  sprinting = false
  canDoubleJump = false
  jumpsLeft = 2
  eyeHeight = 1.62
  height = 1.78
  radius = 0.3
  bobPhase = 0
  bobAmount = 0
  camFov = 72
  camRoll = 0
  stepSmooth = 0
  private stepSoundCooldown = 0
  onFootstep?: (material: string) => void
  onJump?: () => void
  onLand?: () => void
  private wasOnGround = true

  spawn(x: number, y: number, z: number, yaw = 0) {
    this.pos.set(x, y, z)
    this.vel.set(0, 0, 0)
    this.yaw = yaw
    this.pitch = 0
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight - this.stepSmooth, this.pos.z)
  }

  look(dx: number, dy: number, sens = 1) {
    this.yaw -= dx * 0.0022 * sens
    this.pitch -= dy * 0.0022 * sens
    const lim = Math.PI / 2 - 0.02
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch))
  }

  private collidesAt(x: number, y: number, z: number, world: VoxelWorld) {
    const r = this.radius
    const h = this.crouching ? this.height * 0.7 : this.height
    const x0 = Math.floor(x - r)
    const x1 = Math.floor(x + r)
    const y0 = Math.floor(y + 0.001)
    const y1 = Math.floor(y + h - 0.001)
    const z0 = Math.floor(z - r)
    const z1 = Math.floor(z + r)
    for (let yy = y0; yy <= y1; yy++)
      for (let zz = z0; zz <= z1; zz++)
        for (let xx = x0; xx <= x1; xx++) {
          if (world.solidAt(xx, yy, zz)) return true
        }
    return false
  }

  private blockMaterialBelow(world: VoxelWorld) {
    const b = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.15), Math.floor(this.pos.z))
    return blockDef(b).material ?? 'grass'
  }

  update(dt: number, input: InputState, world: VoxelWorld) {
    dt = Math.min(dt, 0.05)
    const eyeBlock = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.9), Math.floor(this.pos.z))
    const footBlock = world.get(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.1), Math.floor(this.pos.z))
    this.inWater = eyeBlock === B.WATER || footBlock === B.WATER
    this.crouching = input.crouch && !this.inWater
    this.sprinting = input.sprint && input.forward && !this.crouching && !this.inWater

    const speed = this.inWater ? 3.4 : this.crouching ? 2.4 : this.sprinting ? 8.4 : 4.9
    const accel = this.onGround ? 42 : this.inWater ? 22 : 14
    let ix = 0
    let iz = 0
    if (input.forward) iz -= 1
    if (input.back) iz += 1
    if (input.left) ix -= 1
    if (input.right) ix += 1
    const len = Math.hypot(ix, iz)
    let wishX = 0
    let wishZ = 0
    if (len > 0) {
      ix /= len
      iz /= len
      const sinY = Math.sin(this.yaw)
      const cosY = Math.cos(this.yaw)
      wishX = ix * cosY - iz * sinY
      wishZ = ix * sinY + iz * cosY
    }

    const targetVX = wishX * speed
    const targetVZ = wishZ * speed
    this.vel.x = damp(this.vel.x, targetVX, accel * 0.22, dt)
    this.vel.z = damp(this.vel.z, targetVZ, accel * 0.22, dt)

    // gravity
    if (this.inWater) {
      this.vel.y = damp(this.vel.y, input.jump ? 3.2 : -1.6, 8, dt)
    } else {
      this.vel.y -= 27 * dt
      if (this.vel.y < -42) this.vel.y = -42
    }

    // jump
    if (input.jump && !this.inWater) {
      if (this.onGround) {
        this.vel.y = 8.6
        this.onGround = false
        this.jumpsLeft = this.canDoubleJump ? 1 : 0
        this.onJump?.()
      } else if (this.jumpsLeft > 0) {
        this.vel.y = 7.6
        this.jumpsLeft--
        this.onJump?.()
      }
    }
    if (!input.jump && this.vel.y > 0 && !this.onGround) this.vel.y -= 14 * dt

    // integrate with axis-separated collisions
    const steps = Math.max(1, Math.ceil((Math.abs(this.vel.y) + Math.abs(this.vel.x) + Math.abs(this.vel.z)) * dt / 0.22))
    const sdt = dt / steps
    for (let s = 0; s < steps; s++) {
      // Y
      const ny = this.pos.y + this.vel.y * sdt
      if (this.collidesAt(this.pos.x, ny, this.pos.z, world)) {
        if (this.vel.y < 0) {
          this.pos.y = Math.floor(this.pos.y) + 0.0001
          this.onGround = true
          if (!this.wasOnGround) this.onLand?.()
        } else {
          this.pos.y = Math.floor(ny + this.height) - this.height - 0.001
        }
        this.vel.y = 0
      } else {
        this.pos.y = ny
        this.onGround = false
      }

      // X
      const nx = this.pos.x + this.vel.x * sdt
      if (this.collidesAt(nx, this.pos.y + 0.02, this.pos.z, world)) {
        // step up assist
        if (this.onGround && !this.inWater && this.stepUp(nx, this.pos.z, world, this.vel.z * sdt)) {
          /* stepped */
        } else this.vel.x = 0
      } else this.pos.x = nx

      // Z
      const nz = this.pos.z + this.vel.z * sdt
      if (this.collidesAt(this.pos.x, this.pos.y + 0.02, nz, world)) {
        if (this.onGround && !this.inWater && this.stepUp(this.pos.x, nz, world, 0)) {
          /* stepped */
        } else this.vel.z = 0
      } else this.pos.z = nz
    }

    this.pos.x = Math.max(1, Math.min(WX - 2, this.pos.x))
    this.pos.z = Math.max(1, Math.min(WZ - 2, this.pos.z))
    if (this.pos.y < -20) this.pos.y = 40

    // footstep sounds + head bob
    const hSpeed = Math.hypot(this.vel.x, this.vel.z)
    this.stepSmooth = damp(this.stepSmooth, 0, 9, dt)
    if (this.onGround && hSpeed > 0.6) {
      this.bobPhase += dt * hSpeed * 1.5
      this.bobAmount = damp(this.bobAmount, Math.min(1, hSpeed / 6), 8, dt)
      this.stepSoundCooldown -= dt
      if (this.bobPhase % Math.PI < dt * hSpeed * 1.5 && this.stepSoundCooldown <= 0) {
        this.stepSoundCooldown = 0.18
        this.onFootstep?.(this.blockMaterialBelow(world))
      }
    } else {
      this.bobAmount = damp(this.bobAmount, 0, 6, dt)
    }

    const fovTarget = this.sprinting ? 82 : this.inWater ? 68 : 72
    this.camFov = damp(this.camFov, fovTarget, 6, dt)
    this.camRoll = damp(this.camRoll, -this.vel.x * 0.004, 6, dt)
    this.wasOnGround = this.onGround
  }

  private stepUp(nx: number, nz: number, world: VoxelWorld, extraZ: number) {
    void extraZ
    const testY = this.pos.y + 1.06
    if (!this.collidesAt(nx, testY, nz, world)) {
      const before = this.pos.y
      this.pos.y = Math.floor(this.pos.y + 1.0) + 0.02
      if (this.collidesAt(this.pos.x, this.pos.y, this.pos.z, world)) {
        this.pos.y = before
        return false
      }
      this.stepSmooth += this.pos.y - before
      this.stepSmooth = Math.min(this.stepSmooth, 1.1)
      return true
    }
    return false
  }

  applyToCamera(camera: THREE.PerspectiveCamera) {
    const bobY = Math.sin(this.bobPhase * 2) * 0.042 * this.bobAmount
    const bobX = Math.cos(this.bobPhase) * 0.028 * this.bobAmount
    camera.position.set(
      this.pos.x + bobX * Math.cos(this.yaw),
      this.pos.y + this.eyeHeight - this.stepSmooth + bobY,
      this.pos.z - bobX * Math.sin(this.yaw),
    )
    camera.rotation.set(0, 0, 0)
    camera.rotateY(this.yaw)
    camera.rotateX(this.pitch)
    camera.rotateZ(this.camRoll)
    if (Math.abs(camera.fov - this.camFov) > 0.01) {
      camera.fov = this.camFov
      camera.updateProjectionMatrix()
    }
    const t = clamp01(this.stepSmooth)
    void t
  }

  get forward() {
    const cp = Math.cos(this.pitch)
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp)
  }
}
