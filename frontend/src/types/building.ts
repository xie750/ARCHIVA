export type BuildingCategory =
  | '石窟'
  | '寺观'
  | '城门'
  | '古塔'
  | '楼阁'
  | '园林'
  | '民居'
  | '公共建筑'
  | '宫殿'
  | '桥梁'

export interface BuildingMetric {
  label: string
  value: string
}

export interface BuildingSource {
  label: string
  href?: string
  kind: '官方资料' | '研究资料' | '项目记录'
}

export interface BuildingImage {
  src: string
  alt: string
  credit: string
  license: string
  sourceUrl: string
  position?: string
}

export type ModelProvider = 'local-glb' | 'sketchfab' | 'model-viewer' | 'cesium' | 'pending'
export type ModelAssetStatus = 'published' | 'matched' | 'reference' | 'pending' | 'failed'

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
  provider?: ModelProvider
  assetStatus?: ModelAssetStatus
  sourceUrl?: string
  credit?: string
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
  image?: BuildingImage
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
    kind: 'grotto' | 'temple' | 'gate' | 'pagoda' | 'pavilion' | 'garden' | 'street'
    version: string
    precision: string
    nodes: number
    provider?: ModelProvider
    assetStatus?: ModelAssetStatus
    /** Optional reviewed asset manifest. Empty until the source owner grants publication rights. */
    manifestUrl?: string
    assetUrl?: string
    embedUrl?: string
    sourceUrl?: string
    credit?: string
    source?: string
    license?: string
  }
}
