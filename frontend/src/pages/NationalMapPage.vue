<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, ChevronLeft, ChevronRight, Crosshair, Layers3, MapPin, RotateCcw, Search, X } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { buildings } from '../data/buildings'
import type { Building } from '../types/building'

type LngLat = [number, number]
type GeoPolygon = LngLat[][]
type GeoMultiPolygon = GeoPolygon[]
type ChinaFeature = {
  type: 'Feature'
  properties?: { name?: string; adcode?: string | number }
  geometry?: { type: 'Polygon' | 'MultiPolygon'; coordinates: GeoPolygon | GeoMultiPolygon }
}
type ChinaGeoJson = { type: 'FeatureCollection'; features: ChinaFeature[] }

const router = useRouter()
const canvasElement = ref<HTMLCanvasElement | null>(null)
const regionRail = ref<HTMLDivElement | null>(null)
const selectedId = ref<string | null>(null)
const query = ref('')
const activeRegion = ref('全部')
const showLabels = ref(true)
const mapMode = ref<'terrain' | 'network'>('terrain')
const isLoading = ref(true)
const mapLoadNote = ref('')

const selectedBuilding = computed(() => buildings.find((building) => building.id === selectedId.value) ?? null)
const regionOptions = computed(() => {
  const regions = Array.from(new Set(buildings.map((building) => building.region).filter((region): region is string => Boolean(region))))
  return [
    { name: '全部', count: buildings.length },
    ...regions.map((name) => ({ name, count: buildings.filter((building) => building.region === name).length })),
  ]
})
const filteredBuildings = computed(() => {
  const value = query.value.trim().toLowerCase()
  return buildings.filter((building) => {
    const matchesRegion = activeRegion.value === '全部' || building.region === activeRegion.value
    const matchesQuery = !value || [building.name, building.region, building.location, building.category].some((field) => field?.toLowerCase().includes(value))
    return matchesRegion && matchesQuery
  })
})
const regionsCount = computed(() => new Set(buildings.map((building) => building.region).filter(Boolean)).size)
const visibleBuildingIds = computed(() => new Set(filteredBuildings.value.map((building) => building.id)))
const activeRegionCount = computed(() => filteredBuildings.value.length)

let renderer: THREE.WebGLRenderer | undefined
let scene: THREE.Scene | undefined
let camera: THREE.PerspectiveCamera | undefined
let controls: OrbitControls | undefined
let animationFrame = 0
let resizeObserver: ResizeObserver | undefined
let raycaster: THREE.Raycaster | undefined
let pointer: THREE.Vector2 | undefined
let markerGroup: THREE.Group | undefined
let boundaryGroup: THREE.Group | undefined
let labelGroup: THREE.Group | undefined
let terrainGroup: THREE.Group | undefined
let networkGroup: THREE.Group | undefined
let markerMeshes: THREE.Object3D[] = []
let hoveredBuildingId: string | null = null

const bounds = { minLng: 73, maxLng: 135, minLat: 18, maxLat: 54 }
const palette = ['#c96948', '#d8a24e', '#3aa69a', '#86a9bd', '#a98762', '#d47692']
const provincePalette = ['#405f58', '#476c60', '#385d61', '#55705c', '#4e6557', '#426f6c']
const prominentLabels = new Set(['故宫', '布达拉宫', '福建土楼', '苏州古典园林', '大雁塔', '龙门石窟', '应县木塔', '山海关天下第一关'])

function project(lng: number, lat: number, y = 0) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng) - 0.5) * 18
  const z = -(((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat) - 0.5) * 12)
  return new THREE.Vector3(x, y, z)
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line || node instanceof THREE.Sprite) {
      if ('geometry' in node && node.geometry) node.geometry.dispose()
      const material = node.material
      const materials = Array.isArray(material) ? material : [material]
      materials.forEach((entry) => {
        if (!entry) return
        if ('map' in entry && entry.map) entry.map.dispose()
        entry.dispose()
      })
    }
  })
}

function sampledRing(ring: LngLat[], maxPoints = 220) {
  if (ring.length <= maxPoints) return ring
  const stride = Math.max(1, Math.ceil(ring.length / maxPoints))
  const sampled = ring.filter((_, index) => index % stride === 0)
  const last = ring[ring.length - 1]
  const first = sampled[0]
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) sampled.push(last)
  return sampled
}

function toShapePoints(ring: LngLat[], maxPoints?: number) {
  return sampledRing(ring, maxPoints).map(([lng, lat]) => {
    const point = project(lng, lat)
    return new THREE.Vector2(point.x, -point.z)
  })
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
  context.closePath()
}

