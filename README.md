# 河南建筑数字志 · 出版 Demo

这是一个面向出版展示的“中国建筑数字博物馆”首版样片，聚焦河南地区的代表性建筑。产品以“发现建筑 → 阅读历史 → 进入空间 → 查看来源”为核心体验。

## 目录

```text
backend/      Spring Boot 模块化单体，按 controller/service/repository 分层
frontend/     Vue 3 + TypeScript + Vite 前端
docs/         产品、接口与模型资产规范
```

## 当前演示范围

- 河南建筑目录与筛选：洛阳、登封、开封、安阳等城市
- 出版式首页、探索页、建筑详情页
- 3D 展示区（支持远程 GLB 或本地占位模型清单）
- 建筑历史章节、热点标注、资料来源和模型版本信息
- Java 后端预留模型 manifest、来源追溯和版本审核接口

## 启动方式

### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

### 后端

需要 Java 17+ 与 Maven 3.9+：

```bash
cd backend
mvn spring-boot:run
```

前端默认通过 `/api` 访问后端；开发环境由 Vite 代理到 `http://localhost:8080`。

## 设计与工程约束

- 前端采用页面、领域组件、服务层分离，避免在页面中直接拼接请求和 3D 逻辑。
- 后端采用模块化单体，遵循 Controller → Service → Repository 三层结构，领域模块之间通过 DTO 和接口协作。
- 大型模型文件不经过 Java 服务转发，生产环境从对象存储/CDN 读取签名 URL。
- 建筑内容、模型版本、资料来源和授权信息必须可追溯。
- 3D 资源使用 GLB/glTF，后续接入 Draco/Meshopt、KTX2 和 LOD。
