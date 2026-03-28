# Whiteboard Editor 瘦脸方案

## 1. 文档目标

这份文档只回答一个问题：

**`packages/whiteboard-editor` 应该怎么继续收口，才能让 editor 本身更薄、更稳、更像真正的 runtime 单点。**

这里说的“瘦脸”，不是简单删文件，也不是把实现拆得更碎，而是同时解决下面四类问题：

1. editor 公共 API 面过宽，暴露了太多 runtime 细节。
2. editor 组装层过厚，`createEditor.ts` 承担了过多 wiring 和生命周期职责。
3. 输入链、`read`、`commands` 仍然是散件拼装，跨域依赖太多。
4. 根导出面仍把部分内部类型和 feature 状态直接暴露给外部。

这份方案默认当前方向不变：

- `whiteboard-react` 继续做 DOM 绑定和 UI 组合。
- `whiteboard-editor` 继续做行为决策、交互 session、业务 view model 和命令收口。
- 不优先追求兼容期“双轨保留”，优先明确长期最优边界。

---

## 2. 结论

当前 editor 最重的问题，不是某一个 feature 文件太大，而是 **editor 的“脸”太宽**：

- 公共 `Editor` 暴露了 `host`。
- `EditorRuntime` 继续暴露 `engine / interaction / registry / internals`。
- `createEditor.ts` 同时做平台桥接、状态创建、read 组装、session 创建、commands 组装、commit 生命周期、reset/dispose。
- 输入链虽然已经从 React 收回 editor，但内部仍然保留了偏厚的“读输入 -> 判定 -> 路由到 feature session”总装逻辑。
- `read` 和 `commands` 还是 God factory，参数一长串，说明 editor 还缺更高层的 domain runtime 边界。

长期最优的 editor，公共形态应该只保留：

```ts
type Editor = {
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewport
  configure: (config: EditorConfig) => void
  dispose: () => void
}
```

其中：

- `commands` 只负责语义写入和显式行为命令。
- `input` 只负责宿主输入入口。
- `read/state` 只负责读事实。
- `host/internals/engine/registry/interaction` 都不应该继续属于公共 editor 脸面。

一句话说：

**editor 的瘦脸，不是优先删 feature，而是优先把“公共 editor”“内部 runtime”“平台桥接”“输入路由”这四层重新切开。**

---

## 3. 当前 editor 为什么胖

## 3.1 `createEditor.ts` 是第一胖点

`packages/whiteboard-editor/src/runtime/editor/createEditor.ts` 当前同时承担了这些职责：

- 创建浏览器默认 host bridge：clipboard、selection lock、pointer continuation
- 创建 viewport / interaction / pick / snap
- 创建 stores / state / read / internals
- 创建 feature sessions：marquee、selection gesture、draw、transform、edge connect、edge input、mindmap drag、context
- 创建 input commands
- 创建 editor commands
- 订阅 engine commit 并执行 finalize
- 负责 `resetUiSessionState`
- 负责 `dispose`
- 最终总装 `editor.host`、`editor.internals`、`editor` 本体

对应代码可以直接看到：

- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:185`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:315`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:334`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:346`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:372`

这说明现在的 `createEditor.ts` 不是“入口文件”，而是“整个 editor runtime 的总装配车间”。一旦任何一个域增加依赖，第一落点就是这里。

## 3.2 `createDeferredEditor()` 说明组装边界还不干净

`createEditor.ts` 里还有一个明显信号：

- `createDeferredEditor()` 通过 `Proxy` 先造一个假的 `EditorRuntime`
- 再把这个 deferred editor 传给各类 session
- 最后 editor 完整创建后再 `bind`

对应位置：

- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:84`

这类 deferred proxy 的本质是：

- session 初始化时需要 editor
- editor 初始化时又需要 session

也就是说，现在很多 feature session 依赖的是“整个 editor”，而不是它们实际需要的最小 runtime context。这会继续放大 editor 的表面积，也让装配顺序更脆。

## 3.3 公共 `Editor` 和内部 `EditorRuntime` 没切开

`packages/whiteboard-editor/src/runtime/editor/types.ts` 当前有两个明显问题：

第一，公共 `Editor` 还带着 `host`：

- `packages/whiteboard-editor/src/runtime/editor/types.ts:323`

第二，`EditorRuntime` 继续暴露：

- `engine`
- `interaction`
- `registry`
- `internals`

对应位置：

- `packages/whiteboard-editor/src/runtime/editor/types.ts:342`

更具体地说，`EditorHost` 本身就已经很重：

