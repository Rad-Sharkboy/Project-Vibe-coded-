import * as THREE from 'three'
import { B, BUILDABLE, blockDef } from '../engine/blocks'
import { WorldRenderer, minimapColor } from '../engine/chunkManager'
import { NpcActor } from '../engine/npc'
import { AmbientFX } from '../engine/particles'
import { Player, InputState, raycastVoxel } from '../engine/player'
import { SkySystem } from '../engine/sky'
import { VoxelWorld, WX, WY, WZ } from '../engine/world'
import { audio } from '../engine/audio'
import { generateCampus, NpcSpawn, POI, Zone } from './worldgen'
import { ITEMS, STORY, npcDialogue } from './story'
import { useGame } from './store'

const store = useGame.getState

function nextFrame() {
  return new Promise<void>((r) => requestAnimationFrame(() => r()))
}

export class Game {
  renderer: THREE.WebGLRenderer
  scene = new THREE.Scene()
  camera: THREE.PerspectiveCamera
  canvas: HTMLCanvasElement
  world!: VoxelWorld
  worldRenderer!: WorldRenderer
  sky: SkySystem
  fx: AmbientFX
  player = new Player()
  npcs: NpcActor[] = []
  pois: POI[] = []
  zones: Zone[] = []
  spawnPoint = { x: 47.5, y: 18, z: 114.5, yaw: 0 }
  mapCanvas: HTMLCanvasElement | null = null

