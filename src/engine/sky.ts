import * as THREE from 'three'
import { clamp01, lerp, smoothstep } from './noise'

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const skyFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uGround;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform vec3 uCloudLight;
  uniform vec3 uCloudDark;
  uniform float uNight;
  uniform float uTime;
  uniform float uOvercast;
  varying vec3 vDir;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(clamp(up, 0.0, 1.0), 0.62));
    if (up < 0.0) {
      col = mix(uHorizon, uGround, clamp(-up * 2.2, 0.0, 1.0));
    }

    // --- clouds ---
    if (up > 0.005) {
      vec2 cuv = dir.xz / (up + 0.28) * 0.85;
      cuv += vec2(uTime * 0.004, uTime * 0.0022);
      float c = fbm(cuv * 1.35 + 12.0);
      float c2 = fbm(cuv * 3.4 - 5.0);
      c = c * 0.75 + c2 * 0.25;
      float cover = mix(0.54, 0.34, uOvercast);
      float cloud = smoothstep(cover, cover + 0.22, c) * smoothstep(0.0, 0.14, up);
      float lit = smoothstep(0.35, 0.85, c);
      vec3 cloudCol = mix(uCloudDark, uCloudLight, lit);
      cloudCol += uSunColor * pow(max(dot(dir, uSunDir), 0.0), 3.0) * 0.35;
      col = mix(col, cloudCol, cloud * mix(0.92, 1.0, uOvercast));
    }

    // --- sun disc + glow ---
    float sd = max(dot(dir, uSunDir), 0.0);
    float daylight = smoothstep(-0.12, 0.12, uSunDir.y);
    col += uSunColor * pow(sd, 900.0) * 6.0 * daylight;
    col += uSunColor * pow(sd, 20.0) * 0.16 * daylight;
    col += uSunColor * pow(sd, 4.0) * 0.06 * daylight;

    // --- moon ---
    vec3 moonDir = -uSunDir;
    float md = max(dot(dir, moonDir), 0.0);
    col += vec3(0.93, 0.95, 1.0) * smoothstep(0.9992, 0.99965, md) * 2.4 * uNight;
    col += vec3(0.55, 0.65, 0.95) * pow(md, 60.0) * 0.35 * uNight;

    // --- stars ---
    if (uNight > 0.01) {
      vec3 p = floor(dir * 260.0);
      float h = hash21(p.xz + p.y * 31.7);
      float star = smoothstep(0.9972, 1.0, h);
      float twinkle = 0.55 + 0.45 * sin(uTime * 2.2 + h * 60.0);
      col += vec3(0.85, 0.9, 1.0) * star * twinkle * uNight * (1.0 - uOvercast * 0.85);
      // milky way shimmer
      float band = smoothstep(0.35, 0.0, abs(dir.y - dir.x * 0.45));
      col += vec3(0.11, 0.12, 0.22) * band * uNight * 0.35;
    }

    gl_FragColor = vec4(col, 1.0);
  }
