import * as THREE from 'three'

function dotTexture(color: string, soft = true) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, color)
  g.addColorStop(soft ? 0.35 : 0.7, color.replace('1)', '0.6)'))
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export class AmbientFX {
  fireflies: THREE.Points
  leaves: THREE.Points
  rain: THREE.Points
  birds: THREE.Group
  private ffData: Float32Array
  private lvData: Float32Array
  private rnData: Float32Array
  private t = 0
  rainAmount = 0
  private birdPhase = 0

  constructor(scene: THREE.Scene) {
    // ---- fireflies ----
    const ffCount = 160
    const ffPos = new Float32Array(ffCount * 3)
    this.ffData = new Float32Array(ffCount * 4)
    for (let i = 0; i < ffCount; i++) {
      this.ffData[i * 4] = (Math.random() - 0.5) * 90
      this.ffData[i * 4 + 1] = 1 + Math.random() * 6
      this.ffData[i * 4 + 2] = (Math.random() - 0.5) * 90
      this.ffData[i * 4 + 3] = Math.random() * Math.PI * 2
    }
    const ffGeo = new THREE.BufferGeometry()
    ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3))
    const ffMat = new THREE.PointsMaterial({
      size: 0.34,
      map: dotTexture('rgba(255,240,150,1)'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      color: 0xffe9a0,
      sizeAttenuation: true,
      opacity: 0,
    })
    this.fireflies = new THREE.Points(ffGeo, ffMat)
    this.fireflies.frustumCulled = false
    scene.add(this.fireflies)

    // ---- drifting leaves ----
    const lvCount = 220
    const lvPos = new Float32Array(lvCount * 3)
    this.lvData = new Float32Array(lvCount * 4)
    for (let i = 0; i < lvCount; i++) {
      this.lvData[i * 4] = (Math.random() - 0.5) * 70
      this.lvData[i * 4 + 1] = Math.random() * 16
      this.lvData[i * 4 + 2] = (Math.random() - 0.5) * 70
      this.lvData[i * 4 + 3] = Math.random() * 10
    }
    const lvGeo = new THREE.BufferGeometry()
    lvGeo.setAttribute('position', new THREE.BufferAttribute(lvPos, 3))
    const lvMat = new THREE.PointsMaterial({
      size: 0.22,
      map: dotTexture('rgba(255,235,140,1)', false),
      transparent: true,
      depthWrite: false,
      color: 0xc8d98a,
      sizeAttenuation: true,
      opacity: 0.75,
    })
    this.leaves = new THREE.Points(lvGeo, lvMat)
    this.leaves.frustumCulled = false
    scene.add(this.leaves)

    // ---- rain ----
    const rnCount = 2600
    const rnPos = new Float32Array(rnCount * 3)
    this.rnData = new Float32Array(rnCount * 3)
    for (let i = 0; i < rnCount; i++) {
      this.rnData[i * 3] = (Math.random() - 0.5) * 70
      this.rnData[i * 3 + 1] = Math.random() * 34
      this.rnData[i * 3 + 2] = (Math.random() - 0.5) * 70
    }
    const rnGeo = new THREE.BufferGeometry()
    rnGeo.setAttribute('position', new THREE.BufferAttribute(rnPos, 3))
    const rnMat = new THREE.PointsMaterial({
      size: 0.13,
      color: 0xa8c8f0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })
    this.rain = new THREE.Points(rnGeo, rnMat)
    this.rain.frustumCulled = false
    scene.add(this.rain)

    // ---- birds ----
    this.birds = new THREE.Group()
    const birdMat = new THREE.MeshBasicMaterial({ color: 0x2b303c })
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group()
      const wingGeo = new THREE.BoxGeometry(0.9, 0.06, 0.24)
      const w1 = new THREE.Mesh(wingGeo, birdMat)
      w1.position.x = -0.45
      const w2 = new THREE.Mesh(wingGeo, birdMat)
      w2.position.x = 0.45
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.5), birdMat)
      b.add(w1, w2, body)
      b.userData = {
        w1,
        w2,
        radius: 30 + Math.random() * 40,
        height: 30 + Math.random() * 16,
        speed: 0.06 + Math.random() * 0.05,
        phase: Math.random() * Math.PI * 2,
      }
      this.birds.add(b)
    }
    scene.add(this.birds)
  }

  setRain(amount: number) {
    this.rainAmount = amount
  }

  update(dt: number, center: THREE.Vector3, night: number, timeHours: number) {
    this.t += dt
    const ffMat = this.fireflies.material as THREE.PointsMaterial
    const nightFactor = Math.max(0, Math.min(1, (night - 0.35) / 0.5))
    ffMat.opacity = nightFactor * (this.rainAmount > 0.4 ? 0.15 : 0.95)
    const ffPos = this.fireflies.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.ffData.length / 4; i++) {
      const ph = this.ffData[i * 4 + 3]
      const x = this.ffData[i * 4] + Math.sin(this.t * 0.5 + ph) * 1.6
      const y = this.ffData[i * 4 + 1] + Math.sin(this.t * 0.8 + ph * 2) * 0.7
      const z = this.ffData[i * 4 + 2] + Math.cos(this.t * 0.42 + ph) * 1.6
      ffPos.setXYZ(i, center.x + x, center.y - 4 + y, center.z + z)
    }
    ffPos.needsUpdate = true

    const lvPos = this.leaves.geometry.getAttribute('position') as THREE.BufferAttribute
    const wind = 1.6 + Math.sin(this.t * 0.2) * 0.8
    for (let i = 0; i < this.lvData.length / 4; i++) {
      let x = this.lvData[i * 4] + this.t * wind + Math.sin(this.t + i) * 0.6
      let y = this.lvData[i * 4 + 1] - ((this.t * 0.4 + i * 0.3) % 10)
      let z = this.lvData[i * 4 + 2] + Math.cos(this.t * 0.6 + i) * 1.2
      x = ((x + 35) % 70) - 35
      z = ((z + 35) % 70) - 35
      lvPos.setXYZ(i, center.x + x, center.y - 3 + y, center.z + z)
    }
    lvPos.needsUpdate = true
    ;(this.leaves.material as THREE.PointsMaterial).opacity = 0.28 + 0.4 * (1 - night)

    const rnMat = this.rain.material as THREE.PointsMaterial
    rnMat.opacity = this.rainAmount * 0.65
    this.rain.visible = this.rainAmount > 0.02
    if (this.rain.visible) {
      const rnPos = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < this.rnData.length / 3; i++) {
        this.rnData[i * 3 + 1] -= dt * 26
        if (this.rnData[i * 3 + 1] < 0) {
          this.rnData[i * 3 + 1] = 30 + Math.random() * 6
          this.rnData[i * 3] = (Math.random() - 0.5) * 70
          this.rnData[i * 3 + 2] = (Math.random() - 0.5) * 70
        }
        rnPos.setXYZ(i, center.x + this.rnData[i * 3] + 3, center.y - 6 + this.rnData[i * 3 + 1], center.z + this.rnData[i * 3 + 2])
      }
      rnPos.needsUpdate = true
    }

    // birds
    this.birdPhase += dt
    const day = 1 - Math.min(1, Math.abs(timeHours - 12) / 7)
    this.birds.visible = day > 0.25 && this.rainAmount < 0.5
    this.birds.children.forEach((b, i) => {
      const d = b.userData as { w1: THREE.Mesh; w2: THREE.Mesh; radius: number; height: number; speed: number; phase: number }
      const a = this.birdPhase * d.speed + d.phase
      b.position.set(center.x + Math.cos(a) * d.radius, center.y + d.height, center.z + Math.sin(a) * d.radius)
      b.rotation.y = -a + Math.PI / 2
      const flap = Math.sin(this.birdPhase * 9 + i) * 0.6
      d.w1.rotation.z = flap
      d.w2.rotation.z = -flap
    })
  }
}
