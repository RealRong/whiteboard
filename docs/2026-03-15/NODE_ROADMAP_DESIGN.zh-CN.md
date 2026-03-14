# Node 路线图设计

## 结论

当前基建已经可以开始新增不同种类的 node。

这里的“可以开始”不是指所有 node 都已经零成本，而是指：

- 渲染注册体系已经具备扩展能力
- 拖拽、缩放、旋转、连接、选择、viewport、transient 这些基础交互已经基本成型
- UI 侧 resolved 数据链路已经比前期清楚很多
- read projection 也已经有了可用的运行时读取模型

所以现在不需要再继续大规模补底层，完全可以开始进入“新增 node 类型”的阶段。


## 当前已经具备的基础能力

### 1. Node 注册与渲染

当前已经有：

- `packages/whiteboard-react/src/node/registry/nodeRegistry.tsx`
- `packages/whiteboard-react/src/node/registry/defaultNodes.tsx`

这意味着新增 node 时，已经可以通过 registry 挂接：

- `type`
- `render`
- `getStyle`
- `autoMeasure`
- `canRotate`

这条链路已经足够支撑大部分普通 node。


### 2. 通用交互能力

当前已经基本具备：

- 拖拽
- resize
- rotate
- connect
- selection
- viewport pan / zoom
- transient preview

这意味着大多数“盒模型 node”已经可以直接复用现有交互，不需要重新发明 runtime。


### 3. View 层消费模型

当前 UI 侧已经逐步转向消费 resolved view，而不是自己拼 transient + committed。

这对于新增 node 很重要，因为：

- node 的 render 代码可以更专注于显示
- interaction runtime 可以保持在 feature / hook 层
- 新 node 不需要知道太多 transient 内部细节


## 现在最适合做的 node 类型

### 第一类：图形贴纸类

这类最适合最先开始做。

原因：

- 大多可以直接复用现有 node 基建
- 不需要专门的 creation runtime
- 容易验证 registry、style、transform、connect 这条线是否真的通用

推荐优先做：

- `ellipse`
- `circle`
- `diamond`
- `triangle`
- `arrow-sticker`
- `callout`
- `highlight`
- `badge`
- `star`
- `speech-bubble`

这些 node 的共同点是：

- 有明确 position / size / rotation
- 通常可以复用 transform handles
- 多数可以允许连接 edge
- render 逻辑主要集中在形状绘制


### 第二类：内容承载类

这类也已经可以开始做。

推荐：

- `image`
- `icon`
- `emoji`
- `label`
- `note-card`
- `code-block`

这类 node 的重点在于：

- data schema
- render
- 编辑态与展示态切换

它们一般不要求新的底层交互模型，但对 node 的内容结构会提出更明确的建模要求。


### 第三类：容器与语义块类

这类也可以做，但建议放在图形贴纸和内容类之后。

推荐：

- `panel`
- `callout-panel`
- `swimlane`
- `header-card`
- `section`

这类 node 的特点是：

- 视觉上像容器
- 可能引入子节点包裹、自动扩展、布局规则
- 容易触发 group / autofit / layout 的边界问题

所以它们不是不能做，而是更适合作为第二阶段推进。


### 第四类：专用 runtime node

这类 node 也可以做，但不应该被当成“普通新增一个 node type”。

代表：

- `freehand`
- `pen-stroke`
- `shape-stroke`

原因：

- 它们需要专门的创建流程
- 需要连续 pointer 采样
- 需要 stroke 数据建模
- 可能需要平滑、简化、闭合、编辑锚点
- 后续很容易扩展出笔刷宽度、颜色、擦除、压感等需求

所以 `freehand` 可以做，但应该被定义为：

- 一个 node 类型
- 加上一套专用 creation / edit runtime

它不适合当成“验证 node extensibility 的第一枪”。


## 推荐的 node 分类模型

在大规模新增 node 之前，推荐先明确四类 node。

### 1. 盒模型 node

特点：

- 明确 rect
- 标准 resize / rotate / connect
- render 基于 HTML 或简单形状

示例：

- `rect`
- `sticky`
- `image`
- `panel`


### 2. 几何图形 node

特点：

- 也是 rect 驱动
- render 是几何图形
- 通常仍然支持 transform / connect

示例：

- `ellipse`
- `diamond`
- `triangle`
- `star`


### 3. 装饰 / 贴纸 node

特点：

- 可能是纯视觉元素
- 可能支持连接，也可能不支持
- 更偏轻量展示和标记

示例：

- `arrow-sticker`
- `badge`
- `emoji`
- `icon`
- `highlight`


