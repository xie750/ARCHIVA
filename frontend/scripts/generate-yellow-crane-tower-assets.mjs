import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
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

const outputDir = resolve(fileURLToPath(new URL('../public/models/wuhan-yellow-crane-tower', import.meta.url)))

const mat = {
  stone: new THREE.MeshStandardMaterial({ color: 0xb8aa92, roughness: 0.86, metalness: 0.02, name: 'Layered pale stone terrace' }),
  stair: new THREE.MeshStandardMaterial({ color: 0xc8b999, roughness: 0.82, metalness: 0.02, name: 'Front ceremonial stair' }),
  wall: new THREE.MeshStandardMaterial({ color: 0xe8d6ad, roughness: 0.72, metalness: 0.02, name: 'Warm plaster wall panels' }),
  red: new THREE.MeshStandardMaterial({ color: 0xa73526, roughness: 0.64, metalness: 0.04, name: 'Vermilion timber frame' }),
  redLight: new THREE.MeshStandardMaterial({ color: 0xc54e32, roughness: 0.6, metalness: 0.04, name: 'Sunlit vermilion timber' }),
  roof: new THREE.MeshStandardMaterial({ color: 0xdba545, roughness: 0.48, metalness: 0.16, name: 'Yellow glazed roof tile' }),
  roofLight: new THREE.MeshStandardMaterial({ color: 0xf1c568, roughness: 0.42, metalness: 0.18, name: 'Sunlit yellow tile edge' }),
  roofDark: new THREE.MeshStandardMaterial({ color: 0x6a4630, roughness: 0.8, metalness: 0.06, name: 'Dark roof underside' }),
  bracket: new THREE.MeshStandardMaterial({ color: 0x2f6d65, roughness: 0.68, metalness: 0.06, name: 'Green dougong bracket band' }),
  shadow: new THREE.MeshStandardMaterial({ color: 0x171412, roughness: 0.94, metalness: 0.02, name: 'Deep interior shadow' }),
  rail: new THREE.MeshStandardMaterial({ color: 0xf0c46a, roughness: 0.48, metalness: 0.16, name: 'Gold viewing rail' }),
  plaque: new THREE.MeshStandardMaterial({ color: 0x1d1916, roughness: 0.78, metalness: 0.08, name: 'Black front plaque' }),
  water: new THREE.MeshStandardMaterial({ color: 0x1f5562, roughness: 0.2, metalness: 0.18, transparent: true, opacity: 0.82, name: 'Yangtze River context' }),
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

function addCurvedHipRoof(group, width, depth, baseY, height, name, detail = false) {
  const outerW = width + 0.9
  const outerD = depth + 0.82
  const midW = width + 0.28
  const midD = depth + 0.24
  const ridgeHalf = Math.max(0.55, width * 0.18)
  const positions = new Float32Array([
    -outerW / 2, baseY, -outerD / 2, outerW / 2, baseY, -outerD / 2, outerW / 2, baseY, outerD / 2, -outerW / 2, baseY, outerD / 2,
    -midW / 2, baseY + height * 0.28, -midD / 2, midW / 2, baseY + height * 0.28, -midD / 2, midW / 2, baseY + height * 0.28, midD / 2, -midW / 2, baseY + height * 0.28, midD / 2,
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
  box(group, [outerW + 0.14, 0.13, 0.18], [0, baseY - 0.02, -outerD / 2], mat.roofLight, `${name}_front_gold_eave`)
  box(group, [outerW + 0.14, 0.13, 0.18], [0, baseY - 0.02, outerD / 2], mat.roofLight, `${name}_back_gold_eave`)
  box(group, [0.18, 0.13, outerD + 0.14], [-outerW / 2, baseY - 0.02, 0], mat.roofLight, `${name}_left_gold_eave`)
  box(group, [0.18, 0.13, outerD + 0.14], [outerW / 2, baseY - 0.02, 0], mat.roofLight, `${name}_right_gold_eave`)
  box(group, [outerW * 0.96, 0.12, outerD * 0.92], [0, baseY - 0.12, 0], mat.roofDark, `${name}_shadow_underside`)
  box(group, [ridgeHalf * 2 + 0.22, 0.13, 0.16], [0, baseY + height + 0.04, 0], mat.roofLight, `${name}_main_ridge`)
  for (const [x, z, rx, rz] of [
    [-outerW / 2, -outerD / 2, 0.26, -0.13],
    [outerW / 2, -outerD / 2, 0.26, 0.13],
    [-outerW / 2, outerD / 2, -0.26, -0.13],
    [outerW / 2, outerD / 2, -0.26, 0.13],
  ]) {
    box(group, [0.16, 0.12, 0.74], [x, baseY + 0.1, z], mat.roofLight, `${name}_upturned_corner`, [rx, 0, rz])
  }
  if (detail) {
    for (let i = -4; i <= 4; i += 1) {
      beam(group, [i * midW / 9, baseY + height * 0.28, -midD / 2], [i * ridgeHalf / 5, baseY + height * 0.92, 0], 0.018, mat.roofDark, `${name}_front_tile_rib_${i}`, 6)
      beam(group, [i * midW / 9, baseY + height * 0.28, midD / 2], [i * ridgeHalf / 5, baseY + height * 0.92, 0], 0.018, mat.roofDark, `${name}_back_tile_rib_${i}`, 6)
    }
    for (const z of [-outerD / 2, outerD / 2]) {
      for (let x = -outerW / 2 + 0.55; x <= outerW / 2 - 0.55; x += 0.55) {
        box(group, [0.22, 0.08, 0.14], [x, baseY + 0.03, z], mat.roofLight, `${name}_eave_tile_teeth`)
      }
    }
  }
}

function addColumns(group, width, depth, y, height, detail = false) {
  const xs = detail ? [-width * 0.42, -width * 0.18, width * 0.18, width * 0.42] : [-width * 0.42, width * 0.42]
  const zs = detail ? [-depth * 0.42, 0, depth * 0.42] : [-depth * 0.42, depth * 0.42]
  for (const x of xs) {
    cylinder(group, 0.07, 0.08, height, [x, y + height / 2, -depth * 0.47], mat.red, 'Front_Vermilion_Column')
    cylinder(group, 0.07, 0.08, height, [x, y + height / 2, depth * 0.47], mat.red, 'Back_Vermilion_Column')
  }
  for (const z of zs) {
    cylinder(group, 0.07, 0.08, height, [-width * 0.47, y + height / 2, z], mat.red, 'Side_Vermilion_Column')
    cylinder(group, 0.07, 0.08, height, [width * 0.47, y + height / 2, z], mat.red, 'Side_Vermilion_Column')
  }
}

function addWallAndWindows(group, width, depth, y, height, level, detail = false) {
  const bodyY = y + height / 2
  box(group, [width * 0.68, height * 0.72, 0.12], [0, bodyY, -depth * 0.49], mat.wall, `Floor_${level}_front_plaster_wall`)
  box(group, [width * 0.68, height * 0.72, 0.12], [0, bodyY, depth * 0.49], mat.wall, `Floor_${level}_back_plaster_wall`)
  box(group, [0.12, height * 0.72, depth * 0.56], [-width * 0.49, bodyY, 0], mat.wall, `Floor_${level}_left_plaster_wall`)
  box(group, [0.12, height * 0.72, depth * 0.56], [width * 0.49, bodyY, 0], mat.wall, `Floor_${level}_right_plaster_wall`)
  box(group, [width * 0.78, 0.13, 0.16], [0, y + height * 0.18, -depth * 0.56], mat.red, `Floor_${level}_front_lower_vermilion_frame`)
  box(group, [width * 0.78, 0.13, 0.16], [0, y + height * 0.18, depth * 0.56], mat.red, `Floor_${level}_back_lower_vermilion_frame`)
  box(group, [width * 0.78, 0.1, 0.16], [0, y + height * 0.74, -depth * 0.56], mat.redLight, `Floor_${level}_front_upper_vermilion_frame`)
  box(group, [width * 0.78, 0.1, 0.16], [0, y + height * 0.74, depth * 0.56], mat.redLight, `Floor_${level}_back_upper_vermilion_frame`)
  box(group, [0.14, height * 0.66, 0.14], [-width * 0.34, bodyY, -depth * 0.57], mat.red, `Floor_${level}_front_vertical_frame_left`)
  box(group, [0.14, height * 0.66, 0.14], [width * 0.34, bodyY, -depth * 0.57], mat.red, `Floor_${level}_front_vertical_frame_right`)
  box(group, [0.14, height * 0.66, 0.14], [-width * 0.34, bodyY, depth * 0.57], mat.red, `Floor_${level}_back_vertical_frame_left`)
  box(group, [0.14, height * 0.66, 0.14], [width * 0.34, bodyY, depth * 0.57], mat.red, `Floor_${level}_back_vertical_frame_right`)
  box(group, [0.14, 0.1, depth * 0.64], [-width * 0.56, y + height * 0.18, 0], mat.red, `Floor_${level}_left_lower_vermilion_frame`)
  box(group, [0.14, 0.1, depth * 0.64], [width * 0.56, y + height * 0.18, 0], mat.red, `Floor_${level}_right_lower_vermilion_frame`)
  const windowXs = [-width * 0.24, 0, width * 0.24]
  for (const x of windowXs) {
    box(group, [0.42, height * 0.34, 0.14], [x, bodyY, -depth * 0.555], mat.shadow, `Floor_${level}_front_lattice_shadow`)
    box(group, [0.42, height * 0.34, 0.14], [x, bodyY, depth * 0.555], mat.shadow, `Floor_${level}_back_lattice_shadow`)
    if (detail) {
      box(group, [0.5, 0.045, 0.16], [x, bodyY + height * 0.2, -depth * 0.565], mat.redLight, `Floor_${level}_front_window_lintel`)
      box(group, [0.5, 0.045, 0.16], [x, bodyY + height * 0.2, depth * 0.565], mat.redLight, `Floor_${level}_back_window_lintel`)
      box(group, [0.045, height * 0.34, 0.16], [x - 0.14, bodyY, -depth * 0.57], mat.red, `Floor_${level}_front_window_mullion`)
      box(group, [0.045, height * 0.34, 0.16], [x + 0.14, bodyY, -depth * 0.57], mat.red, `Floor_${level}_front_window_mullion`)
    }
  }
  box(group, [width + 0.18, 0.13, 0.18], [0, y + height + 0.04, -depth * 0.5], mat.bracket, `Floor_${level}_front_green_bracket_band`)
  box(group, [width + 0.18, 0.13, 0.18], [0, y + height + 0.04, depth * 0.5], mat.bracket, `Floor_${level}_back_green_bracket_band`)
  box(group, [0.18, 0.13, depth + 0.18], [-width * 0.5, y + height + 0.04, 0], mat.bracket, `Floor_${level}_left_green_bracket_band`)
  box(group, [0.18, 0.13, depth + 0.18], [width * 0.5, y + height + 0.04, 0], mat.bracket, `Floor_${level}_right_green_bracket_band`)
  if (detail) {
    for (let x = -width * 0.43; x <= width * 0.43; x += 0.55) box(group, [0.2, 0.11, 0.18], [x, y + height - 0.08, -depth * 0.54], mat.bracket, `Floor_${level}_dougong_block`)
  }
}

function addRail(group, width, depth, y, detail = false) {
  box(group, [width, 0.08, 0.08], [0, y, -depth / 2], mat.rail, 'Viewing_Deck_Front_Rail')
  box(group, [width, 0.08, 0.08], [0, y, depth / 2], mat.rail, 'Viewing_Deck_Back_Rail')
  box(group, [0.08, 0.08, depth], [-width / 2, y, 0], mat.rail, 'Viewing_Deck_Left_Rail')
  box(group, [0.08, 0.08, depth], [width / 2, y, 0], mat.rail, 'Viewing_Deck_Right_Rail')
  if (!detail) return
  for (let x = -width / 2 + 0.4; x < width / 2; x += 0.55) {
    cylinder(group, 0.025, 0.03, 0.42, [x, y - 0.22, -depth / 2], mat.rail, 'Viewing_Deck_Front_Post', 8)
    cylinder(group, 0.025, 0.03, 0.42, [x, y - 0.22, depth / 2], mat.rail, 'Viewing_Deck_Back_Post', 8)
  }
}

function createTower(level) {
  const scene = new THREE.Scene()
  scene.name = `Yellow Crane Tower · ${level} LOD`
  const root = new THREE.Group()
  root.name = 'Building_Main'
  const detail = level !== 'low'
  const high = level === 'high'

  box(root, [9.0, 0.26, 6.8], [0, 0.13, 0], mat.stone, 'SnakeHill_Lower_Terrace')
  box(root, [7.7, 0.28, 5.7], [0, 0.42, 0], mat.stone, 'SnakeHill_Upper_Terrace')
  box(root, [6.7, 0.18, 4.8], [0, 0.65, 0], mat.stair, 'Main_Platform_Slab')
  for (let i = 0; i < 5; i += 1) {
    box(root, [3.2 - i * 0.35, 0.11, 0.52], [0, 0.78 + i * 0.12, -3.0 - i * 0.18], mat.stair, `Front_Stair_${i + 1}`)
  }
  if (detail) {
    root.add(mesh(new THREE.PlaneGeometry(8.8, 1.75), mat.water, 'Yangtze_River_Context', [-0.35, 0.09, 4.6], [-Math.PI / 2, 0, 0.08]))
    box(root, [0.16, 0.54, 2.0], [-3.0, 0.92, -2.95], mat.red, 'Front_Gate_Left_Pillar')
    box(root, [0.16, 0.54, 2.0], [3.0, 0.92, -2.95], mat.red, 'Front_Gate_Right_Pillar')
  }

  const tiers = [
    { width: 6.05, depth: 4.45, y: 0.88, body: 0.72, roof: 0.5 },
    { width: 5.55, depth: 4.05, y: 1.84, body: 0.66, roof: 0.48 },
    { width: 5.0, depth: 3.65, y: 2.76, body: 0.62, roof: 0.46 },
    { width: 4.35, depth: 3.18, y: 3.64, body: 0.58, roof: 0.44 },
    { width: 3.25, depth: 2.46, y: 4.5, body: 0.74, roof: 0.56 },
  ]
  tiers.forEach((tier, index) => {
    const floor = new THREE.Group()
    floor.name = `Floor_${String(index + 1).padStart(2, '0')}`
    box(floor, [tier.width + 0.34, 0.12, tier.depth + 0.3], [0, tier.y - 0.08, 0], mat.roofDark, `Floor_${index + 1}_Shadow_Platform`)
    addWallAndWindows(floor, tier.width, tier.depth, tier.y, tier.body, String(index + 1).padStart(2, '0'), detail)
    addColumns(floor, tier.width, tier.depth, tier.y - 0.04, tier.body + 0.12, detail)
    if (detail) addRail(floor, tier.width + 0.78, tier.depth + 0.58, tier.y + tier.body * 0.68, high)
    addCurvedHipRoof(floor, tier.width + 0.42, tier.depth + 0.34, tier.y + tier.body + 0.12, tier.roof, `Floor_${index + 1}_Yellow_Glazed_Hip_Roof`, high)
    root.add(floor)
  })

  box(root, [1.05, 4.7, 1.05], [0, 3.05, 0], mat.shadow, 'Central_Core_Shadow')
  box(root, [2.0, 0.58, 1.38], [0, 5.63, -0.02], mat.wall, 'Top_Crown_Wall')
  addColumns(root, 2.05, 1.42, 5.28, 0.62, true)
  box(root, [1.05, 0.32, 0.12], [0, 5.63, -0.78], mat.plaque, 'YellowCrane_Front_Plaque')
  addCurvedHipRoof(root, 2.25, 1.55, 6.0, 0.55, 'Top_Crown_Yellow_Glazed_Roof', high)
  beam(root, [0, 6.58, -0.7], [0, 6.58, 0.7], 0.035, mat.roofLight, 'Top_Ridge_Crossbar')
  cylinder(root, 0.04, 0.055, 0.86, [0, 6.88, 0], mat.roofLight, 'Roof_Finial_Shaft')
  root.add(mesh(new THREE.SphereGeometry(0.12, high ? 18 : 10, high ? 12 : 8), mat.roofLight, 'Roof_Finial_Jewel', [0, 7.36, 0]))

  root.rotation.y = -0.18
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
for (const level of ['low', 'medium', 'high']) {
  await exportScene(createTower(level), `model-${level}.glb`)
}
console.log(`Generated Yellow Crane Tower assets in ${outputDir}`)
