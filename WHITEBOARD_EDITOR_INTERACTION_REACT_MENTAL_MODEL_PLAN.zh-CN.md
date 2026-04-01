# WHITEBOARD_EDITOR_INTERACTION_REACT_MENTAL_MODEL_PLAN.zh-CN

## 文档目标

这份文档专门回答一个问题：

- 为什么同样的交互，如果直接写在 React 组件里，看起来只需要 `useState`、`pointermove`、`setState`
- 而到了 `whiteboard-editor` 里，概念就会变多，链路就会变长

同时，这份文档给出一套长期最优的答案：

- **怎样把 editor 的交互模型，压缩到尽可能接近 React 局部状态的认知复杂度**

这里强调的是：

- 不是“把 editor 改回 React 组件实现”
- 而是“让 editor 的心智模型像 React 局部交互一样顺”

这份文档不考虑兼容和过渡。
只讨论长期最优。

---

## 最终结论

当前 `whiteboard-editor` 的交互线，确实还不是认知上最简单的形态。

问题不在于：

- editor/headless runtime 天生就必须比 React 复杂很多

问题在于：

- 我们还没有把真正必需的复杂度，收敛成一条很短的主线
- 反而保留了不少“为了组织代码而产生”的中间概念

长期最优里，editor 的交互主线应该只剩下面这几个稳定概念：

1. `input`
   - 外部输入语义
2. `owner`
   - 当前谁来接这次交互
3. `session`
   - 当前交互的局部运行状态
4. `overlay`
   - 临时预览状态
5. `commands`
   - 最终提交到文档的写入

如果某条交互链路里，明显超出这五个概念，通常都要继续收。

也就是说，长期最优不是：

- 再增加新的“中轴”“model”“controller”“projection runtime”

而是：

- **让 editor 的交互心智模型接近 `useRef + setState + commit`**

---

## 为什么 React 写法看起来简单

先把这个感觉解释清楚。

一个典型的 React 局部交互，大概是这样：

```ts
const sessionRef = useRef<DragSession | null>(null)
const [preview, setPreview] = useState<DragPreview | null>(null)

const onPointerDown = (event: PointerEvent) => {
  sessionRef.current = startDrag(event)
}

const onPointerMove = (event: PointerEvent) => {
  if (!sessionRef.current) return
  setPreview(stepDrag(sessionRef.current, event))
}

const onPointerUp = () => {
  if (!sessionRef.current) return
  commitDrag(sessionRef.current)
  sessionRef.current = null
  setPreview(null)
}
```

它为什么看起来非常顺？

因为大量复杂度被同一个局部作用域吃掉了。

### React 局部实现天然折叠了这些边界

- 会话状态就是一个 `ref`
- 临时显示就是一个 `state`
- 渲染天然消费这个 `state`
- 事件监听和视图组件在同一个上下文里
- 没有跨 runtime 的命名压力
- 没有“对外稳定 API”压力
- 没有 headless host 复用压力
- 没有必须把“算法”和“渲染”拆成跨包边界的压力

于是很多本来客观存在的东西，在 React 里都不需要被单独命名。

这就是它“看起来简单”的根本原因。

不是业务真的更简单。

而是：

- **复杂度被包在一个局部组件上下文里，没有被显式展开**

---

## React 的简单，哪些是真简单，哪些只是被折叠了

这里要区分两类简单。

### 1. 真简单

有些简单是真的长期值得追求的：

- 主线短
- 数据流直接
- 一次 pointer move 只做一次 step
- 预览态和提交态区分明确
- 会话状态只存在一个地方
- 看代码时能一眼看到 `down -> move -> up`

这些都是真简单。

editor 应该尽量做到。

### 2. 被局部作用域折叠出来的简单

有些简单只是因为 React 组件替你吞掉了边界：

- 事件监听和视图渲染不分家
- 预览态天然等于本组件 state
- 不需要抽出 headless 对外输入语义
- 不需要抽出统一 command 写入口
- 不需要抽出跨包纯算法

这些简单不是 editor 可以直接照抄的。

因为 `whiteboard-editor` 的目标不是：

