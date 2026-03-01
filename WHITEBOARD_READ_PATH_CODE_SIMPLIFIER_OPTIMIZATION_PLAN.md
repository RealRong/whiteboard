# Whiteboard Engine Read Path CODE_SIMPLIFIER 优化方案

更新时间：2026-03-01

## 1. 范围与目标

本方案从 `packages/whiteboard-engine/src/instance/create.ts` 出发，沿 read 主链路优化命名与结构，目标是：

1. 去掉“空包装层”和过度拆分。
2. 文件名收敛为短词（目录已表达语义时，不重复前缀）。
3. 在不改变行为的前提下提升可读性与可维护性。

覆盖范围：

1. `runtime/read/runtime.ts`
2. `runtime/read/store.ts`
3. `runtime/read/atoms.ts`
4. `runtime/read/index/*`
5. `runtime/read/node.ts`
6. `runtime/read/mindmap/*`
7. `runtime/read/edge/*`

## 2. 当前链路（简化视图）

1. `instance/create.ts` 注入 read runtime。
2. read runtime 组合 index + query + read store。
3. write 侧通过 `ChangeBus` 推送 change，read runtime 做增量应用。

## 3. 已实施优化

### 项目 A：read 命名去 `create*`，收敛为单词文件名

- 问题：
  - 大量 `createXxx*` 文件名与导出名冗长，目录语义与文件语义重复。
- 修改：
  - 统一收敛为：`runtime.ts`、`store.ts`、`read.ts`、`domain.ts`、`model.ts`、`view.ts`、`derivations.ts`。
  - `instance/create.ts` 已切换到新的 read 入口命名。
- 收益：
  - 搜索与跳转成本下降，命名一致性更高。
- 风险：
  - 批量重命名易引入漏改。
- 验证：
  - 全局引用替换后运行 `pnpm --filter @whiteboard/engine lint`。

### 项目 B：去掉 read 侧空包装层（node/mindmap/edge）

- 问题：
  - `model/domain/view` 三层在部分域存在“纯透传”或低价值中间层。
- 修改：
  - 删除 node/mindmap 的空转 model 层。
  - 删除 edge 的 domain 包装层，直接组合必要能力。
- 收益：
  - 模块边界更贴近真实职责，减少无效抽象。
- 风险：
  - 组合层职责上移后，若无约束可能再次膨胀。
- 验证：
  - 保持 `Query` 与 read store 对外契约不变，lint 与类型检查通过。

### 项目 C：`runtime/read/query` 全量内联（本次）

- 问题：
  - `query` 被拆为 `canvas/config/document/geometry/snap/viewport` 6 个小文件，仅在 `runtime.ts` 单点组装，目录碎片化明显。
- 修改：
  - 将上述 6 份实现全部内联到 `runtime/read/runtime.ts`。
  - 删除 `runtime/read/query/` 目录。
  - 内联后保留原能力边界：`doc/config/viewport/canvas/snap/geometry`。
- 收益：
  - 减少跳转层级与文件数量，读者在一个文件就能看清 read query 的完整装配。
  - 与“单次使用内联”和“避免单文件目录/过度拆分”一致。
- 风险：
  - `runtime.ts` 体积会上升，需要控制继续膨胀。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 D：`index/runtime` 内联到 read 主装配（本次）

- 问题：
  - `index/runtime.ts` 仅被 `read/runtime.ts` 单点使用，承担一层“组装 + change 分发”包装，跨文件跳转收益低。
- 修改：
  - 将 `index` 的增量同步流程（`applyChange` 分支逻辑）内联到 `runtime/read/runtime.ts`。
  - 删除 `runtime/read/index/runtime.ts`。
  - 保留 `index/store.ts` 作为真实索引能力封装（`NodeRectIndex` + `SnapIndex`）。
- 收益：
  - 再减少一层空包装；read 主链路聚焦在一个入口文件即可看清变更传播。
- 风险：
  - `runtime.ts` 承担更多流程控制，后续继续扩展时需约束体积。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 E：`index/store` 内联到 read 主装配（本次）

- 问题：
  - `index/store.ts` 仅在 `read/runtime.ts` 单点使用，主要做 `NodeRectIndex + SnapIndex` 的轻量组合，存在中间层冗余。
- 修改：
  - 将 `sync/syncByNodeIds/get*` 逻辑内联到 `runtime/read/runtime.ts`。
  - 删除 `runtime/read/index/store.ts`。
  - `runtime/read/index/` 仅保留 `NodeRectIndex.ts` 与 `SnapIndex.ts` 两个实体实现文件。
- 收益：
  - 进一步减少文件与层级；read 主装配成为单一可读入口。
- 风险：
  - `runtime.ts` 继续变大，后续需关注函数长度与可读性阈值。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 F：移除 `node/mindmap` 的 `domain` 包装层（本次）

- 问题：
  - `node/domain.ts` 与 `mindmap/domain.ts` 仅在 `read/store.ts` 单点使用，主要承担本地缓存 + `view` 组装 + getter 透传。
