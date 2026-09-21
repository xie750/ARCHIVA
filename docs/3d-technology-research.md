# 景区级 3D 技术调研

## 结论

先做“三层体验”，既能把现场感做出来，又不被单一引擎锁死：

```text
景区总览地图 / Cesium 或 MapLibre
        ↓ POI
360 全景节点 / Pannellum 或 Marzipano
        ↓ 标志性建筑
单体高精度模型 / Three.js + GLB
```

CesiumJS 适合景区边界、地形、路线、点位和多建筑 3D Tiles；Three.js 适合单体建筑的构件、剖切、热点和科技 HUD。不要把两个引擎强行放在一个 Canvas 里，采用页面/组件切换可以降低包体和生命周期复杂度。

## “在现场一样”的实现条件

仅靠地图或程序化模型不能得到真实现场感。需要至少一种真实资产：

1. 授权的 360°全景照片，多节点之间配置相邻关系和热点；
2. 摄影测量或激光扫描生成的网格/点云；
3. 有明确测绘依据的复原模型和实景照片。

因此 Demo 可以先使用程序化景区图和占位热点验证交互，正式版再替换为自制/授权的全景瓦片与 GLB。3D Gaussian Splatting 可以作为后期照片级实验能力，但采集、移动端性能和模型许可仍不稳定，不建议作为一期唯一链路。

## 零成本与许可

Three.js（MIT）、CesiumJS（Apache-2.0）、MapLibre GL JS（BSD-2-Clause）、Pannellum（MIT）、Marzipano（Apache-2.0）都可以自托管。引擎开源不代表建筑素材自动可用，龙门石窟照片、全景、模型需要单独记录作者、采集方式、授权范围和版本。

公共 OSM 瓦片服务器不适合批量抓取、预取和离线归档。出版/生产环境应使用自托管 OSM/OpenMapTiles/PMTiles 或已授权的地图服务，并展示数据署名和必要的坐标/地图合规信息。

## 推荐数据接口

```text
GET /api/v1/sites/{siteId}/overview
GET /api/v1/sites/{siteId}/panorama-nodes/{nodeId}
GET /api/v1/sites/{siteId}/poi/{poiId}/scene
```

`overview` 返回景区边界、中心点、总览 tileset、全景节点和 POI；`panorama-node` 返回多分辨率全景、朝向、FOV、相邻节点和热点；`scene` 返回模型 manifest。河南是首个 region，全国扩展时只新增 Site/POI/模型数据。

## 近期可用的开源实现与公开资源

以下项目均可自托管，使用前仍要在仓库中锁定版本并保存对应许可证文件：

| 能力 | 项目 | 许可证/限制 | 适合本 Demo 的用法 |
|---|---|---|---|
| 地球/地形/3D Tiles | [CesiumJS](https://github.com/CesiumGS/cesium) | Apache-2.0；Cesium ion 的地形、影像和配额是单独的服务条款，不能假定完全免费 | 河南景区总览、地形、路线、多个建筑的 3D Tiles |
| 轻量二维地图 | [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-2-Clause；底图瓦片的版权和配额由数据服务商决定 | MVP 地图和 POI，配合自托管 PMTiles/OpenMapTiles |
| 360°全景 | [Marzipano](https://github.com/google/marzipano) | Apache-2.0；全景照片本身的版权独立 | 现场节点、视角跳转、热点标记、多分辨率 tile |
| 360°全景备选 | [Pannellum](https://github.com/mpetroff/pannellum) | MIT；全景照片本身的版权独立 | 更轻量的单节点全景查看器 |
| 单体建筑 | [Three.js](https://github.com/mrdoob/three.js) | MIT；模型/纹理版权独立 | GLB/glTF 的材质、构件热点、剖切和 HUD |
| 点云 | [Potree](https://github.com/potree/potree) | 仓库许可证需随版本核验；点云数据另行授权 | 激光扫描或摄影测量点云的局部展示 |
| Gaussian Splatting | [GaussianSplats3D](https://github.com/mkkellogg/GaussianSplats3D) | MIT；训练图片与生成数据需要授权 | 后期照片级实验入口，需提供 WebGL/WebGPU 降级 |
| Gaussian Splatting 轻量实现 | [antimatter15/splat](https://github.com/antimatter15/splat) | MIT；示例数据不等于可商用数据 | 技术验证，不建议直接作为出版素材 |
| glTF 示例模型 | [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets) | 每个样例目录的许可证可能不同，逐项核验 | 验证加载器、材质、动画和压缩链路，不冒充河南实景 |

### 零成本的可落地路线

1. **总览图**：MVP 先用 MapLibre + 自托管静态 GeoJSON/PMTiles；开发阶段可以使用少量、带署名的 OSM 瓦片，不抓取、不预取、不做离线镜像。正式出版时改为自托管底图或已授权的服务。
2. **现场感**：使用自采的全景照片或取得景区书面授权的照片，离线切成 Marzipano/Pannellum 多分辨率 tile，放入仓库对象存储，前端只请求当前视口层级。
3. **真实模型**：用手机/相机环拍，在本地执行摄影测量，Blender 清理后导出 GLB；用 Draco/Meshopt、KTX2、LOD 压缩。模型的采集者、日期、精度、处理软件和授权写入 `source_reference` 与 manifest。
4. **照片级实验**：对同一批自采图像离线训练 Gaussian Splatting，输出 `.splat`/`.ksplat`。仅在支持的设备中展示，低端设备返回 GLB 或全景降级；不要依赖不明来源的在线 splat。
5. **数据契约**：先固定 `Site → PanoramaNode → PoiPoint → ModelScene`，新增河南景区或全国景区只新增数据和资产，不复制前端页面。

### 真实感与性能门槛

- 首屏先显示静态封面或低清全景；高分辨率全景、GLB、点云和 splat 均延迟加载。
- 单体 GLB 的首屏传输目标约 10–30 MB；纹理优先 KTX2，节点和材质按 LOD 拆分，移动端目标 draw call 小于 200。
- 全景采用立方体/多面体 tile 而不是一张超大 JPEG；限制初始 FOV，并在相邻节点预取缩略层。
- Gaussian Splatting 的显存占用与排序开销明显高于普通 GLB，必须有设备检测、最大 splat 数和清晰的 GLB/全景降级路径。
- Cesium 的地形和 3D Tiles 要限制屏幕空间误差、最大同时加载瓦片数和相机范围；不要在同一页面同时常驻 Cesium、Three、全景三个 WebGL 渲染器。

### 版权、地图和出版风险

- 开源引擎许可证只覆盖代码，不覆盖龙门石窟照片、360°全景、摄影测量网格、点云、splat 或建筑纹理。每个文件须保存作者、来源 URL、采集/授权范围、署名文本、版本和下线日期。
- OSM 数据遵循 ODbL，需要署名并履行相应数据库共享义务；公共 `tile.openstreetmap.org` 服务不适合生产抓取、批量预取和离线归档。
- Cesium ion 的全球底图/地形常需 token、配额与服务条款；零成本 Demo 可以使用试用额度，但出版部署要准备自托管或正式授权方案。
- 中国公开地图应在上线前核验地图服务授权、坐标系转换（WGS84/GCJ-02 等）以及适用的审图/备案要求。坐标转换不能替代地图内容合规。
