# 河南建筑数字志 · Web Demo

Vue 3 + TypeScript + Vite 的出版级前端 Demo。当前以河南篇为第一章，使用本地数据和 Three.js 程序化建筑预览表达完整的产品体验；正式版可把同一组件替换为基于 manifest 的 GLB 加载器。

## 启动

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
pnpm preview
```

## 目录约定

```text
src/
├─ components/      可复用 UI 与领域组件
├─ data/            Demo 内容数据（后续替换为 API）
├─ layouts/         页面级布局
├─ pages/           路由页面
├─ router/          路由配置
├─ stores/          Pinia 状态
├─ services/        API 适配层
├─ assets/          设计令牌与全局样式
└─ types/           领域类型
```

`BuildingViewer` 当前使用 Three.js 生成轻量程序化示意模型，后端接入后可以保持页面接口不变，改为从模型 manifest 加载 GLB、LOD 和热点；建筑卡片和详情页面不需要改动。
