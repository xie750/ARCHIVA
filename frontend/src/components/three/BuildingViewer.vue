<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { disposeObject3D, loadModelAsset } from '../../services/modelLoader'

const props = withDefaults(defineProps<{
  kind: 'grotto' | 'temple' | 'gate' | 'pagoda' | 'garden'
  /** A reviewed GLB URL. The procedural scene remains the explicit fallback. */
  assetUrl?: string
  /** Endpoint returning a ModelManifest with a lod[] array. */
  manifestUrl?: string
  /** Official third-party viewer embed. Used when the source does not allow GLB redistribution. */
  embedUrl?: string
}>(), { assetUrl: undefined, manifestUrl: undefined })
const mount = ref<HTMLDivElement | null>(null)
const autoRotate = ref(true)
const wireframe = ref(false)
const scanEnabled = ref(true)
const viewerState = ref('概念模型 · 交互预览')
const modelStatus = ref('形制示意 · 等待审核资产')
const loadProgress = ref(0)
const loadingAsset = ref(false)
const externalEmbed = computed(() => props.embedUrl)
const modelLabel = computed(() => ({ grotto: '石窟群 · 空间扫描', temple: '寺院轴线 · 空间扫描', gate: '城门遗址 · 形制复原', pagoda: '楼阁古塔 · 构件扫描', garden: '宋式园林 · 场景复原' }[props.kind]))
let renderer: THREE.WebGLRenderer | undefined
let controls: OrbitControls | undefined
let camera: THREE.PerspectiveCamera | undefined
let frame = 0
let cleanup = () => undefined
let loadedModel: THREE.Object3D | undefined
let requestController: AbortController | undefined
let initialCamera = new THREE.Vector3(9, 6.5, 11)
let initialTarget = new THREE.Vector3(0, 2, 0)
const trackedMaterials: THREE.Material[] = []
const animatedRings: Array<{ mesh: THREE.Mesh; speed: number; baseY: number }> = []
let scanMaterial: THREE.MeshBasicMaterial | undefined
function registerMaterial(material: THREE.Material) { if (!trackedMaterials.includes(material)) trackedMaterials.push(material); return material }
function setMeshProps(mesh: THREE.Mesh) { mesh.castShadow = true; mesh.receiveShadow = true; if (Array.isArray(mesh.material)) mesh.material.forEach(registerMaterial); else registerMaterial(mesh.material); return mesh }
function addBox(group: THREE.Group, size: [number, number, number], position: [number, number, number], material: THREE.Material) { const mesh = setMeshProps(new THREE.Mesh(new THREE.BoxGeometry(...size), material)); mesh.position.set(...position); group.add(mesh); return mesh }
function addRoof(group: THREE.Group, radius: number, height: number, y: number, material: THREE.Material, rotation = Math.PI / 4) { const mesh = setMeshProps(new THREE.Mesh(new THREE.ConeGeometry(radius, height, 4), material)); mesh.rotation.y = rotation; mesh.position.y = y; group.add(mesh); return mesh }
function addLine(group: THREE.Group, points: THREE.Vector3[], color: number, opacity = 0.45) { const geometry = new THREE.BufferGeometry().setFromPoints(points); const material = registerMaterial(new THREE.LineBasicMaterial({ color, transparent: true, opacity })) as THREE.LineBasicMaterial; const line = new THREE.Line(geometry, material); group.add(line); return line }
function addTechRing(group: THREE.Group, radius: number, y: number, color: number, speed: number) { const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.56, side: THREE.DoubleSide }); registerMaterial(material); const ring = new THREE.Mesh(new THREE.RingGeometry(radius - 0.015, radius, 96), material); ring.rotation.x = -Math.PI / 2; ring.position.y = y; group.add(ring); animatedRings.push({ mesh: ring, speed, baseY: y }); return ring }
function addFinials(group: THREE.Group, width: number, y: number, material: THREE.Material) { for (const x of [-width / 2, width / 2]) for (const z of [-width / 2, width / 2]) { const finial = setMeshProps(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 6), material)); finial.position.set(x, y, z); group.add(finial) } }

