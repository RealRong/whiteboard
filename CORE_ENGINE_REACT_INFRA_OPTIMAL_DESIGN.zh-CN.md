# Core / Engine / React 底层设施长期最优设计

## 1. 目标

这份文档回答的问题是：

在我们接下来要做的几条底层设施里，应该：

- 从零开始做
- 利用已有设施
- 还是与已有设施融合

并且要明确长期最优的边界，避免后续又回到：

- React hook 里继续堆规则
- engine 里塞进不该属于 engine 的交互语义
- core 里只有零散算法砖块，但没有高阶求解模型

本文结论基于当前代码现状，目标是：

- 概念尽量少
- 命名尽量短
- 层级关系清晰
- 规则只维护一份
- React 只保留边界职责

## 2. 总结结论

一句话结论：

**不应该从零重做。**

当前 `whiteboard-core` 和 `whiteboard-engine` 已经有一批质量不错的纯算法与读侧基建。真正缺的不是“更多底层目录”，而是少数几个高阶 solver / projector，把现有砖块拼成完整链路。

长期最优边界应为：

- `core`：纯求解、纯几何、纯投影、纯路径、纯命中
- `engine`：文档读查询、projection、command translate、write normalize
- `react runtime`：DOM 命中、pointer session、preview store、registry 语义

进一步压缩成一句话：

**`core` 算，`engine` 查，`react` 驱动。**

## 3. 判断标准

后续凡是遇到新能力，都用下面这套标准判断应该放哪一层。

### 3.1 应该进 core

满足下面任意一条，就优先放 `core`：

- 输入是纯数据，输出是纯数据
- 不依赖 DOM、不依赖 store、不依赖文档实例
- 同一规则可能同时被 React preview 和 engine command/normalize 复用
- 本质是 solver、projector、path、hit、route、layout、geometry

### 3.2 应该进 engine

满足下面任意一条，就优先放 `engine`：

- 需要读完整文档、索引、projection
- 需要把 command 翻译成 operation
- 需要维护 read cache / read index / read snapshot
- 需要做文档写后 normalize / finalize

### 3.3 应该留在 react runtime

满足下面任意一条，就优先留在 `react`：

- 命中来自 DOM 结构
- 依赖 pointer capture、event target、editable/input ignore
- 需要预览态、hover 态、RAF staged store
- 依赖 node registry 的 UI 语义，例如 `role / connect / hit / enter`
- 本质是交互路由，而不是文档规则

## 4. 当前已有设施盘点

## 4.1 已有的 core 纯算法设施

已经具备较强复用价值的底层能力主要有：

- `packages/whiteboard-core/src/node/transform.ts`
  - `computeResizeRect`
  - `projectResizePatches`
  - `computeNextRotation`
- `packages/whiteboard-core/src/node/group.ts`
  - `filterRootIds`
  - `expandGroupMembers`
  - `getGroupDescendants`
  - `hasGroupAncestor`
- `packages/whiteboard-core/src/node/move.ts`
  - `buildMoveSet`
  - `resolveMoveEffect`
- `packages/whiteboard-core/src/edge/connect.ts`
  - `resolveEdgeConnectQueryRect`
  - `resolveEdgeConnectTarget`
  - `resolveAnchorFromPoint`
- `packages/whiteboard-core/src/edge/endpoints.ts`
  - `resolveEdgeEnds`
- `packages/whiteboard-core/src/edge/view.ts`
  - `resolveEdgeView`
- `packages/whiteboard-core/src/edge/commands.ts`
  - `insertRoutePoint`
  - `moveRoutePoint`
  - `removeRoutePoint`
  - `moveEdgeRoute`
  - `moveEdge`
- `packages/whiteboard-core/src/edge/segment.ts`
  - `getNearestEdgeInsertIndex`
- `packages/whiteboard-core/src/node/hitTest.ts`
  - `getNodeIdsInRect`

这些能力说明：

- `core` 已经不是空壳
- 已经有纯算法砖块
- 缺的是高阶拼装层，而不是缺基础几何

## 4.2 已有的 engine 读写设施

已经具备较强扩展价值的引擎设施主要有：

- `packages/whiteboard-engine/src/read/store/index.ts`
  - read 装配中心
- `packages/whiteboard-engine/src/read/store/model.ts`
  - 文档到 read model 的缓存与切片
- `packages/whiteboard-engine/src/read/indexes/nodeRect.ts`
  - 节点矩形索引
- `packages/whiteboard-engine/src/geometry/nodeGeometry.ts`
  - 节点几何缓存
- `packages/whiteboard-engine/src/read/store/edge.ts`
  - edge projection 与 ends 复用缓存
- `packages/whiteboard-engine/src/write/translate/node.ts`
  - move/group/layout 等命令翻译
- `packages/whiteboard-engine/src/write/translate/edge.ts`
  - edge route / create / move 翻译
- `packages/whiteboard-engine/src/write/normalize/finalize.ts`
  - 写后 change diff / finalize 输入

这些能力说明：

- `engine` 已经适合作为 read query 和 command translate 的承载层
- 但它不适合承接 DOM 交互语义
- 也不适合变成 React preview solver 的直接承载层

