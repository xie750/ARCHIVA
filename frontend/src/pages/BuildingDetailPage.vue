<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowLeft, Compass, Maximize2 } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { buildings } from '../data/buildings'
import BuildingViewer from '../components/three/BuildingViewer.vue'
import ScenicOverview from '../components/scenic/ScenicOverview.vue'
import type { ScenicPoint } from '../types/building'

const route = useRoute()
const building = computed(() => buildings.find((item) => item.id === route.params.id) ?? buildings[0])
// Every detail page has the same two-step experience: locate it on the map,
// then enter the 3D view. A scenic site supplies many points; a standalone
// building is represented by one point so the interaction stays consistent.
const hasOverview = computed(() => Boolean(building.value.coordinates))
const isScenic = computed(() => Boolean(building.value.scenic))
const overviewPoints = computed<ScenicPoint[]>(() => {
  if (building.value.scenic) return building.value.scenic.points
  return [{
    id: building.value.id,
    name: building.value.name,
    subtitle: `${building.value.category} · ${building.value.location}`,
    description: building.value.summary,
    position: [50, 50],
    coordinates: building.value.coordinates,
    modelKind: building.value.model.kind,
    status: '重点展项',
    useParentModel: true,
  }]
})
const overviewTitle = computed(() => building.value.scenic?.title ?? `${building.value.name} · 地理位置与数字展项`)
const overviewSubtitle = computed(() => building.value.scenic?.subtitle ?? '先在地图中确认建筑所在位置，再进入单体 3D 展示。')
const viewMode = ref<'overview' | 'model'>('overview')
const selectedPoint = ref<ScenicPoint | undefined>()
const activeAssetUrl = computed(() => selectedPoint.value?.assetUrl ?? (selectedPoint.value?.useParentModel || !selectedPoint.value ? building.value.model.assetUrl : undefined))
const activeManifestUrl = computed(() => selectedPoint.value?.manifestUrl ?? (selectedPoint.value?.useParentModel || !selectedPoint.value ? building.value.model.manifestUrl : undefined))
const activeEmbedUrl = computed(() => selectedPoint.value?.embedUrl ?? (selectedPoint.value?.useParentModel || !selectedPoint.value ? building.value.model.embedUrl : undefined))
const activeSource = computed(() => selectedPoint.value?.embedSource ?? (selectedPoint.value?.useParentModel || !selectedPoint.value ? building.value.model.source : '当前节点暂无独立模型；先显示程序化空间预览。'))
function enterPoint(point: ScenicPoint) { selectedPoint.value = point; viewMode.value = 'model' }
function openModel() {
  selectedPoint.value ??= overviewPoints.value[0]
  viewMode.value = 'model'
}
function returnToOverview() { viewMode.value = 'overview' }
watch(() => building.value.id, () => {
  viewMode.value = 'overview'
  selectedPoint.value = undefined
})
</script>

