<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowRight, LocateFixed, Map as MapIcon, Navigation } from 'lucide-vue-next'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { ScenicPoint } from '../../types/building'

const props = defineProps<{ title: string; subtitle: string; points: ScenicPoint[] }>()
const emit = defineEmits<{ select: [point: ScenicPoint] }>()
const selectedId = ref(props.points[0]?.id ?? '')
const selected = computed(() => props.points.find((point) => point.id === selectedId.value) ?? props.points[0])
const mapElement = ref<HTMLElement | null>(null)
const mapError = ref(false)
let map: L.Map | undefined
let tileLayer: L.TileLayer | undefined
let markers: L.Marker[] = []
let tileErrorCount = 0
let fallbackActivated = false
const defaultCenter: [number, number] = [34.5, 112.5]

const geoPoints = computed(() => props.points.filter((point) => point.coordinates))
const center = computed<[number, number]>(() => {
  const points = geoPoints.value
  if (!points.length) return defaultCenter
  const lat = points.reduce((sum, point) => sum + (point.coordinates?.[1] ?? 0), 0) / points.length
  const lng = points.reduce((sum, point) => sum + (point.coordinates?.[0] ?? 0), 0) / points.length
  return [lat, lng]
})

const coordinateLabel = computed(() => `${center.value[0].toFixed(4)}°N / ${center.value[1].toFixed(4)}°E · WGS84`)

function markerIcon(active: boolean) {
  return L.divIcon({
    className: 'heritage-marker-wrap',
    html: `<span class="heritage-marker ${active ? 'is-active' : ''}"><span class="heritage-marker-core">✦</span></span>`,
    iconSize: [34, 44],
    iconAnchor: [17, 37],
  })
}

function selectPoint(point: ScenicPoint) {
  selectedId.value = point.id
  const coordinates = point.coordinates
  if (map && coordinates) map.flyTo([coordinates[1], coordinates[0]], Math.max(map.getZoom(), 16), { duration: 0.65 })
  markers.forEach((marker) => marker.setIcon(markerIcon(marker.options.title === point.name)))
}

function fitMapToPoints() {
  if (!map) return
  const coordinates = geoPoints.value.map((point) => [point.coordinates![1], point.coordinates![0]] as [number, number])
  if (coordinates.length > 1) map.fitBounds(L.latLngBounds(coordinates), { padding: [52, 52], maxZoom: 16 })
  else if (coordinates.length === 1) map.setView(coordinates[0], 16)
  else map.setView(defaultCenter, 5)
}

function clearMarkers() {
  markers.forEach((marker) => marker.remove())
  markers = []
}

function refreshMarkers() {
  if (!map) return
  clearMarkers()
  markers = props.points.map((point) => {
    if (!point.coordinates) return undefined
    const marker = L.marker([point.coordinates[1], point.coordinates[0]], { icon: markerIcon(point.id === selectedId.value), title: point.name }).addTo(map!)
    marker.bindTooltip(`<strong>${point.name}</strong><br><small>${point.subtitle}</small>`, { direction: 'top', offset: [0, -26], opacity: 0.96 })
    marker.on('click', () => selectPoint(point))
    return marker
  }).filter((marker): marker is L.Marker => Boolean(marker))
}

function resetMap() {
  fitMapToPoints()
  map?.invalidateSize()
}

