<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ModelAssetStatus, ModelProvider } from '../../types/building'

/**
 * The viewer intentionally has one rendering path: an externally hosted
 * viewer (currently Sketchfab for the reviewed catalog entries). A dedicated
 * local GLB is also supported for a building such as Chengyang Wind-Rain
 * Bridge when no public third-party model exists yet. A missing exact URL
 * stays empty; a different building is never substituted.
 */
const props = withDefaults(defineProps<{
  kind: 'grotto' | 'temple' | 'palace' | 'gate' | 'pagoda' | 'pavilion' | 'garden' | 'street'
  variant?: string
  /** Dedicated project model, rendered only when explicitly assigned. */
  assetUrl?: string
  /** Retained for data compatibility with the asset manifest. */
  manifestUrl?: string
  /** Official third-party viewer embed URL. */
  embedUrl?: string
  modelProvider?: ModelProvider
  assetStatus?: ModelAssetStatus
  assetSourceUrl?: string
  assetCredit?: string
  /** Search URL used to find the exact building model; never loaded in iframe. */
  candidateUrl?: string
  title?: string
}>(), {
  assetUrl: undefined,
  manifestUrl: undefined,
  variant: undefined,
})

const mount = ref<HTMLDivElement | null>(null)
const localStage = ref<HTMLDivElement | null>(null)
const immersive = ref(false)
const embedLoaded = ref(false)
const embedError = ref(false)
const localLoaded = ref(false)
const localError = ref(false)
const isNearViewport = ref(false)

type CachedFrame = {
  url: string
  loaded: boolean
  error: boolean
}

// Keep the active frame and the most recently viewed frame alive. Sketchfab
// boots a full WebGL runtime inside each iframe, so remounting it on every
// scenic-point click is noticeably slower than reusing the already warmed
// document. The two-frame cap keeps memory bounded on long browsing sessions.
const frameCache = ref<CachedFrame[]>([])
let visibilityObserver: IntersectionObserver | undefined

// Only an explicitly reviewed URL may create an iframe. Do not use a
// category-level or global fallback: that is how one building can accidentally
// show another site's model.
const externalEmbed = computed(() => props.embedUrl?.trim() || '')
const localAsset = computed(() => props.assetUrl?.trim() || '')
const shouldRenderEmbed = computed(() => isNearViewport.value && Boolean(externalEmbed.value))
const shouldRenderLocal = computed(() => isNearViewport.value && !externalEmbed.value && Boolean(localAsset.value))
const pending3d = computed(() => !externalEmbed.value && !localAsset.value)
const displayTitle = computed(() => props.title?.trim() || '建筑模型')
const providerLabel = computed(() => {
  switch (props.modelProvider) {
    case 'sketchfab': return 'Sketchfab'
    case 'local-glb': return '项目专属 3D 模型'
    case 'model-viewer': return '外部 Model Viewer'
    case 'cesium': return 'Cesium 外部服务'
    case 'pending': return '待确认专属模型'
    default: return '第三方平台'
  }
})
const statusLabel = computed(() => {
  if (pending3d.value) return '尚未确认该建筑对应模型'
  if (embedError.value) return '第三方模型加载失败'
  if (localError.value) return '项目模型加载失败'
  if (localAsset.value && !localLoaded.value) return '载入项目专属模型…'
  if (!embedLoaded.value) return '连接第三方模型服务…'
  switch (props.assetStatus) {
    case 'published': return '第三方模型 · 已审核'
    case 'matched': return '第三方模型 · 已匹配'
    case 'reference': return '第三方模型待核验'
    case 'failed': return '第三方模型 · 待修复'
    case 'pending': return '尚未确认该建筑对应模型'
    default: return '第三方模型 · 可交互浏览'
  }
})
const assetBadge = computed(() => {
  if (pending3d.value) return 'NO EXACT MODEL'
  if (embedError.value) return '3D ERROR'
  if (localError.value) return '3D ERROR'
  if (localAsset.value) return 'PROJECT 3D'
  return 'PLATFORM 3D'
})
const modelLabel = computed(() => props.variant === 'guangxi-chengyang-wind-rain-bridge'
  ? '程阳风雨桥 · 木构廊桥形制'
  : ({
  grotto: '石窟群 · 空间扫描',
  temple: '寺院轴线 · 形制复原',
  palace: '宫殿建筑群 · 形制复原',
  gate: '城门遗址 · 形制复原',
  pagoda: '楼阁古塔 · 构件扫描',
  pavilion: '临江名楼 · 形制复原',
  garden: '园林院落 · 场景复原',
  street: props.variant === 'qingming-song-street' ? '宋代街市 · 场景复原' : '街巷建筑 · 参考模型',
}[props.kind]))
const displayLabel = computed(() => displayTitle.value + ' · ' + modelLabel.value)
const sourceHref = computed(() => props.assetSourceUrl?.trim() || externalEmbed.value || props.candidateUrl?.trim() || '')
const sourceLabel = computed(() => props.assetCredit?.trim() || (props.candidateUrl ? '打开第三方候选搜索' : providerLabel.value + ' 模型来源'))
const viewerState = computed(() => {
  if (pending3d.value) return '暂无该建筑对应的第三方模型'
  if (embedError.value) return '外部模型暂时不可用'
  if (localAsset.value && localError.value) return '项目专属模型暂时不可用'
  if (localAsset.value && !localLoaded.value) return '正在载入项目专属模型'
  if (localAsset.value) return '项目专属 3D 模型已加载 · 可交互浏览'
  if (!embedLoaded.value) return '正在载入外部模型'
  return '第三方平台模型已加载 · 可交互浏览'
})