- 写一个 React 局部组件

而是：

- 写一个可被 host 驱动、可独立于 React 存活、可把纯算法下沉到 core 的 editor runtime

所以我们不能追求“实现形态像 React”。

我们应该追求：

- **认知复杂度接近 React**

---

## editor 为什么会比 React 多一些概念

这部分是客观必须存在的复杂度。

### 1. 文档状态和预览状态必须分开

在 React 局部组件里，很多时候你可以直接 `setState`。

但 editor 里不行。

原因是：

- 文档状态是持久语义
- 预览状态是临时语义

这两者必须分开。

否则会立刻污染：

- undo/redo
- 协作一致性
- command 语义
- 文档读模型

所以 editor 必须有一个“临时态”和“提交态”的边界。

长期最优里，这个边界就是：

- `overlay`
- `commands`

### 2. 输入语义和渲染宿主必须分开

React 组件里可以直接拿 DOM 事件对象算。

但 editor 不应该依赖 React DOM 或浏览器 target 结构。

所以：

- host 负责把 DOM/input 解析成 editor 输入语义
- editor 只消费语义化输入

这就天然会多一个边界。

### 3. 谁拥有当前交互，需要统一仲裁

React 局部组件里，一个组件常常天然知道自己是不是当前交互拥有者。

editor 里不行。

因为同一份 pointerdown 可能同时和这些 owner 竞争：

- viewport pan
- selection
- edge
- draw
- insert

所以 editor 必须有：

- owner 仲裁
- 当前 session 归属

这个边界也是客观存在的。

### 4. 纯算法和运行时 glue 最好分开

像这些东西，本质上是纯算法：

- move preview
- transform preview
- snap threshold
- edge route patch

它们长期最优应该下沉到 `whiteboard-core`。

于是 editor 里就天然会保留一层：

- runtime glue

这层也是真实需要的。

---

## 现在为什么还是显得太复杂

问题在于，除了上面这些必需复杂度，我们还叠加了不少“非必需复杂度”。

这才是你感觉不顺的根因。

---

## 非必需复杂度 1：会话模型没有真正收敛

React 写法里，局部交互天然有一个很清楚的东西：

- `sessionRef.current`

它就是当前交互的唯一局部状态。

但在 editor 里，很多链路仍然会把这个会话拆成：

- start input
- state
- projection
- preview
- commit input

于是一次拖拽主线，会变成很多名字：

- `NodeDragInput`
- `NodeDragStart`
- `NodeDragState`
- `computeProjection`
- `applyProjection`
- `buildCommit`

这就不是产品复杂度，而是装配复杂度。

长期最优应该是：

- 一个 `session`
- 一个 `step`
- 一个 `finish`

如果一条交互不是这个形状，就说明还没收干净。

---

## 非必需复杂度 2：把局部行为拆成了很多“中间概念”

很多当前概念，并不是用户能感知到的稳定产品模型。

它们更像是：

- 为了把代码拆开而命名的中间层

例如某些链路里会出现：

- `projection`
- `runtime state`
- `feature context`
- `starter`
- `resolver`
- `phase`

这些概念并不是永远都不该存在。

但如果它们变成阅读交互主线时必须跨过的层，就会造成认知阻塞。

你看到的不是：

- 这次拖拽怎么开始、怎么更新、怎么提交

而是：

- 一堆结构在彼此传参

这就和 React 局部交互“顺着读”的感觉完全相反。

---

## 非必需复杂度 3：把真正应该留在 owner 里的复杂度搬到了抽象层

最典型的坏味道是：

- 为了“统一”，建立很重的全局交互 model/context/controller 层

这样做的结果往往不是复杂度减少，而是复杂度搬家。

原本属于 `selection` 自己的复杂度：

- press
- marquee
- drag
- transform

被搬到一个更抽象的中间层后，文件表面短了，但系统整体更难读。

长期最优里，复杂度应该保留在它真实所属的 owner 内部。

也就是说：

- `selection` 的复杂度就留在 `selection`
- `draw` 的复杂度就留在 `draw`
- `edge` 的复杂度就留在 `edge`

不要再提升成新的中间轴。

