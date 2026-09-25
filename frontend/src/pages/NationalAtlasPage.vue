<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeft, Crosshair, Info, LocateFixed, Rotate3d, Search, X } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildings } from '../data/buildings'

type CityPoint = {
  key: string
  city: string
  region: string
  lat: number
  lng: number
  count: number
  items: typeof buildings
}

const canvasElement = ref<HTMLCanvasElement | null>(null)
const selectedCityKey = ref<string | null>(null)
const hoveredCityKey = ref<string | null>(null)
const query = ref('')
const isLoading = ref(true)
const mapReady = ref(false)

const cityPoints = computed<CityPoint[]>(() => {
  const groups = new Map<string, CityPoint>()
  buildings.forEach((building) => {
    const city = building.location.split(' · ')[0]
    const region = building.region ?? '未分区'
    const key = `${region}-${city}`
    const existing = groups.get(key)
    if (existing) {
      existing.lat = (existing.lat * existing.count + building.coordinates[1]) / (existing.count + 1)
      existing.lng = (existing.lng * existing.count + building.coordinates[0]) / (existing.count + 1)
      existing.count += 1
      existing.items.push(building)
    } else {
      groups.set(key, { key, city, region, lat: building.coordinates[1], lng: building.coordinates[0], count: 1, items: [building] })
    }
  })
  return Array.from(groups.values())
})

const filteredCities = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return cityPoints.value
  return cityPoints.value.filter((point) => `${point.city}${point.region}${point.items.map((item) => item.name).join('')}`.toLowerCase().includes(keyword))
})

const selectedCity = computed(() => cityPoints.value.find((point) => point.key === selectedCityKey.value) ?? null)

let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let renderer: THREE.WebGLRenderer | undefined
let controls: OrbitControls | undefined
let animationFrame = 0
let resizeObserver: ResizeObserver | undefined
let mapGroup: THREE.Group | undefined
let markersGroup: THREE.Group | undefined
let raycaster: THREE.Raycaster | undefined
let pointer: THREE.Vector2 | undefined
let markerMeshes: THREE.Mesh[] = []
let markerByMesh = new Map<THREE.Object3D, CityPoint>()
let provinceMeshes: THREE.Mesh[] = []

const LONG_MIN = 73
const LONG_MAX = 135
const LAT_MIN = 18
const LAT_MAX = 54
const SCALE_X = 0.2
const SCALE_Y = 0.25

function project(lng: number, lat: number) {
  return new THREE.Vector2((lng - (LONG_MIN + LONG_MAX) / 2) * SCALE_X, (lat - (LAT_MIN + LAT_MAX) / 2) * SCALE_Y)
}

function fitRing(points: number[][]) {
  const stride = points.length > 900 ? Math.ceil(points.length / 900) : 1
  return points.filter((_, index) => index % stride === 0).map(([lng, lat]) => project(lng, lat))
}

function addProvinceFeature(feature: any, index: number) {
  if (!mapGroup || !feature?.properties?.name || typeof feature?.properties?.adcode !== 'number') return
  const coordinates = feature.geometry?.coordinates ?? []
  const polygons = feature.geometry?.type === 'Polygon' ? [coordinates] : coordinates
  const material = new THREE.MeshStandardMaterial({ color: index % 3 === 0 ? 0x214f55 : 0x193d47, roughness: .82, metalness: .08, transparent: true, opacity: .9, side: THREE.DoubleSide })
  polygons.forEach((polygon: number[][][]) => {
    const outer = fitRing(polygon[0] ?? [])
    if (outer.length < 3) return
    const shape = new THREE.Shape()
    shape.moveTo(outer[0].x, outer[0].y)
    outer.slice(1).forEach((point) => shape.lineTo(point.x, point.y))
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .22, bevelEnabled: true, bevelSegments: 1, bevelSize: .025, bevelThickness: .02 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.z = -.1
    mesh.userData.province = feature.properties.name
    mapGroup!.add(mesh)
    provinceMeshes.push(mesh)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 28), new THREE.LineBasicMaterial({ color: 0x73b5ac, transparent: true, opacity: .27 }))
    edges.position.z = .14
    mapGroup!.add(edges)
  })
}

