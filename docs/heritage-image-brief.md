# 建筑图像生成与接入方案

状态：生成方案已准备；当前会话没有可调用的内置 image_gen，尚未生成或接入图片。API 路径需用户选择并在本机配置 OPENAI_API_KEY。不得把下列方案或任何占位图作为已生成结果。

## 视觉方向

采用建筑杂志中的自然摄影质感：真实材质、自然光、细微颗粒、低饱和石灰色与赭褐色，植被和阴影适度偏黛青，与平台墨蓝、暖金、玉青协调。历史感来自石材风化、砖瓦、木构与环境，不依赖重度泛黄、虚构古代人物或奇幻建筑。生成图作为策展视觉，不能标成历史照片或测绘依据。

## 素材与使用位置

所有图独立生成，建议 1536 × 1024；最终检查并压缩为 WebP，保留原图。输出位置为 `frontend/public/images/heritage/`。本方案没有创建这些尚不存在的图片引用。

| 文件 | 主体 | 页面用途 | 构图和裁切 |
| --- | --- | --- | --- |
| hero-longmen.webp | 龙门石窟卢舍那像与崖壁细节 | 首页右侧主视觉 | 主体居中，面部和石壁细节保持完整，边缘可裁切 |
| longmen.webp | 奉先寺石窟群 | 首页精选、龙门卡片与详情 | 宽景；主造像和崖壁在中部，底部供文字蒙层 |
| shaolin.webp | 少林寺院落与山门 | 少林寺卡片与详情 | 自然人眼视角，保留屋檐和院落 |
| iron-pagoda.webp | 开封铁塔 | 铁塔卡片与详情 | 十三层八角琉璃砖塔，完整入画；详情裁切避免截断塔顶 |
| yingtian-gate.webp | 应天门当代遗址展示建筑 | 应天门卡片与详情 | 表现现存复原展示建筑，不虚构唐代现场 |
| qingming-garden.webp | 清明上河园虹桥水院 | 园林卡片与详情 | 以木拱桥、河道、沿岸街屋构图，承认是当代宋风景区 |

## 最终提示词

每张采用对应提示词，独立调用生成；通用约束一并附上。

### 通用约束

Use case: photorealistic-natural.
Style/medium: restrained editorial architectural photography for a Chinese architecture atlas; natural perspective, plausible construction, weathered material detail, subtle fine film grain, quiet atmosphere.
Color palette: low-saturation limestone grey, weathered ochre and brown; muted jade foliage, deep blue-green shadows, gentle warm daylight. Preserve believable material colors.
Constraints: no text, captions, logo or watermark; no invented inscriptions; no fantasy buildings, duplicated architectural elements, neon, glowing outlines, plastic CGI surfaces, exaggerated HDR, dramatic orange-teal grading, heavy sepia, artificial light rays or staged historical characters. Keep geometry and lighting coherent. This is a generated editorial interpretation, not an archival photograph or archaeological reconstruction.

### 1. 首页主视觉

Asset type: landscape homepage hero, 3:2.
Subject: a restrained, close architectural study of the monumental seated Vairocana Buddha at Fengxian Temple, Longmen Grottoes, Luoyang. Frame the recognisable calm face, upper torso and surrounding weathered limestone cliff together. Respect the sculpture's existing shape and natural erosion; do not invent ornament or restore missing details into a pristine statue.
Composition: the face and torso sit within the central crop-safe area; enough surrounding cliff to convey scale, breathing room at the edges. No superimposed objects or montage.
Lighting: soft overcast daylight, gentle warm reflected stone light, natural dark cavities. Tactile stone rather than glossy rendering.

### 2. 龙门石窟

