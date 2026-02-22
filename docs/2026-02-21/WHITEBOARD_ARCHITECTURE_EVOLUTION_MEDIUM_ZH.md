# 从 Make It Work 到 Make It Fast：白板架构七阶段演进复盘

> 这不是一篇“架构终局展示”文章，而是一篇工程演进复盘。  
> 主线非常明确：**Make It Work -> Make It Right -> Make It Clear -> Make It Fast**。

---

## 0. 为什么要用这四句话来讲这次演进

白板系统和普通后台系统最大区别是：  
它是一个**高频写入 + 高频可视化反馈**系统。

在这种系统里，架构问题不会先表现为“功能不能用”，而会先表现为：

1. 交互偶发卡顿。
2. 某些状态不同步。
3. bug 难复现、难定位。
4. 看起来只是一个小改动，却触发整片重算。

所以我们的演进顺序不是“追求一开始就完美”，而是：

1. 先让它能跑（Work）。
2. 再让它行为正确（Right）。
3. 再让它结构清晰（Clear）。
4. 最后把性能打磨到稳定可守（Fast）。

---

## 1. 演进总览（阶段地图）

| 阶段 | 关键词 | 典型形态 | 核心问题 |
|---|---|---|---|
| S0 | Work | `core + react`，组件内直接 `core.dispatch` | 写入分散、边界混乱 |
| S1 | Right-v1 | 写入口收口到 `instance.commands` | 收口了调用面，没收口模型 |
| S2 | Right-v2 | 拆出 `engine`，状态仍在 React | 行为与状态边界仍不稳 |
| S3 | Clear-v1 | 独立状态管理 + 计算流程 | `doc/change` 双模型并存 |
| S4 | Fast-v1 | 统一 `Change/ChangeSet` 管线 | 单写入口成型，增量失效成型 |
| S5 | Fast-v2 | `core` 纯内核化 | 去除 `dispatch/commands` 残留 |
| S6 | 当前 | `core.apply.build/operations/changeSet` + `instance.apply` | 历史与 schema 治理待收尾 |

---

## 2. S0：Make It Work（先跑起来）

### 2.1 当时架构

1. 只有 `core` 和 `react` 两层。
2. 组件或 hook 直接调用 `core.dispatch(...)`。
3. UI 既做渲染，也直接推动领域状态变更。

示意：

```text
Pointer Event -> React Hook -> core.dispatch(intent) -> Core State
```

### 2.2 这一步为什么合理

1. 早期探索阶段，速度优先。
2. 链路短，功能迭代快。
3. 团队能快速验证白板交互语义是否成立。

### 2.3 这一步暴露的问题

1. 写入路径分散：任何组件都可能写核心状态。
2. 领域规则泄漏到 UI：边界天然混乱。
3. 调试困难：同一状态可能由多个 hook 触发。

### 2.4 为什么必须进入下一阶段

当功能增多时，“能跑”开始变成“难维护”。  
我们需要先把**调用入口收口**，否则后续所有优化都没有抓手。

### 2.5 下一阶段新增问题（提前预警）

入口收口后，如果只是“壳层转发”，复杂度会从 UI 转移到中间层，不会消失。

---

## 3. S1：Make It Right（第一步：调用正确）

### 3.1 当时架构

1. 新增 `instance.commands.*`。
2. React 不再直接调用 `core.dispatch`。
3. UI 通过 `instance` 表达意图。

示意：

```text
React -> instance.commands.* -> core
```

### 3.2 收益

1. API 表面统一，调用点可控。
2. 便于后续插入日志、鉴权、事务等通用逻辑。
3. 为多宿主（不止 React）留下扩展位。

### 3.3 新问题

1. 很多命令只是转发，层级增加但语义增益有限。
2. 运行时行为、命令语义、状态写入还未彻底分层。
3. “统一入口”并不等于“统一写模型”。

### 3.4 为什么继续演进

我们得到的是“调用面收口”，还没得到“状态模型收口”。  
下一步必须处理**状态与计算归属**。

---

## 4. S2：Make It Right（第二步：边界正确）

### 4.1 当时架构

1. 把运行时能力拆到独立 `engine`。
2. 但状态管理大量仍在 React（atom/selector、`memo/effect` 驱动）。
3. 交互行为与 React 生命周期仍强耦合。

### 4.2 收益

1. 行为层开始脱离组件。
2. 引擎雏形出现，可承载更多运行时能力。
3. 为后续“薄 React”方向打了地基。

### 4.3 新问题（关键）

1. 重算触发依赖依赖数组语义，不是领域语义。
2. 一个局部变更可能触发整层 rerender。
3. 高频交互（drag/resize/connect）出现不稳定抖动。

### 4.4 为什么继续演进

白板热路径不能依赖 UI 框架 rerender 来调度计算。  
我们需要独立的计算调度与失效控制系统。

### 4.5 下一阶段新增问题（提前预警）

当把状态和计算抽出来时，容易出现 `doc` 与 `change` 两套并行语义。

---

## 5. S3：Make It Clear（先把系统讲清楚）

### 5.1 当时架构

1. 引入独立状态管理框架与计算流程。
2. 增加 derive/cache/invalidate/revision 等基础设施。
3. 但存在两套视角：
   - 全量文档视角（`doc`）。
   - 增量变更视角（`change`）。

### 5.2 收益

1. 计算链路不再依赖 React 生命周期。
2. 重算开始可观测（次数、命中率、耗时）。
3. 失效粒度开始可控制。

