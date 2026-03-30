# Whiteboard Editor 去平台化整体方案

## 1. 结论

可以，而且长期最优就是：

- `whiteboard-editor` 不再持有任何浏览器平台能力
- 真正的宿主能力全部下沉到 host layer
- 当前默认 host layer 由 `whiteboard-react` 实现

但这里要强调一个边界判断：

- 不是把当前 `runtime/platform` 整个目录机械搬到 React
- 而是把其中真正的平台能力搬走
- 把误放在 platform 里的 editor 自身会话状态留在 editor

最典型的例子是当前 `createClipboardRuntime()`。

它虽然放在 [packages/whiteboard-editor/src/runtime/platform/clipboard.ts](./packages/whiteboard-editor/src/runtime/platform/clipboard.ts) 里，但它本质上是一个混合体，同时塞了三类东西：

- clipboard packet 的内存缓存
- 连续 paste 的摆放策略
- browser clipboard 失败时的兜底链路

这里真正的问题不是“它在 platform 目录里”，而是“这三件事根本不该在一个 runtime 里”。

长期最优应该拆成：

- `core` 负责 clipboard packet 与 slice 局部坐标模型
- `host` 负责 `ClipboardEvent` / `navigator.clipboard` / memory fallback
- `editor` 如确实需要连续 paste 避让，只保留独立的 `paste placement policy`

因此这次方案的正确目标不是：

```ts
把 platform 文件夹全挪到 react
```

而是：

```ts
editor 只保留纯 runtime / 纯命令与纯输入 DTO / 可选的独立 placement policy
host 负责所有浏览器能力与 DOM 解释
```

## 2. 当前问题

当前 editor 还没有真正做到“与平台无关”，问题不只在 `composePlatform.ts`。

### 2.1 `composePlatform` 混了两类东西

[packages/whiteboard-editor/src/runtime/editor/composePlatform.ts](./packages/whiteboard-editor/src/runtime/editor/composePlatform.ts) 当前同时装配：

- `clipboardPort`
- `selectionLock`
- `pointerContinuation`
- `clipboardRuntime`

其中前三个是平台能力，最后一个不是。

这会直接导致：

- `EditorPlatformRuntime` 概念不纯
- `composePlatform` 名字对，职责内容不对
- editor kernel 在装配平台时顺手装进了 editor 自己的会话状态

### 2.2 editor public input 直接暴露 DOM 类型

[packages/whiteboard-editor/src/types/editor.ts](./packages/whiteboard-editor/src/types/editor.ts) 当前的 public input 仍然直接接收：

- `HTMLDivElement`
- `PointerEvent`
- `KeyboardEvent`

这意味着 editor 不是“平台无关 runtime”，而是“浏览器事件直连 runtime”。

### 2.3 pointer 链路深度绑定 DOM

[packages/whiteboard-editor/src/runtime/input/pointer/index.ts](./packages/whiteboard-editor/src/runtime/input/pointer/index.ts) 当前 `PointerDown/Move/Up` 都包含：

- `container: HTMLDivElement`
- `event: PointerEvent`
- `capture: Element`

这不是抽象输入，而是浏览器事件和 DOM 引用本体。

### 2.4 interaction 层直接暴露原始浏览器对象

[packages/whiteboard-editor/src/runtime/interaction/types.ts](./packages/whiteboard-editor/src/runtime/interaction/types.ts) 当前仍然包含：

- `raw: PointerEvent`
- `capture?: (...) => Element | null`
- `keydown/keyup` 直接接收 `KeyboardEvent`

这说明 editor 的交互模型本身都还不是平台中立的。

### 2.5 pick runtime 本质上是 DOM registry

[packages/whiteboard-editor/src/runtime/pick.ts](./packages/whiteboard-editor/src/runtime/pick.ts) 当前通过：

- `WeakMap<Element, PickEntry>`
- `bind(element, pick)`
- `element(element, within)`

