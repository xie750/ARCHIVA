<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, ArrowRight, MapPin } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { buildings } from '../data/buildings'

const route = useRoute()
const regionName = computed(() => String(route.params.region ?? '河南'))
const regionBuildings = computed(() => buildings.filter((building) => (building.region ?? '未分区') === regionName.value))
const cities = computed(() => Array.from(new Set(regionBuildings.value.map((building) => building.location.split(' · ')[0]))).map((city) => ({ city, items: regionBuildings.value.filter((building) => building.location.startsWith(city)) })))
</script>

<template>
  <div class="region-page">
    <section class="region-hero">
      <div class="container region-hero-inner">
        <RouterLink to="/" class="region-back"><ArrowLeft :size="15" /> 返回全国图谱</RouterLink>
        <span class="eyebrow">REGION / {{ regionName }}</span>
        <h1>{{ regionName }}<span>建筑现场</span></h1>
        <p>从城市、建筑类型和历史路径进入 {{ regionName }} 的数字建筑档案。</p>
        <div class="region-hero-meta"><span><strong>{{ regionBuildings.length }}</strong>座建筑</span><span><strong>{{ cities.length }}</strong>个城市</span><span><strong>3D</strong>逐一设计</span></div>
      </div>
      <div class="region-hero-index" aria-hidden="true"><span>CHAPTER</span><strong>{{ String(regionBuildings.length).padStart(2, '0') }}</strong><i>FIELD ARCHIVE</i></div>
    </section>
    <main class="container region-content">
      <div class="region-section-head"><div><span class="eyebrow">CITY INDEX / {{ regionName }}</span><h2>先选城市，再进入建筑</h2></div><span class="region-count"><MapPin :size="14" /> {{ regionName }} · {{ regionBuildings.length }} 个样本</span></div>
      <section v-for="city in cities" :key="city.city" class="city-section">
        <div class="city-heading"><h3>{{ city.city }}</h3><span>{{ city.items.length }} 个建筑节点</span></div>
        <div class="city-grid"><RouterLink v-for="building in city.items" :key="building.id" :to="`/buildings/${building.id}`" class="city-card"><div class="city-card-art" :class="[building.coverClass, building.id]"><img v-if="building.image" class="city-card-img" :src="building.image.src" :alt="building.image.alt" :style="{ objectPosition: building.image.position ?? '50% 50%' }" /><template v-else><span>FIELD IMAGE / 待接入</span><i class="tower-silhouette" aria-hidden="true" /></template><span v-if="building.image" class="image-credit">{{ building.image.credit }}</span></div><div class="city-card-body"><span>{{ building.era }} · {{ building.location }}</span><strong>{{ building.name }}</strong><p>{{ building.summary }}</p><ArrowRight :size="16" /></div></RouterLink></div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.region-hero { min-height: 440px; position: relative; overflow: hidden; color: #172c36; background: #f4f0e8; border-bottom: 1px solid #d9d1c5; }
.region-hero::before { content: ''; position: absolute; left: 0; right: 0; top: 0; height: 5px; background: #a73e32; }
.region-hero-inner { position: relative; z-index: 1; padding: 36px 0 76px; }
.region-back { display: inline-flex; align-items: center; gap: 7px; color: #6e7776; font-size: 12px; margin-bottom: 66px; }
.region-hero .eyebrow { color: #a73e32; }
.region-hero h1 { display: flex; flex-direction: column; gap: 6px; margin: 20px 0 15px; font: 700 64px/1.05 'Noto Serif SC', serif; }
.region-hero h1 span { color: #667372; font-size: 24px; }
.region-hero p { max-width: 420px; color: #69716f; line-height: 1.9; }
.region-hero-meta { display: flex; gap: 35px; margin-top: 35px; color: #7a817e; font-size: 11px; }
.region-hero-meta strong { display: block; margin-bottom: 4px; color: #172c36; font: 600 24px 'Noto Serif SC', serif; }
.region-hero-index { position: absolute; right: max(24px, calc((100vw - 1180px) / 2 + 18px)); top: 92px; width: 210px; height: 250px; border-left: 1px solid #cfc7ba; display: flex; flex-direction: column; justify-content: space-between; padding-left: 22px; color: #88908a; }
.region-hero-index span, .region-hero-index i { font-size: 10px; font-style: normal; letter-spacing: .15em; }
.region-hero-index strong { color: #d8d0c3; font: 500 150px/.9 'Noto Serif SC', serif; }
.region-content { padding: 66px 0 100px; }
.region-section-head { display: flex; justify-content: space-between; align-items: end; gap: 25px; margin-bottom: 44px; }.region-section-head h2 { margin: 14px 0 0; color: #142b36; font: 600 34px 'Noto Serif SC', serif; }.region-count { display: inline-flex; align-items: center; gap: 6px; color: #718286; font-size: 11px; }
.city-section { padding: 30px 0 44px; border-top: 1px solid rgba(20,43,54,.14); }.city-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }.city-heading h3 { margin: 0; color: #1d3540; font: 600 27px 'Noto Serif SC', serif; }.city-heading span { color: #879696; font-size: 11px; }.city-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }.city-card { overflow: hidden; background: #fbf8f1; border: 1px solid rgba(20,43,54,.13); transition: border-color .2s ease; }.city-card:hover { border-color: #a73e32; }.city-card-art { height: 180px; position: relative; display: flex; align-items: end; padding: 14px 16px; color: #8a918c; background: #e9e5dc; border-bottom: 1px solid #d9d2c7; }.city-card-art span { font: 500 10px 'Noto Sans SC', sans-serif; letter-spacing: .08em; }.city-card-body { display: grid; grid-template-columns: 1fr auto; gap: 9px; padding: 16px; }.city-card-body > span { grid-column: 1 / -1; color: #8b9998; font-size: 10px; }.city-card-body > strong { color: #1d3540; font: 600 20px 'Noto Serif SC', serif; }.city-card-body p { grid-column: 1; margin: 0; color: #64767a; font-size: 12px; line-height: 1.7; }.city-card-body > svg { align-self: end; color: #a73e32; }
@media (max-width: 820px) { .region-hero-index { right: 28px; opacity: .7; }.city-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { .region-hero { min-height: 470px; }.region-back { margin-bottom: 54px; }.region-hero-meta { gap: 18px; }.region-hero-index { display: none; }.region-section-head { display: block; }.region-count { margin-top: 18px; }.city-grid { grid-template-columns: 1fr; } }
</style>