- `interaction`
- `viewport`
- `pick`
- `snap`
- `selection.marquee`
- `selection.gesture`
- `draw`
- `node.transform`
- `edge.preview/connect/input`
- `mindmap.drag/controller`

对应位置：

- `packages/whiteboard-editor/src/runtime/editor/types.ts:298`

这意味着外部如果拿到 `editor`，实际上拿到的是“半个 runtime 内脏”，而不是一个干净的 editor 门面。

## 3.4 `commands.input` 暗示输入边界还没真正定型

当前输入入口还放在 `commands` 名下：

- `packages/whiteboard-editor/src/runtime/editor/types.ts:102`
- `packages/whiteboard-editor/src/runtime/commands/input.ts:11`

但 `input` 的语义本质上不是“命令写入”，而是“宿主事件入口”：

- `pointerDown`
- `pointerMove`
- `pointerLeave`
- `keyDown`
- `keyUp`
- `blur`
- `cancel`

这类 API 更适合顶层 `editor.input.*`，而不是 `editor.commands.input.*`。否则 `commands` 语义会继续混杂：

- 一部分是真正的 document/selection/tool/viewport 命令
- 一部分只是 host event ingress

从长期看，这会让 editor 的概念边界继续发胖。

## 3.5 输入链已经进步，但概念仍偏多

`packages/whiteboard-editor/src/runtime/input/pointer.ts` 现在已经从之前的 if/else 巨链收成了 route table，但仍然保留了偏厚的概念层：

- `InteractionStart`
- `InteractionDecision`
- `InteractionRoute`
- `ContextOpen`
- `readInteractionStart`
- `resolveInteractionDecision`
- `runInteractionDecision`

对应位置：

- `packages/whiteboard-editor/src/runtime/input/pointer.ts:37`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts:45`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts:71`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts:127`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts:235`
- `packages/whiteboard-editor/src/runtime/input/pointer.ts:283`

而且判定依然是 feature-specific 的：

- `isDrawInteractionStart`
- `isEraseInteractionStart`
- `isEdgeCreateInteractionStart`
- `isEdgeInteractionStart`
- `isMindmapInteractionStart`
- `isTransformInteractionStart`
- `isSelectionInteractionStart`
- `isInsertInteractionStart`

这条链已经比以前更清晰，但还没有压到“单一输入、单一决策、单一 action owner”的最简形态。

## 3.6 `createEditorCommands()` 还是散件拼装

`packages/whiteboard-editor/src/runtime/commands/index.ts` 当前创建 commands 时，仍需要一长串离散依赖：

- `engine`
- `read`
- `state`
- `tool`
- `history`
- `edit`
- `selection`
- `frame`
- `viewportCommands`
- `viewportRead`
- `draw`
- `nodeRuntime`
- `input`
- `context`
- `clipboardRuntime`
- `clipboardPort`
- `readPointerWorld`

对应位置：

- `packages/whiteboard-editor/src/runtime/commands/index.ts:34`

这说明 `commands` 还不是按 domain runtime 装配，而是靠一个“超级工厂”把散件串起来。只要 editor 再多一个能力，这个构造函数还会继续横向变宽。

## 3.7 `createRuntimeRead()` 也是总装型厚读层

`packages/whiteboard-editor/src/runtime/read/index.ts` 当前同时负责：

- node item projection
- node interaction read
- edge projection
- bounds 派生
- selection read 派生
- context read 聚合
- frame read 聚合
- pick read 聚合
- tool read 聚合

对应位置：

- `packages/whiteboard-editor/src/runtime/read/index.ts:61`

这不是“read 多一点没关系”，而是说明 editor 目前缺少更上层的 domain read runtime。于是所有 read 派生都被压回一个大组装文件。

## 3.8 `context.selection` 的接线仍有回填感

`createEditorStores()` 里目前先造：

```ts
const contextSelection = createValueStore<SelectionMenuView | null>(null)
```

然后再：

```ts
read.context.selection = createSelectionMenuRead({
  editor,
  selection: read.selection
})
```

对应位置：

- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:138`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts:153`

这说明 read 组合还不够纯：

- 先占位
- 再回填

这类接法短期可用，但长期会放大装配顺序耦合，也会让“read 到底是不是纯读层”变得不够稳定。

## 3.9 根导出面还在暴露过多内部概念

`packages/whiteboard-editor/src/index.ts` 现在仍然直接导出：

- `EditorHost`
- `EditorPointerDownInput`
- `features/draw/state` 的一批状态和 helper
- `runtime/selection` 的内部状态类型
- `runtime/context` 的完整 view type 集

对应位置：

- `packages/whiteboard-editor/src/index.ts:1`