来做 hit target registry。

这本质上是宿主渲染树上的 DOM 绑定能力，不是 editor 核心能力。

### 2.6 keyboard 平台判断散落在 editor 内

[packages/whiteboard-editor/src/runtime/input/keyboard.ts](./packages/whiteboard-editor/src/runtime/input/keyboard.ts) 当前直接读取：

- `navigator.platform`

这意味着平台信息并没有形成单一真源，而是散落在 editor 内部。

### 2.7 React 与 editor 已经重复拥有宿主能力

当前 React 已经在做一整套宿主工作：

- [packages/whiteboard-react/src/canvas/usePointer.ts](./packages/whiteboard-react/src/canvas/usePointer.ts)
- [packages/whiteboard-react/src/canvas/useKeyboard.ts](./packages/whiteboard-react/src/canvas/useKeyboard.ts)
- [packages/whiteboard-react/src/canvas/useClipboard.ts](./packages/whiteboard-react/src/canvas/useClipboard.ts)
- [packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts](./packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts)

而 editor 同时又在内部保留了 platform bridge / selection lock / pointer continuation / keyboard platform detect。

这会造成：

- 浏览器能力重复拥有
- 责任边界不清
- editor 和 react 互相借 DOM
- 后续难以抽离非 React host

### 2.8 DOM target 语义当前是重复实现

editor 有：

- [packages/whiteboard-editor/src/runtime/input/domTarget.ts](./packages/whiteboard-editor/src/runtime/input/domTarget.ts)

react 有：

- [packages/whiteboard-react/src/canvas/domTargets.ts](./packages/whiteboard-react/src/canvas/domTargets.ts)

两边都在判断：

- editable target
- input ignored target
- keyboard ignored target
- context menu ignored target

这说明 DOM target 解释职责已经天然属于 host，只是还没有彻底下沉。

## 3. 目标架构

长期最优的分层应该是：

```ts
@whiteboard/core
  纯算法 / 纯模型 / 纯数据结构

@whiteboard/editor
  纯编辑 runtime / 纯状态机 / 纯命令 / 纯输入 DTO / editor session

@whiteboard/react
  默认浏览器 host
  DOM 事件绑定
  DOM 命中绑定
  浏览器 clipboard
  pointer capture / continuation
  document selection lock
  keyboard platform normalize
  text layout / DOM measure
```

如果未来需要非 React 的 DOM host，应该继续抽成：

```ts
@whiteboard/host-dom
```

但当前阶段先放在 `whiteboard-react` 内部是最合理的。

原因不是它“属于 React UI”，而是它“属于当前宿主层”。

## 4. 最终职责边界

## 4.1 `whiteboard-core`

保留：

- `ClipboardPacket`、slice import/export 数据模型
- packet parse / serialize
- 几何、命中、布局、选择、owner、snap 等纯算法
- 文本布局纯规则
- 任何不依赖宿主平台的逻辑

不放：

- `ClipboardEvent`
- `PointerEvent`
- `KeyboardEvent`
- `Element`
- `HTMLElement`
- `window` / `document` / `navigator`

## 4.2 `whiteboard-editor`

保留：

- engine/editor/runtime 装配
- interaction coordinator
- selection / frame / edit / viewport / projection
- commands 与会话状态
- 纯输入 DTO
- document import/export 语义
- clipboard packet 的 domain import/export
- 如产品确实需要，独立的 paste placement policy
- 纯 pick / interaction / command 读写模型

不保留：

- browser clipboard IO
- DOM event listener
- pointer capture / release
- window-level pointer continuation
- document selection lock
- DOM target 解析
- DOM pick registry
- keyboard platform detect
- 浏览器文本测量

## 4.3 `whiteboard-react`

保留并集中：