function addCityMarker(point: CityPoint) {
  if (!markersGroup) return
  const position = project(point.lng, point.lat)
  const marker = new THREE.Group()
  marker.position.set(position.x, position.y, .38)
  marker.userData.cityKey = point.key
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, .28, 8), new THREE.MeshBasicMaterial({ color: 0xd6aa68 }))
  stem.position.z = -.12
  marker.add(stem)
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(point.count > 1 ? .105 : .075, 16, 12), new THREE.MeshStandardMaterial({ color: point.count > 1 ? 0xd89558 : 0x7bc5b8, emissive: point.count > 1 ? 0x5a2b1c : 0x174d4e, emissiveIntensity: .55, roughness: .36 }))
  sphere.userData.cityKey = point.key
  marker.add(sphere)
  const ring = new THREE.Mesh(new THREE.RingGeometry(point.count > 1 ? .15 : .11, point.count > 1 ? .164 : .124, 32), new THREE.MeshBasicMaterial({ color: point.count > 1 ? 0xd89558 : 0x7bc5b8, transparent: true, opacity: .65, side: THREE.DoubleSide }))
  ring.rotation.x = 0
  ring.position.z = -.03
  marker.add(ring)
  markersGroup.add(marker)
  markerMeshes.push(sphere)
  markerByMesh.set(sphere, point)
}

async function loadProvinceMap() {
  if (!mapGroup) return
  try {
    const response = await fetch('/maps/china.json')
    const data = await response.json()
    data.features.forEach((feature: any, index: number) => addProvinceFeature(feature, index))
  } catch {
    // Markers and the grid remain useful if the boundary asset is unavailable.
  }
}

function selectCity(point: CityPoint | null) {
  selectedCityKey.value = point?.key ?? null
}

function setPointer(event: PointerEvent) {
  if (!renderer || !raycaster || !camera || !canvasElement.value || !pointer) return
  const bounds = canvasElement.value.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(markerMeshes, false)[0]
  hoveredCityKey.value = hit ? markerByMesh.get(hit.object)?.key ?? null : null
  canvasElement.value.style.cursor = hit ? 'pointer' : 'grab'
}

function handleCanvasClick(event: MouseEvent) {
  if (!renderer || !raycaster || !camera || !canvasElement.value || !pointer) return
  const bounds = canvasElement.value.getBoundingClientRect()
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(markerMeshes, false)[0]
  if (hit) selectCity(markerByMesh.get(hit.object) ?? null)
}

function resetView() {
  controls?.reset()
}

function resize() {
  if (!renderer || !camera || !canvasElement.value) return
  const width = canvasElement.value.clientWidth
  const height = canvasElement.value.clientHeight
  camera.aspect = width / Math.max(1, height)
  camera.updateProjectionMatrix()
  renderer.setSize(width, height, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8))
}

function animate() {
  if (!scene || !camera || !renderer) return
  animationFrame = requestAnimationFrame(animate)
  const time = performance.now() * .001
  if (markersGroup) {
    markersGroup.children.forEach((marker, index) => {
      const pulse = 1 + Math.sin(time * 2.1 + index * .55) * .07
      marker.scale.set(pulse, pulse, pulse)
    })
  }
  renderer.render(scene, camera)
}

