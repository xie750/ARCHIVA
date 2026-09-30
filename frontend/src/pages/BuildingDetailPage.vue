<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { buildings } from '../data/buildings'
import BuildingViewer from '../components/three/BuildingViewer.vue'
import ScenicOverview from '../components/scenic/ScenicOverview.vue'
import type { ScenicPoint } from '../types/building'

const route = useRoute()
const building = computed(() => buildings.find((item) => item.id === route.params.id) ?? buildings[0])
// Every detail page keeps location and 3D in one integrated surface. A scenic
// site supplies many points; a standalone building is represented by one point
// so the interaction stays consistent.
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
const overviewSubtitle = computed(() => building.value.scenic?.subtitle ?? '在真实地图中确认建筑位置，同时通过右侧 3D 小窗查看单体模型。')
const selectedPoint = ref<ScenicPoint | undefined>()
const modelExpanded = ref(false)
const inlineModelCard = ref<HTMLElement | null>(null)
const fullscreenPending = ref(false)
const usesParentModel = computed(() => !selectedPoint.value || Boolean(selectedPoint.value.useParentModel))
const activeAssetUrl = computed(() => usesParentModel.value ? building.value.model.assetUrl : selectedPoint.value?.assetUrl)
const activeManifestUrl = computed(() => usesParentModel.value ? building.value.model.manifestUrl : selectedPoint.value?.manifestUrl)
const activeEmbedUrl = computed(() => usesParentModel.value ? building.value.model.embedUrl : selectedPoint.value?.embedUrl)
const activeSource = computed(() => usesParentModel.value ? building.value.model.source : (selectedPoint.value?.embedSource ?? '该节点尚未确认对应的第三方专属模型。'))
const activeDisplaySource = computed(() => activeEmbedUrl.value
  ? '已接入外部 3D 内容源；展示区仅保留模型浏览能力，平台按钮与冗余入口已隐藏。'
  : activeSource.value)
const activeProvider = computed(() => usesParentModel.value ? (building.value.model.provider ?? (activeEmbedUrl.value ? 'sketchfab' : activeAssetUrl.value ? 'local-glb' : 'pending')) : (selectedPoint.value?.provider ?? (activeEmbedUrl.value ? 'sketchfab' : activeAssetUrl.value ? 'local-glb' : 'pending')))
const activeAssetStatus = computed(() => usesParentModel.value ? (building.value.model.assetStatus ?? (activeEmbedUrl.value ? 'matched' : 'pending')) : (selectedPoint.value?.assetStatus ?? (activeEmbedUrl.value ? 'matched' : 'pending')))
const activeSourceUrl = computed(() => usesParentModel.value ? (building.value.model.sourceUrl ?? activeEmbedUrl.value ?? building.value.model.candidateUrl) : (selectedPoint.value?.sourceUrl ?? selectedPoint.value?.candidateUrl ?? activeEmbedUrl.value))
const activeCredit = computed(() => usesParentModel.value ? building.value.model.credit : selectedPoint.value?.credit)
const activeCandidateUrl = computed(() => usesParentModel.value ? building.value.model.candidateUrl : selectedPoint.value?.candidateUrl)
const activeViewerHint = computed(() => activeProvider.value === 'pending' ? '该建筑 3D 资产仍在权属核验；先保留地图、图文与外部候选入口' : '拖动旋转 · 滚轮缩放 · 双击聚焦')
const warmedEmbeds = new Set<string>()
function warmActiveEmbed() {
  const url = activeEmbedUrl.value?.trim()
  if (!url || warmedEmbeds.has(url)) return
  warmedEmbeds.add(url)
  const link = document.createElement('link')
  link.rel = 'prefetch'
  link.as = 'document'
  link.href = url
  link.crossOrigin = 'anonymous'
  document.head.appendChild(link)
}
function isModelFullscreenElement(element: Element | null) {
  const card = inlineModelCard.value
  return Boolean(card && element && (element === card || card.contains(element)))
}
function syncFullscreenState() {
  if (document.fullscreenElement) {
    modelExpanded.value = isModelFullscreenElement(document.fullscreenElement)
    fullscreenPending.value = false
    return
  }
  if (fullscreenPending.value) return
  modelExpanded.value = false
}
function handleFullscreenError() {
  fullscreenPending.value = false
  modelExpanded.value = false
}
async function setModelExpanded(value: boolean) {
  if (!value) {
    fullscreenPending.value = false
    if (isModelFullscreenElement(document.fullscreenElement)) {
      try {
        await document.exitFullscreen()
      } catch {
        modelExpanded.value = false
      }
      return
    }
    modelExpanded.value = false
    return
  }

  const card = inlineModelCard.value
  if (!card) return
  warmActiveEmbed()
  fullscreenPending.value = true
  modelExpanded.value = true
  try {
    await card.requestFullscreen({ navigationUI: 'hide' })
    fullscreenPending.value = false
    if (!isModelFullscreenElement(document.fullscreenElement)) modelExpanded.value = false
  } catch {
    handleFullscreenError()
  }
}
function toggleModelFullscreen() {
  void setModelExpanded(!modelExpanded.value)
}
// A site node identifies a place inside a building complex.  When it uses
// the parent model, keep the parent building id as the 3D variant so the
// viewer can select the landmark-specific proportions (for example, the
// five-storey Yingxian timber pagoda versus the seven-storey Big Wild Goose
// Pagoda).  Child nodes still get their own scene variant.
const activeVariant = computed(() => selectedPoint.value?.useParentModel || !selectedPoint.value ? building.value.id : selectedPoint.value.id)
function setActivePoint(point: ScenicPoint) {
  selectedPoint.value = point
  warmActiveEmbed()
}
watch(() => building.value.id, () => {
  selectedPoint.value = undefined
  void setModelExpanded(false)
})
watch(modelExpanded, (expanded) => {
  document.documentElement.classList.toggle('model-expanded-lock', expanded)
})
watch(overviewPoints, (points) => {
  if (!points.length) return
  if (!selectedPoint.value || !points.some((point) => point.id === selectedPoint.value?.id)) selectedPoint.value = points[0]
}, {
  immediate: true,
})
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && modelExpanded.value) void setModelExpanded(false)
}
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  document.addEventListener('fullscreenerror', handleFullscreenError)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
  document.removeEventListener('fullscreenerror', handleFullscreenError)
  document.documentElement.classList.remove('model-expanded-lock')
})
</script>

