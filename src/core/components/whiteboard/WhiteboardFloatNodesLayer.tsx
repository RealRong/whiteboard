import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { assignProperties } from '@/utils'
import { memo, useState } from 'react'
import { Icon, ResizeAndDrag } from '@/components'
import { MetaStore } from '@/api/stores'
import { Colors } from '@/consts'
import { ClassName } from 'rendevoz'
import SidebarObjectViewer from '@/core/components/SidebarObjectViewer'

export default memo(() => {
  const instance = useWhiteboardInstance()
  const [currentFloatNodes, setCurrentFloatNodes] = useState<
    {
      x: number
      y: number
      type: string
      nodeId: number
      objectId: number
      metaId: number
    }[]
  >([])
  assignProperties(instance, {
    floatOps: {
      openNode: nodeId => {
        console.log('trigger here')
        if (currentFloatNodes.some(i => i.nodeId === nodeId)) return
        const n = instance.getNode?.(nodeId)
        if (n) {
          if (n.type === 'metaObject') {
            const meta = MetaStore.getMetaObjectsMap().get(n.metaObjectId)
            if (meta && meta.objectId) {
              const winPos = instance.coordOps?.transformWhiteboardPositionToWindowPosition({
                x: n.x + n.width,
                y: n.y
              })
              const containerBounding = instance.getOutestContainerNode?.().getBoundingClientRect()
              if (!containerBounding) return
              setCurrentFloatNodes(s => [
                ...s,
                {
                  x: Math.min(winPos.x - containerBounding.left, containerBounding.right - containerBounding.left - 480 - 50),
                  y: Math.max(winPos.y - containerBounding.top, 50),
                  nodeId,
                  type: meta.type,
                  metaId: meta.id,
                  objectId: meta.objectId
                }
              ])
            }
          }
        }
      }
    }
  })
  const renderItem = (type: string, metaId: number, objectId?: number) => {
    if (!type || !objectId) return
    return (
      <div
        onWheelCapture={e => {
          e.stopPropagation()
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <SidebarObjectViewer
          id={metaId}
          pageConfig={{
            defaultOpenSidebar: false
          }}
        />
      </div>
    )
  }
  if (currentFloatNodes.length) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 51
        }}
      >
        {currentFloatNodes.map(i => (
          <ResizeAndDrag
            bounds={'parent'}
            key={i.objectId}
            default={{
              x: i.x,
              y: i.y,
              width: 480,
              height: 480
            }}
            style={{
              pointerEvents: 'auto',
              padding: '28px 8px 8px'
            }}
            dragHandleClassName={'handle'}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: -1,
                pointerEvents: 'none',
                borderRadius: 8,
                background: Colors.Background.Secondary,
                boxShadow: Colors.Background.PopoverBoxShadow
              }}
            ></div>
            <div
              className={'handle'}
              style={{
                position: 'absolute',
                top: 0,
                cursor: 'grab',
                left: 0,
                width: '100%',
                gap: 8,
                padding: '4px 8px',
                borderRadius: '8px 8px 0px 0px',
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}
            >
              <Icon
                size={15}
                name={'park-local-two'}
                onClick={() => {
                  instance.containerOps?.fitToNode(i.nodeId)
                }}
                className={ClassName.flatButton(4, '2px')}
              />
              <Icon
                size={15}
                name={'park-close'}
                onClick={() => {
                  setCurrentFloatNodes(s => s.filter(o => o !== i))
                }}
                className={ClassName.flatButton(4, '2px')}
              />
            </div>
            <div
              style={{
                width: '100%',
                height: '100%',
                borderRadius: 8,
                position: 'relative',
                overflow: 'hidden auto',
                border: '1px solid var(--border-background)',
                background: 'var(--global-background)'
              }}
            >
              {renderItem(i.type, i.metaId, i.objectId)}
            </div>
          </ResizeAndDrag>
        ))}
      </div>
    )
  }

  return null
})
