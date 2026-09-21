import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

// GLTFExporter is browser-first. Node 20+ provides Blob, so this small shim is
// enough for the binary writer and keeps the asset generation reproducible.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
}

const outputDir = resolve('frontend/public/models/kaifeng-iron-pagoda')
const bronze = new THREE.MeshStandardMaterial({ color: 0x70503d, roughness: 0.58, metalness: 0.16, name: 'Glazed brick · warm iron tone' })
const bronzeLight = new THREE.MeshStandardMaterial({ color: 0x9a6a49, roughness: 0.5, metalness: 0.18, name: 'Glazed brick highlight' })
const shadow = new THREE.MeshStandardMaterial({ color: 0x261d1a, roughness: 0.82, metalness: 0.08, name: 'Deep reveal' })
const gold = new THREE.MeshStandardMaterial({ color: 0xa98755, roughness: 0.36, metalness: 0.45, name: 'Weathered metal detail' })
const pale = new THREE.MeshStandardMaterial({ color: 0xb98a5d, roughness: 0.62, metalness: 0.12, name: 'Carved brick' })

function mesh(geometry, material, name, position = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material)
  item.name = name
  item.position.set(...position)
  item.castShadow = true
  item.receiveShadow = true
  return item
}

function addWindow(parent, width, y, side, index, detail) {
  const inset = width * 0.43
  const w = detail ? 0.3 : 0.22
  const h = detail ? 0.36 : 0.28
  const d = 0.055
  const z = side === 'front' ? -inset : inset
  const x = side === 'left' ? -inset : side === 'right' ? inset : 0
  const horizontal = side === 'front' || side === 'back'
  const geometry = new THREE.BoxGeometry(horizontal ? w : d, h, horizontal ? d : w)
  const item = mesh(geometry, shadow, `Floor_${String(index + 1).padStart(2, '0')}_${side}_opening`)
  item.position.set(x, y, z)
  parent.add(item)
  if (detail) {
    const frameMaterial = pale
    const frame = new THREE.Group()
    frame.name = `Floor_${String(index + 1).padStart(2, '0')}_${side}_frame`
    const frameThickness = 0.035
    const bars = [
      mesh(new THREE.BoxGeometry(horizontal ? w + 0.08 : frameThickness, frameThickness, horizontal ? frameThickness : w + 0.08), frameMaterial, 'frame-top', [x, y + h / 2, z]),
      mesh(new THREE.BoxGeometry(horizontal ? w + 0.08 : frameThickness, frameThickness, horizontal ? frameThickness : w + 0.08), frameMaterial, 'frame-bottom', [x, y - h / 2, z]),
    ]
    bars.forEach((bar) => frame.add(bar))
    parent.add(frame)
  }
}

function addBrickCourses(parent, width, y, index) {
  const courseCount = 2
  for (let course = 0; course < courseCount; course += 1) {
    const courseY = y - 0.12 + course * 0.24
    for (const side of ['front', 'back', 'left', 'right']) {
      const horizontal = side === 'front' || side === 'back'
      const length = width * 0.82
      const brickCount = 7
      for (let brick = 0; brick < brickCount; brick += 1) {
        const offset = (brick - (brickCount - 1) / 2) * (length / brickCount)
        const x = horizontal ? offset : (side === 'left' ? -width * 0.41 : width * 0.41)
        const z = horizontal ? (side === 'front' ? -width * 0.41 : width * 0.41) : offset
        const item = mesh(new THREE.BoxGeometry(horizontal ? length / brickCount - 0.018 : 0.018, 0.035, horizontal ? 0.018 : length / brickCount - 0.018), (brick + course) % 2 ? bronzeLight : pale, `Floor_${String(index + 1).padStart(2, '0')}_${side}_brick_${course}_${brick}`, [x, courseY, z])
        parent.add(item)
      }
    }
  }
}

function createPagoda(level) {
  const scene = new THREE.Scene()
  scene.name = `Kaifeng Iron Pagoda · ${level} LOD`
  const root = new THREE.Group()
  root.name = 'Building_Main'
  const floorCount = level === 'low' ? 7 : 13
  const detail = level === 'high'
  const floorHeight = 0.62
  const floorGap = 0.18

  root.add(mesh(new THREE.CylinderGeometry(2.18, 2.42, 0.44, 12), bronze, 'Foundation_Platform', [0, 0.22, 0]))
  root.add(mesh(new THREE.CylinderGeometry(1.86, 2.1, 0.34, 12), bronzeLight, 'Foundation_Step', [0, 0.56, 0]))

  for (let index = 0; index < floorCount; index += 1) {
    const width = 2.78 - index * (level === 'low' ? 0.14 : 0.105)
    const y = 0.88 + index * (floorHeight + floorGap)
    const floor = new THREE.Group()
    floor.name = `Floor_${String(index + 1).padStart(2, '0')}`
    floor.add(mesh(new THREE.BoxGeometry(width, floorHeight, width), index % 2 ? bronze : bronzeLight, 'GlazedBrickBody', [0, y, 0]))
    floor.add(mesh(new THREE.BoxGeometry(width + 0.32, 0.11, width + 0.32), gold, 'Eave_Band', [0, y + floorHeight / 2 + 0.055, 0]))
    const roof = mesh(new THREE.ConeGeometry(width * 0.72, 0.42, 4), index % 2 ? bronzeLight : gold, 'Roof_Eave', [0, y + floorHeight / 2 + 0.27, 0])
    roof.rotation.y = Math.PI / 4
    floor.add(roof)

    if (level !== 'low') {
      addWindow(floor, width, y + 0.02, 'front', index, detail)
      addWindow(floor, width, y + 0.02, 'back', index, detail)
      addWindow(floor, width, y + 0.02, 'left', index, detail)
      addWindow(floor, width, y + 0.02, 'right', index, detail)
    }
    if (detail) addBrickCourses(floor, width, y, index)
    for (const x of [-width * 0.42, width * 0.42]) {
      for (const z of [-width * 0.42, width * 0.42]) {
        floor.add(mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.42, 8), pale, 'Corner_Pillar', [x, y + 0.16, z]))
      }
    }
    root.add(floor)
  }

  const topY = 0.88 + (floorCount - 1) * (floorHeight + floorGap) + floorHeight + 0.55
  const shaft = mesh(new THREE.CylinderGeometry(0.055, 0.08, 2.3, 10), gold, 'Finial_Shaft', [0, topY + 0.85, 0])
  root.add(shaft)
  root.add(mesh(new THREE.SphereGeometry(0.18, detail ? 20 : 10, detail ? 14 : 8), gold, 'Finial_Jewel', [0, topY + 2.05, 0]))
  root.add(mesh(new THREE.ConeGeometry(0.45, 0.48, detail ? 16 : 8), gold, 'Finial_Crown', [0, topY + 0.1, 0]))
  root.rotation.y = -0.24
  scene.add(root)
  return scene
}

async function exportScene(scene, filename) {
  const exporter = new GLTFExporter()
  const result = await new Promise((resolveExport, reject) => exporter.parse(scene, resolveExport, reject, { binary: true, trs: false, onlyVisible: true }))
  await writeFile(resolve(outputDir, filename), Buffer.from(result))
}

await mkdir(outputDir, { recursive: true })
for (const level of ['low', 'medium', 'high']) {
  await exportScene(createPagoda(level), `model-${level}.glb`)
}
console.log(`Generated Kaifeng pagoda reconstruction assets in ${outputDir}`)
