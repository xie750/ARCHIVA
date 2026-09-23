<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { disposeObject3D, loadModelAsset, type BrowserModelManifest } from '../../services/modelLoader'
import { applyProceduralHeritageMaterials, disposeProceduralMaterialCache } from '../../services/proceduralMaterials'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

const props = withDefaults(defineProps<{
  kind: 'grotto' | 'temple' | 'gate' | 'pagoda' | 'pavilion' | 'garden' | 'street'
  variant?: string
  /** A reviewed GLB URL. The procedural scene remains the explicit fallback. */
  assetUrl?: string
  /** Endpoint returning a ModelManifest with a lod[] array. */
  manifestUrl?: string
  /** Official third-party viewer embed. Used when the source does not allow GLB redistribution. */
  embedUrl?: string
  /** Landmark name shown in the viewer HUD so every city has a clear 3D identity. */
  title?: string
}>(), { assetUrl: undefined, manifestUrl: undefined, variant: undefined })
// Every pagoda is a hero landmark in the atlas, whether it is backed by a
// reviewed GLB or by the procedural reconstruction.  Keeping the showcase
// treatment for both paths makes the five-storey timber tower and the
// seven-storey brick tower feel intentional instead of falling back to the
// generic scene palette while the project is still collecting scans.
const isPagodaShowcase = computed(() => props.kind === 'pagoda')
const mount = ref<HTMLDivElement | null>(null)
const autoRotate = ref(true)
const wireframe = ref(false)
const scanEnabled = ref(true)
const immersive = ref(false)
const showPresets = ref(false)
const loadedRealAsset = ref(false)
const assetManifest = ref<BrowserModelManifest | undefined>()
const assetLod = ref('')
const viewerState = ref('概念模型 · 交互预览')
const modelStatus = ref('形制示意 · 等待审核资产')
const loadProgress = ref(0)
const loadingAsset = ref(false)
const externalEmbed = computed(() => props.embedUrl)
const hasReviewedAsset = computed(() => Boolean((props.assetUrl && !props.assetUrl.includes('cdn.example.com')) || props.manifestUrl))
const assetBadge = computed(() => {
  if (externalEmbed.value) return 'PLATFORM 3D'
  if (loadedRealAsset.value) return assetManifest.value?.versionStatus === 'PUBLISHED' ? 'REVIEWED GLB' : 'RECONSTRUCTION GLB'
  return hasReviewedAsset.value ? 'GLB READY' : 'CONCEPT MODEL'
})
const modelLabel = computed(() => ({ grotto: '石窟群 · 空间扫描', temple: '寺院轴线 · 形制复原', gate: '城门遗址 · 形制复原', pagoda: '楼阁古塔 · 构件扫描', pavilion: '临江名楼 · 形制复原', garden: '宋式园林 · 场景复原', street: '宋代街市 · 场景复原' }[props.kind]))
const displayLabel = computed(() => props.title ? `${props.title} · ${modelLabel.value}` : modelLabel.value)
type CameraPreset = 'overview' | 'detail' | 'axis' | 'top'
type Hotspot = { id: string; label: string; description: string; placement: string; preset: CameraPreset }
const hotspots = computed<Hotspot[]>(() => [
  { id: '01', label: '主体形制', description: '整体体量与屋顶关系', placement: 'hotspot-one', preset: 'overview' },
  { id: '02', label: '构件节点', description: '进入檐口与构件细部', placement: 'hotspot-two', preset: 'detail' },
  { id: '03', label: '空间轴线', description: '沿中轴线观察空间秩序', placement: 'hotspot-three', preset: 'axis' },
])
let renderer: THREE.WebGLRenderer | undefined
let controls: OrbitControls | undefined
let camera: THREE.PerspectiveCamera | undefined
let frame = 0
let cleanup = () => undefined
let loadedModel: THREE.Object3D | undefined
let requestController: AbortController | undefined
let animationRunning = false
let viewerVisible = true
let lastRenderAt = 0
let visibilityObserver: IntersectionObserver | undefined
let documentVisibilityHandler: (() => void) | undefined
let sceneForAnimation: THREE.Scene | undefined
let groupForAnimation: THREE.Group | undefined
let particlesForAnimation: THREE.Points | undefined
let scanBeamForAnimation: THREE.Mesh | undefined
let lowPowerDevice = false
let initialCamera = new THREE.Vector3(9, 6.5, 11)
let initialTarget = new THREE.Vector3(0, 2, 0)
const trackedMaterials: THREE.Material[] = []
const animatedRings: Array<{ mesh: THREE.Mesh; speed: number; baseY: number }> = []
let scanMaterial: THREE.MeshBasicMaterial | undefined
let fullscreenHandler: (() => void) | undefined
let resizeObserver: ResizeObserver | undefined
let environmentMap: THREE.Texture | undefined
let immersiveCameraSnapshot: { position: THREE.Vector3; target: THREE.Vector3 } | undefined
let cameraTransitionFrame = 0
let modelFocusTarget = new THREE.Vector3(0, 2, 0)
let modelFitDistance = 14
let modelDefaultFrame: { position: THREE.Vector3; target: THREE.Vector3 } | undefined
function registerMaterial(material: THREE.Material) { if (!trackedMaterials.includes(material)) trackedMaterials.push(material); return material }
function setMeshProps(mesh: THREE.Mesh) { mesh.castShadow = true; mesh.receiveShadow = true; if (Array.isArray(mesh.material)) mesh.material.forEach(registerMaterial); else registerMaterial(mesh.material); return mesh }
function addBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) { const mesh = setMeshProps(new THREE.Mesh(new THREE.BoxGeometry(...size), material)); mesh.position.set(...position); group.add(mesh); return mesh }
function addRoof(group: THREE.Group, radius: number, height: number, y: number, material: THREE.Material, rotation = Math.PI / 4, x = 0, z = 0) { const mesh = setMeshProps(new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), material)); mesh.rotation.y = rotation; mesh.position.set(x, y, z); group.add(mesh); return mesh }
function addHipRoof(group: THREE.Group, width: number, depth: number, baseY: number, height: number, roofMaterial: THREE.Material, trimOrX: THREE.Material | number = roofMaterial, x = 0, z = 0) {
  const trimMaterial = typeof trimOrX === 'number' ? roofMaterial : trimOrX
  if (typeof trimOrX === 'number') { z = x; x = trimOrX }
  const roofGroup = new THREE.Group()
  roofGroup.position.set(x, 0, z)
  group.add(roofGroup)
  const roofWidth = width + 0.72
  const roofDepth = depth + 0.7
  const ridgeHalf = Math.max(0.58, width * 0.22)
  const positions = new Float32Array([
    -roofWidth / 2, baseY, -roofDepth / 2, roofWidth / 2, baseY, -roofDepth / 2,
    roofWidth / 2, baseY, roofDepth / 2, -roofWidth / 2, baseY, roofDepth / 2,
    -ridgeHalf, baseY + height, 0, ridgeHalf, baseY + height, 0,
  ])
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex([0, 1, 5, 0, 5, 4, 3, 4, 5, 3, 5, 2, 1, 2, 5, 0, 3, 4])
  geometry.computeVertexNormals()
  roofGroup.add(setMeshProps(new THREE.Mesh(geometry, roofMaterial)))
  addBox(roofGroup, [roofWidth + 0.18, 0.14, 0.17], [0, baseY - 0.04, -roofDepth / 2], trimMaterial)
  addBox(roofGroup, [roofWidth + 0.18, 0.14, 0.17], [0, baseY - 0.04, roofDepth / 2], trimMaterial)
  addBox(roofGroup, [ridgeHalf * 2 + 0.22, 0.14, 0.18], [0, baseY + height + 0.05, 0], trimMaterial)
  for (const cornerX of [-roofWidth / 2, roofWidth / 2]) for (const cornerZ of [-roofDepth / 2, roofDepth / 2]) {
    const tip = addBox(roofGroup, [0.14, 0.12, 0.62], [cornerX, baseY + 0.1, cornerZ], trimMaterial)
    tip.rotation.x = cornerZ > 0 ? -0.24 : 0.24
    tip.rotation.z = cornerX > 0 ? -0.08 : 0.08
  }
  return roofGroup
}
function addLine(group: THREE.Group, points: THREE.Vector3[], color: number, opacity = 0.45) { const geometry = new THREE.BufferGeometry().setFromPoints(points); const material = registerMaterial(new THREE.LineBasicMaterial({ color, transparent: true, opacity })) as THREE.LineBasicMaterial; const line = new THREE.Line(geometry, material); group.add(line); return line }
function addTechRing(group: THREE.Group, radius: number, y: number, color: number, speed: number) { const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.56, side: THREE.DoubleSide }); registerMaterial(material); const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.015, radius, 96), material); ring.rotation.x = -Math.PI / 2; ring.position.y = y; group.add(ring); animatedRings.push({ mesh: ring, speed, baseY: y }); return ring }
function addFinials(group: THREE.Group, width: number, y: number, material: THREE.Material) { for (const x of [-width / 2, width / 2]) for (const z of [-width / 2, width / 2]) { const finial = setMeshProps(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), material)); finial.position.set(x, y, z); group.add(finial) } }
function addColumn(group: THREE.Group, x: number, y: number, z: number, height: number, material: THREE.Material, radius = 0.12) {
  const column = setMeshProps(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 10), material))
  column.position.set(x, y + height / 2, z)
  group.add(column)
  return column
}
function addWindow(group: THREE.Group, x: number, y: number, z: number, width: number, height: number, material: THREE.Material) {
  const window = addBox(group, [width, height, 0.08], [x, y, z], material)
  addBox(group, [0.055, height + 0.08, 0.1], [x, y, z - 0.06], material)
  addBox(group, [width + 0.08, 0.055, 0.1], [x, y, z - 0.06], material)
  return window
}

