# Phase 8 Regression Checklist

日期：2026-02-25

## 1. 自动化回归（已执行）

1. `pnpm lint`：通过
2. `pnpm build`：通过
3. `pnpm bench`：通过（drag/node-transform/edge-routing 均 PASS）
4. `pnpm test`：通过（已修复 `@whiteboard/core` mindmap 测试入口为 `dist/mindmap/index.js`）

## 2. 手工交互回归清单

请在白板页面逐项验证并填写结果（`PASS` / `FAIL` / `N/A`）。

| ID | 场景 | 操作步骤 | 预期结果 | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- |
| M-01 | 节点拖拽 | 选中单节点并拖动 | 节点跟手移动，松开后位置落库 |  |  |
| M-02 | 节点拖拽入组高亮 | 拖动普通节点进入 group 区域 | group 出现 hover 高亮；移出后高亮清除 |  |  |
| M-03 | group 子树拖拽 | 拖动 group 节点 | group 与子节点预览同步，落点后结构正确 |  |  |
| M-04 | 节点缩放 | 拖拽 resize handle | 预览尺寸变化，松开后尺寸落库 |  |  |
| M-05 | 节点旋转 | 拖拽 rotate handle | 预览旋转变化，松开后旋转落库 |  |  |
| M-06 | 框选 | 空白处按下并拖出选择框 | `selectionBox` 显示，覆盖节点被选中 |  |  |
| M-07 | 框选清空 | replace 模式下空白点击/小拖动 | 已选节点清空，边选中清空 |  |  |
| M-08 | 连线创建 | 从节点连接点拖到目标节点 | 连线创建成功，交互态清理 |  |  |
| M-09 | 连线重连 | 拖动现有边端点至新节点 | 重连成功，路径与端点正确 |  |  |
| M-10 | 路由点拖拽 | 拖动 edge routing 点 | 路由点跟手移动，松开后落库 |  |  |
| M-11 | 路由点删除 | 选中 routing handle 后 Delete/Backspace | 路由点删除，路径更新 |  |  |
| M-12 | 切换边选中 | 选中 A 边后再选 B 边 | 选中状态切换，旧 routing drag 不残留 |  |  |
| M-13 | 选择快捷键 | `Cmd/Ctrl+A`、`Esc`、`Delete` | 全选/取消/删除行为正确 |  |  |
| M-14 | 历史回放 | 连续执行拖拽/连线后 `Undo/Redo` | 文档与视图状态一致回放 |  |  |
| M-15 | 生命周期停止恢复 | 页面卸载再挂载（或实例 stop/start） | 无残留交互态，无异常选中/拖拽会话 |  |  |

## 3. 失败处理建议

1. 若出现高亮/选择框残留，优先检查 `input.resetAll()` 调用链路。
2. 若出现路由拖拽残留，优先检查 `create.ts` 中 edge 命令包装的 transient 清理。
3. 若出现 stop 后状态污染，优先检查 `lifecycle.stop -> input.resetAll('forced')` 是否触发。

## 4. 当前验收状态

1. 自动化：已全部通过（lint/build/bench/test）。
2. 手工交互：待执行（需要在真实白板页面逐项验证 M-01 ~ M-15）。