function buildMap() {
  if (!mapElement.value || map) return
  map = L.map(mapElement.value, { zoomControl: false, attributionControl: true, scrollWheelZoom: true }).setView(center.value, 15)
  L.control.zoom({ position: 'bottomright' }).addTo(map)
  L.control.scale({ position: 'bottomright', imperial: false, maxWidth: 110 }).addTo(map)
  const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
  const mountTiles = (url: string) => {
    tileLayer?.remove()
    tileLayer = L.tileLayer(url, { maxZoom: 19, attribution }).addTo(map!)
    tileLayer.on('tileerror', () => {
      tileErrorCount += 1
      if (tileErrorCount >= 3 && !fallbackActivated) {
        fallbackActivated = true
        tileErrorCount = 0
        mountTiles('https://{s}.tile.openstreetmap.de/{z}/{x}/{y}.png')
      } else if (fallbackActivated && tileErrorCount >= 3) {
        mapError.value = true
      }
    })
  }
  mountTiles('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
  fitMapToPoints()
  refreshMarkers()
}

onMounted(() => nextTick(buildMap))
watch(() => props.points, () => {
  selectedId.value = props.points[0]?.id ?? ''
  if (map) { refreshMarkers(); fitMapToPoints(); map.invalidateSize() }
}, { deep: true })
onBeforeUnmount(() => { map?.remove(); map = undefined; tileLayer = undefined; tileErrorCount = 0; fallbackActivated = false; clearMarkers() })
</script>

<template>
  <section class="scenic-overview">
    <div class="scenic-overview-head"><div><span class="eyebrow scenic-eyebrow">LIVE MAP / HERITAGE SITE</span><h2>{{ title }}</h2><p>{{ subtitle }}</p></div><div class="scenic-mode"><span class="mode-dot" /> 真实地理底图 <span class="mode-separator">·</span> {{ points.length }} 个节点已载入</div></div>
    <div class="scenic-stage">
      <div ref="mapElement" class="map-canvas" aria-label="景区真实地理地图" />
      <div class="map-vignette" /><div class="map-scanline" />
      <div class="stage-compass"><Navigation :size="15" /><span>N</span></div>
      <button type="button" class="map-reset" title="回到景区范围" @click="resetMap"><LocateFixed :size="13" /> 归位</button>
      <div v-if="mapError" class="map-error"><MapIcon :size="14" /> 底图加载较慢，请检查网络后重试。</div>
      <div class="stage-meta"><span><MapIcon :size="13" /> {{ title }}</span><span>{{ coordinateLabel }}</span></div>
    </div>
    <div class="scenic-detail"><div class="scenic-detail-index">0{{ points.findIndex((item) => item.id === selectedId) + 1 }}</div><div class="scenic-detail-copy"><div class="scenic-detail-kicker">{{ selected?.status }} · {{ selected?.subtitle }}</div><h3>{{ selected?.name }}</h3><p>{{ selected?.description }}</p></div><button type="button" class="scenic-enter" :disabled="!selected" @click="selected && emit('select', selected)">进入空间 <ArrowRight :size="15" /></button></div>
    <div class="scenic-legend"><span><i class="legend-ring" /> 可进入的 3D 展项</span><span><i class="legend-line" /> 真实道路与河流</span><span><LocateFixed :size="12" /> 点击地图点位查看历史介绍</span><span class="map-attribution-note">地图 © OpenStreetMap contributors</span></div>
  </section>
</template>

<style scoped>
.scenic-overview { margin: 70px 0 45px; border-top: 1px solid #cfc4b7; border-bottom: 1px solid #cfc4b7; padding: 28px 0 0; }
.scenic-overview-head { display: flex; justify-content: space-between; align-items: end; gap: 20px; margin-bottom: 24px; }
.scenic-eyebrow { color: #a73e32; }
.scenic-overview h2 { font: 600 30px 'Noto Serif SC', serif; margin: 12px 0 7px; letter-spacing: -.05em; }
.scenic-overview-head p { color: #81786d; margin: 0; font-size: 13px; }
.scenic-mode { color: #7f756b; font-size: 10px; letter-spacing: .09em; display: flex; align-items: center; gap: 7px; white-space: nowrap; }
.mode-dot { width: 6px; height: 6px; border-radius: 50%; background: #54a69c; box-shadow: 0 0 0 4px #d7e8e2; }
.mode-separator { color: #c1b4a5; }
.scenic-stage { height: 410px; position: relative; overflow: hidden; background: #d8d1c3; border: 1px solid #c6beb0; }
.map-canvas { position: absolute; inset: 0; z-index: 1; background: #d8d1c3; }
.map-vignette { position: absolute; inset: 0; z-index: 2; pointer-events: none; background: linear-gradient(90deg, rgba(25,39,38,.16), transparent 24%, transparent 78%, rgba(25,39,38,.1)), linear-gradient(0deg, rgba(34,30,25,.2), transparent 26%); mix-blend-mode: multiply; }
.map-scanline { position: absolute; z-index: 3; top: 0; left: 0; right: 0; height: 1px; pointer-events: none; background: rgba(226,194,137,.52); box-shadow: 0 0 18px rgba(226,194,137,.72); animation: map-scan 5s linear infinite; opacity: .55; }
.stage-compass { position: absolute; z-index: 4; right: 22px; top: 22px; display: grid; place-items: center; gap: 2px; color: #566d64; font-size: 9px; text-shadow: 0 1px 3px #fff; }.stage-compass svg { color: #a73e32; }
.map-reset { position: absolute; z-index: 5; top: 20px; left: 20px; display: inline-flex; align-items: center; gap: 5px; border: 1px solid rgba(87,98,88,.45); padding: 6px 9px; color: #44584f; background: rgba(247,243,232,.9); font-size: 10px; box-shadow: 0 2px 7px rgba(49,48,41,.12); }
.map-error { position: absolute; z-index: 5; top: 20px; left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 6px; color: #7c392f; background: rgba(255,246,229,.94); border: 1px solid rgba(167,62,50,.32); padding: 7px 11px; font-size: 10px; box-shadow: 0 3px 12px rgba(49,35,27,.16); }
.stage-meta { position: absolute; z-index: 4; bottom: 13px; left: 18px; right: 18px; display: flex; justify-content: space-between; color: #52635b; font-size: 9px; letter-spacing: .06em; text-shadow: 0 1px 3px #fff; }.stage-meta span { display: flex; gap: 5px; align-items: center; }
.scenic-detail { display: grid; grid-template-columns: 58px 1fr auto; gap: 17px; align-items: center; padding: 22px 0 20px; }.scenic-detail-index { color: #b5a28d; font: 500 32px 'Noto Serif SC', serif; }.scenic-detail-kicker { color: #a73e32; font-size: 10px; letter-spacing: .11em; }.scenic-detail h3 { font: 600 21px 'Noto Serif SC', serif; margin: 4px 0 6px; }.scenic-detail p { color: #776e64; font-size: 12px; line-height: 1.7; margin: 0; max-width: 600px; }.scenic-enter { display: inline-flex; gap: 7px; align-items: center; color: #fff7eb; background: #a73e32; border: 0; padding: 12px 15px; font-size: 11px; white-space: nowrap; }.scenic-enter:hover { background: #823127; }.scenic-enter:disabled { opacity: .55; cursor: not-allowed; }
.scenic-legend { border-top: 1px solid #ded6ca; padding: 13px 0; display: flex; gap: 22px; color: #8b8073; font-size: 10px; flex-wrap: wrap; }.scenic-legend span { display: inline-flex; align-items: center; gap: 5px; }.legend-ring { width: 9px; height: 9px; border: 2px solid #a73e32; border-radius: 50%; }.legend-line { width: 18px; border-top: 1px dashed #a73e32; }.map-attribution-note { margin-left: auto; color: #999083; }
:deep(.leaflet-control-attribution) { font: 9px/1.35 Arial, sans-serif; background: rgba(245, 240, 229, .86); color: #726b5f; }
:deep(.leaflet-control-scale-line) { border: 1px solid #52635b; border-top: 0; color: #52635b; background: rgba(247,243,232,.74); text-shadow: 0 1px 2px #fff; font: 9px Arial, sans-serif; }
:deep(.leaflet-control-attribution a) { color: #7e4538; }
:deep(.leaflet-control-zoom) { border: 0 !important; box-shadow: 0 2px 12px rgba(49,48,41,.2); }
:deep(.leaflet-control-zoom a) { width: 26px !important; height: 26px !important; line-height: 26px !important; color: #5d625b; background: rgba(247,243,232,.9); border: 0 !important; }
:deep(.leaflet-tooltip) { border: 1px solid rgba(167,62,50,.32); border-radius: 2px; color: #363c37; background: rgba(248,244,235,.96); box-shadow: 0 3px 14px rgba(65,48,38,.18); padding: 6px 9px; font: 11px/1.35 'Noto Sans SC', sans-serif; }
:deep(.leaflet-tooltip strong) { color: #8f392f; font-family: 'Noto Serif SC', serif; }
:deep(.leaflet-tooltip-top::before) { border-top-color: rgba(248,244,235,.96); }
:deep(.heritage-marker-wrap) { background: transparent; border: 0; }
:deep(.heritage-marker) { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50% 50% 50% 3px; transform: rotate(-45deg); background: #a73e32; color: #f9e5c5; box-shadow: 0 4px 12px rgba(75,34,27,.33), 0 0 0 5px rgba(167,62,50,.2); transition: transform .2s, background .2s, box-shadow .2s; }
:deep(.heritage-marker-core) { transform: rotate(45deg); font-size: 15px; }
:deep(.heritage-marker.is-active) { background: #293f41; color: #e9c991; transform: rotate(-45deg) scale(1.18); box-shadow: 0 5px 16px rgba(30,44,43,.4), 0 0 0 7px rgba(84,166,156,.26); }
@keyframes map-scan { from { transform: translateY(0); } to { transform: translateY(410px); } }
@media (max-width: 700px) { .scenic-overview-head { display: block; }.scenic-mode { margin-top: 15px; }.scenic-stage { height: 350px; }.scenic-detail { grid-template-columns: 40px 1fr; }.scenic-enter { grid-column: 2; justify-self: start; }.stage-meta span:last-child { display: none; }.map-attribution-note { margin-left: 0; } }
</style>
