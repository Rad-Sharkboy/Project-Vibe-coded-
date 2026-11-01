import * as THREE from 'three'
import { createAtlasTexture } from './atlas'
import { B, isTransparent } from './blocks'
import { buildChunkMesh, MeshData } from './mesher'
import { CHUNK, CHUNKS_X, CHUNKS_Z, VoxelWorld } from './world'
import { createVoxelMaterial, VoxelUniforms } from './voxelMaterial'

function geometryFrom(data: MeshData) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(data.position, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(data.normal, 3, true))
  g.setAttribute('uv', new THREE.BufferAttribute(data.uv, 2))
  g.setAttribute('aLight', new THREE.BufferAttribute(data.light, 3, true))
  g.setAttribute('aGlow', new THREE.BufferAttribute(data.glow, 3, true))
  g.setAttribute('aEmit', new THREE.BufferAttribute(data.emit, 1, true))
  g.setAttribute('aTile', new THREE.BufferAttribute(data.tile, 1, false))
  g.setIndex(new THREE.BufferAttribute(data.index, 1))
  g.computeBoundingSphere()
  g.computeBoundingBox()
  return g
}

export class WorldRenderer {
  world: VoxelWorld
  group = new THREE.Group()
  atlas: THREE.Texture
  opaqueMat: THREE.ShaderMaterial
  transMat: THREE.ShaderMaterial
  uniforms: VoxelUniforms
  private meshes = new Map<string, { opaque?: THREE.Mesh; trans?: THREE.Mesh }>()
  dirty = new Set<string>()

  constructor(world: VoxelWorld) {
    this.world = world
    this.group.name = 'world'
    this.atlas = createAtlasTexture()
    this.opaqueMat = createVoxelMaterial(this.atlas, false)
    this.transMat = createVoxelMaterial(this.atlas, true, true)
    this.uniforms = this.opaqueMat.uniforms as unknown as VoxelUniforms
  }

  private key(cx: number, cz: number) {
    return cx + ',' + cz
  }

  buildChunk(cx: number, cz: number) {
    const k = this.key(cx, cz)
    const existing = this.meshes.get(k)
    if (existing) {
      if (existing.opaque) {
        this.group.remove(existing.opaque)
        existing.opaque.geometry.dispose()
      }
      if (existing.trans) {
        this.group.remove(existing.trans)
        existing.trans.geometry.dispose()
      }
    }
    const ox = cx * CHUNK
    const oz = cz * CHUNK
    const { opaque, trans } = buildChunkMesh(this.world, ox, oz)
    const entry: { opaque?: THREE.Mesh; trans?: THREE.Mesh } = {}
    if (opaque) {
      const m = new THREE.Mesh(geometryFrom(opaque), this.opaqueMat)
      m.position.set(ox, 0, oz)
      m.matrixAutoUpdate = false
      m.updateMatrix()
      m.frustumCulled = true
      m.name = 'chunk-' + k
      this.group.add(m)
      entry.opaque = m
    }
    if (trans) {
      const m = new THREE.Mesh(geometryFrom(trans), this.transMat)
      m.position.set(ox, 0, oz)
      m.matrixAutoUpdate = false
      m.updateMatrix()
      m.renderOrder = 2
      m.frustumCulled = true
      this.group.add(m)
      entry.trans = m
    }
    this.meshes.set(k, entry)
  }

