# 3D 真实感与资产生产路线

## 当前结论

开封铁塔页面能够成功加载 GLB，但当前 GLB 是程序化复原样板，不是现场实测资产。模型由 `frontend/scripts/generate-kaifeng-pagoda-assets.mjs` 使用 BoxGeometry、CylinderGeometry、ConeGeometry 和 SphereGeometry 按比例参数生成。

`frontend/public/models/kaifeng-iron-pagoda/manifest.json` 已明确标注：

- `assetStatus`: 资料复原样板 · 待授权实测扫描
- `source`: 基于公开形制资料与比例参数，不代表现场测绘
- `versionStatus`: TECHNICAL_REVIEW

三个 LOD 文件都没有图像纹理。当前模型的主要作用是验证地图进入、单体查看、相机、热点和 LOD 流程，不能代表现场级视觉效果。

## 为什么不像实地

当前资产缺少现场扫描几何、砖雕和构件细节、砖面风化与裂纹、法线和 AO 纹理、真实地面与周边环境，以及经过现场校准的光照和阴影。Three.js、相机距离和全屏布局只能正确显示已有资产，不能从简化几何推导出真实建筑表面。

## 达到现场感所需的资产标准

1. 通过激光扫描或摄影测量获取建筑几何，并保留近距离可读的檐口、砖雕和构件细节。
2. 拍摄并整理高分辨率材质，制作 base color、normal、roughness、ambient occlusion 等 PBR 贴图。
3. 生成远景、中景、近景多级 LOD，使用 Draco 和 KTX2 压缩，保证近景质量与网页加载速度平衡。
4. 建立真实地面、周边建筑、植被、天空光、接触阴影和比例参照物。
5. 用 GLB 表现建筑本体，用摄影测量场景或 360 全景补足现场环境；多节点景区仍沿用“地图总览 → 节点 → 单体 3D”的流程。

## 后续开发原则

在真实扫描或高质量摄影测量资产接入前，不再通过继续调整 HUD、相机或颜色来宣称已经达到实地效果。现有查看器作为通用加载、LOD、全屏和交互容器保留，下一阶段优先替换铁塔资产并建立材质、环境和近景质量验收标准。
