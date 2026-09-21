import * as THREE from 'three'

export interface HeritageMaterialOptions {
  /** Size of generated maps. 96 is enough for a close browser view and keeps memory low. */
  textureSize?: number
  /** Scales the generated normal map's micro relief. */
  normalStrength?: number
  /** Force the treatment even when the source material already has a base-color map. */
  replaceExistingMap?: boolean
}

type MaterialKind = 'terracotta' | 'stone' | 'wood' | 'metal' | 'dark'

type MaterialTextures = {
  color: THREE.DataTexture
  roughness: THREE.DataTexture
  normal: THREE.DataTexture
}

const textureCache = new Map<string, MaterialTextures>()

function hashNoise(x: number, y: number, seed: number): number {
  const value = Math.sin((x * 127.1 + y * 311.7 + seed * 74.7)) * 43758.5453
  return value - Math.floor(value)
}

function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const tx = x - x0
  const ty = y - y0
  const smoothX = tx * tx * (3 - 2 * tx)
  const smoothY = ty * ty * (3 - 2 * ty)
  const a = hashNoise(x0, y0, seed)
  const b = hashNoise(x0 + 1, y0, seed)
  const c = hashNoise(x0, y0 + 1, seed)
  const d = hashNoise(x0 + 1, y0 + 1, seed)
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, smoothX), THREE.MathUtils.lerp(c, d, smoothX), smoothY)
}

function materialKind(color: THREE.Color, name: string): MaterialKind {
  const hsl = { h: 0, s: 0, l: 0 }
  color.getHSL(hsl)
  const label = name.toLowerCase()
  if (label.includes('gold') || label.includes('metal') || label.includes('finial')) return 'metal'
  if (label.includes('dark') || label.includes('roof') || hsl.l < 0.2) return 'dark'
  if (hsl.h < 0.08 || hsl.h > 0.94) return 'terracotta'
  if (hsl.s < 0.18 && hsl.l < 0.58) return 'stone'
  return 'terracotta'
}

function colorKey(color: THREE.Color): string {
  return [color.r, color.g, color.b].map((value) => Math.round(value * 255)).join(',')
}