function makeTextSprite(text: string, accent = '#d8a24e', muted = false) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')!
  const font = '600 22px "Noto Sans SC", Arial'
  context.font = font
  const textWidth = Math.ceil(context.measureText(text).width)
  const labelWidth = Math.min(310, Math.max(116, textWidth + 58))
  const labelHeight = 58
  const scale = 2
  canvas.width = labelWidth * scale
  canvas.height = labelHeight * scale
  context.scale(scale, scale)
  context.clearRect(0, 0, labelWidth, labelHeight)

  context.shadowColor = 'rgba(0, 0, 0, .26)'
  context.shadowBlur = muted ? 6 : 10
  context.shadowOffsetY = 4
  context.fillStyle = muted ? 'rgba(8, 28, 32, .48)' : 'rgba(7, 25, 30, .72)'
  roundRect(context, 2, 8, labelWidth - 4, 34, 7)
  context.fill()

  context.shadowColor = 'transparent'
  context.strokeStyle = muted ? 'rgba(168, 207, 196, .2)' : 'rgba(236, 206, 144, .5)'
  context.lineWidth = 1
  roundRect(context, 2.5, 8.5, labelWidth - 5, 33, 7)
  context.stroke()

  context.fillStyle = accent
  roundRect(context, 11, 18, 5, 14, 2.5)
  context.fill()
  context.globalAlpha = muted ? 0.78 : 1
  context.font = font
  context.fillStyle = muted ? '#d4e3dc' : '#fff2d3'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.fillText(text, 25, 25)
  context.globalAlpha = 1

  context.beginPath()
  context.moveTo(labelWidth / 2 - 5, 41)
  context.lineTo(labelWidth / 2 + 5, 41)
  context.lineTo(labelWidth / 2, 49)
  context.closePath()
  context.fillStyle = muted ? 'rgba(8, 28, 32, .48)' : 'rgba(7, 25, 30, .72)'
  context.fill()
  context.strokeStyle = muted ? 'rgba(168, 207, 196, .18)' : 'rgba(236, 206, 144, .42)'
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(labelWidth / 180, 0.32, 1)
  sprite.userData.labelWidth = labelWidth
  return sprite
}

function makeMarkerSprite(accent: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 128
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(24, 12, 72, 104)
  gradient.addColorStop(0, '#fff3cf')
  gradient.addColorStop(0.18, accent)
  gradient.addColorStop(1, '#7d3328')

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.shadowColor = 'rgba(0, 0, 0, .34)'
  context.shadowBlur = 12
  context.shadowOffsetY = 8
  context.beginPath()
  context.moveTo(48, 9)
  context.lineTo(76, 40)
  context.lineTo(58, 83)
  context.lineTo(48, 116)
  context.lineTo(38, 83)
  context.lineTo(20, 40)
  context.closePath()
  context.fillStyle = gradient
  context.fill()

  context.shadowColor = 'transparent'
  context.lineWidth = 3
  context.strokeStyle = 'rgba(255, 238, 192, .74)'
  context.stroke()
  context.beginPath()
  context.moveTo(48, 17)
  context.lineTo(62, 41)
  context.lineTo(51, 76)
  context.lineTo(48, 104)
  context.lineTo(45, 76)
  context.lineTo(34, 41)
  context.closePath()
  context.fillStyle = 'rgba(10, 36, 39, .34)'
  context.fill()
  context.beginPath()
  context.moveTo(48, 18)
  context.lineTo(48, 104)
  context.strokeStyle = 'rgba(255, 249, 225, .68)'
  context.lineWidth = 2
  context.stroke()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(0.42, 0.56, 1)
  return sprite
}

function buildBase() {
  if (!scene) return
  terrainGroup = new THREE.Group()
  terrainGroup.name = 'terrain'

  const oceanGeometry = new THREE.PlaneGeometry(22, 15, 72, 48)
  const oceanPositions = oceanGeometry.attributes.position
  for (let index = 0; index < oceanPositions.count; index += 1) {
    const x = oceanPositions.getX(index)
    const y = oceanPositions.getY(index)
    const ripple = Math.sin(x * 1.2) * 0.018 + Math.cos(y * 1.6) * 0.014
    oceanPositions.setZ(index, ripple)
  }
  oceanGeometry.computeVertexNormals()
  const ocean = new THREE.Mesh(
    oceanGeometry,
    new THREE.MeshStandardMaterial({
      color: '#0c2b31',
      roughness: 0.86,
      metalness: 0.08,
      transparent: true,
      opacity: 0.96,
    }),
  )
  ocean.rotation.x = -Math.PI / 2
  ocean.position.y = -0.08
  terrainGroup.add(ocean)

  const grid = new THREE.GridHelper(22, 28, '#76b6aa', '#214d52')
  grid.position.y = -0.035
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.13
  terrainGroup.add(grid)

  const horizon = new THREE.Mesh(
    new THREE.CircleGeometry(18, 96),
    new THREE.MeshBasicMaterial({ color: '#163d42', transparent: true, opacity: 0.28, depthWrite: false }),
  )
  horizon.rotation.x = -Math.PI / 2
  horizon.position.set(0, -0.09, 0)
  terrainGroup.add(horizon)
  scene.add(terrainGroup)
}

function normalizePolygons(feature: ChinaFeature): GeoMultiPolygon {
  if (!feature.geometry) return []
  if (feature.geometry.type === 'Polygon') return [feature.geometry.coordinates as GeoPolygon]
  return feature.geometry.coordinates as GeoMultiPolygon
}

async function loadChinaGeoJson() {
  const response = await fetch('/maps/china.json')
  if (!response.ok) throw new Error('China map failed to load')
  return response.json() as Promise<ChinaGeoJson>
}