type ViewerQuality = { pixelRatio: number; shadows: boolean; particleCount: number }

function viewerQuality(): ViewerQuality {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } }
  const memory = nav.deviceMemory ?? 4
  const constrained = Boolean(nav.connection?.saveData || /(^|-)2g$/.test(nav.connection?.effectiveType ?? ''))
  const cpuConstrained = (navigator.hardwareConcurrency ?? 4) <= 2
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const mobile = window.matchMedia('(max-width: 700px)').matches
  const lowPower = memory <= 2 || constrained || cpuConstrained || reducedMotion
  return {
    pixelRatio: lowPower ? 1 : Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5),
    shadows: !lowPower,
    particleCount: lowPower ? 70 : mobile ? 110 : 170,
  }
}

function buildScene(kind: typeof props.kind, quality: ViewerQuality) {
  animatedRings.length = 0
  trackedMaterials.length = 0
  scanMaterial = undefined
  const scene = new THREE.Scene()
  const pagodaShowcase = kind === 'pagoda'
  const pavilionShowcase = kind === 'pavilion'
  const gateShowcase = kind === 'gate'
  const grottoShowcase = kind === 'grotto'
  const gardenShowcase = kind === 'garden'
  const streetShowcase = kind === 'street'
  const shanhaiguanGate = gateShowcase && props.variant === 'shanhaiguan-town-east'
  const qingmingGate = gateShowcase && props.variant === 'qingming-gate'
  const qufuTemple = kind === 'temple' && props.variant === 'qufu-dacheng-hall'
  const hongcunGarden = gardenShowcase && props.variant === 'hongcun-south-lake'
  const stage = pagodaShowcase
    ? { top: '#f3e6d1', bottom: '#161311', ground: '#292622', background: '#1a2527' }
    : gateShowcase
      ? { top: '#f0d7b4', bottom: '#281b1a', ground: '#30231f', background: '#24191a' }
      : grottoShowcase
        ? { top: '#d9d3c7', bottom: '#182027', ground: '#26262a', background: '#182128' }
        : gardenShowcase || streetShowcase
          ? { top: '#dce8d6', bottom: '#14211c', ground: '#20362d', background: '#172520' }
          : kind === 'temple' || pavilionShowcase
            ? { top: '#ead9bd', bottom: '#20262a', ground: '#2b2c29', background: '#121b20' }
          : { top: '#d9e8ed', bottom: '#05090d', ground: '#0b171d', background: '#07121b' }
  scene.background = new THREE.Color(stage.background)
  scene.fog = new THREE.FogExp2(stage.background, gateShowcase || pagodaShowcase || kind === 'temple' || pavilionShowcase ? 0.018 : 0.026)
  const cameraInstance = new THREE.PerspectiveCamera(34, 1, 0.1, 120)
  const cameraStart: Record<typeof props.kind, [number, number, number]> = {
    grotto: [9.6, 5.5, 12.5], temple: [9.2, 5.9, 12.8], gate: [11, 7, 13], pagoda: [10, 7.5, 12.5], pavilion: [10.4, 6.7, 13.8], garden: [9.2, 6, 12.8], street: [10.5, 6.2, 13.6],
  }
  const targetStart: Record<typeof props.kind, [number, number, number]> = {
    grotto: [0, 2.25, 0], temple: [0, 1.8, 0], gate: [0, 2.5, 0], pagoda: [0, 3.6, 0], pavilion: [0, 3.0, 0], garden: [0, 1.6, 0], street: [0, 1.5, 0],
  }
  cameraInstance.position.set(...cameraStart[kind]); camera = cameraInstance; initialCamera = cameraInstance.position.clone(); initialTarget = new THREE.Vector3(...targetStart[kind])
  scene.add(new THREE.HemisphereLight(stage.top, stage.bottom, pagodaShowcase || gateShowcase ? 1.9 : 1.65))
  // The pagoda is the hero asset. Use a warm key and a restrained cool rim so
  // the glazed-brick colors read like a physical object instead of a neon HUD.
  const keyColor = gateShowcase ? '#ffd09a' : pagodaShowcase ? '#ffd7a0' : pavilionShowcase ? '#ffe0a6' : grottoShowcase ? '#e7c7aa' : gardenShowcase ? '#ffe8bf' : streetShowcase ? '#ffd7a0' : kind === 'temple' ? '#f7d6a3' : '#ffe2b6'
  const key = new THREE.DirectionalLight(keyColor, pagodaShowcase ? 6.4 : gateShowcase ? 6 : pavilionShowcase ? 6.2 : grottoShowcase ? 5.2 : kind === 'temple' ? 5.8 : 4.8); key.position.set(8, 14, 7); key.castShadow = quality.shadows; key.shadow.mapSize.set(quality.shadows ? 768 : 256, quality.shadows ? 768 : 256); key.shadow.camera.near = 1; key.shadow.camera.far = 55; key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20; scene.add(key)
  const rimColor = gateShowcase ? '#e5a988' : pagodaShowcase ? '#9bc4c2' : pavilionShowcase ? '#9ac8d4' : grottoShowcase ? '#8dc9ce' : gardenShowcase ? '#90d3b2' : streetShowcase ? '#d7a66f' : kind === 'temple' ? '#8ec3ba' : '#66c9d5'
  const rim = new THREE.SpotLight(rimColor, pagodaShowcase || gateShowcase || pavilionShowcase ? 8 : grottoShowcase ? 10 : kind === 'temple' ? 9 : 12, 38, Math.PI / 7, 0.7, 1.4); rim.position.set(-10, 9, -11); rim.target.position.set(0, 2, 0); scene.add(rim, rim.target)
  const fillColor = gateShowcase ? '#d87950' : pagodaShowcase ? '#e9a66d' : pavilionShowcase ? '#d48b4f' : grottoShowcase ? '#b76f4e' : gardenShowcase ? '#d59b58' : streetShowcase ? '#d87950' : kind === 'temple' ? '#c88255' : '#db744b'
  const warmFill = new THREE.PointLight(fillColor, pagodaShowcase || gateShowcase || pavilionShowcase ? 3.8 : kind === 'temple' ? 3.2 : 2.6, 20); warmFill.position.set(3, 2.2, 4); scene.add(warmFill)
  const environment = new THREE.Group()
  const groundMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: stage.ground, roughness: 0.88, metalness: 0.12 }))
  const ground = setMeshProps(new THREE.Mesh(new THREE.CircleGeometry(18, 96), groundMaterial)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; environment.add(ground)
  const grid = new THREE.GridHelper(34, 34, 0x32717b, 0x17343d); const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.24; registerMaterial(material) }); grid.position.y = 0.015; environment.add(grid)
  addTechRing(environment, 4.6, 0.035, 0x4bc3cc, 0.15); addTechRing(environment, 6.3, 0.04, 0xbf8751, -0.1); addTechRing(environment, 8.4, 0.045, 0x2b6973, 0.06)
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; const radius = i % 2 ? 8.4 : 6.3; const point = new THREE.Vector3(Math.cos(a) * radius, 0.05, Math.sin(a) * radius); addLine(environment, [point.clone().multiplyScalar(0.78), point], i % 2 ? 0x3faeb8 : 0xa77b4d, 0.5) }
  scene.add(environment)
  const particleCount = quality.particleCount; const particlePositions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i += 1) { const angle = Math.random() * Math.PI * 2; const radius = 5 + Math.random() * 13; particlePositions[i * 3] = Math.cos(angle) * radius; particlePositions[i * 3 + 1] = 0.3 + Math.random() * 10; particlePositions[i * 3 + 2] = Math.sin(angle) * radius }
  const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3)); const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0x78c7cc, size: 0.045, transparent: true, opacity: 0.52, depthWrite: false })); scene.add(particles)
  const group = new THREE.Group()
  const stone = registerMaterial(new THREE.MeshStandardMaterial({ color: kind === 'grotto' ? '#9c735e' : '#a87850', roughness: 0.68, metalness: 0.08 })); const stoneLight = registerMaterial(new THREE.MeshStandardMaterial({ color: '#cfaa7a', roughness: 0.6, metalness: 0.1 })); const dark = registerMaterial(new THREE.MeshStandardMaterial({ color: '#312b28', roughness: 0.77, metalness: 0.18 })); const red = registerMaterial(new THREE.MeshStandardMaterial({ color: '#8d2e2a', roughness: 0.65, metalness: 0.12 })); const gold = registerMaterial(new THREE.MeshStandardMaterial({ color: '#c69b5f', roughness: 0.42, metalness: 0.4 })); const cyan = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x76e1e5, transparent: true, opacity: 0.8 }))
  if (kind === 'pavilion') {
    // Yellow Crane Tower / riverside pavilion: a broad five-storey timber
    // hall with projecting eaves, red columns and a distinct roof crown.
    const pavilionWall = registerMaterial(new THREE.MeshStandardMaterial({ color: '#b64b32', roughness: 0.68, metalness: 0.04 }))
    const pavilionTrim = registerMaterial(new THREE.MeshStandardMaterial({ color: '#e1a24e', roughness: 0.42, metalness: 0.22 }))
    const pavilionRoof = registerMaterial(new THREE.MeshStandardMaterial({ color: '#51403a', roughness: 0.76, metalness: 0.14 }))
    const pavilionShadow = registerMaterial(new THREE.MeshStandardMaterial({ color: '#281d1c', roughness: 0.86, metalness: 0 }))
    for (let level = 0; level < 5; level += 1) {
      const width = 4.65 - level * 0.18
      const depth = 3.55 - level * 0.12
      const y = 0.42 + level * 0.92
      addBox(group, [width, 0.58, depth], [0, y, 0], pavilionWall)
      addBox(group, [width + 0.58, 0.14, depth + 0.52], [0, y + 0.32, 0], pavilionTrim)
      addHipRoof(group, width + 0.52, depth + 0.42, y + 0.4, 0.46, pavilionRoof, pavilionTrim, 0, 0)
      for (const x of [-width * 0.4, width * 0.4]) for (const z of [-depth * 0.43, depth * 0.43]) addColumn(group, x, y + 0.02, z, 0.68, pavilionTrim, 0.095)
      addBox(group, [width * 0.42, 0.3, 0.12], [0, y + 0.32, -depth * 0.48], pavilionShadow)
    }
    addBox(group, [1.1, 4.65, 1.1], [0, 2.5, 0], pavilionTrim)
    addRoof(group, 2.2, 0.7, 5.15, pavilionRoof)
    addFinials(group, 1.65, 5.54, pavilionTrim)
  } else if (kind === 'pagoda') {
    // Each pagoda gets its own structural vocabulary in the fallback: timber
    // frame and brackets for Yingxian, brick doors for Dayan, and a narrow
    // glazed-brick shaft for Kaifeng. They are deliberately more than palette
    // variants so the concept models still teach the differences in type.
    const isYingxian = props.variant === 'yingxian-wooden-pagoda'
    const isDayan = props.variant === 'xian-big-wild-goose-pagoda'
    const pagodaLevels = isYingxian ? 5 : isDayan ? 7 : 13
    const levelStep = isYingxian ? 1.08 : isDayan ? 0.88 : 0.66
    const towerBody = isYingxian ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#70402c', roughness: 0.72, metalness: 0.04 })) : isDayan ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#aa8d67', roughness: 0.8, metalness: 0.02 })) : registerMaterial(new THREE.MeshStandardMaterial({ color: '#795442', roughness: 0.62, metalness: 0.14 }))
    const towerBodyAlt = isYingxian ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#a3603c', roughness: 0.68, metalness: 0.03 })) : isDayan ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#c4a77a', roughness: 0.82, metalness: 0.01 })) : registerMaterial(new THREE.MeshStandardMaterial({ color: '#a46d4a', roughness: 0.58, metalness: 0.1 }))
    const towerRoof = isYingxian ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#3b2521', roughness: 0.78, metalness: 0.08 })) : isDayan ? registerMaterial(new THREE.MeshStandardMaterial({ color: '#6d5844', roughness: 0.84, metalness: 0.02 })) : registerMaterial(new THREE.MeshStandardMaterial({ color: '#352a26', roughness: 0.76, metalness: 0.18 }))
    const towerTrim = isYingxian ? gold : isDayan ? towerBodyAlt : registerMaterial(new THREE.MeshStandardMaterial({ color: '#b78958', roughness: 0.48, metalness: 0.25 }))
    const baseWidth = isYingxian ? 4.45 : isDayan ? 3.9 : 3.48
    const taper = isYingxian ? 0.42 : isDayan ? 0.3 : 0.16
    addBox(group, [baseWidth + 0.7, 0.3, baseWidth + 0.7], [0, 0.15, 0], isYingxian ? stoneLight : towerBodyAlt)
    for (let i = 0; i < pagodaLevels; i += 1) {
      const width = baseWidth - i * taper
      const baseY = 0.5 + i * levelStep
      const bodyMaterial = i % 2 ? towerBody : towerBodyAlt
      addBox(group, [width, isYingxian ? 0.66 : 0.56, width], [0, baseY, 0], bodyMaterial)
      addBox(group, [width + (isYingxian ? 0.62 : 0.38), 0.12, width + (isYingxian ? 0.62 : 0.38)], [0, baseY + (isYingxian ? 0.38 : 0.31), 0], towerTrim)
      addRoof(group, width * (isYingxian ? 0.84 : 0.76), isYingxian ? 0.42 : 0.52, baseY + (isYingxian ? 0.7 : 0.62), towerRoof, isYingxian ? Math.PI / 4 : 0)
      if (isYingxian) {
        for (const x of [-width * 0.43, width * 0.43]) for (const z of [-width * 0.43, width * 0.43]) { addColumn(group, x, baseY - 0.02, z, 0.56, towerTrim, 0.1); addBox(group, [0.5, 0.12, 0.18], [x, baseY + 0.46, z], towerTrim) }
        addBox(group, [width * 0.55, 0.16, 0.08], [0, baseY + 0.12, -width * 0.51], dark)
      } else if (isDayan) {
        const arch = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.28, width * 0.16), 0.075, 10, 28, Math.PI), towerTrim)); arch.position.set(0, baseY + 0.2, -width * 0.515); arch.rotation.z = Math.PI; group.add(arch)
        addBox(group, [width * 0.22, 0.45, 0.08], [0, baseY + 0.07, -width * 0.52], dark)
      } else {
        for (const side of [-1, 1]) addBox(group, [width * 0.72, 0.05, 0.06], [0, baseY + 0.08, side * width * 0.515], towerTrim)
      }
    }
    const towerHeight = 0.82 + (pagodaLevels - 1) * levelStep + (isYingxian ? 0.82 : 0.7)
    addBox(group, [isYingxian ? 0.58 : 0.48, towerHeight, isYingxian ? 0.58 : 0.48], [0, towerHeight / 2, 0], isYingxian ? dark : towerBody)
    addRoof(group, isYingxian ? 1.25 : isDayan ? 1.45 : 1.05, 0.62, towerHeight + 0.08, towerRoof)
    addFinials(group, isYingxian ? 1.55 : isDayan ? 1.7 : 1.3, towerHeight + 0.46, towerTrim)
  } else if (kind === 'gate') {
    // Yingtiamen / gate profile: three readable passageways, a deep red
    // gatehouse, layered eaves and framed openings. This gives the fallback
    // the same architectural specificity as the pagoda showcase.
    const wall = registerMaterial(new THREE.MeshStandardMaterial({ color: shanhaiguanGate ? '#806047' : qingmingGate ? '#8f4930' : '#8d302b', roughness: 0.72, metalness: 0.05 }))
    const wallLight = registerMaterial(new THREE.MeshStandardMaterial({ color: shanhaiguanGate ? '#a68159' : qingmingGate ? '#bd7144' : '#b04a38', roughness: 0.64, metalness: 0.05 }))
    const roofDark = registerMaterial(new THREE.MeshStandardMaterial({ color: shanhaiguanGate ? '#3b3935' : '#292225', roughness: 0.78, metalness: 0.12 }))
    const roofEdge = registerMaterial(new THREE.MeshStandardMaterial({ color: shanhaiguanGate ? '#c49a5f' : qingmingGate ? '#d29a54' : '#c48a4d', roughness: 0.42, metalness: 0.3 }))
    const opening = registerMaterial(new THREE.MeshStandardMaterial({ color: '#150f12', roughness: 0.92, metalness: 0 }))
    addBox(group, [12.4, 0.3, 5.8], [0, 0.15, 0], dark)
    addBox(group, [11.8, 0.26, 6.7], [0, 0.42, 0], stoneLight)
    // The lower gatehouse is built as three deep passageways. Keeping the
    // voids as real gaps between piers gives the viewer readable depth when
    // orbiting, instead of a flat black rectangle painted on a solid box.
    const portalCenters = [-2.8, 0, 2.8]
    for (const x of portalCenters) {
      addBox(group, [0.38, 3.45, 1.9], [x - 1.06, 1.95, 0], wall)
      addBox(group, [0.38, 3.45, 1.9], [x + 1.06, 1.95, 0], wall)
      addBox(group, [2.5, 0.42, 1.9], [x, 3.66, 0], wallLight)
      addBox(group, [1.65, 2.28, 0.7], [x, 1.48, 0.82], opening)
      addBox(group, [1.82, 0.16, 0.84], [x, 0.4, 1.08], roofEdge)
      addBox(group, [0.18, 2.7, 0.38], [x - 0.84, 1.52, 1.1], roofEdge)
      addBox(group, [0.18, 2.7, 0.38], [x + 0.84, 1.52, 1.1], roofEdge)
      const arch = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.105, 10, 32, Math.PI), roofEdge))
      arch.position.set(x, 2.68, 1.12); arch.rotation.z = Math.PI; group.add(arch)
      // Recessed ceiling and a small threshold inside each passageway.
      addBox(group, [1.5, 0.16, 1.35], [x, 2.95, 0.28], roofDark)
      addBox(group, [1.42, 0.14, 0.62], [x, 0.58, 0.62], dark)
    }
    // End wings and the elevated central pavilion establish the five-tower
    // silhouette of Yingtiamen while leaving the three central portals legible.
    for (const x of [-5.1, 5.1]) {
      addBox(group, [1.35, 4.35, 2.4], [x, 2.45, 0], wall)
      addBox(group, [1.65, 0.3, 2.75], [x, 4.62, 0], roofEdge)
      addRoof(group, 1.45, 0.58, 4.98, roofDark)
      addFinials(group, 1.22, 5.24, roofEdge)
    }
    addBox(group, [3.55, 2.2, 2.6], [0, 5.85, 0], wallLight)
    addBox(group, [3.95, 0.3, 3.0], [0, 6.88, 0], roofEdge)
    addBox(group, [3.55, 0.22, 2.85], [0, 7.12, 0], roofDark)
    addRoof(group, 2.7, 0.82, 7.68, roofDark)
    addFinials(group, 2.3, 7.98, roofEdge)
    // Connecting parapets, projecting eaves and small ridge ornaments supply
    // the layered roof rhythm seen from the overview camera.
    addBox(group, [10.8, 0.42, 2.65], [0, 4.76, 0], wall)
    addBox(group, [11.5, 0.16, 3.05], [0, 5.04, 0], roofEdge)
    addBox(group, [10.7, 0.22, 2.8], [0, 5.3, 0], roofDark)
    for (const x of [-3.95, 3.95]) {
      addBox(group, [2.8, 0.2, 2.65], [x, 5.05, 0], roofEdge)
      addRoof(group, 1.85, 0.62, 5.48, roofDark)
      addFinials(group, 1.55, 5.76, roofEdge)
    }
    for (const x of [-4.2, -1.4, 1.4, 4.2]) addBox(group, [0.22, 0.58, 0.34], [x, 5.65, 1.12], roofEdge)
    if (shanhaiguanGate) {
      // The eastern pass reads as a defensive gate rather than an imperial
      // city wall: crenellations and a long stone approach make the mountain
      // pass silhouette visible even in the overview frame.
      const battlement = registerMaterial(new THREE.MeshStandardMaterial({ color: '#ad8e69', roughness: 0.82, metalness: 0.02 }))
      addBox(group, [15.6, 1.15, 1.28], [0, 1.02, -3.35], battlement)
      for (let x = -7.2; x <= 7.2; x += 1.8) addBox(group, [0.62, 0.56, 1.52], [x, 1.86, -3.35], battlement)
      addBox(group, [3.8, 0.18, 8.2], [0, 0.38, -5.1], roofEdge)
    } else if (qingmingGate) {
      // The Song-market entrance is a lighter timber threshold with water
      // immediately in front of it, separating it from the massive
      // three-portal Yingtiamen reconstruction.
      const water = registerMaterial(new THREE.MeshPhysicalMaterial({ color: '#285866', roughness: 0.16, metalness: 0.28, clearcoat: 0.65, transparent: true, opacity: 0.88 }))
      const moat = setMeshProps(new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.08, 1.8), water)); moat.position.set(0, 0.26, 4.65); group.add(moat)
      addBox(group, [5.8, 0.2, 0.72], [0, 0.54, 3.55], roofEdge)
      for (const x of [-2.2, -1.1, 0, 1.1, 2.2]) addColumn(group, x, 0.62, 3.2, 0.82, wallLight, 0.07)
    }
  } else if (kind === 'grotto') {
    // Longmen-style cliff face: recessed niches and a staggered ledge make
    // the fallback read as carved rock instead of a row of floating spheres.
    addBox(group, [10.2, 0.42, 4.8], [0, 0.21, 0], dark)
    addBox(group, [9.5, 3.9, 1.45], [0, 2.18, 0.32], stone)
    addBox(group, [8.7, 0.4, 1.9], [0, 4.18, 0.15], stoneLight)
    for (let i = -4; i <= 4; i += 1) {
      const x = i * 1.04
      const height = i % 2 === 0 ? 2.7 : 2.35
      addBox(group, [0.22, height, 1.72], [x, 2.0, 0.18], dark)
    }
    for (let i = -3; i <= 3; i += 1) {
      const x = i * 1.22
      const statueY = 2.88 + Math.abs(i) * 0.12
      const niche = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.13, 10, 28, Math.PI), stoneLight))
      niche.position.set(x, statueY + 0.13, -0.58); niche.rotation.z = Math.PI; group.add(niche)
      const pedestal = addBox(group, [1.0, 0.3, 0.72], [x, 0.93, -0.7], stoneLight)
      pedestal.rotation.y = i % 2 ? 0.05 : -0.05
      const body = addBox(group, [0.9, 1.65, 0.66], [x, 1.82, -0.68], stone)
      body.scale.x = i === 0 ? 1.14 : 0.96
      const head = setMeshProps(new THREE.Mesh(new THREE.SphereGeometry(i === 0 ? 0.63 : 0.5, 20, 14), stoneLight))
      head.position.set(x, statueY, -0.74); group.add(head)
      const aura = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(i === 0 ? 0.88 : 0.68, 0.045, 10, 32), cyan))
      aura.position.set(x, statueY, -1.16); group.add(aura)
    }
    const halo = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.1, 14, 64), gold)); halo.position.set(0, 3.18, -1.16); group.add(halo)
    addBox(group, [9.7, 0.22, 0.26], [0, 4.5, -0.64], gold)
  } else if (kind === 'garden') {
    // A compact Song-style garden composition: pavilion, pond, bridge and
    // planting stones establish depth while keeping the draw count modest.
    addBox(group, [10.2, 0.24, 8.8], [0, 0.12, 0], dark)
    const waterMaterial = registerMaterial(new THREE.MeshPhysicalMaterial({ color: hongcunGarden ? '#2c6667' : '#23515a', roughness: 0.13, metalness: 0.4, clearcoat: 0.7, transparent: true, opacity: 0.9 }))
    const water = setMeshProps(new THREE.Mesh(new THREE.CircleGeometry(3.9, 48), waterMaterial)); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.2, 2.55); group.add(water)
    // Pavilion on the far bank.
    addBox(group, [5.35, 0.28, 3.15], [0, 0.46, -1.55], stoneLight)
    addBox(group, [4.65, 0.22, 2.75], [0, 3.23, -1.55], gold)
    addRoof(group, 3.45, 1.1, 3.9, gold, Math.PI / 4, 0, -1.55)
    for (const x of [-2.15, 2.15]) for (const z of [-2.65, -0.45]) addColumn(group, x, 0.58, z, 2.45, red, 0.17)
    for (const x of [-1.05, 1.05]) addWindow(group, x, 1.72, -2.67, 0.72, 0.9, dark)
    // Low bridge crossing the near edge of the pond.
    addBox(group, [4.6, 0.28, 0.75], [0, 0.52, 1.45], stoneLight)
    for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) addBox(group, [0.16, 0.62, 0.16], [x, 0.86, 1.07], red)
    addBox(group, [4.0, 0.16, 0.16], [0, 1.16, 1.07], red)
    // Garden stones and a lantern rhythm in the foreground.
    for (const [x, z, scale] of [[-3.6, 2.2, 0.72], [3.4, 2.9, 0.56], [-3.15, -0.5, 0.48]] as Array<[number, number, number]>) {
      const rock = setMeshProps(new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 1), stone)); rock.position.set(x, scale * 0.65, z); group.add(rock)
    }
    for (let i = -2; i <= 2; i += 1) { const lantern = setMeshProps(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), gold)); lantern.position.set(i * 1.25, 0.8, -3.45); group.add(lantern); addColumn(group, i * 1.25, 0.2, -3.45, 0.35, dark, 0.06) }
    if (hongcunGarden) {
      // Hongcun is defined by the white wall / dark-tile water village edge;
      // add that continuous backdrop so it reads differently from the Song
      // garden's open pavilion-and-bridge composition.
      const whiteWall = registerMaterial(new THREE.MeshStandardMaterial({ color: '#d9d0ba', roughness: 0.88, metalness: 0.01 }))
      const darkTile = registerMaterial(new THREE.MeshStandardMaterial({ color: '#2f3437', roughness: 0.86, metalness: 0.08 }))
      addBox(group, [9.0, 2.35, 0.22], [0, 1.38, -4.18], whiteWall)
      addBox(group, [9.3, 0.32, 0.46], [0, 2.62, -4.18], darkTile)
      for (const x of [-3.4, -1.7, 0, 1.7, 3.4]) addBox(group, [0.16, 1.9, 0.28], [x, 1.4, -4.04], darkTile)
      addBox(group, [1.2, 1.5, 0.26], [0, 1.36, -4.04], dark)
    }
  } else if (kind === 'street') {
    // Street profile: two rows of low shopfronts around a pedestrian axis,
    // clearly different from both the pagoda and the temple courtyard.
    addBox(group, [10.5, 0.22, 8.4], [0, 0.11, 0], dark)
    addBox(group, [1.55, 0.18, 8.4], [0, 0.24, 0], stoneLight)
    for (const side of [-1, 1]) {
      for (let index = 0; index < 4; index += 1) {
        const z = -3 + index * 2
        const height = 1.85 + (index % 2) * 0.25
        addBox(group, [3.65, height, 1.45], [side * 3.25, 1.08, z], stone)
        addBox(group, [3.9, 0.14, 1.72], [side * 3.25, 2.05 + (index % 2) * 0.25, z], gold)
        addRoof(group, 1.45, 0.42, 2.28 + (index % 2) * 0.25, gold)
        addWindow(group, side * 3.25, 1.26, z - 0.76, 1.05, 0.75, dark)
        addBox(group, [2.2, 0.14, 0.12], [side * 3.25, 0.62, z - 0.77], red)
        addColumn(group, side * 1.55, 0.36, z - 0.79, 1.55, red, 0.08)
      }
    }
    addBox(group, [1.0, 3.2, 0.26], [-1.9, 1.7, -3.85], red)
    addBox(group, [1.0, 3.2, 0.26], [1.9, 1.7, -3.85], red)
    addBox(group, [4.1, 0.28, 0.32], [0, 3.25, -3.85], gold)
    addRoof(group, 2.9, 0.62, 3.72, gold)
    for (const z of [-3.1, -1.3, 0.5, 2.3]) {
      const lantern = setMeshProps(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.38, 8), gold)); lantern.position.set(0, 1.1, z); group.add(lantern)
    }
  } else {
    // Shaolin courtyard profile: tiled hip roofs, timber colonnades and a
    // front mountain gate make the fallback read as a temple compound rather
    // than three plain boxes with pyramid caps.
    const plaster = registerMaterial(new THREE.MeshStandardMaterial({ color: qufuTemple ? '#c0a06d' : '#b89b73', roughness: 0.82, metalness: 0.02 }))
    const timber = registerMaterial(new THREE.MeshStandardMaterial({ color: qufuTemple ? '#7e2f25' : '#6f2924', roughness: 0.7, metalness: 0.05 }))
    const roofTile = registerMaterial(new THREE.MeshStandardMaterial({ color: qufuTemple ? '#34353a' : '#263b3d', roughness: 0.84, metalness: 0.1 }))
    const roofTrim = registerMaterial(new THREE.MeshStandardMaterial({ color: qufuTemple ? '#c69a53' : '#b47a42', roughness: 0.48, metalness: 0.25 }))
    const shadow = registerMaterial(new THREE.MeshStandardMaterial({ color: '#191e20', roughness: 0.9, metalness: 0 }))
    addBox(group, [11.2, 0.26, 10.2], [0, 0.13, 0], dark)
    addBox(group, [8.6, 0.16, 7.7], [0, 0.31, 0.35], stoneLight)

    const halls = [
      { z: 3.0, width: 5.6, depth: 2.1, height: 2.15, roofWidth: 6.45, roofDepth: 2.95, roofY: 2.72 },
      { z: 0.05, width: 6.65, depth: 2.45, height: 2.55, roofWidth: 7.6, roofDepth: 3.35, roofY: 3.08 },
      { z: -3.05, width: 5.9, depth: 2.15, height: 2.2, roofWidth: 6.75, roofDepth: 2.95, roofY: 2.82 },
    ]
    halls.forEach((hall, index) => {
      addBox(group, [hall.width, hall.height, hall.depth], [0, 1.42, hall.z], plaster)
      // Deep shadow under the eave and a second trim band create the stacked
      // roof profile visible in the overview camera.
      addBox(group, [hall.roofWidth + 0.18, 0.18, hall.roofDepth + 0.18], [0, hall.roofY - 0.08, hall.z], roofTrim)
      addHipRoof(group, hall.roofWidth, hall.roofDepth, hall.roofY, 0.72, roofTile, roofTrim, 0, hall.z)
      addBox(group, [hall.roofWidth + 0.36, 0.11, hall.roofDepth + 0.34], [0, hall.roofY - 0.18, hall.z], roofTrim)
      // Front colonnade, dark door bay, and repeated window frames.
      // The overview camera starts on the positive-Z side of the compound.
      // Put the veranda, doors and lattice on that face so the first frame
      // shows architectural detail rather than the unadorned rear wall.
      const frontZ = hall.z + hall.depth * 0.55
      for (const x of [-hall.width * 0.42, 0, hall.width * 0.42]) addColumn(group, x, 0.34, frontZ, hall.height + 0.2, timber, 0.13)
      addBox(group, [hall.width * 0.42, hall.height * 0.56, 0.12], [0, 1.35, frontZ - 0.04], shadow)
      for (const x of [-hall.width * 0.22, hall.width * 0.22]) addWindow(group, x, 1.56, frontZ - 0.08, 0.62, 0.82, timber)
      // Small bracket blocks under the eave read as dougong without creating
      // hundreds of meshes.
      for (const x of [-hall.roofWidth * 0.34, 0, hall.roofWidth * 0.34]) addBox(group, [0.42, 0.18, 0.42], [x, hall.roofY - 0.42, frontZ + 0.05], roofTrim)
      // Front steps anchor each hall to the courtyard axis.
      addBox(group, [hall.width * 0.44, 0.16, 0.52], [0, 0.42, frontZ - 0.38], stoneLight)
      addBox(group, [hall.width * 0.34, 0.14, 0.36], [0, 0.57, frontZ - 0.6], stoneLight)
    })

    // Front mountain gate, with two red timber posts and a broad hip roof.
    const gateZ = 4.45
    addColumn(group, -3.1, 0.34, gateZ, 2.65, timber, 0.2)
    addColumn(group, 3.1, 0.34, gateZ, 2.65, timber, 0.2)
    addBox(group, [6.8, 0.22, 0.3], [0, 2.98, gateZ], roofTrim)
    addHipRoof(group, 7.25, 1.95, 3.1, 0.7, roofTile, roofTrim, 0, gateZ)
    addBox(group, [1.25, 1.28, 0.18], [0, 1.25, gateZ - 0.12], shadow)
    for (const x of [-2.15, 2.15]) addBox(group, [0.36, 0.3, 0.42], [x, 2.82, gateZ], roofTrim)
    // Low side corridors frame the courtyard while leaving the central axis open.
    addBox(group, [0.35, 1.25, 7.2], [-4.7, 0.78, -0.2], timber)
    addBox(group, [0.35, 1.25, 7.2], [4.7, 0.78, -0.2], timber)
    for (const z of [-3.0, -1.2, 0.6, 2.4]) {
      addBox(group, [0.18, 0.78, 0.18], [-4.45, 1.5, z], roofTrim)
      addBox(group, [0.18, 0.78, 0.18], [4.45, 1.5, z], roofTrim)
    }
    if (qufuTemple) {
      // Qufu's defining cue is the ceremonial forecourt: paired stone
      // columns and a broad central stair in front of the main hall.
      const stoneColumn = registerMaterial(new THREE.MeshStandardMaterial({ color: '#b7a27f', roughness: 0.68, metalness: 0.06 }))
      for (const x of [-2.65, 2.65]) addColumn(group, x, 0.34, 4.05, 2.25, stoneColumn, 0.18)
      addBox(group, [3.8, 0.18, 1.2], [0, 0.52, 3.62], stoneColumn)
      addBox(group, [3.1, 0.16, 0.82], [0, 0.72, 3.18], stoneColumn)
    }
  }
  group.rotation.y = -0.28; scene.add(group)
  const scanBeamGeometry = new THREE.PlaneGeometry(14, 0.06); scanMaterial = new THREE.MeshBasicMaterial({ color: 0x65e3e2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }); const scanBeam = new THREE.Mesh(scanBeamGeometry, scanMaterial); scanBeam.rotation.x = -Math.PI / 2; scanBeam.position.y = 0.1; scene.add(scanBeam)
  return { scene, camera: cameraInstance, group, particles, scanBeam, environment }
}