let localCleanup: (() => void) | undefined
let localLoadToken = 0

async function mountLocalViewer(url: string) {
  localCleanup?.()
  localCleanup = undefined
  localLoaded.value = false
  localError.value = false
  if (!url || !localStage.value) return
  const token = ++localLoadToken
  try {
    const THREE = await import('three')
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
    const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js')
    if (token !== localLoadToken || !localStage.value) return
    const stage = localStage.value
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#07151b')
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(11, 8, 13)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    stage.replaceChildren(renderer.domElement)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.target.set(0, 2.2, 0)
    controls.minDistance = 7
    controls.maxDistance = 28
    scene.add(new THREE.HemisphereLight(0xb7dfdf, 0x16221f, 2.2))
    const key = new THREE.DirectionalLight(0xffdfb2, 3.2)
    key.position.set(7, 14, 9)
    key.castShadow = true
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x7bc8d1, 1.4)
    fill.position.set(-8, 6, -6)
    scene.add(fill)
    let frame = 0
    let disposed = false
    const resize = () => {
      const width = Math.max(1, stage.clientWidth)
      const height = Math.max(1, stage.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    resize()
    new GLTFLoader().load(url, (gltf) => {
      if (disposed || token !== localLoadToken) return
      const model = gltf.scene
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true
          node.receiveShadow = true
        }
      })
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      const scale = 8 / Math.max(size.x, size.y, size.z, 1)
      model.scale.setScalar(scale)
      model.position.y -= (size.y * scale) / 2 - 0.2
      scene.add(model)
      controls.target.set(0, 2.2, 0)
      controls.update()
      localLoaded.value = true
      localError.value = false
    }, undefined, () => {
      if (disposed || token !== localLoadToken) return
      localLoaded.value = false
      localError.value = true
    })
    const animate = () => {
      if (disposed) return
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    animate()
    localCleanup = () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  } catch {
    localLoaded.value = false
    localError.value = true
  }
}

function ensureFrame(url: string) {
  const existingIndex = frameCache.value.findIndex((frame) => frame.url === url)
  const existing = existingIndex >= 0 ? frameCache.value[existingIndex] : undefined
  if (existing) {
    // Promote a revisited frame so the two-entry cache behaves like a small
    // LRU instead of evicting the frame the user just returned to.
    if (existingIndex > 0) frameCache.value = [existing, ...frameCache.value.filter((frame) => frame.url !== url)]
    return existing
  }
  const frame: CachedFrame = { url, loaded: false, error: false }
  frameCache.value = [frame, ...frameCache.value].slice(0, 2)
  return frame
}

