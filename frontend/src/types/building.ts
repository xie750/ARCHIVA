export type BuildingCategory = '石窟' | '寺观' | '城门' | '古塔' | '园林'

export interface BuildingMetric {
  label: string
  value: string
}

export interface BuildingSource {
  label: string
  href?: string
  kind: '官方资料' | '研究资料' | '项目记录'
}

export interface ScenicPoint {
  id: string
  name: string
  subtitle: string
  description: string
  position: [number, number]
  /** WGS84 coordinate in [longitude, latitude] order. Used by the live map. */
  coordinates?: [number, number]
  /** Official platform embed; the page must retain its author/attribution. */
  embedUrl?: string
  embedSource?: string
  /** Optional point-level asset overrides for multi-building scenic sites. */
  manifestUrl?: string
  assetUrl?: string
  /** Reuse the parent building model when this is a single-location overview point. */
  useParentModel?: boolean
  modelKind: Building['model']['kind']
  status: '重点展项' | '观景节点' | '历史路径'
}

export interface Building {
  id: string
  /** Region/province label used by the national archive filters. */
  region?: string
  name: string
  pinyin: string
  category: BuildingCategory
  era: string
  location: string
  coordinates: [number, number]
  period: string
  summary: string
  story: string
  coverClass: string
  accent: string
  metrics: BuildingMetric[]
  tags: string[]
  highlights: string[]
  sources?: BuildingSource[]
  scenic?: {
    title: string
    subtitle: string
    points: ScenicPoint[]
  }
  status: '已收录' | '持续研究'
  model: {
    kind: 'grotto' | 'temple' | 'gate' | 'pagoda' | 'garden' | 'street'
    version: string
    precision: string
    nodes: number
    /** Optional reviewed asset manifest. Empty until the source owner grants publication rights. */
    manifestUrl?: string
    assetUrl?: string
    embedUrl?: string
    source?: string
    license?: string
  }
}
