import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import ts from 'typescript'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
}

const tmpDir = resolve('scripts/.tmp-catalog-data')
const outputRoot = resolve('public/models/catalog-generated')

const mat = {
  stone: new THREE.MeshStandardMaterial({ color: 0xb9ad96, roughness: 0.84, name: 'warm stone masonry' }),
  stoneDark: new THREE.MeshStandardMaterial({ color: 0x746b5c, roughness: 0.88, name: 'weathered stone shadow' }),
  brick: new THREE.MeshStandardMaterial({ color: 0xa95a3e, roughness: 0.76, name: 'aged brick surface' }),
  plaster: new THREE.MeshStandardMaterial({ color: 0xd8cbb4, roughness: 0.78, name: 'lime plaster wall' }),
  timber: new THREE.MeshStandardMaterial({ color: 0x79482f, roughness: 0.72, name: 'painted timber frame' }),
  timberDark: new THREE.MeshStandardMaterial({ color: 0x34251f, roughness: 0.86, name: 'dark timber reveal' }),
  roof: new THREE.MeshStandardMaterial({ color: 0x2f554d, roughness: 0.74, metalness: 0.04, name: 'green gray tiled roof' }),
  roofGold: new THREE.MeshStandardMaterial({ color: 0xd5a844, roughness: 0.48, metalness: 0.12, name: 'glazed golden roof' }),
  metal: new THREE.MeshStandardMaterial({ color: 0x60716e, roughness: 0.48, metalness: 0.34, name: 'aged structural metal' }),
  water: new THREE.MeshStandardMaterial({ color: 0x277180, roughness: 0.35, transparent: true, opacity: 0.72, name: 'context water surface' }),
  path: new THREE.MeshStandardMaterial({ color: 0xcdbd9c, roughness: 0.82, name: 'site path paving' }),
  hill: new THREE.MeshStandardMaterial({ color: 0x6e8b68, roughness: 0.9, name: 'garden hill planting' }),
}

function hashValue(id) {
  let hash = 2166136261
  for (const char of id) {
    hash ^= char.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function pick(hash, min, max) {
  return min + (hash % 1000) / 999 * (max - min)
}

function mesh(geometry, material, name, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material)
  item.name = name
  item.position.set(...position)
  item.rotation.set(...rotation)
  item.castShadow = true
  item.receiveShadow = true
  return item
}

function box(group, size, position, material, name, rotation) {
  const item = mesh(new THREE.BoxGeometry(...size), material, name, position, rotation)
  group.add(item)
  return item
}

function cylinder(group, radiusTop, radiusBottom, height, position, material, name, segments = 14) {
  const item = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), material, name, position)
  group.add(item)
  return item
}

function beam(group, start, end, radius, material, name) {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  const direction = b.clone().sub(a)
  const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material, name)
  item.position.copy(a.add(b).multiplyScalar(0.5))
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  group.add(item)
  return item
}

