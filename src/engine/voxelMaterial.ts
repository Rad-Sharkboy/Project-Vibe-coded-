import * as THREE from 'three'

const vertexShader = /* glsl */ `
  attribute vec3 aLight;
  attribute vec3 aGlow;
  attribute float aEmit;
  attribute float aTile;

  varying vec2 vUv;
  varying float vTile;
  varying vec3 vLight;
  varying vec3 vGlow;
  varying float vEmit;
  varying vec3 vN;
  varying float vDepth;
  varying vec3 vWorld;

  void main() {
    vUv = uv;
    vTile = aTile;
    vLight = aLight;
    vGlow = aGlow;
    vEmit = aEmit;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uAtlas;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform vec3 uGlowColor;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uTime;
  uniform float uWave;

  varying vec2 vUv;
  varying float vTile;
  varying vec3 vLight;
  varying vec3 vGlow;
  varying float vEmit;
  varying vec3 vN;
  varying float vDepth;
  varying vec3 vWorld;

  vec2 tileUV(vec2 t, float tile) {
    float size = 1.0 / 16.0;
    float tx = mod(tile, 16.0);
    float ty = floor(tile / 16.0 + 0.001);
    vec2 f = fract(t);
    f = clamp(f, 0.0018, 0.9982);
    float u0 = tx * size;
    float v1 = 1.0 - ty * size;
    return vec2(u0 + f.x * size, v1 - f.y * size);
  }

  void main() {
    vec2 t = vUv;
    if (uWave > 0.5) {
      t += vec2(sin(vWorld.x * 0.6 + uTime * 0.9) * 0.06, cos(vWorld.z * 0.5 + uTime * 0.7) * 0.06);
    }
    vec4 tex = texture2D(uAtlas, tileUV(t, vTile));
    if (tex.a < 0.06) discard;

    vec3 n = normalize(vN);
    float diff = max(dot(n, uSunDir), 0.0);
    // soft wrap so shadowed faces don't go pitch black
    float wrap = clamp(dot(n, uSunDir) * 0.5 + 0.5, 0.0, 1.0);
    float skyI = vLight.g;

    vec3 ambient = uAmbient * (0.26 + 0.62 * skyI);
    vec3 sun = uSunColor * (diff * 0.70 + wrap * 0.15) * mix(0.30, 1.0, skyI);
    vec3 glow = vGlow * uGlowColor;

    // subtle vertical ambient gradient (bounce light from ground)
    float bounce = clamp(0.5 - n.y * 0.5, 0.0, 1.0) * 0.05 * skyI;

    vec3 col = tex.rgb * (ambient + sun + glow + bounce);
    col += tex.rgb * vEmit * 0.85;

    // fog
    float fogF = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, uFogColor, fogF);

    // very subtle dithering to kill banding
    float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (dither - 0.5) * 0.006;

    gl_FragColor = vec4(col, tex.a);
  }
`

export type VoxelUniforms = {
  uAtlas: { value: THREE.Texture }
  uSunDir: { value: THREE.Vector3 }
  uSunColor: { value: THREE.Color }
  uAmbient: { value: THREE.Color }
  uGlowColor: { value: THREE.Color }
  uFogColor: { value: THREE.Color }
  uFogNear: { value: number }
  uFogFar: { value: number }
  uTime: { value: number }
  uWave: { value: number }
}

export function createVoxelMaterial(atlas: THREE.Texture, transparent: boolean, wave = false): THREE.ShaderMaterial {
  const uniforms: VoxelUniforms = {
    uAtlas: { value: atlas },
    uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() },
    uSunColor: { value: new THREE.Color(0.85, 0.74, 0.58) },
    uAmbient: { value: new THREE.Color(0.55, 0.58, 0.65) },
    uGlowColor: { value: new THREE.Color(1.0, 0.78, 0.52) },
    uFogColor: { value: new THREE.Color(0.62, 0.75, 0.9) },
    uFogNear: { value: 60 },
    uFogFar: { value: 170 },
    uTime: { value: 0 },
    uWave: { value: wave ? 1 : 0 },
  }
  const mat = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader,
    fragmentShader,
    transparent,
    depthWrite: !transparent,
    side: THREE.FrontSide,
  })
  if (transparent) {
    mat.blending = THREE.NormalBlending
    mat.depthWrite = false
  }
  mat.name = transparent ? 'voxel-transparent' : 'voxel-opaque'
  return mat
}
