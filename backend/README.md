# 中国建筑数字志 API

这是“中国建筑数字志”出版 Demo 的 Spring Boot 模块化单体后端。当前以河南为首发展区，使用本地 SQLite 保存建筑、景区和 POI 示例数据，接口和领域模型已经按后续接入 PostgreSQL/PostGIS、Redis 和对象存储的方式拆分。

## 技术栈

- Java 17+
- Spring Boot 3.4
- Spring MVC + Bean Validation
- SQLite + Spring JDBC（本地开发持久化）
- Maven

## 目录结构

```text
backend/
├── pom.xml
└── src/
    ├── main/java/com/shy/digitalmuseum/
    │   ├── DigitalMuseumApplication.java
    │   ├── config/              # Web/CORS 等基础配置
    │   ├── controller/          # REST 接口
    │   ├── domain/              # 建筑、景区、POI 与模型 manifest 领域模型
    │   ├── dto/                 # API 输入输出模型
    │   ├── exception/           # 统一异常与错误响应
    │   ├── repository/          # 数据访问抽象及内存实现
    │   └── service/             # 用例与业务编排
    └── main/resources/application.yml
```

## 启动

在 `backend` 目录执行：

```bash
mvn spring-boot:run
```

默认服务地址：`http://localhost:8080`

首次启动会在 `backend/data/digital-museum.db` 创建数据库并写入内置示例数据。SQLite 只保存结构化聚合 JSON；GLB、全景、图片、音频和视频仍通过 manifest URL 指向对象存储或 CDN。

## REST 接口

### 建筑列表

```http
GET /api/v1/buildings?page=1&size=12&keyword=塔&type=古塔&region=河南
```

`page` 从 1 开始，`size` 最大为 50。支持 `keyword`（名称/摘要）、`type`、`dynasty` 和 `city` 筛选。

接口同时保留 `/api/buildings` 兼容路径。`/api/v1` 作为后续全国扩展的版本入口，建筑摘要已预留 `region` 字段；当前示例数据全部属于河南。

### 建筑详情

```http
GET /api/buildings/songyue-pagoda
```

### 3D 模型 manifest

```http
GET /api/buildings/songyue-pagoda/model-manifest
```

manifest 包含 LOD 模型地址、纹理、默认相机、热点和可交互构件。模型大文件不由 Java 服务器代理，生产环境应把 manifest 中的 URL 替换为对象存储/CDN 的签名 URL。

### 景区级扩展契约（龙门示例）

```http
GET /api/v1/sites/longmen/overview
GET /api/v1/sites/longmen/poi/main-buddha/scene
```

`overview` 返回 `siteId`、`regionCode`、`name`、`center`、`panoramaNodes` 和 `poi`，用于地图、全景节点和景区 POI 展示。`scene` 返回该 POI 关联的 `modelId` 与 3D `manifest`。当前实现使用龙门景区内存数据，接口契约保持独立，后续可替换为数据库和对象存储适配器。

## 后续接入真实数据

保持 `BuildingRepository` 接口不变，将 `InMemoryBuildingRepository` 替换为 PostgreSQL/PostGIS 实现；`ModelManifest` 中的 URL 可以由 MinIO/S3 签名服务生成。内容发布时建议继续使用 `sourceReference` 和 `modelVersion` 的审核字段追踪资料与模型版本。
