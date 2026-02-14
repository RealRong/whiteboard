# Whiteboard Engine 拆分方案（一步到位，无兼容层）

## 1. 决策结论

1. 新增独立包：`@whiteboard/engine`（不是 `whiteboard-ui`）。
2. `shortcuts` 全量迁入 `@whiteboard/engine`，与 lifecycle/input/commands 同层协作。
3. `@whiteboard/react` 只保留 UI 容器桥接、VDOM 渲染、样式与节点注册。
4. 本次按“无历史用户”处理，不保留兼容层，不保留旧 API 别名。

当前落地状态（2026-02-14）：

1. 已创建 `packages/whiteboard-engine` 包骨架（`package.json/tsconfig/tsup/index`）。
2. 已将 `common/instance + common/shortcuts + common/state + 运行时 node utils/state` 迁入 engine（第一批搬迁）。
3. `@whiteboard/react` 已切换为使用 `createWhiteboardEngine` 创建实例。
4. React 的 context hydration / useInstance / useDoc / selector keys 已改为对接 engine 的 atoms 与 state keys。
5. `@whiteboard/react` 移除了 `createWhiteboardInstance` 导出，改为类型层转导出 engine 实例类型。
6. 已从 `@whiteboard/react` 删除运行时实现目录：`common/instance`、`common/shortcuts`、`common/state`、`node/state`（运行时代码仅保留在 engine）。
7. `@whiteboard/react` 的配置默认值/归一化/instanceConfig 转换已改为直接复用 engine 导出（移除 `react/common/config` 重复实现）。
8. `node drag strategy` 已由 `react` 切换为消费 engine 导出，`react/node/runtime` 与 `react/node/utils/group.ts|snap.ts` 已删除。
9. `whiteboard-demo` 构建链路已调整为先构建 `core/engine/react` 再 `tsc + vite`，并移除源码路径映射，避免跨包源码耦合编译。
10. `react` 侧第二批类型收口已完成：`Whiteboard/useWhiteboardLifecycle/useWhiteboardContextHydration/useNodeTransform/useMindmapSubtreeDrag/useEdgeGeometry/useEdgePreview/useWhiteboardSelector` 等文件均改为直接消费 `@whiteboard/engine` 类型。
11. `react` 运行时类型目录已移除：`src/types/instance`、`src/types/commands`、`src/types/state`、`src/types/shortcuts`，`react` 仅保留 UI 语义类型。
12. 为消除多包 `types/*` 路径别名冲突，engine 内部类型别名已统一为 `@engine-types/*`，并同步 tsconfig；`@whiteboard/engine lint`、`@whiteboard/react lint`、`whiteboard-demo build` 全部通过。
13. `react` 生命周期主链路已收敛为单点桥接：新增 `useWhiteboardEngineBridge`，由 `Whiteboard.tsx` 统一驱动 `history/context/lifecycle`，`useWhiteboardLifecycle` 改为显式接收 `instance`（去除对 context 读取的隐式依赖）。
14. `history` 生命周期已下沉至 engine：`WhiteboardLifecycleRuntime` 统一处理 `history.configure + history subscribe + docId 变更 clear`，react 侧 `useWhiteboardHistoryLifecycle` 已删除。
15. `WhiteboardStateNamespace` 已移除 `bindHistory` 对外 API，history 订阅能力改为 lifecycle 内部实现，不再暴露给 UI 层。
16. lifecycle 配置归一化已迁入 engine：新增 `toWhiteboardLifecycleConfig`，react 不再直接依赖默认配置常量拼装 lifecycle 参数。
17. `useWhiteboardLifecycle` 已收敛为最薄桥接（只负责 `start/update/stop`），config 组装由 `useWhiteboardEngineBridge` 调用 `toWhiteboardLifecycleConfig` 完成。
18. engine 侧已清理 React 类型依赖：`types/instance` 从 `RefObject` 改为 `RefLike`，`types/common/whiteboard` 不再依赖 `CSSProperties`/`WhiteboardProps`，`packages/whiteboard-engine/src` 内已无 `from 'react'` 引用。

---

## 2. 目标架构

```text
@whiteboard/core
  └─ 文档模型、intent/commands、history、query

@whiteboard/engine
  ├─ state store（含 watch/read/write）
  ├─ instance（commands/query/runtime）
  ├─ lifecycle（start/update/stop）
  ├─ input handlers（canvas/node/edge/mindmap）
  ├─ services（observer/hover/transform/navigation/autofit）
  └─ shortcuts（manager/runtime/defaults/command binding）

@whiteboard/react
  ├─ Whiteboard 容器组件（mount/unmount/update bridge）
  ├─ 视图组件（node/edge/mindmap layers）
  ├─ UI-only hooks（展示与轻量事件转发）
  └─ 样式与 registry（NodeRegistry）
```

依赖方向强约束：

1. `react -> engine -> core`。
2. `react` 禁止 import `engine` 内部路径（只用包导出）。
3. `engine` 禁止 import `react`（含 `RefObject`、`React.PointerEvent`）。
4. `core` 不感知 `engine` 与 `react`。

---

## 3. 边界定义（最优形态）

