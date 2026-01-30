// 监听全局变化, 每次resize都会触发
import { useEffect, useRef } from 'react'
import { IWhiteboardMindmap, IWhiteboardNode, WhiteboardEvents } from '~/typings'
import autoArrangeLayout from '@/core/components/whiteboard/node/mindmap/autoArrangeLayout'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useMemoizedFn } from '@/hooks'
import { deleteChildsFromTree } from '@/core/components/whiteboard/node/mindmap/utils/tree'

const loop = (nodes: IWhiteboardMindmap[], onLoop: (n: IWhiteboardMindmap) => void) => {
  nodes.forEach(n => {
    onLoop(n)
    if (n.children) {
      loop(n.children, onLoop)
    }
  })
}
export default (
  node: IWhiteboardNode & { type: 'mindmap' },
  opts: {
    drawEdges: VoidFunction
    getEdges: (ids: Set<number>) => void
  }
) => {
  // 记录前面一次
  const allSubNodeIds = useRef<{
    right: Set<number>
    left: Set<number>
  }>({
    right: new Set<number>(),
    left: new Set<number>()
  })
  const instance = useWhiteboardInstance()
  const layoutCache = useRef<Record<number, { x: number; y: number }>>({})
  const handleTreeChange = (tree: IWhiteboardMindmap[], direction: 'left' | 'right') => {
    allSubNodeIds.current[direction].clear()
    loop(tree, n => allSubNodeIds.current[direction].add(n.root))
    allSubNodeIds.current[direction].forEach(i => {
      delete layoutCache.current[i]
    })
    const layout = autoArrangeLayout(node, instance, direction)

    if (layout) {
      const currBox = instance.nodeOps?.getNodeFuncs(node.id)?.getRealtimeBox()
      if (!currBox) return
      const updateQueue: { id: number; x: number; y: number }[] = []

      layout.forEach(n => {
        if (n.id === node.id) return
        const target = instance.getNode?.(n.id)
        if (!target) return
        if (target.collapse) return
        if (n.x === null || n.y === null) return
        layoutCache.current[n.id] = { ...n, side: direction }
        const propBox = { x: currBox.left + n.x, y: currBox.top + n.y }
        if (target.x !== propBox.x || target.y !== propBox.y) {
          updateQueue.push({
            id: n.id,
            x: propBox.x,
            y: propBox.y
          })
        }
      })
      if (updateQueue.length) {
        instance.updateWhiteboard?.(w => {
          updateQueue.forEach(q => {
            const origin = w.nodes?.get(q.id)
            if (origin) {
              instance.nodeOps?.getNodeFuncs(origin.id)?.setStyle({
                transform: `translate(${q.x}px,${q.y}px)`
              })
              w.nodes?.set(origin.id, {
                ...origin,
                x: q.x,
                y: q.y
              })
            }
          })
        })
      }
    }
  }
  const handleRightTreeChange = useMemoizedFn((rightTree?: IWhiteboardMindmap[]) => {
    const rightT = rightTree || node.rightChildren
    if (rightT) {
      handleTreeChange(rightT, 'right')
      Promise.resolve().then(() => {
        opts.getEdges(new Set([...allSubNodeIds.current.left, ...allSubNodeIds.current.right]))
        opts.drawEdges()
      })
    }
  })

  const handleLeftTreeChange = useMemoizedFn((leftTree?: IWhiteboardMindmap[]) => {
    const leftT = leftTree || node.leftChildren
    if (leftT) {
      handleTreeChange(leftT, 'left')
      Promise.resolve().then(() => {
        opts.getEdges(new Set([...allSubNodeIds.current.left, ...allSubNodeIds.current.right]))
        opts.drawEdges()
      })
    }
  })
  const handleBothTreeChange = useMemoizedFn(() => {
    const leftT = node.leftChildren
    const rightT = node.rightChildren
    rightT && handleTreeChange(rightT, 'right')
    leftT && handleTreeChange(leftT, 'left')

    Promise.resolve().then(() => {
      opts.getEdges(new Set([...allSubNodeIds.current.left, ...allSubNodeIds.current.right]))
      opts.drawEdges()
    })
  })
  const handleNodeSizeChange = (e: WhiteboardEvents['nodeSizeChange']) => {
    const nArr = e.changed
    const subIds = allSubNodeIds.current
    let rightChange = false,
      leftChange = false
    nArr.forEach(i => {
      if (i.id === node.id) {
        leftChange = true
        rightChange = true
      }
      if (i.rootId === node.id) {
        if (subIds.left.has(i.id)) {
          leftChange = true
        }
        if (subIds.right.has(i.id)) {
          rightChange = true
        }
      }
    })
    leftChange && node.leftChildren && handleLeftTreeChange(node.leftChildren!)
    rightChange && node.rightChildren && handleRightTreeChange(node.rightChildren)
  }
  const handleNodesDelete = ({ deleted: deletedIds }: WhiteboardEvents['nodeDeleted']) => {
    const subs = allSubNodeIds.current
    if (deletedIds.some(id => subs.right.has(id) || subs.left.has(id))) {
      const newRightTree = deleteChildsFromTree(node.rightChildren || [], deletedIds).result
      const newLeftTree = deleteChildsFromTree(node.leftChildren || [], deletedIds).result
      instance.updateNode?.(node.id, n => ({ ...n, rightChildren: newRightTree, leftChildren: newLeftTree }), true)
    }
  }
  useEffect(() => {
    instance.addEventListener('nodeSizeChange', handleNodeSizeChange)
    instance.addEventListener('nodeDeleted', handleNodesDelete)
    return () => {
      instance.removeEventListener('nodeSizeChange', handleNodeSizeChange)
      instance.removeEventListener('nodeDeleted', handleNodesDelete)
    }
  })
  const nodeFuncs = instance.values.ID_TO_NODE_MAP.get(node.id)
  if (nodeFuncs) {
    nodeFuncs.onNodeCollapse = nodeIds => {
      if (nodeIds.some(id => node.id === id)) {
        node.rightChildren && handleRightTreeChange(node.rightChildren)
        node.leftChildren && handleLeftTreeChange(node.leftChildren)
        return
      }
      if (nodeIds.some(id => allSubNodeIds.current.right.has(id))) {
        node.rightChildren && handleRightTreeChange(node.rightChildren)
      }
      if (nodeIds.some(id => allSubNodeIds.current.left.has(id))) {
        node.leftChildren && handleLeftTreeChange(node.leftChildren)
      }
    }
  }
  return {
    handleRightTreeChange,
    handleLeftTreeChange,
    layoutCache,
    allSubNodeIds,
    handleBothTreeChange
  }
}
