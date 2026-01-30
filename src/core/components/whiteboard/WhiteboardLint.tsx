import { useSelectWhiteboardState, useSetWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { Icon, WithBorder } from '@/components'
import { useTranslation } from 'react-i18next'
import { Colors, Icons } from '@/consts'
import { memo } from 'react'

export default memo(() => {
  const highlight = useSelectWhiteboardState(s => s.highlightedIds)
  const { t } = useTranslation()
  const set = useSetWhiteboardState()
  if (highlight) {
    return (
      <div
        onClick={() => {
          set(s => ({ ...s, highlightedIds: undefined }))
        }}
        className={
          'absolute border font-size-13 z-20 !rounded-xl transparent-font top-4 left-1/2 -translate-x-1/2 button flex items-center gap-3'
        }
      >
        {t('whiteboard.Esc highlight mode')}
      </div>
    )
  }

  return null
})
