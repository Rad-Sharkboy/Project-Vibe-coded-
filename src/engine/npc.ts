import * as THREE from 'three'
import { VoxelWorld } from './world'
import { NpcSpawn } from '../game/worldgen'

const geoCache = new Map<string, THREE.BoxGeometry>()
function box(w: number, h: number, d: number) {
  const k = `${w}_${h}_${d}`
  let g = geoCache.get(k)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    geoCache.set(k, g)
  }
  return g
}

const matCache = new Map<number, THREE.MeshLambertMaterial>()
function lambert(color: number, emissive = 0) {
  const k = color + emissive * 1e9
  let m = matCache.get(k)
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(emissive) })
    matCache.set(k, m)
  }
  return m
}

function nameTagTexture(name: string, role: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const ctx = c.getContext('2d')!
  ctx.clearRect(0, 0, 512, 128)
  const grd = ctx.createLinearGradient(0, 0, 512, 128)
  grd.addColorStop(0, 'rgba(20,26,44,0.92)')
  grd.addColorStop(1, 'rgba(38,26,60,0.92)')
  ctx.fillStyle = grd
  const r = 26
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(512 - r, 0)
  ctx.quadraticCurveTo(512, 0, 512, r)
  ctx.lineTo(512, 128 - r)
  ctx.quadraticCurveTo(512, 128, 512 - r, 128)
  ctx.lineTo(r, 128)
  ctx.quadraticCurveTo(0, 128, 0, 128 - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 3
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(name, 256, 56)
  ctx.fillStyle = 'rgba(160,220,255,0.85)'
  ctx.font = '26px system-ui, sans-serif'
  ctx.fillText(role, 256, 94)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class NpcActor {
  def: NpcSpawn
  group = new THREE.Group()
  private legL!: THREE.Group
  private legR!: THREE.Group
  private armL!: THREE.Mesh
  private armR!: THREE.Mesh
  private torso!: THREE.Mesh
  private head!: THREE.Group
  private label: THREE.Sprite
  private target = new THREE.Vector2()
  private phase = Math.random() * Math.PI * 2
  private waitTime = 0
  private speed = 1.15
  private yaw = 0
  private headYaw = 0
  talking = false
  visited = false
  private tmp = new THREE.Vector3()
  private baseY: number

  constructor(def: NpcSpawn) {
    this.def = def
    this.baseY = def.y
    const skin = lambert(def.skin)
    const shirt = lambert(def.shirt)
    const pants = lambert(def.pants)
    const hair = lambert(def.hair)

    // legs
    this.legL = new THREE.Group()
    this.legR = new THREE.Group()
    this.legL.position.set(-0.15, 0.74, 0)
    this.legR.position.set(0.15, 0.74, 0)
    const legGeo = box(0.24, 0.74, 0.26)
    const l1 = new THREE.Mesh(legGeo, pants)
    l1.position.y = -0.37
    const l2 = new THREE.Mesh(legGeo, pants)
    l2.position.y = -0.37
    // shoes
    const shoe = new THREE.Mesh(box(0.26, 0.12, 0.34), lambert(0x23252e))
    shoe.position.set(0, -0.7, 0.04)
    l1.add(shoe)
    const shoe2 = shoe.clone()
    l2.add(shoe2)
    this.legL.add(l1)
    this.legR.add(l2)

    // torso
    this.torso = new THREE.Mesh(box(0.6, 0.72, 0.34), shirt)
    this.torso.position.y = 1.1
    // backpack
    const bag = new THREE.Mesh(box(0.44, 0.5, 0.2), lambert(0x2f3a52))
    bag.position.set(0, 0.04, -0.24)
    this.torso.add(bag)

    // arms
    this.armL = new THREE.Mesh(box(0.18, 0.66, 0.2), shirt)
    this.armL.geometry = box(0.18, 0.66, 0.2)
    this.armL.position.set(-0.4, 1.36, 0)
    this.armR = new THREE.Mesh(box(0.18, 0.66, 0.2), shirt)
    this.armR.position.set(0.4, 1.36, 0)
    const handL = new THREE.Mesh(box(0.17, 0.16, 0.19), skin)
    handL.position.y = -0.36
    this.armL.add(handL)
    const handR = handL.clone()
    this.armR.add(handR)

    // head
    this.head = new THREE.Group()
    this.head.position.y = 1.68
    const face = new THREE.Mesh(box(0.5, 0.5, 0.5), skin)
    this.head.add(face)
    // hair
    if (def.hairStyle === 'cap') {
      const cap = new THREE.Mesh(box(0.54, 0.16, 0.54), lambert(0x1f2430))
      cap.position.y = 0.29
      this.head.add(cap)
      const brim = new THREE.Mesh(box(0.5, 0.06, 0.22), lambert(0x1f2430))
      brim.position.set(0, 0.23, 0.32)
      this.head.add(brim)
    } else if (def.hairStyle === 'long') {
      const h = new THREE.Mesh(box(0.56, 0.62, 0.56), hair)
      h.position.set(0, 0.08, -0.03)
      this.head.add(h)
      const back = new THREE.Mesh(box(0.5, 0.66, 0.16), hair)
      back.position.set(0, -0.18, -0.24)
      this.head.add(back)
      face.scale.set(1, 1, 1)
    } else if (def.hairStyle === 'bun') {
      const h = new THREE.Mesh(box(0.55, 0.2, 0.55), hair)
      h.position.y = 0.27
      this.head.add(h)
      const bun = new THREE.Mesh(box(0.26, 0.26, 0.26), hair)
      bun.position.set(0, 0.32, -0.3)
      this.head.add(bun)
    } else if (def.hairStyle === 'curly') {
      const h = new THREE.Mesh(box(0.62, 0.3, 0.62), hair)
      h.position.y = 0.24
      this.head.add(h)
      for (let i = -1; i <= 1; i++) {
        const c = new THREE.Mesh(box(0.18, 0.18, 0.18), hair)
        c.position.set(i * 0.2, 0.34, -0.16)
        this.head.add(c)
      }
    } else {
      const h = new THREE.Mesh(box(0.54, 0.2, 0.54), hair)
      h.position.y = 0.26
      this.head.add(h)
    }
    // eyes
    const eyeGeo = box(0.08, 0.1, 0.04)
    const eyeMat = lambert(0x1a1a22)
    const e1 = new THREE.Mesh(eyeGeo, eyeMat)
    e1.position.set(-0.11, 0.03, 0.26)
    const e2 = new THREE.Mesh(eyeGeo, eyeMat)
    e2.position.set(0.11, 0.03, 0.26)
    this.head.add(e1, e2)

    this.group.add(this.legL, this.legR, this.torso, this.armL, this.armR, this.head)
    this.group.position.set(def.x, def.y, def.z)
    this.group.rotation.y = def.yaw ?? 0
    this.yaw = def.yaw ?? 0

    const tex = nameTagTexture(def.name, def.role)
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true })
    this.label = new THREE.Sprite(mat)
    this.label.scale.set(2.4, 0.6, 1)
    this.label.position.y = 2.42
    this.label.visible = false
    this.group.add(this.label)

    this.pickTarget()
  }

  private pickTarget() {
    const [x0, z0, x1, z1] = this.def.area
    this.target.set(x0 + Math.random() * (x1 - x0), z0 + Math.random() * (z1 - z0))
    this.waitTime = 0.6 + Math.random() * 2.2
  }

  private walkable(world: VoxelWorld, x: number, z: number) {
    const bx = Math.floor(x)
    const bz = Math.floor(z)
    const by = Math.floor(this.baseY)
    return !world.solidAt(bx, by, bz) && !world.solidAt(bx, by + 1, bz) && world.solidAt(bx, by - 1, bz)
  }

  update(dt: number, world: VoxelWorld, playerPos: THREE.Vector3, playerVisible: boolean) {
    const dx = playerPos.x - this.group.position.x
    const dz = playerPos.z - this.group.position.z
    const dy = playerPos.y - this.group.position.y
    const dist = Math.hypot(dx, dz)
    const near = dist < 16 && Math.abs(dy) < 6

    if (this.talking) {
      this.yaw = Math.atan2(dx, dz) + Math.PI
      this.phase += dt * 0.4
      this.waitTime = 1
    } else if (this.def.idle) {
      this.phase += dt * 0.5
      this.yaw += Math.sin(this.phase * 0.35) * dt * 0.25
      if (near) {
        const want = Math.atan2(dx, dz) + Math.PI
        let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        this.yaw += diff * Math.min(1, dt * 2.4)
      }
    } else {
      this.waitTime -= dt
      const tx = this.target.x - this.group.position.x
      const tz = this.target.y - this.group.position.z
      const td = Math.hypot(tx, tz)
      if (td < 0.6 || this.waitTime < -4) {
        if (this.waitTime < -4 || Math.random() > 0.4) this.pickTarget()
      } else if (this.waitTime <= 0) {
        const stepX = (tx / td) * this.speed * dt
        const stepZ = (tz / td) * this.speed * dt
        let moved = false
        if (this.walkable(world, this.group.position.x + stepX, this.group.position.z)) {
          this.group.position.x += stepX
          moved = true
        }
        if (this.walkable(world, this.group.position.x, this.group.position.z + stepZ)) {
          this.group.position.z += stepZ
          moved = true
        }
        if (!moved) this.pickTarget()
        const want = Math.atan2(tx, tz)
        let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
        this.yaw += diff * Math.min(1, dt * 6)
        this.phase += dt * 9
        if (near) {
          // pause to look at the player
          this.waitTime = Math.min(this.waitTime, 0.9)
        }
      } else {
        this.phase += dt * 1.2
        if (near) {
          const want = Math.atan2(dx, dz) + Math.PI
          let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
          this.yaw += diff * Math.min(1, dt * 3)
        }
      }
    }
    this.group.rotation.y = this.yaw

    // animate limbs
    const swinging = this.waitTime <= 0 && !this.def.idle && !this.talking
    const amp = swinging ? 0.62 : 0.06
    const bob = Math.sin(this.phase * 2) * (swinging ? 0.045 : 0.012)
    this.legL.rotation.x = Math.sin(this.phase) * amp
    this.legR.rotation.x = -Math.sin(this.phase) * amp
    this.armL.rotation.x = -Math.sin(this.phase) * amp * 0.8
    this.armR.rotation.x = Math.sin(this.phase) * amp * 0.8
    this.armL.rotation.z = 0.06
    this.armR.rotation.z = -0.06
    this.torso.position.y = 1.1 + bob
    this.head.position.y = 1.68 + bob
    this.head.rotation.y = Math.sin(this.phase * 0.3) * 0.18
    this.label.visible = near && playerVisible && dist < 13
    if (this.label.visible) {
      this.label.material.opacity = Math.min(1, (13 - dist) / 5)
    }
    void this.tmp
  }

  distanceTo(p: THREE.Vector3) {
    return Math.hypot(p.x - this.group.position.x, p.z - this.group.position.z)
  }
}
