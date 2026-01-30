import { CSSProperties, Dispatch, memo, ReactNode, SetStateAction, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { INodeInnerState, IWhiteboardNode, WhiteboardEvents } from '~/typings'
import { useMemoizedFn, useRafFn } from '@/hooks'
import { Content } from '@/components'
import MetaObjectNode from './nodes/MetaObjectNode'
import ImageNode from './nodes/ImageNode'
import TextNode from '@/core/components/whiteboard/node/nodes/TextNode'
import GroupHead from './GroupHead'
import FreehandNode from '@/core/components/whiteboard/node/nodes/FreehandNode'
import useNodeColor from '@/core/components/whiteboard/node/hooks/useNodeColor'
import getNodeStyle from '@/core/components/whiteboard/node/getNodeStyle'
import useNodeSize from '@/core/components/whiteboard/node/hooks/useNodeSize'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import eventHandlers from '@/core/components/whiteboard/node/hooks/eventHandlers'
import useNodeResize from '@/core/components/whiteboard/node/hooks/useNodeResize'
import useNodeDrag from '@/core/components/whiteboard/node/hooks/useNodeDrag'
import { useAtomValue, useSetAtom } from 'jotai'
import MindmapNode from '@/core/components/whiteboard/node/mindmap/MindmapNode'
import AddSubMindmapIndicator from '@/core/components/whiteboard/node/mindmap/AddSubMindmapIndicator'
import getNodeSize from '@/core/components/whiteboard/node/getNodeSize'
import { isEqual } from 'lodash'
import { selectAtom } from 'jotai/utils'
import useUpdateIsomorphicLayoutEffect from '@/hooks/utils/useUpdateIsomorphicLayoutEffect'
import { Colors } from '@/consts'
import WhiteboardRnd from '@/core/components/whiteboard/node/rnd/WhiteboardRnd'
import './index.less'
import classnames from 'classnames'

export type NodeInnerState = INodeInnerState
export interface InnerNodeProps {
  node: Partial<IWhiteboardNode>
  setPopoverElements?: Dispatch<SetStateAction<(() => ReactNode)[]>>
  setNodeState?: Dispatch<SetStateAction<NodeInnerState>>
  onNameChange?: (name: string) => void
  nodeState?: NodeInnerState
  metaId?: number
}

const NodeSelectAtom = selectAtom(
  WhiteboardStateAtom,
  s => ({
    pointerMode: s.pointerMode,
    hasEraseOrDrawTool: s.currentTool,
    isDraggingNode: s.isDraggingNode,
    currentHighlight: s.highlightedIds,
    enableClickWhenPanning: s.state?.enableClickNodeWhenPanning
  }),
  (a, b) => isEqual(a, b)
)

const WrapperNode = ({ node }: { node: IWhiteboardNode }) => {
  const { x, y, type, id, background, width, height } = node
  const isDraggingRef = useRef(false)
  const isResizingRef = useRef(false)

  const [nodeState, setNodeState] = useState<NodeInnerState>({
    selected: false,
    focused: false
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const { pointerMode, hasEraseOrDrawTool, isDraggingNode, currentHighlight, enableClickWhenPanning } = useAtomValue(NodeSelectAtom)
  const panPointerMode = pointerMode === 'pan'
  const setWhiteboardState = useSetAtom(WhiteboardStateAtom)
  const instance = useWhiteboardInstance()
  const updateWhiteboard = instance.updateWhiteboard
  instance.values.ID_TO_NODE_MAP.set(node.id, {
    ...instance.values.ID_TO_NODE_MAP.get(node.id),
    setNodeState,
    getNodeDOM: () => {
      const d = containerRef.current
      if (!d) throw 'Failed to get DOM'
      return d
    },
    select: () => {
      if (nodeState.selected) return
      setNodeState(s => ({ ...s, selected: true }))
    },
    getNodeState: () => nodeState,
    deselect: () => {
      if (!nodeState.selected) return
      setNodeState(s => ({ ...s, selected: false, focused: false }))
    },
    setStyle: newStyle => {
      const container = containerRef.current
      if (container) {
        Object.entries(newStyle).forEach(([k, v]) => {
          container.style.setProperty(k, v)
        })
      }
    },
    getRealtimeBox: () => {
      const container = containerRef.current?.getBoundingClientRect()
      if (container) {
        const transformed = instance.coordOps?.transformWindowPositionToPosition({
          x: container.x,
          y: container.y
        })
        const scale = instance.getTransform?.().scale
        if (transformed && scale) {
          const trimNum = (n: number) => {
            return Number(n.toFixed(2))
          }
          return {
            width: trimNum(container.width / scale),
            height: trimNum(container.height / scale),
            left: transformed.x,
            top: transformed.y
          }
        }
      }
    },
    sizeAlreadyDefined: () => {
      if (isResizingRef.current) {
        return true
      }
      if (width && height && node.resized) {
        console.log(node)
        return true
      }
      return false
    },
    updateNodeBox: newBox => {
      const container = containerRef.current!
      container.style.width = `${newBox.width}px`
      container.style.height = `${newBox.height}px`
      container.style.transform = `translate(${newBox.left}px,${newBox.top}px)`
      rafUpdateEdge()
    }
  })

  const handleNameChange = useMemoizedFn((name: string) => {
    updateWhiteboard?.(
      w => {
        const origin = w.nodes?.get(id)
        if (origin) {
          w.nodes?.set(origin.id, {
            ...origin,
            name
          })
        }
      },
      node.type === 'group' ? true : false
    )
  })

  useLayoutEffect(() => {
    return () => {
      instance.values.ID_TO_NODE_MAP.delete(node.id)
    }
  }, [])

  const rafUpdateEdge = useRafFn(() => {
    instance.nodeOps?.updateRelatedEdges(node.id)
  })
  useUpdateIsomorphicLayoutEffect(() => {
    if (containerRef.current) {
      rafUpdateEdge()
    }
  }, [node.x, node.y, node.width, node.height])

  useEffect(() => {
    const element = containerRef.current
    if (element) {
      const { handleFunc, returnFunc } = eventHandlers({ element, node, instance, nodeState, isDraggingNode, setNodeState })
      handleFunc()
      return () => {
        returnFunc()
      }
    }
  })
  const { handleResizeEnd, handleResize, handleResizeStart } = useNodeResize(node, instance)
  const { handleDragStart, handleDrag, handleDragEnd } = useNodeDrag(node, instance)

  // remove selected state on click outside
  useEffect(() => {
    if (nodeState.selected || nodeState.focused) {
      instance.selectOps?.selectNode(node.id, false)
      const clickHandler = ({ e }: WhiteboardEvents['dataContainerClick']) => {
        if (e.defaultPrevented) return
        // do not clear select state if selecting or resizing
        if (instance.selectOps?.isSelecting()) {
          return
        }
        if (!containerRef.current?.contains(e.target as HTMLElement) && isResizingRef.current === false) {
          // click on container
          if (e.target instanceof HTMLElement && e.target.getAttribute('role') === 'data-container') {
            setNodeState(s => ({ ...s, selected: false, focused: false }))
          }
          // click on another node
          if (e.target instanceof Element) {
            const targetNode = e.target.closest('[data-node-id]')
            if (targetNode) {
              const nodeId = targetNode.getAttribute('data-node-id')!
              if (Number(nodeId) !== node.id) {
                setNodeState(s => ({ ...s, selected: false, focused: false }))
              }
            }
          }
        }
      }
      instance.addEventListener('dataContainerClick', clickHandler)
      return () => {
        instance.removeEventListener('dataContainerClick', clickHandler)
      }
    } else {
      if (!nodeState.selected && !nodeState.focused) {
        instance.selectOps?.deselectNode(node.id)
      }
    }
  }, [nodeState.selected, nodeState.focused])

  const renderInnerNode = (type: IWhiteboardNode['type']) => {
    switch (type) {
      case 'metaObject':
        return <MetaObjectNode setNodeState={setNodeState} onNameChange={handleNameChange} nodeState={nodeState} node={node} />
      case 'image':
        return <ImageNode node={node} />
      case 'freehand':
        return <FreehandNode node={node} onClick={handleClick} />
      case 'mindmap':
        return <MindmapNode nodeRenderer={renderInnerNode} parentNodeRef={containerRef} node={node} />
      case 'text':
        return <TextNode setNodeState={setNodeState} node={node} onClick={handleClick} nodeState={nodeState} />
    }
  }

  let containerOverflow: CSSProperties = {
    overflowX: 'hidden',
    overflowY: 'auto'
  }
  if (node.type === 'freehand') {
    containerOverflow = {}
  }

  useNodeSize(containerRef, node, instance)
  const { opacityBackground } = useNodeColor(background, node.type === 'group')

  if (node.collapse) return null
  const handleClick = (e: MouseEvent) => {
    if (isDraggingNode || panPointerMode || instance.values.selectBox) return
    const edgeOverlayState = instance.edgeOps?.getEdgeOverlayState()
    if (edgeOverlayState?.isReposition || edgeOverlayState?.isAdding) {
      return
    }
    if (e.currentTarget !== e.target && node.type !== 'freehand') return
    // set timeout here to prevent remove node when cancel other node's select state
    setTimeout(() => {
      setNodeState(s => ({
        ...s,
        selected: true,
        focused: true
      }))
      setTimeout(() => instance.nodeOps?.getNodeFuncs(node.id)?.focusText?.())
    })
    instance.selectOps?.selectNode(node.id, false)
  }
  const nodeStyle = getNodeStyle(node, nodeState, instance, {
    panPointerMode,
    enableClickWhenPanning,
    background: {
      opacityBackground
    }
  })

  let showCover = true

  if (nodeState.focused || node.type === 'group') {
    showCover = false
  }
  if (node.type === 'freehand' && !node.background) {
    showCover = false
  }
  const { width: nodeWidth, height: nodeHeight, minWidth, maxWidth } = getNodeSize(node)

  return (
    <WhiteboardRnd
      ref={containerRef}
      data-node-id={id}
      position={{ x, y }}
      resizable={!hasEraseOrDrawTool && (nodeState.selected || nodeState.focused || node.type === 'group')}
      style={{
        ...nodeStyle,
        opacity: currentHighlight ? (currentHighlight.nodeIds.has(id) ? 1 : 0.2) : nodeStyle.opacity,
        cursor: hasEraseOrDrawTool ? 'crosshair' : nodeStyle.cursor,
        pointerEvents: hasEraseOrDrawTool === 'freehand' ? 'none' : nodeStyle.pointerEvents
      }}
      minWidth={minWidth}
      maxWidth={maxWidth}
      draggable={!(node.rootId || hasEraseOrDrawTool || (nodeState.focused && node.type !== 'group') || panPointerMode)}
      className={classnames('whiteboard-node', showCover && 'show-cover')}
      onResizeStart={e => {
        const edgeOverlayState = instance.edgeOps?.getEdgeOverlayState()
        if (edgeOverlayState?.isReposition || edgeOverlayState?.isAdding) {
          throw ''
        }
        isResizingRef.current = true
        handleResizeStart(e)
      }}
      onResize={(e, dir, ele) => {
        const { box, direction } = handleResize(e, dir, ele)
      }}
      onResizeStop={(e, dir, ele) => {
        const box = handleResizeEnd()
        if (width === undefined || height === undefined) return
        const delta = {
          width: ele.offsetWidth - width,
          height: ele.offsetHeight - height
        }
        isResizingRef.current = false
        if (Math.abs(delta.width) < 1 && Math.abs(delta.height) < 1) return
        updateWhiteboard?.(w => {
          const origin = w.nodes?.get(id)
          if (origin) {
            const heightResized =
              origin.resized || (['top', 'bottom', 'topRight', 'topLeft', 'bottomRight', 'bottomLeft'].includes(dir) && delta.height !== 0)
            const newOrigin = {
              ...origin,
              x: box.left,
              y: box.top,
              widthResized:
                origin.widthResized ||
                (['left', 'right', 'topRight', 'topLeft', 'bottomRight', 'bottomLeft'].includes(dir) && delta.width !== 0),
              resized: heightResized,
              height: box.height,
              width: box.width
            }
            instance.emit?.({
              type: 'nodeResized',
              resized: [newOrigin]
            })
            w.nodes?.set(id, newOrigin)
          }
        }, true)
      }}
      onDragStart={e => {
        if (!containerRef.current?.contains(e.target)) {
          throw ''
        }
        const edgeOverlayState = instance.edgeOps?.getEdgeOverlayState()
        if (edgeOverlayState?.isReposition || edgeOverlayState?.isAdding) {
          throw ''
        }
        if (node.type === 'group') {
          if (e.target instanceof HTMLElement && e.target.closest('.group-head')) throw ''
          if (!nodeState.focused) throw ''
        }
        instance.nodeOps?.updateAfterZ?.(id)
        handleDragStart()
        isDraggingRef.current = true
        instance.values.currentDraggingNodeId = node.id
      }}
      onDrag={(e, data) => {
        if (!isDraggingNode) {
          setWhiteboardState(s => ({ ...s, isDraggingNode: true }))
        }
        handleDrag(e, data)
      }}
      onDragStop={(e, data) => {
        instance.values.currentDraggingNodeId = undefined
        setTimeout(() => setWhiteboardState(s => ({ ...s, isDraggingNode: false })))
        isDraggingRef.current = false
        if (Math.abs(data.x - x) < 1 && Math.abs(data.y - y) < 1) return
        const box = handleDragEnd(e, data)
        if (box) {
          updateWhiteboard?.(w => {
            const origin = w.nodes?.get(id)
            if (origin) {
              w.nodes?.set(id, {
                ...origin,
                x: box.left,
                y: box.top
              })
            }
          }, true)
        }
      }}
      onPointerDownCapture={e => {
        if (!containerRef.current?.contains(e.target)) {
          return
        }
        instance.emit?.({
          type: 'nodeClick',
          node
        })
        if (panPointerMode) return
        if (node.rootId && !nodeState.selected && !nodeState.focused && e.button === 0) {
          instance.mindmapOps?.startDragMindmapChild(node.id, e)
        }
      }}
      onWheelCapture={e => {
        if (node.type !== 'group') {
          if (nodeState.focused) {
            e.stopPropagation()
          }
        }
      }}
      onClickCapture={e => {
        if (showCover || node.type === 'group') {
          handleClick(e)
        }
      }}
      size={{
        height: nodeHeight,
        width: nodeWidth
      }}
      isDragging={isDraggingRef}
      isResizing={isResizingRef}
    >
      {node.borderType === 'underline' && node.type === 'mindmap' && (node.border || node.edgeColor) && (
        <div
          style={{
            position: 'absolute',
            bottom: -1.5,
            height: 3,
            backgroundColor: Colors.getAdaptColor(node.border || node.edgeColor),
            width: '100%',
            zIndex: -100
          }}
        ></div>
      )}
      {type === 'group' && <GroupHead node={node} />}
      {type !== 'group' && (
        <Content
          fullHeight
          role={'scroll-container'}
          style={{
            width: 'max-content',
            maxWidth: '100%',
            minWidth: '100%',
            '--global-background': nodeStyle.background,
            maxHeight: node.fixedExpanded && !node.resized ? '800px' : '100%',
            borderRadius: 'inherit',
            ...containerOverflow
          }}
          onKeyUpCapture={e => {
            if (nodeState.focused) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          {renderInnerNode(node.type)}
        </Content>
      )}
      <AddSubMindmapIndicator node={node} containerRef={containerRef} />
      {nodeState.name && <NameRenderer name={nodeState.name} />}
    </WhiteboardRnd>
  )
}

const NameRenderer = ({ name }: { name: string }) => {
  return (
    <div
      className={'line-clamp-1 break-all transparent-font'}
      style={{
        fontSize: 'calc(13px * var(--zoom-level))',
        position: 'absolute',
        top: -6,
        transform: 'translateY(-100%)'
      }}
    >
      {name}
    </div>
  )
}
export default memo(WrapperNode)