function buildChinaSurface(data: ChinaGeoJson) {
  if (!scene) return
  boundaryGroup = new THREE.Group()
  boundaryGroup.name = 'province-boundaries'
  const lineMaterial = new THREE.LineBasicMaterial({ color: '#a7d7c8', transparent: true, opacity: 0.34 })
  const coastMaterial = new THREE.LineBasicMaterial({ color: '#ead08f', transparent: true, opacity: 0.38 })

  data.features.forEach((feature, featureIndex) => {
    const polygons = normalizePolygons(feature)
    const isReferenceLine = String(feature.properties?.adcode ?? '').includes('_')
    polygons.forEach((polygon, polygonIndex) => {
      const outer = polygon[0]
      if (!outer || outer.length < 4) return
      const shapePoints = toShapePoints(outer, isReferenceLine ? 90 : 260)
      if (shapePoints.length < 3) return
      const shape = new THREE.Shape(shapePoints)
      polygon.slice(1, 5).forEach((hole) => {
        const holePoints = toShapePoints(hole, 120)
        if (holePoints.length >= 3) shape.holes.push(new THREE.Path(holePoints))
      })
      if (!isReferenceLine) {
        const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.075 + (featureIndex % 3) * 0.015, bevelEnabled: false })
        geometry.rotateX(-Math.PI / 2)
        geometry.computeVertexNormals()
        const baseColor = provincePalette[featureIndex % provincePalette.length]
        const material = new THREE.MeshStandardMaterial({
          color: baseColor,
          roughness: 0.82,
          metalness: 0.03,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = `province-${feature.properties?.name ?? featureIndex}-${polygonIndex}`
        mesh.userData.regionName = feature.properties?.name
        mesh.userData.baseColor = baseColor
        mesh.position.y = -0.015
        mesh.receiveShadow = true
        boundaryGroup?.add(mesh)
      }

      const sampled = sampledRing(outer, isReferenceLine ? 80 : 180).map(([lng, lat]) => project(lng, lat, isReferenceLine ? 0.035 : 0.09))
      if (sampled.length > 1) {
        const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(sampled), isReferenceLine ? coastMaterial : lineMaterial)
        boundaryGroup?.add(line)
      }
    })
  })
  scene.add(boundaryGroup)
}

function buildReliefLines() {
  if (!scene) return
  const reliefGroup = new THREE.Group()
  reliefGroup.name = 'terrain-relief'
  const material = new THREE.LineBasicMaterial({ color: '#7bb9a7', transparent: true, opacity: 0.18 })
  for (let index = 0; index < 16; index += 1) {
    const z = -4.9 + index * 0.62
    const points: THREE.Vector3[] = []
    for (let step = 0; step <= 90; step += 1) {
      const x = -8.3 + step * 0.185
      const wave = Math.sin(step * 0.18 + index * 0.45) * 0.12 + Math.cos(step * 0.07) * 0.06
      points.push(new THREE.Vector3(x, 0.105, z + wave))
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material)
    reliefGroup.add(line)
  }
  terrainGroup?.add(reliefGroup)
}

function buildRoutes() {
  if (!scene) return
  networkGroup = new THREE.Group()
  networkGroup.name = 'network'
  const valid = buildings.filter((building) => building.coordinates?.length === 2)
  const hubs = valid.filter((building) => ['北京', '陕西', '河南', '江苏', '四川'].includes(building.region ?? ''))
  valid.forEach((building, index) => {
    const hub = hubs[index % hubs.length]
    if (!hub || hub.id === building.id) return
    const p1 = project(hub.coordinates[0], hub.coordinates[1], 0.18)
    const p2 = project(building.coordinates[0], building.coordinates[1], 0.18)
    const mid = p1.clone().lerp(p2, 0.5)
    mid.y += 0.3 + (index % 3) * 0.08
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(32))
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#dfbf72', transparent: true, opacity: 0.28 }))
    line.userData.buildingId = building.id
    line.userData.hubId = hub.id
    networkGroup!.add(line)
  })
  networkGroup.visible = mapMode.value === 'network'
  scene.add(networkGroup)
}

function markerColor(building: Building, index: number) {
  return building.accent ?? palette[index % palette.length]
}

function normalizedRegionName(region?: string) {
  return (region ?? '').replace(/特别行政区|壮族自治区|回族自治区|维吾尔自治区|自治区|省|市/g, '')
}

function matchesActiveRegion(region?: string) {
  return normalizedRegionName(region) === normalizedRegionName(activeRegion.value)
}

function buildMarkers() {
  if (!scene) return
  markerGroup = new THREE.Group()
  markerGroup.name = 'markers'
  labelGroup = new THREE.Group()
  markerMeshes = []
  const shaftGeometry = new THREE.CylinderGeometry(0.008, 0.014, 0.34, 8)
  const haloGeometry = new THREE.RingGeometry(0.11, 0.18, 40)
  const shadowGeometry = new THREE.CircleGeometry(0.2, 40)
  const hitAreaGeometry = new THREE.SphereGeometry(0.24, 12, 8)
  buildings.forEach((building, index) => {
    if (!building.coordinates) return
    const [lng, lat] = building.coordinates
    const point = project(lng, lat, 0.1)
    const color = markerColor(building, index)
    const group = new THREE.Group()
    group.userData.buildingId = building.id
    const shaft = new THREE.Mesh(
      shaftGeometry,
      new THREE.MeshStandardMaterial({ color: '#f0c77a', emissive: color, emissiveIntensity: 0.14, roughness: 0.38, metalness: 0.58 }),
    )
    shaft.position.y = 0.28
    shaft.userData.kind = 'shaft'
    group.add(shaft)
    const marker = makeMarkerSprite(color)
    marker.position.y = 0.62
    marker.renderOrder = 4
    marker.userData.buildingId = building.id
    marker.userData.kind = 'marker'
    group.add(marker)
    const shadow = new THREE.Mesh(
      shadowGeometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.106
    shadow.userData.kind = 'shadow'
    group.add(shadow)
    const halo = new THREE.Mesh(
      haloGeometry,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }),
    )
    halo.rotation.x = -Math.PI / 2
    halo.position.y = 0.112
    halo.userData.kind = 'halo'
    group.add(halo)
    const hitArea = new THREE.Mesh(
      hitAreaGeometry,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    )
    hitArea.position.y = 0.55
    hitArea.userData.buildingId = building.id
    group.add(hitArea)
    group.position.copy(point)
    markerGroup!.add(group)
    markerMeshes.push(marker, hitArea)

    const priority = prominentLabels.has(building.name)
    const label = makeTextSprite(building.name, color, !priority)
    const labelOffsetX = priority ? ((index % 3) - 1) * 0.08 : 0
    const labelOffsetZ = priority ? (index % 2 === 0 ? -0.04 : 0.04) : 0
    label.position.set(point.x + labelOffsetX, 0.84, point.z + labelOffsetZ)
    label.visible = showLabels.value && priority
    label.userData.buildingId = building.id
    label.userData.priority = priority
    labelGroup!.add(label)
  })
  scene.add(markerGroup)
  scene.add(labelGroup)
}

