import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { buildings } from '../data/buildings'
import type { BuildingCategory } from '../types/building'

export const useExploreStore = defineStore('explore', () => {
  const query = ref('')
  const activeCategory = ref<'全部' | BuildingCategory>('全部')
  const categories = ['全部', ...new Set(buildings.map((item) => item.category))] as ('全部' | BuildingCategory)[]
  const regions = computed(() => Array.from(new Set(buildings.map((item) => item.region ?? '未分区'))))
  const activeRegion = ref<'全部' | string>('全部')
  const activeCity = ref<'全部' | string>('全部')
  const cities = computed(() => Array.from(new Set(buildings.filter((item) => activeRegion.value === '全部' || (item.region ?? '未分区') === activeRegion.value).map((item) => item.location.split(' · ')[0]))))

  const filteredBuildings = computed(() => buildings.filter((building) => {
    const matchesCategory = activeCategory.value === '全部' || building.category === activeCategory.value
    const matchesRegion = activeRegion.value === '全部' || (building.region ?? '未分区') === activeRegion.value
    const matchesCity = activeCity.value === '全部' || building.location.split(' · ')[0] === activeCity.value
    const normalizedQuery = query.value.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || [building.name, building.pinyin, building.location, ...building.tags].join(' ').toLowerCase().includes(normalizedQuery)
    return matchesCategory && matchesRegion && matchesCity && matchesQuery
  }))

  return { query, activeCategory, categories, regions, activeRegion, cities, activeCity, filteredBuildings }
})