function buildScene(kind: typeof props.kind) {
  animatedRings.length = 0
  trackedMaterials.length = 0
  scanMaterial = undefined
  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2('#07121b', 0.026)
  const cameraInstance = new THREE.PerspectiveCamera(34, 1, 0.1, 120)
  cameraInstance.position.set(9, 6.6, 11); camera = cameraInstance; initialCamera = cameraInstance.position.clone()
  scene.add(new THREE.HemisphereLight('#d9e8ed', '#05090d', 1.55))
  const key = new THREE.DirectionalLight('#ffe2b6', 4.8); key.position.set(8, 14, 7); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 55; key.shadow.camera.left = -20; key.shadow.camera.right = 20; key.shadow.camera.top = 20; key.shadow.camera.bottom = -20; scene.add(key)
  const rim = new THREE.SpotLight('#66c9d5', 15, 38, Math.PI / 7, 0.7, 1.4); rim.position.set(-10, 9, -11); rim.target.position.set(0, 2, 0); scene.add(rim, rim.target)
  const warmFill = new THREE.PointLight('#db744b', 2.6, 20); warmFill.position.set(3, 2.2, 4); scene.add(warmFill)
  const environment = new THREE.Group()
  const groundMaterial = registerMaterial(new THREE.MeshStandardMaterial({ color: '#0b171d', roughness: 0.88, metalness: 0.18 }))
  const ground = setMeshProps(new THREE.Mesh(new THREE.CircleGeometry(18, 96), groundMaterial)); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; environment.add(ground)
  const grid = new THREE.GridHelper(34, 34, 0x32717b, 0x17343d); const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material]; gridMaterials.forEach((material) => { material.transparent = true; material.opacity = 0.24; registerMaterial(material) }); grid.position.y = 0.015; environment.add(grid)
  addTechRing(environment, 4.6, 0.035, 0x4bc3cc, 0.15); addTechRing(environment, 6.3, 0.04, 0xbf8751, -0.1); addTechRing(environment, 8.4, 0.045, 0x2b6973, 0.06)
  for (let i = 0; i < 16; i += 1) { const a = (i / 16) * Math.PI * 2; const radius = i % 2 ? 8.4 : 6.3; const point = new THREE.Vector3(Math.cos(a) * radius, 0.05, Math.sin(a) * radius); addLine(environment, [point.clone().multiplyScalar(0.78), point], i % 2 ? 0x3faeb8 : 0xa77b4d, 0.5) }
  scene.add(environment)
  const particleCount = 170; const particlePositions = new Float32Array(particleCount * 3)
  for (let i = 0; i < particleCount; i += 1) { const angle = Math.random() * Math.PI * 2; const radius = 5 + Math.random() * 13; particlePositions[i * 3] = Math.cos(angle) * radius; particlePositions[i * 3 + 1] = 0.3 + Math.random() * 10; particlePositions[i * 3 + 2] = Math.sin(angle) * radius }
  const particleGeometry = new THREE.BufferGeometry(); particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3)); const particles = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0x78c7cc, size: 0.045, transparent: true, opacity: 0.52, depthWrite: false })); scene.add(particles)
  const group = new THREE.Group()
  const stone = registerMaterial(new THREE.MeshStandardMaterial({ color: kind === 'grotto' ? '#9c735e' : '#a87850', roughness: 0.68, metalness: 0.08 })); const stoneLight = registerMaterial(new THREE.MeshStandardMaterial({ color: '#cfaa7a', roughness: 0.6, metalness: 0.1 })); const dark = registerMaterial(new THREE.MeshStandardMaterial({ color: '#312b28', roughness: 0.77, metalness: 0.18 })); const red = registerMaterial(new THREE.MeshStandardMaterial({ color: '#8d2e2a', roughness: 0.65, metalness: 0.12 })); const gold = registerMaterial(new THREE.MeshStandardMaterial({ color: '#c69b5f', roughness: 0.42, metalness: 0.4 })); const cyan = registerMaterial(new THREE.MeshBasicMaterial({ color: 0x76e1e5, transparent: true, opacity: 0.8 }))
  if (kind === 'pagoda') {
    for (let i = 0; i < 9; i += 1) { const width = 3.65 - i * 0.24; const baseY = 0.32 + i * 0.78; addBox(group, [width, 0.54, width], [0, baseY, 0], i % 2 ? stone : dark); addBox(group, [width + 0.38, 0.1, width + 0.38], [0, baseY + 0.3, 0], gold); addRoof(group, width * 0.76, 0.58, baseY + 0.64, i % 2 ? gold : dark); addFinials(group, width + 0.22, baseY + 0.43, gold); for (const x of [-width * 0.42, width * 0.42]) for (const z of [-width * 0.42, width * 0.42]) addBox(group, [0.14, 0.38, 0.14], [x, baseY + 0.16, z], stoneLight) }
    addBox(group, [0.72, 7.7, 0.72], [0, 3.5, 0], stoneLight); addBox(group, [0.15, 7.2, 0.15], [0, 3.65, 0], cyan)
  } else if (kind === 'gate') {
    addBox(group, [9.3, 0.45, 2.8], [0, 0.22, 0], dark)
    for (const x of [-3.4, 0, 3.4]) { addBox(group, [1.28, 4.85, 1.3], [x, 2.65, 0], red); addBox(group, [1.52, 0.26, 1.54], [x, 5.02, 0], gold); addRoof(group, 1.92, 0.78, 5.45, gold); addFinials(group, 1.65, 5.18, gold) }
    addBox(group, [8.6, 1.05, 2.15], [0, 4.55, 0], red); addRoof(group, 5.2, 1.05, 5.45, dark); for (const x of [-2.1, 2.1]) addBox(group, [0.17, 3.4, 0.18], [x, 2.2, -1.14], gold); addBox(group, [2.0, 3.15, 0.3], [0, 1.65, -1.18], dark)
  } else if (kind === 'grotto') {
    addBox(group, [8.8, 1.45, 2.25], [0, 0.72, 0], dark); addBox(group, [8.35, 3.3, 1.4], [0, 2.45, 0.15], stone)
    for (let i = -3; i <= 3; i += 1) { const x = i * 1.22; const head = setMeshProps(new THREE.Mesh(new THREE.SphereGeometry(0.56, 24, 16), stoneLight)); head.position.set(x, 3.04 + Math.abs(i) * 0.12, -0.72); group.add(head); addBox(group, [1.08, 1.95, 0.74], [x, 1.58, -0.68], stone); const aura = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.045, 10, 32), cyan)); aura.position.set(x, 3.04 + Math.abs(i) * 0.12, -1.25); aura.rotation.x = Math.PI / 2; group.add(aura) }
    const halo = setMeshProps(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.1, 14, 64), gold)); halo.position.set(0, 3.16, -0.92); halo.rotation.x = Math.PI / 2; group.add(halo)
  } else if (kind === 'garden') {
    addBox(group, [5.8, 0.4, 4.2], [0, 0.23, 0], dark); const water = setMeshProps(new THREE.Mesh(new THREE.CircleGeometry(4.1, 64), new THREE.MeshPhysicalMaterial({ color: '#23515a', roughness: 0.13, metalness: 0.4, clearcoat: 0.7, transparent: true, opacity: 0.9 }))); water.rotation.x = -Math.PI / 2; water.position.set(0, 0.055, 3.4); group.add(water); addRoof(group, 3.5, 1.12, 4.15, gold); for (const x of [-2.2, 2.2]) for (const z of [-1.35, 1.1]) addBox(group, [0.46, 2.95, 0.46], [x, 1.55, z], red); addBox(group, [5.0, 0.3, 0.3], [0, 3, -1.35], red); addBox(group, [4.4, 0.25, 1.1], [0, 0.36, 1.6], stoneLight); for (let i = -2; i <= 2; i += 1) { const lantern = setMeshProps(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 8), gold)); lantern.position.set(i * 1.25, 0.8, -2.15); group.add(lantern) }
  } else {
    addBox(group, [7.2, 0.9, 4.5], [0, 0.45, 0], dark); addBox(group, [6.1, 3.05, 3.35], [0, 2.25, 0], stone); addRoof(group, 4.8, 1.45, 4.45, gold); addBox(group, [1.4, 2.05, 0.32], [0, 1.3, -1.7], dark); for (const x of [-2.15, 2.15]) addBox(group, [0.48, 2.6, 0.48], [x, 1.65, -1.72], red); for (let i = -2; i <= 2; i += 1) addBox(group, [0.16, 2.2, 0.16], [i * 0.65, 1.55, -1.88], gold); addBox(group, [6.6, 0.18, 0.35], [0, 3.9, -1.55], cyan)
  }
  group.rotation.y = -0.28; scene.add(group)
  const scanBeamGeometry = new THREE.PlaneGeometry(14, 0.06); scanMaterial = new THREE.MeshBasicMaterial({ color: 0x65e3e2, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }); const scanBeam = new THREE.Mesh(scanBeamGeometry, scanMaterial); scanBeam.rotation.x = -Math.PI / 2; scanBeam.position.y = 0.1; scene.add(scanBeam)
  return { scene, camera: cameraInstance, group, particles, scanBeam }
}

