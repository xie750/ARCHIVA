import type { Building, ModelAssetStatus, ModelProvider } from '../types/building'

export interface Building3DAsset {
  provider: ModelProvider
  status: ModelAssetStatus
  embedUrl?: string
  sourceUrl?: string
  credit?: string
  license?: string
  precision?: string
  version?: string
  notes?: string
}

const sketchfabEmbed = (uid: string) =>
  `https://sketchfab.com/models/${uid}/embed?autostart=1&ui_theme=dark&dnt=1`

export const building3dAssets: Record<string, Building3DAsset> = {
  'beijing-forbidden-city': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-9822899',
    precision: '第三方 Sketchfab 模型嵌入 · 待官方授权复核',
    embedUrl: sketchfabEmbed('9822899391ae4bb2b50f150abfc68c78'),
    sourceUrl: 'https://sketchfab.com/3d-models/the-forbidden-city-in-beijing-9822899391ae4bb2b50f150abfc68c78',
    credit: 'eagleedny / Sketchfab',
    license: 'CC Attribution · 以 Sketchfab 原页面为准',
    notes: '匹配对象为北京故宫整体模型，适合先提升 3D 浏览入口观感。',
  },
  'tibet-potala-palace': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-ba531c1',
    precision: '第三方 Sketchfab 模型嵌入 · 待官方授权复核',
    embedUrl: sketchfabEmbed('ba531c182d0540e1929bee4ae6b92592'),
    sourceUrl: 'https://sketchfab.com/3d-models/potala-palace-fortress-tibet-ba531c182d0540e1929bee4ae6b92592',
    credit: 'LibanCiel / Sketchfab',
    license: '平台嵌入展示；下载与出版需另行授权',
    notes: '第三方公开模型，先用于互动预览，后续应替换或补充权威授权资产。',
  },
  'fujian-tulou': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-91c0c5b',
    precision: '第三方 Sketchfab 模型嵌入 · 待官方授权复核',
    embedUrl: sketchfabEmbed('91c0c5ba0848431893d3d33038cae2db'),
    sourceUrl: 'https://sketchfab.com/models/91c0c5ba0848431893d3d33038cae2db',
    credit: 'a18801053612 / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '匹配对象为福建土楼模型，先作为土楼类民居 3D 入口。',
  },
  'shanghai-shikumen': {
    provider: 'sketchfab',
    status: 'reference',
    version: 'sketchfab-45f6f25',
    precision: '第三方 Sketchfab 参考模型 · 石库门立面细部',
    embedUrl: sketchfabEmbed('45f6f25517eb4a6e8cbcc6b8c1a8be26'),
    sourceUrl: 'https://sketchfab.com/3d-models/architectural-elevation-shikumen-1-45f6f25517eb4a6e8cbcc6b8c1a8be26',
    credit: 'Tigershill / Sketchfab',
    license: 'NoAI · 以 Sketchfab 原页面为准',
    notes: '参考对象为上海静安张园石库门建筑细部，不声明为完整里弄街区实测资产。',
  },
  'jiangsu-suzhou-classical-gardens': {
    provider: 'sketchfab',
    status: 'reference',
    version: 'sketchfab-695e78a',
    precision: '第三方 Sketchfab 参考模型 · 非具体园林实测',
    embedUrl: sketchfabEmbed('695e78a7ccc945acbda9f9f20ef7dba3'),
    sourceUrl: 'https://sketchfab.com/3d-models/chinese-garden-695e78a7ccc945acbda9f9f20ef7dba3',
    credit: 'scottdeng / Sketchfab',
    license: 'CC Attribution · 以 Sketchfab 原页面为准',
    notes: '这是中式园林参考模型，不声明为苏州某一座园林的实测资产。',
  },
}

export function resolveModelMetadata(id: string, model: Building['model']): Building['model'] {
  const asset = building3dAssets[id]
  const inferredProvider: ModelProvider = model.embedUrl
    ? 'sketchfab'
    : model.manifestUrl || model.assetUrl
      ? 'local-glb'
      : 'pending'

  if (!asset) {
    return {
      ...model,
      provider: model.provider ?? inferredProvider,
      assetStatus: model.assetStatus ?? (inferredProvider === 'pending' ? 'pending' : 'matched'),
    }
  }

  return {
    ...model,
    provider: asset.provider,
    assetStatus: asset.status,
    version: asset.version ?? model.version,
    precision: asset.precision ?? model.precision,
    embedUrl: asset.embedUrl ?? model.embedUrl,
    sourceUrl: asset.sourceUrl ?? model.sourceUrl,
    credit: asset.credit ?? model.credit,
    source: asset.notes ? `${asset.credit ?? '第三方模型'} · ${asset.notes}` : (asset.credit ?? model.source),
    license: asset.license ?? model.license,
  }
}