Asset type: landscape building cover, 3:2.
Subject: a wide contextual view of the open-air Fengxian Temple niche at Longmen Grottoes, with the monumental seated central Buddha, surrounding attendant carvings and worn limestone cliff. Convey the tangible weight and scale of the cliff-carved ensemble.
Composition: a plausible ground-level architectural viewpoint; keep the main statues within the central area, retain a darker natural foreground in the lower fifth for page typography. Avoid artificially symmetrical repetition or invented temple roofs.
Lighting: soft natural daylight and shallow atmospheric depth; restrained contrast and believable grey-beige stone.

### 3. 嵩山少林寺

Asset type: landscape building cover, 3:2.
Subject: Shaolin Temple's quiet courtyard architecture beneath Songshan, with grey tiled eaves, worn red walls, aged timber and stone paving, framed by mature trees. Show an existing temple environment rather than a fantasy palace or film set.
Composition: human-height, slightly oblique view, layered rooflines and a courtyard path creating depth. Keep roof geometry clear; avoid legible signs and invented calligraphy.
Lighting: soft morning daylight, restrained olive-jade vegetation, warm grey stone, modest shadow contrast.

### 4. 开封铁塔

Asset type: landscape building cover, 3:2.
Subject: the Iron Pagoda of Kaifeng, a slender thirteen-storey octagonal pagoda built of weathered iron-brown glazed bricks, with closely spaced projecting eaves. It is glazed brick, not exposed metal, a wooden pavilion tower, or a five-storey pagoda. Preserve the recognisable tapering proportions and all thirteen storeys.
Composition: complete tower from base to finial in the central area, enough sky above and breathing room to both sides, quiet park trees for scale. Natural mildly upward camera angle with controlled vertical perspective.
Lighting: diffused daylight; brown glaze with restrained highlights and visible age, muted grey-green surroundings.

### 5. 应天门遗址

Asset type: landscape building cover, 3:2.
Subject: the present-day Yingtian Gate archaeological-site exhibition and reconstructed gateway complex in Luoyang, with its monumental red walls, raised gateways and layered traditional rooflines. Depict the contemporary site presentation inspired by Sui-Tang architecture, not a fabricated photograph of the Tang dynasty.
Composition: broad oblique architectural view with clear hierarchy and plausible connections between the main gate and side structures. Keep the gateway in the central region; quiet foreground, no crowds, signage or dramatic festival installations.
Lighting: calm late-afternoon daylight, subdued vermilion, grey roof surfaces and softly warm stone. Avoid theatrical illumination or an imperial-palace collage.

### 6. 清明上河园

Asset type: landscape building cover, 3:2.
Subject: the Rainbow Bridge and waterside buildings at the present-day Qingming Riverside Landscape Garden in Kaifeng, a contemporary scenic park interpreting the Song-dynasty scroll. Show an arched timber bridge, calm water, tiled waterfront houses and modest willow foliage. Do not portray it as a surviving untouched Song-dynasty city.
Composition: natural view from the riverbank; bridge and connected bank form the main structure, believable reflections and building scale, uncluttered lower foreground for the page overlay.
Lighting: gentle overcast daylight, muted jade water, warm weathered timber and grey-brown tiles; no lantern spectacle, fantasy skyline or costumed crowds.

## 接入与检查

1. 逐张检查建筑识别、铁塔层数、材料和结构；存在明显错形的结果重新生成，不仅用调色遮盖。
2. 将合格图片存入项目；保存生成方式、提示词、日期和需要的说明，不依赖外部临时路径。
3. 首页以真实 `<img>` 替换 `.hero-sculpture`；精选、探索卡片、详情分别读取各建筑图片及焦点位置。
4. Hero 优先加载，卡片延迟加载；填写具体 alt；用轻薄深色蒙层保证文字可读，避免用重渐变覆盖主体。
5. 检查桌面和移动端的 object-fit/object-position，尤其是佛像面部、塔顶、屋檐和桥拱。
6. 资料说明明确为生成的策展视觉，不将生成图当作实景扫描或历史证据。地图点位和 3D 操作控件保持其功能。
7. 接入完成后运行前端构建并浏览验证首页、探索页与详情页。