async function loadReviewedAsset(scene: THREE.Scene, fallback: THREE.Group, rendererInstance: THREE.WebGLRenderer) {
  if ((!props.assetUrl && !props.manifestUrl) || props.assetUrl?.includes('cdn.example.com')) {
    modelStatus.value = '形制示意 · 待接入授权 GLB'
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
      onProgress: (progress) => { loadProgress.value = Math.round(progress * 100) },
    })
    if (!asset || controller.signal.aborted) return
    loadedModel = asset.root
    loadedModel.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach(registerMaterial)
      }
    })
    scene.add(loadedModel)
    fallback.visible = false
    modelStatus.value = `审核 GLB · ${asset.lod.toUpperCase()} 已载入`
    viewerState.value = '真实资产已载入 · 可自由探索'
  } catch (error) {
    if (controller.signal.aborted) return
    modelStatus.value = '形制示意 · 真实资产加载失败'
    viewerState.value = '保持演示模型 · 请检查资产地址'
    console.warn('[BuildingViewer] reviewed GLB failed; using procedural fallback', error)
  } finally {
    loadingAsset.value = false
  }
}

function resetCamera() { if (!camera || !controls) return; camera.position.copy(initialCamera); controls.target.copy(initialTarget); controls.update(); viewerState.value = '视角已复位' }
function toggleWireframe() { wireframe.value = !wireframe.value; trackedMaterials.forEach((material) => { if ('wireframe' in material) (material as THREE.MeshStandardMaterial).wireframe = wireframe.value }); viewerState.value = wireframe.value ? '结构线框模式' : '实体材质模式' }
function toggleAutoRotate() { autoRotate.value = !autoRotate.value; if (controls) controls.autoRotate = autoRotate.value; viewerState.value = autoRotate.value ? '自动巡游中' : '手动探索' }
function toggleScan() { scanEnabled.value = !scanEnabled.value; if (scanMaterial) scanMaterial.opacity = scanEnabled.value ? 0.45 : 0; viewerState.value = scanEnabled.value ? '扫描辅助已开启' : '扫描辅助已关闭' }
onMounted(() => {
  if (props.embedUrl) {
    modelStatus.value = '平台实景扫描 · 外部查看器'
    viewerState.value = '真实资产已载入 · 可自由探索'
    return
  }
  if (!mount.value) return
  const { scene, camera: sceneCamera, group, particles, scanBeam } = buildScene(props.kind)
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.setSize(mount.value.clientWidth, mount.value.clientHeight); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; mount.value.appendChild(renderer.domElement)
  void loadReviewedAsset(scene, group, renderer)
  controls = new OrbitControls(sceneCamera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.075; controls.enablePan = false; controls.autoRotate = autoRotate.value; controls.autoRotateSpeed = 0.55; controls.minDistance = 5.7; controls.maxDistance = 23; controls.maxPolarAngle = Math.PI * 0.47; controls.target.copy(initialTarget)
  const resize = () => { if (!mount.value || !renderer || !camera) return; camera.aspect = mount.value.clientWidth / mount.value.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.value.clientWidth, mount.value.clientHeight) }; window.addEventListener('resize', resize)
  const focusView = () => { if (!camera || !controls) return; const direction = camera.position.clone().sub(controls.target).normalize(); camera.position.copy(controls.target.clone().add(direction.multiplyScalar(7.2))); controls.update(); viewerState.value = '焦点已锁定 · 细部观察' }
  renderer.domElement.addEventListener('dblclick', focusView)
  const clock = new THREE.Clock(); const tick = () => { const elapsed = clock.getElapsedTime(); controls?.update(); group.position.y = Math.sin(elapsed * 0.6) * 0.025; particles.rotation.y = elapsed * 0.012; scanBeam.position.y = scanEnabled.value ? 0.18 + ((elapsed * 0.9) % 5.8) : -20; animatedRings.forEach(({ mesh, speed, baseY }, index) => { mesh.rotation.z = elapsed * speed; mesh.position.y = baseY + Math.sin(elapsed * 1.2 + index) * 0.012 }); renderer?.render(scene, sceneCamera); frame = requestAnimationFrame(tick) }; tick()
  cleanup = () => { requestController?.abort(); window.removeEventListener('resize', resize); renderer?.domElement.removeEventListener('dblclick', focusView); cancelAnimationFrame(frame); controls?.dispose(); disposeObject3D(scene); loadedModel = undefined; animatedRings.length = 0; trackedMaterials.length = 0; scanMaterial = undefined; renderer?.dispose(); renderer?.domElement.remove(); renderer = undefined }
})
onBeforeUnmount(() => { requestController?.abort(); cleanup() })
</script>