尤其 `draw/state.ts` 这一类 feature 内部状态，用户之前已经明确指出过导出过多，这里的问题依然成立：

- 包根导出面承载了过多 feature 内部建模
- 外部更容易依赖到本不该稳定的类型
- editor 自己想继续收口时，会被历史导出反向拖住

---

## 4. 瘦脸的设计原则

## 4.1 先收边界，再收实现

第一步不是改算法，也不是删 feature，而是先把下面几层边界切开：

1. 公共 editor API
2. editor 内部 runtime
3. browser host bridge
4. feature session

如果边界没先收好，任何“拆文件”最后都只是把复杂度摊开，而不是减少复杂度。

## 4.2 `commands` 和 `input` 必须分家

长期最优里：

- `commands` = 显式语义写入
- `input` = 宿主输入入口

也就是说：

- `editor.commands.selection.replace()` 是合理的
- `editor.commands.node.delete()` 是合理的
- `editor.input.pointerDown()` 是合理的
- `editor.commands.input.pointerDown()` 则是语义混杂

这不是命名洁癖，而是为了避免 editor 把“输入绑定协议”和“业务命令协议”继续混在一起。

## 4.3 公共 editor 不能再暴露 session/host 内脏

长期最优里，不应该通过公共 `editor` 直接触达这些对象：

- `marquee`
- `gesture`
- `transform`
- `edgeInput`
- `edgeConnect`
- `snap`
- `pick`
- `interaction`

这些都属于 runtime 内部协作对象，不属于宿主依赖的稳定 API。

## 4.4 输入决策只决定“谁接手”，不决定整套 feature 概念树

最简输入模型里，pointer 主链应尽量收成三步：

1. 读取统一的 `PointerStart`
2. 解析出一个 `PointerAction`
3. 把控制权交给该 action owner

关键点是：

- 决策层只判断“这次由谁接手”
- action 自己负责启动 session
- 不在 dispatcher 里塞 feature-specific 的次级概念树

这也和前面的 selection 最简思路一致：

- `hold` 不应该被建成复杂协议
- selection action 自己内部只需明确：
  `hold = clear selection + contain marquee`

## 4.5 `read/commands` 要按 domain runtime 装配，不要继续靠超长参数列表

后续 editor 内部应当逐步形成更稳定的 domain runtime，例如：

- `documentRuntime`
- `selectionRuntime`
- `nodeRuntime`
- `edgeRuntime`
- `drawRuntime`
- `contextRuntime`
- `inputRuntime`

这样 `createEditorCommands()` 和 `createRuntimeRead()` 依赖的是几个收好的 domain object，而不是十几项散件。

## 4.6 根导出只保留稳定公共概念

包根的职责不是“哪里方便就 export 哪里”，而是只暴露那些长期愿意维护稳定的概念。

对于 editor 来说，长期稳定的通常只有：

- editor 创建入口
- editor 公共类型
- tool / shortcut / toolbox 的公共能力
- 少量明确公共的 context view 类型

凡是带内部 session、内部 state、内部 wiring 痕迹的类型，都应该退出根导出。

---

## 5. editor 的目标形态

## 5.1 公共 API 目标

建议把公共 `Editor` 收成：

```ts
type Editor = {
  read: EditorRead
  state: EditorState
  commands: EditorCommands
  input: EditorInput
  viewport: EditorViewport
  configure: (config: EditorConfig) => void
  dispose: () => void
}
```

这里最重要的变化有两点：

1. 增加顶层 `input`
2. 删除公共 `host`

如果迁移期需要兼容，可以短期保留：

```ts
editor.commands.input === editor.input
```

但这只能作为过渡，不应该成为最终形态。

## 5.2 内部 runtime 目标

editor 内部仍然可以保留更丰富的 runtime 对象，但它应该明确成为内部装配结构，而不是外部公开 API：

```ts
type EditorRuntime = {
  engine: EngineInstance
  registry: NodeRegistry
  platform: EditorPlatform
  runtime: {
    interaction: InteractionCoordinator
    pick: PickRuntime
    snap: SnapRuntime
    clipboard: ClipboardRuntime
    context: ContextRuntime
    input: EditorInputRuntime
    selection: SelectionRuntime
    node: NodeRuntime
    edge: EdgeRuntime
    draw: DrawRuntime
    mindmap: MindmapRuntime
  }
}
```

重点不是字段名，而是原则：

- runtime 可以厚
- public editor 必须薄

## 5.3 `createEditor.ts` 的目标职责

最终 `createEditor.ts` 应只保留：

1. 读取参数
2. 调用几个子装配器
3. 返回公共 editor

建议拆成类似这些层：