- DOM container event binding
- pointerdown / move / leave / up / cancel 绑定
- wheel batching 与 ResizeObserver
- keyboard focus / blur / shortcut 归一化
- clipboard event 与 `navigator.clipboard`
- clipboard memory fallback
- document selection lock
- pointer continuation / pointer capture
- pick registry
- DOM target 语义解释
- text layout / DOM measurement

注意：

- 这些东西应放在 `runtime/host` 或同等语义目录
- 不应散落在组件文件里
- React 只是当前 host 的承载者，不是这些能力的语义归属

## 5. 最终输入模型

这是整次去平台化最关键的一步。

### 5.1 当前错误模型

当前 editor input 实际上还是：

```ts
pointerDown({ container, event })
keyDown({ event })
clipboard.copy({ event })
```

也就是 editor 直接接浏览器对象。

### 5.2 最终正确模型

editor 只接纯 DTO：

```ts
type EditorPointerInput = {
  pointerId: number
  button: number
  buttons: number
  client: Point
  screen: Point
  world: Point
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
  pick: EditorPick
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
}

type EditorKeyboardInput = {
  key: string
  code: string
  repeat: boolean
  modifiers: {
    alt: boolean
    shift: boolean
    ctrl: boolean
    meta: boolean
  }
}

type EditorWheelInput = {
  deltaX: number
  deltaY: number
  ctrlKey: boolean
  metaKey: boolean
  client: Point
  screen: Point
  world: Point
}
```

这里的关键点：

- 没有 `PointerEvent`
- 没有 `KeyboardEvent`
- 没有 `Element`
- 没有 `HTMLDivElement`
- 没有原始 DOM target

host 必须先完成“浏览器解释”，再把纯输入喂给 editor。

## 6. 最终 pointer / interaction 设计

当前 pointer continuation、capture、selection lock 都在 editor 内。

长期最优应改成：

- host 负责 pointer capture
- host 负责 window-level pointer continuation
- host 负责 selection lock 生命周期
- editor 只负责 interaction 状态与输入推进

### 6.1 `pointerDown` 返回值要明确 host 行为

当前 `pointerDown` 只返回 `boolean`，信息太少。

长期最优应该改成：

```ts
type PointerDispatchResult = {
  handled: boolean
  continuePointer: boolean
}
```

host 据此决定是否：

- 开启 pointer continuation
- 对 root container 执行 pointer capture
- 打开 selection lock

### 6.2 interaction 不再暴露 `raw: PointerEvent`

[packages/whiteboard-editor/src/runtime/interaction/types.ts](./packages/whiteboard-editor/src/runtime/interaction/types.ts) 中的：

- `raw: PointerEvent`
- `capture?: (...) => Element | null`

都应删除。

对应改成：

- interaction 只接纯 pointer DTO
- capture 由 host 统一对 root container 处理

### 6.3 统一使用 root container capture

当前设计里 feature 可以决定 capture element，这会让 editor 反向依赖 DOM。

长期最优应该直接统一：

- host 永远对白板 root container 做 pointer capture
- editor 不再决定 capture target

这样可以直接删除：

- interaction registration 里的 `capture`
- pointer input 里的 `capture: Element`

这一步能显著简化整个交互模型。

## 7. 最终 pick 模型

当前 `pick` 在 editor 里维护 `WeakMap<Element, PickEntry>`。

长期最优应该把它完全下沉到 host。

### 7.1 host 持有 pick registry

host 负责：

- `bind(element, pick)`
- 从 DOM target 向上查找 pick
- 输出 `EditorPick`

### 7.2 editor 只接收 pick 结果

editor 最终只需要：

```ts
type PointerResolvedTarget = {
  pick: EditorPick
  field?: EditField
  editable: boolean
  ignoreInput: boolean
  ignoreSelection: boolean
  ignoreContextMenu: boolean
}
```

这意味着：

- `packages/whiteboard-editor/src/runtime/pick.ts` 应下沉 host
- `packages/whiteboard-editor/src/runtime/input/domTarget.ts` 应下沉 host
- `usePickRef` 一类 DOM 绑定 hook 继续留在 `whiteboard-react`