`

export type Palette = {
  zenith: THREE.Color
  horizon: THREE.Color
  ground: THREE.Color
  sunColor: THREE.Color
  ambient: THREE.Color
  cloudLight: THREE.Color
  cloudDark: THREE.Color
  night: number
  daylight: number
  fog: THREE.Color
}

function mixColor(a: THREE.Color, b: THREE.Color, t: number, out: THREE.Color) {
  out.setRGB(lerp(a.r, b.r, t), lerp(a.g, b.g, t), lerp(a.b, b.b, t))
  return out
}

const P = {
  night: {
    zenith: new THREE.Color(0.028, 0.042, 0.095),
    horizon: new THREE.Color(0.075, 0.095, 0.175),
    ground: new THREE.Color(0.02, 0.025, 0.04),
    sunColor: new THREE.Color(0.16, 0.19, 0.32),
    ambient: new THREE.Color(0.2, 0.23, 0.36),
    cloudLight: new THREE.Color(0.12, 0.14, 0.22),
    cloudDark: new THREE.Color(0.04, 0.05, 0.1),
    fog: new THREE.Color(0.06, 0.08, 0.14),
  },
  dawn: {
    zenith: new THREE.Color(0.16, 0.29, 0.6),
    horizon: new THREE.Color(1.0, 0.68, 0.48),
    ground: new THREE.Color(0.22, 0.16, 0.16),
    sunColor: new THREE.Color(1.0, 0.62, 0.38),
    ambient: new THREE.Color(0.46, 0.43, 0.5),
    cloudLight: new THREE.Color(1.0, 0.82, 0.72),
    cloudDark: new THREE.Color(0.44, 0.36, 0.48),
    fog: new THREE.Color(0.78, 0.62, 0.58),
  },
  dusk: {
    zenith: new THREE.Color(0.12, 0.17, 0.42),
    horizon: new THREE.Color(1.0, 0.44, 0.3),
    ground: new THREE.Color(0.16, 0.1, 0.12),
    sunColor: new THREE.Color(1.0, 0.45, 0.24),
    ambient: new THREE.Color(0.38, 0.31, 0.42),
    cloudLight: new THREE.Color(1.0, 0.63, 0.5),
    cloudDark: new THREE.Color(0.32, 0.24, 0.36),
    fog: new THREE.Color(0.6, 0.42, 0.42),
  },
  day: {
    zenith: new THREE.Color(0.145, 0.36, 0.78),
    horizon: new THREE.Color(0.62, 0.79, 0.95),
    ground: new THREE.Color(0.34, 0.36, 0.38),
    sunColor: new THREE.Color(1.0, 0.94, 0.82),
    ambient: new THREE.Color(0.55, 0.61, 0.72),
    cloudLight: new THREE.Color(1.0, 1.0, 1.0),
    cloudDark: new THREE.Color(0.6, 0.66, 0.78),
    fog: new THREE.Color(0.68, 0.8, 0.94),
  },
}

function clonePalette(src: typeof P.day): Palette {
  return {
    zenith: src.zenith.clone(),
    horizon: src.horizon.clone(),
    ground: src.ground.clone(),
    sunColor: src.sunColor.clone(),
    ambient: src.ambient.clone(),
    cloudLight: src.cloudLight.clone(),
    cloudDark: src.cloudDark.clone(),
    fog: src.fog.clone(),
    night: 0,
    daylight: 1,
  }
}

export class SkySystem {
  mesh: THREE.Mesh
  uniforms: Record<string, THREE.IUniform>
  sun = new THREE.DirectionalLight(0xffffff, 2)
  hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a6b4a, 0.6)
  fill = new THREE.AmbientLight(0xffffff, 0.15)
  hours = 8.2
  dayCount = 1
  /** real seconds for a full day */
  dayLength = 900
  palette: Palette = clonePalette(P.day)
  sunDir = new THREE.Vector3()
  private tmp = new THREE.Color()
  private tmp2 = new THREE.Color()
  overcast = 0

  constructor(scene: THREE.Scene) {
    this.uniforms = {
      uZenith: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uGround: { value: new THREE.Color() },
      uSunColor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uCloudLight: { value: new THREE.Color() },
      uCloudDark: { value: new THREE.Color() },
      uNight: { value: 0 },
      uTime: { value: 0 },
      uOvercast: { value: 0 },
    }
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: skyVert,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 32, 20), mat)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1000
    scene.add(this.mesh)

    scene.add(this.sun)
    scene.add(this.sun.target)
    scene.add(this.hemi)
    scene.add(this.fill)
    this.sun.castShadow = false
    this.update(0.016, new THREE.Vector3())
  }

  setTime(hours: number) {
    this.hours = ((hours % 24) + 24) % 24
  }

  get isNight() {
    return this.sunDir.y < 0.02
  }

  update(dt: number, cameraPos: THREE.Vector3) {
    this.hours += (dt / this.dayLength) * 24
    if (this.hours >= 24) {
      this.hours -= 24
      this.dayCount++
    }
    const h = this.hours
    const t = ((h - 6) / 12) * Math.PI
    this.sunDir.set(Math.cos(t), Math.sin(t), 0.32).normalize()
    const e = this.sunDir.y

    const pal = this.palette
    const dawnSide = Math.cos(t) > 0
    const golden = dawnSide ? P.dawn : P.dusk
    if (e < -0.02) {
      const k = smoothstep(-0.26, -0.02, e)
      mixColor(P.night.zenith, golden.zenith, k, pal.zenith)
      mixColor(P.night.horizon, golden.horizon, k, pal.horizon)
      mixColor(P.night.ground, golden.ground, k, pal.ground)
      mixColor(P.night.sunColor, golden.sunColor, k, pal.sunColor)
      mixColor(P.night.ambient, golden.ambient, k, pal.ambient)
      mixColor(P.night.cloudLight, golden.cloudLight, k, pal.cloudLight)
      mixColor(P.night.cloudDark, golden.cloudDark, k, pal.cloudDark)
      mixColor(P.night.fog, golden.fog, k, pal.fog)
    } else if (e < 0.34) {
      const k = smoothstep(-0.02, 0.34, e)
      mixColor(golden.zenith, P.day.zenith, k, pal.zenith)
      mixColor(golden.horizon, P.day.horizon, k, pal.horizon)
      mixColor(golden.ground, P.day.ground, k, pal.ground)
      mixColor(golden.sunColor, P.day.sunColor, k, pal.sunColor)
      mixColor(golden.ambient, P.day.ambient, k, pal.ambient)
      mixColor(golden.cloudLight, P.day.cloudLight, k, pal.cloudLight)
      mixColor(golden.cloudDark, P.day.cloudDark, k, pal.cloudDark)
      mixColor(golden.fog, P.day.fog, k, pal.fog)
    } else {
      pal.zenith.copy(P.day.zenith)
      pal.horizon.copy(P.day.horizon)
      pal.ground.copy(P.day.ground)
      pal.sunColor.copy(P.day.sunColor)
      pal.ambient.copy(P.day.ambient)
      pal.cloudLight.copy(P.day.cloudLight)
      pal.cloudDark.copy(P.day.cloudDark)
      pal.fog.copy(P.day.fog)
    }
    pal.night = clamp01(1 - smoothstep(-0.16, 0.08, e))
    pal.daylight = clamp01(smoothstep(-0.1, 0.16, e))

    // overcast from weather
    const oc = this.overcast
    if (oc > 0) {
      pal.zenith.lerp(this.tmp.setRGB(0.24, 0.28, 0.34).multiplyScalar(0.4 + 0.6 * pal.daylight), oc * 0.8)
      pal.horizon.lerp(this.tmp.setRGB(0.44, 0.47, 0.52).multiplyScalar(0.35 + 0.65 * pal.daylight), oc * 0.75)
      pal.ambient.lerp(this.tmp.setRGB(0.34, 0.37, 0.42).multiplyScalar(0.4 + 0.6 * pal.daylight), oc * 0.6)
      pal.fog.lerp(pal.horizon, oc * 0.5)
    }

    const u = this.uniforms
    ;(u.uZenith.value as THREE.Color).copy(pal.zenith)
    ;(u.uHorizon.value as THREE.Color).copy(pal.horizon)
    ;(u.uGround.value as THREE.Color).copy(pal.ground)
    ;(u.uSunColor.value as THREE.Color).copy(pal.sunColor)
    ;(u.uCloudLight.value as THREE.Color).copy(pal.cloudLight)
    ;(u.uCloudDark.value as THREE.Color).copy(pal.cloudDark)
    ;(u.uSunDir.value as THREE.Vector3).copy(this.sunDir)
    u.uNight.value = pal.night
    u.uOvercast.value = oc
    u.uTime.value += dt

    this.mesh.position.copy(cameraPos)

    // scene lights (for NPCs / props)
    this.sun.target.position.copy(cameraPos)
    this.sun.target.updateMatrixWorld()
    this.sun.position.copy(this.sunDir).multiplyScalar(80).add(cameraPos)
    this.sun.color.copy(pal.sunColor)
    this.sun.intensity = 1.5 * pal.daylight * (1 - oc * 0.6)
    this.hemi.color.copy(this.tmp.copy(pal.zenith).lerp(pal.horizon, 0.5))
    this.hemi.groundColor.copy(pal.ground)
    this.hemi.intensity = 1.15 * (0.35 + 0.65 * pal.daylight)
    this.fill.color.copy(pal.ambient)
    this.fill.intensity = 0.5
    void this.tmp2
  }

  /** colors + intensities for the voxel shader */
  applyToVoxel(u: {
    uSunDir: { value: THREE.Vector3 }
    uSunColor: { value: THREE.Color }
    uAmbient: { value: THREE.Color }
    uFogColor: { value: THREE.Color }
  }) {
    u.uSunDir.value.copy(this.sunDir)
    const sunI = this.palette.daylight * (1 - this.overcast * 0.55)
    u.uSunColor.value.copy(this.palette.sunColor).multiplyScalar(0.95 * sunI + 0.06)
    u.uAmbient.value.copy(this.palette.ambient)
    // night is a bit darker but never pitch black
    if (this.palette.night > 0) {
      u.uAmbient.value.lerp(this.tmp.setRGB(0.3, 0.34, 0.52), this.palette.night * 0.85)
    }
    u.uFogColor.value.copy(this.palette.fog)
  }
}
