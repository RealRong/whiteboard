import { useMemoizedFn, useRafFn } from '@/hooks'
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DraggableData } from 'react-rnd'
import { IWhiteboardEvent, IWhiteboardNode, XYPosition } from '~/typings'
import { Box } from '~/typings'
import { assignProperties, calculateSelectionBox } from '@/utils'
import { getBoxOfBoxes, getBoxOfNodes, isPointerOnContainer } from '../utils'
import { useWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import _ from 'lodash'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { AnimatePopover, Icon, WithBorder } from '@/components'
import { ClassName } from 'rendevoz'
import { Icons } from '@/consts'
import WhiteboardRnd from '@/core/components/whiteboard/node/rnd/WhiteboardRnd'
import { useWhiteboardNodes } from '@/core/components/whiteboard/StateHooks'

const WhiteboardSelect = memo(() => {
  const [multiSelectedBox, setMultiSelectedBox] = useState<Box>()

  const selectedOffsetRef = useRef(new Map())
  const selectBoxRef = useRef<HTMLDivElement>(null)
  const selectedNodeIdsRef = useRef(new Set<number>())
  const multiSelectBoxRef = useRef<HTMLDivElement>(null)
  const [whiteboardState, setWhiteboardState] = useWhiteboardState()
  const instance = useWhiteboardInstance()
  const nodes = useWhiteboardNodes()
  const selectStartPointRef = useRef<XYPosition>()
  const selectEndPointRef = useRef<XYPosition>()
  const isDraggingRef = useRef(false)
  const handler = useMemoizedFn((e: IWhiteboardEvent) => {
    if (e.type === 'nodeSizeChange') {
      if (e.changed.some(i => selectedNodeIdsRef.current.has(i.id))) {
        instance.selectOps?.resetSelectionBox()
      }
    }
  })
  useLayoutEffect(() => {
    setTimeout(() => instance.selectOps?.resetSelectionBox())
  }, [nodes])
  assignProperties(instance, {
    selectOps: {
      isSelecting: () => whiteboardState.isSelecting,
      hasSelectedNodes: () => {
        return selectedNodeIdsRef.current.size > 0
      },
      selectNode: (nodeId, setState = true) => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        idArr.forEach(id => {
          if (setState) {
            instance.values.ID_TO_NODE_MAP.get(id)?.select()
          }
          selectedNodeIdsRef.current.add(id)
        })
      },
      deselectNode: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        idArr.forEach(id => {
          instance.values.ID_TO_NODE_MAP.get(id)?.deselect()
          selectedNodeIdsRef.current.delete(id)
        })
      },
      getSelectedNodes: () => {
        const ids = Array.from(selectedNodeIdsRef.current.values())
        console.log(ids)
        if (!instance.getNode) {
          throw new Error('Failed to initialize whiteboard!')
        }
        return ids
          .map(id => {
            try {
              return instance.getNode?.(id)
            } catch (e) {
              console.log('Node:' + id + 'is deleted!')
              return null
            }
          })
          .filter(i => i) as IWhiteboardNode[]
      },
      removeSelectionBox: () => {
        selectStartPointRef.current = undefined
        selectEndPointRef.current = undefined
        instance.values.selectBox = undefined
        setWhiteboardState(s => ({ ...s, isSelecting: false }))
      },
      resetSelectionBox: () => {
        if (multiSelectedBox) {
          const allSelectedNodes = instance.selectOps?.getSelectedNodes()
          if (allSelectedNodes) {
            const realtimeBoxes = instance.nodeOps?.getDOMBoxOfNodes(allSelectedNodes.map(i => i.id))
            if (realtimeBoxes) {
              const outerBox = getBoxOfBoxes(Array.from(Object.values(realtimeBoxes)))
              if (outerBox) {
                setMultiSelectedBox(outerBox)
                buildOffset(outerBox)
              }
            }
          } else {
            instance.selectOps?.deselectAll()
          }
        }
      },
      deselectAll: skip => {
        const skipIds = new Set(Array.isArray(skip) ? skip : [skip])
        setMultiSelectedBox(undefined)
        selectedNodeIdsRef.current.forEach(id => {
          if (!skipIds.has(id)) {
            instance.selectOps?.deselectNode(id)
            selectedNodeIdsRef.current.delete(id)
          }
        })
        instance.values.selectBox = undefined
        setWhiteboardState(s => ({ ...s, isSelecting: false }))
      }
    }
  })

  const pointerHandler = useMemoizedFn((e: PointerEvent) => {
    // if have pointer draw selection box
    if (multiSelectedBox) {
      if (e.type === 'pointerdown' && e.button === 0 && isPointerOnContainer(e, instance)) {
        if (!multiSelectBoxRef.current?.contains(e.target as HTMLElement)) {
          instance.selectOps?.deselectAll()
        }
      }
    }
    if (
      !whiteboardState.isPanning &&
      !['erase', 'freehand'].includes(whiteboardState.currentTool || '') &&
      whiteboardState.pointerMode === 'select'
    ) {
      if (e.type === 'pointerdown' && e.button === 0) {
        // only allows pointer on container to select
        if (!isPointerOnContainer(e, instance)) return
        const transformedXY = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
        transformedXY && (selectStartPointRef.current = transformedXY)
      }
      if (e.type === 'pointerup') {
        // set timeout here to prevent clear selected nodes state when pointer up
        setTimeout(() => {
          // clear start and end point and box
          instance.selectOps?.removeSelectionBox()
        })
        if (whiteboardState.isSelecting) {
          const currentBox = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
          if (
            currentBox &&
            selectStartPointRef.current &&
            (Math.abs(currentBox.x - selectStartPointRef.current.x) > 3 || Math.abs(currentBox.y - selectStartPointRef.current.y) > 3)
          ) {
            // prevent default here to prevent select unnamed group
            e.preventDefault()
          }
        }
      }
      if (e.type === 'pointermove' && e.button === -1) {
        if (selectStartPointRef.current) {
          const currentBox = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
          if (
            currentBox &&
            selectStartPointRef.current &&
            (Math.abs(currentBox.x - selectStartPointRef.current.x) > 3 || Math.abs(currentBox.y - selectStartPointRef.current.y) > 3)
          ) {
            if (!whiteboardState.isSelecting) {
              setWhiteboardState(s => ({ ...s, isSelecting: true }))
            }
            drawSelectionBox(e)
            rafSelect()
          }
          e.preventDefault()
        }
      }
    }
  })

  const drawSelectionBox = useMemoizedFn((e: PointerEvent) => {
    const transformedXY = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (transformedXY) {
      selectEndPointRef.current = transformedXY
      const startPoint = selectStartPointRef.current
      if (startPoint) {
        const selectBox = calculateSelectionBox({
          startPoint: startPoint,
          endPoint: transformedXY
        })
        selectBoxRef.current?.style.setProperty('transform', `translate(${selectBox.left}px,${selectBox.top}px)`)
        selectBoxRef.current?.style.setProperty('width', `${selectBox.width}px`)
        selectBoxRef.current?.style.setProperty('height', `${selectBox.height}px`)
        instance.values.selectBox = selectBox
      }
    }
  })

  const buildOffset = (outerBox: Box) => {
    const offsetMap = selectedOffsetRef.current
    offsetMap.clear()
    selectedNodeIdsRef.current.forEach(id => {
      const box = instance.nodeOps?.getNodeFuncs(id)?.getRealtimeBox()
      if (box) {
        offsetMap.set(id, {
          left: box.left - outerBox.left,
          top: box.top - outerBox.top
        })
      }
    })
  }
  const rafSelect = useRafFn((skip?: boolean) => {
    const selectBox = instance.values.selectBox
    if (selectBox) {
      selectedNodeIdsRef.current.clear()
      const allNodes = instance.getAllNode?.()
      if (allNodes) {
        const selectedNodes = allNodes.filter(node => {
          const intersected = instance.nodeOps?.intersectWith(node.id, selectBox)
          if (!intersected) {
            instance.selectOps?.deselectNode(node.id)
          }
          return intersected
        })
        if (selectedNodes.length > 0) {
          const outerBox = getBoxOfNodes(selectedNodes)
          if (!outerBox) {
            throw new Error('Failed to select nodes!')
          }
          selectedNodeIdsRef.current = new Set(selectedNodes.map(i => i.id))
          const currentMultiSelectBox = multiSelectedBox
          if (!skip && !_.isEqual(currentMultiSelectBox, outerBox)) {
            setMultiSelectedBox(outerBox)
          }
          buildOffset(outerBox)
          selectedNodes.forEach(node => {
            instance.selectOps?.selectNode(node.id)
          })
          return
        }
      }
      setMultiSelectedBox(undefined)
    }
  })

  useEffect(() => {
    instance.addEventListener('nodeSizeChange', handler)
    document.addEventListener('pointerdown', pointerHandler)
    document.addEventListener('pointermove', pointerHandler)
    document.addEventListener('pointerup', pointerHandler)
    return () => {
      instance.removeEventListener('nodeSizeChange', handler)
      document.removeEventListener('pointerdown', pointerHandler)
      document.removeEventListener('pointermove', pointerHandler)
      document.removeEventListener('pointerup', pointerHandler)
    }
  }, [])

  const renderSelectBox = () => {
    if (whiteboardState.isSelecting) {
      return (
        <div
          ref={selectBoxRef}
          style={{
            position: 'absolute',
            userSelect: 'none',
            background: 'rgba(39, 158, 255, 0.2)',
            overflow: 'hidden',
            zIndex: 11,
            pointerEvents: 'none'
          }}
        ></div>
      )
    }
  }
  const updateMulti = (data: DraggableData) => {
    const map = selectedOffsetRef.current
    instance.updateWhiteboard(w => {
      selectedNodeIdsRef.current.forEach(id => {
        const node = w.nodes?.get(id)
        const offset = map.get(id)
        const newNode: IWhiteboardNode = {
          ...node,
          x: data.x + offset.left,
          y: data.y + offset.top
        }
        w.nodes?.set(id, newNode)
      })
    }, true)
  }

  // update selected nodes position and draw path when moving selection box
  const updateMultiStyle = (data: DraggableData) => {
    const selected = instance.selectOps?.getSelectedNodes()
    const map = selectedOffsetRef.current
    if (selected?.length) {
      selected.forEach(node => {
        const offset = map.get(node.id)
        if (!offset) return
        instance.values.ID_TO_NODE_MAP.get(node.id)?.setStyle({
          transform: `translate(${data.x + offset.left}px, ${data.y + offset.top}px)`
        })
        instance.values.NODE_TO_EDGE_MAP.get(node.id)?.forEach(edgeId => instance.values.ID_TO_EDGE_MAP.get(edgeId)?.drawPath())
      })
    }
  }

  const renderMultiSelectBox = () => {
    if (multiSelectedBox) {
      const { left, top, width, height } = multiSelectedBox
      let canDrag = true
      try {
        selectedNodeIdsRef.current.forEach(i => {
          const n = instance.getNode?.(i)
          if (n) {
            if (n.type === 'mindmap' || n.rootId) {
              canDrag = false
            }
          }
        })
      } catch (e) {
        instance.selectOps?.deselectAll()
        return
      }
      return (
        <WhiteboardRnd
          onContextMenu={event => {
            if (multiSelectedBox) {
              const pos = instance.coordOps?.transformWindowPositionToPosition?.({
                x: event.clientX,
                y: event.clientY
              })
              if (pos) {
                const toolbarState = instance.toolbarOps?.getToolbarState()
                if (toolbarState?.visible && toolbarState.type === 'select') {
                  instance.toolbarOps?.closeToolbar()
                } else {
                  instance.toolbarOps?.openSelectToolbar?.(pos)
                }
              }
            }
          }}
          resizable={false}
          draggable={canDrag}
          size={{ width, height }}
          position={{ x: left, y: top }}
          onMouseDown={e => {
            if (selectedNodeIdsRef.current.size && multiSelectedBox && e.button === 2) {
              if (multiSelectedBox) {
                const pos = instance.coordOps?.transformWindowPositionToPosition?.({
                  x: e.clientX,
                  y: e.clientY
                })
                if (pos) {
                  const toolbarState = instance.toolbarOps?.getToolbarState()
                  if (toolbarState?.visible && toolbarState.type === 'select') {
                    instance.toolbarOps?.closeToolbar()
                  } else {
                    instance.toolbarOps?.openSelectToolbar?.(pos)
                  }
                }
              }
            }
          }}
          lockAspectRatio={true}
          onDragStart={() => {
            isDraggingRef.current = true
          }}
          onDrag={(e, data) => {
            updateMultiStyle(data)
          }}
          onDragStop={(e, data) => {
            isDraggingRef.current = false
            updateMulti(data)
            setMultiSelectedBox(b =>
              b
                ? {
                    ...b,
                    left: data.x,
                    top: data.y
                  }
                : b
            )
          }}
          isDragging={isDraggingRef}
          style={{
            outline: 'calc(3px * var(--zoom-level)) solid var(--select-color)',
            zIndex: 11,
            borderRadius: 4,
            pointerEvents: 'auto'
          }}
        ></WhiteboardRnd>
      )
    }
  }

  const windowPos =
    multiSelectedBox &&
    instance.coordOps?.transformWhiteboardPositionToWindowPosition({ x: multiSelectedBox.left, y: multiSelectedBox.top })
  return (
    <>
      {renderSelectBox()}

      <AnimatePopover
        containerStyle={{
          zIndex: '50'
        }}
        borderRadius={999}
        positions={['top', 'bottom']}
        innerRef={multiSelectBoxRef}
        align={'start'}
        visible={!!windowPos && !whiteboardState.isSelecting}
        content={
          <WithBorder borderRadius={999}>
            <Icon
              onClick={event => {
                if (multiSelectedBox) {
                  const pos = instance.coordOps?.transformWindowPositionToPosition?.({
                    x: event.clientX + 10,
                    y: event.clientY
                  })
                  if (pos) {
                    const toolbarState = instance.toolbarOps?.getToolbarState()
                    if (toolbarState?.visible && toolbarState.type === 'select') {
                      instance.toolbarOps?.closeToolbar()
                    } else {
                      instance.toolbarOps?.openSelectToolbar?.(pos)
                    }
                  }
                }
              }}
              name={Icons.More}
              className={ClassName.circleButton(6)}
              size={20}
            />
          </WithBorder>
        }
        keepAlign
        padding={10}
      >
        {renderMultiSelectBox()}
      </AnimatePopover>
    </>
  )
})

export default WhiteboardSelect
