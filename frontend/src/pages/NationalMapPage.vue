<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, Crosshair, Layers3, MapPin, RotateCcw, Search, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildings } from '../data/buildings'
import type { Building } from '../types/building'

const router = useRouter()
const canvasElement = ref<HTMLCanvasElement | null>(null)
const selectedId = ref<string | null>(null)
const query = ref('')
const showLabels = ref(true)
const mapMode = ref<'terrain' | 'network'>('terrain')
const isLoading = ref(true)

const selectedBuilding = computed(() => buildings.find((building) => building.id === selectedId.value) ?? null)
const filteredBuildings = computed(() => {
  const value = query.value.trim().toLowerCase()
  if (!value) return buildings
  return buildings.filter((building) => [building.name, building.region, building.location, building.category].some((field) => field?.toLowerCase().includes(value)))
})
const regionsCount = computed(() => new Set(buildings.map((building) => building.region).filter(Boolean)).size)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let animationFrame = 0
let resizeObserver: ResizeObserver | undefined
let raycaster: THREE.Raycaster | undefined
let pointer: THREE.Vector2 | undefined
let markerGroup: THREE.Group | undefined
let markerMeshes: THREE.Mesh[] = []
let labelGroup: THREE.Group | undefined

const bounds = { minLng: 73, maxLng: 135, minLat: 18, maxLat: 54 }
const palette = ['#b95f45', '#d39b52', '#47948b', '#799bb0', '#92705e', '#b56b84']

function project(lng: number, lat: number, z = 0) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng) - 0.5) * 18
  const y = ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat) - 0.5) * 12
  return new THREE.Vector3(x, z, y)
}

function makeTextSprite(text: string, color = '#f7efdf') {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const context = canvas.getContext('2d')!
  context.font = '600 24px "Noto Sans SC", Arial'
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, 128, 32)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(1.65, 0.42, 1)
  return sprite
}

function buildTerrain() {
  if (!scene) return
  const terrain = new THREE.Group()
  terrain.name = 'terrain'
  const geometry = new THREE.PlaneGeometry(18, 12, 36, 24)
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i)
    const z = position.getY(i)
    const ridge = Math.sin(x * 0.55) * 0.08 + Math.cos(z * 0.7) * 0.06 + Math.sin((x + z) * 0.35) * 0.05
    position.setZ(i, ridge)
  }
  geometry.computeVertexNormals()
  const material = new THREE.MeshStandardMaterial({ color: '#31585b', roughness: 0.92, metalness: 0.04, flatShading: true })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.rotation.x = -Math.PI / 2
  terrain.add(mesh)
  const base = new THREE.Mesh(new THREE.BoxGeometry(18.2, 0.24, 12.2), new THREE.MeshStandardMaterial({ color: '#17383e', roughness: 0.78 }))
  base.position.y = -0.24
  terrain.add(base)
  const grid = new THREE.GridHelper(18, 18, '#5c958d', '#315e61')
  grid.position.y = 0.035
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.24
  terrain.add(grid)
  scene.add(terrain)
}

function buildRoutes() {
  if (!scene) return
  const routeGroup = new THREE.Group()
  const valid = buildings.filter((building) => building.coordinates?.length === 2)
  const sorted = [...valid].sort((a, b) => a.coordinates[0] - b.coordinates[0])
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const a = sorted[index]
    const b = sorted[index + 1]
    const p1 = project(a.coordinates[0], a.coordinates[1], 0.1)
    const p2 = project(b.coordinates[0], b.coordinates[1], 0.1)
    const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#83c5b5', transparent: true, opacity: 0.2 }))
    routeGroup.add(line)
  }
  scene.add(routeGroup)
}

function buildMarkers() {
  if (!scene) return
  const markers = new THREE.Group()
  markerGroup = markers
  markerGroup.name = 'markers'
  labelGroup = new THREE.Group()
  markerMeshes = []
  buildings.forEach((building, index) => {
    if (!building.coordinates) return
    const [lng, lat] = building.coordinates
    const point = project(lng, lat)
    const height = 0.22 + (index % 4) * 0.09
    const group = new THREE.Group()
    group.userData.buildingId = building.id
    const material = new THREE.MeshStandardMaterial({ color: palette[index % palette.length], emissive: palette[index % palette.length], emissiveIntensity: 0.18, roughness: 0.38, metalness: 0.35 })
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, height, 12), material)
    pin.position.y = height / 2 + 0.08
    group.add(pin)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.205, 32), new THREE.MeshBasicMaterial({ color: palette[index % palette.length], transparent: true, opacity: 0.62, side: THREE.DoubleSide }))
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.08
    group.add(ring)
    group.position.copy(point)
    markers.add(group)
    markerMeshes.push(pin)
    if (labelGroup) {
      const label = makeTextSprite(building.name)
      label.position.set(point.x, height + 0.35, point.z)
      label.visible = showLabels.value
      label.userData.buildingId = building.id
      labelGroup.add(label)
    }
  })
  scene.add(markerGroup)
  scene.add(labelGroup)
}