---

## 非必需复杂度 4：很多对象只是为了“传过去”

如果一个对象被创建出来，只是为了继续传给下一个 helper，而且并没有形成稳定语义，那它通常就该消失。

例如这类对象都要被严格怀疑：

- `XxxStart`
- `XxxInput`
- `XxxProjection`
- `XxxRuntimeState`

不是说这些命名一定错。

而是说：

- 如果它们只是为了接线存在，就不该稳定存在

长期最优里，真正值得保留的对象应该只有两类：

### 1. 领域对象

例如：

- `MoveSession`
- `TransformSession`
- `SelectionTarget`
- `EdgeConnectSession`

### 2. 对外边界对象

例如：

- `PointerDownInput`
- `PointerMoveInput`
- `CommandInput`
- `OverlayState`

除此之外的大量中间对象，都应该尽量内联或删除。

---

## 长期最优：把 editor 交互压缩成 React 式心智模型

长期最优里，editor 交互应该遵循下面这个公式：

```ts
pointerdown -> start session
pointermove -> step session -> overlay.set(preview)
pointerup -> finish session -> commands.commit(...)
cleanup -> overlay.clear()
```

这就是整个系统最应该接近的交互主线。

它和 React 的对应关系非常直接。

### React 对应关系

- `useRef` -> `session`
- `useState` -> `overlay`
- 组件事件处理器 -> `owner`
- 最终业务写入 -> `commands`

也就是说，长期最优并不是不要 runtime。

而是要把 runtime 做到：

- **本质上像一个没有 JSX 的 React 局部交互组件**

---

## 最小稳定概念模型

从整个 editor 来看，长期最优的交互模型应该只保留下面这些稳定概念。

---

## 1. `input`

`input` 是 editor 的外部输入语义。

它的职责只有：

- 表达 pointer / wheel / keyboard 的语义化输入

它不负责：

- 解释业务
- 选择 owner
- 管理 preview

长期最优里：

- DOM target 解析留在 React/host
- editor 只接收已经语义化的输入

---

## 2. `owner`

`owner` 是“谁有资格接这次交互”的概念。

它的职责只有：

- 决定这次 `pointerdown` 是否由自己接管
- 如果接管，返回一个 session
- 如果不接管，返回 `null`

它本质上相当于：

- 一个局部交互组件的入口函数

例如：

- `selection`
- `draw`
- `edge`
- `viewport`

长期最优里，owner 不应该再拆出太多上层包装概念。

不应该再让人读到：

- host
- feature runtime
- capsule
- feature context assembler

才看到真正的交互逻辑。

---

## 3. `session`

`session` 是当前交互的唯一局部运行状态。

它是整个模型里最重要的概念。

它对应 React 里的：

- `ref.current`

长期最优里，一个 owner 启动后，应该尽快落到一个清楚的 session 上。

例如：

- `MoveSession`
- `TransformSession`
- `DrawStrokeSession`
- `EdgeConnectSession`

而不是：

- `start input`
- `working state`
- `projection`
- `commit payload`

四五层并存。

### session 的设计原则

- 只保存跨 step 复用的数据
- 不保存只是为了接线的冗余字段
- 不把 UI overlay 直接塞进 session
- 不把 command payload 当成 session
- 一条交互最好只有一个主 session

---

## 4. `overlay`

`overlay` 是 editor 的临时预览状态。

它对应 React 里的：

- `useState`

但和 React 不同的是，这里是 editor 级全局预览态，而不是组件局部 state。

长期最优里，所有临时可视反馈都应该进 `overlay`：

- node preview
- edge preview
- marquee
- mindmap drag
- snap guides
- draw preview

不要再并列保留多套 transient/feedback runtime。

### overlay 的职责只有一个

- 承接 session step 的结果，供渲染层消费

它不负责：

- 推导业务
- 持有交互 ownership
- 计算命中
- 计算 preview

这些都不属于 overlay。

---

## 5. `commands`

`commands` 是文档最终写入口。

它对应 React 里的：

- 最终业务提交

例如：

- `commands.node.move(...)`
- `commands.edge.updateMany(...)`
- `commands.selection.replace(...)`