## 4.3 已有的 react runtime 基建

当前 React 侧已有的可复用基建主要有：

- `packages/whiteboard-react/src/runtime/pick/index.ts`
  - WeakMap pick registry
- `packages/whiteboard-react/src/runtime/read/pick.ts`
  - 从事件读取 `PointerPick`
- `packages/whiteboard-react/src/runtime/interaction/snap.ts`
  - node snap / edge connect snap runtime
- `packages/whiteboard-react/src/features/node/session/node.ts`
  - node preview/hidden/hovered staged store
- `packages/whiteboard-react/src/features/edge/preview.ts`
  - edge patch/hint preview staged store

这些能力说明：

- React 侧已经具备 session + preview 的基础设施
- 不需要再额外发明新的“大 runtime”
- 只需要把规则从 hook 中抽离为纯求解模型

## 5. 四条链路的长期最优设计

## 5.1 Transform

### 现状

当前 `features/node/hooks/transform/session.ts` 的复杂度，不在几何本身，而在于 React 仍然自己维护：

- selection root 过滤
- group descendants 展开
- preview 参与者
- commit target 过滤

也就是说，`computeResizeRect` 和 `projectResizePatches` 已经存在，但缺一层真正的 transform solver。

### 最优设计

这条链路不应该从零做。

最佳方案是：

- 保留现有 `core/node/transform.ts` 里的低层几何函数
- 复用 `core/node/group.ts` 的 group 展开与 root 过滤函数
- 参照 `core/node/move.ts` 的形态，新增一个高阶 transform solver

它的职责应该是：

- 输入：
  - 当前 selection
  - handle
  - 起始 frame
  - pointer / delta
  - snap 结果
  - 节点列表或 read-backed candidates
- 输出：
  - `targets`
  - `patches`
  - `commitIds`
  - `hoveredContainerId`

### 放置位置

最优放置方式：

- 纯 solver：`core/node`
- 如果某一步必须依赖 read query，可由外层先提供输入数据
- React 只保留 session 和 preview write

### 不建议的做法

- 不建议继续在 React hook 里维护 preview/commit 两套规则
- 不建议把交互 transform solver 放进 engine normalize/finalize
- 不建议再加一层 transform runtime 封装现有 hook

### 结论

Transform 的最优策略是：

**融合现有 core 能力，补一个高阶 solver。**

不是重做，不是迁到 engine。

## 5.2 Edge Connect

### 现状

当前 `useEdgeConnectInput.ts` 已经复用了部分底层能力：

- 通过 `snap.edge.connect` 找连接目标
- 通过 `resolveAnchorFromPoint` 解析 anchor
- 通过 engine command 提交 `edge.create / edge.reconnect`

但 React hook 里仍然自己维护：

- create / reconnect 两套状态
- `from / to` draft end
- preview hint
- preview patch
- commit input

### 最优设计

这条链路也不应该从零做。

最优做法是：

- 以 `core/edge/connect.ts` 为中心继续扩展
- 把 connect 的生命周期统一成同一套 draft/projector

也就是：

- `create` 和 `reconnect` 只是在初始 state 上不同
- 后续 pointer 更新、snap 命中、preview 投影、commit 生成都走同一条纯逻辑

### 放置位置

最优放置方式：

- draft / projector / connect solver：`core/edge`
- engine 保持现有 command translate 不变
- React 只保留 pointer session + preview store write

### 不建议的做法

- 不建议新建一套 edge-connect runtime 概念
- 不建议把 preview hint / patch 生成继续散在 hook 内
- 不建议改掉已有的 engine edge commands，只为了适配 React hook

### 结论

Edge Connect 的最优策略是：

**强融合到现有 `core/edge`，把已有纯函数补齐为完整 connect 模型。**

## 5.3 Node Read Query

### 现状

当前 React 的 `runtime/read/node.ts` 仍然自己做了一部分语义查询：

- `frameAt`
- `idsInRect`
- group descendants contain/touch 判定
- draw/path hit
- shape outline/frame 差异

但 engine 侧已经有了：

- node geometry cache
- node rect index
- tree index
- edge projection
- read snapshot 机制

### 最优设计

这条链路也不应该从零做。

最优做法是：

- 沿用 engine 的 read index / geometry / projection
- 在 engine read 上补更高层的 semantic query
- React 只保留和 registry 强绑定的薄语义层

核心思想是：

- rect candidate、geometry cache、tree/query 主干在 engine
- registry 相关的 `role / hit / connect / enter` 留在 React façade

### 放置位置

最优放置方式：

- query 骨架：`engine/read`
- registry 语义拼接：`react/runtime/read`

### 不建议的做法

- 不建议在 React 里继续递归 group descendants
- 不建议为了语义查询再做一套新的 rect index
- 不建议硬把所有 hit 规则都塞回 engine，尤其是依赖 registry 的那部分

### 结论

Node Read Query 的最优策略是：

**利用已有 engine 读索引，再做薄融合。**

主干不重做，只把 React 侧重复判断继续往下压。

## 5.4 Press Target Normalization

### 现状

当前复杂度分散在：

