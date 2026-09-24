<script setup lang="ts">
import { ArrowRight, Compass, Landmark, Layers, MapPin, Route } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { featuredBuilding, buildings } from '../data/buildings'
import { computed } from 'vue'
import NationalMap from '../components/site/NationalMap.vue'

const regions = computed(() => Array.from(new Set(buildings.map((building) => building.region ?? '未分区'))))
const cities = computed(() => Array.from(new Set(buildings.map((building) => building.location.split(' · ')[0]))))
const categories = computed(() => Array.from(new Set(buildings.map((building) => building.category))))
const regionGroups = computed(() => regions.value.map((region) => ({ region, cities: Array.from(new Set(buildings.filter((building) => (building.region ?? '未分区') === region).map((building) => building.location.split(' · ')[0]))).map((city) => ({ city, items: buildings.filter((building) => (building.region ?? '未分区') === region && building.location.startsWith(city)), feature: buildings.find((building) => (building.region ?? '未分区') === region && building.location.startsWith(city))! })) })))
</script>

<template>
  <div>
    <section class="hero container">
      <div class="hero-copy">
        <span class="eyebrow">NATIONAL ARCHITECTURE ATLAS</span>
        <h1>打开中国建筑的<br><span>空间图谱。</span></h1>
        <p class="lead">面向全国的建筑游览平台。以地图、年代、类型和 3D 空间体验组织建筑样本，先用样例数据呈现完整产品观感，后续可持续接入真实馆藏与景区数据。</p>
        <div class="hero-actions"><RouterLink to="/explore" class="button-primary">开始探索 <ArrowRight :size="16" /></RouterLink><a href="#featured" class="button-ghost">查看策展精选</a></div>
        <div class="hero-meta"><div><strong>{{ String(buildings.length).padStart(2, '0') }}</strong>建筑样本</div><div><strong>{{ String(regions.length).padStart(2, '0') }}</strong>省级入口</div><div><strong>3D</strong>空间游览</div></div>
      </div>
      <div class="hero-art hero-map">
        <NationalMap title="全国建筑真实地图" summary="真实地理底图 · 城市样本点位" />
      </div>
    </section>

    <section id="featured" class="container">
      <div class="section-head"><div><span class="eyebrow">NATIONAL OVERVIEW</span><h2>先从全国地图进入</h2></div><RouterLink to="/explore" class="link-arrow">浏览全部样本 <ArrowRight :size="15" /></RouterLink></div>
      <div class="national-overview-grid">
        <article class="overview-map-card" aria-label="全国建筑真实地图预览">
          <div class="overview-copy"><span>GEOGRAPHY / ATLAS</span><strong>全国点位总览</strong><p>地图只表达平台覆盖范围和数据接入能力，不让某一座建筑承担全国形象。</p></div>
          <NationalMap class="overview-real-map" title="城市样本点位" summary="可缩放真实底图 · 样本持续接入" compact />
        </article>
        <div class="overview-side">
          <div class="overview-stat"><strong>{{ String(buildings.length).padStart(2, '0') }}</strong><span>建筑样本</span></div>
          <div class="overview-stat"><strong>{{ String(regions.length).padStart(2, '0') }}</strong><span>省级入口</span></div>
          <div class="overview-stat"><strong>{{ String(cities.length).padStart(2, '0') }}</strong><span>城市节点</span></div>
          <RouterLink to="/explore" class="mini-card overview-action"><div><MapPin :size="24" color="#a73e32" /><h3>打开全国地图</h3><p>从地图进入，再按省份、城市、类型和年代继续筛选。</p></div><span class="link-arrow">进入地图 <ArrowRight :size="15" /></span></RouterLink>
        </div>
      </div>
    </section>

    <section class="quote-band"><span class="eyebrow">THE IDEA</span><blockquote>建筑不是静止的遗存，<br>它是历史仍在发生的空间。</blockquote><cite>中国建筑数字志 · 全国图谱</cite></section>

    <section class="container"><div class="section-head"><div><span class="eyebrow">START READING</span><h2>按你的方式进入</h2></div></div><div class="entry-grid">
      <RouterLink to="/explore" class="mini-card"><div><Compass :size="23" color="#a73e32" /><h3>按建筑探索</h3><p>从石窟、寺观、古塔、城门、园林和楼阁开始，找到你想深入了解的空间。</p></div><span class="link-arrow">进入探索 <ArrowRight :size="15" /></span></RouterLink>
      <RouterLink to="/explore" class="mini-card"><div><Layers :size="23" color="#2f8983" /><h3>按类型筛选</h3><p>{{ categories.join('、') }} 等类型已形成样例，可继续扩展成全国建筑分类体系。</p></div><span class="link-arrow">筛选类型 <ArrowRight :size="15" /></span></RouterLink>
      <RouterLink to="/explore" class="mini-card"><div><Route :size="23" color="#c7924f" /><h3>按地域浏览</h3><p>{{ cities.length }} 个城市样本串联成全国入口，适合后续接入城市级路线和景区级游览。</p></div><span class="link-arrow">查看地域 <ArrowRight :size="15" /></span></RouterLink>
      <RouterLink :to="`/buildings/${featuredBuilding.id}`" class="mini-card"><div><Landmark :size="23" color="#1f3435" /><h3>进入 3D 空间</h3><p>每座建筑保留历史章节、模型版本和资料来源，支持从图文阅读跳转到空间体验。</p></div><span class="link-arrow">查看示例 <ArrowRight :size="15" /></span></RouterLink>
    </div></section>

    <section class="container region-section"><div class="section-head"><div><span class="eyebrow">REGIONS / NATIONAL GUIDE</span><h2>全国省份入口</h2><p class="muted">首页展示全国图谱的第一批省级入口。进入省份后，再按城市和建筑继续浏览。</p></div></div><div class="region-grid"><article v-for="group in regionGroups" :key="group.region" class="region-card"><div class="region-card-head"><span class="eyebrow">REGION</span><strong>{{ group.cities.length }} 个城市</strong></div><h3>{{ group.region }}</h3><p>{{ group.cities.map((city) => city.city).join(' · ') }}</p><RouterLink :to="`/regions/${encodeURIComponent(group.region)}`" class="link-arrow">进入{{ group.region }} <ArrowRight :size="15" /></RouterLink></article></div></section>
  </div>
