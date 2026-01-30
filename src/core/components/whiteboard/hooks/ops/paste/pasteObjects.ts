import { IWhiteboardInstance, IWhiteboardNode, XYPosition } from '~/typings'
import Id from '@/utils/id'
import { MetaStore } from '@/api/stores'

export default async (instance: IWhiteboardInstance, position: XYPosition) => {
  const currentCopied = await Global.metaOps?.getCopiedMetaObjects()
  if (currentCopied?.length) {
    const coord = instance.coordOps?.transformWindowPositionToPosition({
      x: position.x,
      y: position.y
    })
    if (!coord) return
    const pasteElements = currentCopied.map(i => ({
      id: Id.getId(),
      type: 'metaObject',
      metaObjectId: i.id,
      width: 400,
      x: coord.x,
      y: coord.y
    })) as IWhiteboardNode[]
    instance.updateWhiteboard?.(w => {
      pasteElements.forEach(n => {
        w.nodes?.set(n.id, n)
      })
    }, true)
    const whiteboardId = instance.values.id
    if (whiteboardId) {
      const m = MetaStore.getMetaObjectByObjectId(whiteboardId)
      if (m) {
        currentCopied.forEach(meta => {
          MetaStore.addMetaLink({ sourceId: meta.id, targetId: m.id })
        })
      }
    }
  }
}