function highlightSelection() {
  if (!markerGroup) return
  markerGroup.children.forEach((child) => {
    const active = child.userData.buildingId === selectedId.value
    child.scale.setScalar(active ? 1.35 : 1)
    child.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) node.material.emissiveIntensity = active ? 0.7 : 0.18
    })
  })
}

function handlePointer(event: PointerEvent) {
  if (!renderer || !camera || !markerGroup || !raycaster || !pointer || !canvasElement.value) return
  const rect = canvasElement.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(markerMeshes, false)[0]
  if (!hit) return
  const marker = hit.object.parent
  if (marker?.userData.buildingId) {
    selectedId.value = marker.userData.buildingId
    highlightSelection()
  }
}

function selectBuilding(building: Building) {
  selectedId.value = building.id
  highlightSelection()
  if (camera && controls && building.coordinates) {
    const target = project(building.coordinates[0], building.coordinates[1], 0)
    controls.target.lerp(target, 0.2)
  }
}

function resetView() {
  selectedId.value = null
  if (controls) {
    controls.reset()
    controls.target.set(0, 0, 0)
  }
  highlightSelection()
}

function enterDetail() {
  if (selectedBuilding.value) router.push(`/buildings/${selectedBuilding.value.id}`)
}

function toggleLabels() {
  showLabels.value = !showLabels.value
  labelGroup?.children.forEach((label) => { label.visible = showLabels.value })
}

function initScene() {
  if (!canvasElement.value) return
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement.value, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvasElement.value.clientWidth, canvasElement.value.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#102f35')
  camera = new THREE.PerspectiveCamera(38, canvasElement.value.clientWidth / canvasElement.value.clientHeight, 0.1, 100)
  camera.position.set(0, 11.5, 11.5)
  camera.lookAt(0, 0, 0)
  controls = new OrbitControls(camera, canvasElement.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.07
  controls.minDistance = 7
  controls.maxDistance = 24
  controls.maxPolarAngle = Math.PI * 0.47
  controls.minPolarAngle = Math.PI * 0.18
  controls.target.set(0, 0, 0)
  scene.add(new THREE.HemisphereLight('#dce9db', '#0d2025', 2.1))
  const keyLight = new THREE.DirectionalLight('#ffe2b6', 2.4)
  keyLight.position.set(-5, 10, 5)
  scene.add(keyLight)
  scene.add(new THREE.AmbientLight('#69aaa1', 0.5))
  buildTerrain()
  buildRoutes()
  buildMarkers()
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvasElement.value.addEventListener('pointerup', handlePointer)
  resizeObserver = new ResizeObserver(() => {
    if (!canvasElement.value || !renderer || !camera) return
    const width = canvasElement.value.clientWidth
    const height = canvasElement.value.clientHeight
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  })
  resizeObserver.observe(canvasElement.value)
  isLoading.value = false
  const render = () => {
    if (!renderer || !scene || !camera) return
    controls?.update()
    renderer.render(scene, camera)
    animationFrame = requestAnimationFrame(render)
  }
  render()
}

onMounted(() => nextTick(initScene))
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  canvasElement.value?.removeEventListener('pointerup', handlePointer)
  controls?.dispose()
  renderer?.dispose()
  scene?.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose()
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose())
      else object.material.dispose()
    }
  })
})
</script>