function handleFrameLoad(url: string) {
  const frame = ensureFrame(url)
  frame.loaded = true
  frame.error = false
  if (url === externalEmbed.value) {
    embedLoaded.value = true
    embedError.value = false
  }
}

function handleFrameError(url: string) {
  const frame = ensureFrame(url)
  frame.loaded = false
  frame.error = true
  if (url === externalEmbed.value) {
    embedLoaded.value = false
    embedError.value = true
  }
}

function updateFullscreenState() {
  immersive.value = Boolean(document.fullscreenElement)
}

async function toggleImmersive() {
  if (document.fullscreenElement) {
    try {
      await document.exitFullscreen()
    } catch {
      immersive.value = false
    }
    return
  }
  if (!mount.value) return
  try {
    await mount.value.requestFullscreen()
  } catch {
    // Some embedded browsers do not expose Fullscreen API. Keep a useful
    // fallback so the viewer still occupies the available viewport.
    immersive.value = !immersive.value
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreenState)
  if (typeof IntersectionObserver === 'undefined' || !mount.value) {
    isNearViewport.value = true
    return
  }
  visibilityObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      // Keep the flag true after the first intersection so scrolling away and
      // back does not tear down a warmed Sketchfab document.
      isNearViewport.value = true
      visibilityObserver?.disconnect()
      visibilityObserver = undefined
    }
  }, { rootMargin: '240px 0px' })
  visibilityObserver.observe(mount.value)
})

onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState)
  visibilityObserver?.disconnect()
  visibilityObserver = undefined
  localCleanup?.()
  localCleanup = undefined
})

watch(externalEmbed, (url) => {
  if (!url) {
    embedLoaded.value = false
    embedError.value = false
    return
  }
  const frame = ensureFrame(url)
  embedLoaded.value = frame.loaded
  embedError.value = frame.error
}, { immediate: true })

watch([localAsset, shouldRenderLocal], async ([url, active]) => {
  if (active && url) {
    // shouldRenderLocal changes before Vue has committed the v-else-if branch
    // that owns localStage. Wait for that DOM commit before creating WebGL.
    await nextTick()
    if (shouldRenderLocal.value && localAsset.value === url) void mountLocalViewer(url)
  }
  else if (!active) {
    localCleanup?.()
    localCleanup = undefined
  }
}, { immediate: true, flush: 'post' })
</script>