## 8. 最终 clipboard 模型

clipboard 不能再被建模成“一个 runtime 对象”。

当前模型最根本的问题不是 IO 放错层，而是内容语义和摆放语义混在了一起：

- packet 保存的是白板内容
- paste offset 保存的是交互摆放策略
- `readPastePoint()` 又把“本次贴到哪里”混成 clipboard runtime 的职责
- `document.insert(..., { at })` 还把 `at` 解释成“贴到 slice 中心”

这四件事叠在一起，才导致当前 paste 链路很绕。

长期最优必须改成四层清晰分离：

- `ClipboardPacket`
  白板内容的数据包，只描述“复制了什么”
- `ClipboardHostAdapter`
  宿主侧系统剪贴板适配器，只负责 IO
- `PastePlacementPolicy`
  可选的连续 paste 摆放策略，只负责“下次贴哪里”
- `InsertCommand`
  纯文档插入，只负责把局部 slice 平移回世界坐标

### 8.1 最小正确语义

clipboard 最小模型只需要回答两件事：

- 复制出来的内容是什么
- 这份内容在 paste 时如何还原几何关系

它不需要回答：

- 同一份内容第几次 paste
- 本次是否错开 24px
- paste 时是否级联偏移

这些都不是 clipboard content model。

### 8.2 `ClipboardPacket` 的最终数据模型

最终 `ClipboardPacket` 仍然保留在 `@whiteboard/core/document`，但语义要更严格：

```ts
type ClipboardPacket = {
  type: 'whiteboard/slice'
  version: 1
  slice: Slice
  roots?: SliceRoots
}
```

这里最关键的变化不是字段名，而是 `slice` 的坐标语义：

- `packet.slice` 不再是原始世界坐标
- `packet.slice` 必须是“以统一 origin 归一化后的局部坐标”

也就是说：

```ts
local = world - origin
world = targetOrigin + local
```

这样 packet 本身就是纯内容，不带任何 paste session 状态。

### 8.3 origin 不能只看 nodes，必须看整个 slice bounds

长期最优的 `origin` 不能定义成“多个 nodes 的左上角”，而应该定义成：

- `origin = sliceBounds.topLeft`

原因是 clipboard slice 不一定只有 nodes，还可能包含：

- 单独复制的 edge
- source / target 已经 detach 成 point 的 edge
- manual route points

所以统一 origin 必须从整个 slice 的 bounds 推导，而不是只从 node rect 推导。

换句话说：

- 用 node 集合的左上角做 origin，模型不完整
- 用整个 slice bounds 的左上角做 origin，模型才闭合

### 8.4 copy/export 的最终流程

copy/export 的最终流程应固定为：

1. 从当前选择导出世界坐标 slice
2. 计算整个 slice 的 bounds
3. 取 `origin = { x: bounds.x, y: bounds.y }`
4. 将所有空间字段统一减去 origin，转成局部坐标
5. 生成 `ClipboardPacket`

这里“所有空间字段”包括但不限于：

- `node.position`
- point edge endpoint 的 `point`
- manual route 的 `points`

`roots` 仍然保留，因为它解决的是：

- paste 后默认选中哪些节点/边
- root owner patch 时哪些是顶层根

这和几何归一化不是一层职责，所以不能删。

### 8.5 paste/import 的最终流程

paste/import 的最终流程应固定为：

1. host 决定一个 `targetOrigin`
2. editor 调用纯插入命令
3. core 将局部 slice 的所有空间字段统一加上 `targetOrigin`
4. editor 用 `roots` 决定 paste 后的 selection

也就是说，最终模型里：

- paste 时指针位置不是“slice 中心点”
- paste 时指针位置就是这份局部 slice 的 `(0, 0)` 落在世界中的位置