<template>
  <div>
    <section class="detail-cover" :class="building.coverClass"><div class="container"><div><span class="eyebrow" style="color:#e2b781">{{ building.category }} / {{ building.era }}</span><h1>{{ building.name }}</h1><div class="pinyin">{{ building.pinyin }}</div><div class="detail-meta"><span>{{ building.location }}</span><span>·</span><span>{{ building.period }}</span><span>·</span><span>{{ building.status }}</span></div></div></div></section>
    <div class="container detail-layout">
      <main class="detail-main"><RouterLink to="/explore" class="link-arrow" style="margin-bottom:28px"><ArrowLeft :size="15" /> 返回建筑探索</RouterLink><h2>{{ building.summary }}</h2><p>{{ building.story }}</p><div class="metrics"><div v-for="metric in building.metrics" :key="metric.label" class="metric"><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong></div></div><section v-for="section in [{title:'建筑概览', text: building.story}, {title:'空间与构造', text:`${building.name}的空间由尺度、材料与行走路径共同构成。通过模型，可以从整体体量进入构件细部，理解它为何在这里以这样的方式成立。`}, {title:'当代意义', text:'数字化记录不是替代现场，而是为建筑建立另一种可持续阅读的入口。后续版本将继续补充测绘数据、修复记录与公开授权资料。'}]" :key="section.title" class="section-block"><h3>{{ section.title }}</h3><p>{{ section.text }}</p></section></main>
      <aside class="detail-aside">
        <div v-if="hasOverview" class="experience-switch"><button type="button" :class="{ active: viewMode === 'overview' }" @click="returnToOverview"><Compass :size="14" /> {{ isScenic ? '景区总览' : '位置总览' }}</button><button type="button" :class="{ active: viewMode === 'model' }" @click="openModel"><Maximize2 :size="13" /> 单体 3D</button></div>
        <ScenicOverview v-if="hasOverview && viewMode === 'overview'" :title="overviewTitle" :subtitle="overviewSubtitle" :points="overviewPoints" @select="enterPoint" />
        <div v-else class="viewer-card"><div v-if="hasOverview" class="model-back"><button type="button" @click="returnToOverview">← 返回{{ isScenic ? '景区' : '位置' }}总览</button><span v-if="selectedPoint">{{ selectedPoint.name }} · {{ selectedPoint.status }}</span></div><span class="viewer-label">INTERACTIVE MODEL / {{ building.model.version }}</span><BuildingViewer :key="selectedPoint?.id ?? building.id" :kind="selectedPoint?.modelKind ?? building.model.kind" :asset-url="activeAssetUrl" :manifest-url="activeManifestUrl" :embed-url="activeEmbedUrl" /><span class="viewer-note">拖动旋转 · 滚轮缩放 · 双击聚焦<br>{{ activeSource ?? '当前为程序化演示；接入授权 GLB 后自动切换真实资产。' }}</span><a v-if="activeEmbedUrl" class="viewer-source-link" :href="activeEmbedUrl" target="_blank" rel="noreferrer">在原平台打开模型 ↗</a></div>
        <div class="source-card"><h3>资料与模型</h3><ul><li><span class="source-type">MODEL</span><br>版本 {{ building.model.version }} · {{ building.model.precision }}</li><li v-if="building.model.manifestUrl"><span class="source-type">LOD</span><br>按设备自动选择 low / medium / high</li><li v-if="building.model.embedUrl"><span class="source-type">PLATFORM</span><br>Sketchfab 原平台交互查看器</li><li v-else><span class="source-type">COMPONENTS</span><br>{{ building.model.nodes }} 个核心构件组</li><li v-if="building.model.license"><span class="source-type">RIGHTS</span><br>{{ building.model.license }}</li><li><span class="source-type">LOCATION</span><br>{{ building.location }} · {{ building.coordinates[1].toFixed(4) }}°N, {{ building.coordinates[0].toFixed(4) }}°E</li><li v-for="source in building.sources ?? []" :key="source.label"><span class="source-type">{{ source.kind }}</span><br><a v-if="source.href" :href="source.href" target="_blank" rel="noreferrer" style="color:#786b5d;text-decoration:underline">{{ source.label }}</a><span v-else>{{ source.label }}</span></li></ul></div>
      </aside>
    </div>
    <section class="container model-section"><span class="eyebrow">DETAILS TO EXPLORE</span><h2>进入模型之前，先看见这些细节</h2><p>把模型中的构件变成可阅读的注释，是这份数字图录和普通模型库的区别。</p><div class="hotspot-list"><button v-for="highlight in building.highlights" :key="highlight" class="hotspot">{{ highlight }}</button></div></section>
  </div>
</template>

<style scoped>
.experience-switch { display: flex; gap: 6px; margin-bottom: 10px; }
.experience-switch button { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #d7cdc0; background: transparent; color: #7b7064; padding: 8px 11px; font-size: 11px; }
.experience-switch button.active, .experience-switch button:hover { border-color: #a73e32; color: #a73e32; background: #f4e5d9; }
.model-back { position: absolute; z-index: 5; top: 48px; left: 18px; right: 18px; display: flex; justify-content: space-between; gap: 8px; color: #b9d1c9; font-size: 10px; }
.model-back button { border: 0; background: rgba(7,20,24,.6); color: #d8bd8b; padding: 5px 7px; font-size: 10px; }
.viewer-source-link { position: absolute; z-index: 4; right: 17px; bottom: 14px; color: #d8bd8b; font-size: 10px; text-decoration: underline; }
</style>