async function loadReviewedAsset(scene: THREE.Scene, fallback: THREE.Group, rendererInstance: THREE.WebGLRenderer, environment: THREE.Group, particles: THREE.Points) {
  if ((!props.assetUrl && !props.manifestUrl) || props.assetUrl?.includes('cdn.example.com')) {
    modelStatus.value = '形制示意 · 未配置 GLB 资产'
    return
  }

  loadingAsset.value = true
  loadProgress.value = 0
  modelStatus.value = '正在加载审核 GLB'
  requestController?.abort()
  const controller = new AbortController()
  requestController = controller
  try {
    const asset = await loadModelAsset({
      renderer: rendererInstance,
      modelUrl: props.assetUrl,
      manifestUrl: props.manifestUrl,
      dracoDecoderPath: '/draco/',
      ktx2TranscoderPath: '/basis/',
      signal: controller.signal,
      preferDetail: false,
      onProgress: (progress) => { loadProgress.value = Math.round(progress * 100) },
    })
    if (!asset || controller.signal.aborted) return
    loadedModel = asset.root
    // Count before generating optional procedural maps. Large scans often have
    // hundreds of materials; generating 96px maps for each one synchronously
    // blocks the main thread while the loading overlay is still visible.
    let importedMeshCount = 0
    loadedModel.traverse((object) => { if (object instanceof THREE.Mesh) importedMeshCount += 1 })
    // Reviewed scans keep their authored image maps. The pagoda's GLB already
    // contains separated glazed-brick, eave and carved-brick materials; adding
    // procedural noise over those colors made the showcase muddy, so preserve
    // its authored material palette. Other reconstruction assets still receive
    // the lightweight PBR treatment until an authorized scan is available.
    const textureSize = importedMeshCount > 480 ? 48 : importedMeshCount > 220 ? 64 : asset.lod === 'high' ? 96 : 72
    if (!isPagodaShowcase.value) applyProceduralHeritageMaterials(loadedModel, { textureSize, replaceExistingMap: false, normalStrength: 0.12 })
    loadedRealAsset.value = true
    assetManifest.value = asset.manifest
    assetLod.value = asset.lod
    // Detailed architectural GLBs can contain hundreds of small brick and
    // frame meshes. Rendering every one into the shadow map doubles the draw
    // calls and is the main source of wheel/pinch jank. Keep receiver shading
    // for the model, but only cast per-mesh shadows for compact assets.
    const castImportedShadows = importedMeshCount <= 320
    loadedModel.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = castImportedShadows && !object.name.startsWith('Optimized_')
        object.receiveShadow = true
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(registerMaterial)
      }
    })
    scene.add(loadedModel)
    fallback.visible = false
    environment.children.slice(1).forEach((child) => { child.visible = false })
    particles.visible = false
    const loadedStageColor = isPagodaShowcase.value ? '#1a2527' : props.kind === 'gate' ? '#24191a' : props.kind === 'pavilion' ? '#10242b' : '#b9ad9a'
    scene.background = new THREE.Color(loadedStageColor)
    scene.fog = new THREE.Fog(loadedStageColor, isPagodaShowcase.value || props.kind === 'gate' || props.kind === 'pavilion' ? 32 : 24, 70)
    modelStatus.value = `${asset.manifest?.assetStatus ?? 'GLB 资产'} · ${asset.lod.toUpperCase()} 已载入`
    scanEnabled.value = false
    if (scanMaterial) scanMaterial.opacity = 0
    const isPublishedAsset = asset.manifest?.versionStatus === 'PUBLISHED'
    viewerState.value = isPublishedAsset
      ? (castImportedShadows ? '实测资产已载入 · 可自由探索' : '实测资产已载入 · 性能模式')
      : (castImportedShadows ? '复原资产 · PBR材质预览' : '复原资产 · 性能模式')
    if (rendererInstance) {
      // The imported model is static. Refresh the shadow map once after it is
      // attached, then stop rebuilding it on every animation frame.
      rendererInstance.shadowMap.needsUpdate = true
      requestAnimationFrame(() => { if (renderer === rendererInstance) rendererInstance.shadowMap.autoUpdate = false })
    }
    const preset = asset.manifest?.defaultCamera
    if (preset && camera && controls) {
      if (preset.position?.length === 3) { const [x, y, z] = preset.position; camera.position.set(x, y, z) }
      if (preset.target?.length === 3) { const [x, y, z] = preset.target; controls.target.set(x, y, z) }
      if (typeof preset.fov === 'number') { camera.fov = preset.fov; camera.updateProjectionMatrix() }
      controls.update()
    }
    frameImportedModel(asset.root, 1, true)
  } catch (error) {
    if (controller.signal.aborted) return
    modelStatus.value = '形制示意 · 真实资产加载失败'
    viewerState.value = '保持演示模型 · 请检查资产地址'
    console.warn('[BuildingViewer] reviewed GLB failed; using procedural fallback', error)
  } finally {
    loadingAsset.value = false
  }
}

