import { Icon, TabPane, Tabs } from '@/components'
import { memo } from 'react'
import { Resizable } from 're-resizable'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { assignProperties } from '@/utils'
import { atom, useAtom } from 'jotai'
import { IWhiteboardRightbarState } from '~/typings'
import { Colors } from '@/consts'
import WhiteboardContent from '@/core/components/whiteboard/sidebar/WhiteboardContent'
import { MetaStore } from '@/api/stores'
import { css } from '@emotion/css'
import SidebarObjectViewer from '@/core/components/SidebarObjectViewer'

export const WhiteboardSidebarStateAtom = atom<IWhiteboardRightbarState>({ visible: false, width: '480px' })

const WhiteboardRightbar = () => {
  const [rightBarState, setRightBarState] = useAtom(WhiteboardSidebarStateAtom)
  const instance = useWhiteboardInstance()
  const { currentTab } = rightBarState
  const renderItem = (type: string, metaId: number) => {
    return (
      <div
        onWheelCapture={e => {
          e.stopPropagation()
        }}
        key={metaId}
        style={{ width: '100%', height: '100%' }}
      >
        <SidebarObjectViewer
          id={metaId}
          pageConfig={{
            defaultOpenSidebar: false,
            editorHeader: true,
            pdfHeader: true,
            editorAdd: false,
            whiteboardHeader: true
          }}
        />
      </div>
    )
  }

  assignProperties(instance, {
    sidebarOps: {
      openNodeAtSidebar: nodeId => {
        const node = instance.getNode?.(nodeId)
        if (node && node.type === 'metaObject') {
          const meta = MetaStore.getMetaObjectsMap().get(node.metaObjectId)
          if (meta) {
            setRightBarState(s => ({
              ...s,
              active: 'content',
              visible: true,
              currentTab: {
                metaId: meta.id,
                type: meta.type,
                objectId: meta.objectId
              }
            }))
          }
        }
      }
    }
  })
  const { active, visible, width } = rightBarState

  // @ts-ignore
  return (
    <Resizable
      enable={{
        left: visible
      }}
      defaultSize={{
        width: '520px',
        height: '100%'
      }}
      onResizeStop={(event, direction, elementRef, delta) => {
        const width = elementRef.getBoundingClientRect().width
        setRightBarState(s => ({ ...s, width: `${width}px` }))
      }}
      maxWidth={'80%'}
      minWidth={300}
      style={{
        boxShadow: 'var(--box-shadow)',
        position: 'absolute',
        opacity: visible ? 1 : 0,
        right: 0,
        top: 0,
        zIndex: 50,
        pointerEvents: visible ? 'auto' : 'none',
        background: Colors.Background.Popover,
        paddingTop: rightBarState.active === 'outline' ? 12 : 0,
        paddingLeft: rightBarState.active === 'outline' ? 4 : 0
      }}
      className={
        !visible
          ? // @ts-ignore
            css({
              '*': {
                pointerEvents: 'none !important'
              }
            })
          : undefined
      }
    >
      {visible && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: -38,
            boxShadow: 'var(--border-box-shadow)',
            background: Colors.Background.Popover,
            borderRadius: 4
          }}
        >
          <Icon
            size={18}
            style={{
              padding: 5,
              cursor: 'pointer'
            }}
            onClick={() => {
              setRightBarState(s => ({ ...s, visible: false }))
            }}
            name={'park-double-right'}
          />
        </div>
      )}
      {currentTab && renderItem(currentTab.type, currentTab.metaId)}
    </Resizable>
  )
}

export default memo(WhiteboardRightbar)
