# Engine 对外 API 评审

## 范围

本文评审 `packages/whiteboard-engine` 当前真正对外暴露的 API，重点关注：

- 顶层导出
- `Instance` 结构
- `read` API
- `commands` API
- 运行时配置与生命周期
- 当前 API 是否已经达到长期最优
- 还可以如何继续收口与简化

本文只整理现状与方案，不在这一步改代码。

## 当前对外暴露面

### 1. 工厂函数

当前入口：

- `engine(options): Instance`

输入项：

- `document: Document`
- `config?: Partial<InstanceConfig>`
- `registries?: CoreRegistries`
- `onDocumentChange?: (doc: Document) => void`

评估：

- 入口面已经很小，这是优点。
- 必填输入清楚，初始化成本不高。
- 主要问题不是能力，而是命名风格。`engine(...)` 可以工作，但从行业习惯和可读性看，`createEngine(...)` 比裸名词工厂更清楚。
- 这不是架构问题，而是最终 public API 风格问题。

### 2. 返回的实例

当前结构：

- `config: Readonly<InstanceConfig>`
- `read: EngineRead`
- `commands: Commands`
- `configure(config: RuntimeConfig): void`
- `dispose(): void`

评估：

- 顶层结构已经比较干净。
- 四个域也比较清楚：`config`、`read`、`commands`、生命周期/运行时配置。
- 剩余噪音主要集中在 `configure()`，它当前混合了多个 runtime concern，而 `commands` 又已经承载了一部分操作型 concern，例如 history。

## Read API

### 1. 当前 read 结构

当前 `read` 面：

- `read.viewport: Viewport`
- `read.node.ids()`
- `read.node.get(nodeId)`
- `read.node.subscribe(nodeId, listener)`
- `read.node.subscribeIds(listener)`
- `read.edge.ids()`
- `read.edge.get(edgeId)`
- `read.edge.subscribe(edgeId, listener)`
- `read.edge.subscribeIds(listener)`
- `read.mindmap.ids()`
- `read.mindmap.get(treeId)`
- `read.mindmap.subscribe(treeId, listener)`
- `read.mindmap.subscribeIds(listener)`
- `read.index.node.*`
- `read.index.snap.*`
- `read.document`
- `read.subscribeViewport(listener)`

评估：

- `node / edge / mindmap` 三条读取链路已经收敛成统一形态，这是当前 API 里最优的一部分。
- 这一层已经比较符合漏斗原则：
  - 外部读取的是语义实体
  - 外部订阅的是实体级或 id 列表级变化
  - projection invalidation 没有泄漏到 public surface
- `read.index.node` 和 `read.index.snap` 也合理，因为它们服务的是交互时几何查询，而不是渲染订阅。

### 2. 已经接近最优的部分

#### `read.node / read.edge / read.mindmap`

这一层已经接近长期最优形态。

优点：

- 三个域完全统一
- 读取语义清楚
- 支持细粒度 UI 订阅
- 不再依赖 key-string 分发
- 不再把粗粒度 projection map 直接暴露给外部
- 自然鼓励 `ids + get(id)` 的消费方式

这明显优于之前的旧形态：

- `read('projection.node')`
- `READ_KEYS.node`
- `ids + byId` 作为一个整包粗视图

#### `read.index`

这一层也是合理的，应该保留。

原因：

- 它本质上是 runtime query surface，不是 render subscription surface
- 它支持热路径几何读取，不需要把几何能力下放到 UI
- 它避免 UI 层自己重复维护 hit-test / snap 逻辑

结论：

- `read.index` 不是噪音，是 runtime 能力边界的一部分

### 3. read API 还不够优的点

#### `read.subscribeViewport(listener)`

这一点已经从旧的 key-based 订阅收敛为显式 viewport 订阅，方向是对的。

当前形态：

- `read.viewport` 用于同步读取
- `read.subscribeViewport(listener)` 用于观察 viewport 变化

评估：

- 这个形态比 `READ_KEYS + read.subscribe(...)` 清楚得多
- 它和当前 read 体系是协调的：实体域走语义订阅，viewport 走显式订阅
- 这已经接近长期最优，不需要再保留字符串 key 订阅抽象

剩余可选优化：

- 如果追求绝对对称，也可以进一步改成 `read.viewport.get()` + `read.viewport.subscribe()`
- 但从热路径读取 ergonomics 看，保留 `read.viewport` 属性更实用

我的判断：

- 当前 `read.viewport + read.subscribeViewport(listener)` 已经是合理终态

#### 问题 B：`read.document` 把原始 document 暴露得过于直接

当前状态：

- `read.document` 直接暴露整个 `Readonly<Document>`

这很实用，但从架构上看有噪音。

问题在于：