### 4. 专用 runtime node

特点：

- 需要专门的创建流程
- 可能有特殊编辑模型
- 不适合完全复用普通 node interaction

示例：

- `freehand`
- `mindmap`


## 推荐的第一批 node

如果现在开始做，推荐按下面顺序推进。

### 第一批：验证扩展能力

推荐先做：

- `ellipse`
- `diamond`
- `triangle`
- `arrow-sticker`
- `callout`
- `highlight`

这一批的目标不是“功能最多”，而是验证：

- registry 是否足够通用
- render / style 边界是否顺手
- transform / rotate / connect 在不同图形上是否成立
- fixed-size 与 autoMeasure node 是否能稳定共存


### 第二批：验证内容承载

推荐：

- `image`
- `icon`
- `emoji`
- `label`
- `note-card`

这一批的目标是验证：

- node data schema 是否清楚
- 内容型 node 的编辑与展示是否顺畅
- 内容类 node 的 style/data 边界是否合理


### 第三批：验证复杂交互

推荐：

- `freehand`
- `pen-stroke`
- `swimlane`
- `container-card`

这一批会真正触发：

- 专用 creation runtime
- 更复杂的 node capability
- 更明确的 schema 规范需求


## 建议至少规划的一组最小 node 集合

如果目标是让产品逐步进入“可用白板”的状态，推荐至少规划这几个类别。

### 基础几何

- `rect`
- `ellipse`
- `diamond`
- `triangle`
- `arrow-sticker`


### 内容节点

- `text`
- `sticky`
- `label`
- `image`


### 容器节点

- `group`
- `panel`
- `callout`


### 特殊交互节点

- `mindmap`
- `freehand`


## 各类 node 与现有基建的匹配度

### 可以直接复用现有基建

这些 node 基本只需要：

- 新增 `type`
- 增加 `render`
- 增加 `getStyle`
- 补充 data schema

推荐：

- `ellipse`
- `circle`
- `diamond`
- `triangle`
- `star`
- `arrow-sticker`
- `badge`
- `highlight`
- `image`
- `icon`
- `emoji`
- `label`


### 可以做，但要先明确数据结构

推荐：

- `note-card`
- `callout`
- `panel`
- `section`

这些 node 的主要风险不在 interaction，而在于：

- `data` 怎么设计
- `style` 和 `data` 如何分工
- 内容编辑能力怎么挂接


### 可以做，但需要新增专用 runtime

推荐：

- `freehand`
- `pen-stroke`
- `shape-stroke`

这些 node 不能只停留在 registry 扩展，还需要：

- creation flow
- pointer sampling
- stroke data model
- 可能的 smoothing / simplify
- 后续 editing model


## 在开始大规模新增 node 前，建议先明确的几件事

### 1. Node data schema 规范

需要尽量统一：

- 文本内容放哪里
- 几何参数放哪里
- 媒体资源放哪里
- 样式信息放 `style` 还是 `data`

如果这一层不定下来，新增 node 越多，后面越难收。


### 2. Node capability 规范

建议为每个 node 类型明确这些能力：

- 是否支持 rotate
- 是否支持 autoMeasure
- 是否支持 connect
- 是否支持 children
- 是否需要专用 creation flow
- 是否支持文本编辑

当前部分能力已经散在 `NodeDefinition` 里，但还不算完整体系。


### 3. Node creation 策略

新增一个 node，不只是“怎么渲染”，还包括“怎么创建”。

建议提前区分：

- 点击创建
- 拖拽拉框创建
- 连续绘制创建
- 工具栏插入创建

特别是 `freehand`，如果没有单独的 creation 策略，很快会和现有选择 / 拖拽交互打架。


### 4. Style / data 边界

建议尽早明确：

- 填充色、描边色、透明度、圆角等视觉属性放哪里
- label / text 是否统一走 `data`
- 图片 URL / 贴纸资源 ID 如何建模


## 当前建议的推进顺序

### 推荐路线

1. 先做一批 shape / sticker node  
   目标是验证 node registry + render + transform + connect

2. 再做 image / callout / label 这类内容 node  
   目标是验证 data schema 和展示能力

3. 最后做 freehand  
   目标是建立第一套专用 runtime node 模式


## 一句话结论

现在已经可以开始新增不同种类的 node。

最合适的第一步不是先上 `freehand`，而是先做一批可直接复用现有基建的 shape / sticker / content node；
`freehand` 应该作为第一类“专用 runtime node”来设计，而不是当成普通 node 扩展。