- `runtime/editor/createEditorPlatform.ts`
- `runtime/editor/createEditorStores.ts`
- `runtime/editor/createEditorRead.ts`
- `runtime/editor/createEditorCommands.ts`
- `runtime/editor/createEditorInput.ts`
- `runtime/editor/createEditorLifecycle.ts`
- `runtime/editor/createEditorPublic.ts`

这样 `createEditor.ts` 本体应该接近“目录页”，而不是逻辑主战场。

## 5.4 输入模型目标

pointer 主链建议收成：

```ts
readPointerStart(editor, container, event)
resolvePointerAction(editor, start)
runPointerAction(editor, action)
```

其中：

- `PointerStart` 是统一输入
- `PointerAction` 是单一动作决策
- `runPointerAction` 只是把控制权交给 owner

长期最优里，不再鼓励：

- 每个 feature 发明自己的专属 input 类型
- 在 dispatcher 层维护过多 feature-specific `Decision` 概念
- 让 React 或宿主知道 `edgeInput / gesture / marquee / transform` 这些内部 session 名字

## 5.5 `read` 目标分层

长期最优建议把 editor read 收到下面几类稳定域：

- `read.document`
- `read.node`
- `read.edge`
- `read.selection`
- `read.context`
- `read.tool`
- `read.viewport`
- `read.frame`
- `read.pick`

重点不是 namespace 数量，而是每个 namespace 都应有明确 owner，不要继续让 `runtime/read/index.ts` 负责把全部派生逻辑混在一起。

## 5.6 `commands` 目标分层

长期最优建议 `commands` 收敛为这些域：

- `commands.document`
- `commands.selection`
- `commands.node`
- `commands.edge`
- `commands.draw`
- `commands.tool`
- `commands.viewport`
- `commands.clipboard`
- `commands.context`
- `commands.insert`

并把 `input` 从 `commands` 中拿出来，变成顶层 `editor.input`。

---

## 6. 分阶段落地方案

## 阶段 1：先收公共 API 脸面

目标：

- 让 React 和其他宿主只依赖稳定的 editor 门面
- 停止把 runtime 内脏继续扩散到外部

具体动作：

1. 在 editor 顶层建立 `editor.input`
2. 把 `commands.input` 标记为兼容别名，后续删除
3. 从公共 `Editor` 类型中移除 `host`
4. `EditorRuntime` 改为 internal-only，不再从包根导出
5. `EditorHost` 改为 internal-only
6. React 侧只允许依赖：
   - `editor.read`
   - `editor.state`
   - `editor.commands`
   - `editor.input`
   - `editor.viewport`
   - `editor.dispose`

这一阶段做完，editor 至少先“脸面变窄”。

## 阶段 2：拆薄 `createEditor.ts`

目标：

- 去掉总装大文件
- 让 platform / runtime / public editor / lifecycle 各归各位

具体动作：

1. 把 browser host bridge 创建移到 `createEditorPlatform`
2. 把 stores/state/read 创建拆出
3. 把 feature session 创建拆到专门的 runtime 装配层
4. 把 `finalize` 订阅、`resetUiSessionState`、`dispose` 拆到 lifecycle 层
5. 让 `createEditor.ts` 只做 orchestration

建议顺手解决的点：

- 把所有 `cancel/clear/reset` 收到统一 lifecycle runtime
- `dispose()` 内部统一完成 session cancel、subscription cleanup、engine dispose

## 阶段 3：去掉 deferred editor proxy

目标：

- 让 feature session 只依赖最小 runtime context
- 去掉 `Proxy` 式延迟绑定

具体动作：

1. 识别各 session 真正依赖的最小能力
2. 为 session 提供最小 runtime context，而不是整块 `EditorRuntime`
3. 去掉 `createDeferredEditor()`

这一阶段很关键，因为它会直接迫使 editor 内部边界变清楚。只要 deferred proxy 还存在，就说明内部依赖图还在绕。

## 阶段 4：统一输入链

目标：

- 输入层只做统一读入和 action owner 分发
- 不再让 dispatcher 维护一棵 feature-specific 概念树

具体动作：

1. 把 `InteractionStart` 收口为统一 `PointerStart`
2. 把 `InteractionDecision` 收口为单一 `PointerAction`
3. 把 `resolveInteractionDecision()` 改成 `resolvePointerAction()`
4. 把 `runInteractionDecision()` 改成 `runPointerAction()`
5. 把“谁负责处理这次 pointer”作为唯一决策结果
6. selection action 内部自己处理 `tap / drag / hold`

这里要强调：

- `hold` 不应该再作为一层复杂协议扩散出去
- 只需在 selection action 内明确：
  `hold = clear selection + contain marquee`

