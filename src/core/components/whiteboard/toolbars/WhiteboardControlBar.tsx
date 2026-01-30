import { useSelectWhiteboardState, useSetWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { Icon, IconWithPopover } from '@/components'
import { Colors, Icons } from '@/consts'
import WhiteboardMinimap from '@/core/components/whiteboard/WhiteboardMinimap'
import { memo } from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'
import TooltipWithCmd from '@/components/TooltipWithCmd'
import { useTranslation } from 'react-i18next'
import classnames from 'classnames'
import WhiteboardSettings from '@/core/components/whiteboard/WhiteboardSettings'
import trans from '@/consts/trans'
import { useAtom } from 'jotai/index'
import { WhiteboardSidebarStateAtom } from '@/core/components/whiteboard/sidebar/WhiteboardRightbar'
import WhiteboardContent from '@/core/components/whiteboard/sidebar/WhiteboardContent'

const WhiteboardControlBar = memo(() => {
  const setWhiteboardState = useSetWhiteboardState()
  const instance = useWhiteboardInstance()
  const { t } = useTranslation()
  const [rightBarState, setRightBarState] = useAtom(WhiteboardSidebarStateAtom)
  const { readOnly, currentTool, isPanning, pointerMode, toolbarPointerMode, zoom } = useSelectWhiteboardState(s => ({
    readOnly: s.readOnly,
    currentTool: s.currentTool,
    isPanning: s.isPanning,
    pointerMode: s.pointerMode,
    toolbarPointerMode: s.toolbarPointerMode,
    zoom: s.zoom
  }))
  return (
    <div
      className={'flex gap-3 absolute items-center z-10'}
      style={{
        right: 20,
        bottom: 20
      }}
    >
      <div className={'rounded-lg items-center gap-2 flex py-1.5 px-2 border-box-shadow bg-popover'}>
        {!readOnly && (
          <>
            <Icon
              onClick={() => {
                setWhiteboardState(s => ({
                  ...s,
                  currentTool: s.currentTool === 'freehand' ? undefined : 'freehand',
                  pointerMode: s.currentTool === 'freehand' ? s.pointerMode : 'select',
                  toolbarPointerMode: s.currentTool === 'freehand' ? s.toolbarPointerMode : 'select'
                }))
              }}
              className={classnames('square-button', currentTool === 'freehand' && 'active-button')}
              name={'custom-markerpen'}
            />
          </>
        )}
        <Icon
          onClick={() => {
            setWhiteboardState(s => ({
              ...s,
              currentTool: undefined,
              toolbarPointerMode: s.currentTool ? s.toolbarPointerMode : s.toolbarPointerMode === 'pan' ? 'select' : 'pan',
              pointerMode: s.currentTool ? s.pointerMode : s.toolbarPointerMode === 'select' ? 'pan' : 'select'
            }))
          }}
          style={{
            pointerEvents: readOnly ? 'none' : 'auto'
          }}
          className={classnames('square-button', !currentTool && 'active-button')}
          name={readOnly || isPanning || pointerMode === 'pan' || toolbarPointerMode === 'pan' ? 'park-fist' : 'park-move-one'}
        />
        <div style={{ height: 20, width: 1, background: Colors.Background.Border }}></div>
        <Icon
          onClick={e => {
            e.stopPropagation()
            e.preventDefault()
            const containerBounding = instance.getOutestContainerNode()?.getBoundingClientRect()
            if (!containerBounding) return
            instance.panzoom?.smoothZoom(containerBounding.width / 2, containerBounding.height / 2, 0.5)
          }}
          name={'park-minus'}
          className={'square-button'}
        />
        <div
          onClick={() => {
            const allNodes = instance.getAllNode?.()
            if (allNodes?.length) {
              const box = getBoxOfNodes(allNodes)
              if (box) {
                instance.containerOps?.fitTo(box)
                return
              }
            }
            const bounding = instance.getOutestContainerNode()?.getBoundingClientRect()
            if (bounding) {
              instance.panzoom?.smoothZoomAbs(bounding.width / 2, bounding.height / 2, 1)
            }
          }}
          className={'text-sm mx-1 font-semibold cursor-pointer'}
        >
          {(zoom * 100).toFixed(0)}%
        </div>
        <Icon
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            const containerBounding = instance.getOutestContainerNode()?.getBoundingClientRect()
            if (containerBounding) {
              instance.panzoom?.smoothZoom(containerBounding.width / 2, containerBounding.height / 2, 2)
            }
          }}
          name={'park-plus'}
          className={'square-button'}
        />
        <div style={{ height: 20, width: 1, background: Colors.Background.Border }}></div>
        <Icon
          name={Icons.Search}
          className={'square-button'}
          tooltip={<TooltipWithCmd cmd={'Cmd+F'} name={t(trans.Search)}></TooltipWithCmd>}
          onClick={() => instance.searchOps?.toggleSearchPanel(true)}
        />
        <IconWithPopover
          padding={12}
          size={14}
          content={setV => (
            <div style={{ paddingRight: 10 }}>
              <WhiteboardContent onClose={() => setV(false)} />
            </div>
          )}
          name={'custom-list'}
          className={'square-button'}
        />
        <IconWithPopover
          padding={12}
          size={14}
          content={
            <div style={{ paddingRight: 10 }}>
              <WhiteboardMinimap />
            </div>
          }
          name={'park-map-draw'}
          className={'square-button'}
        />
        <WhiteboardSettings />
      </div>
    </div>
  )
})

export default WhiteboardControlBar
