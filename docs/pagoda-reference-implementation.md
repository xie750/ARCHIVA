# 开封铁塔样板页实施规范

这份文档把开封铁塔作为后续全国建筑页面的复用基线。样板页的目标是让用户在浏览器里获得接近现场的空间感，同时让模型来源、审核状态和版权边界可以被追踪。

## 当前交付状态

- 页面：`/buildings/kaifeng-iron-pagoda`
- 查看器：`frontend/src/components/three/BuildingViewer.vue`
- 资产清单：`frontend/public/models/kaifeng-iron-pagoda/manifest.json`
- 资产版本：`0.9.0-reconstruction`
- 当前资产：项目自建资料复原 GLB，包含 low、medium、high 三档 LOD；它是技术样板，不代表现场实测。
- 后续替换点：拿到有明确授权的摄影测量/激光扫描资产后，只需替换 manifest 中的 URL、版本状态、来源和许可字段，页面交互无需重写。

## 页面体验标准

1. 首屏直接看到塔体，默认使用整体形制视角；自动巡游只做轻微旋转，用户拖动后进入手动探索。
2. 视角菜单固定提供整体形制、构件细部、空间轴线、俯瞰关系四种阅读入口。
3. 热点必须对应可解释的建筑内容，至少覆盖主体形制、构件节点、材料或空间轴线。
4. 双击聚焦、滚轮缩放、线框、扫描辅助和沉浸式全屏属于通用能力，所有建筑页面复用同一套控件。
5. 真实 GLB 载入后隐藏程序化 fallback 和扫描光束；失败时保留 fallback，并在 HUD 明确显示失败状态。
6. 页面必须显示资产状态：`RECONSTRUCTION GLB` 表示资料复原，`REVIEWED GLB` 表示审核通过的可发布 GLB，`PLATFORM 3D` 表示只能通过原平台嵌入。
7. 点击“沉浸”不仅切换全屏，还会把镜头平滑推进到按模型包围盒计算的安全距离；退出时恢复原视角。容器尺寸变化由 `ResizeObserver` 立即同步到 WebGL，避免全屏后画布比例和镜头延迟更新。
   当前实现会先根据 GLB 的世界包围盒重新计算焦点、可视距离和控制器上下限，再进行轻微推进，保证高塔不会被裁切或偏到画布边缘。

## manifest 约定

```json
{
  "modelId": "kaifeng-iron-pagoda",
  "version": "0.9.0-reconstruction",
  "versionStatus": "TECHNICAL_REVIEW",
  "assetStatus": "资料复原样板 · 待授权实测扫描",
  "source": "来源与采集方式",
  "license": "授权范围或限制",
  "lod": [
    { "level": "low", "url": "...", "bytes": 0 },
    { "level": "medium", "url": "...", "bytes": 0 },
    { "level": "high", "url": "...", "bytes": 0 }
  ],
  "defaultCamera": { "position": [10, 7.5, 12.5], "target": [0, 3.6, 0], "fov": 34 },
  "hotspots": [],
  "components": []
}
```

浏览器根据连接状态和 `navigator.deviceMemory` 自动选择 LOD：省流量或 2G 选择 low，普通设备选择 medium，高内存设备选择 high。GLB、纹理、全景、音频和视频放在对象存储/CDN，SQLite 只保存清单、版权和内容元数据。

## 资产目录和命名

```text
frontend/public/models/<building-id>/
  manifest.json
  model-low.glb
  model-medium.glb
  model-high.glb
  textures/        # 有外部纹理时使用
  previews/        # 首屏缩略图、分享图
```

GLB 节点使用可读名称：`Building_Main`、`Floor_01`、`Eave_Band`、`Finial_Shaft`。热点和组件通过 manifest 维护，避免把讲解文案硬编码进模型文件。

## 真实资产替换流程