<template>
  <div class="atlas-map-page">
    <canvas ref="canvasElement" class="map-canvas" aria-label="全国建筑三维地图" />
    <div class="map-vignette" aria-hidden="true" />
    <header class="map-header">
      <button class="map-back" type="button" aria-label="返回首页" @click="router.push('/')"><ArrowLeft :size="17" /> <span>退出地图</span></button>
      <div class="map-brand"><span class="map-brand-mark">▮▮</span><span><strong>全国建筑图谱</strong><small>NATIONAL ARCHITECTURE ATLAS</small></span></div>
      <div class="map-status"><span class="status-dot" /> LIVE ATLAS <span class="map-date">2025 / SAMPLE DATA</span></div>
    </header>
    <aside class="map-sidebar">
      <div class="sidebar-kicker">03 / NATIONAL MAP</div>
      <h1>在全国建筑<br><em>空间中游览。</em></h1>
      <p class="sidebar-intro">拖拽旋转地图，滚轮调整尺度。选择节点，打开一座建筑的数字档案。</p>
      <label class="map-search"><Search :size="15" /><input v-model="query" type="search" placeholder="搜索省份、城市或建筑" /></label>
      <div class="map-filters"><button type="button" :class="{ active: mapMode === 'terrain' }" @click="mapMode = 'terrain'"><Layers3 :size="14" />地形视图</button><button type="button" :class="{ active: mapMode === 'network' }" @click="mapMode = 'network'"><Crosshair :size="14" />谱系连线</button></div>
      <div class="map-list" aria-label="建筑节点列表">
        <button v-for="building in filteredBuildings.slice(0, 7)" :key="building.id" type="button" class="map-list-item" :class="{ active: selectedId === building.id }" @click="selectBuilding(building)"><span class="list-dot" :style="{ background: palette[buildings.indexOf(building) % palette.length] }" /><span><strong>{{ building.name }}</strong><small>{{ building.region }} · {{ building.category }}</small></span><MapPin :size="14" /></button>
      </div>
      <div class="sidebar-foot"><span>{{ regionsCount }} 省级入口 · {{ buildings.length }} 个样本</span><span>地图数据持续接入</span></div>
    </aside>
    <section class="map-controls" aria-label="地图控制"><button type="button" @click="toggleLabels">{{ showLabels ? '隐藏标注' : '显示标注' }}</button><button type="button" title="重置视角" aria-label="重置视角" @click="resetView"><RotateCcw :size="15" /></button></section>
    <aside v-if="selectedBuilding" class="detail-panel"><button class="detail-close" type="button" aria-label="关闭详情" @click="selectedId = null; highlightSelection()"><X :size="17" /></button><span class="detail-kicker">{{ selectedBuilding.region }} · {{ selectedBuilding.category }}</span><h2>{{ selectedBuilding.name }}</h2><p>{{ selectedBuilding.summary }}</p><dl><div><dt>年代</dt><dd>{{ selectedBuilding.era }}</dd></div><div><dt>位置</dt><dd>{{ selectedBuilding.location }}</dd></div><div><dt>状态</dt><dd>{{ selectedBuilding.status }}</dd></div></dl><button class="detail-action" type="button" @click="enterDetail">查看建筑档案 <ArrowLeft :size="15" /></button></aside>
    <div v-if="isLoading" class="map-loading">正在加载全国建筑空间…</div>
    <div class="map-hint">拖拽旋转 · 滚轮缩放 · 点击节点查看详情</div>
  </div>
</template>