- 它会绕过语义化 read surface
- 它鼓励外部 ad hoc 读取 document 结构
- 它会削弱前面刚建立起来的漏斗边界
- UI 层更容易依赖 raw document，而不是稳定 projection/query API

它什么时候合理：

- 调试
- import/export 适配
- 少量 headless 集成

它什么时候不理想：

- 正常 UI 渲染
- 正常交互逻辑
- 已经有语义 read API 的场景

建议：

- 不要把 `read.document` 当成主路径
- 要么保留，但明确标记为 escape hatch
- 要么从主 `read` 面挪出去

更干净的长期形态：

- `document.get()` 作为逃生口，比 `read.document` 更清楚

我的判断：

- 从纯度上看，`read.document` 不是最优
- 从工程实用性看，保留一个 raw snapshot escape hatch 是可以接受的
- 但如果保留，应该在文档里明确说明它不是主读取入口

## Commands API

### 1. 当前结构

当前 `commands` 面：

- `commands.document.replace(doc)`
- `commands.history.get()`
- `commands.history.undo()`
- `commands.history.redo()`
- `commands.history.clear()`
- `commands.node.*`
- `commands.edge.*`
- `commands.viewport.*`
- `commands.mindmap.*`

### 2. 已经不错的部分

#### `commands.node / commands.edge / commands.viewport`

这三块总体是协调的。

优点：

- 按域组织
- 命令式调用清楚
- 对 UI 集成友好
- 和当前 write pipeline 对齐

其中这些能力都是合理的：

- `updateMany`
- `order.*`
- `edge.routing.*`

#### `commands.history.undo / redo / clear`

这部分也可以接受。

虽然 `history.get()` 严格说是 read，但它和 undo/redo/clear 属于一个操作域，放在一起是工程上合理的。

### 3. commands API 还不够优的点

#### `commands.document.replace(doc)`

这一点已经从 `load / replace` 收敛成单一 document-set API，方向是正确的。

当前形态：

- `commands.document.replace(doc)`

评估：

- 现在 public 语义已经集中成一个动作：替换 engine 当前 document snapshot
- `notifyChange` 作为附加策略，比 `load / replace` 这种双命令名更清楚
- 这和实际实现语义是一致的，减少了外部对 integration policy 的猜测成本

我的判断：

- 当前 `commands.document.replace(doc)` 更接近长期最优
- 如果后续还要进一步收口，最多只需要考虑是否把 `notifyChange` 改成更短的 `notify`

#### `commands.mindmap.*`

这一点也已经从 `mindmap.apply(command)` 摊平成语义方法，方向正确。

当前形态示例：

- `commands.mindmap.create(...)`
- `commands.mindmap.addChild(...)`
- `commands.mindmap.insertPlacement(...)`
- `commands.mindmap.moveDrop(...)`
- `commands.mindmap.moveRoot(...)`
- `commands.mindmap.toggleCollapse(...)`

评估：

- 这比泛化 `apply(command)` 更符合整个 engine 现有的 public API 风格
- 外部不再需要理解内部 command union
- 自动补全、discoverability、调用可读性都更好

我的判断：

- 当前 `commands.mindmap.*` 已经是正确方向
- 剩余问题不在于是否语义化，而在于方法数量较多，后续只需要继续评估是否还要按使用频率做进一步收口

#### 问题 C：`commands.history.get()` 放在 commands 下略有别扭，但问题不大

这是一个轻微问题，不是优先项。

别扭点：

- `get()` 是 read 语义
- `commands` 大部分是 mutation 语义

为什么又可以接受：

- history 本来就是操作域，不是 projection 域
- `undo / redo / clear / get` 放在一起，使用上很自然

我的判断：

- 这一点可以先不动
- 如果你追求极致纯度，后面再收也不迟

## Runtime 配置 API

### 1. 当前结构

当前：

- `configure({ mindmapLayout, history })`

### 2. 优点

- runtime-only concern 有一个统一入口
- 没有把 runtime option 混进 document 数据结构

### 3. 问题

#### 问题 A：`configure()` 混合了不属于同一语义层的 concern

当前混在一起的是：

- history runtime policy
- mindmap layout runtime option

它们虽然都属于 runtime，但并不是同一个语义域。

问题在于：

- 当前 concern 数量还少，所以问题不严重
- 但一旦以后 runtime concern 增多，这个入口会越来越像杂物间
- 调用方也会被迫传一个混合 bag object

#### 问题 B：`RuntimeConfig` 的类型比实际意图更硬

从语义上说，runtime 配置更新更像 partial patch。

更合理的形态是：

- `configure(options: Partial<RuntimeConfig>)`

这样更符合真实调用意图。

### 4. 最优方向

两个方向都成立：