因此当前 `document.insert(slice, { at })` 这种中心锚点语义应该删除。

长期最优应该改成更直白的命名：

```ts
document.insertSlice(packet.slice, {
  origin: targetOrigin,
  ownerId,
  roots: packet.roots
})
```

如果内部仍然需要 duplication 这类“相对平移”能力，也应该单独保留：

```ts
document.insertSlice(slice, { delta })
```

而不是继续让 `at` 同时表达“目标位置”和“中心对齐规则”。

### 8.6 连续 paste 偏移不是 clipboard 的职责

当前的：

- `lastPasteKey`
- `lastPasteCount`
- `readPastePoint(base, zoom, packet)`

本质上都不是 clipboard content model，而是 paste placement policy。

长期最优有两个可选结论：

- 最小模型：彻底删除连续 paste 偏移，重复 paste 就重复贴到同一个 `origin`
- 产品策略模型：保留连续 paste 避让，但必须拆成独立的 `PastePlacementPolicy`

如果保留策略，这层也必须满足：

- 不写入 `ClipboardPacket`
- 不属于 `ClipboardHostAdapter`
- 不属于 `ClipboardPort`
- 不再叫 `clipboardRuntime`

最合适的位置是 editor 内部独立会话，例如：

- `runtime/paste/placement.ts`

它只接：

- `requestedOrigin`
- `packetKey`
- `zoom`

并返回：

- `resolvedOrigin`

但这是可选策略层，不是 clipboard 基础模型。

### 8.7 `ClipboardHostAdapter` 的最终职责

host 只负责系统剪贴板 IO：

- 读取 `ClipboardEvent`
- 写入 `ClipboardEvent`
- 读取 `navigator.clipboard`
- 写入 `navigator.clipboard`
- 在需要时保留 memory fallback

memory fallback 也应放在 host，而不是 editor。

原因是：

- 它是系统 clipboard 不可读/不可写时的宿主补偿策略
- 它不属于白板文档模型
- 它也不属于 editor 交互状态机

### 8.8 editor clipboard API 的最终形态

editor clipboard API 不再接 `ClipboardEvent`，也不再自己碰 `navigator.clipboard`。

最终 editor 只暴露 pure domain API，例如：

```ts
const packet = editor.clipboard.export(target)
editor.clipboard.insert(packet, {
  origin: targetOrigin,
  ownerId
})
```

或等价地：

```ts
const packet = editor.clipboard.cut(target)
editor.clipboard.paste(packet, {
  origin: targetOrigin,
  ownerId
})
```

核心要求只有两个：

- editor 只处理 packet 与 document insert
- host 只处理 event 与 system clipboard IO

### 8.9 `SliceInsertOptions` 的最终改法

当前 `SliceInsertOptions` 同时有：

- `at`
- `offset`

这两个字段长期看都不够清晰。

最终应改成二选一的明确语义：

- `origin`
  用于“把局部 slice 贴回世界坐标”
- `delta`
  用于“对现有 world/local slice 做纯平移”

其中：

- clipboard paste 走 `origin`
- duplicate 走 `delta`

这样以后任何调用方看到 API 都能立刻知道：

- `origin` 是锚点
- `delta` 是平移量

不会再出现现在这种“`at` 到底是左上角、中心点、还是别的锚点”的歧义。

## 9. 最终 keyboard 模型

keyboard 也要拆成两层。

## 9.1 platform detect 下沉 host

[packages/whiteboard-editor/src/runtime/input/keyboard.ts](./packages/whiteboard-editor/src/runtime/input/keyboard.ts) 当前 `detectPlatform()` 直接读 `navigator.platform`，这部分应移出 editor。

更优做法：

- host 检测平台
- 纯 shortcut normalize helper 接收 `platform` 参数
- 或者整个 shortcut map 构建都留在 host

## 9.2 editor 只接 normalized key DTO