## 阶段 5：按 domain runtime 重组 `commands`

目标：

- 让 `createEditorCommands()` 不再接十几项离散依赖

具体动作：

1. 建立 `documentRuntime`
2. 建立 `selectionRuntime`
3. 建立 `nodeRuntime`
4. 建立 `edgeRuntime`
5. 建立 `drawRuntime`
6. 建立 `contextRuntime`
7. 建立 `clipboardRuntime`

然后由 `createEditorCommands()` 依赖这些 runtime，而不是直接依赖所有底层 store/session/port。

## 阶段 6：按 domain runtime 重组 `read`

目标：

- 让 read 派生不再全挤在 `runtime/read/index.ts`
- 去掉“先占位、再回填”的组装味道

具体动作：

1. 把 node/edge/selection/context/frame/pick/tool 的 read 组合拆为各自装配器
2. `read.context.selection` 改为直接派生，不再先造空 store 再回填
3. 明确哪些 read 依赖 engine，哪些 read 依赖 runtime session
4. 让 `createRuntimeRead()` 退化为薄壳组合层

## 阶段 7：清理根导出面

目标：

- 停止把内部 feature state 和 runtime 类型继续暴露到包根

具体动作：

1. `src/index.ts` 只保留稳定公共导出
2. `EditorRuntime`、`EditorHost` 退出根导出
3. `draw/state.ts` 的公共类型迁到更清晰的公共入口，避免直接暴露 feature 内部文件
4. `runtime/selection` 的内部状态类型不再从包根直接导出
5. `runtime/context` 里只保留真正需要给 React/宿主消费的 view type

---

## 7. 哪些先不要动

为了避免“看起来做很多，实际上只是换位置”，下面这些不是第一优先级：

## 7.1 不要一上来大规模合并 feature

当前最大问题不是 feature 文件数量，而是 editor 边界太宽。先把 API 和组装层收好，再决定 feature 内部是否继续合并。

## 7.2 不要先改成更抽象的输入框架

例如一上来引入一套更重的 interaction DSL、通用状态机框架，通常只会让 editor 更胖。现在真正需要的是减少概念，不是增加抽象层。

## 7.3 不要继续让 React 反向依赖 editor internals

只要 React 还读 `host`、`internals` 或 feature session，editor 就不可能真正瘦下来。React 这边已经基本收口，后续不要再倒退。

## 7.4 不要把 browser host bridge 直接做成公共 editor 能力

`clipboard port`、`selection lock`、`pointer continuation` 这些应该属于 editor 的 platform/runtime 内部，而不是宿主看到的公共 editor API。

---

## 8. 建议的执行顺序

如果按“收益最大、回归最小”的顺序推进，建议这样做：

1. 先建立顶层 `editor.input`，同时把 React 全部切到这个入口
2. 隐藏 `EditorHost / EditorRuntime` 的公共导出
3. 拆薄 `createEditor.ts`
4. 去掉 deferred editor proxy
5. 收口 pointer 主链为 `PointerStart -> PointerAction -> run`
6. 重组 `commands`
7. 重组 `read`
8. 最后清理包根导出面和 feature 公共入口

这个顺序的好处是：

- 先收公共边界，避免外部继续依赖旧内脏
- 再改内部 wiring，不容易反复返工
- 最后再做导出清理，破坏面最可控

---

## 9. 完成后的判断标准

editor 是否真的瘦下来，可以用下面几个标准判断：

1. `Editor` 公共类型里不再出现 `host`、`internals`、`engine`、`registry`
2. React 不再依赖任何 editor 内部 session 名字
3. `createEditor.ts` 只剩薄组装逻辑
4. `commands` 不再含 `input`
5. `pointer` 决策层只负责把控制权交给 action owner
6. `createEditorCommands()` 和 `createRuntimeRead()` 的参数量明显下降
7. 包根导出面不再直接暴露内部 feature state/runtime 类型

只要这七条还没成立，就说明 editor 还没有真正瘦脸完成。

---

## 10. 最终判断

当前阶段，`whiteboard-react` 基本已经进入“继续局部打磨”的状态，而 `whiteboard-editor` 仍然是下一阶段最值得收口的主战场。

最重要的不是继续在 editor 上叠 feature，而是先把下面三件事做实：

1. 公共 editor 变薄
2. `createEditor.ts` 变薄
3. 输入、`read`、`commands` 的装配边界变清楚

如果这三件事做到位，后续无论是继续简化 pointer -> selection 主链，还是继续压缩 draw / edge / node / context 的内部复杂度，都会顺很多。

如果这三件事不先做，后面每加一个能力，editor 都只会继续横向长胖。
