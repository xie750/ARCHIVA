import type { Building } from '../types/building'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api'

export interface BuildingPageResponse { items: Building[]; page: number; size: number; total: number; totalPages: number }

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) throw new Error(`建筑接口请求失败：${response.status}`)
  return response.json() as Promise<T>
}

export const buildingApi = {
  list: (params = '') => request<BuildingPageResponse>(`/buildings${params}`),
  detail: (id: string) => request<Building>(`/buildings/${id}`),
  manifest: (id: string) => request<unknown>(`/buildings/${id}/model-manifest`),
}
