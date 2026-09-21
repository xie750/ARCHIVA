# 景区与单体建筑统一交互规范

项目统一采用两层体验：

1. **地图总览层**：先展示建筑或景区在真实地理环境中的位置关系。
2. **单体详情层**：用户选择地图节点后进入对应建筑、院落或场景的 3D 查看器。

## 多节点景区

清明上河园、龙门石窟、少林寺等景区包含多个可阅读节点。地图显示多个点位，用户可以：

- 点击点位，查看节点名称、年代/类型和简介；
- 点击“进入空间”，进入该节点的单体 3D；
- 在 3D 页面点击“返回景区总览”，回到同一张地图继续探索。

节点可以有独立的 GLB、manifest 或平台嵌入地址。没有独立资产的节点显示明确的程序化空间预览，不复用其他节点的外部模型。

## 单体建筑

黄鹤楼、开封铁塔、应天门本体这类单体展项仍然保留地图层，但地图只显示一个主节点。这样用户仍能看到建筑与城市、道路、河流的关系，然后点击“进入 3D”查看建筑本体。

单体节点设置 `useParentModel: true`，复用建筑自身的 manifest 或 GLB。这个字段只用于单节点地图，避免多节点景区误把父景区模型套到其他节点上。

## 数据结构

```ts
type ScenicPoint = {
  id: string
  name: string
  subtitle: string
  description: string
  coordinates: [longitude, latitude]
  modelKind: 'grotto' | 'temple' | 'gate' | 'pagoda' | 'garden'
  manifestUrl?: string
  assetUrl?: string
  embedUrl?: string
  embedSource?: string
  useParentModel?: boolean
}
```

页面通过 `BuildingDetailPage` 统一处理两层状态，`ScenicOverview` 只负责地图、点位选择和进入事件，`BuildingViewer` 只负责单体 3D。新增景区时只需填充点位数据和资产清单，不需要复制页面逻辑。
