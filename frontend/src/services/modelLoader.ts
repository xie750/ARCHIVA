import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** The subset of the API manifest needed by the browser loader. */
export interface BrowserModelManifest {
  modelId?: string
  version?: string
  versionStatus?: string
  assetStatus?: string
  source?: string
  license?: string
  lod?: Array<{ level?: string; url: string; bytes?: number }>
  textures?: { format?: string; basePath?: string; variants?: { mobile?: string; desktop?: string; detail?: string } }
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
  /** Detail entry may explicitly request the manifest's high LOD. */
  preferDetail?: boolean
}

export interface LoadedModel {
  root: THREE.Group
  gltf: GLTF
  url: string
  lod: string
  dimensions: THREE.Vector3
  manifest?: BrowserModelManifest
}

const DEFAULT_DRACO_PATH = '/draco/'
const DEFAULT_KTX2_PATH = '/basis/'

function chooseLod(manifest: BrowserModelManifest, preferDetail = false): { url: string; level: string } | undefined {
  const assets = (manifest.lod ?? []).filter((asset) => Boolean(asset.url))
  if (!assets.length) return undefined
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  const lowBandwidth = Boolean(connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ''))
  const coarse = assets.find((asset) => asset.level === 'low') ?? assets[0]
  const medium = assets.find((asset) => asset.level === 'medium') ?? coarse
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  // The manifest's desktop variant is the authored quality/performance
  // contract. The previous memory-only heuristic selected the 980-mesh high
  // asset on ordinary desktop machines, making wheel zoom feel delayed even
  // though the file was small on disk. Keep high as an explicit detail
  // variant; the normal page uses the manifest's desktop (medium) asset.
  const variants = manifest.textures?.variants
  const desktop = assets.find((asset) => asset.level === variants?.desktop) ?? medium
  const detail = assets.find((asset) => asset.level === variants?.detail)
  // On a wide desktop viewport the visitor is usually looking at the model
  // full-screen, so prefer the authored detail LOD when it is available.
  // Keep low-memory and constrained connections on the smaller contract.
  const wideViewport = typeof window !== 'undefined' && window.innerWidth >= 1280
  const level = lowBandwidth || memory <= 2 ? coarse : preferDetail && detail ? detail : wideViewport && detail ? detail : desktop
  return { url: level.url, level: level.level ?? 'default' }
}

/**
 * Imported reconstruction models often contain one mesh per brick or frame.
 * Batch static meshes by material before the first frame so orbit/zoom stays
 * responsive. The root hierarchy is retained for future component metadata;
 * only leaf meshes are replaced with a small number of draw batches.
 */
function optimizeStaticMeshes(root: THREE.Object3D): void {
  root.updateMatrixWorld(true)
  const rootInverse = root.matrixWorld.clone().invert()
  type Bucket = { material: THREE.Material; geometries: THREE.BufferGeometry[]; meshes: THREE.Mesh[] }
  const buckets = new Map<string, Bucket>()
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.children.length > 0 || Array.isArray(object.material)) return
    if (object.morphTargetInfluences || (object as THREE.SkinnedMesh).isSkinnedMesh) return
    const material = object.material
    const attributes = Object.entries(object.geometry.attributes as Record<string, THREE.BufferAttribute>)
      .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.array.constructor.name}`)
      .sort()
      .join('|')
    const key = `${material.uuid}|${attributes}|${object.geometry.index ? 'indexed' : 'nonindexed'}`
    const bucket: Bucket = buckets.get(key) ?? { material, geometries: [], meshes: [] }
    const geometry = object.geometry.clone()
    const relativeMatrix = rootInverse.clone().multiply(object.matrixWorld)
    geometry.applyMatrix4(relativeMatrix)
    bucket.geometries.push(geometry)
    bucket.meshes.push(object)
    buckets.set(key, bucket)
  })

  for (const bucket of buckets.values()) {
    if (bucket.meshes.length < 8) {
      bucket.geometries.forEach((geometry) => geometry.dispose())
      continue
    }
    let merged: THREE.BufferGeometry | null = null
    try {
      merged = mergeGeometries(bucket.geometries, false)
    } catch {
      // Some third-party GLBs mix normalized attributes under one material;
      // leave those meshes untouched instead of failing the entire load.
    }
    bucket.geometries.forEach((geometry) => geometry.dispose())
    if (!merged) continue
    const batch = new THREE.Mesh(merged, bucket.material)
    batch.name = `Optimized_${bucket.material.name || bucket.material.uuid}`
    batch.castShadow = false
    batch.receiveShadow = true
    root.add(batch)
    bucket.meshes.forEach((mesh) => {
      mesh.parent?.remove(mesh)
      mesh.geometry.dispose()
    })
  }
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
  const selected = options.modelUrl ? { url: options.modelUrl, level: 'direct' } : manifest && chooseLod(manifest, options.preferDetail)
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
  optimizeStaticMeshes(root)
  const dimensions = normalizeModel(root)
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    // Shadowing every individual brick is expensive and causes orbit/zoom
    // stutter. Batches receive light and keep the main scene shadow instead.
    object.castShadow = !object.name.startsWith('Optimized_')
    object.receiveShadow = true
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    materials.forEach((material) => {
      if ('envMapIntensity' in material) (material as THREE.MeshStandardMaterial).envMapIntensity = 1.1
    })
  })
  return { root, gltf, url: selected.url, lod: selected.level, dimensions, manifest }
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
