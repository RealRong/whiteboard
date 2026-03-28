# Whiteboard Editor / Whiteboard React 全局收敛与减复杂度研究

## 1. 研究范围

这份文档回答一个更聚焦的问题：

- 沿着 `whiteboard-editor -> whiteboard-react` 这条实际运行链路，当前还有哪些地方可以**全局收敛**、**降低概念数量**、**减少跨层耦合**

这里的“全局收敛”不等于继续做文件拆分，也不等于把所有逻辑都往某一层推。

这次重点关注的是：

- `packages/whiteboard-editor/src/runtime/instance/*`
- `packages/whiteboard-editor/src/runtime/read/*`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts`
- `packages/whiteboard-editor/src/runtime/selection/*`
- `packages/whiteboard-editor/src/features/selection/gesture.ts`
- `packages/whiteboard-react/src/Whiteboard.tsx`
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts`
- `packages/whiteboard-react/src/runtime/input/pointer.ts`
- `packages/whiteboard-react/src/runtime/instance/index.ts`
- `packages/whiteboard-react/src/features/edge/hooks/useEdgeInput.ts`
- `packages/whiteboard-react/src/features/mindmap/hooks/drag/useMindmapDrag.ts`

本文与以下两份文档形成互补：

- `WHITEBOARD_EDITOR_INTERNAL_API_STATE_CHAIN_SIMPLIFICATION_RESEARCH.zh-CN.md`
- `WHITEBOARD_REACT_CONVERGENCE_NOISE_REVIEW.zh-CN.md`

前两份分别看 editor 和 react；本文看的是**整条链路**。

---

## 2. 结论先行

有，而且空间仍然明显。

但当前最值得动的，不是继续清 React 表层壳文件，也不是继续对单个 feature 做局部整理，而是下面四个**全局收敛点**：

1. `selection` 的“快照 / press context / press plan / gesture 执行”还是一条过长的链，重复建模最明显。
2. `pointer.ts` 仍然是一个混合了原始输入读取、frame 归一化、tool gate、feature dispatch、context 解析的大路由文件。
3. `createEditor` 仍然承担了 store 创建、read overlay、commands 装配、host session 创建、engine commit 收尾、platform host 注入等多种职责。
4. `whiteboard-react` 虽然比前几轮薄了很多，但仍然直接依赖 `editor.host` 里的低层 session/controller，说明跨包 runtime 契约还没有完全收口。

一句话概括：

**当前复杂度的核心不在 React 视图层，而在 editor 中段运行时：它同时承担了本地状态、engine read overlay、交互 session host 三种职责。**

所以最有效的顺序不是“继续切小文件”，而是：

1. 先收 `selection + pointer`
2. 再收 `createEditor + host/type`
3. 最后收 `Whiteboard.tsx` bootstrap/lifecycle
4. 同时把 registry 类型桥接彻底消掉

---

## 3. 当前链路结构

## 3.1 editor 当前不是单一 runtime，而是三层职责叠加

从 `packages/whiteboard-editor/src/runtime/instance/createInstance.ts` 可以看到，editor 当前至少在同时做三件事：

1. 本地 UI / session state 创建
2. engine read 的二次 overlay / projection
3. interaction / feature session host 的装配

直接证据：

- `createEditorStores` 在 `createInstance.ts:94-163` 同时创建 `tool/history/draw/edit/frame/selection` store、`node/edge/mindmap` internals，以及 `createRuntimeRead(...)`
- `createEditor` 在 `createInstance.ts:165-389` 又继续创建 `viewport`、`interaction`、`pick`、`snap`、`commands`、`marquee`、`gesture`、`transform`、`edgeConnect`、`mindmapDragController`
- `EditorHost` 在 `packages/whiteboard-editor/src/runtime/instance/types.ts:256-278` 里继续把这些 runtime/session 直接暴露成一个很宽的 host 面

这意味着 editor 不是一个“薄 facade”，而是当前整条链路里最厚的运行时中枢。

## 3.2 当前 pointer down 链路仍然偏长

当前主链路大致如下：

1. React 容器在 `packages/whiteboard-react/src/canvas/useCanvasDown.ts:59-83` 捕获 `pointerdown`
2. React 调用 `packages/whiteboard-react/src/runtime/input/pointer.ts:10-25` 的薄桥接
3. editor 在 `packages/whiteboard-editor/src/runtime/input/pointer.ts:96-109` 读取 `CanvasDown`
4. editor 在 `pointer.ts:130-299` 做 frame normalize、tool gate、pick gate、feature dispatch
5. 如果分发到 selection gesture，则进入 `packages/whiteboard-editor/src/features/selection/gesture.ts:218-256`
6. gesture 再通过 `readSelectionPressContext(...)` 和 `instance.host.selection.planPress(...)` 生成 `tap/drag/hold` 计划
7. 最后才由 press runtime 启动 marquee / move / edit / select

也就是说，现在的 `pointerdown` 不是“一次判定 -> 一次执行”，而是：

- `pick`
- `frame normalize`
- `tool gate`
- `feature dispatch`
- `selection context`
- `selection plan`
- `press runtime`
- `intent execute`

这是当前整条链路里最值得压缩的一段。

## 3.3 React 已经薄很多，但仍然没有完全脱离 host runtime

React 侧现在已经不是最厚的部分，但还保留了几处对 editor host 的直接依赖：

- `useCanvasDown.ts:24-57` 直接取 `instance.host.selection.marquee`、`gesture`、`instance.host.node.transform`
- `useEdgeInput.ts:28-56` 和 `74-115` 直接读 `instance.host.interaction.mode`、`instance.host.edge.preview.hint`、`instance.host.snap.edge.connect`
- `useMindmapDrag.ts:4-15` 直接绑定 `instance.host.mindmap.controller`

这说明 React 虽然不再自己维护一套独立 runtime，但仍然消费 editor 的低层 controller/session 对象。

这类依赖不是马上要删掉的 bug，但它说明：

- `editor.host` 还不是稳定、收敛的 capability 面
- React 还没有完全退回到“只消费 read / commands / viewport / 少量语义 controller”

## 3.4 `Whiteboard.tsx` 仍然是根组件级装配热点

`packages/whiteboard-react/src/Whiteboard.tsx:157-315` 当前同时负责：

- config normalize
- board config 派生
- 输入 document normalize
- engine 创建
- editor 创建
- imperative ref 暴露
- document mirror / replace 同步
- collab session 创建与销毁
- collab callback 重新绑定
- runtime config 同步
- instance dispose

这不是逻辑错误，但它仍然是一个典型的 bootstrap / lifecycle 聚合点。

---

## 4. 复杂度来源分类

## 4.1 最大问题不是文件多，而是概念重复建模

`selection` 是最典型的例子。

当前至少存在下面几层概念：

- `SelectionInput`
- `SelectionTarget`
- `SelectionSnapshot`
- `View`
- `SelectionIds`
- `SelectionPressSelection`
- `SelectionPressTarget`
- `SelectionPressIntent`
- `SelectionPressPlan`
- `SelectionTapMatch`

其中有些是必要的，但有些已经明显重复：

- `Input` / `Source` / `View` 在 `packages/whiteboard-editor/src/runtime/selection/state.ts:34-35`、`72` 只是别名，不增加语义
- `SelectionIds` 与 `SelectionInput` 基本是同一类结构
- `SelectionPressSelection` 只是从 `SelectionSnapshot` 再摘一层字段
- `isSelectionBoxInteractive(...)` 已经是 selection snapshot 的派生结论，但又在 `policy.ts` 和 `transform.ts` 被二次计算

这里的复杂度不是“类型太多”，而是：

- 同一份选择信息被多次重新命名
- 同一份交互判断被多次重新派生

## 4.2 pointer 路由仍然把三类问题混在一起

`packages/whiteboard-editor/src/runtime/input/pointer.ts:96-367` 当前混在一起的内容有三类：

1. 原始输入读取
2. 主按钮 down 分发
3. 右键 / context target 解析

更细一点：

- `readCanvasDown(...)` 负责 pick 和原始输入读取
- `normalizeCanvasFrame(...)` 负责 frame 范围修正
- `dispatchCanvasDown(...)` 负责 tool / pick / interaction busy gate 和 feature fan-out
- `readContextOpen(...)` 负责 context menu open target
- `resolveContextTarget(...)` 负责 context target resolve

这几个动作共享同一批基础信息：

- `pick`
- `frame`
- `point.world`
- `selection snapshot`

但现在被拆成不同入口，导致“同一事件上下文”被不同函数重复读取、重复解释。

## 4.3 selection planning 与 gesture execution 之间还有一层 host 回绕

当前 selection press 的执行方式是：

1. `gesture.down(...)`
2. `readSelectionPressContext(...)`
3. `instance.host.selection.planPress(ctx)`
4. `readSelectionPressPlan(...)`
5. `press.start(...)`
6. `runTapIntent / runDragIntent / runHoldIntent`

证据见：

- `packages/whiteboard-editor/src/features/selection/gesture.ts:218-256`
- `packages/whiteboard-editor/src/runtime/instance/createInstance.ts:304-335`
- `packages/whiteboard-editor/src/runtime/selection/policy.ts:492-530`

这条链的问题不是“函数太多”，而是：

- planner 的输入依赖 selection snapshot
- planner 的执行者还是 gesture 自己
- planner 又通过 `host.selection.planPress` 回到 instance 装配层

这会造成两个后果：

1. selection planning 不是一个独立、稳定的 runtime capability
2. `host.selection` 不得不暴露 `planPress` 这种偏内部的接口

## 4.4 `createEditor` 过厚的根因，是 controller 依赖的是整机，不是能力切片

`createDeferredInstance()` 的存在本身就是一个信号：

- 当前很多 controller/session 的依赖太宽
- 它们依赖的是“整个 `InternalEditor`”
- 所以装配时只能先建一个延迟绑定的 proxy，再把实例回填进去

从使用点也能看出来：

- `createSelectionGesture` 依赖 `commands/config/host/interaction/read/viewport` 和 `internals.edge/node/pick/snap`，见 `features/selection/gesture.ts:26-31`
- `createTransformSession` 依赖 `commands/interaction/read/viewport` 和 `internals.node/snap`，见 `features/node/session/transform.ts:104-109`

这说明“controller 依赖对象”还没有切到真正的最小能力集。

所以长期最优不是保留一个越来越聪明的 `createDeferredInstance`，而是：

- 把 controller 的依赖切窄
- 让装配可以按能力组装，而不是按整机回填

## 4.5 React 当前真正该收的，不是薄桥，而是 bootstrap 与 host 耦合

有些 React 文件看上去像还能继续删，但其实已经不是主问题：

- `packages/whiteboard-react/src/runtime/input/pointer.ts:1-30` 基本是对 editor input 的薄桥接
- `packages/whiteboard-react/src/canvas/useCanvasDown.ts:19-89` 主要就是 feature handler 汇总与 DOM 绑定
- `packages/whiteboard-react/src/runtime/hooks/useWhiteboard.ts:10-42` 只是 context 和语义 hook，体量很小

这些地方继续做“文件级压平”收益已经很低。

React 当前真正还值得动的，是：

- `Whiteboard.tsx` 的 bootstrap/lifecycle 分层
- 对 `editor.host` 的直接 controller 依赖
- registry contract 的类型桥接

## 4.6 registry 类型桥接仍然是显式噪音

`packages/whiteboard-react/src/runtime/instance/index.ts:11-16` 里仍然存在：

- `input.registry as unknown as EditorNodeRegistry`

这不是运行时复杂度的大头，但它是一个明确的类型边界未收敛信号：

- editor 和 react 仍然维护了两套相近但不完全统一的 registry contract
- React 侧工厂还需要强制桥接

这种噪音应该清掉，而且优先级不低，因为它会放大后续所有类型演进成本。

---

## 5. 全局收敛方案

## 5.1 先明确一条原则：一个概念只保留一个 canonical owner

建议把整条链路里的核心概念只保留以下归属：

- committed document / index / bounds：`engine`
- editor local state：`editor.state`
- editor overlay read：`editor.read`
- pointer / selection intent planning：`editor.runtime.input|interaction`
- DOM 绑定与组件组合：`whiteboard-react`

也就是说：

- React 不再额外创造新的 runtime model
- editor 也不要把同一个选择行为拆成 snapshot、context、selection 子集、plan 多轮重命名

## 5.2 第一优先级：把 `pointer -> selection` 压成一条统一 intent 链

当前最值得做的是引入一层统一的 `CanvasIntent` 或 `PointerIntent`。

建议目标形态：

```ts
type CanvasIntent =
  | { kind: 'edge.create'; input: EdgeCreateDown }
  | { kind: 'draw.brush'; input: DrawDown }
  | { kind: 'draw.erase'; input: EraserDown }
  | { kind: 'insert'; input: InsertDown }
  | { kind: 'node.transform'; input: TransformDown }
  | { kind: 'edge.interact'; input: EdgeDown }
  | { kind: 'mindmap.drag'; input: MindmapDown }
  | {
      kind: 'selection.press'
      input: GestureDown
      plan: SelectionPressPlan
    }
```

对应收敛路径：

1. `readCanvasDown(...)` 只负责原始输入读取
2. 新增 `readCanvasIntent(...)` 统一做 frame normalize、tool gate、pick gate、selection plan
3. `dispatchCanvasDown(...)` 只负责根据 intent 调用 handler
4. context menu 也复用同一套 normalize 后的 target 信息，而不是再单独走一套 target 解析

这样一来，selection press 就不再是“被 gesture 二次规划”的特例，而是整个 canvas pointer intent 的一种分支。

直接收益：

- `pointer.ts` 的职责可以从“大路由”收成“read intent + dispatch intent + context”
- `selection policy` 不再通过 `host.selection.planPress` 回绕到 instance
- React `useCanvasDown` 仍可保留在顶层单点组合，不需要把 canvas handlers 继续搬进 instance

## 5.3 第二优先级：把 selection 模型压成三层，而不是多层别名

建议把 selection 相关概念收成三层：

1. `SelectionTarget`
   持久 source，表示当前选中对象 id 集
2. `SelectionSnapshot`
   规范化只读快照，包含 items / primary / counts / transform / box / boxInteractive
3. `SelectionPressPlan`
   pointer-time 交互计划，只服务 gesture / press runtime

建议直接删减或内聚的内容：

- 删除 `Input` / `Source` / `View` 这类纯别名导出
- 用 `SelectionTarget` 统一代替 `SelectionIds`
- 把 `SelectionPressSelection` 内联回 planner
- 把 `isSelectionBoxInteractive(...)` 变成 `SelectionSnapshot.boxInteractive`

这样会让下面两处同步简化：

- `packages/whiteboard-editor/src/runtime/selection/policy.ts`
- `packages/whiteboard-editor/src/features/node/session/transform.ts`

因为它们不再需要反复从 snapshot 再派生一遍“选择框能不能交互”。

## 5.4 第三优先级：缩小 controller 依赖面，拆掉 `createEditor` 的装配聚合

`createEditor` 的最优方向不是简单拆文件，而是先拆能力边界。

建议按四段拆：

1. `createEditorPlatformPorts`
   负责 clipboard / selectionLock / pointerContinuation
2. `createEditorRuntimeStores`
   负责 state store、runtime read、commands
3. `createEditorControllers`
   负责 marquee / gesture / transform / edgeConnect / mindmap drag
4. `createEditorHost`
   负责把真正需要对外暴露的 runtime capability 组装成稳定 host 面

更关键的是：

- controller 不应再吃整个 `InternalEditor`
- 每个 controller 只吃它真正需要的最小依赖切片

这一步完成后：

- `createDeferredInstance` 可以继续存在，但会明显变薄
- 或者直接下降为少数局部引用，而不是装配核心机制

## 5.5 第四优先级：收缩 `EditorHost`，把它从“整机 runtime 泄漏口”压成稳定 capability 面

当前 `EditorHost` 暴露了太多低层实现名词：

- `selection.marquee`
- `selection.gesture`
- `selection.planPress`
- `node.transform`
- `edge.preview`
- `edge.connect`
- `mindmap.controller`

这些对象对 React 来说虽然“有用”，但并不是稳定的领域语义。

更稳的方向是：

- 让 `host` 只暴露少量确实跨包复用的 capability
- 把偏内部的 planner/session/controller 留在 editor 内部
- React 需要的运行时能力，尽量通过更小的 feature adapter 暴露，而不是直接挂整棵 host 子树

这里不建议一步就把所有 host 去掉。

更现实的做法是：

1. 先把 `planPress` 从 `host.selection` 移除
2. 再审视 `gesture / marquee / transform / mindmap.controller` 哪些真的是跨包稳定契约
3. 最后再决定 host 的最终收缩形态

## 5.6 第五优先级：把 `Whiteboard.tsx` 拆回组合层

`Whiteboard.tsx` 现在的主要问题不是实现错，而是职责太集中。

建议至少拆成下面几段：

- `useWhiteboardRuntime`
  负责 `engine + editor` 创建
- `useWhiteboardDocumentSync`
  负责 input document / outbound document / replace 同步
- `useWhiteboardCollab`
  负责 yjs session 生命周期和 callback 绑定
- `useWhiteboardRuntimeConfig`
  负责 `instance.configure(...)`

这样 `Whiteboard.tsx` 自己只保留：

- props normalize
- ref 暴露
- `InstanceProvider`
- `WhiteboardCanvas` 渲染

这一步不会直接减少 runtime 概念数量，但会明显降低根组件理解成本。

## 5.7 第六优先级：统一 registry contract，彻底删除 React 侧强转桥

建议把 node registry contract 统一成单一来源。

可选方式只有两种，二选一即可：

1. 让 React 直接使用 editor 暴露的 canonical registry type
2. 把 canonical registry contract 下沉到更中立的位置，再由 editor/react 共同引用

无论选哪种，都应达到同一个结果：

- `packages/whiteboard-react/src/runtime/instance/index.ts` 不再出现 `as unknown as`

---

## 6. 不建议继续投入的方向

为了避免“看起来在收口，实际上只是在搬代码”，下面这些方向不建议优先投入：

1. 继续压 `whiteboard-react/src/runtime/input/pointer.ts`
   这里已经是薄桥，不是复杂度来源。
2. 继续压 `useCanvasDown.ts`
   这里现在只是 handler fan-out 和 DOM bind，继续折腾收益很低。
3. 仅仅把 `pointer.ts` 拆成更多文件
   如果不引入统一 intent 模型，复杂度只是从一个文件移动到三个文件。
4. 把 shortcuts / clipboard 等 UI policy 全部推回 editor
   这些更接近宿主交互策略，不是当前全局复杂度源头。

---

## 7. 建议执行顺序

## Phase 1：Selection / Pointer 收口

目标：

- 建立 `readCanvasIntent(...)`
- 把 selection press 规划内聚到 pointer intent 阶段
- 把 `boxInteractive` 收进 `SelectionSnapshot`
- 删除 `SelectionIds` / `View` / `Source` 之类的重复别名
- 移除 `host.selection.planPress`

这是收益最大的一步，因为它同时减少：

- 选择建模重复
- pointer down 分支复杂度
- host 暴露面

## Phase 2：Editor 装配与类型面收口

目标：

- 拆分 `createEditor`
- 缩小 controller 依赖
- 收缩 `EditorHost`
- 降低 `InternalEditor` 在 feature session 中的扩散范围

这一步完成后，editor 内部的“整机依赖”会明显下降。

## Phase 3：React Bootstrap / Lifecycle 收口

目标：

- 把 `Whiteboard.tsx` 还原成组合根
- 把 collab/document sync/runtime config 拆成独立 hook
- 审查 React 对 `host` controller 的直接依赖，能转为语义 helper 的先转

这一步主要降低 React 根组件复杂度和跨包 runtime 耦合。

## Phase 4：Registry Contract 收口

目标：

- 统一 registry 类型来源
- 删除 `as unknown as EditorNodeRegistry`

这一步虽然实现量不大，但属于长期维护收益很高的清理项。

---

## 8. 最终判断

如果只回答“有没有可以全局收敛、减复杂度的地方”，答案是明确的：

**有，而且当前最值得做的是 editor 中段 runtime 的概念收口，而不是继续对 React 表层做局部微调。**

最关键的不是继续拆文件，而是把下面几条压实：

1. `selection` 只保留一套 canonical snapshot 和一套 press plan
2. `pointerdown` 只保留一条统一 intent 链
3. `createEditor` 从“大装配器”降为组合根
4. React 不再持续扩大对 `editor.host` 低层 session 的直接依赖
5. registry contract 不再通过强转桥接

如果要进入下一轮直接落地，建议从 **Phase 1：Selection / Pointer 收口** 开始。
