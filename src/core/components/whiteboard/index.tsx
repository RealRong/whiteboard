import { Provider, useAtomValue } from 'jotai/react'
import { createStore } from 'jotai/vanilla'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { WhiteboardAtom } from './StateHooks'
import TreeNodeContainer from './node/NodeContainer'
import WhiteboardSelect from './hooks/WhiteboardSelect'
import { globalStore, ObjectStore } from '@/api/stores'
import { IWhiteboardEvent, IWhiteboardNode, IWhiteboardProps } from '~/typings/data'
import { Content, Icon } from '@/components'
import { useClickOutside, useSelectAtomValue } from '@/hooks'
import WhiteboardRightbar, { WhiteboardSidebarStateAtom } from './sidebar/WhiteboardRightbar'
import { useSelectWhiteboardState, WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { useWhiteboardInstance, WhiteboardInstanceAtom } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { IWhiteboardInstance } from '~/typings'
import { assignProperties, waitFor } from '@/utils'
import WhiteboardEmptyIndicator from '@/core/components/whiteboard/WhiteboardEmptyIndicator'
import Background from '@/core/components/whiteboard/Background'
import { getSetting } from '@/core'
import FreeHandLayer from '@/core/components/whiteboard/freehand/FreeHandLayer'
import WhiteboardPanzoom from '@/core/components/whiteboard/hooks/WhiteboardPanzoom'
import WhiteboardControlBar from '@/core/components/whiteboard/toolbars/WhiteboardControlBar'
import WhiteboardPenToolsBar from '@/core/components/whiteboard/toolbars/WhiteboardPenToolsBar'
import WhiteboardFloatBar from '@/core/components/whiteboard/toolbars/WhiteboardFloatBar'
import WhiteboardLint from '@/core/components/whiteboard/WhiteboardLint'
import { useSetAtom, useStore } from 'jotai'
import WhiteboardFloatNodesLayer from '@/core/components/whiteboard/WhiteboardFloatNodesLayer'
import WhiteboardHookContainer from '@/core/components/whiteboard/WhiteboardHookContainer'
import SnapDragLayer from '@/core/components/whiteboard/SnapDragLayer'
import FakeMindmapDragLayer from '@/core/components/whiteboard/node/mindmap/FakeMindmapDragLayer'
import WhiteboardSearch from '@/core/components/whiteboard/WhiteboardSearch'
import WhiteboardPasteSelector from '@/core/components/whiteboard/WhiteboardPasteSelector'
import { debounce } from 'lodash'
import useWhiteboardHideObjects from '@/core/components/whiteboard/hooks/useWhiteboardHideObjects'
import { Icons } from '@/consts'
import WhiteboardResizeObserver from '@/core/components/whiteboard/hooks/WhiteboardResizeObserver'

const WhiteboardInner = memo(({ onInstanceInitialized, layout, id, readOnly, state, name }: IWhiteboardProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const outestContainerRef = useRef<HTMLDivElement>(null)
  const nodes = useSelectAtomValue(WhiteboardAtom, s => s?.nodes)
  const instance = useWhiteboardInstance()
  const eventListeners = useRef<Record<IWhiteboardEvent['type'], Set<any>>>({})
  useWhiteboardHideObjects()
  const store = useStore()
  const setWhiteboardState = useSetAtom(WhiteboardStateAtom)
  const loaded = useSelectWhiteboardState(s => s.loaded)
  const [viewportInitialized, setViewportInitialized] = useState(false)
  const getLatestWhiteboard = () => {
    return store.get(WhiteboardAtom)
  }
  useEffect(() => {
    setWhiteboardState(s => ({
      ...s,
      readOnly,
      layout,
      state,
      name,
      currentTool: readOnly ? undefined : s.currentTool,
      pointerMode: readOnly ? 'pan' : s.pointerMode,
      toolbarPointerMode: readOnly ? 'pan' : s.toolbarPointerMode
    }))
  }, [readOnly, layout, state, name])
  assignProperties(instance, {
    getState: () => store.get(WhiteboardStateAtom),
    getContainerNode: () => containerRef.current!,
    getOutestContainerNode: () => containerRef.current?.parentElement,
    getAllNode: () => Array.from(getLatestWhiteboard()?.nodes?.values() || []),
    getEdge: edgeId => getLatestWhiteboard()?.edges?.get(edgeId),
    getAllEdge: () => Array.from(getLatestWhiteboard()?.edges?.values() || []),
    isFocused: (includeInner = true) => {
      if (includeInner) {
        if (instance.values.isFocused) return true
      } else {
        if (instance.values.isFocused) {
          if (instance.getOutestContainerNode?.() !== document.activeElement && document.activeElement !== document.body) return true
        }
      }
      return false
    },
    setFocused: f => {
      instance.values.isFocused = true
      if (f) {
        instance.getOutestContainerNode?.()?.focus()
      }
    },
    buildNodeToEdgeIndex: () => {
      const nodeToEdgesMap = instance.values.NODE_TO_EDGE_MAP
      nodeToEdgesMap.clear()
      const edges = Array.from(getLatestWhiteboard()?.edges?.values() || [])
      edges.forEach(edge => {
        const { sourceId, targetId, id } = edge
        const ss = nodeToEdgesMap.get(sourceId)
        ss ? ss.add(id) : nodeToEdgesMap.set(sourceId, new Set([id]))
        const ts = nodeToEdgesMap.get(targetId)
        ts ? ts.add(id) : nodeToEdgesMap.set(targetId, new Set([id]))
        return () => {
          nodeToEdgesMap.get(sourceId)?.delete(id)
          nodeToEdgesMap.get(targetId)?.delete(id)
        }
      })
    },
    addEventListener: (type, listener) => {
      const set = eventListeners.current[type] || new Set()
      set.add(listener)
      eventListeners.current[type] = set
    },
    emit: e => {
      eventListeners.current[e.type]?.forEach(l => l(e))
    },
    removeEventListener: (type, listener) => {
      eventListeners.current[type]?.delete(listener)
    }
  })
  useEffect(() => {
    const noZNodes: IWhiteboardNode[] = []
    if (nodes?.size) {
      Array.from(nodes.values()).forEach(n => {
        if (n.z === undefined) {
          noZNodes.push(n)
        }
      })
      if (noZNodes.length) {
        instance.updateWhiteboard?.(w => {
          noZNodes.forEach((n, index) => {
            w.nodes?.set(n.id, { ...n, z: index })
          })
        })
      }
    }
  }, [nodes])
  const rightBarState = useAtomValue(WhiteboardSidebarStateAtom)
  useEffect(() => {
    const globalHandler = (e: Event) => {
      if (e.type === 'keyup') {
        instance.emit({
          type: 'keyup',
          e: e as KeyboardEvent
        })
      }
      if (e.type === 'pointerup') {
        instance.emit({
          type: 'pointerup',
          e: e as PointerEvent
        })
      }
    }
    document.addEventListener('keyup', globalHandler)
    document.addEventListener('pointerup', globalHandler)
    return () => {
      document.removeEventListener('keyup', globalHandler)
      document.removeEventListener('pointerup', globalHandler)
    }
  }, [])
  useClickOutside(
    () => {
      instance.setFocused(false)
    },
    {
      current: outestContainerRef.current
    }
  )
  return (
    <>
      <WhiteboardPanzoom
        onInitialized={() => {
          setViewportInitialized(true)
          setTimeout(() => {
            setWhiteboardState(s => ({ ...s, loaded: true }))
            instance.startResizeObserving?.()
            onInstanceInitialized?.(instance)
            instance.setFocused(true)
            instance.nodeOps?.updateRelatedEdges(Array.from(nodes?.keys() || []))
          }, 200)
        }}
      />
      <WhiteboardResizeObserver />
      {viewportInitialized && <WhiteboardHookContainer whiteboardId={id} />}
      <Content
        fullHeight
        fullWidth
        role="data-container"
        ref={outestContainerRef}
        tabIndex={0}
        onPointerDown={e => {
          instance.emit({
            type: 'pointerdown',
            e: e.nativeEvent
          })
          if (e.target === e.currentTarget) {
            instance.selectOps?.deselectAll()
          }
        }}
        onPointerMove={e => {
          instance.emit({
            type: 'pointermove',
            e: e.nativeEvent
          })
        }}
        onPointerUpCapture={e => {
          const isPanning = store.get(WhiteboardStateAtom).isPanning
          if (!isPanning && e.button === 2 && e.target === e.currentTarget) {
            const coord = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
            if (coord) {
              instance.toolbarOps?.openContextMenuToolbar({
                x: coord.x,
                y: coord.y
              })
            }
          }
        }}
        onContextMenu={e => {
          if (e.target === e.currentTarget) {
            const coord = instance.coordOps?.transformWindowPositionToPosition({ x: e.clientX, y: e.clientY })
            if (coord) {
              instance.toolbarOps?.openContextMenuToolbar({
                x: coord.x,
                y: coord.y
              })
            }
          }
        }}
        onPointerDownCapture={() => {
          instance.values.isFocused = true
        }}
        onFocus={() => {
          instance.values.isFocused = true
        }}
        style={{
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease',
          overflow: 'clip',
          width: rightBarState.visible ? `calc(100% - ${rightBarState.width})` : undefined
        }}
      >
        <div
          ref={containerRef}
          role="data-container"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            zIndex: 1,
            background: 'transparent',
            pointerEvents: 'none',
            '--zoom-level': '1'
          }}
          onClick={e => {
            instance.emit({
              type: 'dataContainerClick',
              e: e.nativeEvent
            })
          }}
        >
          {viewportInitialized && <TreeNodeContainer />}
          {!readOnly && (
            <>
              <WhiteboardSelect />
              <SnapDragLayer />
              <FreeHandLayer />
            </>
          )}
        </div>
        <WhiteboardEmptyIndicator />
        <Background />
        <WhiteboardFloatBar />
        <WhiteboardLint />
        {layout?.showPencilToolbar !== false && !readOnly && layout?.showLeftToolbar !== false && <WhiteboardPenToolsBar />}
        {layout?.showControlBar !== false && <WhiteboardControlBar />}
      </Content>
      <WhiteboardFloatNodesLayer />
      <WhiteboardRightbar />
      <WhiteboardSearch />
      <WhiteboardPasteSelector />
      <FakeMindmapDragLayer />
    </>
  )
})