function frameImportedModel(root: THREE.Object3D, immersiveScale = 1, remember = false) {
  if (!camera || !controls || !mount.value) return
  root.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(root)
  if (bounds.isEmpty()) return
  modelFocusTarget = bounds.getCenter(new THREE.Vector3())
  const sphere = bounds.getBoundingSphere(new THREE.Sphere())
  const aspect = Math.max(0.1, mount.value.clientWidth / Math.max(1, mount.value.clientHeight))
  const verticalFov = THREE.MathUtils.degToRad(camera.fov)
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect)
  const limitingFov = Math.min(verticalFov, horizontalFov)
  // The hero pagoda is tall and narrow; the generic 12% safety margin leaves
  // too much dead air around it in the detail card. Keep a small edge margin
  // while allowing the tower to occupy the frame.
  const fitMargin = isPagodaShowcase.value ? 1.03 : 1.12
  modelFitDistance = sphere.radius / Math.sin(limitingFov / 2) * fitMargin
  const direction = camera.position.clone().sub(controls.target)
  if (direction.lengthSq() < 0.001) direction.set(1, 0.3, 1)
  const destination = modelFocusTarget.clone().add(direction.normalize().multiplyScalar(modelFitDistance * immersiveScale))
  camera.position.copy(destination)
  controls.target.copy(modelFocusTarget)
  controls.minDistance = Math.max(1.4, modelFitDistance * 0.18)
  controls.maxDistance = Math.max(23, modelFitDistance * 2.4)
  controls.update()
  if (remember && immersiveScale === 1) {
    modelDefaultFrame = { position: camera.position.clone(), target: controls.target.clone() }
  }
}