function updateLayerVisibility() {
  if (networkGroup) networkGroup.visible = mapMode.value === 'network'
  const relief = terrainGroup?.getObjectByName('terrain-relief')
  if (relief) relief.visible = mapMode.value === 'terrain'
  updateNetworkVisibility()
}

function isBuildingVisible(buildingId: string) {
  return visibleBuildingIds.value.has(buildingId)
}

function updateNetworkVisibility() {
  networkGroup?.children.forEach((line) => {
    const buildingId = line.userData.buildingId as string | undefined
    const hubId = line.userData.hubId as string | undefined
    line.visible = activeRegion.value === '全部' || Boolean(buildingId && hubId && isBuildingVisible(buildingId) && isBuildingVisible(hubId))
  })
}

function updateProvinceHighlight() {
  boundaryGroup?.children.forEach((child) => {
    if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return
    const isActive = activeRegion.value !== '全部' && matchesActiveRegion(child.userData.regionName)
    child.material.opacity = activeRegion.value === '全部' ? 1 : isActive ? 1 : 0.34
    child.material.transparent = activeRegion.value !== '全部'
    child.material.color.set(isActive ? '#69886c' : child.userData.baseColor ?? provincePalette[0])
    child.position.y = isActive ? 0.01 : -0.015
  })
}

function updateMarkerVisibility() {
  markerGroup?.children.forEach((child) => {
    const buildingId = child.userData.buildingId as string | undefined
    child.visible = Boolean(buildingId && isBuildingVisible(buildingId))
  })
  labelGroup?.children.forEach((label) => {
    const buildingId = label.userData.buildingId as string | undefined
    label.visible = Boolean(buildingId && isBuildingVisible(buildingId))
  })
  if (selectedId.value && !isBuildingVisible(selectedId.value)) {
    selectedId.value = null
  }
  hoveredBuildingId = hoveredBuildingId && isBuildingVisible(hoveredBuildingId) ? hoveredBuildingId : null
  updateProvinceHighlight()
  updateNetworkVisibility()
  highlightSelection()
}

function updateLabels() {
  labelGroup?.children.forEach((label) => {
    const buildingId = label.userData.buildingId as string | undefined
    if (!buildingId || !isBuildingVisible(buildingId)) {
      label.visible = false
      return
    }
    const active = label.userData.buildingId === selectedId.value || label.userData.buildingId === hoveredBuildingId
    label.visible = showLabels.value && (label.userData.priority || active)
  })
}

function highlightSelection() {
  if (!markerGroup) return
  markerGroup.children.forEach((child) => {
    const active = child.userData.buildingId === selectedId.value
    const hovered = child.userData.buildingId === hoveredBuildingId
    child.scale.setScalar(active ? 1.34 : hovered ? 1.15 : 1)
    child.traverse((node) => {
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
        node.material.emissiveIntensity = active ? 0.86 : hovered ? 0.5 : 0.28
      }
      if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicMaterial) {
        if (node.userData.kind === 'halo') {
          node.material.opacity = active ? 0.48 : hovered ? 0.34 : 0.2
        }
        if (node.userData.kind === 'shadow') {
          node.material.opacity = active ? 0.18 : hovered ? 0.14 : 0.1
        }
      }
      if (node instanceof THREE.Sprite && node.material instanceof THREE.SpriteMaterial) {
        node.material.opacity = active ? 1 : hovered ? 0.96 : 0.86
      }
    })
  })
  updateLabels()
}

function pickMarker(event: PointerEvent) {
  if (!renderer || !camera || !raycaster || !pointer || !canvasElement.value) return null
  const rect = canvasElement.value.getBoundingClientRect()
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hit = raycaster.intersectObjects(markerMeshes, false).find((entry) => {
    const buildingId = entry.object.userData.buildingId as string | undefined
    return Boolean(buildingId && isBuildingVisible(buildingId))
  })
  return hit?.object.userData.buildingId as string | undefined
}

function handlePointerMove(event: PointerEvent) {
  const hitId = pickMarker(event)
  if (hitId === hoveredBuildingId) return
  hoveredBuildingId = hitId ?? null
  if (canvasElement.value) canvasElement.value.style.cursor = hitId ? 'pointer' : 'grab'
  highlightSelection()
}

