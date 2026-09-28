import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
}

const outputDir = resolve(fileURLToPath(new URL('../public/models/beijing-forbidden-city', import.meta.url)))

const mat = {
  ground: new THREE.MeshStandardMaterial({ color: 0x9f8f73, roughness: 0.9, name: 'Warm palace paving' }),
  axis: new THREE.MeshStandardMaterial({ color: 0xd4c3a2, roughness: 0.82, name: 'Central stone axis' }),
  marble: new THREE.MeshStandardMaterial({ color: 0xe6ddca, roughness: 0.72, metalness: 0.02, name: 'White marble terrace' }),
  marbleEdge: new THREE.MeshStandardMaterial({ color: 0xc9baa0, roughness: 0.76, name: 'Carved terrace edge' }),
  wall: new THREE.MeshStandardMaterial({ color: 0xa43426, roughness: 0.68, metalness: 0.02, name: 'Forbidden City vermilion wall' }),
  wallLight: new THREE.MeshStandardMaterial({ color: 0xc4472c, roughness: 0.62, metalness: 0.02, name: 'Sunlit vermilion plaster' }),
  door: new THREE.MeshStandardMaterial({ color: 0x2d1914, roughness: 0.82, name: 'Deep palace doorway' }),
  roof: new THREE.MeshStandardMaterial({ color: 0xe3ad37, roughness: 0.44, metalness: 0.16, name: 'Yellow glazed roof tile' }),
  roofLight: new THREE.MeshStandardMaterial({ color: 0xf4cd62, roughness: 0.38, metalness: 0.18, name: 'Sunlit yellow glazed ridge' }),
  roofDark: new THREE.MeshStandardMaterial({ color: 0x5d3e25, roughness: 0.82, metalness: 0.04, name: 'Dark roof underside' }),
  bracket: new THREE.MeshStandardMaterial({ color: 0x286f66, roughness: 0.66, metalness: 0.05, name: 'Painted dougong bracket band' }),
  gold: new THREE.MeshStandardMaterial({ color: 0xefc75b, roughness: 0.36, metalness: 0.32, name: 'Gilded roof ornament' }),
  water: new THREE.MeshStandardMaterial({ color: 0x1f5a67, roughness: 0.26, metalness: 0.15, transparent: true, opacity: 0.78, name: 'Palace moat water' }),
  cypress: new THREE.MeshStandardMaterial({ color: 0x1d4b3b, roughness: 0.74, name: 'Ancient cypress canopy' }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x604029, roughness: 0.86, name: 'Cypress trunk' }),
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

function box(group, size, position, material, name, rotation = [0, 0, 0]) {
  const item = mesh(new THREE.BoxGeometry(...size), material, name, position, rotation)
  group.add(item)
  return item
}

function cylinder(group, radiusTop, radiusBottom, height, position, material, name, radialSegments = 12) {
  const item = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material, name)
  item.position.set(...position)
  group.add(item)
  return item
}

function beam(group, start, end, radius, material, name, sides = 8) {
  const a = new THREE.Vector3(...start)
  const b = new THREE.Vector3(...end)
  const direction = b.clone().sub(a)
  const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), sides), material, name)
  item.position.copy(a.add(b).multiplyScalar(0.5))
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  group.add(item)
  return item
}

