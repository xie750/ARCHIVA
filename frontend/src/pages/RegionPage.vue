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
      <div class="region-hero-orbit" aria-hidden="true"><i /><i /><i /></div>
    </section>
    <main class="container region-content">
      <div class="region-section-head"><div><span class="eyebrow">CITY INDEX / {{ regionName }}</span><h2>先选城市，再进入建筑</h2></div><span class="region-count"><MapPin :size="14" /> {{ regionName }} · {{ regionBuildings.length }} 个样本</span></div>
      <section v-for="city in cities" :key="city.city" class="city-section">
        <div class="city-heading"><h3>{{ city.city }}</h3><span>{{ city.items.length }} 个建筑节点</span></div>
        <div class="city-grid"><RouterLink v-for="building in city.items" :key="building.id" :to="`/buildings/${building.id}`" class="city-card"><div class="city-card-art" :class="building.coverClass"><span>{{ building.category }}</span><strong>{{ building.name }}</strong></div><div class="city-card-body"><span>{{ building.era }} · {{ building.location }}</span><p>{{ building.summary }}</p><ArrowRight :size="16" /></div></RouterLink></div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.region-hero { min-height: 520px; position: relative; overflow: hidden; color: #f3eee4; background: radial-gradient(circle at 76% 24%, rgba(214,167,94,.42), transparent 28%), linear-gradient(125deg, #0b252f, #183b42 52%, #78523d); }
.region-hero::before { content: ''; position: absolute; inset: 0; opacity: .24; background: linear-gradient(90deg, transparent 0 49.8%, rgba(237,211,166,.2) 50%, transparent 50.2%), linear-gradient(rgba(237,211,166,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(237,211,166,.08) 1px, transparent 1px); background-size: auto, 70px 70px, 70px 70px; mask-image: linear-gradient(90deg, #000 0 60%, transparent); }
.region-hero-inner { position: relative; z-index: 1; padding: 36px 0 76px; }
.region-back { display: inline-flex; align-items: center; gap: 7px; color: #c6ded6; font-size: 12px; margin-bottom: 82px; }
.region-hero .eyebrow { color: #e5ba79; }
.region-hero h1 { display: flex; flex-direction: column; gap: 6px; margin: 20px 0 15px; font: 700 clamp(52px, 9vw, 112px)/.94 'Noto Serif SC', serif; letter-spacing: -.08em; }
.region-hero h1 span { color: #d7b77d; font-size: .5em; letter-spacing: -.04em; }
.region-hero p { max-width: 420px; color: rgba(239,239,229,.72); line-height: 1.9; }
.region-hero-meta { display: flex; gap: 35px; margin-top: 42px; color: #a9c2bc; font-size: 11px; }
.region-hero-meta strong { display: block; margin-bottom: 4px; color: #f3dfbb; font: 600 24px 'Noto Serif SC', serif; }
.region-hero-orbit { position: absolute; right: 9%; top: 20%; width: 360px; height: 360px; border: 1px solid rgba(224,193,136,.34); border-radius: 50%; transform: rotate(-20deg); box-shadow: 0 0 0 28px rgba(224,193,136,.06), 0 0 0 74px rgba(224,193,136,.04); }
.region-hero-orbit i { position: absolute; width: 12px; height: 12px; border-radius: 50%; background: #d4a461; box-shadow: 0 0 20px #d4a461; }
.region-hero-orbit i:nth-child(1) { left: 14%; top: 18%; }.region-hero-orbit i:nth-child(2) { right: 5%; top: 52%; }.region-hero-orbit i:nth-child(3) { left: 50%; bottom: 2%; }
.region-content { padding: 66px 0 100px; }
.region-section-head { display: flex; justify-content: space-between; align-items: end; gap: 25px; margin-bottom: 44px; }.region-section-head h2 { margin: 14px 0 0; color: #142b36; font: 600 34px 'Noto Serif SC', serif; }.region-count { display: inline-flex; align-items: center; gap: 6px; color: #718286; font-size: 11px; }
.city-section { padding: 30px 0 44px; border-top: 1px solid rgba(20,43,54,.14); }.city-heading { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 18px; }.city-heading h3 { margin: 0; color: #1d3540; font: 600 27px 'Noto Serif SC', serif; }.city-heading span { color: #879696; font-size: 11px; }.city-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }.city-card { overflow: hidden; background: #fbf8f1; border: 1px solid rgba(20,43,54,.13); transition: transform .3s ease, box-shadow .3s ease; }.city-card:hover { transform: translateY(-6px); box-shadow: 0 20px 38px rgba(17,38,47,.14); }.city-card-art { height: 180px; position: relative; display: flex; flex-direction: column; justify-content: end; padding: 18px; color: #fff; background: linear-gradient(145deg, #31565e, #9f714c); }.city-card-art::before { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 24%, rgba(5,14,17,.8)); }.city-card-art > * { position: relative; z-index: 1; }.city-card-art span { color: #e6c48e; font-size: 10px; }.city-card-art strong { margin-top: 6px; font: 600 23px 'Noto Serif SC', serif; }.city-card-body { display: grid; grid-template-columns: 1fr auto; gap: 9px; padding: 16px; }.city-card-body > span { grid-column: 1 / -1; color: #8b9998; font-size: 10px; }.city-card-body p { margin: 0; color: #64767a; font-size: 12px; line-height: 1.7; }.city-card-body > svg { align-self: end; color: #b87d43; }
@media (max-width: 820px) { .region-hero-orbit { right: -120px; opacity: .55; }.city-grid { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 540px) { .region-hero { min-height: 470px; }.region-back { margin-bottom: 54px; }.region-hero-meta { gap: 18px; }.region-section-head { display: block; }.region-count { margin-top: 18px; }.city-grid { grid-template-columns: 1fr; } }
</style>