function mountScene() {
  if (!canvasElement.value) return
  scene = new THREE.Scene()
  scene.fog = new THREE.Fog(0x081a23, 14, 30)
  camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
  camera.position.set(0, 0, 15.5)
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement.value, antialias: true, alpha: true })
  renderer.setClearColor(0x081a23, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  controls = new OrbitControls(camera, canvasElement.value)
  controls.enableDamping = true
  controls.dampingFactor = .06
  controls.enablePan = true
  controls.minDistance = 8
  controls.maxDistance = 23
  controls.minPolarAngle = .22
  controls.maxPolarAngle = 1.42
  controls.target.set(0, 0, 0)
  scene.add(new THREE.AmbientLight(0x9ec5bd, 1.8))
  const keyLight = new THREE.DirectionalLight(0xe4c18d, 2.6)
  keyLight.position.set(-4, 7, 10)
  keyLight.castShadow = true
  scene.add(keyLight)
  const fillLight = new THREE.DirectionalLight(0x3a9f9d, 1.2)
  fillLight.position.set(7, -3, 5)
  scene.add(fillLight)
  const grid = new THREE.GridHelper(16, 32, 0x2e7778, 0x1d4e59)
  grid.rotation.x = Math.PI / 2
  grid.position.z = -.38
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = .16
  scene.add(grid)
  mapGroup = new THREE.Group()
  scene.add(mapGroup)
  markersGroup = new THREE.Group()
  scene.add(markersGroup)
  cityPoints.value.forEach(addCityMarker)
  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvasElement.value.addEventListener('pointermove', setPointer)
  canvasElement.value.addEventListener('click', handleCanvasClick)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvasElement.value)
  resize()
  mapReady.value = true
  isLoading.value = false
  void loadProvinceMap()
  animate()
}

onMounted(mountScene)
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  canvasElement.value?.removeEventListener('pointermove', setPointer)
  canvasElement.value?.removeEventListener('click', handleCanvasClick)
  controls?.dispose()
  renderer?.dispose()
  provinceMeshes.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
  markerMeshes.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() })
  scene = undefined
  camera = undefined
  renderer = undefined
  controls = undefined
  mapGroup = undefined
  markersGroup = undefined
  provinceMeshes = []
  markerMeshes = []
  markerByMesh = new Map()
})
</script>

<template>
  <div class="atlas-page">
    <canvas ref="canvasElement" class="atlas-canvas" aria-label="全国建筑三维图谱，可拖动旋转和滚轮缩放" />
    <div class="atlas-atmosphere" aria-hidden="true" />
    <header class="atlas-topbar">
      <RouterLink to="/" class="atlas-back"><ArrowLeft :size="16" /><span>返回首页</span></RouterLink>
      <div class="atlas-title"><span class="atlas-kicker">NATIONAL ARCHITECTURE ATLAS</span><strong>全国建筑三维图谱</strong></div>
      <div class="atlas-top-actions"><span class="atlas-live"><i /> LIVE MAP</span><button type="button" aria-label="重置视角" @click="resetView"><Rotate3d :size="17" /></button></div>
    </header>

    <aside class="atlas-intro-panel">
      <span class="eyebrow">GEOGRAPHY / 3D ARCHIVE</span>
      <h1>在地图上<br /><em>阅读建筑。</em></h1>
      <p>旋转、缩放全国建筑图谱，点击城市节点，查看这一地区已经收录的建筑样本。</p>
      <div class="atlas-stats"><div><strong>{{ cityPoints.length }}</strong><span>城市节点</span></div><div><strong>{{ buildings.length }}</strong><span>建筑样本</span></div><div><strong>34</strong><span>省级入口</span></div></div>
      <div class="atlas-instructions"><span><Rotate3d :size="14" /> 拖动旋转</span><span><Crosshair :size="14" /> 点击节点</span><span><Search :size="14" /> 筛选位置</span></div>
    </aside>

    <div class="atlas-search"><Search :size="15" /><input v-model="query" placeholder="搜索省份、城市或建筑" aria-label="搜索省份、城市或建筑" /><span>{{ filteredCities.length }} 个节点</span></div>

    <aside v-if="selectedCity" class="atlas-detail-panel">
      <button class="atlas-detail-close" type="button" aria-label="关闭详情" @click="selectCity(null)"><X :size="17" /></button>
      <span class="eyebrow">CITY NODE / {{ selectedCity.region }}</span>
      <h2>{{ selectedCity.city }}</h2>
      <p class="atlas-detail-summary">{{ selectedCity.count }} 个建筑样本 · 已接入全国图谱</p>
      <div class="atlas-detail-list"><RouterLink v-for="building in selectedCity.items" :key="building.id" :to="`/buildings/${building.id}`" class="atlas-building-link"><span><strong>{{ building.name }}</strong><small>{{ building.category }} · {{ building.era }}</small></span><ArrowLeft :size="15" /></RouterLink></div>
      <button class="atlas-focus" type="button" @click="resetView"><LocateFixed :size="15" /> 重置全国视角</button>
    </aside>

    <div v-if="hoveredCityKey && !selectedCity" class="atlas-hover-label">{{ cityPoints.find((point) => point.key === hoveredCityKey)?.region }} · {{ cityPoints.find((point) => point.key === hoveredCityKey)?.city }}</div>
    <div class="atlas-bottom-bar"><span><Info :size="14" /> 全国样例库持续接入中</span><span>{{ isLoading ? '正在载入边界数据…' : mapReady ? '边界 · 节点 · 建筑详情' : '地图初始化中' }}</span></div>
  </div>
