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

const pagodas = {
  'yingxian-wooden-pagoda': {
    sceneName: 'Yingxian Wooden Pagoda',
    levels: 5,
    levelStep: 1.08,
    baseWidth: 4.45,
    taper: 0.42,
    materials: {
      body: new THREE.MeshStandardMaterial({ color: 0x70402c, roughness: 0.72, metalness: 0.04, name: 'Aged timber body' }),
      bodyAlt: new THREE.MeshStandardMaterial({ color: 0xa3603c, roughness: 0.68, metalness: 0.03, name: 'Sunlit timber frame' }),
      roof: new THREE.MeshStandardMaterial({ color: 0x3b2521, roughness: 0.78, metalness: 0.08, name: 'Dark timber tiled roof' }),
      trim: new THREE.MeshStandardMaterial({ color: 0xc69b5f, roughness: 0.42, metalness: 0.4, name: 'Bracket and ridge detail' }),
      base: new THREE.MeshStandardMaterial({ color: 0xcfaa7a, roughness: 0.6, metalness: 0.1, name: 'Stone plinth' }),
      shadow: new THREE.MeshStandardMaterial({ color: 0x312b28, roughness: 0.77, metalness: 0.18, name: 'Deep timber reveal' }),
    },
  },
  'xian-big-wild-goose-pagoda': {
    sceneName: 'Giant Wild Goose Pagoda',
    levels: 7,
    levelStep: 0.88,
    baseWidth: 3.9,
    taper: 0.3,
    materials: {
      body: new THREE.MeshStandardMaterial({ color: 0xaa8d67, roughness: 0.8, metalness: 0.02, name: 'Weathered rammed-brick body' }),
      bodyAlt: new THREE.MeshStandardMaterial({ color: 0xc4a77a, roughness: 0.82, metalness: 0.01, name: 'Pale brick highlight' }),
      roof: new THREE.MeshStandardMaterial({ color: 0x6d5844, roughness: 0.84, metalness: 0.02, name: 'Muted brick eave' }),
      trim: new THREE.MeshStandardMaterial({ color: 0xc4a77a, roughness: 0.82, metalness: 0.01, name: 'Door arch trim' }),
      base: new THREE.MeshStandardMaterial({ color: 0xc4a77a, roughness: 0.82, metalness: 0.01, name: 'Tower base brick' }),
      shadow: new THREE.MeshStandardMaterial({ color: 0x312b28, roughness: 0.77, metalness: 0.18, name: 'Deep doorway reveal' }),
    },
  },
}

function mesh(geometry, material, name, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material)
  item.name = name
  item.position.set(...position)
  item.castShadow = true
  item.receiveShadow = true
  return item
}

function box(group, size, position, material, name) {
  group.add(mesh(new THREE.BoxGeometry(...size), material, name, position))
}

function roof(group, radius, height, y, material, rotation = Math.PI / 4) {
  const item = mesh(new THREE.ConeGeometry(radius, height, 4), material, 'Roof_Eave', [0, y, 0])
  item.rotation.y = rotation
  group.add(item)
}

function column(group, x, y, z, height, material, radius = 0.1) {
  const item = mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 10), material, 'Timber_Column')
  item.position.set(x, y + height / 2, z)
  group.add(item)
}

function finials(group, width, y, material) {
  for (const x of [-width / 2, width / 2]) {
    for (const z of [-width / 2, width / 2]) {
      group.add(mesh(new THREE.ConeGeometry(0.07, 0.3, 6), material, 'Corner_Finial', [x, y, z]))
    }
  }
}

