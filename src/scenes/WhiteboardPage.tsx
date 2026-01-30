import TabTitle from '@/components/layout/TabTitle'
import { Whiteboard } from '@/core'
import { memo } from 'react'
import { IWhiteboardInstance } from '~/typings'
import { MetaStore } from '@/api/stores'

const WhiteboardPage = ({
  whiteboardId,
  onInstanceInitialized
}: {
  whiteboardId: number
  onInstanceInitialized?: (w: IWhiteboardInstance) => void
}) => {
  const whiteboardMeta = MetaStore.useObjectToMetaValue(whiteboardId)
  return (
    <>
      <TabTitle title={whiteboardMeta?.name} icon={Global.utils.getIcon('whiteboard')} />
      <Whiteboard
        name={whiteboardMeta?.name}
        onRename={s => {
          if (whiteboardMeta) {
            MetaStore.updateMetaObject({ id: whiteboardMeta.id, name: s })
          }
        }}
        whiteboardId={whiteboardId}
        layout={{ showRename: true }}
        onInstanceInitialized={onInstanceInitialized}
      />
    </>
  )
}

export default memo(WhiteboardPage)