1. 取得建筑管理机构、测绘团队或模型作者的书面授权，记录允许的域名、用途、期限和署名要求。
2. 从原始扫描导出 glTF/GLB，清理不可见几何，保留构件节点，生成 low/medium/high 三档。
3. 在 `manifest.json` 填写采集方式、来源、许可、版本状态和文件大小；实测资产使用 `versionStatus: PUBLISHED` 前必须经过内容审核。
4. 把 `lod[].url` 指向对象存储/CDN，保留旧版本一段时间，便于回滚和审计。
5. 在本地用普通手机、桌面高配设备和慢网络分别验证首屏、加载失败降级、全屏、热点和版权说明。

## 复用到下一栋建筑

复制页面数据和 manifest，不复制 Three.js 场景代码。只需要提供 `kind`、资产清单、相机预设、热点、构件和内容来源；查看器的交互、加载、降级、全屏和 LOD 逻辑保持一致。程序化模型仅作为没有可发布资产时的明确 fallback，不能写成“实景扫描”。

## 景区与单体的统一入口

详情页统一采用“地图总览 → 选择节点 → 单体 3D”的三步流程，交互方式与龙门石窟保持一致：

- 多节点景区（例如龙门石窟、清明上河园）在地图上展示所有可进入节点。用户点击地图标记或下方节点信息后，进入所选空间的 3D 展示；返回按钮回到同一张地图，保留选中节点。
- 单体建筑（例如开封铁塔、黄鹤楼）也先显示一个地理位置点。它不伪装成“景区”，地图标题使用“位置总览”，用户确认位置后点击“进入 3D”，再进入该建筑的单体查看器。
- 数据层只需为单体生成一个 `ScenicPoint`；多节点场景继续在 `scenic.points` 中维护。这样地图组件、节点状态、移动端布局和埋点都可以复用。
- 选点进入 3D 后，模型页使用节点自己的 `modelKind`、来源和平台链接；没有独立资产时继承建筑级 manifest，仍然显示明确的来源和授权状态。

当前前端实现位于 `BuildingDetailPage.vue` 与 `ScenicOverview.vue`：所有有坐标的建筑均经过地图入口，清明上河园已配置上善门、虹桥水院、宋都街市等多个节点。

## 体验验收指标

- 首屏模型容器在桌面端高度不小于 470px，沉浸式模式占满视口。
- medium GLB 在普通桌面设备首屏可交互，加载进度可见；high 只在高内存设备或细节视角使用。
- 加载失败时 1 秒内回到 fallback 并给出可读提示，不出现空白画布。
- 任何发布资产都能从页面追溯到来源、许可、版本和 LOD 文件。

## 缩放响应与性能基线

- 普通首屏遵循 `textures.variants.desktop`，铁塔当前使用 medium；high 版本只在明确的细节入口使用，不能因为设备内存较大就默认加载。
- 运行时开启 `zoomToCursor`，提高 OrbitControls 的 `dampingFactor`，让滚轮和触控缩放更快收敛；沉浸式进入使用短距离相机过渡，不把“全屏”误认为“放大”。
- 建筑 GLB 的独立 mesh 数量应控制在约 320 个以内；超过该数量时关闭逐构件投射阴影，并把静态阴影图只更新一次。当前技术样板 high 约 980 个 mesh，因此 medium 是默认交互质量。
- 后续正式 high 资产应在导出阶段合并同材质几何、启用 Draco/Meshopt 压缩并保持组件节点；目标是在高细节入口仍保持可交互的滚轮响应。
- 交互性能：模型使用静态网格合批、设备像素比上限 1.5、高性能 WebGL 上下文；滚轮缩放启用 `zoomToCursor`，减少“滚轮已经动了但镜头还没跟上”的感觉。
- 取景稳定性：GLB 载入后按世界包围盒重新计算模型中心、包围球和相机安全距离；沉浸式全屏使用固定视口并重新同步画布宽高，避免高塔被裁切、偏到左侧或出现比例失真。
