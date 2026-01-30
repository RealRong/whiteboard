import { IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { ReactNode, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Edge from '@/core/components/whiteboard/edge/Edge'
import useKeepMindmapLayout from '@/core/components/whiteboard/node/mindmap/useKeepMindmapLayout'
import { useMemoizedFn } from '@/hooks'
import handleAddSubNode from '@/core/components/whiteboard/node/mindmap/handleAddSubNode'
import Id from '@/utils/id'
import useMindmapDragHandler from '@/core/components/whiteboard/node/mindmap/drag/useMindmapDragHandler'
import { Colors } from '@/consts'
import { updateTree } from '@/core/components/whiteboard/node/mindmap/utils/tree'
import { useUpdate } from 'react-use'
import { selectAtom } from 'jotai/utils'
import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { useAtomValue } from 'jotai'

const isWhiteboardLoaded = selectAtom(WhiteboardStateAtom, s => s.loaded)
// calculate position based on root
export default ({
  node,
  nodeRenderer
}: {
  node: IWhiteboardNode & { type: 'mindmap' }
  rootMindmapNode?: IWhiteboardNode
  nodeRenderer: (type: IWhiteboardNode['type']) => ReactNode
}) => {
  const instance = useWhiteboardInstance()
  const edgeLayer = instance.getEdgeLayer?.()
  const loaded = useAtomValue(isWhiteboardLoaded)
  const [links, setLinks] = useState<
    {
      sourceId: number
      label?: string
      targetId: number
      direction: 'left' | 'right'
    }[]
  >([])

  const mindmapCoreId = useMemo(() => Id.getId(), [])
  const drawAllEdges = useMemoizedFn(() => {
    links.forEach(l => {
      instance.edgeOps?.getEdgeFuncs(`${mindmapCoreId}_${l.sourceId}_${l.targetId}`)?.drawPath()
    })
  })

  const getEdges = useMemoizedFn((ids?: Set<number>) => {
    const linkz: typeof links = []
    const traverse = (node: IWhiteboardMindmap, direction: 'right' | 'left') => {
      node.children.forEach(c => {
        const source = instance.getNode?.(node.root)
        const target = instance.getNode?.(c.root)
        if (source?.collapse || target?.collapse) return
        if (!ids || (ids.has(node.root) && ids.has(c.root))) {
          linkz.push({
            sourceId: node.root,
            targetId: c.root,
            direction,
            label: c.label
          })
        }
        traverse(c, direction)
      })
    }
    if (!node.rightCollapse) {
      node.rightChildren?.forEach(n => {
        const source = instance.getNode?.(node.id)
        const target = instance.getNode?.(n.root)
        if (source?.collapse || target?.collapse) return
        linkz.push({
          sourceId: node.id,
          targetId: n.root,
          label: n.label,
          direction: 'right'
        })
        traverse(n, 'right')
      })
    }
    if (!node.leftCollapse) {
      node.leftChildren?.forEach(n => {
        const source = instance.getNode?.(node.id)
        const target = instance.getNode?.(n.root)
        if (source?.collapse || target?.collapse) return
        linkz.push({
          sourceId: node.id,
          targetId: n.root,
          direction: 'left'
        })
        traverse(n, 'left')
      })
    }
    setLinks(linkz)
  })
  const { handleBothTreeChange, layoutCache, allSubNodeIds } = useKeepMindmapLayout(node, {
    drawEdges: drawAllEdges,
    getEdges
  })
  const { renderTempLink, isDraggingSelf } = useMindmapDragHandler(node, {
    handleBothTreeChange,
    layoutCache: layoutCache,
    subNodeIds: allSubNodeIds,
    links,
    mindmapCoreId
  })
  useLayoutEffect(() => {
    if (loaded) {
      console.log(node)
      Promise.resolve().then(() => {
        handleBothTreeChange()
      })
    }
  }, [node.rightChildren, node.x, node.y, node.leftChildren, node.leftCollapse, node.rightCollapse, node.borderType, node.border, loaded])
  const nodeFunc = instance.values.ID_TO_NODE_MAP.get(node.id)

  if (nodeFunc) {
    nodeFunc.onAddSubNode = (sourceNodeId, newNode, idx, direction) => {
      const newMindmap = handleAddSubNode({
        rightIds: allSubNodeIds.current.right,
        leftIds: allSubNodeIds.current.left,
        currNode: node,
        idx,
        direction,
        newNode: newNode,
        targetId: sourceNodeId
      })
      if (newMindmap) {
        console.log(newMindmap)
        instance.updateNode?.(node.id, n => ({ ...n, ...newMindmap }))
      }
    }
    nodeFunc.drawMindmapEdges = drawAllEdges
  }
  const updateEdgeLabel = (direction: 'right' | 'left', sourceId: number, targetId: number, newLabel: string) => {
    if (direction === 'right' && node.rightChildren) {
      const newRight = updateTree(node.rightChildren, sourceId, targetId, {
        label: newLabel
      })
      instance.updateNode?.(node.id, w => ({ ...w, rightChildren: newRight }), true)
    }
    if (direction === 'left' && node.leftChildren) {
      const newLeft = updateTree(node.leftChildren, sourceId, targetId, {
        label: newLabel
      })
      instance.updateNode?.(node.id, w => ({ ...w, leftChildren: newLeft }), true)
    }
  }
  return (
    <>
      {nodeRenderer(node.nodeType || 'text')}
      {renderTempLink()}
      {edgeLayer &&
        links &&
        createPortal(
          links.map(link => (
            <Edge
              clickEditLabel
              hideLabel={isDraggingSelf}
              onLabelChange={v => updateEdgeLabel(link.direction, link.sourceId, link.targetId, v)}
              isMindmapConnection={true}
              strokeWidth={3}
              disableReposition
              disablePopover
              hideArrow
              key={`${mindmapCoreId}_${link.sourceId}_${link.targetId}`}
              edge={{
                id: `${mindmapCoreId}_${link.sourceId}_${link.targetId}`,
                sourceId: link.sourceId,
                targetId: link.targetId,
                label: link.label,
                sourcePosition: link.direction === 'right' ? 'right' : 'left',
                targetPosition: link.direction === 'right' ? 'left' : 'right',
                color: node.edgeColor || Colors.Font.Primary
              }}
              lineType={node.edgeType || 'tightCurve'}
            />
          )),
          edgeLayer
        )}
    </>
  )
}
