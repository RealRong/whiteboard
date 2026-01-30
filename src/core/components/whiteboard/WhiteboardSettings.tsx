import { AnimatePopover, Button, Icon, WithBorder } from '@/components'
import { GlobalSetting } from '@/core'
import produce from 'immer'
import { useTranslation } from 'react-i18next'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { useSelectAtomValue } from '@/hooks'
import { memo } from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { Icons } from '@/consts'
import { exportWhiteboardAsImage } from '@/core/components/whiteboard/utils/exportAsImage'
import { downloadImg } from '@/utils'
import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import trans from '@/consts/trans'
const WhiteboardSettings = memo(() => {
  const name = useSelectAtomValue(WhiteboardStateAtom, s => s.name)
  const [setting, setSetting] = GlobalSetting.useSetting()
  const { t } = useTranslation()
  const whiteboardHideObjects = useSelectAtomValue(WhiteboardAtom, s => s?.hideObjects)
  const whiteboardLineType = useSelectAtomValue(WhiteboardAtom, s => s?.lineType)
  const whiteboardBackgroundType = useSelectAtomValue(WhiteboardAtom, s => s?.backgroundType)
  const instance = useWhiteboardInstance()
  const setLineType = t => {
    setSetting(
      produce(setting, draft => {
        draft.whiteboard.defaultLineType = t
      })
    )
    instance.updateWhiteboard?.(w => {
      w.lineType = t
    })
  }
  const setBackgroundType = t => {
    setSetting(
      produce(setting, draft => {
        draft.whiteboard.defaultBackgroundType = t
      })
    )
    instance.updateWhiteboard?.(w => {
      w.backgroundType = t
    })
  }
  return (
    <>
      <AnimatePopover
        padding={16}
        align="end"
        content={setV => (
          <WithBorder className={'p-1.5'} width={220}>
            <Button.IconButton
              icon="park-horizontally-centered"
              text={t('settings.snap to objects')}
              enabled={setting.whiteboard.snapToObject}
              onClick={() => {
                setSetting(s =>
                  produce(s, draft => {
                    draft.whiteboard.snapToObject = !draft.whiteboard.snapToObject
                  })
                )
              }}
            />
            <Button.IconButton
              icon={'park-preview-close'}
              text={t('general.Hide objects')}
              enabled={whiteboardHideObjects}
              onClick={() => {
                instance.updateWhiteboard?.(w => {
                  w.hideObjects = !whiteboardHideObjects
                })
              }}
            />
            <div className={'menu-sub-title'} style={{ margin: '4px 6px' }}>
              {t('whiteboard.Line type')}
            </div>
            <Button.IconButton
              enabled={whiteboardLineType === 'straight'}
              icon="custom-straight"
              onClick={() => setLineType('straight')}
              text={t('whiteboard.Straight line')}
            />
            <Button.IconButton
              enabled={whiteboardLineType === 'curve'}
              icon="custom-curve"
              onClick={() => setLineType('curve')}
              text={t('whiteboard.Curve line')}
            />
            <Button.IconButton
              enabled={whiteboardLineType === 'polyline'}
              icon="park-connection"
              onClick={() => setLineType('polyline')}
              text={t('whiteboard.Step line')}
            />
            <div className={'menu-sub-title'} style={{ margin: '4px 6px' }}>
              {t('whiteboard.Background type')}
            </div>
            <Button.IconButton
              enabled={whiteboardBackgroundType === 'none'}
              icon="park-close"
              onClick={() => setBackgroundType('none')}
              text={t('general.None')}
            />
            <Button.IconButton
              enabled={whiteboardBackgroundType === 'dot'}
              icon="custom-dots"
              onClick={() => setBackgroundType('dot')}
              text={t('whiteboard.Dots')}
            />
            <Button.IconButton
              enabled={whiteboardBackgroundType === 'line'}
              icon="park-grid-two"
              onClick={() => setBackgroundType('line')}
              text={t('general.Line')}
            />
            <div className={'my-1.5 border-top w-full'}></div>
            <Button.IconButton
              icon="park-download-four"
              onClick={() => {
                setV(false)
                const allNodes = instance.getAllNode?.()
                const container = instance.getContainerNode?.()
                if (allNodes && container) {
                  exportWhiteboardAsImage(allNodes, container, instance).then(i => {
                    downloadImg(i, name || t(trans.Unnamed))
                  })
                }
              }}
              text={t('general.Export as image')}
            />
          </WithBorder>
        )}
        positions={['top']}
      >
        <Icon
          className={'square-button-small'}
          size={17}
          name={Icons.More}
          containerStyle={{
            pointerEvents: 'auto'
          }}
        />
      </AnimatePopover>
    </>
  )
})

export default WhiteboardSettings