<template>
  <div>
    <section class="detail-cover" :class="[building.coverClass, building.id]"><img v-if="building.image" class="detail-cover-image" :src="building.image.src" :alt="building.image.alt" :style="{ objectPosition: building.image.position ?? '50% 50%' }" /><div class="container"><div class="detail-cover-copy"><span class="eyebrow">{{ building.category }} / {{ building.era }}</span><span class="detail-cover-status">{{ building.image ? 'PUBLIC PHOTO / 公开影像' : 'REFERENCE IMAGE / 影像待核验' }}</span><h1>{{ building.name }}</h1><div class="pinyin">{{ building.pinyin }}</div><div class="detail-meta"><span>{{ building.location }}</span><span>·</span><span>{{ building.period }}</span><span>·</span><span>{{ building.status }}</span></div></div></div><a v-if="building.image?.sourceUrl" class="detail-image-credit" :href="building.image.sourceUrl" target="_blank" rel="noreferrer">{{ building.image.credit }} · {{ building.image.license }}</a><span v-else-if="building.image" class="detail-image-credit">{{ building.image.credit }} · {{ building.image.license }}</span></section>
    <nav class="container detail-journey" aria-label="建筑档案浏览路径">
      <a href="#detail-reading"><span>01</span><strong>阅读概览</strong><small>年代、故事与指标</small></a>
      <a href="#site-overview"><span>02</span><strong>进入现场</strong><small>地图节点与 3D 小窗</small></a>
      <a href="#detail-sources"><span>03</span><strong>核验来源</strong><small>照片、模型和资料</small></a>
    </nav>
    <div class="container detail-layout">
      <main id="detail-reading" class="detail-main"><RouterLink to="/explore" class="link-arrow" style="margin-bottom:28px"><ArrowLeft :size="15" /> 返回建筑探索</RouterLink><h2>{{ building.summary }}</h2><p>{{ building.story }}</p><div class="metrics"><div v-for="metric in building.metrics" :key="metric.label" class="metric"><small>{{ metric.label }}</small><strong>{{ metric.value }}</strong></div></div><section v-for="section in [{title:'建筑概览', text: building.story}, {title:'空间与构造', text:`${building.name}的空间由尺度、材料与行走路径共同构成。通过模型，可以从整体体量进入构件细部，理解它为何在这里以这样的方式成立。`}, {title:'当代意义', text:'数字化记录不是替代现场，而是为建筑建立另一种可持续阅读的入口。后续版本将继续补充测绘数据、修复记录与公开授权资料。'}]" :key="section.title" class="section-block"><h3>{{ section.title }}</h3><p>{{ section.text }}</p></section></main>
      <aside class="detail-aside">
        <ScenicOverview v-if="hasOverview" id="site-overview" :title="overviewTitle" :subtitle="overviewSubtitle" :points="overviewPoints" @select="setActivePoint">
          <template #viewer>
            <section ref="inlineModelCard" class="inline-model-card" :class="{ expanded: modelExpanded }" aria-label="单体 3D 小窗">
              <div class="inline-model-head"><div><span>INTERACTIVE MODEL / {{ building.model.version }}</span><strong>{{ selectedPoint?.name ?? building.name }}</strong></div><button type="button" @pointerenter="warmActiveEmbed" @focus="warmActiveEmbed" @pointerdown.stop.prevent="toggleModelFullscreen" @keydown.enter.stop.prevent="toggleModelFullscreen" @keydown.space.stop.prevent="toggleModelFullscreen"><Minimize2 v-if="modelExpanded" :size="14" /><Maximize2 v-else :size="14" /> {{ modelExpanded ? '退出全屏' : '全屏' }}</button></div>
              <div class="inline-model-frame"><BuildingViewer :key="selectedPoint?.id ?? building.id" :kind="selectedPoint?.modelKind ?? building.model.kind" :variant="activeVariant" :title="selectedPoint?.name ?? building.name" :asset-url="activeAssetUrl" :manifest-url="activeManifestUrl" :embed-url="activeEmbedUrl" :model-provider="activeProvider" :asset-status="activeAssetStatus" :asset-source-url="activeSourceUrl" :asset-credit="activeCredit" :candidate-url="activeCandidateUrl" /></div>
              <span class="inline-model-note">{{ activeViewerHint }}<br>{{ activeDisplaySource ?? '该建筑尚未确认对应的第三方专属模型。' }}</span>
            </section>
          </template>
        </ScenicOverview>
        <div v-else class="viewer-card"><span class="viewer-label">INTERACTIVE MODEL / {{ building.model.version }}</span><BuildingViewer :key="building.id" :kind="building.model.kind" :variant="building.id" :title="building.name" :asset-url="activeAssetUrl" :manifest-url="activeManifestUrl" :embed-url="activeEmbedUrl" :model-provider="activeProvider" :asset-status="activeAssetStatus" :asset-source-url="activeSourceUrl" :asset-credit="activeCredit" :candidate-url="activeCandidateUrl" /><span class="viewer-note">{{ activeViewerHint }}<br>{{ activeDisplaySource ?? '该建筑尚未确认对应的第三方专属模型。' }}</span></div>
        <div id="detail-sources" class="source-card"><h3>资料与模型</h3><ul><li><span class="source-type">MODEL</span><br>版本 {{ building.model.version }} · {{ building.model.precision }}</li><li><span class="source-type">3D STATUS</span><br>{{ activeEmbedUrl ? '第三方平台嵌入' : (activeAssetUrl ? '项目专属 3D 模型' : '对应模型未确认') }} · {{ activeAssetStatus }}</li><li v-if="building.image"><span class="source-type">PHOTO</span><br><a v-if="building.image.sourceUrl" :href="building.image.sourceUrl" target="_blank" rel="noreferrer" style="color:#786b5d;text-decoration:underline">{{ building.image.credit }} · {{ building.image.license }}</a><span v-else>{{ building.image.credit }} · {{ building.image.license }}</span></li><li v-if="activeProvider === 'sketchfab'"><span class="source-type">PLATFORM</span><br><a v-if="activeSourceUrl" :href="activeSourceUrl" target="_blank" rel="noreferrer" style="color:#786b5d;text-decoration:underline">{{ activeCredit ?? 'Sketchfab 原平台交互查看器' }}</a><span v-else>Sketchfab 原平台交互查看器</span></li><li v-else-if="activeAssetUrl"><span class="source-type">ASSET</span><br>Architecture Atlas 项目专属 GLB</li><li v-else-if="activeCandidateUrl"><span class="source-type">CANDIDATE</span><br><a :href="activeCandidateUrl" target="_blank" rel="noreferrer" style="color:#786b5d;text-decoration:underline">在 Sketchfab 搜索该建筑</a></li><li v-if="building.model.license"><span class="source-type">RIGHTS</span><br>{{ building.model.license }}</li><li><span class="source-type">LOCATION</span><br>{{ building.location }} · {{ building.coordinates[1].toFixed(4) }}°N, {{ building.coordinates[0].toFixed(4) }}°E</li><li v-for="source in building.sources ?? []" :key="source.label"><span class="source-type">{{ source.kind }}</span><br><a v-if="source.href" :href="source.href" target="_blank" rel="noreferrer" style="color:#786b5d;text-decoration:underline">{{ source.label }}</a><span v-else>{{ source.label }}</span></li></ul></div>
      </aside>
    </div>
    <section class="container model-section"><span class="eyebrow">DETAILS TO EXPLORE</span><h2>进入模型之前，先看见这些细节</h2><p>把模型中的构件变成可阅读的注释，是这份数字图录和普通模型库的区别。</p><div class="hotspot-list"><button v-for="highlight in building.highlights" :key="highlight" class="hotspot">{{ highlight }}</button></div></section>
  </div>