- `runtime/input/pointer.ts`
- `runtime/selection/policy.ts`

两边都在重新解释 hit target：

- 它到底是哪个 node
- 是 group shell 还是普通 node body
- 当前 selection 下是 drag current selection 还是单点命中
- frame 语境下是否应离开 frame

### 最优设计

这条链路和前三条不同。

它**不应该进 core，也不应该进 engine**。

原因很简单：

- 它依赖 DOM pick
- 它依赖 editable / ignoreInput / ignoreSelection
- 它依赖当前 tool / frame / selection 的交互上下文
- 它不是文档规则，而是命中语义归一

最优做法是：

- 保留现有 pick registry
- 保留 `read.pick.from(...)`
- 在 `react runtime` 内增加一层 target normalization
- `pointer.ts` 和 `selection/policy.ts` 都只消费归一结果

### 放置位置

最优放置方式：

- `react/runtime/input` 或 `react/runtime/pick`

### 不建议的做法

- 不建议放进 engine
- 不建议抽成又一层宏大 interaction runtime
- 不建议继续让 `pointer.ts` 与 `selection/policy.ts` 分别维护自己的 owner 解析逻辑

### 结论

Press Target Normalization 的最优策略是：

**基于已有 React runtime 新做一层，但只放在 React。**

## 6. 一套统一的底层设施范式

从全局看，最优设计不是按功能造很多 runtime，而是统一成下面这套范式。

## 6.1 Core 范式

`core` 里的最佳设施形式应该是：

- `buildXxxSet`
- `resolveXxxEffect`
- `projectXxxPreview`
- `resolveXxxDraft`
- `matchXxxRect`
- `resolveXxxPath`

也就是：

- 输入纯数据
- 输出纯数据
- 不依赖实例
- 不依赖 store
- 不依赖 DOM

`core/node/move.ts` 已经是很好的样板。

未来的 transform / edge connect 都应该朝这个方向统一。

## 6.2 Engine 范式

`engine` 里的最佳设施形式应该是：

- `read.query.xxx`
- `read.index.xxx`
- `write.translate.xxx`
- `write.normalize.xxx`

也就是：

- 负责文档读写上下文
- 负责索引与 projection
- 负责命令翻译
- 不负责 DOM 命中语义

## 6.3 React 范式

`react` 里的最佳设施形式应该是：

- `session`
- `preview`
- `pick`
- `input`
- `registry façade`

也就是：

- 拿事件
- 读当前上下文
- 调用 core solver / engine query
- 写 preview
- 最终调用 commands

React 不应再自己成为规则中心。

## 7. 每条链路应采用的策略

把上面四条能力压成一句可执行的结论：

- `transform`
  - 策略：融合
  - 做法：沿用 `core/node/transform + group + move` 的模式，补高阶 solver
- `edge connect`
  - 策略：强融合
  - 做法：沿用 `core/edge/connect + endpoints + view + commands`，补统一 draft/projector
- `node read query`
  - 策略：利用已有 engine 基建，再做薄融合
  - 做法：沿用 engine read indexes / projection，不重建 query 主干
- `press target normalization`
  - 策略：在 React 内新做
  - 做法：基于现有 pick/runtime 统一命中归一，不下沉到 engine

## 8. 实施顺序

建议按下面顺序做：

1. `transform`
   - 最容易直接复用已有 core 能力
   - 收益最大
2. `edge connect`
   - 已有纯函数最多
   - 最适合继续融合
3. `node read query`
   - 把 React 读侧递归和判定继续下压
4. `press target normalization`
   - 最后统一 pointer 与 selection 的命中语义

这个顺序的好处是：

- 前三步都在减少 React 的业务规则
- 第四步再把 React 剩下的交互入口统一
- 整条链路会越来越线性，而不是越来越抽象

## 9. 反模式

后续改造时，明确避免下面这些方向。

### 9.1 不要为了“解耦”再造一层大 runtime

如果只是把现有 hook 包一层，再改个名字，不算真正优化。

### 9.2 不要把 DOM 命中语义塞进 engine

engine 负责文档与读写，不负责浏览器事件语义。

### 9.3 不要把 preview 与 commit 各写一套

preview 和 commit 最好来自同一个 solver / projector。

### 9.4 不要把 registry 强绑定语义硬塞进 core

`role / connect / hit / enter` 这种 UI 语义，如果本身来自 React registry，就不应强行拉到 core。

### 9.5 不要把 finalize 当成交互 solver

write normalize/finalize 负责文档一致性，不负责 pointer 交互实时求解。

## 10. 最终结论

这次底层设施建设的长期最优方案，不是“从零造新系统”，而是：

- 在 `core` 补高阶 solver / projector
- 在 `engine` 复用既有 read/index/translate 骨架
- 在 `react` 只保留 session / preview / DOM 命中归一

压缩成最终结论就是：

- `transform`：融合现有 core，补 solver
- `edge connect`：融合现有 core，补 draft/projector
- `node read query`：利用现有 engine，继续下压语义查询
- `press target normalization`：仅在 React runtime 内统一

这就是当前代码现状下，概念最少、职责最清晰、长期最优的设计。