function handlePointerUp(event: PointerEvent) {
  const hitId = pickMarker(event)
  if (!hitId) return
  selectedId.value = hitId
  highlightSelection()
}

function selectBuilding(building: Building) {
  selectedId.value = building.id
  highlightSelection()
  if (camera && controls && building.coordinates) {
    const target = project(building.coordinates[0], building.coordinates[1], 0.2)
    controls.target.copy(target)
    const offset = new THREE.Vector3(1.6, 5.8, 4.6)
    camera.position.copy(target.clone().add(offset))
    camera.lookAt(target)
  }
}

function focusBuildings(targetBuildings: Building[]) {
  if (!camera || !controls) return
  const points = targetBuildings.filter((building) => building.coordinates?.length === 2).map((building) => project(building.coordinates[0], building.coordinates[1], 0.18))
  if (!points.length) return
  const box = new THREE.Box3().setFromPoints(points)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const spread = Math.max(size.x, size.z, 0.8)
  const distance = activeRegion.value === '全部' ? 10.4 : Math.min(9.2, Math.max(5.2, spread * 2.2 + 4.2))
  controls.target.copy(center)
  camera.position.copy(center.clone().add(new THREE.Vector3(spread * 0.28 + 1.1, distance * 0.72, distance * 0.58)))
  camera.lookAt(center)
  controls.update()
}

function selectRegion(region: string) {
  if (activeRegion.value === region) return
  activeRegion.value = region
  updateMarkerVisibility()
  if (region === '全部') {
    focusBuildings(buildings)
    return
  }
  focusBuildings(buildings.filter((building) => building.region === region))
}

function resetView() {
  activeRegion.value = '全部'
  selectedId.value = null
  hoveredBuildingId = null
  if (controls && camera) {
    controls.target.set(0, 0, 0)
    camera.position.set(0, 9.1, 10.4)
    camera.lookAt(0, 0, 0)
    controls.update()
  }
  updateMarkerVisibility()
  highlightSelection()
}

function enterDetail() {
  if (selectedBuilding.value) router.push(`/buildings/${selectedBuilding.value.id}`)
}

function toggleLabels() {
  showLabels.value = !showLabels.value
  updateLabels()
}

function scrollRegionRail(direction: -1 | 1) {
  regionRail.value?.scrollBy({ left: direction * 260, behavior: 'smooth' })
}