  mode: 'orbit' | 'cinematic' | 'player' | 'photo' = 'orbit'
  ready = false
  paused = false
  private lastTime = 0
  private elapsed = 0
  private keys = new Set<string>()
  private input: InputState = { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false }
  private locked = false
  private ignoreUnlock = false
  private targetBlock: ReturnType<typeof raycastVoxel> = null
  private highlight: THREE.LineSegments
  private breakBurst: THREE.InstancedMesh
  private burstMat = new THREE.MeshLambertMaterial({ color: 0xd9d3c4 })
  private burstData: number[] = []
  private selectedBlock = 0
  private placedCount = 0
  private coffeesToday = 0
  private talkedIds = new Set<string>()
  private visitedZones = new Set<string>()
  private cineT = 0
  private cineFaded = false
  private cineCurve: THREE.CatmullRomCurve3 | null = null
  private cineLook: THREE.CatmullRomCurve3 | null = null
  private orbitAngle = 0
  private objectiveMarker: THREE.Group
  private glowBook: THREE.Mesh | null = null
  private glowBookY = 0
  private promptTimer = 0
  private vitalsTimer = 0
  private storeTimer = 0
  private weatherTimer = 0
  private rainTarget = 0
  private rainLevel = 0
  private clockThunder = 0
  private lastStep = -1
  private soundStepCooldown = 0
  private fpsSamples: number[] = []
  private objectiveTarget = new THREE.Vector3()
  private objectiveBaseY = 0
  private hasObjective = false
  private lastZone = ''
  private disposing = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = false
    renderer.autoClear = true
    this.renderer = renderer

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.06, 900)
    this.camera.position.set(128, 60, 190)
    this.scene.fog = null
    this.scene.background = new THREE.Color(0x0a0e18)

    this.sky = new SkySystem(this.scene)
    this.fx = new AmbientFX(this.scene)

    const hlGeo = new THREE.BoxGeometry(1.005, 1.005, 1.005)
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(hlGeo),
      new THREE.LineBasicMaterial({ color: 0x9de8ff, transparent: true, opacity: 0.85 }),
    )
    this.highlight.visible = false
    this.scene.add(this.highlight)

    const bGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12)
    this.breakBurst = new THREE.InstancedMesh(bGeo, this.burstMat, 90)
    this.breakBurst.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.breakBurst.frustumCulled = false
    this.breakBurst.count = 0
    this.scene.add(this.breakBurst)

    // objective marker
    this.objectiveMarker = new THREE.Group()
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 14, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7be3ff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    )
    beam.position.y = 7
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial({ color: 0x9df0ff }))
    gem.position.y = 2.4
    gem.name = 'gem'
    this.objectiveMarker.add(beam, gem)
    this.objectiveMarker.visible = false
    this.scene.add(this.objectiveMarker)

    this.bindEvents()
    this.animate(performance.now())
  }

  // ---------------------------------------------------------------- loading
  async load() {
    const st = store()
    st.set({ progress: 0.02, progressLabel: 'Surveying the campus', progressSub: 'Placing bricks, one by one' })
    await nextFrame()
    this.world = new VoxelWorld()
    const gen = generateCampus(this.world)
    this.pois = gen.pois
    this.zones = gen.zones
    this.spawnPoint = { ...gen.playerSpawn }
    st.set({ progress: 0.16, progressLabel: 'Raising buildings', progressSub: 'Halcyon Hall, Vox Hall, The Archive…' })
    await nextFrame()

    st.set({ progress: 0.22, progressLabel: 'Computing sunlight', progressSub: 'Baking 4.2 million voxels of light' })
    await nextFrame()
    this.world.computeLight()

    st.set({ progress: 0.4, progressLabel: 'Meshing the world', progressSub: 'Greedy quads + ambient occlusion' })
    await nextFrame()
    this.worldRenderer = new WorldRenderer(this.world)
    this.scene.add(this.worldRenderer.group)
    const steps = this.worldRenderer.buildSteps()
    let i = 0
    for (const p of steps) {
      i++
      if (i % 4 === 0) {
        st.set({ progress: 0.4 + p * 0.5 })
        await nextFrame()
      }
    }
    st.set({ progress: 0.92, progressLabel: 'Waking up the students', progressSub: 'Everyone is late for something' })
    await nextFrame()

    for (const def of gen.npcs) {
      const actor = new NpcActor(def)
      this.npcs.push(actor)
      this.scene.add(actor.group)
    }

    this.buildMap()
    this.buildGlowBook()

    st.set({ progress: 1, progressLabel: 'Welcome to campus', progressSub: 'Click to begin' })
    this.ready = true
    audio.init()
    audio.setMusicVolume(store().settings.music)
    audio.setSfxVolume(store().settings.sfx)
  }

  private buildMap() {
    const c = document.createElement('canvas')
    c.width = WX
    c.height = WZ
    const ctx = c.getContext('2d')!
    const img = ctx.createImageData(WX, WZ)
    for (let z = 0; z < WZ; z++) {
      for (let x = 0; x < WX; x++) {
        let y = WY - 1
        let b = 0
        while (y >= 0) {
          b = this.world.get(x, y, z)
          if (b !== B.AIR && b !== B.WATER && b !== B.LEAVES && b !== B.BUSH) break
          y--
        }
        const col = minimapColor(b)
        const i = (z * WX + x) * 4
        if (col === 'transparent') {
          img.data[i] = 20
          img.data[i + 1] = 26
          img.data[i + 2] = 40
          img.data[i + 3] = 255
          continue
        }
        const c3 = hexToRgb(col)
        const shade = b === B.WATER ? 1 : 0.82 + Math.min(0.3, Math.max(0, (y - 12) / 40))
        img.data[i] = Math.min(255, c3[0] * shade)
        img.data[i + 1] = Math.min(255, c3[1] * shade)
        img.data[i + 2] = Math.min(255, c3[2] * shade)
        img.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    this.mapCanvas = c
  }

  private buildGlowBook() {
    const poi = this.pois.find((p) => p.id === 'lostBook')
    if (!poi) return
    const g = new THREE.Group()
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.16, 0.36),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0 }),
    )
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd45e, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    )
    g.add(book, glow)
    g.position.set(poi.x + 0.5, poi.y + 0.9, poi.z + 0.5)
    this.glowBookY = g.position.y
    g.name = 'glowBook'
    this.glowBook = g as unknown as THREE.Mesh
    this.scene.add(g)
  }

  // ---------------------------------------------------------------- start
  startCinematic() {
    if (!this.ready) return
    audio.resume()
    audio.startMusic()
    audio.startAmbience()
    store().set({ screen: 'cinematic', progress: 1 })
    this.mode = 'cinematic'
    this.cineT = 0
    this.sky.hours = 6.72
    this.sky.dayLength = 130
    this.cineFaded = false
    this.cineCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(214, 104, 232),
      new THREE.Vector3(176, 78, 214),
      new THREE.Vector3(140, 56, 190),
      new THREE.Vector3(114, 36, 164),
      new THREE.Vector3(95, 25, 147),
      new THREE.Vector3(85.5, 20.4, 136),
      new THREE.Vector3(82, 18.9, 130.5),
    ])
    this.cineLook = new THREE.CatmullRomCurve3([
      new THREE.Vector3(122, 24, 118),
      new THREE.Vector3(127, 20, 123),
      new THREE.Vector3(124, 18, 125),
      new THREE.Vector3(102, 18, 130),
      new THREE.Vector3(86, 18, 128),
      new THREE.Vector3(78.5, 18.4, 128),
      new THREE.Vector3(76, 18.6, 128),
    ])
  }

  beginPlay() {
    this.mode = 'player'
    this.sky.dayLength = 900
    this.sky.setTime(7.45)
    store().set({ screen: 'playing', fading: true, fadeLabel: 'HALCYON HALL · ROOM 214' })
    window.setTimeout(() => store().set({ fading: false }), 700)
    this.player.spawn(this.spawnPoint.x, this.spawnPoint.y, this.spawnPoint.z, this.spawnPoint.yaw)
    this.player.onFootstep = (m) => audio.footstep(m)
    this.player.onJump = () => audio.jump()
    this.player.onLand = () => audio.land()
    this.requestLock()
  }

  requestLock() {
    if (this.mode !== 'player' && this.mode !== 'photo') return
    if (document.pointerLockElement === this.canvas) return
    this.ignoreUnlock = true
    void this.canvas.requestPointerLock?.()
  }

  // ---------------------------------------------------------------- events
  private onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const s = store()
    if (e.code === 'Escape') {
      if (s.screen === 'photo') {
        s.set({ screen: 'playing' })
        this.mode = 'player'
        this.requestLock()
        return
      }
      return
    }
    if (s.screen !== 'playing' && s.screen !== 'photo') return
    this.keys.add(e.code)
    if (e.code === 'KeyE') {
      if (!s.dialogue) this.interact()
    }
    if (e.code === 'KeyF') {
      const photo = s.screen === 'photo'
      s.set({ screen: photo ? 'playing' : 'photo' })
      this.mode = photo ? 'player' : 'photo'
      s.pushToast({ kind: 'info', title: photo ? 'Photo mode off' : 'Photo mode', body: photo ? '' : 'HUD hidden. Press F again to return.', icon: '📷' })
    }
    if (e.code === 'KeyB') {
      if (s.buildUnlocked) {
        const bm = !s.buildMode
        s.set({ buildMode: bm })
        audio.ui(bm ? 'open' : 'close')
        s.pushToast({ kind: 'info', title: bm ? 'Build mode on' : 'Build mode off', body: bm ? 'LMB mine · RMB place · 1-9 select' : '', icon: '🧱' })
      } else {
        audio.ui('error')
        s.pushToast({ kind: 'info', title: 'Build mode locked', body: 'Finish orientation first.', icon: '🔒' })
      }
    }
    if (e.code === 'Tab') {
      e.preventDefault()
      this.toggleOverlay('journal')
    }
    if (e.code === 'KeyI') {
      this.toggleOverlay('bag')
    }
    if (e.code === 'KeyM') {
      this.toggleOverlay('journal')
    }
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5), 10)
      if (n >= 1 && n <= 9) {
        const idx = Math.min(n - 1, BUILDABLE.length - 1)
        this.selectedBlock = idx
        s.set({ hotbar: idx })
        audio.ui('hover')
      }
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return
    if (this.mode !== 'player' && this.mode !== 'photo') return
    const sens = store().settings.sensitivity
    this.player.look(e.movementX, e.movementY, sens)
  }

  private onMouseDown = (e: MouseEvent) => {
    if (store().dialogue) return
    if (this.mode === 'orbit' || this.mode === 'cinematic') return
    if (!this.locked) {
      this.requestLock()
      return
    }
    if (e.button === 0) this.mine()
    else if (e.button === 2) this.place()
  }

  private onWheel = (e: WheelEvent) => {
    if (store().screen !== 'playing') return
    const dir = e.deltaY > 0 ? 1 : -1
    this.selectedBlock = (this.selectedBlock + dir + BUILDABLE.length) % BUILDABLE.length
    store().set({ hotbar: this.selectedBlock })
  }

  private onLockChange = () => {
    const locked = document.pointerLockElement === this.canvas
    this.locked = locked
    const s = store()
    s.set({ pointerLocked: locked })
    if (!locked && this.ignoreUnlock) {
      this.ignoreUnlock = false
      return
    }
    if (!locked && (s.screen === 'playing' || s.screen === 'photo') && !s.dialogue) {
      s.set({ screen: 'paused' })
      this.mode = 'player'
      audio.ui('close')
    }
  }

  private onContext = (e: Event) => e.preventDefault()

  private bindEvents() {
    window.addEventListener('resize', this.onResize)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('wheel', this.onWheel, { passive: true })
    document.addEventListener('pointerlockchange', this.onLockChange)
    this.canvas.addEventListener('contextmenu', this.onContext)
    window.addEventListener('blur', () => this.keys.clear())
  }

  dispose() {
    this.disposing = true
    window.removeEventListener('resize', this.onResize)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('wheel', this.onWheel)
    document.removeEventListener('pointerlockchange', this.onLockChange)
    this.canvas.removeEventListener('contextmenu', this.onContext)
    this.worldRenderer?.dispose()
    this.renderer.dispose()
  }

  // ---------------------------------------------------------------- actions
  private mine() {
    if (!this.targetBlock) return
    const { x, y, z } = this.targetBlock
    const b = this.world.get(x, y, z)
    if (b === B.AIR || b === B.WATER) return
    this.spawnBurst(x, y, z, b)
    this.worldRenderer.setBlock(x, y, z, B.AIR)
    audio.noiseBurst()
    this.targetBlock = null
  }

  private place() {
    const s = store()
    if (!s.buildUnlocked) {
      audio.ui('error')
      return
    }
    if (!this.targetBlock) return
    const { x, y, z, nx, ny, nz } = this.targetBlock
    const px = x + nx
    const py = y + ny
    const pz = z + nz
    if (py < 1 || py >= WY - 1) return
    if (this.world.get(px, py, pz) !== B.AIR) return
    // don't entomb yourself
    const p = this.player.pos
    const overlap =
      px + 1 > p.x - 0.3 && px < p.x + 0.3 && pz + 1 > p.z - 0.3 && pz < p.z + 0.3 && py + 1 > p.y && py < p.y + 1.78
    if (overlap) return
    this.worldRenderer.setBlock(px, py, pz, BUILDABLE[this.selectedBlock])
    audio.ui('click')
    this.placedCount++
    if (this.placedCount >= 20) s.unlockAchievement('builder', 'Campus Architect', 'Placed 20 blocks around campus.')
    s.addXp(1)
  }

  private spawnBurst(x: number, y: number, z: number, block: number) {
    const def = blockDef(block)
    this.burstData = []
    const count = 10
    for (let i = 0; i < count; i++) {
      this.burstData.push(
        x + 0.2 + Math.random() * 0.6,
        y + 0.2 + Math.random() * 0.6,
        z + 0.2 + Math.random() * 0.6,
        (Math.random() - 0.5) * 3.2,
        Math.random() * 3.6 + 1,
        (Math.random() - 0.5) * 3.2,
        1,
      )
    }
    this.breakBurst.count = count
    const pal: Record<string, number> = { grass: 0x7da85a, stone: 0xbcbcc0, wood: 0xb08458, metal: 0xa8b0bc, carpet: 0x8b5a6a, water: 0x6fb4e8 }
    this.burstMat.color.setHex(pal[def.material ?? 'stone'] ?? 0xd9d3c4)
    this.breakBurst.visible = true
  }

  private interact() {
    const eye = this.player.eyePos
    const fwd = this.player.forward
    let bestNpc: NpcActor | null = null
    let bestScore = -1
    for (const npc of this.npcs) {
      const dx = npc.group.position.x - eye.x
      const dy = npc.group.position.y + 1.2 - eye.y
      const dz = npc.group.position.z - eye.z
      const d = Math.hypot(dx, dy, dz)
      if (d > 4.2) continue
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / (d || 1)
      const score = dot * 2 - d * 0.15
      if (d < 3.6 || dot > 0.55) {
        if (score > bestScore) {
          bestScore = score
          bestNpc = npc
        }
      }
    }
    if (bestNpc) {
      this.talkTo(bestNpc)
      return
    }
    const poi = this.nearestPoi()
    if (poi) this.usePoi(poi)
  }

  private nearestPoi(): POI | null {
    const p = this.player.pos
    let best: POI | null = null
    let bestD = Infinity
    for (const poi of this.pois) {
      const d = Math.hypot(poi.x + 0.5 - p.x, poi.z + 0.5 - p.z)
      const dy = Math.abs(poi.y - p.y)
      if (d < (poi.radius ?? 3) && dy < 4 && d < bestD) {
        bestD = d
        best = poi
      }
    }
    return best
  }

  private talkTo(npc: NpcActor) {
    const s = store()
    const step = s.questStep
    const hasBook = (s.inventory['book'] ?? 0) > 0
    const d = npcDialogue(npc.def.id, npc.def.name, npc.def.role, { step, hasBook, hasCard: (s.inventory['card'] ?? 0) > 0, talks: s.talks })
    npc.talking = true
    this.ignoreUnlock = true
    document.exitPointerLock?.()
    s.startDialogue({ npcId: npc.def.id, ...d })
    audio.ui('open')
    s.set({ talks: s.talks + 1 })
    if (!this.talkedIds.has(npc.def.id)) {
      this.talkedIds.add(npc.def.id)
      s.addXp(8)
    }
    if (s.talks + 1 >= 5) s.unlockAchievement('social', 'Social Butterfly', 'Talked to five people on campus.')
    // quest triggers
    this.completeTrigger('talk:' + npc.def.id)
    if (npc.def.id === 'mira' && step === 5 && hasBook) {
      s.removeItem('book')
      s.pushToast({ kind: 'item', title: 'Returned the book', body: 'Mira is quietly delighted.', icon: '📚' })
      this.completeTrigger('return:mira')
      if (this.glowBook) this.glowBook.visible = false
    }
    if (npc.def.id === 'vox') this.completeTrigger('listen:lecture')
    this.waitForDialogueEnd(npc)
  }

  private waitForDialogueEnd(npc: NpcActor) {
    const check = () => {
      if (!store().dialogue) {
        npc.talking = false
        if (this.mode === 'player' || this.mode === 'photo') this.requestLock()
        return
      }
      window.setTimeout(check, 120)
    }
    window.setTimeout(check, 300)
  }

  private usePoi(poi: POI) {
    const s = store()
    switch (poi.type) {
      case 'bed': {
        s.set({ fading: true, fadeLabel: 'Sleeping…' })
        audio.sleepSound()
        window.setTimeout(() => {
          this.sky.hours = 7.0
          this.sky.dayCount++
          s.setVitals({ energy: 100, caffeine: Math.max(0, s.vitals.caffeine - 25) })
          s.set({ day: s.day + 1, fading: false })
          s.addXp(15)
          s.pushToast({ kind: 'info', title: 'A new morning', body: 'You feel almost like a person.', icon: '🌅' })
          this.coffeesToday = 0
        }, 1500)
        window.setTimeout(() => s.set({ fading: false }), 2400)
        break
      }
      case 'study': {
        s.setVitals({ study: Math.min(100, s.vitals.study + 14), energy: Math.max(0, s.vitals.energy - 4) })
        s.addXp(14)
        s.addItem('notes')
        s.pushToast({ kind: 'info', title: 'Study session', body: 'You absorbed roughly four pages.', icon: '📖' })
        audio.ui('click')
        if ((s.inventory['notes'] ?? 0) >= 3) s.unlockAchievement('reader', 'Bookworm', 'Studied at campus study spots.')
        break
      }
      case 'coffee': {
        if (s.coins < 3) {
          audio.ui('error')
          s.pushToast({ kind: 'info', title: 'Not enough credits', body: 'You need ¤3. Student life.', icon: '💸' })
          break
        }
        s.addCoins(-3)
        s.addItem('coffee')
        s.setVitals({
          caffeine: Math.min(100, s.vitals.caffeine + 45),
          energy: Math.min(100, s.vitals.energy + 20),
        })
        s.addXp(6)
        audio.coffeeSound()
        this.coffeesToday++
        if (this.coffeesToday >= 3) s.unlockAchievement('caffeine', 'Caffeine Dependent', 'Three coffees in one day.')
        s.pushToast({ kind: 'item', title: 'Flat White', body: 'Caffeine +45 · Energy +20', icon: '☕' })
        this.completeTrigger('use:coffee')
        break
      }
      case 'vending': {
        if (s.coins < 2) {
          audio.ui('error')
          s.pushToast({ kind: 'info', title: 'Not enough credits', body: 'The machine stares back.', icon: '💸' })
          break
        }
        s.addCoins(-2)
        s.addItem('snack')
        s.setVitals({ energy: Math.min(100, s.vitals.energy + 12) })
        s.addXp(4)
        audio.coinSound()
        s.pushToast({ kind: 'item', title: 'Vending Pastry', body: 'It is warm. Suspiciously warm.', icon: '🥐' })
        break
      }
      case 'podium': {
        s.addXp(25)
        s.setVitals({ study: Math.min(100, s.vitals.study + 20), social: Math.min(100, s.vitals.social + 10) })
        s.pushToast({ kind: 'info', title: 'You addressed the hall', body: 'Somebody actually clapped.', icon: '🎤' })
        audio.questSound()
        this.completeTrigger('use:podium')
        s.set({ buildUnlocked: true })
        break
      }
      case 'library': {
        const mira = this.npcs.find((n) => n.def.id === 'mira')
        if (mira) this.talkTo(mira)
        break
      }
      case 'book': {
        if ((s.inventory['book'] ?? 0) > 0) break
        s.addItem('book')
        s.addXp(20)
        audio.pickupSound()
        s.pushToast({ kind: 'item', title: 'Campus Ghosts: A Field Guide', body: 'It is warm and faintly humming.', icon: '📕' })
        if (this.glowBook) this.glowBook.visible = false
        this.completeTrigger('collect:lostBook')
        break
      }
      case 'gym': {
        s.setVitals({ energy: Math.max(0, s.vitals.energy - 8), social: Math.min(100, s.vitals.social + 6) })
        s.addXp(18)
        audio.land()
        s.pushToast({ kind: 'info', title: 'Sweat Equity', body: 'You lifted something. Possibly a mop.', icon: '🏋️' })
        this.completeTrigger('use:gym')
        break
      }
      case 'hoop': {
        s.addXp(10)
        s.setVitals({ energy: Math.max(0, s.vitals.energy - 5), social: Math.min(100, s.vitals.social + 4) })
        s.pushToast({ kind: 'info', title: 'Swish', body: 'Two points for the fresher.', icon: '🏀' })
        audio.ui('click')
        break
      }
      case 'arcade': {
        if (s.coins < 2) {
          audio.ui('error')
          s.pushToast({ kind: 'info', title: 'Not enough credits', body: 'Kai laughs, not unkindly.', icon: '💸' })
          break
        }
        s.addCoins(-2)
        s.addXp(12)
        s.setVitals({ social: Math.min(100, s.vitals.social + 8), caffeine: Math.min(100, s.vitals.caffeine + 10) })
        audio.pickupSound()
        s.pushToast({ kind: 'info', title: 'Voxel Kart: 2nd place', body: 'Kai did not even look at the screen.', icon: '🕹️' })
        break
      }
      case 'notice': {
        s.addXp(15)
        s.addCoins(4)
        s.setVitals({ social: Math.min(100, s.vitals.social + 12) })
        audio.questSound()
        s.pushToast({ kind: 'quest', title: 'Signed up for something', body: 'Soup Appreciation Society, apparently.', icon: '📌' })
        this.completeTrigger('use:notice')
        break
      }
      case 'stage': {
        s.addXp(25)
        s.setVitals({ social: Math.min(100, s.vitals.social + 16) })
        audio.levelUpSound()
        s.pushToast({ kind: 'info', title: 'Open Mic', body: 'You read a poem. Two people cried. Good? Unclear.', icon: '🎙️' })
        break
      }
      case 'social': {
        s.addXp(12)
        s.setVitals({ social: Math.min(100, s.vitals.social + 18), energy: Math.max(0, s.vitals.energy - 3) })
        s.pushToast({ kind: 'info', title: 'New acquaintances', body: 'You now know three names and zero faces.', icon: '🫂' })
        break
      }
      case 'bus': {
        s.set({ fading: true, fadeLabel: 'Riding the loop…' })
        audio.ui('open')
        window.setTimeout(() => {
          this.player.spawn(132.5, 17.1, 128.5, 0.7)
          s.set({ fading: false })
          s.addXp(6)
          s.pushToast({ kind: 'info', title: 'Campus Loop', body: 'Arrived: The Quad.', icon: '🚌' })
        }, 1200)
        break
      }
      case 'fountain': {
        if (s.coins >= 1) {
          s.addCoins(-1)
          s.addXp(4)
          audio.coinSound()
          s.pushToast({ kind: 'info', title: 'Coin tossed', body: 'Wish: graduate. Ambitious.', icon: '🪙' })
        } else {
          s.pushToast({ kind: 'info', title: 'Out of credits', body: 'The fountain does not accept vibes.', icon: '⛲' })
        }
        break
      }
      case 'bench': {
        s.setVitals({ energy: Math.min(100, s.vitals.energy + 4), social: Math.min(100, s.vitals.social + 3) })
        s.addXp(3)
        s.pushToast({ kind: 'info', title: 'A moment of peace', body: 'You watched the clouds do nothing.', icon: '🌤️' })
        break
      }
      case 'pond': {
        s.addXp(8)
        s.setVitals({ social: Math.min(100, s.vitals.social + 4) })
        s.pushToast({ kind: 'info', title: 'Mirror Pond', body: 'A turtle surfaced. You have witnesses: none.', icon: '🐢' })
        break
      }
      case 'ball': {
        s.addXp(10)
        s.unlockAchievement('athlete', 'Student Athlete', 'Kicked a ball on the pitch.')
        audio.land()
        s.pushToast({ kind: 'info', title: 'Kickabout', body: 'Top corner. In your memory.', icon: '⚽' })
        break
      }
      case 'phone': {
        s.pushToast({ kind: 'info', title: 'Notice Wall', body: '"Laundry room 3 is haunted." "Chess club: bring biscuits."', icon: '📋' })
        s.addXp(3)
        break
      }
      case 'building': {
        s.pushToast({ kind: 'info', title: poi.label, body: poi.prompt, icon: '🏛️' })
        break
      }
      default: {
        s.addXp(2)
        s.pushToast({ kind: 'info', title: poi.label, body: poi.prompt, icon: '✦' })
      }
    }
  }

  private completeTrigger(trigger: string) {
    const s = store()
    const step = STORY[s.questStep]
    if (!step) return
    if (step.trigger !== trigger) return
    s.addXp(step.xp)
    if (step.coins) s.addCoins(step.coins)
    if (step.gpa) s.set({ gpa: step.gpa })
    s.set({ questStep: s.questStep + 1, completed: [...s.completed, step.id] })
    audio.questSound()
    s.pushToast({ kind: 'quest', title: 'Objective complete', body: step.title, icon: '🎯' })
    if (step.id === 'dean') {
      s.addItem('pizza')
      s.unlockAchievement('dean', "Dean's List", 'Completed Freshers Week.')
      s.pushToast({ kind: 'level', title: "Freshers' Week complete", body: 'You survived. Barely. Free pizza acquired.', icon: '🎉' })
      audio.levelUpSound()
    }
  }

  // ---------------------------------------------------------------- loop
  private updateInput() {
    const k = this.keys
    const enabled = store().screen === 'playing' || store().screen === 'photo'
    const noDialogue = !store().dialogue && !store().showJournal && !store().showBag
    this.input.forward = enabled && noDialogue && (k.has('KeyW') || k.has('ArrowUp'))
    this.input.back = enabled && noDialogue && (k.has('KeyS') || k.has('ArrowDown'))
    this.input.left = enabled && noDialogue && (k.has('KeyA') || k.has('ArrowLeft'))
    this.input.right = enabled && noDialogue && (k.has('KeyD') || k.has('ArrowRight'))
    this.input.jump = enabled && noDialogue && k.has('Space')
    this.input.sprint = enabled && (k.has('ShiftLeft') || k.has('ShiftRight'))
    this.input.crouch = enabled && (k.has('ControlLeft') || k.has('KeyC'))
    this.player.canDoubleJump = store().level >= 4
  }

  private updateObjective() {
    const s = store()
    const step = STORY[s.questStep]
    if (!step || s.questStep !== this.lastStep) {
      this.lastStep = s.questStep
      const target = this.objectivePosition(step?.trigger)
      this.hasObjective = !!target
      if (target) {
        this.objectiveTarget.copy(target)
        this.objectiveBaseY = target.y
        this.objectiveMarker.visible = true
        this.objectiveMarker.position.set(target.x, target.y, target.z)
      } else {
        this.objectiveMarker.visible = false
      }
    }
    if (this.hasObjective) {
      const t = this.elapsed
      const gem = this.objectiveMarker.getObjectByName('gem')
      if (gem) {
        gem.rotation.y = t * 1.6
        gem.position.y = 2.4 + Math.sin(t * 2) * 0.18
      }
      this.objectiveMarker.position.y = this.objectiveBaseY + Math.sin(t * 0.8) * 0.12
    }
  }

  private objectivePosition(trigger?: string) {
    if (!trigger) return null
    const [kind, id] = trigger.split(':')
    if (kind === 'talk' || kind === 'return') {
      const npc = this.npcs.find((n) => n.def.id === id)
      if (npc) return new THREE.Vector3(npc.group.position.x, npc.group.position.y + 0.2, npc.group.position.z)
    }
    const poi = this.pois.find((p) => p.id === id)
    if (poi) return new THREE.Vector3(poi.x + 0.5, poi.y + 0.2, poi.z + 0.5)
    return null
  }

  private updatePrompts() {
    const s = store()
    if (s.dialogue || s.screen !== 'playing') {
      if (s.prompt) s.setPrompt(null)
      return
    }
    const eye = this.player.eyePos
    const fwd = this.player.forward
    let prompt: { id: string; label: string; verb: string; type: string } | null = null
    let bestScore = -1
    for (const npc of this.npcs) {
      const dx = npc.group.position.x - eye.x
      const dy = npc.group.position.y + 1.2 - eye.y
      const dz = npc.group.position.z - eye.z
      const d = Math.hypot(dx, dy, dz)
      if (d > 4.2) continue
      const dot = (dx * fwd.x + dy * fwd.y + dz * fwd.z) / (d || 1)
      if (d < 3.4 || dot > 0.55) {
        const score = dot * 2 - d * 0.1
        if (score > bestScore) {
          bestScore = score
          prompt = { id: 'npc:' + npc.def.id, label: npc.def.name + ' · ' + npc.def.role, verb: 'Talk', type: 'npc' }
        }
      }
    }
    if (!prompt) {
      const poi = this.nearestPoi()
      if (poi) prompt = { id: 'poi:' + poi.id, label: poi.label, verb: poi.prompt, type: poi.type }
    }
    s.setPrompt(prompt)
  }

  private updateVitals(dt: number) {
    const s = store()
    if (s.screen !== 'playing') return
    this.vitalsTimer += dt
    if (this.vitalsTimer < 0.5) return
    const step = this.vitalsTimer
    this.vitalsTimer = 0
    const v = s.vitals
    const energy = Math.max(0, v.energy - step * 0.075)
    const caffeine = Math.max(0, v.caffeine - step * 0.11)
    const social = Math.max(0, v.social - step * 0.03)
    s.setVitals({ energy, caffeine, social })
    if (s.hours > 1.6 && s.hours < 4 && !s.achievements.includes('nightOwl')) {
      s.unlockAchievement('nightOwl', 'Night Owl', 'Still awake at 2 AM.')
    }
  }

  private updateZone() {
    const s = store()
    const p = this.player.pos
    let zone: Zone | null = null
    for (const z of this.zones) {
      if (p.x >= z.x0 && p.x <= z.x1 && p.z >= z.z0 && p.z <= z.z1) {
        if (!zone || (z.x1 - z.x0) * (z.z1 - z.z0) < (zone.x1 - zone.x0) * (zone.z1 - zone.z0)) zone = z
      }
    }
    const name = zone?.name ?? 'Campus Grounds'
    if (name !== this.lastZone) {
      this.lastZone = name
      s.set({ zone: name, zoneVisible: true })
      window.setTimeout(() => store().set({ zoneVisible: false }), 3200)
      if (zone) {
        this.visitedZones.add(zone.id)
        if (zone.id !== 'wilds' && zone.id !== 'plaza') s.addXp(4)
        if (this.visitedZones.size >= 9) s.unlockAchievement('explorer', 'Cartographer', 'Visited every named zone on campus.')
      }
      if (!s.achievements.includes('firstSteps')) s.unlockAchievement('firstSteps', 'First Steps', 'Stepped onto campus.')
    }
  }

  private updateWeather(dt: number) {
    this.weatherTimer -= dt
    if (this.weatherTimer <= 0) {
      const r = Math.random()
      if (this.rainTarget < 0.2 && r > 0.55) {
        this.rainTarget = 0.65 + Math.random() * 0.35
        this.weatherTimer = 70 + Math.random() * 60
        store().set({ weather: 'rain' })
        store().pushToast({ kind: 'info', title: 'Rain on campus', body: 'The quad empties in seconds.', icon: '🌧️' })
      } else {
        this.rainTarget = 0
        this.weatherTimer = 120 + Math.random() * 120
        store().set({ weather: 'clear' })
      }
    }
    this.rainLevel += (this.rainTarget - this.rainLevel) * Math.min(1, dt * 0.35)
    this.fx.setRain(this.rainLevel)
    this.sky.overcast = this.rainLevel * 0.85
    audio.setRain(this.rainLevel)
    this.clockThunder -= dt
    if (this.rainLevel > 0.5 && this.clockThunder <= 0 && Math.random() < dt * 0.06) {
      audio.thunder()
      this.clockThunder = 6 + Math.random() * 12
    }
  }

  private updateBurst(dt: number) {
    if (this.breakBurst.count === 0) return
    const m = new THREE.Matrix4()
    let alive = 0
    const data = this.burstData
    for (let i = 0; i < data.length; i += 7) {
      if (data[i + 6] <= 0) continue
      data[i + 4] -= dt * 12
      data[i] += data[i + 3] * dt
      data[i + 1] += data[i + 4] * dt
      data[i + 2] += data[i + 5] * dt
      data[i + 6] -= dt * 1.6
      if (data[i + 6] <= 0) continue
      m.makeScale(data[i + 6], data[i + 6], data[i + 6])
      m.setPosition(data[i], data[i + 1], data[i + 2])
      this.breakBurst.setMatrixAt(alive, m)
      alive++
    }
    this.breakBurst.count = alive
    this.breakBurst.instanceMatrix.needsUpdate = true
  }

  private updateCamera(dt: number) {
    if (this.mode === 'orbit') {
      this.orbitAngle += dt * 0.045
      const r = 96
      const y = 58 + Math.sin(this.elapsed * 0.13) * 6
      this.camera.position.set(128 + Math.cos(this.orbitAngle) * r, y, 128 + Math.sin(this.orbitAngle) * r)
      const look = new THREE.Vector3(128, 18, 128)
      this.camera.lookAt(look)
      return
    }
    if (this.mode === 'cinematic' && this.cineCurve && this.cineLook) {
      this.cineT += dt
      const dur = 9.2
      const raw = Math.min(1, this.cineT / dur)
      const t = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2
      const pos = this.cineCurve.getPointAt(Math.min(0.999, t))
      const look = this.cineLook.getPointAt(Math.min(0.999, t))
      this.camera.position.copy(pos)
      this.camera.lookAt(look)
      this.sky.hours += dt * 0.16
      if (raw > 0.9 && !this.cineFaded) {
        this.cineFaded = true
        store().set({ fading: true, fadeLabel: 'HALCYON HALL · ROOM 214' })
      }
      if (raw >= 1) {
        this.beginPlay()
      }
      return
    }
    this.player.applyToCamera(this.camera)
  }

  private animate = (now: number) => {
    if (this.disposing) return
    requestAnimationFrame(this.animate)
    const dtRaw = (now - this.lastTime) / 1000
    this.lastTime = now
    const dt = Math.min(0.06, Math.max(0.0005, dtRaw))
    this.elapsed += dt
    if (!this.ready) {
      this.renderer.clear()
      return
    }

    const s = store()
    this.updateInput()
    const active = this.mode === 'player' || this.mode === 'photo'
    if (active) {
      if (!s.dialogue && !s.showJournal && !s.showBag && s.screen === 'playing') {
        this.player.update(dt, this.input, this.world)
      } else {
        this.player.update(dt, { forward: false, back: false, left: false, right: false, jump: false, sprint: false, crouch: false }, this.world)
      }
    }
    this.updateCamera(dt)

    // sky / time
    this.sky.update(dt, this.camera.position)
    this.sky.applyToVoxel(this.worldRenderer.uniforms)
    audio.setNight(this.sky.isNight)

    // loop fog based on view distance
    const u = this.worldRenderer.uniforms
    u.uFogNear.value = 70
    u.uFogFar.value = 220
    this.worldRenderer.update(this.elapsed)

    this.fx.update(dt, this.camera.position, this.sky.palette.night, this.sky.hours)
    this.updateWeather(dt)
    if (this.glowBook && this.glowBook.visible) {
      this.glowBook.position.y = this.glowBookY + Math.sin(this.elapsed * 2.2) * 0.12
      this.glowBook.rotation.y += dt * 0.8
    }

    // NPCs (only animate nearby ones)
    for (const npc of this.npcs) {
      const d = npc.distanceTo(this.camera.position)
      if (d < 70) {
        npc.group.visible = true
        npc.update(dt, this.world, this.player.pos, this.mode === 'player')
      } else npc.group.visible = false
    }

    this.updateObjective()
    this.updateBurst(dt)
    this.updateVitals(dt)

    // block targeting
    if (active && this.mode === 'player') {
      const hit = raycastVoxel(this.world, this.player.eyePos, this.player.forward, 6)
      this.targetBlock = hit
      if (hit) {
        this.highlight.visible = true
        this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5)
      } else this.highlight.visible = false
    } else {
      this.highlight.visible = false
      this.targetBlock = null
    }

    this.promptTimer += dt
    if (this.promptTimer > 0.12) {
      this.promptTimer = 0
      this.updatePrompts()
      this.updateZone()
      this.updateObjectiveStore()
    }

    this.storeTimer += dt
    if (this.storeTimer > 0.4) {
      this.storeTimer = 0
      this.fpsSamples.push(1 / dt)
      if (this.fpsSamples.length > 20) this.fpsSamples.shift()
      const avg = this.fpsSamples.reduce((a, b) => a + b, 0) / this.fpsSamples.length
      s.set({ fps: Math.round(avg), hours: this.sky.hours, day: this.sky.dayCount })
    }

    this.renderer.render(this.scene, this.camera)
    void this.soundStepCooldown
  }

  private updateObjectiveStore() {
    const s = store()
    const step = STORY[s.questStep]
    if (!step || !this.hasObjective) {
      if (s.objective !== null) s.set({ objective: null })
      return
    }
    const dx = this.objectiveTarget.x - this.player.pos.x
    const dz = this.objectiveTarget.z - this.player.pos.z
    const dist = Math.hypot(dx, dz)
    const bearing = Math.atan2(dx, -dz)
    const rel = ((bearing + this.player.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    s.set({ objective: { label: step.hint, x: this.objectiveTarget.x, z: this.objectiveTarget.z, bearing: rel, dist } })
  }

  // ---------------------------------------------------------------- helpers for UI
  getMap() {
    return this.mapCanvas
  }
  selectSlot(i: number) {
    this.selectedBlock = Math.max(0, Math.min(BUILDABLE.length - 1, i))
    store().set({ hotbar: this.selectedBlock })
  }
  getNpcSnapshot() {
    return this.npcs
      .filter((n) => n.group.visible)
      .map((n) => ({ x: n.group.position.x, z: n.group.position.z, name: n.def.name, role: n.def.role }))
  }
  getPlayerSnapshot() {
    return { x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z, yaw: this.player.yaw }
  }
  getPois() {
    return this.pois
  }
  teleport(x: number, y: number, z: number) {
    this.player.spawn(x, y, z, this.player.yaw)
  }
  toggleOverlay(kind: 'journal' | 'bag') {
    const s = store()
    const open = kind === 'journal' ? s.showJournal : s.showBag
    if (open) {
      s.set({ showJournal: false, showBag: false })
      audio.ui('close')
      this.resumePlay()
      return
    }
    this.ignoreUnlock = true
    document.exitPointerLock?.()
    s.set({ screen: 'playing', showJournal: kind === 'journal', showBag: kind === 'bag' })
    audio.ui('open')
  }
  openOverlay(kind: 'journal' | 'bag') {
    this.ignoreUnlock = true
    document.exitPointerLock?.()
    store().set({ screen: 'playing', showJournal: kind === 'journal', showBag: kind === 'bag' })
    audio.ui('open')
  }
  resumePlay() {
    store().set({ screen: 'playing' })
    this.mode = 'player'
    this.requestLock()
    audio.resume()
  }
  togglePhoto() {
    const s = store()
    if (s.screen === 'photo') {
      s.set({ screen: 'playing' })
      this.mode = 'player'
    } else {
      s.set({ screen: 'photo' })
      this.mode = 'photo'
    }
  }
  heal() {
    store().setVitals({ energy: 100, caffeine: 30 })
    store().pushToast({ kind: 'info', title: 'Coffee nap', body: 'Energy restored.', icon: '☕' })
  }
  buyItem(id: string, price: number) {
    const s = store()
    if (s.coins < price) return false
    s.addCoins(-price)
    s.addItem(id)
    audio.coinSound()
    return true
  }
  itemName(id: string) {
    return ITEMS[id]?.name ?? id
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export const gameRef: { current: Game | null } = { current: null }
