<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildings } from '../../data/buildings'

const props = withDefaults(defineProps<{
  title?: string
  kicker?: string
  summary?: string
  compact?: boolean
}>(), {
  title: '全国建筑点位总览',
  kicker: 'NATIONAL REAL MAP',
  summary: '真实地理底图 · 城市样本点位',
  compact: false,
})

const mapElement = ref<HTMLElement | null>(null)
const mapError = ref(false)
let map: L.Map | undefined
let tileLayer: L.TileLayer | undefined
let boundaryLayer: L.GeoJSON | undefined
let markers: L.Marker[] = []
let tileErrorCount = 0
let fallbackActivated = false

const cityPoints = computed(() => {
  const groups = new Map<string, { city: string; region: string; lat: number; lng: number; count: number }>()
  buildings.forEach((building) => {
    const city = building.location.split(' · ')[0]
    const region = building.region ?? '未分区'
    const key = `${region}-${city}`
    const existing = groups.get(key)
    if (existing) {
      existing.lat = (existing.lat * existing.count + building.coordinates[1]) / (existing.count + 1)
      existing.lng = (existing.lng * existing.count + building.coordinates[0]) / (existing.count + 1)
      existing.count += 1
    } else {
      groups.set(key, { city, region, lat: building.coordinates[1], lng: building.coordinates[0], count: 1 })
    }
  })
  return Array.from(groups.values())
})