</template>

<style scoped>
.hero-map { min-height: 470px; padding: 0; background: #dfe4df; }
.hero-map :deep(.national-real-map) { min-height: 470px; }
.national-overview-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, .65fr); gap: 24px; align-items: stretch; }
.overview-map-card { position: relative; min-height: 420px; overflow: hidden; border: 1px solid #cfc5b7; background: #ebe7de; display: grid; grid-template-columns: minmax(240px, .44fr) minmax(0, .56fr); transition: border-color .2s ease; }
.overview-map-card:hover { border-color: #a73e32; }
.overview-copy { position: relative; z-index: 2; align-self: end; padding: 34px; }
.overview-copy span { color: #2f8983; font-size: 10px; font-weight: 700; letter-spacing: .2em; }
.overview-copy strong { display: block; margin-top: 14px; color: #1f3435; font: 700 31px/1.2 'Noto Serif SC', serif; letter-spacing: -.04em; }
.overview-copy p { max-width: 330px; margin: 16px 0 0; color: #68736f; font-size: 13px; line-height: 1.85; }
.overview-real-map { min-height: 420px; }
.overview-real-map :deep(.map-heading) { display: none; }
.overview-real-map :deep(.map-summary-panel) { left: 24px; right: 24px; bottom: 24px; max-width: 320px; }
.overview-side { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
.overview-stat { min-height: 115px; padding: 20px; border: 1px solid #ddd3c6; background: #fbf8f1; }
.overview-stat strong { display: block; color: #1f3435; font: 600 31px 'Noto Serif SC', serif; }
.overview-stat span { color: #81796e; font-size: 12px; }
.overview-action { grid-column: 1 / -1; min-height: 242px; }
.entry-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.region-section { padding-bottom: 96px; }
.region-block { margin-bottom: 34px; }
.region-title { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #ddd3c6; color: #a5723f; }
.region-title strong { color: #7f766b; font-size: 10px; font-weight: 500; }
.region-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.region-card { min-height: 190px; padding: 20px; border: 1px solid #ddd3c6; background: #fbf8f1; display: flex; flex-direction: column; gap: 10px; }
.region-card-head { display: flex; justify-content: space-between; align-items: center; color: #a5723f; }
.region-card-head strong { color: #7f766b; font-size: 10px; font-weight: 500; }
.region-card h3 { margin: 4px 0 0; color: #1f3435; font: 600 18px 'Noto Serif SC', serif; }
.region-card p { margin: 0; color: #81796e; font-size: 12px; line-height: 1.75; }
.region-card .link-arrow { margin-top: auto; }
@media (max-width: 1080px) { .national-overview-grid { grid-template-columns: 1fr; } .overview-side { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 980px) { .entry-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) {
  .region-grid, .entry-grid, .overview-side { grid-template-columns: 1fr; }
  .hero-map, .hero-map :deep(.national-real-map) { min-height: 420px; }
  .overview-map-card { grid-template-columns: 1fr; min-height: auto; }
  .overview-real-map { min-height: 300px; }
  .overview-copy { padding: 28px 24px 12px; }
}
</style>
