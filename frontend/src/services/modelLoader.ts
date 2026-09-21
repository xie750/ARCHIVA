import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** The subset of the API manifest needed by the browser loader. */
export interface BrowserModelManifest {
  modelId?: string
  version?: string
  lod?: Array<{ level?: string; url: string; bytes?: number }>
  textures?: { format?: string; basePath?: string }
  defaultCamera?: { position?: number[]; target?: number[]; fov?: number }
}

export interface ModelLoadOptions {
  renderer: THREE.WebGLRenderer
  manifest?: BrowserModelManifest
  /** A manifest endpoint can be supplied by the Java API when the page has no manifest yet. */
  manifestUrl?: string
  /** Direct URL is useful for a single reviewed GLB or a local fixture. */
  modelUrl?: string
  dracoDecoderPath?: string
  ktx2TranscoderPath?: string
  signal?: AbortSignal
  onProgress?: (progress: number) => void
}

export interface LoadedModel {
  root: THREE.Group
  gltf: GLTF
  url: string
  lod: string
  dimensions: THREE.Vector3
}

const DEFAULT_DRACO_PATH = '/draco/'
const DEFAULT_KTX2_PATH = '/basis/'

function chooseLod(manifest: BrowserModelManifest): { url: string; level: string } | undefined {
  const assets = (manifest.lod ?? []).filter((asset) => Boolean(asset.url))
  if (!assets.length) return undefined
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const lowBandwidth = Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ''))
  const coarse = assets.find((asset) => asset.level === 'low') ?? assets[0]
  const medium = assets.find((asset) => asset.level === 'medium') ?? coarse
  const high = assets.find((asset) => asset.level === 'high') ?? medium
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  const level = lowBandwidth || memory <= 2 ? coarse : memory <= 4 ? medium : high
  return { url: level.url, level: level.level ?? 'default' }
}

async function resolveManifest(options: ModelLoadOptions): Promise<BrowserModelManifest | undefined> {
  if (options.manifest) return options.manifest
  if (!options.manifestUrl) return undefined
  const response = await fetch(options.manifestUrl, { signal: options.signal })
  if (!response.ok) throw new Error(`模型清单请求失败：${response.status}`)
  return response.json() as Promise<BrowserModelManifest>
}

/** Load a reviewed glTF/GLB asset. Returns undefined when no asset URL was configured. */
export async function loadModelAsset(options: ModelLoadOptions): Promise<LoadedModel | undefined> {
  const manifest = await resolveManifest(options)
  const selected = options.modelUrl ? { url: options.modelUrl, level: 'direct' } : manifest && chooseLod(manifest)
  if (!selected) return undefined
  if (options.signal?.aborted) return undefined

  const loader = new GLTFLoader()
  const draco = new DRACOLoader()
  draco.setDecoderPath(options.dracoDecoderPath ?? DEFAULT_DRACO_PATH)
  loader.setDRACOLoader(draco)

  // KTX2 is optional: a missing Basis transcoder must not prevent a valid GLB from opening.
  let ktx2: KTX2Loader | undefined
  if (manifest?.textures?.format?.toUpperCase() === 'KTX2' || options.ktx2TranscoderPath) {
    try {
      ktx2 = new KTX2Loader().setTranscoderPath(options.ktx2TranscoderPath ?? DEFAULT_KTX2_PATH)
      ktx2.detectSupport(options.renderer)
      loader.setKTX2Loader(ktx2)
    } catch {
      ktx2?.dispose()
      ktx2 = undefined
    }
  }

  let gltf: GLTF
  try {
    gltf = await new Promise<GLTF>((resolve, reject) => {
      loader.load(selected.url, resolve, (event) => {
        if (event.total > 0) options.onProgress?.(Math.min(1, event.loaded / event.total))
      }, reject)
    })
  } finally {
    draco.dispose()
    ktx2?.dispose()
  }
  if (options.signal?.aborted) {
    disposeObject3D(gltf?.scene)
    return undefined
  }

  const root = gltf.scene
  const dimensions = normalizeModel(root)
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = true
    object.receiveShadow = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if ('envMapIntensity' in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 1.1
    })
  })
  return { root, gltf, url: selected.url, lod: selected.level, dimensions }
}

/** Fit an imported model to the viewer's world and put its lowest point on groundY. */
export function normalizeModel(root: THREE.Object3D, targetSize = 9, groundY = 0): THREE.Vector3 {
  root.updateMatrixWorld(true)
  const before = new THREE.Box3().setFromObject(root)
  const size = before.getSize(new THREE.Vector3())
  const maxDimension = Math.max(size.x, size.y, size.z)
  if (maxDimension > 0) root.scale.multiplyScalar(targetSize / maxDimension)
  root.updateMatrixWorld(true)
  const fitted = new THREE.Box3().setFromObject(root)
  const center = fitted.getCenter(new THREE.Vector3())
  root.position.x -= center.x
  root.position.z -= center.z
  root.position.y += groundY - fitted.min.y
  root.updateMatrixWorld(true)
  return new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3())
}

/** Dispose geometries, material maps and the object hierarchy (including late async loads). */
export function disposeObject3D(object?: THREE.Object3D): void {
  if (!object) return
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points)) return
    child.geometry.dispose()
    const materials = Array.isArray(child.material) ? child.material : [child.material]
    materials.forEach((material) => {
      for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'alphaMap']) {
        const texture = (material as unknown as Record<string, unknown>)[key]
        if (texture && texture instanceof THREE.Texture) texture.dispose()
      }
      material.dispose()
    })
  })
}