<template>
  <div
    ref="mount"
    class="model-canvas"
    :class="{ 'external-active': Boolean(externalEmbed), 'local-active': shouldRenderLocal, 'pending-active': pending3d, immersive }"
    :aria-label="displayTitle + ' 外部三维模型浏览器'"
  >
    <div v-if="shouldRenderEmbed" class="external-model-stack" aria-live="polite">
      <iframe
        v-for="frame in frameCache"
        v-show="frame.url === externalEmbed"
        :key="frame.url"
        class="external-model"
        :src="frame.url"
        :title="displayTitle + ' 第三方三维模型'"
        allow="autoplay; fullscreen; xr-spatial-tracking"
        allowfullscreen
        loading="eager"
        fetchpriority="high"
        referrerpolicy="strict-origin-when-cross-origin"
        @load="handleFrameLoad(frame.url)"
        @error="handleFrameError(frame.url)"
      />
    </div>
    <div v-else-if="shouldRenderLocal" ref="localStage" class="local-model-stage" aria-live="polite">
      <span v-if="!localLoaded && !localError" class="local-model-loading">正在载入项目专属 3D 模型…</span>
      <span v-if="localError" class="local-model-loading">项目专属 3D 模型暂时不可用</span>
    </div>
    <div v-else class="external-pending" role="status">
      <div class="pending-orbit" aria-hidden="true"><span /><i /><b /></div>
      <span class="pending-kicker">EXACT MODEL / 专属模型</span>
      <strong>{{ displayTitle }} · 暂无对应 3D 模型</strong>
      <p>尚未核验到与该建筑名称和位置一致的第三方模型。这里不会加载其他建筑模型。</p>
      <a v-if="sourceHref" :href="sourceHref" target="_blank" rel="noreferrer">{{ sourceLabel }} ↗</a>
    </div>

    <button
      type="button"
      class="viewer-fullscreen-button"
      :class="{ active: immersive }"
      :title="immersive ? '退出全屏' : '全屏查看'"
      @click="toggleImmersive"
    >
      <span>{{ immersive ? '↙' : '⛶' }}</span>{{ immersive ? '退出全屏' : '全屏查看' }}
    </button>

    <div class="viewer-hud">
      <div class="hud-head">
        <div>
          <span class="hud-kicker">DIGITAL HERITAGE / 外部平台模式</span>
          <strong>{{ displayLabel }}</strong>
          <small class="asset-status">{{ statusLabel }}</small>
        </div>
        <span class="live-pill"><i />{{ assetBadge }}</span>
      </div>
      <div class="hud-bottom">
        <span class="hud-status"><i />{{ viewerState }}</span>
        <span class="hud-provider">{{ providerLabel }}</span>
        <a
          v-if="sourceHref"
          class="hud-source"
          :href="sourceHref"
          target="_blank"
          rel="noreferrer"
          @click.stop
        >来源 ↗</a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.model-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 470px;
  overflow: hidden;
  isolation: isolate;
  background: #07151b;
}

.local-model-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07151b;
}

.local-model-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.local-model-loading {
  position: absolute;
  inset: 50% auto auto 50%;
  transform: translate(-50%, -50%);
  color: #d8bd8b;
  font-size: 12px;
  letter-spacing: .04em;
  white-space: nowrap;
}

.model-canvas.immersive,
.model-canvas:fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100dvh;
  min-height: 100dvh;
  margin: 0;
}

.model-canvas::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(2, 10, 14, .3), transparent 27%, transparent 68%, rgba(2, 8, 12, .84));
}

.model-canvas::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  opacity: .13;
  background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(131, 222, 220, .11) 4px, transparent 5px);
  mix-blend-mode: screen;
}