function roof(group, width, depth, y, height, material, name) {
  const positions = new Float32Array([
    -width / 2, y, -depth / 2, width / 2, y, -depth / 2, width / 2, y, depth / 2, -width / 2, y, depth / 2,
    0, y + height, -depth * 0.18, 0, y + height, depth * 0.18,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([0, 1, 4, 1, 2, 5, 1, 5, 4, 2, 3, 5, 3, 0, 4, 3, 4, 5, 0, 3, 2, 0, 2, 1])
  geometry.computeVertexNormals()
  group.add(mesh(geometry, material, name))
}

function addBase(group, id) {
  const hash = hashValue(id)
  box(group, [8, 0.16, 8], [0, 0.08, 0], mat.path, 'context_site_plinth')
  box(group, [6.8, 0.08, 0.42], [0, 0.22, -3.15], mat.stoneDark, 'front_scale_strip')
  if (hash % 3 === 0) box(group, [7.3, 0.05, 1.0], [0, 0.18, 3.1], mat.water, 'context_water_edge')
}

function addTemple(group, id) {
  const hash = hashValue(id)
  const width = pick(hash, 3.7, 5.1)
  const depth = pick(hash >> 3, 2.6, 3.8)
  box(group, [width + 1.0, 0.34, depth + 0.8], [0, 0.38, 0], mat.stone, 'raised_ceremonial_platform')
  box(group, [width, 1.2, depth], [0, 1.15, 0], mat.brick, 'main_hall_wall_volume')
  roof(group, width + 0.9, depth + 0.85, 1.9, 0.72, hash % 2 ? mat.roofGold : mat.roof, 'sweeping_tiled_roof')
  for (let i = -2; i <= 2; i += 1) cylinder(group, 0.08, 0.09, 1.2, [i * width / 5, 1.06, -depth / 2 - 0.08], mat.timber, `front_column_${i + 3}`, 12)
  box(group, [width * 0.55, 0.68, 0.12], [0, 1.06, -depth / 2 - 0.08], mat.timberDark, 'central_shadow_door')
}

function addGate(group, id) {
  const hash = hashValue(id)
  const width = pick(hash, 4.6, 6.3)
  box(group, [width, 1.1, 1.25], [0, 0.8, 0], mat.stone, 'city_gate_platform')
  for (const x of [-width * 0.26, 0, width * 0.26]) box(group, [0.72, 0.72, 0.16], [x, 0.78, -0.66], mat.timberDark, 'arched_gate_opening')
  box(group, [width * 0.68, 0.85, 1.2], [0, 1.85, 0], mat.brick, 'upper_gatehouse_body')
  roof(group, width * 0.78, 1.65, 2.35, 0.55, mat.roof, 'gatehouse_roof')
  for (const x of [-width / 2 - 0.8, width / 2 + 0.8]) box(group, [1.4, 0.82, 1.0], [x, 0.62, 0], mat.stoneDark, 'side_wall_segment')
}

function addPagoda(group, id) {
  const hash = hashValue(id)
  const levels = 5 + (hash % 4)
  for (let i = 0; i < levels; i += 1) {
    const width = 3.9 - i * 0.28
    const y = 0.44 + i * 0.72
    box(group, [width, 0.48, width], [0, y, 0], i % 2 ? mat.plaster : mat.brick, `pagoda_storey_${i + 1}`)
    box(group, [width + 0.35, 0.1, width + 0.35], [0, y + 0.29, 0], mat.roof, `pagoda_eave_${i + 1}`)
  }
  const top = 0.44 + (levels - 1) * 0.72 + 0.62
  cylinder(group, 0.07, 0.12, 0.72, [0, top + 0.36, 0], mat.roofGold, 'pagoda_finial', 12)
}

function addPavilion(group, id) {
  const hash = hashValue(id)
  const tiers = 2 + (hash % 3)
  box(group, [4.4, 0.38, 3.8], [0, 0.38, 0], mat.stone, 'pavilion_terrace')
  for (let i = 0; i < tiers; i += 1) {
    const width = 3.6 - i * 0.45
    const depth = 3.0 - i * 0.36
    const y = 0.9 + i * 0.88
    box(group, [width, 0.5, depth], [0, y, 0], mat.timber, `pavilion_floor_${i + 1}`)
    roof(group, width + 0.7, depth + 0.7, y + 0.32, 0.52, mat.roofGold, `pavilion_roof_${i + 1}`)
  }
}

function addGarden(group, id) {
  const hash = hashValue(id)
  box(group, [5.5, 0.08, 2.2], [-0.6, 0.25, 1.6], mat.water, 'garden_pond')
  cylinder(group, 1.25, 1.65, 0.9, [1.8, 0.62, -1.4], mat.hill, 'garden_rockery_hill', 9)
  addPavilion(group, `${id}-garden-pavilion`)
  box(group, [5.9, 0.1, 0.28], [0, 0.35, -3.05], mat.path, 'garden_gallery_path')
  for (let i = 0; i < 4; i += 1) cylinder(group, 0.05, 0.06, 0.82, [-2.8 + i * 0.75, 0.72, -3.05], mat.timber, `covered_gallery_post_${i}`, 8)
  if (hash % 2) roof(group, 3.1, 0.7, 1.12, 0.32, mat.roof, 'covered_gallery_roof')
}

function addPalace(group, id) {
  box(group, [7.0, 0.1, 7.0], [0, 0.24, 0], mat.path, 'palace_courtyard_paving')
  for (const z of [-2.0, 0.8, 2.7]) {
    box(group, [4.2, 0.34, 2.0], [0, 0.48, z], mat.stone, 'palace_marble_base')
    box(group, [3.5, 0.82, 1.45], [0, 1.06, z], mat.brick, 'palace_hall_body')
    roof(group, 4.2, 2.0, 1.55, 0.48, mat.roofGold, 'palace_yellow_roof')
  }
  for (const x of [-3.55, 3.55]) box(group, [0.28, 0.72, 6.4], [x, 0.64, 0.4], mat.brick, 'palace_side_wall')
}

function addGrotto(group, id) {
  const hash = hashValue(id)
  box(group, [6.5, 2.8, 1.0], [0, 1.55, 0.8], mat.stoneDark, 'grotto_cliff_face')
  const count = 4 + (hash % 4)
  for (let i = 0; i < count; i += 1) {
    const x = -2.5 + i * (5 / Math.max(1, count - 1))
    cylinder(group, 0.32, 0.36, 0.18, [x, 1.24 + (i % 2) * 0.38, 0.24], mat.timberDark, 'shadow_cave_recess', 18).rotation.x = Math.PI / 2
    cylinder(group, 0.12, 0.18, 0.62, [x, 0.72, -0.12], mat.stone, 'seated_figure_mass', 12)
  }
  box(group, [6.4, 0.12, 1.1], [0, 0.34, -0.1], mat.path, 'grotto_viewing_walkway')
}

function addStreet(group, id, name) {
  if (name.includes('桥')) {
    box(group, [6.4, 0.18, 1.2], [0, 0.72, 0], mat.metal, 'bridge_deck')
    for (const x of [-2.7, -1.35, 0, 1.35, 2.7]) beam(group, [x - 0.45, 0.92, -0.62], [x + 0.45, 1.62, -0.62], 0.035, mat.metal, 'bridge_truss_diagonal')
    for (const x of [-2.7, -1.35, 0, 1.35, 2.7]) beam(group, [x - 0.45, 0.92, 0.62], [x + 0.45, 1.62, 0.62], 0.035, mat.metal, 'bridge_truss_diagonal_back')
    box(group, [7.2, 0.05, 2.2], [0, 0.2, 0], mat.water, 'river_context')
    return
  }
  for (let i = 0; i < 5; i += 1) {
    const x = -2.8 + i * 1.4
    const height = 0.9 + (hashValue(`${id}-${i}`) % 5) * 0.22
    box(group, [0.95, height, 1.3], [x, 0.38 + height / 2, -0.6], i % 2 ? mat.plaster : mat.brick, `street_facade_${i}`)
    roof(group, 1.1, 1.55, 0.85 + height, 0.26, mat.roof, `street_roof_${i}`)
  }
  box(group, [7.0, 0.08, 1.1], [0, 0.24, 1.65], mat.path, 'street_public_axis')
}

function createScene(spec) {
  const scene = new THREE.Scene()
  scene.name = `${spec.name} · catalog generated 3D`
  const root = new THREE.Group()
  root.name = `${spec.id}_catalog_generated_model`
  addBase(root, spec.id)
  const name = spec.name ?? ''
  if (spec.kind === 'temple') addTemple(root, spec.id)
  else if (spec.kind === 'gate') addGate(root, spec.id)
  else if (spec.kind === 'pagoda') addPagoda(root, spec.id)
  else if (spec.kind === 'pavilion') addPavilion(root, spec.id)
  else if (spec.kind === 'garden') addGarden(root, spec.id)
  else if (spec.kind === 'palace') addPalace(root, spec.id)
  else if (spec.kind === 'grotto') addGrotto(root, spec.id)
  else addStreet(root, spec.id, name)
  root.rotation.y = -0.22
  scene.add(root)
  return scene
}

async function transpileDataModule(sourcePath, outputName) {
  const source = await readFile(sourcePath, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText
    .replaceAll("from './building3dAssets'", "from './building3dAssets.mjs'")
    .replaceAll("from './nationalSeed'", "from './nationalSeed.mjs'")
    .replaceAll("from './heritageImages'", "from './heritageImages.mjs'")
    .replaceAll("from '../types/building'", "from './types.mjs'")
  await writeFile(resolve(tmpDir, outputName), transpiled)
}

async function loadCatalogSpecs() {
  await rm(tmpDir, { recursive: true, force: true })
  await mkdir(tmpDir, { recursive: true })
  await writeFile(resolve(tmpDir, 'types.mjs'), 'export {}\n')
  await transpileDataModule('src/data/heritageImages.ts', 'heritageImages.mjs')
  await transpileDataModule('src/data/building3dAssets.ts', 'building3dAssets.mjs')
  await transpileDataModule('src/data/nationalSeed.ts', 'nationalSeed.mjs')
  await transpileDataModule('src/data/buildings.ts', 'buildings.mjs')
  const module = await import(pathToFileURL(resolve(tmpDir, 'buildings.mjs')).href + `?t=${Date.now()}`)
  const specs = new Map()
  for (const building of module.buildings) {
    specs.set(building.id, { id: building.id, name: building.name, kind: building.model.kind })
    for (const point of building.scenic?.points ?? []) {
      if (!point.useParentModel && !point.embedUrl) specs.set(point.id, { id: point.id, name: point.name, kind: point.modelKind })
    }
  }
  return [...specs.values()]
}

async function exportScene(scene, outputDir, filename) {
  const exporter = new GLTFExporter()
  const result = await new Promise((resolveExport, reject) => {
    exporter.parse(scene, resolveExport, reject, { binary: true, trs: false, onlyVisible: true })
  })
  await writeFile(resolve(outputDir, filename), Buffer.from(result))
}

await mkdir(outputRoot, { recursive: true })
const specs = await loadCatalogSpecs()
for (const spec of specs) {
  const outputDir = resolve(outputRoot, spec.id)
  await mkdir(outputDir, { recursive: true })
  await exportScene(createScene(spec), outputDir, 'model-medium.glb')
  const stats = await stat(resolve(outputDir, 'model-medium.glb'))
  await writeFile(resolve(outputDir, 'manifest.json'), JSON.stringify({
    modelId: spec.id,
    title: spec.name,
    kind: spec.kind,
    version: '0.1.0-catalog-generated',
    assetStatus: '项目自动生成形制 GLB',
    source: 'ARCHIVA 项目按建筑类型与条目名称生成的可交互形制模型，用于补齐 3D 展示入口；非现场测绘。',
    license: '项目展示模型；正式出版需替换为授权扫描、摄影测量或精修模型。',
    lod: [{ level: 'medium', url: `/models/catalog-generated/${spec.id}/model-medium.glb`, bytes: stats.size }],
    textures: { format: 'embedded-materials', basePath: `/models/catalog-generated/${spec.id}/`, variants: { mobile: 'medium', desktop: 'medium', detail: 'medium' } },
    defaultCamera: { position: [8.5, 6.2, 9.5], target: [0, 1.2, 0], fov: 34 },
  }, null, 2))
}

await rm(tmpDir, { recursive: true, force: true })
console.log(`Generated ${specs.length} catalog 3D assets in ${outputRoot}`)
