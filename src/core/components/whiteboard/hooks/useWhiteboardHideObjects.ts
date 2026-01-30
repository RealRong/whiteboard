import { useSelectAtomValue } from '@/hooks'
import { useWhiteboardNodes, WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import { useEffect, useRef } from 'react'
import { IWhiteboardNode } from '~/typings'
import { MetaStore } from '@/api/stores'
import queueTurnUnhidden from '@/api/stores/meta/queueTurnUnhidden'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'

export default () => {
  const hide = useSelectAtomValue(WhiteboardAtom, s => s?.hideObjects) ?? false
  const nodes = useWhiteboardNodes()
  const prevMetas = useRef<number[]>()
  const instance = useWhiteboardInstance()
  useEffect(() => {
    const metas = Array.from(nodes.values())
      .filter(i => i.type === 'metaObject')
      .map(i => (i as { type: 'metaObject' } & IWhiteboardNode).metaObjectId)
      .filter(i => i)
    const prev = prevMetas.current
    if (prev && hide) {
      // deleted
      if (prev.length > metas.length) {
        const currIds = new Set(metas)
        const deleted = prev.filter(i => !currIds.has(i))
        deleted.forEach(id => {
          const m = MetaStore.getCachedMetaObject(id)
          if (m && m.hidden) {
            queueTurnUnhidden({
              whiteboardId: instance.values.id,
              metaId: m.id,
              type: m.type === 'group' ? 'group' : 'object'
            })
          }
        })
      }
    }
    prevMetas.current = metas
    if (hide) {
      metas.forEach(i => {
        const m = MetaStore.getCachedMetaObject(i)
        if (m && !m.hidden) {
          MetaStore.updateMetaObject({ id: i, hidden: true })
        }
      })
    } else {
      metas.forEach(i => {
        const m = MetaStore.getCachedMetaObject(i)
        if (m && m.hidden) {
          queueTurnUnhidden({
            whiteboardId: instance.values.id,
            metaId: m.id,
            type: m.type === 'group' ? 'group' : 'object'
          })
        }
      })
    }
  }, [hide, nodes.size])
}
