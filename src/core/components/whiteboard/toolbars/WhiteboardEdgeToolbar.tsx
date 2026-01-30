import { AnimatePopover, Toolbar, ToolbarV2, WithBorder } from '@/components'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { useWhiteboardEdges } from '@/core/components/whiteboard/StateHooks'
import { IWhiteboardEdge } from '~/typings'
import { Colors, Icons, MarkerColor } from '@/consts'
import BlockColorPicker from '@/core/components/editor/components/BlockColorPicker'
import { defaultBgColor } from '@/components/picker/colorPicker'
import { useTranslation } from 'react-i18next'
import { getSetting } from '@/core'
import trans from '@/consts/trans'
import { useRef } from 'react'
import WhiteboardCardFormatter from '@/core/components/whiteboard/toolbars/WhiteboardCardFormatter'
const types = {
  straight: {
    icon: 'custom-straight',
    value: 'straight',
    children: 'straight'
  },
  curve: {
    icon: 'custom-curve',
    value: 'curve',
    children: 'curve'
  },
  polyline: {
    icon: 'park-connection',
    value: 'polyline',
    children: 'step'
  }
}
const styles = {
  straight: {
    icon: 'custom-straight-no-arrow',
    value: 'straight',
    width: 10,
    children: 'straight'
  },
  regular: {
    icon: 'custom-straight-no-arrow',
    value: 'regular',
    children: 'regular',
    width: 20
  },
  thick: {
    icon: 'custom-straight-no-arrow',
    value: 'thick',
    width: 30,
    children: 'thick'
  },
  dash: {
    icon: 'custom-dash',
    value: 'dash',
    children: 'dash',
    width: undefined
  },
  animatedDash: { icon: 'custom-animated-dash', value: 'animatedDash', children: 'animated', width: undefined }
}

export default ({ edgeId }: { edgeId: number }) => {
  const { t } = useTranslation()
  const instance = useWhiteboardInstance()
  const currentEdge = useWhiteboardEdges().get(edgeId) as IWhiteboardEdge | undefined
  const setting = getSetting()
  const currentSetV = useRef<(v: boolean) => void>()
  return (
    <ToolbarV2
      layout={[
        {
          type: 'button',
          text: t(trans.Edit),
          icon: Icons.Edit,
          onClick: () => {
            setTimeout(() => instance.edgeOps?.getEdgeFuncs(edgeId)?.edit())
            instance.toolbarOps?.closeToolbar()
          },
          key: 'edit'
        },
        {
          type: 'button',
          key: 'color',
          element: (
            <div
              onPointerDown={() => {
                currentSetV.current?.(false)
                currentSetV.current = undefined
              }}
              className={'flex items-center justify-center !h-8 button'}
            >
              <div
                style={{
                  background: Colors.getAdaptColor(currentEdge?.color || MarkerColor.PRIMARY),
                  width: 16,
                  height: 16,
                  borderRadius: 9999
                }}
              ></div>
            </div>
          ),
          positions: ['top', 'bottom'],
          popover: setV =>
            setTimeout(() => (currentSetV.current = setV), 200) && (
              <WhiteboardCardFormatter
                onBackgroundChange={c => {
                  instance.updateEdge?.(edgeId, e => ({ ...e, color: c }), true)
                  setV(false)
                }}
                background={currentEdge?.color}
              />
            )
        },
        {
          type: 'button',
          key: 'line-type',
          positions: ['top', 'bottom'],
          onPointerDown: () => {
            currentSetV.current?.(false)
            currentSetV.current = undefined
          },
          icon: types[currentEdge?.lineType || setting.whiteboard.defaultLineType].icon,
          popover: setV =>
            setTimeout(() => (currentSetV.current = setV), 200) && (
              <WithBorder className={'!rounded-lg'}>
                <ToolbarV2
                  layout={Object.values(types).map(i => ({
                    type: 'button',
                    icon: i.icon,
                    key: i.value,
                    onClick: () => {
                      instance.updateEdge?.(edgeId, e => ({ ...e, lineType: i.value }), true)
                      setV(false)
                    }
                  }))}
                />
              </WithBorder>
            )
        },
        {
          type: 'button',
          key: 'line-stroke',
          positions: ['top', 'bottom'],
          strokeWidth: styles[currentEdge?.lineStyle || 'straight'].width,
          icon: styles[currentEdge?.lineStyle || 'straight'].icon,
          onPointerDown: () => {
            currentSetV.current?.(false)
            currentSetV.current = undefined
          },
          popover: setV =>
            setTimeout(() => (currentSetV.current = setV), 200) && (
              <WithBorder className={'!rounded-lg'}>
                <ToolbarV2
                  layout={Object.values(styles).map(i => ({
                    type: 'button',
                    icon: i.icon,
                    key: i.value,
                    strokeWidth: i.width,
                    onClick: () => {
                      instance.updateEdge?.(edgeId, e => ({ ...e, lineStyle: i.value }), true)
                      setV(false)
                    }
                  }))}
                />
              </WithBorder>
            )
        },
        {
          type: 'button',
          key: 'delete',
          icon: Icons.Delete,
          onClick: () => {
            instance.deleteEdge?.(edgeId)
            instance.toolbarOps?.closeToolbar()
          }
        }
      ]}
    ></ToolbarV2>
  )
}