editor 不再接 `KeyboardEvent`，而只接：

- `key`
- `code`
- `repeat`
- `modifiers`

如果 shortcut 系统继续保留在 editor 公共工具里，也必须改成纯对象输入，不再直接吃 `KeyboardEvent`。

## 10. viewport 与容器生命周期

viewport host 生命周期本来就已经主要在 React 侧。

典型证据：

- [packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts](./packages/whiteboard-react/src/runtime/viewport/useBindViewportInput.ts)

它已经在做：

- `getBoundingClientRect`
- `ResizeObserver`
- `window.blur`
- `wheel` batching

这说明 viewport 宿主输入天然应该属于 host layer，而不是 editor。

长期最优：

- editor 继续保留 viewport runtime 与坐标换算
- host 负责容器 rect、wheel listener、resize observer、blur cleanup

这一块不需要大改边界，只需要继续去掉 editor 内剩余的 DOM 类型依赖。

## 11. 文本测量与 platform 去耦的关系

文本测量已经是这次方向上的一个前置例子：

- 文本 layout 纯规则留在 `core`
- DOM 文本测量已经下沉到 `whiteboard-react`
- editor 只吃 `size` 结果

这条链路说明：

- “平台下沉到 host”
- “editor 只吃纯结果”

是完全可行的，而且已经有现实落地路径。

同样的原则应该扩展到：

- pointer
- keyboard
- clipboard
- pick

## 12. 目录重构建议

## 12.1 editor 中删除或重构

应删除：

- `packages/whiteboard-editor/src/runtime/editor/composePlatform.ts`

应下沉 host：

- `packages/whiteboard-editor/src/runtime/platform/selectionLock.ts`
- `packages/whiteboard-editor/src/runtime/platform/pointerContinuation.ts`
- `packages/whiteboard-editor/src/runtime/input/domTarget.ts`
- `packages/whiteboard-editor/src/runtime/pick.ts`

应拆分：

- `packages/whiteboard-editor/src/runtime/platform/clipboard.ts`

拆成：

- `packages/whiteboard-core/src/document/clipboard.ts`
  保留 packet / parse / serialize，并把局部坐标语义写死
- `packages/whiteboard-core/src/document/slice.ts`
  增加或重写 slice localize / insert by origin 能力
- host 内 `runtime/host/clipboard.ts`
  持有 `ClipboardEvent` / `navigator.clipboard` / memory fallback
- 如产品保留连续 paste 避让，editor 内单独新增 `runtime/paste/placement.ts`

应重写：

- `packages/whiteboard-editor/src/types/editor.ts`
- `packages/whiteboard-editor/src/runtime/input/pointer/index.ts`
- `packages/whiteboard-editor/src/runtime/interaction/types.ts`
- `packages/whiteboard-editor/src/runtime/interaction/coordinator.ts`
- `packages/whiteboard-editor/src/runtime/commands/clipboard.ts`
- `packages/whiteboard-editor/src/runtime/input/keyboard.ts`
- `packages/whiteboard-editor/src/runtime/editor/kernel.ts`
- `packages/whiteboard-editor/src/runtime/editor/createEditor.ts`

## 12.2 react 中新增 host layer

建议新增目录：

```ts
packages/whiteboard-react/src/runtime/host/
```

建议承载：

- `pointerSession.ts`
- `selectionLock.ts`
- `clipboard.ts`
- `pickRegistry.ts`
- `domTargets.ts`
- `keyboardPlatform.ts`
- `inputAdapter.ts`

当前已经存在但应收敛进 host 的逻辑：

- `canvas/usePointer.ts`
- `canvas/useKeyboard.ts`
- `canvas/useClipboard.ts`
- `runtime/viewport/useBindViewportInput.ts`
- `canvas/domTargets.ts`
- `features/node/textLayout.ts`

注意：

- 不是要求这些都变成一个“巨型 host 对象”
- 而是要求它们不再散乱，并且边界统一为 host runtime