export const Whiteboard = memo(
  ({
    whiteboardId,
    readOnly,
    name,
    onRename,
    onInstanceInitialized,
    layout,
    state
  }: {
    whiteboardId: number
    onInstanceInitialized?: (i: IWhiteboardInstance) => void
  } & Omit<IWhiteboardProps, 'id'>) => {
    const outerWhiteboardAtom = ObjectStore('whiteboard').createAtom(whiteboardId)
    const whiteboard = ObjectStore('whiteboard').useValue(whiteboardId)
    const store = useMemo(() => {
      const store = createStore()
      const instance: IWhiteboardInstance = {
        values: {
          isFocused: false,
          store,
          id: whiteboardId,
          copiedElements: [],
          ID_TO_NODE_MAP: new Map(),
          ID_TO_EDGE_MAP: new Map(),
          NODE_TO_EDGE_MAP: new Map(),
          mindmapChildrenToFlattenChildren: new WeakMap(),
          mindmapLeftTreeWeakMap: new WeakMap(),
          mindmapRightTreeWeakMap: new WeakMap()
        }
      }
      store.set(WhiteboardInstanceAtom, instance)
      return store
    }, [whiteboardId])
    const unsub = useMemo(() => {
      if (whiteboard) {
        let w = { ...whiteboard }
        if (!whiteboard.lineType) {
          const setting = getSetting()
          w.lineType = setting.whiteboard.defaultLineType || 'curve'
          w.backgroundType = setting.whiteboard.defaultBackgroundType || 'none'
          ObjectStore('whiteboard').updateOne({
            id: whiteboardId,
            lineType: setting.whiteboard.defaultLineType || 'curve',
            backgroundType: setting.whiteboard.defaultBackgroundType || 'none'
          })
        }
        store.set(WhiteboardAtom, w)
        const debounced = debounce(w => {
          store.set(WhiteboardAtom, w)
        }, 1000)
        const unsub = globalStore.sub(outerWhiteboardAtom, () => {
          const inner = store.get(WhiteboardAtom)
          const whiteboard = globalStore.get(outerWhiteboardAtom)
          if (whiteboard !== inner) {
            debounced(whiteboard)
          }
        })
        return unsub
      }
    }, [whiteboard?.id])
    useEffect(() => {
      return () => {
        if (unsub) {
          unsub()
        }
      }
    }, [unsub])
    if (!whiteboard) return null
    return (
      <Provider store={store}>
        {whiteboardId && (
          <WhiteboardInner
            name={name}
            onRename={onRename}
            onInstanceInitialized={onInstanceInitialized}
            id={whiteboardId}
            layout={layout}
            readOnly={readOnly}
            state={state}
          />
        )}
      </Provider>
    )
  }
)