### 3.1 `@whiteboard/engine` 负责

1. 交互与状态机：selection/edgeConnect/drag/transform/mindmap drag。
2. 生命周期编排：容器绑定、window 绑定、state watch、history 同步与清理。
3. shortcuts：规则解析、冲突处理、命令注册与执行。
4. query 与几何计算：snap、group、anchor/path、坐标转换。
5. 所有“可脱离 React 运行”的副作用。

### 3.2 `@whiteboard/react` 负责

1. React 生命周期桥接（创建 engine、mount、update、unmount）。
2. 容器 DOM 与 Layer 渲染。
3. 节点渲染注册（`NodeRegistry`）与视觉样式。
4. 仅 UI 语义 hooks（读取 engine 状态用于渲染，不承载业务状态机）。

### 3.3 明确禁止

1. React hooks 内实现业务状态机（如 selection box 规则、edge connect window 绑定）。
2. Engine API 暴露 React 事件类型。
3. 通过 `types/*` 这种包内路径别名跨包耦合。

---

## 4. 包与目录设计

## 4.1 新包：`packages/whiteboard-engine`

建议目录：

```text
packages/whiteboard-engine/src/
  index.ts
  config/
    engineConfig.ts
  types/
    index.ts
    commands.ts
    config.ts
    lifecycle.ts
    query.ts
    services.ts
    shortcuts.ts
    state.ts
  state/
    engineAtoms.ts
    engineDerivedAtoms.ts
    engineStateAtomMap.ts
  instance/
    createWhiteboardEngine.ts
    commands/
    query/
    runtime/
    lifecycle/
      WhiteboardLifecycleRuntime.ts
      bindings/
      input/
    services/
    edge/
    geometry/
    store/
    state/
  shortcuts/
    defaultShortcuts.ts
    manager/
    runtime/
  node/
    runtime/drag/
    utils/group.ts
    utils/snap.ts
    utils/transform.ts
  geometry/
    geometry.ts
```

## 4.2 `packages/whiteboard-react` 重构后目录

```text
packages/whiteboard-react/src/
  Whiteboard.tsx
  index.ts
  common/
    bridge/
      useWhiteboardEngineBridge.ts
    hooks/
      useEngineSelector.ts
      useEngineInstance.ts
  edge/components/*
  node/components/*
  mindmap/components/*
  node/registry/*
  styles/*
```

说明：`react` 不再承载 `common/instance`、`common/shortcuts`、`common/state` 这类运行时实现目录。

---

## 5. 文件迁移映射（从 `@whiteboard/react` 到 `@whiteboard/engine`）

整目录迁移：

1. `packages/whiteboard-react/src/common/instance/**` -> `packages/whiteboard-engine/src/instance/**`
2. `packages/whiteboard-react/src/common/shortcuts/**` -> `packages/whiteboard-engine/src/shortcuts/**`
3. `packages/whiteboard-react/src/common/state/**` -> `packages/whiteboard-engine/src/state/**`

运行时工具迁移：

1. `packages/whiteboard-react/src/common/utils/geometry.ts` -> `packages/whiteboard-engine/src/geometry/geometry.ts`
2. `packages/whiteboard-react/src/node/runtime/drag/**` -> `packages/whiteboard-engine/src/node/runtime/drag/**`
3. `packages/whiteboard-react/src/node/utils/group.ts` -> `packages/whiteboard-engine/src/node/utils/group.ts`
4. `packages/whiteboard-react/src/node/utils/snap.ts` -> `packages/whiteboard-engine/src/node/utils/snap.ts`
5. `packages/whiteboard-react/src/node/utils/transform.ts` -> `packages/whiteboard-engine/src/node/utils/transform.ts`

类型迁移：

1. `packages/whiteboard-react/src/types/instance/**` -> `packages/whiteboard-engine/src/types/**`（拆分后命名）
2. `packages/whiteboard-react/src/types/commands/index.ts` -> `packages/whiteboard-engine/src/types/commands.ts`
3. `packages/whiteboard-react/src/types/state/**` -> `packages/whiteboard-engine/src/types/state.ts`
4. `packages/whiteboard-react/src/types/shortcuts/**` -> `packages/whiteboard-engine/src/types/shortcuts.ts`

保留在 `react` 的内容：

1. `edge/components/**`
2. `node/components/**`
3. `mindmap/components/**`
4. `node/registry/**`
5. 纯 UI hooks（仅用于渲染数据映射，不做状态机）

---

## 6. Engine API 设计（无兼容层）

建议对外导出（`@whiteboard/engine`）：

```ts
export type WhiteboardEngine = {
  state: {
    read: ...
    write: ...
    watch: ...
    snapshot: ...
  }
  query: WhiteboardEngineQuery
  commands: WhiteboardEngineCommands
  runtime: {
    lifecycle: {
      start(input: { container: HTMLElement }): void
      update(config: WhiteboardEngineLifecycleConfig): void
      stop(): void
    }
    dispose(): void
  }
}

export function createWhiteboardEngine(options: {
  core: Core
  config?: Partial<WhiteboardEngineConfig>
}): WhiteboardEngine
```

关键点：