function makeTextures(base: THREE.Color, kind: MaterialKind, size: number, normalStrength: number): MaterialTextures {
  const seed = ({ terracotta: 13, stone: 29, wood: 47, metal: 71, dark: 89 } satisfies Record<MaterialKind, number>)[kind]
  const key = `${colorKey(base)}|${kind}|${size}|${normalStrength}`
  const existing = textureCache.get(key)
  if (existing) return existing

  const colorData = new Uint8Array(size * size * 4)
  const roughnessData = new Uint8Array(size * size * 4)
  const normalData = new Uint8Array(size * size * 4)
  const srgbBase = [base.r, base.g, base.b].map((value) => Math.round(THREE.MathUtils.clamp(value, 0, 1) * 255))
  const relief = (u: number, v: number) => {
    const broad = valueNoise(u * 5.5, v * 5.5, seed)
    const fine = valueNoise(u * 22, v * 22, seed + 1)
    // Low-frequency staining plus fine grain produces readable variation without
    // the tiled checkerboard look of a single flat color.
    return THREE.MathUtils.clamp(broad * 0.72 + fine * 0.28, 0, 1)
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = (y * size + x) * 4
      const u = x / size
      const v = y / size
      const noise = relief(u, v)
      const weathering = (noise - 0.5) * (kind === 'metal' ? 0.12 : 0.22)
      const stain = kind === 'terracotta' ? (valueNoise(u * 2.8, v * 2.8, seed + 8) - 0.5) * 0.08 : 0
      colorData[index] = Math.round(THREE.MathUtils.clamp(srgbBase[0] * (1 + weathering + stain), 0, 255))
      colorData[index + 1] = Math.round(THREE.MathUtils.clamp(srgbBase[1] * (1 + weathering + stain), 0, 255))
      colorData[index + 2] = Math.round(THREE.MathUtils.clamp(srgbBase[2] * (1 + weathering + stain), 0, 255))
      const roughness = kind === 'metal' ? 0.34 + noise * 0.2 : kind === 'dark' ? 0.62 + noise * 0.22 : 0.58 + noise * 0.3
      const roughnessByte = Math.round(THREE.MathUtils.clamp(roughness, 0, 1) * 255)
      roughnessData[index] = roughnessByte
      roughnessData[index + 1] = roughnessByte
      roughnessData[index + 2] = roughnessByte
      roughnessData[index + 3] = 255
      const left = relief((x - 1) / size, v)
      const right = relief((x + 1) / size, v)
      const down = relief(u, (y - 1) / size)
      const up = relief(u, (y + 1) / size)
      const nx = THREE.MathUtils.clamp((left - right) * normalStrength * 255 + 128, 0, 255)
      const ny = THREE.MathUtils.clamp((down - up) * normalStrength * 255 + 128, 0, 255)
      normalData[index] = Math.round(nx)
      normalData[index + 1] = Math.round(ny)
      normalData[index + 2] = 255
      normalData[index + 3] = 255
      colorData[index + 3] = 255
    }
  }

  const color = new THREE.DataTexture(colorData, size, size, THREE.RGBAFormat)
  color.colorSpace = THREE.SRGBColorSpace
  color.wrapS = THREE.RepeatWrapping
  color.wrapT = THREE.RepeatWrapping
  color.repeat.set(2.5, 2.5)
  color.anisotropy = 4
  color.needsUpdate = true
  const roughness = new THREE.DataTexture(roughnessData, size, size, THREE.RGBAFormat)
  roughness.wrapS = THREE.RepeatWrapping
  roughness.wrapT = THREE.RepeatWrapping
  roughness.repeat.set(2.5, 2.5)
  roughness.needsUpdate = true
  const normal = new THREE.DataTexture(normalData, size, size, THREE.RGBAFormat)
  normal.wrapS = THREE.RepeatWrapping
  normal.wrapT = THREE.RepeatWrapping
  normal.repeat.set(2.5, 2.5)
  normal.needsUpdate = true
  const textures = { color, roughness, normal }
  textureCache.set(key, textures)
  return textures
}

/**
 * Adds a lightweight, deterministic PBR treatment to imported heritage models
 * that do not contain authored image textures. Existing image maps are kept by
 * default so an eventual scanned asset can pass through unchanged.
 */
export function applyProceduralHeritageMaterials(root: THREE.Object3D, options: HeritageMaterialOptions = {}): void {
  const size = Math.max(32, Math.min(192, Math.round(options.textureSize ?? 96)))
  const normalStrength = Math.max(0.02, Math.min(0.35, options.normalStrength ?? 0.12))
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    const sourceMaterials = Array.isArray(object.material) ? object.material : [object.material]
    const enhanced = sourceMaterials.map((source) => {
      if (!(source instanceof THREE.MeshStandardMaterial || source instanceof THREE.MeshPhysicalMaterial)) return source
      if (source.map && !options.replaceExistingMap) {
        source.envMapIntensity = Math.max(source.envMapIntensity ?? 1, 1.15)
        return source
      }
      const material = source.clone()
      const base = source.color?.clone() ?? new THREE.Color('#9b7652')
      const kind = materialKind(base, `${source.name} ${object.name}`)
      const maps = makeTextures(base, kind, size, normalStrength)
      material.color.set(0xffffff)
      material.map = maps.color
      material.roughnessMap = maps.roughness
      material.normalMap = maps.normal
      material.normalScale.set(kind === 'metal' ? 0.16 : 0.38, kind === 'metal' ? 0.16 : 0.38)
      material.roughness = kind === 'metal' ? 0.42 : kind === 'dark' ? 0.72 : 0.68
      material.metalness = kind === 'metal' ? Math.max(source.metalness, 0.46) : Math.min(source.metalness, 0.12)
      material.envMapIntensity = 1.35
      material.needsUpdate = true
      return material
    })
    object.material = Array.isArray(object.material) ? enhanced : enhanced[0]
  })
}

/** Dispose generated maps when a viewer is torn down. */
export function disposeProceduralMaterialCache(): void {
  textureCache.forEach((textures) => Object.values(textures).forEach((texture) => texture.dispose()))
  textureCache.clear()
}