<template>
  <div ref="mount" class="model-canvas" :class="{ 'external-active': Boolean(externalEmbed) }" aria-label="建筑三维模型浏览器">
    <iframe v-if="externalEmbed" class="external-model" :src="externalEmbed" title="授权平台实景三维模型" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen loading="lazy" />
    <div class="viewer-hud" aria-hidden="true"><div class="hud-head"><div><span class="hud-kicker">DIGITAL HERITAGE / 现场模式</span><strong>{{ modelLabel }}</strong><small class="asset-status">{{ modelStatus }}</small></div><span class="live-pill"><i /> {{ externalEmbed ? 'PLATFORM 3D' : 'LIVE SCAN' }}</span></div><div v-if="loadingAsset" class="asset-progress"><span :style="{ width: `${loadProgress}%` }" /><b>{{ loadProgress }}%</b></div><div v-if="!externalEmbed" class="hud-reticle"><span /><b /><em /></div><div v-if="!externalEmbed" class="hud-hotspot hotspot-one"><b>01</b><span>主体形制</span></div><div v-if="!externalEmbed" class="hud-hotspot hotspot-two"><b>02</b><span>构件节点</span></div><div v-if="!externalEmbed" class="hud-hotspot hotspot-three"><b>03</b><span>空间轴线</span></div><div class="hud-bottom"><span class="hud-status"><i /> {{ viewerState }}</span><span class="hud-help">拖动旋转 · 滚轮缩放 · 双击聚焦</span></div></div>
    <div v-if="!externalEmbed" class="viewer-toolbar" aria-label="模型控制"><button type="button" :class="{ active: autoRotate }" title="自动巡游" @click="toggleAutoRotate"><span>◉</span> 巡游</button><button type="button" :class="{ active: scanEnabled }" title="扫描辅助" @click="toggleScan"><span>⌁</span> 扫描</button><button type="button" :class="{ active: wireframe }" title="线框模式" @click="toggleWireframe"><span>⌗</span> 线框</button><button type="button" title="重置视角" @click="resetCamera"><span>↺</span> 复位</button></div>
  </div>
