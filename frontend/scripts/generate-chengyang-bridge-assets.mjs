import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((result) => { this.result = result; this.onloadend?.() }) }
}

const outputDir = resolve(fileURLToPath(new URL('../public/models/chengyang-wind-rain-bridge', import.meta.url)))
const mat = {
  wood: new THREE.MeshStandardMaterial({ color: 0x6f3e24, roughness: 0.78, name: '侗族木构桥身' }),
  woodLight: new THREE.MeshStandardMaterial({ color: 0xa96a3e, roughness: 0.7, name: '木构檐口' }),
  roof: new THREE.MeshStandardMaterial({ color: 0x3f2f24, roughness: 0.9, name: '灰瓦屋面' }),
  roofEdge: new THREE.MeshStandardMaterial({ color: 0x8a5a35, roughness: 0.72, name: '屋脊与翘檐' }),
  stone: new THREE.MeshStandardMaterial({ color: 0x9b8a70, roughness: 0.94, name: '河岸与桥墩石材' }),
  water: new THREE.MeshStandardMaterial({ color: 0x1d6470, roughness: 0.22, metalness: 0.12, transparent: true, opacity: 0.72, name: '浔江水面' }),
  dark: new THREE.MeshStandardMaterial({ color: 0x201713, roughness: 0.92, name: '室内阴影' }),
}
function mesh(geometry, material, name, position = [0,0,0], rotation = [0,0,0]) {
  const item = new THREE.Mesh(geometry, material); item.name = name; item.position.set(...position); item.rotation.set(...rotation); item.castShadow = true; item.receiveShadow = true; return item
}
function box(group, size, position, material, name, rotation = [0,0,0]) { const item = mesh(new THREE.BoxGeometry(...size), material, name, position, rotation); group.add(item); return item }
function cylinder(group, radiusTop, radiusBottom, height, position, material, name, radialSegments = 10) { const item = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material, name); item.position.set(...position); group.add(item); return item }
function beam(group, start, end, radius, material, name, sides = 8) { const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), direction = b.clone().sub(a); const item = mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), sides), material, name); item.position.copy(a.add(b).multiplyScalar(0.5)); item.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction.normalize()); group.add(item); return item }
function roof(group, width, depth, baseY, height, name, detail) {
  const eW = width + 0.5, eD = depth + 0.38, mW = width * 0.55, mD = depth * 0.5
  const p = new Float32Array([-eW/2,baseY,-eD/2,eW/2,baseY,-eD/2,eW/2,baseY,eD/2,-eW/2,baseY,eD/2,-mW/2,baseY+height*.45,-mD/2,mW/2,baseY+height*.45,-mD/2,mW/2,baseY+height*.45,mD/2,-mW/2,baseY+height*.45,mD/2])
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p,3)); g.setIndex([0,4,1,1,4,5,1,5,2,2,5,6,2,6,3,3,6,7,3,7,0,0,7,4,4,7,5,5,7,6]); g.computeVertexNormals(); group.add(mesh(g, mat.roof, name))
  box(group,[eW+.16,.1,.16],[0,baseY-.02,-eD/2],mat.roofEdge,`${name}_front_eave`); box(group,[eW+.16,.1,.16],[0,baseY-.02,eD/2],mat.roofEdge,`${name}_back_eave`)
  box(group,[.16,.1,eD+.16],[-eW/2,baseY-.02,0],mat.roofEdge,`${name}_left_eave`); box(group,[.16,.1,eD+.16],[eW/2,baseY-.02,0],mat.roofEdge,`${name}_right_eave`)
  if (detail) for (const z of [-eD/2,eD/2]) for (let x=-eW/2+.35;x<=eW/2-.35;x+=.45) box(group,[.14,.06,.12],[x,baseY+.03,z],mat.roofEdge,`${name}_tile_${x}_${z}`)
}
function addPavilion(group, x, z, scale, detail) {
  const w=2.0*scale,d=1.7*scale,y=.7
  box(group,[w,.16,d],[x,.18,z],mat.woodLight,'Pavilion_platform')
  for (const xx of [-w*.42,w*.42]) for (const zz of [-d*.42,d*.42]) cylinder(group,.075*scale,.09*scale,1.1*scale,[x+xx,.82*scale,z+zz],mat.wood,'Pavilion_column',8)
  box(group,[w+.15,.12,.14],[x,1.37*scale,z-d*.47],mat.wood,'Pavilion_beam_front'); box(group,[w+.15,.12,.14],[x,1.37*scale,z+d*.47],mat.wood,'Pavilion_beam_back')
  roof(group,w,d,1.5*scale,.55*scale,'Pavilion_roof',detail)
}
function createBridge(level) {
  const detail=level!=='low', high=level==='high'; const scene=new THREE.Scene(); scene.name=`程阳风雨桥 · ${level} LOD`; const root=new THREE.Group(); root.name='Chengyang_Wind_Rain_Bridge'
  box(root,[16,.18,8],[0,.03,0],mat.water,'浔江水面')
  box(root,[14,.34,2.4],[0,.35,0],mat.stone,'Bridge_Stone_Deck')
  for (const x of [-5.6,-2.8,0,2.8,5.6]) { box(root,[.7,1.5,2.5],[x,1.05,0],mat.stone,'Stone_Pier'); box(root,[.85,.15,2.7],[x,1.78,0],mat.woodLight,'Pier_Cap') }
  box(root,[14,.3,3.1],[0,2.0,0],mat.wood,'Covered_Walkway_Floor')
  const bays=[-5.25,-3.5,-1.75,0,1.75,3.5,5.25]
  for (const x of bays) {
    for (const z of [-1.15,1.15]) cylinder(root,.08,.1,2.25,[x,3.15,z],mat.wood,`Timber_Column_${x}_${z}`,8)
    box(root,[1.55,.13,.14],[x,4.2,-1.15],mat.woodLight,'Front_Beam'); box(root,[1.55,.13,.14],[x,4.2,1.15],mat.woodLight,'Back_Beam')
    if (detail) { box(root,[1.55,1.25,.12],[x,3.1,-1.16],mat.dark,'Front_Shadow_Bay'); box(root,[1.55,1.25,.12],[x,3.1,1.16],mat.dark,'Back_Shadow_Bay') }
  }
  box(root,[13.2,.12,.14],[0,2.35,-1.32],mat.woodLight,'Front_Railing'); box(root,[13.2,.12,.14],[0,2.35,1.32],mat.woodLight,'Back_Railing')
  for (const x of bays) { cylinder(root,.035,.045,0.7,[x,2.0,-1.32],mat.woodLight,'Front_Rail_Post',8); cylinder(root,.035,.045,.7,[x,2.0,1.32],mat.woodLight,'Back_Rail_Post',8) }
  roof(root,13.7,3.35,4.28,1.05,'Main_Wind_Rain_Roof',detail)
  for (const x of [-5.25,0,5.25]) addPavilion(root,x,0,high?1.0:.9,detail)
  for (const x of [-6.8,6.8]) { box(root,[.55,.8,2.1],[x,.75,0],mat.stone,'Entrance_Stone_Block'); roof(root,1.4,2.1,1.2,.48,'Entrance_Roof',detail) }
  root.rotation.y=-.12; scene.add(root); return scene
}
async function exportScene(scene, filename) { const exporter=new GLTFExporter(); const result=await new Promise((resolveExport,reject)=>exporter.parse(scene,resolveExport,reject,{binary:true,trs:false,onlyVisible:true})); await writeFile(resolve(outputDir,filename),Buffer.from(result)) }
await mkdir(outputDir,{recursive:true}); for(const level of ['low','medium','high']) await exportScene(createBridge(level),`model-${level}.glb`); console.log(`Generated Chengyang bridge assets in ${outputDir}`)