<style scoped>
.atlas-map-page { position: fixed; inset: 0; z-index: 50; overflow: hidden; color: #f6efdf; background: #102f35; font-family: 'Noto Sans SC', system-ui, sans-serif; }
.map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
.map-canvas:active { cursor: grabbing; }
.map-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 55% 48%, transparent 22%, rgba(5, 20, 24, .12) 66%, rgba(5, 20, 24, .74) 100%), linear-gradient(90deg, rgba(7, 26, 31, .88), transparent 28%, transparent 72%, rgba(7, 26, 31, .48)); }
.map-header { position: absolute; z-index: 3; top: 0; left: 0; right: 0; height: 78px; display: flex; align-items: center; justify-content: space-between; padding: 0 34px; border-bottom: 1px solid rgba(218, 191, 135, .18); background: linear-gradient(180deg, rgba(10, 31, 36, .83), rgba(10, 31, 36, .22)); }
.map-back { display: inline-flex; align-items: center; gap: 9px; padding: 8px 0; color: rgba(248, 240, 222, .78); border: 0; background: transparent; font: 11px inherit; cursor: pointer; }
.map-back:hover { color: #d8b170; }
.map-brand { display: flex; align-items: center; gap: 12px; position: absolute; left: 50%; transform: translateX(-50%); }
.map-brand-mark { color: #d5ae69; letter-spacing: -5px; font-weight: 800; font-size: 21px; }
.map-brand strong { display: block; color: #fbf3e1; font: 600 17px 'Noto Serif SC', serif; }
.map-brand small { display: block; margin-top: 2px; color: #80aaa3; font: 8px Arial, sans-serif; letter-spacing: .22em; }
.map-status { display: inline-flex; align-items: center; gap: 7px; color: #7fa89f; font-size: 9px; letter-spacing: .16em; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #d6ac6a; box-shadow: 0 0 10px #d6ac6a; }
.map-date { margin-left: 12px; color: rgba(245, 232, 205, .4); }
.map-sidebar { position: absolute; z-index: 3; left: 34px; top: 118px; bottom: 48px; width: min(330px, calc(100vw - 68px)); display: flex; flex-direction: column; }
.sidebar-kicker { color: #d1ac6b; font-size: 9px; letter-spacing: .2em; }
.map-sidebar h1 { margin: 20px 0 13px; color: #fff7e6; font: 500 clamp(31px, 3vw, 47px)/1.16 'Noto Serif SC', serif; letter-spacing: -.06em; }
.map-sidebar h1 em { color: #8fd0c1; font-style: normal; }
.sidebar-intro { max-width: 300px; margin: 0 0 22px; color: rgba(240, 231, 212, .66); font-size: 12px; line-height: 1.9; }
.map-search { display: flex; align-items: center; gap: 9px; padding: 11px 12px; border: 1px solid rgba(217, 191, 139, .26); background: rgba(14, 42, 47, .68); color: #9fc4bb; }
.map-search input { min-width: 0; width: 100%; border: 0; outline: 0; color: #f8f0de; background: transparent; font: 11px inherit; }
.map-search input::placeholder { color: rgba(239, 229, 208, .4); }
.map-filters { display: flex; gap: 8px; margin: 12px 0; }
.map-filters button, .map-controls button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 10px; color: rgba(239, 228, 205, .61); border: 1px solid rgba(218, 191, 135, .2); background: rgba(14, 42, 47, .54); font: 10px inherit; cursor: pointer; }
.map-filters button.active, .map-filters button:hover, .map-controls button:hover { color: #e7c37f; border-color: rgba(218, 191, 135, .58); }
.map-list { flex: 1; min-height: 0; overflow: auto; padding-right: 7px; }
.map-list-item { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 11px 10px; color: #efe6d1; text-align: left; border: 1px solid transparent; border-bottom-color: rgba(220, 199, 161, .11); background: transparent; cursor: pointer; }
.map-list-item:hover, .map-list-item.active { color: #fff7e6; border-color: rgba(126, 192, 177, .42); background: rgba(48, 98, 97, .38); }
.list-dot { width: 7px; height: 7px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
.map-list-item strong { display: block; font: 600 13px 'Noto Serif SC', serif; }
.map-list-item small { display: block; margin-top: 3px; color: rgba(239, 228, 205, .5); font-size: 9px; }
.map-list-item > svg { color: rgba(239, 228, 205, .42); }
.sidebar-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 13px; padding-top: 13px; border-top: 1px solid rgba(220, 199, 161, .13); color: rgba(239, 228, 205, .43); font-size: 9px; }
.map-controls { position: absolute; z-index: 3; right: 34px; bottom: 42px; display: flex; gap: 8px; }
.map-controls button:last-child { padding: 8px; }
.detail-panel { position: absolute; z-index: 4; right: 34px; top: 50%; transform: translateY(-50%); width: min(320px, calc(100vw - 68px)); padding: 26px 25px 24px; color: #18383c; background: rgba(247, 240, 224, .95); border: 1px solid rgba(218, 177, 105, .54); box-shadow: 0 24px 70px rgba(2, 17, 20, .35); }
.detail-close { position: absolute; top: 12px; right: 12px; display: grid; place-items: center; padding: 4px; color: #6c776e; border: 0; background: transparent; cursor: pointer; }
.detail-kicker { color: #a56f3e; font-size: 9px; font-weight: 700; letter-spacing: .15em; }
.detail-panel h2 { margin: 12px 0 8px; font: 600 28px 'Noto Serif SC', serif; letter-spacing: -.04em; }
.detail-panel p { margin: 0 0 17px; color: #5c6964; font-size: 12px; line-height: 1.8; }
.detail-panel dl { display: grid; gap: 8px; margin: 0 0 20px; padding-top: 14px; border-top: 1px solid rgba(25, 56, 60, .14); }
.detail-panel dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 10px; }
.detail-panel dt { color: #8b8e83; }
.detail-panel dd { margin: 0; color: #284c4c; text-align: right; }
.detail-action { display: inline-flex; align-items: center; gap: 8px; padding: 10px 13px; color: #f8f0df; border: 0; background: #a4543e; font: 11px inherit; cursor: pointer; }
.detail-action svg { transform: rotate(180deg); }
.map-hint { position: absolute; z-index: 3; right: 35px; bottom: 18px; color: rgba(239, 228, 205, .39); font-size: 9px; letter-spacing: .08em; }
.map-loading { position: absolute; z-index: 5; inset: 0; display: grid; place-items: center; color: #dcb776; background: #102f35; font: 13px 'Noto Serif SC', serif; }
@media (max-width: 760px) {
  .map-header { height: 62px; padding: 0 17px; }
  .map-brand { left: auto; right: 17px; transform: none; }
  .map-brand strong { font-size: 14px; }
  .map-brand small, .map-status, .map-brand-mark { display: none; }
  .map-sidebar { left: 17px; top: 83px; bottom: 28px; width: min(300px, calc(100vw - 34px)); }
  .map-sidebar h1 { margin-top: 14px; font-size: 31px; }
  .sidebar-intro { max-width: 250px; margin-bottom: 14px; font-size: 11px; }
  .map-list { max-height: 40vh; flex: none; }
  .detail-panel { right: 17px; left: 17px; top: auto; bottom: 25px; width: auto; transform: none; }
  .map-controls { right: 17px; bottom: 18px; }
  .map-hint { display: none; }
}
</style>