</template>

<style scoped>
.model-canvas { position: absolute; inset: 0; min-height: 470px; overflow: hidden; isolation: isolate; background: radial-gradient(circle at 54% 36%, #24444b 0%, #10232b 31%, #07121a 72%); }
.model-canvas.external-active { background: #07121a; }
.model-canvas.external-active::before, .model-canvas.external-active::after { display: none; }
.model-canvas::before { content: ''; position: absolute; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(2, 9, 13, .28), transparent 24%, transparent 68%, rgba(2, 8, 12, .82)); }
.model-canvas::after { content: ''; position: absolute; inset: 0; z-index: 2; pointer-events: none; opacity: .18; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(131, 222, 220, .12) 4px, transparent 5px); mix-blend-mode: screen; }
.model-canvas :deep(canvas) { position: relative; z-index: 0; display: block; width: 100%; height: 100%; }
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
.hud-hotspot { position: absolute; display: flex; align-items: center; gap: 6px; color: #a4d8d3; font-size: 9px; letter-spacing: .08em; text-shadow: 0 1px 8px #061116; }
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
@media (max-width: 540px) { .hud-hotspot, .hud-help { display: none; } .viewer-toolbar { top: 65px; right: 10px; } .hud-head { left: 14px; right: 14px; } .hud-bottom { left: 14px; right: 14px; } }
</style>