长期最优里，所有写入都从这里走。

但要注意：

- `commands` 只是提交入口
- 它不应该承担 preview 计算
- 它不应该承担交互会话构建

---

## 6. `read`

严格说，`read` 不是交互主轴里的核心概念。

它更像：

- 一个环境读取口

React 组件里，这部分通常被局部闭包和 props 吞掉了。

到了 editor 里，因为需要脱离 React 存活，所以它要显式存在。

但长期最优里：

- `read` 只应该作为 session/owner 的环境依赖
- 不应该变成一个额外的交互概念层

也就是说，读代码时你首先应该看到：

- session 在做什么

而不是：

- read 子树上有哪些能力

---

## 7. `InteractionRuntime`

`InteractionRuntime` 长期应该非常薄。

它的职责只有：

- 管 pointer down 的 owner 仲裁
- 持有当前 running session
- 把 move/up/key/wheel 路由给当前 session 或 observe owner
- 维护少量全局交互状态，比如 `mode`

它不应该做：

- feature 业务推导
- preview 计算
- command 组织
- feature 上下文拼装

它就是一个很薄的调度壳。

这和 React 里的高层事件分发很接近。

---

## “最小交互公式”如何映射到今天的代码

为了让这件事更具体，下面直接给出映射关系。

### React 局部组件模型

```ts
const sessionRef = useRef(null)
const [preview, setPreview] = useState(null)

down -> sessionRef.current = start(...)
move -> setPreview(step(sessionRef.current, input))
up -> commit(sessionRef.current)
cleanup -> setPreview(null)
```

### editor 长期最优模型

```ts
owner.start(input) -> session = startX(...)
session.move(input) -> result = stepX(session, input) -> overlay.set(result.preview)
session.up() -> commands.apply(finishX(session))
session.cleanup() -> overlay.clear()
```

两者本质是一回事。

差别只是：

- React 把这些都包在组件局部
- editor 要把这些变成 headless runtime 的稳定边界

所以 editor 需要比 React 多一点概念，但不应该多很多。

---

## 长期最优里的 interaction 文件应该长什么样

如果一条交互线已经达到长期最优，它的文件大致应该长这样：

```ts
export const createMoveInteraction = (ctx: Ctx, input: PointerDownInput) => {
  let session = startMoveSession({
    nodes: ctx.read.index.node.all(),
    edges: ctx.read.index.edge.all(),
    startWorld: input.world,
    target: ...
  })

  if (!session) {
    return null
  }

  const project = (world: Point, allowCross: boolean) => {
    const result = stepMoveSession({
      session,
      pointerWorld: world,
      allowCross,
      snap: ctx.snap.node.move
    })

    session = result.session
    ctx.overlay.set(mapMoveOverlay(result))
  }

  return {
    mode: 'node-drag',
    move: (next) => {
      project(next.world, next.modifiers.alt)
    },
    up: () => {
      applyMoveCommit(ctx.commands, finishMoveSession(session))
    },
    cleanup: () => {
      clearMoveOverlay(ctx.overlay)
    }
  }
}
```

这个结构的重点是：

- 读主线非常短
- 业务 session 和 UI overlay 是分开的
- 计算都在 `start/step/finish`
- interaction 文件只是 adapter

这就是最接近 React 心智模型的 editor 结构。

---

## 哪些概念应该继续被删

如果目标是把复杂度压回到 React 式认知水平，下面这些东西应该继续收紧。

---

## 1. 只为传参存在的中间对象

例如：

- `XxxStart`
- `XxxInput`
- `XxxProjection`
- `XxxCommitInput`

如果它们不是稳定领域对象，就应删除或内联。

---

## 2. 只为拆文件存在的 helper

如果一个 helper 不形成独立语义，只是把原来 20 行拆成 3 个函数，那么它可能反而更难读。

长期最优里，应优先保留：

- 领域纯函数
- 真正复用的通用函数

而不是：

- 只在本文件用一次、只是为了“层次感”的 helper

---

## 3. 重型全局 context / model / controller

如果一条交互需要一个很厚的全局中轴才能工作，通常说明复杂度被搬错地方了。