## 13. public API 最终形态

## 13.1 `createEditor`

最终应删除：

- `platform?: EditorPlatformBridge`

因为 editor 不再负责平台注入。

## 13.2 `EditorPlatformBridge`

最终应删除整个类型。

当前它只是 platform 仍在 editor 的证据，不是长期稳定 public API。

## 13.3 `editor.input`

最终保留，但改成纯 DTO 入口：

```ts
editor.input.pointerDown(input)
editor.input.pointerMove(input)
editor.input.pointerUp(input)
editor.input.pointerCancel(input)
editor.input.pointerLeave()
editor.input.wheel(input)
editor.input.keyDown(input)
editor.input.keyUp(input)
editor.input.blur()
```

重点变化：

- 新增 `pointerUp`
- 新增 `pointerCancel`
- 输入不再接 DOM event

## 13.4 `editor.clipboard`

最终从“操作浏览器 clipboard”改成“操作 whiteboard clipboard packet / insert domain”。

它的职责应只剩：

- 导出 packet
- 导入 packet
- 在 cut 语义下组合导出与删除

不再负责：

- `ClipboardEvent`
- `navigator.clipboard`
- paste offset
- memory fallback

## 14. 分阶段实施顺序

虽然目标是一步到位的最终模型，但实际实施时最稳的顺序如下。

### 阶段 1：先清 API 入口

- 删除 `EditorPlatformBridge`
- 删除 `composePlatform`
- editor 不再创建 browser default service
- `createEditor` 改成纯 runtime 输入

### 阶段 2：把 input public type 改成纯 DTO

- `EditorPointerInput` 去 DOM
- `EditorKeyboardInput` 去 DOM
- interaction types 去掉 `raw`、`capture`
- host 先做 DTO 适配

### 阶段 3：下沉 pick 与 domTarget

- `pick.ts` 下沉到 react host
- `domTarget.ts` 与 `canvas/domTargets.ts` 合并
- React 先解析 `pick + ignore flags + editable field`

### 阶段 4：下沉 pointer continuation / selection lock

- host 统一 root container capture
- host 自己维护全局 move/up/cancel
- editor 不再知道 pointer capture

### 阶段 5：拆 clipboard

- 删除 `clipboardRuntime` 这个混合体
- `ClipboardPacket` 改成严格的局部坐标 packet
- `SliceInsertOptions.at` 删除，改为 `origin`
- duplication 等纯平移场景改用 `delta`
- 浏览器 clipboard IO 与 memory fallback 全移 host
- editor clipboard command 改成纯 export / insert packet
- 如确实需要连续 paste 错位，单独新增 `PastePlacementPolicy`

### 阶段 6：清 keyboard platform detect

- `navigator.platform` 移出 editor
- shortcut normalize 改成纯 helper
- host 负责平台判定

## 15. 是否应直接拆到 `whiteboard-react`

当前阶段答案是：应该。

更准确地说：

- 应先拆到 `whiteboard-react` 的 host layer
- 等 host 模型稳定后，再视情况抽 `@whiteboard/host-dom`

不建议现在为了“理论纯净”先新建独立包。

原因：

- 当前唯一宿主就是 React
- React 已经天然持有全部 DOM 生命周期
- 先在 `whiteboard-react` 收敛模型，成本最低
- 等边界稳定后再抽包，风险更小

## 16. 最终一句话方案

长期最优不是“editor 提供 platform bridge 给 React”，而是：

```ts
React host 解释浏览器
Editor 解释白板
Core 解释模型与算法
```

其中：

- 浏览器相关能力全部归 host
- editor 只接纯输入、纯结果与纯 domain API
- clipboard packet 只描述内容，不描述 paste 次数与偏移
- 如果要做连续 paste 避让，它也必须是独立 placement policy，而不是 clipboard runtime

这才是真正的 editor 去平台化。