function cameraForPreset(preset: CameraPreset) {
  const values: Record<typeof props.kind, Record<CameraPreset, { position: [number, number, number]; target: [number, number, number] }>> = {
    grotto: { overview: { position: [9, 6.6, 11], target: [0, 2, 0] }, detail: { position: [4.2, 3.7, 7.2], target: [0, 2.8, -0.6] }, axis: { position: [0, 4.1, 12.6], target: [0, 2.1, 0] }, top: { position: [0, 13, 0.1], target: [0, 1.4, 0] } },
    temple: { overview: { position: [9, 6.6, 11], target: [0, 2, 0] }, detail: { position: [4.5, 3.7, 7.4], target: [0, 2.2, -0.8] }, axis: { position: [0, 4.2, 12.8], target: [0, 2, 0] }, top: { position: [0, 12, 0.1], target: [0, 1.2, 0] } },
    gate: { overview: { position: [11, 7, 13], target: [0, 2.5, 0] }, detail: { position: [5.2, 3.8, 8.2], target: [0, 3, -0.7] }, axis: { position: [0, 4.1, 15], target: [0, 2.5, 0] }, top: { position: [0, 14, 0.1], target: [0, 2, 0] } },
    pagoda: { overview: { position: [10, 7.5, 12.5], target: [0, 3.6, 0] }, detail: { position: [4.3, 5.1, 7.1], target: [0, 5, 0] }, axis: { position: [0, 5.5, 15], target: [0, 3.8, 0] }, top: { position: [0, 16, 0.1], target: [0, 3.4, 0] } },
    pavilion: { overview: { position: [10.4, 6.7, 13.8], target: [0, 2.8, 0] }, detail: { position: [4.9, 4.8, 8.2], target: [0, 3.8, 0] }, axis: { position: [0, 5.4, 15], target: [0, 2.8, 0] }, top: { position: [0, 14, 0.1], target: [0, 2.6, 0] } },
    garden: { overview: { position: [9, 6.2, 11], target: [0, 1.6, 0] }, detail: { position: [4.5, 3.5, 7.4], target: [0, 1.8, 1] }, axis: { position: [0, 4.2, 13], target: [0, 1.5, 0] }, top: { position: [0, 13, 0.1], target: [0, 0.8, 0] } },
    street: { overview: { position: [10, 6.8, 12], target: [0, 1.5, 0] }, detail: { position: [5.2, 3.4, 7.5], target: [0, 1.2, -1.2] }, axis: { position: [0, 3.8, 14], target: [0, 1.2, 0] }, top: { position: [0, 13, 0.1], target: [0, 0.7, 0] } },
  }
  return values[props.kind][preset]
}
function applyCameraPreset(preset: CameraPreset) {
  if (!camera || !controls) return
  if (preset === 'overview' && loadedRealAsset.value && modelDefaultFrame) {
    animateCamera(modelDefaultFrame.position, modelDefaultFrame.target)
    showPresets.value = false
    viewerState.value = '视角已复位 · 整体形制'
    return
  }
  const next = cameraForPreset(preset)
  camera.position.set(...next.position)
  controls.target.set(...next.target)
  controls.update()
  showPresets.value = false
  viewerState.value = preset === 'overview' ? '视角已复位 · 整体形制' : preset === 'detail' ? '导览视角 · 构件节点' : preset === 'axis' ? '导览视角 · 空间轴线' : '导览视角 · 俯瞰关系'
}
function selectHotspot(hotspot: Hotspot) { applyCameraPreset(hotspot.preset) }
function resetCamera() { applyCameraPreset('overview') }
function toggleWireframe() { wireframe.value = !wireframe.value; trackedMaterials.forEach((material) => { if ('wireframe' in material) (material as THREE.MeshStandardMaterial).wireframe = wireframe.value }); viewerState.value = wireframe.value ? '结构线框模式' : '实体材质模式' }
function toggleAutoRotate() { autoRotate.value = !autoRotate.value; if (controls) controls.autoRotate = autoRotate.value; viewerState.value = autoRotate.value ? '自动巡游中' : '手动探索' }
function toggleScan() { scanEnabled.value = !scanEnabled.value; if (scanMaterial) scanMaterial.opacity = scanEnabled.value ? 0.45 : 0; viewerState.value = scanEnabled.value ? '扫描辅助已开启' : '扫描辅助已关闭' }
function resizeRenderer() {
  if (!mount.value || !renderer || !camera) return
  const width = Math.max(1, mount.value.clientWidth)
  const height = Math.max(1, mount.value.clientHeight)
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  // Keep the drawing buffer and the CSS box in sync.  Passing `false` above
  // avoids a layout write on every ResizeObserver tick, so explicitly keep
  // the canvas at 100% of its parent.  Without this, the first 523px inline
  // width survives fullscreen and the GLB is rendered in a left-hand strip
  // while the HUD stretches across the whole screen.
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.position = 'absolute'
  renderer.domElement.style.inset = '0'
}
function prefersReducedQuality() {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const cores = navigator.hardwareConcurrency ?? 4
  return Boolean(memory && memory <= 2) || cores <= 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function startAnimation() {
  if (animationRunning) return
  animationRunning = true
  lastRenderAt = 0
  frame = requestAnimationFrame(tick)
}
function stopAnimation() {
  animationRunning = false
  cancelAnimationFrame(frame)
}
function tick(now: number) {
  if (!animationRunning) return
  frame = requestAnimationFrame(tick)
  // A hidden tab or an off-screen detail panel should not consume a full GL
  // render loop. Keep the callback alive so visibility/intersection changes
  // resume immediately without rebuilding the scene.
  if (!viewerVisible || document.hidden || !renderer || !camera) return
  const frameInterval = lowPowerDevice ? 1000 / 30 : 1000 / 45
  if (lastRenderAt && now - lastRenderAt < frameInterval) return
  lastRenderAt = now
  const elapsed = now / 1000
  controls?.update()
  if (!loadedRealAsset.value) groupForAnimation?.position.setY(Math.sin(elapsed * 0.6) * 0.025)
  particlesForAnimation && (particlesForAnimation.rotation.y = elapsed * 0.012)
  if (scanBeamForAnimation) scanBeamForAnimation.position.y = scanEnabled.value ? 0.18 + ((elapsed * 0.9) % 5.8) : -20
  animatedRings.forEach(({ mesh, speed, baseY }, index) => { mesh.rotation.z = elapsed * speed; mesh.position.y = baseY + Math.sin(elapsed * 1.2 + index) * 0.012 })
  if (sceneForAnimation) renderer.render(sceneForAnimation, camera)
}
function animateCamera(position: THREE.Vector3, target: THREE.Vector3, duration = 220) {
  if (!camera || !controls) return
  cancelAnimationFrame(cameraTransitionFrame)
  const startPosition = camera.position.clone()
  const startTarget = controls.target.clone()
  const startedAt = performance.now()
  const step = (now: number) => {
    if (!camera || !controls) return
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    camera.position.lerpVectors(startPosition, position, eased)
    controls.target.lerpVectors(startTarget, target, eased)
    controls.update()
    if (progress < 1) cameraTransitionFrame = requestAnimationFrame(step)
  }
  cameraTransitionFrame = requestAnimationFrame(step)
}
function applyImmersiveCamera(enabled: boolean) {
  if (!camera || !controls) return
  if (enabled) {
    immersiveCameraSnapshot = { position: camera.position.clone(), target: controls.target.clone() }
    const target = modelFocusTarget.clone()
    const direction = camera.position.clone().sub(target)
    const distance = Math.max(8, modelFitDistance * 0.94)
    animateCamera(target.clone().add(direction.normalize().multiplyScalar(distance)), target)
    viewerState.value = '沉浸式视图 · 已放大'
  } else if (immersiveCameraSnapshot) {
    animateCamera(immersiveCameraSnapshot.position, immersiveCameraSnapshot.target)
    immersiveCameraSnapshot = undefined
    viewerState.value = '已退出沉浸式视图'
  }
}
async function toggleImmersive() {
  if (!mount.value) return
  try {
    if (!document.fullscreenElement) await mount.value.requestFullscreen()
    else await document.exitFullscreen()
  } catch (error) { console.warn('[BuildingViewer] fullscreen unavailable', error) }
}
function updateFullscreenState() {
  const next = Boolean(document.fullscreenElement && document.fullscreenElement === mount.value)
  immersive.value = next
  resizeRenderer()
  applyImmersiveCamera(next)
  // Fullscreen changes the containing block after the `fullscreenchange`
  // event. Refit on the following frame as well, otherwise the camera can
  // still be calculated from the old narrow card dimensions.
  requestAnimationFrame(() => {
    resizeRenderer()
    if (loadedModel) frameImportedModel(loadedModel, next ? 0.94 : 1)
    resizeRenderer()
  })
}
onMounted(() => {
  if (props.embedUrl) {
    modelStatus.value = '平台实景扫描 · 外部查看器'
    viewerState.value = '真实资产已载入 · 可自由探索'
    return
  }
  if (!mount.value) return
  lowPowerDevice = prefersReducedQuality()
  const quality = viewerQuality()
  const { scene, camera: sceneCamera, group, particles, scanBeam, environment } = buildScene(props.kind, quality)
  sceneForAnimation = scene
  groupForAnimation = group
  particlesForAnimation = particles
  scanBeamForAnimation = scanBeam
  renderer = new THREE.WebGLRenderer({ antialias: !lowPowerDevice, alpha: true, powerPreference: 'high-performance' }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPowerDevice ? 1 : 1.25)); renderer.setSize(Math.max(1, mount.value.clientWidth), Math.max(1, mount.value.clientHeight), false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; renderer.domElement.style.position = 'absolute'; renderer.domElement.style.inset = '0'; renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.shadowMap.enabled = !lowPowerDevice; renderer.shadowMap.type = THREE.PCFSoftShadowMap; mount.value.appendChild(renderer.domElement)
  const pmremGenerator = new THREE.PMREMGenerator(renderer)
  const environmentScene = new RoomEnvironment()
  environmentMap = pmremGenerator.fromScene(environmentScene, 0.04).texture
  scene.environment = environmentMap
  pmremGenerator.dispose()
  controls = new OrbitControls(sceneCamera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.12; controls.zoomSpeed = 1.65; controls.rotateSpeed = 0.72; controls.zoomToCursor = false; controls.enablePan = false; controls.autoRotate = autoRotate.value; controls.autoRotateSpeed = 0.55; controls.minDistance = 2.2; controls.maxDistance = 23; controls.maxPolarAngle = Math.PI * 0.47; controls.target.copy(initialTarget)
  const interactionStart = () => {
    if (!controls || !autoRotate.value) return
    autoRotate.value = false
    controls.autoRotate = false
    viewerState.value = '手动探索'
  }
  controls.addEventListener('start', interactionStart)
  void loadReviewedAsset(scene, group, renderer, environment, particles)
  const resize = () => resizeRenderer(); window.addEventListener('resize', resize)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(mount.value)
  const focusView = () => { if (!camera || !controls) return; const direction = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(controls.target.clone().add(direction.multiplyScalar(7.2))); controls.update(); viewerState.value = '焦点已锁定 · 细部观察' }
  renderer.domElement.addEventListener('dblclick', focusView)
  startAnimation()
  fullscreenHandler = updateFullscreenState; document.addEventListener('fullscreenchange', fullscreenHandler)
  documentVisibilityHandler = () => { if (document.hidden) stopAnimation(); else if (viewerVisible) startAnimation() }
  document.addEventListener('visibilitychange', documentVisibilityHandler)
  visibilityObserver = new IntersectionObserver((entries) => {
    viewerVisible = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0)
    if (viewerVisible && !document.hidden) startAnimation()
    else stopAnimation()
  }, { threshold: 0.01 })
  visibilityObserver.observe(mount.value)
  cleanup = () => { requestController?.abort(); window.removeEventListener('resize', resize); resizeObserver?.disconnect(); resizeObserver = undefined; visibilityObserver?.disconnect(); visibilityObserver = undefined; if (documentVisibilityHandler) document.removeEventListener('visibilitychange', documentVisibilityHandler); documentVisibilityHandler = undefined; document.removeEventListener('fullscreenchange', fullscreenHandler ?? updateFullscreenState); renderer?.domElement.removeEventListener('dblclick', focusView); controls?.removeEventListener('start', interactionStart); stopAnimation(); cancelAnimationFrame(cameraTransitionFrame); controls?.dispose(); disposeObject3D(scene); disposeProceduralMaterialCache(); environmentMap?.dispose(); environmentMap = undefined; loadedModel = undefined; modelDefaultFrame = undefined; lowPowerDevice = false; animatedRings.length = 0; trackedMaterials.length = 0; scanMaterial = undefined; immersiveCameraSnapshot = undefined; sceneForAnimation = undefined; groupForAnimation = undefined; particlesForAnimation = undefined; scanBeamForAnimation = undefined; renderer?.dispose(); renderer?.forceContextLoss(); renderer?.domElement.remove(); renderer = undefined }
})
onBeforeUnmount(() => { requestController?.abort(); cleanup() })
</script>

<template>
  <div ref="mount" class="model-canvas" :class="{ 'external-active': Boolean(externalEmbed), immersive, 'pagoda-showcase': isPagodaShowcase }" aria-label="建筑三维模型浏览器">
    <iframe v-if="externalEmbed" class="external-model" :src="externalEmbed" title="授权平台实景三维模型" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen loading="lazy" />
    <div class="viewer-hud"><div class="hud-head"><div><span class="hud-kicker">DIGITAL HERITAGE / 现场模式</span><strong>{{ displayLabel }}</strong><small class="asset-status">{{ modelStatus }}</small></div><span class="live-pill"><i /> {{ isPagodaShowcase ? '重点展项 · ' : '' }}{{ assetBadge }}</span></div><div v-if="loadingAsset" class="asset-progress"><span :style="{ width: `${loadProgress}%` }" /><b>{{ loadProgress }}%</b></div><div v-if="!externalEmbed" class="hud-reticle" aria-hidden="true"><span /><b /><em /></div><template v-if="!externalEmbed"><button v-for="hotspot in hotspots" :key="hotspot.id" type="button" class="hud-hotspot" :class="hotspot.placement" :title="hotspot.description" @click.stop="selectHotspot(hotspot)"><b>{{ hotspot.id }}</b><span>{{ hotspot.label }}</span></button></template><div class="hud-bottom"><span class="hud-status"><i /> {{ viewerState }}</span><span class="hud-help">拖动旋转 · 滚轮缩放 · 双击聚焦</span></div></div>
    <div v-if="!externalEmbed" class="viewer-toolbar" aria-label="模型控制"><button type="button" :class="{ active: autoRotate }" title="自动巡游" @click="toggleAutoRotate"><span>◉</span> 巡游</button><button type="button" :class="{ active: showPresets }" title="导览视角" @click="showPresets = !showPresets"><span>⌖</span> 视角</button><button type="button" :class="{ active: scanEnabled }" title="扫描辅助" @click="toggleScan"><span>⌁</span> 扫描</button><button type="button" :class="{ active: wireframe }" title="线框模式" @click="toggleWireframe"><span>⌗</span> 线框</button><button type="button" title="重置视角" @click="resetCamera"><span>↺</span> 复位</button><button type="button" :class="{ active: immersive }" title="沉浸式全屏" @click="toggleImmersive"><span>⛶</span> 沉浸</button><div v-if="showPresets" class="preset-menu"><button type="button" @click="applyCameraPreset('overview')">整体形制</button><button type="button" @click="applyCameraPreset('detail')">构件细部</button><button type="button" @click="applyCameraPreset('axis')">空间轴线</button><button type="button" @click="applyCameraPreset('top')">俯瞰关系</button></div></div>
  </div>
</template>

<style scoped>
.model-canvas { position: absolute; inset: 0; width: 100%; height: 100%; min-height: 470px; overflow: hidden; isolation: isolate; background: radial-gradient(circle at 54% 36%, #24444b 0%, #10232b 31%, #07121a 72%); }
.model-canvas.immersive { position: fixed; inset: 0; z-index: 9999; width: 100vw; height: 100dvh; min-height: 100dvh; }
.model-canvas:fullscreen { position: fixed; inset: 0; width: 100vw; height: 100dvh; min-height: 100dvh; margin: 0; }
.model-canvas.external-active { background: #07121a; }
.model-canvas.external-active::before, .model-canvas.external-active::after { display: none; }
.model-canvas.pagoda-showcase { background: radial-gradient(circle at 52% 32%, #5f4938 0%, #263236 32%, #0b151a 78%); }
.model-canvas.pagoda-showcase::before { background: linear-gradient(180deg, rgba(214, 164, 101, .16), transparent 28%, transparent 68%, rgba(2, 8, 12, .86)); }
.model-canvas.pagoda-showcase .hud-kicker { color: #d4a56a; }
.model-canvas.pagoda-showcase .live-pill { border-color: rgba(211, 163, 101, .5); color: #e3bd84; }
.model-canvas::before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(2, 9, 13, .28), transparent 24%, transparent 68%, rgba(2, 8, 12, .82)); }
.model-canvas::after { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: .18; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(131, 222, 220, .12) 4px, transparent 5px); mix-blend-mode: screen; }
.model-canvas :deep(canvas) { position: absolute !important; inset: 0; z-index: 0; display: block; width: 100% !important; height: 100% !important; }
.external-model { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; border: 0; background: #0b171d; }
.viewer-hud, .viewer-toolbar { position: absolute; z-index: 3; pointer-events: none; color: #c8e0dc; font-family: 'Noto Sans SC', sans-serif; }
.viewer-hud { inset: 0; }
.hud-head { position: absolute; top: 18px; left: 20px; right: 20px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.hud-kicker { display: block; color: #75c5c5; font-size: 8px; letter-spacing: .19em; margin-bottom: 6px; }
.hud-head strong { display: block; color: #f1dfc3; font: 600 13px 'Noto Serif SC', serif; letter-spacing: .08em; }
.asset-status { display: block; margin-top: 4px; color: #87aaa4; font-size: 8px; letter-spacing: .04em; }
.asset-progress { position: absolute; top: 92px; left: 20px; right: 20px; height: 2px; background: rgba(135, 192, 187, .2); }
.asset-progress span { display: block; height: 100%; background: linear-gradient(90deg, #d2a56b, #70d4cc); transition: width .2s ease; }
.asset-progress b { position: absolute; right: 0; top: 5px; color: #a7cbc3; font-size: 8px; font-weight: 400; }
.live-pill { display: inline-flex; align-items: center; gap: 6px; color: #90d5cc; font-size: 8px; letter-spacing: .13em; border: 1px solid rgba(118, 215, 208, .36); padding: 5px 7px; background: rgba(5, 25, 30, .42); }
.live-pill i, .hud-status i { width: 5px; height: 5px; border-radius: 50%; display: inline-block; background: #76e0d2; box-shadow: 0 0 9px #76e0d2; }
.hud-reticle { position: absolute; top: 44%; left: 50%; width: 82px; height: 82px; transform: translate(-50%, -50%); border: 1px solid rgba(126, 214, 212, .16); border-radius: 50%; }
.hud-reticle::before, .hud-reticle::after { content: ''; position: absolute; background: rgba(126, 214, 212, .36); }
.hud-reticle::before { width: 1px; height: 112px; top: -16px; left: 40px; }
.hud-reticle::after { width: 112px; height: 1px; top: 40px; left: -16px; }
.hud-reticle span { position: absolute; inset: 14px; border: 1px dashed rgba(208, 177, 119, .45); border-radius: 50%; }
.hud-reticle b, .hud-reticle em { position: absolute; width: 8px; height: 8px; border-color: #d0a164; border-style: solid; }
.hud-reticle b { top: -1px; left: -1px; border-width: 1px 0 0 1px; }
.hud-reticle em { right: -1px; bottom: -1px; border-width: 0 1px 1px 0; }
.hud-hotspot { position: absolute; display: flex; align-items: center; gap: 6px; border: 0; padding: 0; color: #a4d8d3; font: inherit; font-size: 9px; letter-spacing: .08em; text-shadow: 0 1px 8px #061116; background: transparent; cursor: pointer; pointer-events: auto; transition: color .2s ease, transform .2s ease; }
.hud-hotspot:hover, .hud-hotspot:focus-visible { color: #f0ddbd; transform: scale(1.04); outline: none; }
.hud-hotspot::before { content: ''; width: 24px; height: 1px; background: linear-gradient(90deg, #67d3d0, transparent); }
.hud-hotspot b { width: 18px; height: 18px; display: grid; place-items: center; border: 1px solid #d1a267; border-radius: 50%; color: #ecd4ab; font-size: 8px; font-weight: 500; background: rgba(15, 34, 38, .76); }
.hotspot-one { top: 38%; left: 7%; }
.hotspot-two { top: 58%; right: 7%; flex-direction: row-reverse; }
.hotspot-two::before { transform: rotate(180deg); }
.hotspot-three { bottom: 22%; left: 12%; }
.hud-bottom { position: absolute; bottom: 15px; left: 20px; right: 20px; display: flex; justify-content: space-between; gap: 12px; align-items: center; color: #76908f; font-size: 9px; }
.hud-status { display: inline-flex; align-items: center; gap: 6px; color: #b8d4cb; }
.hud-help { opacity: .76; letter-spacing: .05em; }
.viewer-toolbar { top: 57px; right: 16px; display: grid; gap: 5px; pointer-events: auto; }
.viewer-toolbar button { display: flex; align-items: center; gap: 5px; min-width: 67px; padding: 6px 8px; border: 1px solid rgba(115, 198, 197, .24); color: #9bc6c3; background: rgba(4, 19, 24, .62); font-size: 9px; letter-spacing: .05em; transition: .2s ease; }
.viewer-toolbar button span { color: #e0b97d; font-size: 13px; line-height: 1; }
.viewer-toolbar button:hover, .viewer-toolbar button.active { border-color: rgba(212, 167, 99, .72); color: #f0ddbd; background: rgba(70, 47, 30, .46); }
.preset-menu { display: grid; gap: 4px; padding: 5px; border: 1px solid rgba(115, 198, 197, .24); background: rgba(4, 19, 24, .9); }
.preset-menu button { min-width: 92px; border: 0; padding: 6px 7px; color: #a9c9c4; background: rgba(28, 57, 60, .56); font-size: 9px; text-align: left; }
.preset-menu button:hover { color: #f0ddbd; background: rgba(70, 47, 30, .58); }
@media (max-width: 540px) {
  .hud-hotspot, .hud-help { display: none; }
  .hud-head { left: 14px; right: 14px; flex-direction: column; align-items: flex-start; gap: 7px; }
  .hud-head strong { max-width: min(260px, 74vw); line-height: 1.45; }
  .live-pill { max-width: 168px; padding: 4px 6px; line-height: 1.35; }
  .viewer-toolbar { top: auto; right: 10px; left: 10px; bottom: 68px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 4px; }
  .viewer-toolbar button { min-width: 0; justify-content: center; gap: 3px; padding: 5px 3px; font-size: 8px; background: rgba(4, 19, 24, .54); }
  .viewer-toolbar button span { font-size: 11px; }
  .preset-menu { grid-column: 1 / -1; grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .preset-menu button { min-width: 0; justify-content: center; text-align: center; }
  .hud-bottom { left: 14px; right: 14px; bottom: 14px; justify-content: center; text-align: center; }
  .hud-status { max-width: 100%; padding: 4px 6px; background: rgba(4, 19, 24, .48); }
}
</style>