</template>

<style scoped>
.atlas-page { position: relative; min-height: 100dvh; overflow: hidden; color: #edf4ee; background: #081a23; isolation: isolate; }
.atlas-canvas { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; cursor: grab; }
.atlas-atmosphere { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: radial-gradient(circle at 49% 51%, transparent 0 22%, rgba(8, 26, 35, .15) 54%, rgba(3, 13, 19, .62) 100%), linear-gradient(90deg, rgba(6, 19, 27, .86), transparent 35%, transparent 70%, rgba(6, 19, 27, .78)), repeating-linear-gradient(0deg, rgba(108, 182, 169, .03) 0 1px, transparent 1px 70px); }
.atlas-topbar, .atlas-intro-panel, .atlas-search, .atlas-detail-panel, .atlas-bottom-bar, .atlas-hover-label { position: absolute; z-index: 4; }
.atlas-topbar { top: 0; left: 0; right: 0; height: 78px; display: flex; align-items: center; justify-content: space-between; padding: 0 clamp(20px, 4vw, 58px); border-bottom: 1px solid rgba(140, 190, 176, .16); background: linear-gradient(180deg, rgba(5, 19, 27, .82), rgba(5, 19, 27, .22)); backdrop-filter: blur(14px); }
.atlas-back { display: inline-flex; align-items: center; gap: 9px; color: rgba(223, 238, 230, .72); font-size: 11px; letter-spacing: .08em; transition: color .2s ease; }.atlas-back:hover { color: #fff5df; }
.atlas-title { display: grid; gap: 5px; text-align: center; }.atlas-title strong { font: 600 17px 'Noto Serif SC', serif; letter-spacing: .16em; }.atlas-kicker { color: #d5a466; font: 8px ui-monospace, monospace; letter-spacing: .22em; }
.atlas-top-actions { display: flex; align-items: center; gap: 18px; }.atlas-live { display: inline-flex; align-items: center; gap: 7px; color: rgba(223, 238, 230, .58); font: 9px ui-monospace, monospace; letter-spacing: .16em; }.atlas-live i { width: 5px; height: 5px; border-radius: 50%; background: #7cc8bb; box-shadow: 0 0 0 4px rgba(124, 200, 187, .12); }.atlas-top-actions button { display: grid; place-items: center; width: 32px; height: 32px; border: 1px solid rgba(124, 200, 187, .25); color: #d4aa6f; background: rgba(12, 38, 45, .62); }
.atlas-intro-panel { top: 136px; left: clamp(22px, 4vw, 58px); width: min(310px, calc(100% - 44px)); }.atlas-intro-panel h1 { margin: 17px 0 13px; font: 600 clamp(35px, 4vw, 55px)/1.16 'Noto Serif SC', serif; letter-spacing: -.08em; }.atlas-intro-panel h1 em { color: #79c8bb; font-style: normal; }.atlas-intro-panel p { max-width: 285px; margin: 0; color: rgba(208, 226, 218, .66); font-size: 12px; line-height: 1.9; }.atlas-stats { display: flex; gap: 24px; margin-top: 30px; padding-top: 17px; border-top: 1px solid rgba(124, 200, 187, .2); }.atlas-stats div { display: grid; gap: 3px; }.atlas-stats strong { color: #e3bc7d; font: 600 23px 'Noto Serif SC', serif; }.atlas-stats span { color: rgba(208, 226, 218, .5); font-size: 9px; }.atlas-instructions { display: grid; gap: 11px; margin-top: 32px; color: rgba(208, 226, 218, .46); font-size: 10px; }.atlas-instructions span { display: inline-flex; align-items: center; gap: 8px; }
.atlas-search { top: 108px; right: clamp(20px, 4vw, 58px); display: flex; align-items: center; gap: 9px; width: min(285px, calc(100% - 40px)); padding: 10px 12px; border: 1px solid rgba(124, 200, 187, .24); color: #7cc8bb; background: rgba(7, 28, 36, .72); backdrop-filter: blur(12px); }.atlas-search input { min-width: 0; flex: 1; border: 0; outline: 0; color: #eaf2eb; background: transparent; font-size: 11px; }.atlas-search input::placeholder { color: rgba(208, 226, 218, .4); }.atlas-search span { color: rgba(208, 226, 218, .4); font: 9px ui-monospace, monospace; white-space: nowrap; }
.atlas-detail-panel { top: 163px; right: clamp(20px, 4vw, 58px); width: min(326px, calc(100% - 40px)); max-height: calc(100dvh - 235px); overflow: auto; padding: 24px; border: 1px solid rgba(124, 200, 187, .3); background: rgba(8, 28, 36, .9); box-shadow: 0 20px 55px rgba(0, 0, 0, .3); backdrop-filter: blur(18px); }.atlas-detail-close { position: absolute; top: 15px; right: 15px; display: grid; place-items: center; width: 28px; height: 28px; border: 0; color: rgba(223, 238, 230, .6); background: transparent; }.atlas-detail-panel h2 { margin: 16px 0 4px; font: 600 29px 'Noto Serif SC', serif; }.atlas-detail-summary { margin: 0 0 20px; color: rgba(208, 226, 218, .56); font-size: 11px; }.atlas-detail-list { display: grid; gap: 8px; }.atlas-building-link { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 12px 0; border-top: 1px solid rgba(208, 226, 218, .12); color: #eaf2eb; }.atlas-building-link span { display: grid; gap: 4px; }.atlas-building-link strong { font: 500 15px 'Noto Serif SC', serif; }.atlas-building-link small { color: rgba(208, 226, 218, .48); font-size: 9px; }.atlas-building-link svg { transform: rotate(180deg); color: #d5a466; }.atlas-focus { display: inline-flex; align-items: center; gap: 7px; margin-top: 19px; padding: 9px 11px; border: 1px solid rgba(124, 200, 187, .3); color: #7cc8bb; background: transparent; font-size: 10px; }
.atlas-hover-label { left: 50%; bottom: 105px; transform: translateX(-50%); padding: 7px 11px; border: 1px solid rgba(124, 200, 187, .3); color: #e9f3ec; background: rgba(7, 28, 36, .78); font: 10px 'Noto Serif SC', serif; backdrop-filter: blur(10px); }
.atlas-bottom-bar { bottom: 0; left: 0; right: 0; display: flex; justify-content: space-between; padding: 15px clamp(20px, 4vw, 58px); border-top: 1px solid rgba(140, 190, 176, .14); color: rgba(208, 226, 218, .46); background: rgba(5, 19, 27, .57); font: 9px ui-monospace, monospace; letter-spacing: .08em; }.atlas-bottom-bar span { display: inline-flex; align-items: center; gap: 7px; }.atlas-bottom-bar svg { color: #d5a466; }
@media (max-width: 760px) { .atlas-topbar { height: 65px; padding: 0 18px; }.atlas-title strong { font-size: 13px; letter-spacing: .08em; }.atlas-kicker, .atlas-live { display: none; }.atlas-intro-panel { top: 88px; left: 18px; width: 210px; }.atlas-intro-panel h1 { font-size: 34px; }.atlas-intro-panel p, .atlas-instructions { display: none; }.atlas-stats { gap: 14px; margin-top: 17px; }.atlas-stats strong { font-size: 18px; }.atlas-search { top: 88px; right: 18px; width: 188px; }.atlas-detail-panel { top: auto; right: 12px; bottom: 55px; width: calc(100% - 24px); max-height: 42dvh; }.atlas-bottom-bar { padding: 11px 18px; }.atlas-bottom-bar span:last-child { display: none; } }
</style>
