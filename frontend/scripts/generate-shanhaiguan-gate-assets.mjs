import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

globalThis.FileReader = class { readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.() }) } }
const outputDir = resolve(fileURLToPath(new URL('../public/models/shanhaiguan-town-east', import.meta.url)))
const mats = {
  stone: new THREE.MeshStandardMaterial({ color: 0x8d795f, roughness: 0.88, name: 'Weathered city wall stone' }),
  light: new THREE.MeshStandardMaterial({ color: 0xb39a73, roughness: 0.8, name: 'Cut stone highlights' }),
  brick: new THREE.MeshStandardMaterial({ color: 0x873b2e, roughness: 0.76, name: 'Red brick' }),
  red: new THREE.MeshStandardMaterial({ color: 0xb35d3f, roughness: 0.68, name: 'Sunlit brick' }),
  roof: new THREE.MeshStandardMaterial({ color: 0x383431, roughness: 0.86, metalness: 0.08, name: 'Grey tiled roof' }),
  trim: new THREE.MeshStandardMaterial({ color: 0xc39a5d, roughness: 0.48, metalness: 0.2, name: 'Roof ridge detail' }),
  dark: new THREE.MeshStandardMaterial({ color: 0x171315, roughness: 0.94, name: 'Deep openings' }),
}
function mesh(g, m, name, p = [0, 0, 0]) { const x = new THREE.Mesh(g, m); x.name = name; x.position.set(...p); x.castShadow = true; x.receiveShadow = true; return x }
function box(g, s, p, m, n) { g.add(mesh(new THREE.BoxGeometry(...s), m, n, p)) }
function pyramid(g, r, h, y, m, n) { const x = mesh(new THREE.ConeGeometry(r, h, 4), m, n, [0, y, 0]); x.rotation.y = Math.PI / 4; g.add(x) }
function scene(level) {
  const detail = level !== 'low'; const fine = level === 'high'; const s = new THREE.Scene(); s.name = `Shanhaiguan Town East Tower · ${level} LOD`; const g = new THREE.Group(); g.name = 'Building_Main'
  box(g, [13.2, .36, 6.4], [0, .18, 0], mats.dark, 'CityWall_ShadowBase'); box(g, [12.2, .38, 6.8], [0, .52, 0], mats.stone, 'CityWall_Platform')
  box(g, [15.8, 1.12, 1.3], [0, 1.15, -3.55], mats.light, 'Eastern_Approach_Wall')
  for (let x = -7.2; x <= 7.2; x += detail ? 1.35 : 1.8) box(g, [.62, .56, 1.5], [x, 1.88, -3.55], mats.light, `Approach_Crenel_${x}`)
  // 镇东楼本体是一座单体箭楼：厚重城台、上下两层楼体、三面箭窗和单檐歇山顶。
  box(g, [10.2, 0.62, 19.1], [0, 1.28, 0], mats.stone, 'TownEast_12m_CityPlatform')
  box(g, [8.9, 0.36, 17.8], [0, 1.77, 0], mats.light, 'TownEast_Platform_Coping')
  box(g, [10.0, 2.25, 18.2], [0, 3.0, 0], mats.brick, 'TownEast_LowerStory')
  box(g, [10.0, 2.25, 18.2], [0, 5.34, 0], mats.red, 'TownEast_UpperStory')
  // Side/back arrow slits. The front west face carries the large plaque area.
  const faces = [{ side: 'north', z: -9.17, along: 'x' }, { side: 'south', z: 9.17, along: 'x' }, { side: 'east', x: 5.02, along: 'z' }]
  for (const face of faces) {
    const count = fine ? 9 : detail ? 7 : 5
    for (let i = 0; i < count; i += 1) {
      const t = (i - (count - 1) / 2) * (face.along === 'x' ? 1.85 : 1.55)
      const p = face.along === 'x' ? [t, 3.05, face.z] : [face.x, 3.05, t]
      box(g, [face.along === 'x' ? .36 : .16, .58, face.along === 'x' ? .16 : .36], p, mats.dark, `ArrowSlit_${face.side}_lower_${i}`)
      const p2 = face.along === 'x' ? [t, 5.4, face.z] : [face.x, 5.4, t]
      box(g, [face.along === 'x' ? .36 : .16, .58, face.along === 'x' ? .16 : .36], p2, mats.dark, `ArrowSlit_${face.side}_upper_${i}`)
    }
  }
  box(g, [10.5, .34, 18.9], [0, 6.55, 0], mats.trim, 'TownEast_Eave_Band')
  pyramid(g, 7.2, 2.0, 7.62, mats.roof, 'TownEast_SingleHipRoof')
  box(g, [10.5, .22, 2.6], [0, 7.05, -7.0], mats.roof, 'TownEast_Roof_Ridge')
  if (fine) for (const y of [.88, 1.18, 1.48, 1.78, 2.08, 2.38, 2.68, 2.98, 3.28]) box(g, [10.2, .035, .04], [0, y, 1.07], mats.red, `Front_Brick_Course_${y}`)
  g.rotation.y = -.16; s.add(g); return s
}
async function save(s, name) { const e = new GLTFExporter(); const b = await new Promise((ok, no) => e.parse(s, ok, no, { binary: true, trs: false, onlyVisible: true })); await writeFile(resolve(outputDir, name), Buffer.from(b)) }
await mkdir(outputDir, { recursive: true }); for (const level of ['low', 'medium', 'high']) await save(scene(level), `model-${level}.glb`); console.log(`Generated assets in ${outputDir}`)
