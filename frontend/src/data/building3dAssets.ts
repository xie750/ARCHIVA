import type { Building, ModelAssetStatus, ModelProvider } from '../types/building'

export interface Building3DAsset {
  provider: ModelProvider
  status: ModelAssetStatus
  assetUrl?: string
  manifestUrl?: string
  embedUrl?: string
  sourceUrl?: string
  credit?: string
  /** External platform search/candidate page. This is intentionally not an embed URL. */
  candidateUrl?: string
  license?: string
  precision?: string
  version?: string
  notes?: string
}

const sketchfabEmbed = (uid: string) =>
  `https://sketchfab.com/models/${uid}/embed?autostart=1&preload=1&ui_theme=dark&ui_infos=0&dnt=1`

const sketchfabSearch = (query: string) =>
  `https://sketchfab.com/search?type=models&q=${encodeURIComponent(query)}`

/** Search is only a discovery link. It is never used as an iframe source. */
export const modelCandidateUrl = (label: string) => {
  const query = label.trim() || '建筑模型'
  return sketchfabSearch(query)
}

const pendingAsset = (label: string): Building3DAsset => {
  return {
    provider: 'pending',
    status: 'pending',
    version: 'external-search-pending',
    precision: '第三方平台专属模型待核验',
    candidateUrl: modelCandidateUrl(label),
    license: '未确认对应模型前不声明模型授权',
    notes: `${label} 尚未确认与建筑名称、位置一致的第三方模型；页面不会加载其他建筑模型。`,
  }
}

/**
 * Keep every catalog entry explicit even while its dedicated external model
 * is being curated. The label is used for the platform search link and keeps
 * the UI readable; it is never promoted to an iframe by itself.
 */
const pendingExternalModels: Record<string, string> = {
  'kaifeng-iron-pagoda': '开封铁塔',
  'yingtian-gate': '洛阳应天门遗址',
  'qingming-riverside-garden': '开封清明上河园',
  'shanhaiguan-first-pass': '山海关天下第一关',
  'anhui-hongcun-village': '安徽宏村',
  'tianjin-wudadao': '天津五大道历史建筑群',
  'jiangsu-suzhou-classical-gardens': '苏州古典园林',
  'zhejiang-tianyige': '宁波天一阁',
  'guangxi-chengyang-wind-rain-bridge': '广西程阳风雨桥',
  'hainan-haikou-qilou': '海口骑楼老街',
  'sichuan-dujiangyan': '四川都江堰水利工程',
  'guizhou-zhaoxing-dong-village': '贵州肇兴侗寨鼓楼群',
  'yunnan-lijiang-old-town': '云南丽江古城',
  'qinghai-kumbum-monastery': '青海塔尔寺',
  'ningxia-western-xia-mausoleums': '宁夏西夏陵',
  'xinjiang-kashgar-old-city': '新疆喀什古城',
  'inner-mongolia-wudangzhao': '内蒙古五当召',
  'liaoning-shenyang-imperial-palace': '沈阳故宫',
  'jilin-puppet-palace': '长春伪满皇宫',
  'taiwan-lungshan-temple': '台北艋舺龙山寺',
}