</template>

<style scoped>
.detail-journey { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 18px; margin-bottom: 22px; }
.detail-journey a { display: grid; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: 'index title' 'index meta'; column-gap: 12px; row-gap: 3px; min-height: 74px; padding: 15px 16px; border: 1px solid rgba(118, 107, 91, .16); border-radius: 8px; background: color-mix(in srgb, var(--paper) 88%, white); color: inherit; text-decoration: none; box-shadow: 0 10px 28px rgba(48, 42, 34, .06); transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease; }
.detail-journey a:hover { transform: translateY(-2px); border-color: rgba(120, 107, 93, .34); box-shadow: 0 16px 34px rgba(48, 42, 34, .1); }
.detail-journey span { grid-area: index; align-self: start; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; background: #f2eadc; color: #786b5d; font-size: 11px; font-weight: 700; letter-spacing: .06em; }
.detail-journey strong { grid-area: title; color: var(--ink); font-size: 14px; font-weight: 650; line-height: 1.35; }
.detail-journey small { grid-area: meta; color: var(--ink-soft); font-size: 11px; line-height: 1.5; }
#detail-reading, #site-overview, #detail-sources { scroll-margin-top: 110px; }
.experience-scrim { position: fixed; inset: 0; z-index: 58; background: #07110f; }
.inline-model-card { height: 100%; position: relative; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; border: 1px solid rgba(227, 202, 150, .34); background: #101717; box-shadow: 0 18px 42px rgba(21, 28, 28, .34); color: #efe4cf; }
.inline-model-card.expanded { position: fixed; z-index: 59; inset: 0; width: 100vw; height: 100dvh; border: 0; box-shadow: none; }
.inline-model-head { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-bottom: 1px solid rgba(220, 190, 130, .22); background: rgba(7, 17, 19, .88); }
.inline-model-head span { display: block; color: #b8c8c3; font-size: 9px; letter-spacing: .12em; }
.inline-model-head strong { display: block; margin-top: 3px; font: 600 15px 'Noto Serif SC', serif; color: #f7e7c6; }
.inline-model-head button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(216, 189, 139, .42); background: rgba(216, 189, 139, .12); color: #f2d59a; padding: 7px 9px; font-size: 11px; white-space: nowrap; }
.inline-model-head button:hover { border-color: rgba(242, 213, 154, .78); background: rgba(216, 189, 139, .2); }
.inline-model-frame { position: relative; min-height: 0; }
.inline-model-note { position: relative; z-index: 3; padding: 8px 12px 10px; color: #aec8bf; background: rgba(8, 18, 20, .92); border-top: 1px solid rgba(220, 190, 130, .16); font-size: 10px; line-height: 1.55; }
.viewer-label { display: none; }
.viewer-card .viewer-note { bottom: 54px; }
:deep(.inline-model-frame .model-canvas) { min-height: 0; }
:deep(.inline-model-frame .viewer-hud) { top: 12px; left: 12px; right: 12px; }
:deep(.inline-model-frame .fullscreen-toggle) { right: 12px; bottom: 12px; }
.inline-model-card:not(.expanded) :deep(.viewer-hud),
.inline-model-card:not(.expanded) :deep(.viewer-fullscreen-button) { display: none; }
.inline-model-card:not(.expanded) .inline-model-note { max-height: 72px; overflow: hidden; }
.inline-model-card:not(.expanded) :deep(.viewer-hud strong) { font-size: 15px; }
.inline-model-card:not(.expanded) :deep(.viewer-hud span) { font-size: 9px; }
.inline-model-card:not(.expanded) :deep(.model-badges) { gap: 5px; }
:global(html.model-expanded-lock) { overflow: hidden; }
@media (max-width: 900px) {
  .detail-journey { grid-template-columns: 1fr; gap: 10px; margin-top: 14px; }
  .detail-journey a { min-height: 68px; }
}
@media (max-width: 700px) {
  .detail-journey { margin-bottom: 14px; }
  .detail-journey a { padding: 13px 14px; }
  .inline-model-head { padding: 9px 10px; }
  .inline-model-head strong { font-size: 14px; }
  .inline-model-note { font-size: 9px; }
  .inline-model-card:not(.expanded) .inline-model-note { max-height: 66px; }
}
@media (prefers-reduced-motion: reduce) {
  .detail-journey a { transition: none; }
}
</style>