.model-canvas.external-active { background: #07151b; }
.external-model-stack {
  position: absolute;
  inset: 0;
  z-index: 0;
  contain: strict;
  background: #0b171d;
}
.external-model {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  border: 0;
  background: #0b171d;
  contain: strict;
}

.external-pending {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 12px;
  padding: 36px;
  color: #d8e4dd;
  text-align: center;
  background:
    radial-gradient(circle at 50% 36%, rgba(64, 103, 101, .42), transparent 42%),
    linear-gradient(180deg, #142b2f, #081417);
}

.external-pending strong {
  color: #f1dfc3;
  font: 600 22px/1.4 'Noto Serif SC', serif;
  letter-spacing: .04em;
}

.external-pending p {
  max-width: 430px;
  margin: 0;
  color: #a9bab4;
  font-size: 12px;
  line-height: 1.9;
}

.external-pending a {
  color: #d8bd8b;
  font-size: 11px;
  text-decoration: underline;
}

.pending-kicker {
  color: #f0c27d;
  border: 1px solid rgba(212, 165, 106, .36);
  background: rgba(20, 34, 34, .62);
  padding: 5px 8px;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .18em;
}

.pending-orbit {
  position: relative;
  width: 96px;
  height: 96px;
  border: 1px solid rgba(120, 222, 216, .34);
  border-radius: 50%;
  box-shadow: 0 0 34px rgba(120, 222, 216, .12);
}

.pending-orbit::before,
.pending-orbit::after {
  content: '';
  position: absolute;
  inset: 17px;
  border: 1px dashed rgba(216, 189, 139, .46);
  border-radius: 50%;
}

.pending-orbit::after {
  inset: 47px 8px;
  border-style: solid;
  border-color: rgba(120, 222, 216, .48) transparent;
  transform: rotate(-26deg);
}

.pending-orbit span,
.pending-orbit i,
.pending-orbit b {
  position: absolute;
  display: block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #78ded8;
  box-shadow: 0 0 13px rgba(120, 222, 216, .82);
}

.pending-orbit span { top: 11px; left: 43px; }
.pending-orbit i { right: 14px; bottom: 22px; }
.pending-orbit b { left: 15px; bottom: 22px; background: #d0a164; box-shadow: 0 0 13px rgba(208, 161, 100, .68); }

.viewer-fullscreen-button {
  position: absolute;
  z-index: 6;
  right: 16px;
  top: 62px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 31px;
  border: 1px solid rgba(216, 189, 139, .48);
  color: #ecd4ab;
  background: rgba(4, 19, 24, .72);
  padding: 0 10px;
  font-size: 10px;
  letter-spacing: .06em;
  pointer-events: auto;
  backdrop-filter: blur(6px);
  cursor: pointer;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.viewer-fullscreen-button span { color: #78ded8; font-size: 13px; line-height: 1; }
.viewer-fullscreen-button:hover,
.viewer-fullscreen-button.active {
  border-color: rgba(120, 222, 216, .68);
  background: rgba(15, 45, 48, .82);
  transform: translateY(-1px);
}

.model-canvas.immersive .viewer-fullscreen-button {
  top: 18px;
  right: 18px;
  min-height: 36px;
  padding-inline: 13px;
  font-size: 11px;
}

.viewer-hud {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  color: #c8e0dc;
  font-family: 'Noto Sans SC', sans-serif;
}

.hud-head {
  position: absolute;
  top: 18px;
  left: 20px;
  right: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.hud-kicker {
  display: block;
  margin-bottom: 6px;
  color: #75c5c5;
  font-size: 8px;
  letter-spacing: .19em;
}

.hud-head strong {
  display: block;
  color: #f1dfc3;
  font: 600 13px 'Noto Serif SC', serif;
  letter-spacing: .08em;
}

.asset-status {
  display: block;
  margin-top: 4px;
  color: #87aaa4;
  font-size: 8px;
  letter-spacing: .04em;
}

.live-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #90d5cc;
  font-size: 8px;
  letter-spacing: .13em;
  border: 1px solid rgba(118, 215, 208, .36);
  padding: 5px 7px;
  background: rgba(5, 25, 30, .42);
}

.live-pill i,
.hud-status i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  display: inline-block;
  background: #76e0d2;
  box-shadow: 0 0 9px #76e0d2;
}

.hud-bottom {
  position: absolute;
  bottom: 15px;
  left: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #76908f;
  font-size: 9px;
}

.hud-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #b8d4cb;
}

.hud-provider {
  color: #87aaa4;
  letter-spacing: .08em;
}

.hud-source {
  margin-left: auto;
  color: #d8bd8b;
  pointer-events: auto;
  text-decoration: underline;
}

@media (max-width: 540px) {
  .external-pending { padding: 28px 22px; }
  .external-pending strong { font-size: 19px; }
  .external-pending p { font-size: 11px; line-height: 1.75; }
  .viewer-fullscreen-button { top: auto; right: 12px; bottom: 62px; min-height: 32px; }
  .model-canvas.immersive .viewer-fullscreen-button { top: 14px; right: 14px; bottom: auto; }
  .hud-head { left: 14px; right: 14px; flex-direction: column; gap: 7px; }
  .hud-head strong { max-width: min(260px, 74vw); line-height: 1.45; }
  .live-pill { max-width: 168px; padding: 4px 6px; line-height: 1.35; }
  .hud-bottom { left: 14px; right: 14px; bottom: 14px; flex-wrap: wrap; }
  .hud-source { margin-left: 0; }
}
</style>