export const building3dAssets: Record<string, Building3DAsset> = {
  'longmen-grottoes': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-300cedb',
    precision: '第三方 Sketchfab 模型嵌入 · 待官方授权复核',
    embedUrl: sketchfabEmbed('300cedb03eb4494991d34acebf91eda0'),
    sourceUrl: 'https://sketchfab.com/models/300cedb03eb4494991d34acebf91eda0',
    credit: 'LibanCiel / Sketchfab',
    license: '平台嵌入展示；下载与出版需另行授权',
    notes: '龙门石窟第三方公开模型，作为外部平台预览入口；不声明为官方实测资产。',
  },
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
  'qufu-confucius-temple': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-d1873dc',
    precision: '第三方 Sketchfab 模型嵌入 · 曲阜孔庙大成殿',
    embedUrl: sketchfabEmbed('d1873dc1292342f3ba5f4f18332bd536'),
    sourceUrl: 'https://sketchfab.com/models/d1873dc1292342f3ba5f4f18332bd536',
    credit: 'dablive / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应曲阜孔庙大成殿；仅用于该建筑条目。',
  },
  'shaolin-temple': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-d9b1b26',
    precision: '第三方 Sketchfab 模型嵌入 · Shaolin Monastery',
    embedUrl: sketchfabEmbed('d9b1b263acef43aabadef1bab90c1b04'),
    sourceUrl: 'https://sketchfab.com/models/d9b1b263acef43aabadef1bab90c1b04',
    credit: 'northwestofrussia / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应少林寺；仅用于嵩山少林寺条目。',
  },
  'guangdong-chen-clan-academy': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-0b1a889',
    precision: '第三方 Sketchfab 模型嵌入 · 陈家祠',
    embedUrl: sketchfabEmbed('0b1a889fd16c4c2e930923eb1dc2bea4'),
    sourceUrl: 'https://sketchfab.com/models/0b1a889fd16c4c2e930923eb1dc2bea4',
    credit: 'ldaa / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应广州陈家祠；仅用于该建筑条目。',
  },
  'wuhan-yellow-crane-tower': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-8d56b5d',
    precision: '第三方 Sketchfab 模型嵌入 · 黄鹤楼',
    embedUrl: sketchfabEmbed('8d56b5d7f23246be91da35b7a33328fe'),
    sourceUrl: 'https://sketchfab.com/models/8d56b5d7f23246be91da35b7a33328fe',
    credit: 'CUNO / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应黄鹤楼；仅用于该建筑条目。',
  },
  'jiangxi-tengwang-pavilion': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-70b1848',
    precision: '第三方 Sketchfab 模型嵌入 · 滕王阁',
    embedUrl: sketchfabEmbed('70b18484a98741bc8022fdcbe8049ae0'),
    sourceUrl: 'https://sketchfab.com/models/70b18484a98741bc8022fdcbe8049ae0',
    credit: 'CUNO / Sketchfab',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '模型标题明确对应滕王阁；仅用于该建筑条目。',
  },
  'hunan-yueyang-tower': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-e5858f7',
    precision: '第三方 Sketchfab 模型嵌入 · 建筑名称匹配，待授权复核',
    embedUrl: sketchfabEmbed('e5858f72736b4c8198700989c11b8953'),
    sourceUrl: 'https://sketchfab.com/3d-models/none-e5858f72736b4c8198700989c11b8953',
    credit: 'Sketchfab 模型页 · 作者 L1ttl3M00nCh1ld',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '平台模型名称为 Yueyang Tower，先作为岳阳楼外部交互预览。',
  },
  'yingxian-wooden-pagoda': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-5557386',
    precision: '第三方 Sketchfab 模型嵌入 · Yingxian Wooden Pagoda Virtual 3D Model',
    embedUrl: sketchfabEmbed('555738658d654e679dfbc67d2dc03431'),
    sourceUrl: 'https://sketchfab.com/models/555738658d654e679dfbc67d2dc03431',
    credit: 'HoneyBadger1487 / Sketchfab',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '模型标题明确为 Yingxian Wooden Pagoda Virtual 3D Model；仅用于应县木塔。',
  },
  'xian-big-wild-goose-pagoda': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-0f669b9',
    precision: '第三方 Sketchfab 模型嵌入 · Giant Wild Goose Pagoda',
    embedUrl: sketchfabEmbed('0f669b923c7c4ec98a699ff9342f017d'),
    sourceUrl: 'https://sketchfab.com/models/0f669b923c7c4ec98a699ff9342f017d',
    credit: 'Mesheritage / Sketchfab',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '模型标题和说明明确对应西安大雁塔；模型由无人机视频生成，仅用于该建筑条目。',
  },
  'heilongjiang-saint-sophia': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-31296d7',
    precision: '第三方 Sketchfab 模型嵌入 · 建筑名称匹配，待授权复核',
    embedUrl: sketchfabEmbed('31296d74280c49e0bcbc13a9d988289c'),
    sourceUrl: 'https://sketchfab.com/3d-models/none-31296d74280c49e0bcbc13a9d988289c',
    credit: 'Sketchfab 模型页 · 作者信息待补充',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '平台模型名称与哈尔滨圣索菲亚教堂匹配，作为外部交互预览。',
  },
  'gansu-jiayuguan-pass': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-88319c6',
    precision: '第三方 Sketchfab 模型嵌入 · 嘉峪关',
    embedUrl: sketchfabEmbed('88319c6d0d5e4afe995ede4f0623deed'),
    sourceUrl: 'https://sketchfab.com/models/88319c6d0d5e4afe995ede4f0623deed',
    credit: 'biluoke / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应嘉峪关；仅用于该建筑条目。',
  },
  'macau-ruins-of-saint-paul': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-42fc133',
    precision: '第三方 Sketchfab 模型嵌入 · 大三巴牌坊',
    embedUrl: sketchfabEmbed('42fc133e9cea4e3b9135a95b52d27932'),
    sourceUrl: 'https://sketchfab.com/models/42fc133e9cea4e3b9135a95b52d27932',
    credit: 'annika_yuu / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应大三巴牌坊；仅用于该建筑条目。',
  },
  'hong-kong-tai-kwun': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-604ac42',
    precision: '第三方 Sketchfab 模型嵌入 · 香港大馆',
    embedUrl: sketchfabEmbed('604ac42fc0944184b49f785be477270b'),
    sourceUrl: 'https://sketchfab.com/models/604ac42fc0944184b49f785be477270b',
    credit: 'Patrick Kin Yu YOUNG / Sketchfab',
    license: '以 Sketchfab 原页面为准',
    notes: '模型标题明确对应 Tai Kwun 大馆；仅用于该建筑条目。',
  },
  'shanghai-shikumen': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-c2db40d',
    precision: '第三方 Sketchfab 模型嵌入 · Shikumen, Shanghai',
    embedUrl: sketchfabEmbed('c2db40dca0134cedbf81fbd8e474f468'),
    sourceUrl: 'https://sketchfab.com/models/c2db40dca0134cedbf81fbd8e474f468',
    credit: 'okotaru / Sketchfab',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '模型标题和说明明确对应上海石库门建筑类型；仅用于上海石库门条目。',
  },
  'chongqing-hongyadong': {
    provider: 'sketchfab',
    status: 'matched',
    version: 'sketchfab-155183c',
    precision: '第三方 Sketchfab 模型嵌入 · 25x40 洪崖洞',
    embedUrl: sketchfabEmbed('155183c96bd145e2a1a968fa785e22c8'),
    sourceUrl: 'https://sketchfab.com/models/155183c96bd145e2a1a968fa785e22c8',
    credit: 'yyb666 / Sketchfab',
    license: '以 Sketchfab 原页面为准；正式出版需另行核验授权',
    notes: '模型标题明确包含洪崖洞；仅用于重庆洪崖洞吊脚楼街区条目。',
  },
  'guangxi-chengyang-wind-rain-bridge': {
    provider: 'local-glb',
    status: 'published',
    version: 'project-chengyang-bridge-1.0',
    precision: '项目专属形制模型 · 程阳风雨桥木构廊桥',
    assetUrl: '/models/chengyang-wind-rain-bridge/model-high.glb',
    sourceUrl: '/models/chengyang-wind-rain-bridge/model-high.glb',
    credit: 'Architecture Atlas 项目专属模型',
    license: '项目展示模型；不可据此主张现场测绘精度',
    notes: '公开第三方平台未找到程阳风雨桥专属模型，已按程阳永济桥的木构廊桥、桥亭和石墩形制制作独立展示模型；不会加载其他建筑。',
  },
}