function createPagoda(id, level) {
  const config = pagodas[id]
  const { materials } = config
  const scene = new THREE.Scene()
  scene.name = `${config.sceneName} · ${level} LOD`
  const root = new THREE.Group()
  root.name = 'Building_Main'
  const isYingxian = id === 'yingxian-wooden-pagoda'
  const lodScale = level === 'low' ? 0.72 : level === 'medium' ? 0.9 : 1

  box(root, [config.baseWidth + 0.7, 0.3, config.baseWidth + 0.7], [0, 0.15, 0], materials.base, 'Foundation_Platform')

  for (let i = 0; i < config.levels; i += 1) {
    const width = config.baseWidth - i * config.taper
    const baseY = 0.5 + i * config.levelStep
    const bodyMaterial = i % 2 ? materials.body : materials.bodyAlt
    const floor = new THREE.Group()
    floor.name = `Floor_${String(i + 1).padStart(2, '0')}`
    box(floor, [width, isYingxian ? 0.66 : 0.56, width], [0, baseY, 0], bodyMaterial, 'Floor_Body')
    box(floor, [width + (isYingxian ? 0.62 : 0.38), 0.12, width + (isYingxian ? 0.62 : 0.38)], [0, baseY + (isYingxian ? 0.38 : 0.31), 0], materials.trim, 'Eave_Band')
    roof(floor, width * (isYingxian ? 0.84 : 0.76), isYingxian ? 0.42 : 0.52, baseY + (isYingxian ? 0.7 : 0.62), materials.roof, isYingxian ? Math.PI / 4 : 0)

    if (isYingxian) {
      for (const x of [-width * 0.43, width * 0.43]) {
        for (const z of [-width * 0.43, width * 0.43]) {
          column(floor, x, baseY - 0.02, z, 0.56, materials.trim, 0.1)
          if (level !== 'low') box(floor, [0.5, 0.12, 0.18], [x, baseY + 0.46, z], materials.trim, 'Bracket_Block')
        }
      }
      box(floor, [width * 0.55, 0.16, 0.08], [0, baseY + 0.12, -width * 0.51], materials.shadow, 'Timber_Window_Reveal')
      if (level === 'high') {
        for (const x of [-width * 0.22, 0, width * 0.22]) box(floor, [0.08, 0.32, 0.09], [x, baseY + 0.16, -width * 0.53], materials.trim, 'Lattice_Mullion')
      }
    } else {
      const arch = mesh(new THREE.TorusGeometry(Math.max(0.28, width * 0.16), 0.075, 10, Math.round(20 * lodScale), Math.PI), materials.trim, 'Arched_Door_Frame')
      arch.position.set(0, baseY + 0.2, -width * 0.515)
      arch.rotation.z = Math.PI
      floor.add(arch)
      box(floor, [width * 0.22, 0.45, 0.08], [0, baseY + 0.07, -width * 0.52], materials.shadow, 'Door_Reveal')
      if (level === 'high') {
        for (const side of ['front', 'back']) {
          const z = side === 'front' ? -width * 0.515 : width * 0.515
          box(floor, [width * 0.62, 0.045, 0.055], [0, baseY + 0.16, z], materials.trim, `${side}_Brick_Course`)
        }
      }
    }

    root.add(floor)
  }

  const towerHeight = 0.82 + (config.levels - 1) * config.levelStep + (isYingxian ? 0.82 : 0.7)
  box(root, [isYingxian ? 0.58 : 0.48, towerHeight, isYingxian ? 0.58 : 0.48], [0, towerHeight / 2, 0], isYingxian ? materials.shadow : materials.body, 'Central_Shaft')
  roof(root, isYingxian ? 1.25 : 1.45, 0.62, towerHeight + 0.08, materials.roof)
  finials(root, isYingxian ? 1.55 : 1.7, towerHeight + 0.46, materials.trim)
  root.rotation.y = -0.24
  scene.add(root)
  return scene
}

async function exportScene(scene, outputDir, filename) {
  const exporter = new GLTFExporter()
  const result = await new Promise((resolveExport, reject) => {
    exporter.parse(scene, resolveExport, reject, { binary: true, trs: false, onlyVisible: true })
  })
  await writeFile(resolve(outputDir, filename), Buffer.from(result))
}

for (const id of Object.keys(pagodas)) {
  const outputDir = resolve(fileURLToPath(new URL('../public/models', import.meta.url)), id)
  await mkdir(outputDir, { recursive: true })
  for (const level of ['low', 'medium', 'high']) {
    await exportScene(createPagoda(id, level), outputDir, `model-${level}.glb`)
  }
  console.log(`Generated ${id} reconstruction assets in ${outputDir}`)
}