function markerIcon(count: number) {
  return L.divIcon({
    className: 'national-marker-wrap',
    html: `<span class="national-marker"><span>${count}</span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function clearMarkers() {
  markers.forEach((marker) => marker.remove())
  markers = []
}

function fitNationalView() {
  if (!map) return
  const narrow = (mapElement.value?.clientWidth ?? 0) < 720
  if (narrow) {
    map.setView([35.2, 104.6], props.compact ? 3.35 : 3.25)
    return
  }
  map.fitBounds(L.latLngBounds([18.2, 73.5], [53.8, 134.8]), { padding: props.compact ? [20, 20] : [34, 34] })
}

function refreshMarkers() {
  if (!map) return
  clearMarkers()
  markers = cityPoints.value.map((point) => {
    const marker = L.marker([point.lat, point.lng], {
      icon: markerIcon(point.count),
      title: `${point.region} · ${point.city}`,
      keyboard: false,
    }).addTo(map!)
    marker.bindTooltip(`<strong>${point.region} · ${point.city}</strong><br><small>${point.count} 个建筑样本</small>`, {
      direction: 'top',
      offset: [0, -14],
      opacity: 0.96,
    })
    return marker
  })
}

async function loadChinaBoundary() {
  if (!map || boundaryLayer) return
  try {
    const response = await fetch('/maps/china.json')
    if (!response.ok) return
    const data = await response.json()
    if (!map.getPane('boundaryPane')) {
      const pane = map.createPane('boundaryPane')
      pane.style.zIndex = '340'
      pane.style.pointerEvents = 'none'
    }
    boundaryLayer = L.geoJSON(data, {
      pane: 'boundaryPane',
      style: () => ({
        color: '#2f8983',
        weight: 1,
        opacity: 0.45,
        fillColor: '#f2eadc',
        fillOpacity: 0.34,
      }),
    }).addTo(map)
    map.attributionControl.addAttribution('边界数据 DataV.GeoAtlas')
  } catch {
    mapError.value = true
  }
}

function mountTiles(url: string, attribution: string) {
  if (!map) return
  tileLayer?.remove()
  tileLayer = L.tileLayer(url, {
    maxZoom: 18,
    minZoom: 3,
    attribution,
  }).addTo(map)
  tileLayer.on('tileerror', () => {
    tileErrorCount += 1
    if (tileErrorCount >= 3 && !fallbackActivated) {
      fallbackActivated = true
      tileErrorCount = 0
      mountTiles('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png', '&copy; OpenStreetMap contributors')
    } else if (fallbackActivated && tileErrorCount >= 3) {
      mapError.value = true
    }
  })
}

function buildMap() {
  if (!mapElement.value || map) return
  map = L.map(mapElement.value, {
    attributionControl: true,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomSnap: 0.25,
    minZoom: 3,
    maxBounds: L.latLngBounds([8, 62], [58, 146]),
    maxBoundsViscosity: 0.65,
  })
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 110 }).addTo(map)
  mountTiles('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', '&copy; OpenStreetMap contributors')
  void loadChinaBoundary()
  fitNationalView()
  refreshMarkers()
  window.setTimeout(() => map?.invalidateSize(), 80)
}

onMounted(() => nextTick(buildMap))
onBeforeUnmount(() => {
  map?.remove()
  map = undefined
  tileLayer = undefined
  boundaryLayer = undefined
  clearMarkers()
  tileErrorCount = 0
  fallbackActivated = false
})
</script>

<template>
  <div class="national-real-map" :class="{ compact }">
    <div ref="mapElement" class="national-map-canvas" aria-label="中国真实地图与建筑样本城市点位" />
    <div class="map-shade" />
    <div class="map-heading">
      <span>{{ kicker }}</span>
      <strong>{{ title }}</strong>
    </div>
    <div class="map-summary-panel">
      <span>{{ summary }}</span>
      <strong>{{ cityPoints.length }} 个城市节点 · {{ buildings.length }} 个建筑样本</strong>
    </div>
    <div v-if="mapError" class="map-load-error">底图加载较慢，正在保留点位总览。</div>
  </div>
</template>

<style scoped>
.national-real-map { position: relative; min-height: 470px; overflow: hidden; background: #dfe4df; isolation: isolate; }
.national-map-canvas { position: absolute; inset: 0; z-index: 1; background: #dfe4df; filter: saturate(.72) contrast(.96); }
.map-shade { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(90deg, rgba(246, 241, 232, .96) 0%, rgba(246, 241, 232, .76) 22%, rgba(246, 241, 232, .1) 52%, rgba(20, 43, 54, .08) 100%), linear-gradient(0deg, rgba(20, 43, 54, .16), transparent 36%, rgba(255, 252, 245, .16)); }
.map-heading { position: absolute; z-index: 3; left: 28px; top: 26px; display: grid; gap: 8px; max-width: 320px; }
.map-heading span { color: #2f8983; font-size: 10px; font-weight: 700; letter-spacing: .2em; }
.map-heading strong { color: #1f3435; font: 600 22px 'Noto Serif SC', serif; letter-spacing: -.03em; }
.map-summary-panel { position: absolute; z-index: 3; left: 28px; right: 28px; bottom: 26px; display: grid; gap: 7px; max-width: 470px; padding: 14px 16px; color: #fdf7ec; background: rgba(20, 43, 54, .86); border: 1px solid rgba(255, 248, 235, .16); }
.map-summary-panel span { color: rgba(255, 248, 235, .72); font-size: 10px; letter-spacing: .14em; }
.map-summary-panel strong { font: 600 14px/1.7 'Noto Serif SC', serif; }
.map-load-error { position: absolute; z-index: 4; right: 18px; top: 18px; color: #7c392f; background: rgba(255,246,229,.94); border: 1px solid rgba(167,62,50,.32); padding: 7px 11px; font-size: 10px; }
.compact { min-height: 420px; }
.compact .map-heading { left: 34px; top: 32px; }
.compact .map-summary-panel { left: 34px; bottom: 32px; max-width: 360px; }
:deep(.leaflet-container) { background: #dfe4df; font-family: 'Noto Sans SC', system-ui, sans-serif; }
:deep(.leaflet-pane) { z-index: 1; }
:deep(.leaflet-control-container) { position: relative; z-index: 5; }
:deep(.leaflet-control-attribution) { font: 9px/1.35 Arial, sans-serif; color: #74807d; background: rgba(246, 241, 232, .82); }
:deep(.leaflet-control-attribution a) { color: #6b7f7c; }
:deep(.leaflet-control-scale-line) { border: 1px solid rgba(20, 43, 54, .4); border-top: 0; color: #52635b; background: rgba(247,243,232,.72); text-shadow: none; font: 9px Arial, sans-serif; }
:deep(.leaflet-control-zoom) { border: 1px solid rgba(20, 43, 54, .14) !important; box-shadow: 0 8px 20px rgba(20, 43, 54, .1); }
:deep(.leaflet-control-zoom a) { width: 28px !important; height: 28px !important; line-height: 28px !important; color: #44584f; background: rgba(247,243,232,.92); border: 0 !important; }
:deep(.leaflet-tooltip) { border: 1px solid rgba(47,137,131,.3); border-radius: 2px; color: #283d3f; background: rgba(252,249,241,.96); box-shadow: 0 8px 22px rgba(20, 43, 54, .14); padding: 7px 10px; font: 11px/1.35 'Noto Sans SC', sans-serif; }
:deep(.leaflet-tooltip strong) { color: #8f392f; font-family: 'Noto Serif SC', serif; }
:deep(.leaflet-tooltip-top::before) { border-top-color: rgba(252,249,241,.96); }
:deep(.national-marker-wrap) { background: transparent; border: 0; }
:deep(.national-marker) { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; color: #fff8ec; background: #a73e32; border: 2px solid #fff8ec; box-shadow: 0 0 0 7px rgba(167, 62, 50, .16), 0 10px 20px rgba(45, 35, 28, .18); }
:deep(.national-marker span) { font-size: 10px; font-weight: 700; line-height: 1; }
@media (max-width: 760px) {
  .national-real-map { min-height: 420px; }
  .map-shade { background: linear-gradient(0deg, rgba(246, 241, 232, .92) 0%, rgba(246, 241, 232, .18) 48%, rgba(20,43,54,.06) 100%); }
  .map-heading { left: 18px; right: 18px; top: 20px; }
  .map-summary-panel, .compact .map-summary-panel { left: 18px; right: 18px; bottom: 18px; max-width: none; }
  .compact .map-heading { left: 18px; top: 20px; }
}
</style>