for (const [id, label] of Object.entries(pendingExternalModels)) {
  if (!building3dAssets[id]) building3dAssets[id] = pendingAsset(label)
}

export function resolveModelMetadata(id: string, model: Building['model']): Building['model'] {
  // Unknown IDs remain honest. A search link is useful for curation, but a
  // search result must never be promoted to an iframe for a different site.
  const asset = building3dAssets[id] ?? pendingAsset(id.replace(/[-_]+/g, ' '))
  const usesLocalAsset = asset.provider === 'local-glb'
  return {
    ...model,
    provider: asset.provider,
    assetStatus: asset.status,
    version: asset.version ?? model.version,
    precision: asset.precision ?? model.precision,
    assetUrl: asset.assetUrl,
    manifestUrl: asset.manifestUrl,
    embedUrl: asset.embedUrl,
    sourceUrl: asset.sourceUrl ?? model.sourceUrl,
    credit: asset.credit ?? model.credit,
    candidateUrl: asset.candidateUrl ?? model.candidateUrl,
    source: asset.notes ? (asset.provider === 'pending' ? asset.notes : `${asset.credit ?? '第三方模型'} · ${asset.notes}`) : (asset.credit ?? model.source),
    license: asset.license ?? model.license,
    // Once an external platform record exists, never silently fall back to a
    // repository GLB. Pending records intentionally render no iframe until an
    // exact embed URL is reviewed.
    ...(!usesLocalAsset ? { manifestUrl: undefined, assetUrl: undefined } : {}),
  }
}
