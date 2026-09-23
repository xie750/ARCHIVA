<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Check, ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-vue-next'
import { buildings } from '../data/buildings'
import { useExploreStore } from '../stores/explore'

const explore = useExploreStore()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const isOpen = ref(false)
const draftRegion = ref(explore.activeRegion)
const draftCity = ref(explore.activeCity)
const draftCategory = ref(explore.activeCategory)
const placement = ref<'above' | 'below'>('below')
const panelStyle = ref<Record<string, string>>({})
const selectedFilters = computed(() => [explore.activeRegion, explore.activeCity, explore.activeCategory].filter(value => value !== '全部'))
const cities = computed(() => Array.from(new Set(buildings
  .filter(building => draftRegion.value === '全部' || (building.region ?? '未分区') === draftRegion.value)
  .map(building => building.location.split(' · ')[0]))))

function selectRegion(region: string) {
  if (draftRegion.value !== region) draftCity.value = '全部'
  draftRegion.value = region
}

function positionPanel() {
  if (!trigger.value) return
  const rect = trigger.value.getBoundingClientRect()
  const gutter = 16
  const gap = 12
  const width = Math.min(680, window.innerWidth - gutter * 2)
  const left = Math.max(gutter, Math.min(rect.right - width, window.innerWidth - width - gutter))
  const below = window.innerHeight - rect.bottom - gap - gutter
  const above = rect.top - gap - gutter
  placement.value = below >= Math.min(420, above) ? 'below' : 'above'
  const available = placement.value === 'below' ? below : above
  panelStyle.value = {
    width: `${width}px`,
    left: `${left}px`,
    ...(placement.value === 'below' ? { top: `${rect.bottom + gap}px` } : { bottom: `${window.innerHeight - rect.top + gap}px` }),
    maxHeight: `${Math.max(180, Math.min(580, available))}px`,
    '--arrow-position': `${Math.min(width - 28, Math.max(28, rect.left + rect.width / 2 - left))}px`,
  }
}

async function togglePanel() {
  if (isOpen.value) {
    closePanel()
    return
  }
  draftRegion.value = explore.activeRegion
  draftCity.value = explore.activeCity
  draftCategory.value = explore.activeCategory
  positionPanel()
  isOpen.value = true
  await nextTick()
  panel.value?.focus({ preventScroll: true })
}

function closePanel(restoreFocus = true) {
  isOpen.value = false
  if (restoreFocus) trigger.value?.focus({ preventScroll: true })
}

function resetDraft() {
  draftRegion.value = '全部'
  draftCity.value = '全部'
  draftCategory.value = '全部'
}

function applyFilters() {
  explore.$patch({ activeRegion: draftRegion.value, activeCity: draftCity.value, activeCategory: draftCategory.value })
  closePanel()
}

function onOutsidePointer(event: PointerEvent) {
  if (isOpen.value && event.target instanceof Node && !root.value?.contains(event.target)) closePanel(false)
}

function onKeydown(event: KeyboardEvent) {
  if (isOpen.value && event.key === 'Escape') {
    event.preventDefault()
    closePanel()
  }
}

function onFocusout(event: FocusEvent) {
  if (isOpen.value && event.relatedTarget instanceof Node && !root.value?.contains(event.relatedTarget)) closePanel(false)
}

