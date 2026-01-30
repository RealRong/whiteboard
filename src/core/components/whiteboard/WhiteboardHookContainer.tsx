import useWhiteboardAutoPan from '@/core/components/whiteboard/hooks/useWhiteboardAutoPan'
import useWhiteboardDrop from '@/core/components/whiteboard/hooks/useWhiteboardDrop'
import useWhiteboardErase from '@/core/components/whiteboard/hooks/useWhiteboardErase'
import useWhiteboardShortcut from '@/core/components/whiteboard/hooks/useWhiteboardShortcut'
import useWhiteboardHistory from '@/core/components/whiteboard/hooks/useWhiteboardHistory'
import { useAssignWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import useWhiteboardQuickActions from '@/core/components/whiteboard/hooks/keyboard/useWhiteboardQuickActions'
import { useUpdate } from 'react-use'
import { useEffect } from 'react'
import useGroupInnerSizeChangeProcessor from '@/core/components/whiteboard/hooks/processors/useGroupInnerSizeChangeProcessor'

export default ({ whiteboardId }: { whiteboardId: number }) => {
  const update = useUpdate()
  useWhiteboardAutoPan()
  useWhiteboardDrop(whiteboardId)
  useWhiteboardErase()
  useWhiteboardShortcut()
  useWhiteboardHistory()
  useAssignWhiteboardInstance()
  useWhiteboardQuickActions()
  useGroupInnerSizeChangeProcessor()
  useEffect(() => {
    // trigger update here for some hooks to get container
    update()
  }, [])

  return null
}
