# 工程架构约定

## 前端

```text
src/
├── components/     可复用 UI 与 3D 领域组件
├── data/           出版 Demo 的静态内容适配层
├── layouts/        全局壳层与导航
├── pages/          路由页面，只负责组合领域组件
├── router/         路由配置
├── services/       HTTP/API 适配层
├── stores/         Pinia 状态与筛选用例
├── types/          前端领域类型
└── assets/         全局视觉样式
```

页面不直接拼接 API 请求；3D 组件不读取路由和业务数据，只接收建筑模型类型或 manifest。正式接入后，将 `data/buildings.ts` 替换为 `services/buildingApi.ts` 的响应适配，不改变页面结构。

## 后端

后端采用模块化单体，模块内部保持 `Controller → Service → Repository` 的依赖方向。Controller 只负责 HTTP 参数和 DTO，Service 编排用例，Repository 隔离数据源，领域对象不依赖 Web 层。模型二进制通过对象存储/CDN 分发，Java 只返回 manifest 和签名 URL。

公共接口使用 `/api/v1` 版本前缀，建筑数据以 region/province、city、type、dynasty 标签组织。河南只是当前内容分区，后续新增省份时只扩充数据和筛选条件，不在页面组件中写死地区。

## 景区级 3D 体验

景区数据按 `Site → PanoramaNode → PoiPoint → ModelScene` 组织：先进入景区总览地图，再点击 POI 进入 360 全景节点，最后进入某个标志性建筑的 Three.js 单体 3D。前端分别使用 `ScenicOverview`、全景查看器和 `BuildingViewer`，不把 Cesium/Three 强行混在同一个 Canvas 中。

推荐的零成本开源组合：

- 景区总览和多建筑大场景：CesiumJS + OGC 3D Tiles；只做轻量二维时可用 MapLibre + 自托管 PMTiles。
- 360 全景：MVP 用 Pannellum，出版级多分辨率瓦片用 Marzipano。
- 单体建筑：Three.js + GLB/glTF，Draco/Meshopt + KTX2 + LOD。
- 实景扫描补充：COLMAP/Meshroom 生成摄影测量资产，Blender 清理后导出 GLB；点云可选 Potree。

外部服务不是“真实感”的必要条件。CesiumJS、Three.js、Pannellum、Marzipano、MapLibre 都可自托管，真正需要授权的是图片、全景、模型和地图数据。生产环境不要直接高频抓取公共 OSM 瓦片，建议自托管合规底图并保留署名；景区全景和模型优先使用自制或明确授权素材。

## 质量基线

- 命名表达业务含义，避免在页面和控制器中使用“万能工具类”。
- 内容、模型版本、来源和授权信息必须有独立字段。
- 3D 组件必须支持低模优先、错误降级和无 WebGL 时的静态预览。
- 建筑数据正式上线前需替换示例图片、模型 URL 和示例资料为已授权素材。
