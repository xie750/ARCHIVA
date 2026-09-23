<script setup lang="ts">
import { ArrowRight, Compass, MapPin } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'
import { featuredBuilding, buildings } from '../data/buildings'
import { computed } from 'vue'
const regionGroups = computed(() => Array.from(new Set(buildings.map((building) => building.region ?? '未分区'))).map((region) => ({ region, cities: Array.from(new Set(buildings.filter((building) => (building.region ?? '未分区') === region).map((building) => building.location.split(' · ')[0]))).map((city) => ({ city, items: buildings.filter((building) => (building.region ?? '未分区') === region && building.location.startsWith(city)), feature: buildings.find((building) => (building.region ?? '未分区') === region && building.location.startsWith(city))! })) })))
</script>

<template>
  <div>
    <section class="hero container">
      <div class="hero-copy">
        <span class="eyebrow">CHINA / ARCHITECTURE ATLAS</span>
        <h1>在每一处地方<br><span>重新阅读建筑。</span></h1>
        <p class="lead">一份从历史、材料与空间出发的中国建筑数字图录。首章从河南出发，沿着塔、寺、石窟、城门与名楼，逐步连接周边省份与全国建筑记忆。</p>
        <div class="hero-actions"><RouterLink to="/explore" class="button-primary">开始探索 <ArrowRight :size="16" /></RouterLink><a href="#featured" class="button-ghost">查看策展精选</a></div>
        <div class="hero-meta"><div><strong>{{ String(buildings.length).padStart(2, '0') }}</strong>已收录样本</div><div><strong>06</strong>周边省份扩展</div><div><strong>3D</strong>空间阅读</div></div>
      </div>
      <div class="hero-art"><div class="hero-sculpture" /><div class="hero-art-label">首发展章 · 河南<br><span>CHAPTER 01 / HENAN</span></div></div>
    </section>

    <section id="featured" class="container">
      <div class="section-head"><div><span class="eyebrow">CURATED SELECTION</span><h2>一座建筑，一段可进入的历史</h2></div><RouterLink to="/explore" class="link-arrow">浏览全部样本 <ArrowRight :size="15" /></RouterLink></div>
      <div class="featured-grid">
        <RouterLink :to="`/buildings/${featuredBuilding.id}`" class="feature-card"><div class="feature-content"><span class="tagline">01 / 洛阳 · 世界遗产</span><h3>{{ featuredBuilding.name }}</h3><p>{{ featuredBuilding.summary }}</p></div></RouterLink>
        <div class="mini-card"><div><span class="mini-index">02</span><h3>从地图进入中国</h3><p>从河南首发样本出发，现已加入山西、陕西、河北、山东、安徽和湖北的代表性建筑。</p></div><RouterLink to="/explore" class="link-arrow">打开建筑地图 <MapPin :size="15" /></RouterLink></div>
      </div>
    </section>

    <section class="quote-band"><span class="eyebrow">THE IDEA</span><blockquote>建筑不是静止的遗存，<br>它是历史仍在发生的空间。</blockquote><cite>中国建筑数字志 · 首发展章</cite></section>

    <section class="container"><div class="section-head"><div><span class="eyebrow">START READING</span><h2>按你的方式进入</h2></div></div><div class="featured-grid">
      <RouterLink to="/explore" class="mini-card"><div><Compass :size="23" color="#a73e32" /><h3>按建筑探索</h3><p>从石窟、寺观、古塔、城门和园林开始，找到你想深入了解的空间。</p></div><span class="link-arrow">进入探索 <ArrowRight :size="15" /></span></RouterLink>
      <div class="mini-card"><div><span class="mini-index">{{ String(buildings.length).padStart(2,'0') }}</span><h3>河南首发 · 周边扩展</h3><p>每一座建筑都配有历史章节、模型版本与资料来源，并按建筑形制配置独立的 3D 展示。</p></div><span class="muted" style="font-size:11px">持续研究与数字复原</span></div>
    </div></section>

    <section class="container region-section"><div class="section-head"><div><span class="eyebrow">REGIONS / CITY GUIDE</span><h2>选择一个省份</h2><p class="muted">首页只展示省份入口。进入省份后，再按城市和建筑继续浏览。</p></div></div><div class="region-grid"><article v-for="group in regionGroups" :key="group.region" class="region-card"><div class="region-card-head"><span class="eyebrow">REGION</span><strong>{{ group.cities.length }} 个城市</strong></div><h3>{{ group.region }}</h3><p>{{ group.cities.map((city) => city.city).join(' · ') }}</p><RouterLink :to="`/regions/${encodeURIComponent(group.region)}`" class="link-arrow">进入{{ group.region }} <ArrowRight :size="15" /></RouterLink></article></div></section>
  </div>
</template>

<style scoped>
.region-section { padding-bottom: 96px; }
.region-block { margin-bottom: 34px; }
.region-title { display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #ddd3c6; color: #a5723f; }
.region-title strong { color: #7f766b; font-size: 10px; font-weight: 500; }
.region-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.region-card { min-height: 190px; padding: 20px; border: 1px solid #ddd3c6; background: linear-gradient(145deg, #f7f2e9, #edf1eb); display: flex; flex-direction: column; gap: 10px; }
.region-card-head { display: flex; justify-content: space-between; align-items: center; color: #a5723f; }
.region-card-head strong { color: #7f766b; font-size: 10px; font-weight: 500; }
.region-card h3 { margin: 4px 0 0; color: #1f3435; font: 600 18px 'Noto Serif SC', serif; }
.region-card p { margin: 0; color: #81796e; font-size: 12px; line-height: 1.75; }
.region-card .link-arrow { margin-top: auto; }
@media (max-width: 760px) { .region-grid { grid-template-columns: 1fr; } }
</style>