方案 A：保留一个 `configure()`，但改成 partial

- `configure({ history?, mindmapLayout? })`

方案 B：按 concern 拆开

- `configureHistory(config)`
- `configureMindmapLayout(layout)`

我的判断：

- 如果目标是减少 public API 数量，方案 A 更合适
- 如果目标是语义极致清晰，方案 B 更好

结合你整体“尽量收口、不随便增加顶层域”的方向，我更建议：

- 保留一个 `configure(partialRuntimeConfig)`
- 只有当后续 runtime concern 明显变多时，再拆分

## 生命周期 API

当前：

- `dispose()`

评估：

- 这是标准而且干净的设计
- 不需要额外优化

## 常量与类型导出

当前还导出了：

- `DEFAULT_DOCUMENT_VIEWPORT`
- `DEFAULT_INSTANCE_CONFIG`
- `NodeViewItem`
- `EdgeEntry`
- `MindmapViewTree`

评估：

### 合理的导出

- `DEFAULT_DOCUMENT_VIEWPORT`
- `DEFAULT_INSTANCE_CONFIG`
- `NodeViewItem`
- `EdgeEntry`
- `MindmapViewTree`

这些都具体且有用。

### 已完成移除的旧导出

- `READ_KEYS`

说明：

- 这一项已经从 public API 中移除
- viewport 订阅已改为显式的 `read.subscribeViewport(listener)`

## 当前实际消费方式

从 `whiteboard-react` 当前调用看，engine 对外 API 的真实使用方式大致是：

- 渲染期语义读取：
  - `read.node.ids()`
  - `read.node.get(id)`
  - `read.edge.ids()`
  - `read.edge.get(id)`
  - `read.mindmap.ids()`
  - `read.mindmap.get(id)`
- 热路径几何查询：
  - `read.index.node.*`
  - `read.index.snap.*`
  - `read.viewport`
- 写入：
  - `commands.node.*`
  - `commands.edge.*`
  - `commands.viewport.*`
  - `commands.history.*`
  - `commands.document.replace(doc)`
  - `commands.mindmap.*`
- runtime 配置：
  - `configure({ history, mindmapLayout })`

这个消费模式很关键，因为它说明哪些 API 是核心主路径，哪些只是架构迁移后暂时遗留的壳。

## 当前 API 是否已经最优

短结论：

- 已经比之前好很多
- 但还没有到最终最优形态

已经接近最优的部分：

- `read.node`
- `read.edge`
- `read.mindmap`
- `read.index`
- `commands.node`
- `commands.edge`
- `commands.viewport`
- `dispose()`

还没有最优的部分：

- `read.document` 作为一等成员
- `configure(RuntimeConfig)` 当前精确形态

## 推荐目标 API

如果完全不考虑兼容成本，只追求长期最优，对外 API 最适合收敛成下面这个样子。

### Factory

- `createEngine(options)`

### Instance

- `config`
- `read`
- `commands`
- `configure(partialRuntimeConfig)`
- `dispose()`

### Read

- `read.viewport`
- `read.subscribeViewport(listener)`
- `read.node.ids()`
- `read.node.get(id)`
- `read.node.subscribe(id, listener)`
- `read.node.subscribeIds(listener)`
- `read.edge.ids()`
- `read.edge.get(id)`
- `read.edge.subscribe(id, listener)`
- `read.edge.subscribeIds(listener)`
- `read.mindmap.ids()`
- `read.mindmap.get(id)`
- `read.mindmap.subscribe(id, listener)`
- `read.mindmap.subscribeIds(listener)`
- `read.index.node.*`
- `read.index.snap.*`
- 可选逃生口：`document.get()` 或 `readDocument()`

### Commands

- `commands.document.replace(doc)`
- `commands.history.get()`
- `commands.history.undo()`
- `commands.history.redo()`
- `commands.history.clear()`
- `commands.node.*`
- `commands.edge.*`
- `commands.viewport.*`
- 语义化的 `commands.mindmap.*`

### Configure

- `configure({ history?, mindmapLayout? })`

## 后续优化优先级

如果你后面继续优化 public API，优先级建议是：

1. 把 `configure()` 改成 partial runtime config 语义
2. 把 `read.document` 明确降级为 escape hatch
3. 可选地把工厂名从 `engine(...)` 改成 `createEngine(...)`

## 最终判断

当前 engine 对外 API 已经足够扎实，完全可以继续稳定承接 UI。

真正剩下的 public API 噪音，其实只集中在四个点：

- raw document 读取暴露得太直接
- runtime configure 语义还可以更收口
- 工厂命名还可以更行业化
- `document.set` 的选项命名还可以再斟酌

除这几处之外，其余主路径已经接近正确形态。
