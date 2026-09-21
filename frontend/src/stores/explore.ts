import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { buildings } from '../data/buildings'
import type { BuildingCategory } from '../types/building'

export const useExploreStore = defineStore('explore', () => {
  const query = ref('')
  const activeCategory = ref<'全部' | BuildingCategory>('全部')
  const categories = ['全部', ...new Set(buildings.map((item) => item.category))] as ('全部' | BuildingCategory)[]

  const filteredBuildings = computed(() => buildings.filter((building) => {
    const matchesCategory = activeCategory.value === '全部' || building.category === activeCategory.value
    const normalizedQuery = query.value.trim().toLowerCase()
    const matchesQuery = !normalizedQuery || [building.name, building.pinyin, building.location, ...building.tags].join(' ').toLowerCase().includes(normalizedQuery)
    return matchesCategory && matchesQuery
  }))

  return { query, activeCategory, categories, filteredBuildings }
})
