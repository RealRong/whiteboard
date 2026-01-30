import { memo, useRef, useState } from 'react'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { XYPosition } from '~/typings'
import { assignProperties } from '@/utils'
import { AnimatePopover, Menu, WithBorder } from '@/components'
import getPasteItem from '@/core/components/whiteboard/hooks/ops/paste/getPasteItem'
import { useTranslation } from 'react-i18next'

export default memo(() => {
  const [pasteState, setPasteState] = useState<{
    visible: boolean
    display?: ('text' | 'image' | 'nodes' | 'objects')[]
    position?: XYPosition
  }>({
    visible: false
  })
  const { t } = useTranslation()
  const instance = useWhiteboardInstance()
  assignProperties(instance, {
    toolbarOps: {
      ...instance.toolbarOps,
      selectPasteOption: async position => {
        const displays = await getPasteItem()
        if (displays.length === 1) {
          return displays[0]
        }
        setPasteState(s => ({ ...s, position, visible: true, display: displays }))
        return new Promise(res => {
          promiseRef.current = res
        })
      }
    }
  })
  const promiseRef = useRef<(v: 'text' | 'image' | 'nodes') => void>()
  return (
    <AnimatePopover
      onClickOutside={() => setPasteState(s => ({ ...s, visible: false }))}
      visible={!!(pasteState.visible && pasteState.position)}
      position={{
        left: pasteState.position?.x ?? 0,
        top: pasteState.position?.y ?? 0
      }}
      align={'start'}
      positions={['right', 'left']}
      content={
        <WithBorder padding={'0.4rem 0'}>
          <Menu.NavigationMenu
            layout={
              [
                {
                  type: 'title',
                  name: t('general.Paste')
                },
                ...(pasteState.display?.map(i => ({
                  type: 'item',
                  text: t(`whiteboard.Paste ${i}`),
                  key: i,
                  onSelect: () => {
                    setPasteState(s => ({ ...s, visible: false }))
                    promiseRef.current?.(i)
                    promiseRef.current = undefined
                  }
                })) || [])
              ] || []
            }
          />
        </WithBorder>
      }
      onVisiblityChange={v => setPasteState(s => ({ ...s, visible: v }))}
    ></AnimatePopover>
  )
})
