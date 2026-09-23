<script setup lang="ts">
import { Search, ArrowUpRight, MapPin } from 'lucide-vue-next'
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'
import { useExploreStore } from '../stores/explore'
const explore = useExploreStore()
const route = useRoute()
if (typeof route.query.region === 'string') explore.activeRegion = route.query.region
if (typeof route.query.city === 'string') explore.activeCity = route.query.city
const mapBounds = computed(() => {
  const items = explore.filteredBuildings
  const longs = items.map((item) => item.coordinates[0])
  const lats = items.map((item) => item.coordinates[1])
  return { minLong: Math.min(...longs, 108), maxLong: Math.max(...longs, 120), minLat: Math.min(...lats, 30), maxLat: Math.max(...lats, 40) }
})
const mapCities = computed(() => Array.from(new Set(explore.filteredBuildings.map((building) => building.location.split(' · ')[0]))).slice(0, 5).join(' · '))
</script>

<template>
  <div class="container">
    <section class="explore-header"><span class="eyebrow">FIELD GUIDE / CHINA</span><h1>建筑探索</h1><p>从城市、年代和建筑类型进入中国建筑的空间档案。首发展区从河南出发，现已连接周边省份的代表性建筑。</p></section>
    <div class="explore-tools"><label class="search-box"><Search :size="17" /><input v-model="explore.query" placeholder="搜索建筑、城市或关键词" /></label><div class="category-tabs"><button v-for="region in ['全部', ...explore.regions]" :key="region" :class="{ active: explore.activeRegion === region }" @click="explore.activeRegion = region; explore.activeCity = '全部'">{{ region }}</button></div><div class="category-tabs"><button v-for="city in ['全部', ...explore.cities]" :key="city" :class="{ active: explore.activeCity === city }" @click="explore.activeCity = city">{{ city }}</button></div><div class="category-tabs"><button v-for="category in explore.categories" :key="category" :class="{ active: explore.activeCategory === category }" @click="explore.activeCategory = category">{{ category }}</button></div></div>
    <div class="map-panel"><div class="map-copy"><span class="eyebrow">GEOGRAPHY / NATIONAL SAMPLE</span><strong>建筑分布在<br>中原及周边山河之间</strong><span>{{ mapCities }}</span></div><div class="map-shape"><i v-for="building in explore.filteredBuildings" :key="building.id" class="map-dot" :style="{ left: `${((building.coordinates[0] - mapBounds.minLong) / Math.max(1, mapBounds.maxLong - mapBounds.minLong)) * 330 + 8}px`, top: `${((mapBounds.maxLat - building.coordinates[1]) / Math.max(1, mapBounds.maxLat - mapBounds.minLat)) * 170 + 15}px` }" :title="building.name" /></div><div class="map-legend"><span><i class="legend-dot" /> 已收录建筑</span><span>河南首发 · 周边扩展</span></div></div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:20px 0 18px;color:#968b7e;font-size:11px"><span>{{ explore.filteredBuildings.length }} 座建筑样本</span><span style="display:flex;align-items:center;gap:5px"><MapPin :size="13" /> 全国建筑图谱</span></div>
    <div class="building-grid"><RouterLink v-for="building in explore.filteredBuildings" :key="building.id" :to="`/buildings/${building.id}`" class="building-card"><div class="building-cover" :class="building.coverClass"><div class="cover-label"><strong>{{ building.name }}</strong><small>{{ building.pinyin }}</small></div></div><div class="building-body"><div class="card-meta"><span>{{ building.location }}</span><span>{{ building.era }}</span></div><h3>{{ building.category }}</h3><p>{{ building.summary }}</p><div class="card-footer"><span class="card-tag">{{ building.status }}</span><ArrowUpRight :size="16" color="#a73e32" /></div></div></RouterLink><div v-if="!explore.filteredBuildings.length" class="empty-state">没有找到匹配的建筑样本，请更换关键词或分类。</div></div>
  </div>
</template>