长期最优里：

- 公共依赖只保留一个很薄的 `ctx`
- 复杂度留在 owner 自己的 session 和 core 纯算法里

---

## 4. 把 overlay 当成业务模型

overlay 是显示态，不是业务态。

如果某个交互必须先把数据写进 overlay，再从 overlay 反推业务，那模型一定有问题。

长期最优里，应该是：

- session -> overlay
- session -> commands

而不是：

- session -> overlay -> business

---

## 什么复杂度一定不要删错

在极简化的时候，也要避免把真正需要的边界删掉。

下面这些复杂度是应该保留的。

### 1. `overlay` 和 `commands` 的分离

这是文档语义和预览语义的根本边界。

不能为了“像 React”就混成一份状态。

### 2. owner 仲裁

多交互竞争是白板 editor 的基本事实。

不能假装它不存在。

### 3. core 纯算法下沉

如果把算法重新塞回 editor/React，只会让 runtime 和 UI 再次纠缠。

### 4. host 解析输入语义

editor 不应该重新碰 DOM target 和 React event 细节。

---

## 这一套长期最优模型下，当前系统还应继续怎么改

如果完全以“接近 React 认知复杂度”为目标，后续演进应遵循下面的顺序。

---

## 第 1 步

继续把交互主逻辑压缩为：

- `start`
- `step`
- `finish`

凡是不符合这个形状的 interaction，都继续重构。

优先级最高的是：

- `selection drag`
- `transform`
- `edge connect`
- `draw`

---

## 第 2 步

把真正的会话型纯算法下沉到 `whiteboard-core`。

尤其是：

- move session
- transform session
- edge connect / reconnect session

editor 不再自己造会话状态。

---

## 第 3 步

继续收紧 `InteractionRuntime`，让它只保留：

- owner 仲裁
- current session
- 路由
- 少量全局 mode 状态

不要再让它长成 feature runtime 的装配中心。

---

## 第 4 步

继续统一 overlay，把所有临时显示态彻底压到一个总 overlay 下。

不再并列长出：

- transient runtime
- feedback runtime
- preview state controller

---

## 第 5 步

把 interaction 文件改造成“短主线 + 少 helper”的风格。

理想状态下，阅读一个 interaction 文件时，应该在第一页内就看到：

- 怎么 start
- 怎么 move
- 怎么 finish
- overlay 怎么写
- commands 怎么提

而不是先看 6 个中间 helper 和 5 个中间对象。

---

## 最终判断标准

如果未来某条交互线已经改到长期最优，那么检查它是否足够简单，可以看下面这几个问题。

### 1. 我能不能在 30 秒内看懂它的主线？

也就是是否能快速看到：

- down
- move
- up
- cleanup

### 2. 它有没有唯一 session？

如果一条交互同时维护多份“像 session 又不像 session”的状态，那通常还没收好。

### 3. 它的 overlay 是不是纯显示？

如果 overlay 反过来参与业务推导，就说明边界混了。

### 4. 它的 commit 是不是直接来自 session？

如果 commit 还要重新读取外部、重新组装大量数据，说明 session 设计还不完整。

### 5. 它有没有太多只为传参存在的对象？

如果有，继续删。

### 6. 它的认知复杂度，是否接近 React 局部交互？

也就是能不能把它概括成：

- 一个局部 session
- 一个 preview state
- 一个 commit

如果可以，这条线就基本对了。

---

## 一句话总结

React 里的交互之所以顺，不是因为业务真的没有复杂度，而是因为：

- 它把复杂度包进了一个局部组件上下文里

`whiteboard-editor` 的长期最优，不是模仿 React 的实现形式，而是模仿 React 的认知结构：

- **一个局部 session**
- **一次 step 产出 preview**
- **一次 finish 产出 commit**

剩下的边界，只保留 editor 真正客观需要的那些：

- 输入语义
- owner 仲裁
- overlay
- commands
- core 纯算法

做到这一步，editor 的复杂度仍然会比 React 局部组件稍高，但会变成“必需复杂度”，而不是现在这种“中间层噪音复杂度”。