1. 不再接受 `RefObject`；生命周期 `start` 直接传 `HTMLElement`。
2. engine 通过 `core.query.document()` 读取文档，不保留 `docRef`。
3. history 同步与 clear 逻辑内收至 engine lifecycle（移出 react effect）。
4. shortcuts 统一通过 engine runtime 管理，React 不再持有 shortcut manager。

---

## 7. Config 拆分（UI 与 Engine 解耦）

新配置模型：

1. `WhiteboardEngineConfig`（属于 `@whiteboard/engine`）  
   字段：`nodeSize`、`mindmapNodeSize`、`node`、`edge`、`viewport`、`history`、`tool`、`shortcuts`、callbacks。
2. `WhiteboardViewConfig`（属于 `@whiteboard/react`）  
   字段：`className`、`style`、`nodeRegistry`、纯视觉相关 props。

原则：

1. 影响行为与数据流的配置在 engine。
2. 影响样式与渲染的配置在 react。

---

## 8. 命名规范（行业可维护性）

1. 包名：`@whiteboard/engine`、`@whiteboard/react`、`@whiteboard/core`。
2. 类：`XxxRuntime`、`XxxService`、`XxxManager`（PascalCase 文件名）。
3. 工厂：`createXxx`。
4. 绑定函数：`bindXxx`（返回 `off()`）。
5. React hooks：`useXxx` 且只用于 UI 语义，不承载状态机。
6. Command 命名：`domain.action`（如 `selection.clear`、`edge.connect`）。
7. 禁止 `internal` 作为长期目录名，使用 `bindings/input/runtime/services`。

---

## 9. 一步到位迁移步骤（无兼容层）

### Step 1. 建包与编译骨架

1. 新建 `packages/whiteboard-engine/package.json`、`tsconfig.json`、`tsup.config.ts`。
2. 在 workspace 注册后执行 `pnpm -r build` 验证。

### Step 2. 批量迁移代码

1. 使用 `git mv` 按第 5 节迁移目录与文件。
2. 迁移后统一替换 import，移除 `types/*` 别名依赖，改为包内相对路径或 `@whiteboard/engine` 导入。

### Step 3. 去 React 依赖

1. `instance` 类型删除 `RefObject` 与 React 事件类型。
2. lifecycle API 改为 `start({ container })`。
3. 所有 handler 签名改为 DOM 原生事件类型。

### Step 4. shortcuts 全量并入 engine

1. `defaultShortcuts`、`createShortcutManager`、`createShortcutRuntime`、`shortcutCommands` 全部驻留 engine。
2. `react` 删除 shortcuts 运行时代码，仅透传 shortcuts 配置给 engine lifecycle。

### Step 5. React 侧桥接收口

1. `Whiteboard.tsx` 只做：create engine、mount/update/unmount、渲染层。
2. `useWhiteboardLifecycle` 与 history 桥接已合并到 `useWhiteboardEngineBridge`（已完成）。
3. hooks 保留 UI 语义映射，删除业务状态机实现。

### Step 6. 清理与验收

1. 删除废弃导出与旧目录。
2. 运行 `pnpm --filter @whiteboard/engine lint` 与 `pnpm --filter @whiteboard/react lint`。
3. demo 回归。

---

## 10. 明确破坏性变更（接受）

1. 删除 `@whiteboard/react` 对 `createWhiteboardInstance` 的导出。
2. 删除 `@whiteboard/react` 中所有 engine 内部类型导出（`types/instance`、`types/commands` 等转移到 `@whiteboard/engine`）。
3. 删除已废弃别名/兼容命名，不提供 re-export。
4. `WhiteboardInstance` 类型来源改为 `@whiteboard/engine`。

---

## 11. 迁移后导出约定

`@whiteboard/engine`：

1. `createWhiteboardEngine`
2. `WhiteboardEngine`、`WhiteboardEngineConfig`、`WhiteboardEngineCommands`、`WhiteboardEngineQuery`
3. `Shortcut`、`ShortcutOverrides`（与 engine 行为强相关）

`@whiteboard/react`：

1. `Whiteboard`
2. `NodeRegistry`、`NodeDefinition`、`NodeRenderProps`
3. `WhiteboardProps`、`WhiteboardViewConfig`

---

## 12. 验收标准

1. `@whiteboard/react` 不再包含 `common/instance`、`common/shortcuts`、`common/state` 运行时实现。
2. `@whiteboard/engine` 编译通过，且不依赖 `react` 包。
3. shortcuts 功能可在 engine lifecycle 下独立工作（不需要 React hook 管理）。
4. Whiteboard 交互回归通过：平移缩放、框选、节点拖拽、edge connect、history、mindmap 拖拽。
5. Demo 只通过 `@whiteboard/react + @whiteboard/engine` 公共 API 完成运行，无内部路径 import。

---

## 13. 实施建议（当前仓库）

1. 先落 `@whiteboard/engine` 包骨架与导出，再搬迁代码，最后收敛 `@whiteboard/react`。
2. 每完成一个大步骤就跑一次 `pnpm -r lint`，避免路径重写后累计错误过多。
3. 全程使用 `git mv`，保留文件历史，便于 review。