- 修改：
  - 将两者逻辑内联到 `runtime/read/store.ts`：
    - node：`nodeIds` 缓存、`nodeView` 组装、getter 暴露。
    - mindmap：`derivations` + `MindmapView` 缓存、`mindmapView` 组装、getter 暴露。
  - 删除：
    - `runtime/read/node/domain.ts`
    - `runtime/read/mindmap/domain.ts`
- 收益：
  - read 侧语义层级进一步收敛，减少单点包装文件与跳转成本。
- 风险：
  - `store.ts` 体积增长，需关注后续演进中的局部复杂度。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 G：`atoms` 目录内联为单文件入口（本次）

- 问题：
  - `runtime/read/atoms/*` 下拆分为 `read/nodes/edges/indexes/snapshot/shared` 六个文件，但仅围绕一个 read-atom 装配点服务，存在目录碎片化。
- 修改：
  - 新增 `runtime/read/atoms.ts`，将 `atoms` 子域逻辑内联为单文件：
    - 节点/边/索引/快照 atom 组装。
    - 共享缓存与顺序比较工具。
  - 切换引用：
    - `instance/create.ts` 使用 `../runtime/read/atoms`。
    - `runtime/read/runtime.ts` 和 `runtime/read/store.ts` 使用 `./atoms` 类型导入。
  - 删除旧目录 `runtime/read/atoms/*`。
- 收益：
  - 路径更短、跳转更少，read 装配链路更线性。
  - 消除“多文件围绕单入口”的过度拆分。
- 风险：
  - `atoms.ts` 体积增加，后续新增逻辑需控制局部复杂度。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

### 项目 H：移除 `node` 单文件目录（本次）

- 问题：
  - `runtime/read/node/` 在移除 `domain.ts` 后只剩 `view.ts`，形成单文件目录。
- 修改：
  - 将 `runtime/read/node/view.ts` 上提为 `runtime/read/node.ts`。
  - 更新 `runtime/read/store.ts` 的引用到 `./node`。
- 收益：
  - 路径更短，目录结构与“避免单文件目录”原则一致。
- 风险：
  - 文件移动后相对导入路径容易出错（已修正并验证）。
- 验证：
  - `pnpm --filter @whiteboard/engine lint` 通过。

## 4. 本次关键变更清单（read）

1. 修改：
   - `packages/whiteboard-engine/src/instance/create.ts`
   - `packages/whiteboard-engine/src/runtime/read/runtime.ts`
   - `packages/whiteboard-engine/src/runtime/read/store.ts`
   - `packages/whiteboard-engine/src/runtime/read/node.ts`
2. 新增：
   - `packages/whiteboard-engine/src/runtime/read/atoms.ts`
3. 删除：
  - `packages/whiteboard-engine/src/runtime/read/query/canvas.ts`
  - `packages/whiteboard-engine/src/runtime/read/query/config.ts`
  - `packages/whiteboard-engine/src/runtime/read/query/document.ts`
  - `packages/whiteboard-engine/src/runtime/read/query/geometry.ts`
  - `packages/whiteboard-engine/src/runtime/read/query/snap.ts`
  - `packages/whiteboard-engine/src/runtime/read/query/viewport.ts`
  - `packages/whiteboard-engine/src/runtime/read/index/runtime.ts`
  - `packages/whiteboard-engine/src/runtime/read/index/store.ts`
  - `packages/whiteboard-engine/src/runtime/read/node/domain.ts`
  - `packages/whiteboard-engine/src/runtime/read/mindmap/domain.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/edges.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/indexes.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/nodes.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/read.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/shared.ts`
  - `packages/whiteboard-engine/src/runtime/read/atoms/snapshot.ts`
  - `packages/whiteboard-engine/src/runtime/read/node/view.ts`

## 5. 后续建议（可选）

### 建议 1：为 `runtime/read/runtime.ts` 增加局部分区注释

- 问题：
  - 内联后 query/index 逻辑集中，若继续增长可读性会下降。
- 修改：
  - 仅加少量分区注释（`doc/config`、`viewport`、`canvas/snap`、`geometry`），不再拆文件。
- 收益：
  - 保持单文件收敛，同时降低扫描成本。
- 风险：
  - 注释若过多会形成噪音。
- 验证：
  - 评审时确认注释不超过必要最小量。

### 建议 2：控制 `runtime/read/runtime.ts` 的体积增长

- 问题：
  - `query/index` 已内联到 `runtime.ts`，`node/mindmap` domain 已内联到 `store.ts`，`atoms` 已收敛到 `atoms.ts`，主文件承载点更集中。
- 修改：
  - 后续新增能力优先使用局部 helper（函数内或同文件私有），避免再次引入“单点透传小文件”。
- 收益：
  - 在保持扁平目录的同时降低主文件失控风险。
- 风险：
  - 如果不设阈值，`runtime.ts/store.ts/atoms.ts` 仍可能膨胀。
- 验证：
  - 按 `CODE_SIMPLIFIER` 阈值（函数长度/嵌套深度/参数数量）做定期审计。

## 6. 本次最小验证结果

已执行：

```bash
pnpm --filter @whiteboard/engine lint
```

结果：通过（architecture check + TypeScript noEmit）。
