# Whiteboard 文本节点交互极简设计

## 结论

前一版设计偏复杂，根因是同时试图满足太多目标：

1. 第一次点击选中
2. 第二次点击编辑
3. 还想从文字内容区直接拖拽
4. 还不能影响 caret、toolbar、handles

这四个一起要，复杂度一定会上来。

如果目标是长期最优且概念尽量少，最好的取舍是：

1. 第一次点击选中
2. 第二次点击编辑
3. 拖拽只从 node frame 发起，不从文字内容区发起

这样设计最简单，也最稳。

## 最小状态模型

只保留 3 个概念：

1. `selection`
2. `edit`
3. `interaction`

### selection

只负责“当前选中了谁”。

不负责：

1. 这次点击是不是要进入编辑
2. 鼠标按下后是不是可能要拖拽

### edit

`edit` 必须是真实状态，不是一次性信号。

推荐模型：

```ts
type EditTarget =
  | { nodeId: NodeId; field: 'text' | 'title' }
  | null
```

含义很简单：

1. `null` 表示没有编辑中的文本
2. 非 `null` 表示当前正在编辑哪个节点、哪个字段

### interaction

只表示真实运行中的交互：

1. `node-drag`
2. `node-transform`
3. `selection-box`
4. `viewport-pan`
5. `edge-connect`
6. `edge-routing`
7. `mindmap-drag`

不要把“鼠标刚按下但还没确定是不是拖拽”也塞进去。

原因：

1. 一旦把按下预备态也算 interaction，handles 和 toolbar 就会在 click 阶段闪烁
2. `interaction` 应该只表示真实 session

## 极简交互规则

### 规则 1：点击未选中节点

行为只有一个：

1. `selection.replace([nodeId])`

不进入编辑。

### 规则 2：点击已单选节点的文字内容

行为只有一个：

1. `edit.start(nodeId, field)`

这里的 `field` 对应：

1. `text`
2. `title`

### 规则 3：点击 editor 内部

完全交给原生输入行为。

不能再触发：

1. node drag
2. selection replace
3. toolbar 消失再出现

### 规则 4：点击 editor 外部

行为只有一个：

1. `edit.clear()`

是否同时保持 selection，不需要额外复杂化。

推荐：

1. 清掉编辑态
2. selection 保持当前值

## 拖拽规则

这是最关键的简化点。

### 规则 1：拖拽只从 node frame 发起

文字内容区不负责拖拽，只负责：

1. 选中
2. 进入编辑

node frame 负责：

1. 拖拽
2. 多选拖拽

### 规则 2：`pointerdown` 不立即进入 `node-drag`

只有移动超过阈值后，才真正启动 `node-drag`。

这样可以直接解决两个问题：

1. 普通点击时，toolbar / handles 不会在按下时闪一下
2. 文本点击不会过早被 drag 逻辑抢走

### 规则 3：未超过阈值的按下抬起，就是 click

不用引入额外复杂术语，直接把它理解成：

1. 没拖起来，就是点击
2. 拖起来了，才是 drag

## 文本区域与 frame 的职责划分

这个划分建议明确写死，不要做成模糊策略。

### 文字内容区

职责只有：

1. 第一次点击选中
2. 第二次点击进入编辑

不负责：

1. 节点拖拽

### Node frame

职责只有：

1. 节点拖拽
2. 多选拖拽

不负责：

1. 进入文本编辑

## Chrome 显隐规则

这部分也不要复杂化。

只用下面这套规则：

### Handles

隐藏条件：

1. `edit !== null`
2. `interaction !== 'idle'`

其余情况正常显示。

### Node Toolbar

隐藏条件：

1. `edit !== null`
2. `interaction !== 'idle'`

其余情况按 selection 正常显示。

### 关键点

普通 `pointerdown` 阶段如果还没进入真实 drag，就不应该隐藏 chrome。

## renderer 该怎么做

文本类 renderer 不需要再自己维护一套独立 `editing` 真值。

最简单的做法是：

1. 是否显示 editor，直接看 `instance.read.edit.is(nodeId, field)`
2. 组件内部只保留 `draft`

也就是：

1. 全局决定“是不是在编辑”
2. 局部只处理“编辑中的输入内容”

这样结构最清楚。

## 为什么这个版本更好

因为它主动做了一个产品取舍：

1. 不支持从文字内容区直接拖拽节点

代价很小，但收益很大：

1. caret 行为稳定
2. 代码明显更少
3. 交互边界更清楚
4. toolbar / handles 不容易闪
5. renderer 不需要和 drag 竞争事件

## 最终建议

长期最优的极简方案就是：

1. 保留 `selection`、`edit`、`interaction` 三个状态概念
2. `edit` 改成真实持久状态
3. 文本区只负责选中和编辑
4. frame 只负责拖拽
5. `node-drag` 只有超过阈值后才启动
6. chrome 只在 `edit !== null` 或真实 interaction 中隐藏

## 一句话版本

最简单的设计不是把点击、编辑、拖拽都揉在一起，而是硬性拆开：

1. 文本区负责选中和编辑
2. frame 负责拖拽
3. `edit` 是状态
4. drag 过阈值才成立

这已经足够好，而且复杂度最低。