function addHipRoof(group, width, depth, baseY, height, name, detail = false) {
  const outerW = width + 0.82
  const outerD = depth + 0.72
  const midW = width + 0.14
  const midD = depth + 0.1
  const ridgeHalf = Math.max(0.56, width * 0.18)
  const positions = new Float32Array([
    -outerW / 2, baseY, -outerD / 2, outerW / 2, baseY, -outerD / 2, outerW / 2, baseY, outerD / 2, -outerW / 2, baseY, outerD / 2,
    -midW / 2, baseY + height * 0.26, -midD / 2, midW / 2, baseY + height * 0.26, -midD / 2, midW / 2, baseY + height * 0.26, midD / 2, -midW / 2, baseY + height * 0.26, midD / 2,
    -ridgeHalf, baseY + height, 0, ridgeHalf, baseY + height, 0,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([
    0, 4, 1, 1, 4, 5, 1, 5, 2, 2, 5, 6, 2, 6, 3, 3, 6, 7, 3, 7, 0, 0, 7, 4,
    4, 8, 5, 5, 8, 9, 7, 6, 9, 7, 9, 8, 5, 9, 6, 4, 7, 8,
  ])
  geometry.computeVertexNormals()
  group.add(mesh(geometry, mat.roof, name))
  box(group, [outerW + 0.12, 0.13, 0.18], [0, baseY - 0.04, -outerD / 2], mat.roofLight, `${name}_front_glazed_eave`)
  box(group, [outerW + 0.12, 0.13, 0.18], [0, baseY - 0.04, outerD / 2], mat.roofLight, `${name}_back_glazed_eave`)
  box(group, [0.18, 0.13, outerD + 0.12], [-outerW / 2, baseY - 0.04, 0], mat.roofLight, `${name}_left_glazed_eave`)
  box(group, [0.18, 0.13, outerD + 0.12], [outerW / 2, baseY - 0.04, 0], mat.roofLight, `${name}_right_glazed_eave`)
  box(group, [outerW * 0.94, 0.13, outerD * 0.9], [0, baseY - 0.14, 0], mat.roofDark, `${name}_deep_shadow_underside`)
  box(group, [ridgeHalf * 2 + 0.26, 0.13, 0.16], [0, baseY + height + 0.04, 0], mat.roofLight, `${name}_main_ridge`)
  for (const [x, z, rx, rz] of [
    [-outerW / 2, -outerD / 2, 0.28, -0.14],
    [outerW / 2, -outerD / 2, 0.28, 0.14],
    [-outerW / 2, outerD / 2, -0.28, -0.14],
    [outerW / 2, outerD / 2, -0.28, 0.14],
  ]) {
    box(group, [0.16, 0.12, 0.64], [x, baseY + 0.1, z], mat.roofLight, `${name}_upturned_corner`, [rx, 0, rz])
  }
  if (!detail) return
  for (let i = -5; i <= 5; i += 1) {
    const x = i * midW / 12
    beam(group, [x, baseY + height * 0.28, -midD / 2], [i * ridgeHalf / 6, baseY + height * 0.92, 0], 0.018, mat.roofDark, `${name}_front_tile_rib_${i}`, 6)
    beam(group, [x, baseY + height * 0.28, midD / 2], [i * ridgeHalf / 6, baseY + height * 0.92, 0], 0.018, mat.roofDark, `${name}_back_tile_rib_${i}`, 6)
  }
}

function addHall(group, {
  name,
  width,
  depth,
  x = 0,
  z = 0,
  baseY = 0,
  body = 0.9,
  roof = 0.54,
  terrace = true,
  detail = false,
  grand = false,
}) {
  const hall = new THREE.Group()
  hall.name = name
  hall.position.set(x, baseY, z)
  if (terrace) {
    const layers = grand ? 3 : 1
    for (let i = 0; i < layers; i += 1) {
      box(hall, [width + 1.8 - i * 0.55, 0.18, depth + 1.35 - i * 0.42], [0, 0.1 + i * 0.19, 0], i % 2 ? mat.marbleEdge : mat.marble, `${name}_white_marble_terrace_${i + 1}`)
    }
    const stairCount = grand ? 7 : 4
    for (let i = 0; i < stairCount; i += 1) {
      box(hall, [Math.max(1.4, width * 0.34 - i * 0.12), 0.08, 0.34], [0, 0.18 + i * 0.08, -depth / 2 - 1.02 - i * 0.16], mat.marble, `${name}_front_ceremonial_stair_${i + 1}`)
    }
  }
  const y = terrace ? (grand ? 0.72 : 0.34) : 0.08
  box(hall, [width, body, depth], [0, y + body / 2, 0], mat.wallLight, `${name}_vermilion_hall_body`)
  box(hall, [width * 0.88, body * 0.68, 0.12], [0, y + body * 0.52, -depth / 2 - 0.01], mat.door, `${name}_front_shadow_doors`)
  box(hall, [width * 0.88, body * 0.68, 0.12], [0, y + body * 0.52, depth / 2 + 0.01], mat.door, `${name}_back_shadow_doors`)
  box(hall, [width + 0.15, 0.15, 0.18], [0, y + body + 0.02, -depth / 2], mat.bracket, `${name}_front_dougong_band`)
  box(hall, [width + 0.15, 0.15, 0.18], [0, y + body + 0.02, depth / 2], mat.bracket, `${name}_back_dougong_band`)
  box(hall, [0.18, 0.15, depth + 0.14], [-width / 2, y + body + 0.02, 0], mat.bracket, `${name}_left_dougong_band`)
  box(hall, [0.18, 0.15, depth + 0.14], [width / 2, y + body + 0.02, 0], mat.bracket, `${name}_right_dougong_band`)
  const columnCount = detail ? 7 : 5
  for (let i = 0; i < columnCount; i += 1) {
    const cx = (i - (columnCount - 1) / 2) * (width * 0.78 / (columnCount - 1))
    cylinder(hall, 0.07, 0.08, body + 0.08, [cx, y + body / 2, -depth / 2 - 0.11], mat.wall, `${name}_front_vermilion_column_${i + 1}`, 12)
    cylinder(hall, 0.07, 0.08, body + 0.08, [cx, y + body / 2, depth / 2 + 0.11], mat.wall, `${name}_back_vermilion_column_${i + 1}`, 12)
  }
  addHipRoof(hall, width + (grand ? 0.8 : 0.48), depth + (grand ? 0.62 : 0.44), y + body + 0.18, roof, `${name}_yellow_glazed_hip_roof`, detail)
  if (grand) addHipRoof(hall, width * 0.82, depth * 0.8, y + body + roof + 0.38, roof * 0.52, `${name}_upper_yellow_glazed_roof`, detail)
  group.add(hall)
  return hall
}

function addGate(group, name, z, width, detail = false) {
  const gate = new THREE.Group()
  gate.name = name
  gate.position.z = z
  box(gate, [width, 0.64, 1.08], [0, 0.32, 0], mat.wall, `${name}_platform_wall`)
  for (const x of [-width * 0.32, 0, width * 0.32]) {
    box(gate, [0.78, 0.74, 0.16], [x, 0.43, -0.55], mat.door, `${name}_arched_door_${x}`)
  }
  addHall(gate, { name: `${name}_gatehouse`, width: width * 0.64, depth: 1.25, baseY: 0.58, body: 0.62, roof: 0.42, terrace: false, detail })
  group.add(gate)
}

function addCornerTower(group, x, z, name, detail = false) {
  const tower = new THREE.Group()
  tower.name = name
  tower.position.set(x, 0, z)
  box(tower, [1.0, 0.55, 1.0], [0, 0.28, 0], mat.wall, `${name}_red_corner_base`)
  addHipRoof(tower, 1.15, 1.15, 0.72, 0.56, `${name}_crossed_yellow_roof`, detail)
  addHipRoof(tower, 0.82, 0.82, 1.08, 0.42, `${name}_upper_crossed_yellow_roof`, detail)
  cylinder(tower, 0.035, 0.05, 0.36, [0, 1.76, 0], mat.gold, `${name}_roof_finial`, 10)
  group.add(tower)
}

function addTree(group, x, z, scale = 1) {
  cylinder(group, 0.04 * scale, 0.05 * scale, 0.38 * scale, [x, 0.2 * scale, z], mat.trunk, 'Cypress_Trunk', 8)
  const crown = mesh(new THREE.ConeGeometry(0.2 * scale, 0.68 * scale, 8), mat.cypress, 'Cypress_Canopy', [x, 0.7 * scale, z])
  group.add(crown)
}

function createForbiddenCity(level) {
  const scene = new THREE.Scene()
  scene.name = `Beijing Forbidden City · ${level} LOD`
  const root = new THREE.Group()
  root.name = 'ForbiddenCity_Form_Reconstruction'
  const detail = level !== 'low'
  const high = level === 'high'

  box(root, [22, 0.08, 32], [0, 0.02, 0], mat.ground, 'Imperial_City_Paved_Ground')
  box(root, [3.0, 0.09, 29.2], [0, 0.08, 0.4], mat.axis, 'Central_North_South_Stone_Axis')
  box(root, [24.5, 0.05, 2.1], [0, 0.035, -16.8], mat.water, 'South_Moat_Water')
  box(root, [1.6, 0.05, 32.8], [-12.05, 0.035, 0], mat.water, 'West_Moat_Water')
  box(root, [1.6, 0.05, 32.8], [12.05, 0.035, 0], mat.water, 'East_Moat_Water')

  box(root, [22.0, 0.72, 0.42], [0, 0.38, -14.2], mat.wall, 'South_Red_Palace_Wall')
  box(root, [22.0, 0.72, 0.42], [0, 0.38, 14.2], mat.wall, 'North_Red_Palace_Wall')
  box(root, [0.42, 0.72, 28.6], [-10.8, 0.38, 0], mat.wall, 'West_Red_Palace_Wall')
  box(root, [0.42, 0.72, 28.6], [10.8, 0.38, 0], mat.wall, 'East_Red_Palace_Wall')
  for (const z of [-14.48, 14.48]) box(root, [22.4, 0.14, 0.72], [0, 0.82, z], mat.roofLight, `Wall_Yellow_Glazed_Coping_${z}`)
  for (const x of [-11.08, 11.08]) box(root, [0.72, 0.14, 28.8], [x, 0.82, 0], mat.roofLight, `Wall_Yellow_Glazed_Coping_${x}`)

  addGate(root, 'Meridian_Gate_Wumen', -12.25, 7.8, detail)
  addGate(root, 'Gate_of_Supreme_Harmony', -7.6, 5.7, detail)
  addGate(root, 'Gate_of_Heavenly_Purity', 4.75, 4.2, detail)

  addHall(root, { name: 'Hall_of_Supreme_Harmony_Taihedian', width: 6.9, depth: 3.65, z: -2.9, body: 1.04, roof: 0.66, grand: true, detail })
  addHall(root, { name: 'Hall_of_Central_Harmony_Zhonghedian', width: 3.45, depth: 2.36, z: 1.2, body: 0.82, roof: 0.52, terrace: true, detail: high })
  addHall(root, { name: 'Hall_of_Preserving_Harmony_Baohedian', width: 4.9, depth: 2.72, z: 3.85, body: 0.88, roof: 0.56, terrace: true, detail })
  addHall(root, { name: 'Palace_of_Heavenly_Purity_Qianqinggong', width: 4.9, depth: 2.65, z: 7.3, body: 0.86, roof: 0.54, terrace: true, detail })
  addHall(root, { name: 'Hall_of_Union_Jiaotaidian', width: 2.7, depth: 2.0, z: 9.72, body: 0.72, roof: 0.46, terrace: true, detail: high })
  addHall(root, { name: 'Palace_of_Earthly_Tranquility_Kunninggong', width: 4.5, depth: 2.35, z: 11.65, body: 0.76, roof: 0.5, terrace: true, detail })

  const sideZ = [-4.8, -2.2, 1.2, 4.2, 7.6, 10.5]
  for (const z of sideZ) {
    addHall(root, { name: `West_Side_Courtyard_Hall_${z}`, width: 2.1, depth: 1.35, x: -6.2, z, body: 0.48, roof: 0.32, terrace: false, detail: high })
    addHall(root, { name: `East_Side_Courtyard_Hall_${z}`, width: 2.1, depth: 1.35, x: 6.2, z, body: 0.48, roof: 0.32, terrace: false, detail: high })
  }

  for (const x of [-10.1, 10.1]) for (const z of [-13.4, 13.4]) addCornerTower(root, x, z, `Corner_Tower_${x}_${z}`, detail)
  if (detail) {
    for (const x of [-8.1, -7.35, 7.35, 8.1]) {
      for (const z of [-8.6, -5.7, -0.2, 5.75, 9.15, 12.5]) addTree(root, x, z, high ? 1.05 : 0.9)
    }
    for (let z = -10.2; z <= 12.2; z += 1.55) {
      box(root, [0.08, 0.22, 0.85], [-3.35, 0.22, z], mat.marbleEdge, `West_Axis_Balustrade_Post_${z}`)
      box(root, [0.08, 0.22, 0.85], [3.35, 0.22, z], mat.marbleEdge, `East_Axis_Balustrade_Post_${z}`)
    }
  }

  root.rotation.y = -0.16
  scene.add(root)
  return scene
}

async function exportScene(scene, filename) {
  const exporter = new GLTFExporter()
  const result = await new Promise((resolveExport, reject) => {
    exporter.parse(scene, resolveExport, reject, { binary: true, trs: false, onlyVisible: true })
  })
  await writeFile(resolve(outputDir, filename), Buffer.from(result))
}

await mkdir(outputDir, { recursive: true })
const levels = ['low', 'medium', 'high']
for (const level of levels) await exportScene(createForbiddenCity(level), `model-${level}.glb`)

const lod = []
for (const level of levels) {
  const filename = `model-${level}.glb`
  const stats = await stat(resolve(outputDir, filename))
  lod.push({ level, url: `/models/beijing-forbidden-city/${filename}`, bytes: stats.size })
}

await writeFile(resolve(outputDir, 'manifest.json'), JSON.stringify({
  modelId: 'beijing-forbidden-city',
  version: '0.3.0-reconstruction',
  versionStatus: 'TECHNICAL_REVIEW',
  assetStatus: '本地资料复原 GLB 样板',
  source: 'ARCHIVA 项目自建形制复原（基于公开建筑形制资料与比例参数，不代表现场测绘）',
  license: '项目自有技术样板；正式出版如需实测精度，应替换为已授权扫描或摄影测量资产',
  lod,
  textures: {
    format: 'embedded-materials',
    basePath: '/models/beijing-forbidden-city/',
    variants: { mobile: 'low', desktop: 'medium', detail: 'high' },
  },
  defaultCamera: {
    position: [13.2, 8.4, 17.6],
    target: [0, 1.6, 0],
    fov: 34,
  },
  hotspots: [
    { id: 'axis', title: '中轴线院落', position: [0, 0.35, 0], content: '模型以南北中轴组织午门、太和门、外朝三大殿和内廷后三宫。' },
    { id: 'taihedian', title: '太和殿', position: [0, 2.0, -2.9], content: '三层汉白玉台基、红柱殿身与重檐黄瓦屋顶构成外朝核心识别。' },
    { id: 'wumen', title: '午门', position: [0, 1.2, -12.25], content: '南侧入口以高台门楼和三券门提示宫城入口尺度。' },
    { id: 'corner-tower', title: '角楼与宫墙', position: [10.1, 1.3, -13.4], content: '四角角楼、红宫墙和护城河共同形成故宫边界轮廓。' },
  ],
  components: [
    { id: 'site', name: '故宫建筑群', nodeName: 'ForbiddenCity_Form_Reconstruction', parentId: null },
    { id: 'axis', name: '南北中轴', nodeName: 'Central_North_South_Stone_Axis', parentId: 'site' },
    { id: 'wumen', name: '午门', nodeName: 'Meridian_Gate_Wumen', parentId: 'site' },
    { id: 'taihedian', name: '太和殿', nodeName: 'Hall_of_Supreme_Harmony_Taihedian', parentId: 'site' },
    { id: 'wall', name: '宫墙与角楼', nodeName: 'South_Red_Palace_Wall', parentId: 'site' },
  ],
}, null, 2))

console.log(`Generated Forbidden City assets in ${outputDir}`)