function onScroll(event: Event) {
  // Allow the options to scroll without moving or dismissing the bubble.
  if (isOpen.value && !(event.target instanceof Node && panel.value?.contains(event.target))) closePanel(false)
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', positionPanel)
  window.addEventListener('scroll', onScroll, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', positionPanel)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <div ref="root" class="explore-filter" @focusout="onFocusout">
    <span class="filter-summary" aria-live="polite">{{ selectedFilters.length ? selectedFilters.join(' · ') : '全部地区 · 全部类型' }}</span>
    <button ref="trigger" type="button" class="filter-trigger" :class="{ 'is-open': isOpen, 'has-filters': selectedFilters.length }" :aria-expanded="isOpen" aria-controls="explore-filter-panel" aria-haspopup="dialog" @click="togglePanel">
      <SlidersHorizontal :size="16" aria-hidden="true" />
      <span>筛选</span>
      <span v-if="selectedFilters.length" class="filter-count">{{ selectedFilters.length }}</span>
      <ChevronDown :size="14" class="filter-chevron" aria-hidden="true" />
    </button>
    <Transition name="filter-bubble">
      <section v-if="isOpen" id="explore-filter-panel" ref="panel" class="filter-panel" :class="`is-${placement}`" :style="panelStyle" role="dialog" aria-labelledby="filter-title" aria-describedby="filter-description" tabindex="-1">
        <header class="filter-header">
          <div><h2 id="filter-title">筛选建筑</h2><p id="filter-description">选好条件，探索感兴趣的建筑</p></div>
          <button type="button" class="filter-close" aria-label="关闭筛选" @click="closePanel()"><X :size="18" aria-hidden="true" /></button>
        </header>
        <div class="filter-options">
          <div class="filter-group" role="group" aria-labelledby="filter-region-label">
            <h3 id="filter-region-label">省份</h3>
            <div class="filter-chips">
              <button v-for="region in ['全部', ...explore.regions]" :key="region" type="button" :class="{ selected: draftRegion === region }" :aria-pressed="draftRegion === region" @click="selectRegion(region)"><Check v-if="draftRegion === region" :size="13" aria-hidden="true" />{{ region }}</button>
            </div>
          </div>
          <div class="filter-group" role="group" aria-labelledby="filter-city-label">
            <h3 id="filter-city-label">城市</h3>
            <div class="filter-chips">
              <button v-for="city in ['全部', ...cities]" :key="city" type="button" :class="{ selected: draftCity === city }" :aria-pressed="draftCity === city" @click="draftCity = city"><Check v-if="draftCity === city" :size="13" aria-hidden="true" />{{ city }}</button>
            </div>
          </div>
          <div class="filter-group" role="group" aria-labelledby="filter-category-label">
            <h3 id="filter-category-label">建筑类型</h3>
            <div class="filter-chips">
              <button v-for="category in explore.categories" :key="category" type="button" :class="{ selected: draftCategory === category }" :aria-pressed="draftCategory === category" @click="draftCategory = category"><Check v-if="draftCategory === category" :size="13" aria-hidden="true" />{{ category }}</button>
            </div>
          </div>
        </div>
        <footer class="filter-footer">
          <button type="button" class="filter-reset" @click="resetDraft"><RotateCcw :size="14" aria-hidden="true" />重置</button>
          <button type="button" class="filter-confirm" @click="applyFilters">确定<Check :size="16" aria-hidden="true" /></button>
        </footer>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.explore-filter { display: flex; align-items: center; justify-content: flex-end; gap: 18px; min-width: 0; }
.filter-summary { color: var(--ink-soft); font-size: 12px; line-height: 1.6; text-align: right; }
.filter-trigger { display: inline-flex; align-items: center; justify-content: center; gap: 9px; min-height: 44px; flex-shrink: 0; padding: 0 17px; border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--ink); font-size: 13px; transition: background .18s ease, border-color .18s ease; }
.filter-trigger:hover, .filter-trigger.is-open, .filter-trigger.has-filters { border-color: var(--jade); background: color-mix(in srgb, var(--jade) 9%, var(--paper)); }
.filter-chevron { transition: transform .18s ease; }
.is-open .filter-chevron { transform: rotate(180deg); }
.filter-count { display: inline-grid; place-items: center; min-width: 19px; height: 19px; padding: 0 4px; border-radius: 50%; background: var(--navy); color: white; font-size: 10px; }
.filter-panel { position: fixed; z-index: 30; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 20px; background: var(--paper); box-shadow: 0 20px 60px color-mix(in srgb, var(--ink) 16%, transparent), 0 4px 14px color-mix(in srgb, var(--ink) 5%, transparent); outline: none; transform-origin: var(--arrow-position) top; }
.filter-panel::before { position: absolute; content: ''; left: var(--arrow-position); top: -7px; width: 12px; height: 12px; background: var(--paper); border-left: 1px solid var(--line); border-top: 1px solid var(--line); transform: translateX(-50%) rotate(45deg); }
.filter-panel.is-above { transform-origin: var(--arrow-position) bottom; }
.filter-panel.is-above::before { top: auto; bottom: -7px; transform: translateX(-50%) rotate(225deg); }
.filter-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 22px 24px 18px; flex-shrink: 0; }
.filter-header h2 { margin: 0; color: var(--ink); font-size: 18px; font-weight: 600; letter-spacing: .04em; }
.filter-header p { margin: 7px 0 0; color: var(--ink-soft); font-size: 12px; line-height: 1.5; }
.filter-close { display: grid; place-items: center; width: 44px; height: 44px; margin: -8px -10px 0 0; flex-shrink: 0; color: var(--ink-soft); background: transparent; border: 0; border-radius: 50%; }
.filter-close:hover { background: var(--paper-muted); color: var(--ink); }
.filter-options { min-height: 0; overflow-y: auto; overscroll-behavior: contain; padding: 0 24px 8px; scrollbar-width: thin; }
.filter-group { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 16px; padding: 18px 0; border-top: 1px solid var(--line); }
.filter-group h3 { margin: 0; padding-top: 12px; color: var(--ink-soft); font-size: 12px; font-weight: 500; line-height: 20px; }
.filter-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.filter-chips button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 8px 15px; border: 1px solid transparent; border-radius: 999px; color: var(--ink-soft); background: color-mix(in srgb, var(--ink) 4%, var(--paper)); font-size: 13px; line-height: 20px; transition: color .18s ease, background .18s ease, border-color .18s ease; }
.filter-chips button:hover { color: var(--ink); border-color: color-mix(in srgb, var(--jade) 40%, transparent); }
.filter-chips button.selected { color: var(--navy); background: color-mix(in srgb, var(--jade) 12%, var(--paper)); border-color: var(--jade); font-weight: 500; }
.filter-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 24px; border-top: 1px solid var(--line); flex-shrink: 0; }
.filter-reset, .filter-confirm { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; border-radius: 999px; padding: 0 16px; font-size: 13px; transition: background .18s ease; }
.filter-reset { margin-left: -8px; color: var(--ink-soft); border: 0; background: transparent; }
.filter-reset:hover { color: var(--ink); background: var(--paper-muted); }
.filter-confirm { min-width: 126px; color: var(--paper); background: var(--navy); border: 1px solid var(--navy); }
.filter-confirm:hover { background: var(--navy-deep); }
button:focus-visible { outline: 2px solid var(--jade); outline-offset: 3px; }
.filter-bubble-enter-active, .filter-bubble-leave-active { transition: opacity .18s ease, transform .18s ease; }
.filter-bubble-enter-from, .filter-bubble-leave-to { opacity: 0; transform: translateY(-4px) scale(.98); }
.filter-bubble-enter-from.is-above, .filter-bubble-leave-to.is-above { transform: translateY(4px) scale(.98); }
@media (max-width: 640px) {
  .explore-filter { gap: 10px; flex: 1; }
  .filter-summary { font-size: 11px; }
  .filter-header { padding: 18px 18px 16px; }
  .filter-options { padding: 0 18px 4px; }
  .filter-group { grid-template-columns: 1fr; gap: 10px; padding: 16px 0; }
  .filter-group h3 { padding-top: 0; }
  .filter-chips button { padding-inline: 13px; }
  .filter-footer { padding: 12px 18px; }
}
@media (max-height: 500px) {
  .filter-header { padding-block: 12px; }
  .filter-header p { display: none; }
  .filter-header h2 { font-size: 16px; line-height: 28px; }
  .filter-footer { padding-block: 10px; }
}
@media (prefers-reduced-motion: reduce) {
  *, .filter-bubble-enter-active, .filter-bubble-leave-active { transition: none; }
}
</style>