### 5.3 新问题（本阶段核心）

1. 双模型导致心智负担高：同一语义要在两套体系解释。
2. 有时“先改 doc 再反推影响域”，有时“先 change 再落 doc”，链路不统一。
3. 兜底逻辑（watcher/同步器）容易越堆越多。

### 5.4 为什么继续演进

系统只能有一个写事实来源。  
双模型中间态不可能长期稳定，必须统一为单一变更语义。

---

## 6. S4：Make It Fast（第一步：单写入口）

### 6.1 架构转折点

这一阶段最关键的决策：  
**只接受 `Change/ChangeSet` 写入，所有状态更新统一走 `apply`。**

统一管线：

```text
ChangeSet
  -> validate
  -> normalize
  -> reduce
  -> collect affected keys
  -> invalidate derive/cache
  -> emit events
  -> history
  -> metrics
```

### 6.2 收益

1. 命令、交互、导入、远端同步统一语义。
2. `doc.reset` 也进入管线，去掉外部直写文档。
3. dirty 收集可以按 key/id/domain 精确化。
4. 性能优化有了统一抓手。

### 6.3 这一阶段的代价

1. `Change` schema 管理复杂度上升。
2. reduce 层需要承接更多约束检查。
3. 迁移期间要持续处理行为一致性回归。

### 6.4 为什么它是“Fast”的前提

没有单写入口，就没有稳定的增量失效；  
没有稳定失效，就不可能有稳定性能。

---

## 7. S5：Make It Fast（第二步：把核心“纯化”）

### 7.1 我们做了什么

1. 删除 `core.dispatch`。
2. 删除 `core.commands` 对外入口。
3. 对外统一到：
   - `core.apply.build(intent)`
   - `core.apply.operations(ops)`
   - `core.apply.changeSet(changes)`
4. `history/transaction` 从命令空间剥离为顶层：
   - `core.history`
   - `core.tx`

### 7.2 这一步的本质

`core` 不再承担“应用层命令入口”角色，  
而是回到“纯模型内核”角色。

### 7.3 收益

1. 边界更硬：Core 是 model kernel，Engine 是 runtime orchestration。
2. 语义更短：写词只剩 `apply`。
3. 替换宿主（React/Vue/Canvas）成本更可控。

---

## 8. 当前架构：一条写路径，三层职责

### 8.1 当前职责分层

1. `core`：模型、约束、reducer、history/tx。
2. `engine`：interaction、lifecycle、projection、query/view、性能与事件编排。
3. `react`：容器绑定、渲染与少量 UI 语义拼装（薄适配）。

### 8.2 当前写入链路（简化）

```text
UI Event / Shortcut / Import / Remote
  -> interaction/commands 产出 ChangeSet
  -> instance.apply(changeSet)
  -> core.apply.build/operations/changeSet
  -> affected keys
  -> derive/cache 增量失效
  -> view/query 消费
  -> renderer 更新
```

### 8.3 当前性能治理方式

1. 为关键路径建立 benchmark 与门槛（例如 drag-frame p95）。
2. 采样记录重算次数、命中率、分位耗时。
3. 以“增量失效正确性”作为首要优化目标。

---

## 9. 我们如何理解四个阶段的真正含义

### 9.1 Make It Work

不是“写得乱也没关系”，而是：  
先确认业务语义可行，快速形成反馈闭环。

### 9.2 Make It Right

不是“抽层越多越好”，而是：  
明确谁能写、谁负责行为、谁只读。

### 9.3 Make It Clear

不是“文档多就清晰”，而是：  
团队能在 10 分钟内讲清楚一条变更如何流动。

### 9.4 Make It Fast

不是“跑分漂亮”，而是：  
在真实交互压力下，性能可预测、可回归、可守门。

---

## 10. 当前阶段仍存在的弊端（必须正视）

即使现在架构已经明显收敛，仍有三类结构性问题：

1. **历史系统仍需彻底 change 化**  
   目标是从“快照回退”进化到“ChangeSet 可逆回放”。

2. **Change schema 膨胀风险**  
   需要按 domain 治理，避免超级 union 与跨域耦合。

3. **mindmap 等复杂域的 operation builder 还可再纯化**  
   部分逻辑仍存在领域特化分支，需继续模块化。

---

## 11. 为什么下一阶段会更难

从这里往后，难点不再是“怎么重构”，而是“怎么标准化”：

1. 标准化逆操作（undo/redo/compress/squash）。
2. 标准化协作冲突语义（并发写入下的可解释行为）。
3. 标准化调试面板（从工程数据到产品级可观测）。

换句话说，下一阶段不是“删旧代码”，而是“建立长期协议”。

---

## 12. 这次演进沉淀出的工程原则

1. 先统一写路径，再讨论性能极限。
2. 交互热路径优先事件时读取，不依赖 UI rerender 调度。
3. 让基础设施承担复杂度，不让业务代码承担复杂度。
4. 不保留长期中间态；中间态只能是阶段性手段。
5. 每次重构都要带上可观测与门槛，不做“感觉更快”。

---

## 13. 一句话收尾

这条演进线真正的主旨不是“我们重构了多少模块”，  
而是我们把系统从“能跑”逐步变成了“正确、清晰、可持续地快”。

**Make It Work 是起点，Make It Right 是边界，Make It Clear 是协作能力，Make It Fast 是结果。**

