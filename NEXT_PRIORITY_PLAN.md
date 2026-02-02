# 三大优先事项清单与设计方案

## 1) 插件/注册表体系定型

### 目标
- 让任何业务通过“注册 + 配置 + 插件”扩展，而非改核心源码。

### 清单
- Node/Edge/Tool/Panel/Command/Theme/Exporter 等注册表
- 插件生命周期（install/activate/deactivate）
- 插件依赖声明与版本约束
- 权限/能力声明（capability 机制）
- 运行时开关与热更新能力（可选）

### 设计方案
- **核心位置**：`whiteboard-core` 维护 registry + plugin manager；`whiteboard-react` 只负责 UI 入口与注入。
- **注册接口**：统一 `registerXxx()` 形式，返回可撤销句柄。
- **插件结构**：
  - `manifest`（name/version/deps/capabilities）
  - `install(ctx)` 注册节点/边/命令/面板
  - `activate(ctx)` 订阅事件、挂载 UI
- **事件系统**：提供统一事件总线（selection/change/connect/validate/command）。
- **隔离策略**：
  - 插件只通过 ctx 与 registry 通信，禁止跨层直接 import 内部模块。
  - 可选：插件运行在沙箱或命名空间，防止污染全局。

## 2) Schema 驱动模型与属性面板

### 目标
- 初级开发可用 JSON/Schema 快速定义节点、字段、校验与 UI 表单。

### 清单
- Node/Edge Schema 规范（fields、ports、validators、defaults）
- 属性面板渲染器（schema -> form）
- 条件显示/隐藏与依赖联动
- 校验与错误提示
- 版本化 schema（变更可迁移）

### 设计方案
- **Schema 定义**：`whiteboard-core` 定义类型与校验规则，支持自定义字段类型。
- **渲染器**：`whiteboard-react` 实现通用表单组件库（input/select/number/color/boolean/enum）。
- **扩展控件**：插件可注册自定义字段渲染器（如 tag 绑定、告警策略配置）。
- **校验流程**：
  - 保存前校验
  - 即时校验
  - 命令执行校验
- **数据绑定**：schema 支持 `binding` 字段，后续可连接到实时数据源。

## 3) 性能与大图稳定性

### 目标
- 支撑大规模图形、频繁交互与实时更新，不牺牲交互体验。

### 清单
- 空间索引与快速命中测试
- 增量渲染与局部更新
- 图层化与缓存
- 视口裁剪/虚拟化
- 大图下的交互流畅度保障

### 设计方案
- **空间索引**：`whiteboard-core` 提供 quadtree/R-tree 索引，用于命中测试与范围查询。
- **渲染策略**：
  - `whiteboard-react` 使用分层渲染（edge/node/overlay）。
  - 对静态层做缓存，对动态层做局部刷新。
- **虚拟化**：仅渲染视口范围内元素。
- **渐进式更新**：拖拽/连接时减少复杂计算（简化路径 or 降级样式）。
- **监控与基准**：内置性能指标（FPS、渲染耗时、命中耗时），便于迭代优化。

## 里程碑建议（先后顺序）
1. 完成插件注册表与插件生命周期
2. 完成 schema 定义与属性面板渲染
3. 引入空间索引 + 视口裁剪