  /** generator so the loading screen can animate */
  *buildSteps() {
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        this.buildChunk(cx, cz)
        yield (cz * CHUNKS_X + cx + 1) / (CHUNKS_X * CHUNKS_Z)
      }
    }
  }

  rebuildAround(x: number, z: number) {
    const cx = Math.floor(x / CHUNK)
    const cz = Math.floor(z / CHUNK)
    const lx = x - cx * CHUNK
    const lz = z - cz * CHUNK
    const list: Array<[number, number]> = [[cx, cz]]
    if (lx === 0 && cx > 0) list.push([cx - 1, cz])
    if (lx === CHUNK - 1 && cx < CHUNKS_X - 1) list.push([cx + 1, cz])
    if (lz === 0 && cz > 0) list.push([cx, cz - 1])
    if (lz === CHUNK - 1 && cz < CHUNKS_Z - 1) list.push([cx, cz + 1])
    for (const [a, b] of list) this.buildChunk(a, b)
  }

  setBlock(x: number, y: number, z: number, blockId: number) {
    this.world.set(x, y, z, blockId)
    this.world.relight(x, y, z, 14)
    this.rebuildAround(x, z)
  }

  update(time: number) {
    this.uniforms.uTime.value = time
    ;(this.transMat.uniforms as unknown as VoxelUniforms).uTime.value = time
    // share the same lighting uniforms so both passes agree
    const t = this.transMat.uniforms as unknown as VoxelUniforms
    t.uSunDir.value.copy(this.uniforms.uSunDir.value)
    t.uSunColor.value.copy(this.uniforms.uSunColor.value)
    t.uAmbient.value.copy(this.uniforms.uAmbient.value)
    t.uGlowColor.value.copy(this.uniforms.uGlowColor.value)
    t.uFogColor.value.copy(this.uniforms.uFogColor.value)
    t.uFogNear.value = this.uniforms.uFogNear.value
    t.uFogFar.value = this.uniforms.uFogFar.value
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.geometry) m.geometry.dispose()
    })
    this.atlas.dispose()
    this.opaqueMat.dispose()
    this.transMat.dispose()
    this.group.clear()
  }
}

/** used by the minimap to sample colors */
export function minimapColor(id: number) {
  switch (id) {
    case 0:
      return 'transparent'
    case B.WATER:
      return '#2f7fc4'
    case B.ASPHALT:
      return '#43464e'
    case B.PAVER:
      return '#c9c3b6'
    case B.PAVEMENT:
      return '#cfc9bd'
    case B.GRASS:
      return '#5a9a46'
    case B.GRASS_DARK:
      return '#4d8a3c'
    case B.GRASS_DRY:
      return '#8a9a52'
    case B.FLOWER:
    case B.FLOWER_YELLOW:
      return '#72ae53'
    case B.SAND:
      return '#d8c89e'
    case B.GRAVEL:
      return '#9a948a'
    case B.DIRT_PATH:
      return '#b09a72'
    case B.DIRT:
      return '#8a6a4a'
    case B.LEAVES:
    case B.BUSH:
    case B.HEDGE:
      return '#386b33'
    case B.BRICK:
      return '#a3543f'
    case B.BRICK_CREAM:
      return '#cdb894'
    case B.CONCRETE:
      return '#c3beb0'
    case B.CONCRETE_DARK:
      return '#8b8984'
    case B.STONE:
      return '#9a9a9a'
    case B.STONE_BRICK:
      return '#a8a49a'
    case B.STONE_DARK:
      return '#6a6a6a'
    case B.ROOF:
      return '#5c616e'
    case B.METAL:
      return '#a8adb6'
    case B.PLANK:
      return '#a37c4e'
    case B.WOOD_DARK:
      return '#6a4a2e'
    case B.WOOD_FLOOR:
      return '#a8814f'
    case B.LOG:
      return '#7a5535'
    case B.GYM_FLOOR:
      return '#c99a5c'
    case B.TILE_WHITE:
      return '#dcdcdc'
    case B.CARPET_RED:
      return '#8f3b3b'
    case B.CARPET_BLUE:
      return '#33507f'
    case B.GLASS:
      return '#bcd8e8'
    case B.LAMP:
      return '#ffe9a8'
    case B.NEON_PINK:
      return '#ff4fb0'
    case B.NEON_CYAN:
      return '#4fe0ff'
    case B.NEON_GREEN:
      return '#6cff9a'
    case B.NEON_AMBER:
      return '#ffbe5a'
  }
  return '#8f8f8f'
}

export function isWater(id: number) {
  return isTransparent(id) && id === B.WATER
}