async function initScene() {
  if (!canvasElement.value) return
  renderer = new THREE.WebGLRenderer({ canvas: canvasElement.value, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(canvasElement.value.clientWidth, canvasElement.value.clientHeight, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.04
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  scene = new THREE.Scene()
  scene.background = new THREE.Color('#071d22')
  scene.fog = new THREE.FogExp2('#071d22', 0.046)
  camera = new THREE.PerspectiveCamera(36, canvasElement.value.clientWidth / canvasElement.value.clientHeight, 0.1, 100)
  camera.position.set(0, 9.1, 10.4)
  camera.lookAt(0, 0, 0)
  controls = new OrbitControls(camera, canvasElement.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.065
  controls.minDistance = 5.4
  controls.maxDistance = 19
  controls.maxPolarAngle = Math.PI * 0.49
  controls.minPolarAngle = Math.PI * 0.23
  controls.enablePan = true
  controls.screenSpacePanning = false
  controls.target.set(0, 0, 0)

  scene.add(new THREE.HemisphereLight('#e8f3df', '#082026', 1.65))
  const keyLight = new THREE.DirectionalLight('#ffe1ad', 3.2)
  keyLight.position.set(-5, 11, 7)
  keyLight.castShadow = true
  keyLight.shadow.mapSize.set(1024, 1024)
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight('#7cd4c7', 1.1)
  rimLight.position.set(6, 5, -7)
  scene.add(rimLight)
  scene.add(new THREE.AmbientLight('#5fa59a', 0.34))

  buildBase()
  try {
    const china = await loadChinaGeoJson()
    buildChinaSurface(china)
  } catch {
    mapLoadNote.value = '省界数据加载较慢，已切换到简化地形。'
  }
  buildReliefLines()
  buildRoutes()
  buildMarkers()
  updateLayerVisibility()
  updateMarkerVisibility()

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  canvasElement.value.addEventListener('pointermove', handlePointerMove)
  canvasElement.value.addEventListener('pointerup', handlePointerUp)
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
    markerGroup?.children.forEach((marker) => {
      const halo = marker.children.find((child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry)
      if (halo) halo.rotation.z += 0.003
    })
    renderer.render(scene, camera)
    animationFrame = requestAnimationFrame(render)
  }
  render()
}

watch(mapMode, updateLayerVisibility)
watch([query, activeRegion], () => {
  updateMarkerVisibility()
  if (!query.value.trim()) return
  const first = filteredBuildings.value[0]
  if (first) selectBuilding(first)
})

onMounted(() => nextTick(initScene))
onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  resizeObserver?.disconnect()
  canvasElement.value?.removeEventListener('pointermove', handlePointerMove)
  canvasElement.value?.removeEventListener('pointerup', handlePointerUp)
  controls?.dispose()
  if (scene) disposeObject(scene)
  renderer?.dispose()
})
</script>

<template>
  <div class="atlas-map-page">
    <canvas ref="canvasElement" class="map-canvas" aria-label="全国建筑三维地图" />
    <div class="map-vignette" aria-hidden="true" />
    <header class="map-header">
      <button class="map-back" type="button" aria-label="返回首页" @click="router.push('/')"><ArrowLeft :size="17" /> <span>退出地图</span></button>
      <div class="map-brand"><span class="map-brand-mark" aria-hidden="true" /><span><strong>全国建筑图谱</strong><small>NATIONAL ARCHITECTURE ATLAS</small></span></div>
      <div class="map-status"><span class="status-dot" /> LIVE ATLAS <span class="map-date">2026 / LOCAL GEOJSON</span></div>
    </header>
    <aside class="map-sidebar">
      <div class="sidebar-kicker">03 / NATIONAL MAP</div>
      <h1>在全国建筑<br><em>空间中游览。</em></h1>
      <p class="sidebar-intro">基于省界 GeoJSON 生成三维地表，叠加建筑样本、地形纹理和谱系连线。</p>
      <label class="map-search"><Search :size="15" /><span class="sr-only">搜索省份、城市或建筑</span><input v-model="query" type="search" placeholder="搜索省份、城市或建筑" /></label>
      <div class="map-filters"><button type="button" :class="{ active: mapMode === 'terrain' }" @click="mapMode = 'terrain'"><Layers3 :size="14" />地形视图</button><button type="button" :class="{ active: mapMode === 'network' }" @click="mapMode = 'network'"><Crosshair :size="14" />谱系连线</button></div>
      <div class="map-list" aria-label="建筑节点列表">
        <button v-for="building in filteredBuildings.slice(0, 8)" :key="building.id" type="button" class="map-list-item" :class="{ active: selectedId === building.id }" @click="selectBuilding(building)"><span class="list-dot" :style="{ background: markerColor(building, buildings.indexOf(building)) }" /><span><strong>{{ building.name }}</strong><small>{{ building.region }} · {{ building.category }}</small></span><MapPin :size="14" /></button>
      </div>
      <div class="sidebar-foot"><span>{{ regionsCount }} 省级入口 · {{ activeRegionCount }} 个当前样本</span><span>本地三维底图</span></div>
    </aside>
    <section class="map-controls" aria-label="地图控制"><button type="button" @click="toggleLabels">{{ showLabels ? '隐藏标注' : '显示标注' }}</button><button type="button" title="重置视角" aria-label="重置视角" @click="resetView"><RotateCcw :size="15" /></button></section>
    <section class="region-timeline" aria-label="按省份筛选建筑地标">
      <button class="region-scroll" type="button" title="向左浏览省份" aria-label="向左浏览省份" @click="scrollRegionRail(-1)"><ChevronLeft :size="16" /></button>
      <div ref="regionRail" class="region-rail" role="listbox" :aria-activedescendant="`region-${activeRegion}`">
        <button
          v-for="region in regionOptions"
          :id="`region-${region.name}`"
          :key="region.name"
          type="button"
          role="option"
          class="region-chip"
          :class="{ active: activeRegion === region.name }"
          :aria-selected="activeRegion === region.name"
          @click="selectRegion(region.name)"
        >
          <span>{{ region.name }}</span>
          <small>{{ region.count }} 个地标</small>
        </button>
      </div>
      <button class="region-scroll" type="button" title="向右浏览省份" aria-label="向右浏览省份" @click="scrollRegionRail(1)"><ChevronRight :size="16" /></button>
      <div class="region-readout"><strong>{{ activeRegion }}</strong><span>{{ activeRegionCount }} 个可进入 3D 的建筑节点</span></div>
    </section>
    <aside v-if="selectedBuilding" class="detail-panel"><button class="detail-close" type="button" aria-label="关闭详情" @click="selectedId = null; highlightSelection()"><X :size="17" /></button><span class="detail-kicker">{{ selectedBuilding.region }} · {{ selectedBuilding.category }}</span><h2>{{ selectedBuilding.name }}</h2><p>{{ selectedBuilding.summary }}</p><dl><div><dt>年代</dt><dd>{{ selectedBuilding.era }}</dd></div><div><dt>位置</dt><dd>{{ selectedBuilding.location }}</dd></div><div><dt>状态</dt><dd>{{ selectedBuilding.status }}</dd></div></dl><button class="detail-action" type="button" @click="enterDetail">查看建筑档案 <ArrowLeft :size="15" /></button></aside>
    <div v-if="isLoading" class="map-loading">正在加载全国建筑空间...</div>
    <div v-if="mapLoadNote" class="map-load-note">{{ mapLoadNote }}</div>
    <div class="map-hint">拖拽旋转 · 滚轮缩放 · 点击节点查看详情</div>
  </div>
</template>

<style scoped>
.atlas-map-page { position: fixed; inset: 0; z-index: 50; overflow: hidden; color: #f6efdf; background: #071d22; font-family: 'Noto Sans SC', system-ui, sans-serif; }
.map-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
.map-canvas:active { cursor: grabbing; }
.map-vignette { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(circle at 58% 45%, transparent 18%, rgba(4, 18, 22, .08) 54%, rgba(4, 18, 22, .78) 100%), linear-gradient(90deg, rgba(5, 20, 24, .92), rgba(5, 20, 24, .54) 20%, transparent 45%, rgba(5, 20, 24, .34) 100%), linear-gradient(0deg, rgba(4, 15, 18, .5), transparent 24%, rgba(3, 13, 17, .24)); }
.map-header { position: absolute; z-index: 3; top: 0; left: 0; right: 0; height: 76px; display: flex; align-items: center; justify-content: space-between; padding: 0 34px; border-bottom: 1px solid rgba(218, 191, 135, .16); background: linear-gradient(180deg, rgba(6, 24, 29, .88), rgba(6, 24, 29, .24)); backdrop-filter: blur(12px); }
.map-back { min-height: 44px; display: inline-flex; align-items: center; gap: 9px; padding: 8px 0; color: rgba(248, 240, 222, .78); border: 0; background: transparent; font: 12px inherit; cursor: pointer; }
.map-back:hover { color: #d8b170; }
.map-back:focus-visible, .map-filters button:focus-visible, .map-controls button:focus-visible, .map-list-item:focus-visible, .detail-action:focus-visible, .detail-close:focus-visible, .region-chip:focus-visible, .region-scroll:focus-visible { outline: 2px solid rgba(231, 195, 127, .82); outline-offset: 3px; }
.map-brand { display: flex; align-items: center; gap: 12px; position: absolute; left: 50%; transform: translateX(-50%); }
.map-brand-mark { width: 28px; height: 24px; display: inline-grid; grid-template-columns: 1fr 1fr; gap: 5px; }
.map-brand-mark::before, .map-brand-mark::after { content: ''; background: linear-gradient(180deg, #e2bd75, #b88642); }
.map-brand strong { display: block; color: #fbf3e1; font: 600 17px 'Noto Serif SC', serif; }
.map-brand small { display: block; margin-top: 2px; color: #80aaa3; font: 8px Arial, sans-serif; letter-spacing: .22em; }
.map-status { display: inline-flex; align-items: center; gap: 7px; color: #86b5aa; font-size: 9px; letter-spacing: .16em; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: #d6ac6a; box-shadow: 0 0 12px #d6ac6a; }
.map-date { margin-left: 12px; color: rgba(245, 232, 205, .44); }
.map-sidebar { position: absolute; z-index: 3; left: 34px; top: 116px; bottom: 48px; width: min(336px, calc(100vw - 68px)); display: flex; flex-direction: column; }
.sidebar-kicker { color: #d1ac6b; font-size: 10px; letter-spacing: .2em; }
.map-sidebar h1 { margin: 18px 0 13px; color: #fff7e6; font: 500 clamp(31px, 3vw, 46px)/1.16 'Noto Serif SC', serif; letter-spacing: 0; }
.map-sidebar h1 em { color: #8fd0c1; font-style: normal; }
.sidebar-intro { max-width: 310px; margin: 0 0 22px; color: rgba(240, 231, 212, .68); font-size: 12px; line-height: 1.9; }
.map-search { min-height: 46px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid rgba(217, 191, 139, .28); background: rgba(7, 29, 34, .78); color: #9fc4bb; box-shadow: 0 16px 38px rgba(2, 13, 16, .18); backdrop-filter: blur(12px); }
.map-search input { min-width: 0; width: 100%; border: 0; outline: 0; color: #f8f0de; background: transparent; font: 13px inherit; }
.map-search input::placeholder { color: rgba(239, 229, 208, .44); }
.map-filters { display: flex; gap: 8px; margin: 12px 0; }
.map-filters button, .map-controls button { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; color: rgba(239, 228, 205, .66); border: 1px solid rgba(218, 191, 135, .2); background: rgba(7, 29, 34, .7); font: 12px inherit; cursor: pointer; transition: color .18s ease, border-color .18s ease, background .18s ease; backdrop-filter: blur(10px); }
.map-filters button.active, .map-filters button:hover, .map-controls button:hover { color: #f0ca84; border-color: rgba(218, 191, 135, .58); background: rgba(24, 65, 68, .76); }
.map-list { flex: 1; min-height: 0; overflow: auto; padding-right: 7px; scrollbar-color: rgba(231, 195, 127, .55) rgba(8, 31, 36, .72); }
.map-list-item { min-height: 62px; width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 10px; color: #efe6d1; text-align: left; border: 1px solid transparent; border-bottom-color: rgba(220, 199, 161, .12); background: rgba(7, 29, 34, .18); cursor: pointer; transition: background .18s ease, border-color .18s ease, transform .18s ease; }
.map-list-item:hover, .map-list-item.active { color: #fff7e6; border-color: rgba(126, 192, 177, .42); background: rgba(40, 88, 88, .52); }
.list-dot { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 10px currentColor; }
.map-list-item strong { display: block; font: 600 13px 'Noto Serif SC', serif; }
.map-list-item small { display: block; margin-top: 3px; color: rgba(239, 228, 205, .56); font-size: 10px; }
.map-list-item > svg { color: rgba(239, 228, 205, .46); }
.sidebar-foot { display: flex; justify-content: space-between; gap: 10px; margin-top: 13px; padding-top: 13px; border-top: 1px solid rgba(220, 199, 161, .13); color: rgba(239, 228, 205, .48); font-size: 10px; }
.map-controls { position: absolute; z-index: 3; right: 34px; bottom: 126px; display: flex; gap: 8px; }
.map-controls button:last-child { width: 44px; justify-content: center; padding: 0; }
.region-timeline { position: absolute; z-index: 4; left: 50%; bottom: 26px; width: min(760px, calc(100vw - 430px)); min-width: 430px; transform: translateX(-50%); display: grid; grid-template-columns: 38px minmax(0, 1fr) 38px auto; align-items: center; gap: 9px; padding: 10px; border: 1px solid rgba(218, 191, 135, .2); background: linear-gradient(180deg, rgba(8, 30, 35, .88), rgba(6, 23, 28, .78)); box-shadow: 0 18px 52px rgba(1, 12, 16, .35); backdrop-filter: blur(16px); }
.region-scroll { width: 38px; height: 44px; display: grid; place-items: center; color: rgba(246, 235, 210, .72); border: 1px solid rgba(218, 191, 135, .18); background: rgba(11, 42, 48, .82); cursor: pointer; }
.region-scroll:hover { color: #f0ca84; border-color: rgba(218, 191, 135, .52); }
.region-rail { display: flex; gap: 8px; overflow-x: auto; padding: 2px 0 4px; scroll-behavior: smooth; scrollbar-width: none; }
.region-rail::-webkit-scrollbar { display: none; }
.region-chip { flex: 0 0 96px; min-height: 48px; display: grid; align-content: center; gap: 3px; padding: 6px 10px; color: rgba(239, 228, 205, .64); text-align: left; border: 1px solid rgba(220, 199, 161, .14); background: rgba(9, 35, 41, .62); cursor: pointer; transition: color .18s ease, border-color .18s ease, background .18s ease, transform .18s ease; }
.region-chip:hover, .region-chip.active { color: #fff5db; border-color: rgba(227, 191, 119, .58); background: rgba(48, 92, 88, .8); }
.region-chip.active { transform: translateY(-2px); box-shadow: inset 0 -2px 0 #d6ac6a, 0 8px 22px rgba(5, 20, 23, .28); }
.region-chip span { font: 600 13px 'Noto Serif SC', serif; }
.region-chip small { color: rgba(179, 214, 205, .7); font-size: 10px; }
.region-readout { min-width: 132px; padding-left: 4px; color: rgba(239, 228, 205, .54); font-size: 10px; line-height: 1.45; }
.region-readout strong { display: block; color: #f0ca84; font: 600 15px 'Noto Serif SC', serif; }
.detail-panel { position: absolute; z-index: 4; right: 34px; top: 50%; transform: translateY(-50%); width: min(330px, calc(100vw - 68px)); padding: 26px 25px 24px; color: #18383c; background: rgba(247, 240, 224, .96); border: 1px solid rgba(218, 177, 105, .56); box-shadow: 0 24px 70px rgba(2, 17, 20, .38); }
.detail-close { position: absolute; top: 10px; right: 10px; width: 44px; height: 44px; display: grid; place-items: center; color: #61716d; border: 0; background: transparent; cursor: pointer; }
.detail-kicker { color: #a56f3e; font-size: 10px; font-weight: 700; letter-spacing: .15em; }
.detail-panel h2 { margin: 12px 0 8px; font: 600 28px 'Noto Serif SC', serif; letter-spacing: 0; }
.detail-panel p { margin: 0 0 17px; color: #53625f; font-size: 13px; line-height: 1.8; }
.detail-panel dl { display: grid; gap: 8px; margin: 0 0 20px; padding-top: 14px; border-top: 1px solid rgba(25, 56, 60, .14); }
.detail-panel dl div { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; }
.detail-panel dt { color: #7a817b; }
.detail-panel dd { margin: 0; color: #284c4c; text-align: right; }
.detail-action { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 0 14px; color: #f8f0df; border: 0; background: #a4543e; font: 12px inherit; cursor: pointer; }
.detail-action svg { transform: rotate(180deg); }
.map-hint { position: absolute; z-index: 3; right: 35px; bottom: 104px; color: rgba(239, 228, 205, .44); font-size: 10px; letter-spacing: .08em; }
.map-loading { position: absolute; z-index: 5; inset: 0; display: grid; place-items: center; color: #dcb776; background: #071d22; font: 13px 'Noto Serif SC', serif; }
.map-load-note { position: absolute; z-index: 5; right: 34px; top: 92px; max-width: 300px; padding: 10px 12px; color: #f4e1bd; border: 1px solid rgba(224, 184, 112, .32); background: rgba(8, 31, 36, .88); font-size: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
@media (max-width: 760px) {
  .map-header { height: 62px; padding: 0 17px; }
  .map-brand { left: auto; right: 17px; transform: none; }
  .map-brand strong { font-size: 14px; }
  .map-brand small, .map-status, .map-brand-mark { display: none; }
  .map-sidebar { left: 17px; top: 83px; bottom: 28px; width: min(304px, calc(100vw - 34px)); }
  .map-sidebar h1 { margin-top: 14px; font-size: 31px; }
  .sidebar-intro { max-width: 262px; margin-bottom: 14px; font-size: 12px; }
  .map-list { max-height: 38vh; flex: none; }
  .detail-panel { right: 17px; left: 17px; top: auto; bottom: 88px; width: auto; transform: none; }
  .map-controls { right: 17px; bottom: 102px; }
  .region-timeline { left: 17px; right: 17px; bottom: 17px; width: auto; min-width: 0; transform: none; grid-template-columns: 34px minmax(0, 1fr) 34px; }
  .region-scroll { width: 34px; height: 42px; }
  .region-readout { display: none; }
  .region-chip { flex-basis: 86px; min-height: 44px; }
  .map-hint { display: none; }
}
</style>
