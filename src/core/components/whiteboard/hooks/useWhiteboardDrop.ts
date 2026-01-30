import { useMemoizedFn } from '@/hooks'
import { MetaStore, ObjectStore } from '@/api/stores'
import Id from '@/utils/id'
import { useEffect } from 'react'
import { IWhiteboardNode } from '~/typings/data'
import { isPointerOnContainer } from '../utils'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { pushNumberIntoUnrepeatableArray, waitFor } from '@/utils'
import toast from 'react-hot-toast'
import { IGlobalEvents } from '~/typings'
import trans from '@/consts/trans'
import { t } from 'i18next'

const useWhiteboardDrop = (whiteboardId: number) => {
  const whiteboardMeta = MetaStore.useObjectToMetaValue(whiteboardId)
  const instance = useWhiteboardInstance()
  const handleGlobalDragEnd = async (data: IGlobalEvents['dragEnd']) => {
    const { event } = data
    if (event instanceof DragEvent) {
      dropHandler(event)
      return
    }
    const draggingElement = Global.values.draggingDetails
    if (!draggingElement) return
    if (instance.getOutestContainerNode?.()?.contains(event.target)) {
      event.preventDefault()
      if (draggingElement.type === 'noteBlock') {
        insertNodeAtPointer(event, {
          type: 'text',
          content: draggingElement.elements.map(i => ({ ...i, id: Id.getId() })),
          id: Id.getId()
        })
        return
      }
      Global.metaOps.addDraggableAsMeta(draggingElement).then(m => {
        const ids = m.map(i => i.id)
        instance.emit?.({
          type: 'drop',
          itemType: 'object',
          metaId: ids
        })
        insertMetasAtPointer(event, ids)
        if (whiteboardMeta) {
          ids.forEach(id => {
            MetaStore.addMetaLink({ sourceId: id, targetId: whiteboardMeta.id })
          })
        }
      })
    }
  }
  const dropHandler = useMemoizedFn(async (e: DragEvent) => {
    if (!isPointerOnContainer(e, instance)) return
    e.preventDefault()
    const { clientX, clientY } = e
    const transformedXY = instance.coordOps?.transformWindowPositionToPosition({ x: clientX, y: clientY })
    if (!transformedXY) return
    const normalized = await Global.utils.normalizeDragEvent(e)
    if (normalized) {
      switch (normalized.type) {
        case 'files': {
          const convertedWhiteboardNodes = (await Promise.all(
            normalized.files
              .map(async file => {
                try {
                  const result = await Global.utils.normalizeFile(file)
                  if (result.meta) {
                    const m = (
                      await ObjectStore(result.meta.type).addOneWithMeta(
                        { ...result.object },
                        { currentMeta: { ...result.meta }, silent: true }
                      )
                    ).meta
                    return {
                      type: 'metaObject',
                      metaObjectId: m.id
                    } as IWhiteboardNode
                  }
                } catch (e) {
                  toast.error(t(trans.Errors.NotSupportedFile))
                }
              })
              .filter(Boolean)
          )) as IWhiteboardNode[]
          instance.insertNode?.(convertedWhiteboardNodes.map(i => ({ ...i, id: Id.getId(), x: transformedXY.x, y: transformedXY.y })))
          break
        }
        case 'images': {
          instance.insertNode?.(
            normalized.imgs.map(i => ({
              type: 'image',
              name: i.name,
              imageUrl: i.path,
              id: Id.getId(),
              x: transformedXY.x,
              y: transformedXY.y
            }))
          )
          break
        }
        case 'link': {
          instance.insertNode?.({
            type: 'text',
            content: [
              {
                type: 'paragraph',
                children: [{ children: [{ text: normalized.url }], url: normalized.url, type: 'link', id: Id.getId() }],
                id: Id.getId()
              }
            ]
          })
          break
        }
        case 'text': {
          instance.insertNode?.({
            type: 'text',
            content: [
              {
                type: 'paragraph',
                children: [{ text: normalized.text }],
                id: Id.getId()
              }
            ]
          })
          break
        }
      }
    }
  })
  const insertNodeAtPointer = (e: PointerEvent, node: Partial<IWhiteboardNode>) => {
    const transformed = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (transformed) {
      instance.insertNode?.({
        x: transformed.x,
        y: transformed.y,
        ...node
      })
    }
  }
  const insertMetasAtPointer = (e: PointerEvent, metaId: number[]) => {
    const transformedXY = instance.coordOps?.transformWindowPositionToPosition({
      x: e.clientX,
      y: e.clientY
    })
    if (!transformedXY) return
    const metaMap = MetaStore.getMetaObjectsMap()
    const whiteboardMeta = instance.values.id ? MetaStore.getMetaObjectByObjectId(instance.values.id) : undefined
    if (!whiteboardMeta) return
    const nodes: Partial<IWhiteboardNode>[] = []
    metaId.forEach(id => {
      MetaStore.addMetaLink({
        sourceId: id,
        targetId: whiteboardMeta.id
      })
      const m = metaMap.get(id)
      if (m?.type === 'syncedBlock' && whiteboardMeta) {
        if (m.objectId) {
          ObjectStore('syncedBlock')
            .getOneById(m.objectId)
            .then(o => {
              if (o) {
                ObjectStore('syncedBlock').updateOne({
                  id: m.objectId,
                  syncedMetaIds: pushNumberIntoUnrepeatableArray(whiteboardMeta.id, o.syncedMetaIds)
                })
              }
            })
        }
      }
      nodes.push({
        x: transformedXY.x,
        y: transformedXY.y,
        metaObjectId: id,
        type: 'metaObject',
        name: '',
        expanded: false
      })
    })

    if (transformedXY) {
      instance.insertNode?.(nodes).then(nodes => {
        waitFor(
          () => {
            const ids = new Set(nodes.map(i => i.id))
            const allNodes = instance.getAllNode?.().filter(i => ids.has(i.id))
            if (allNodes && allNodes?.every(i => i.width !== undefined && i.height !== undefined)) {
              return true
            }
            return false
          },
          () => {
            const ids = new Set(nodes.map(i => i.id))
            const allNodes = instance.getAllNode?.().filter(i => ids.has(i.id)) as IWhiteboardNode[]
            instance.layoutOps?.packNodes(allNodes)
          }
        )
      })
    }
  }
  instance.insertMetasAtPointer = insertMetasAtPointer
  useEffect(() => {
    Global.addEventListener('dragEnd', handleGlobalDragEnd)
    return () => {
      Global.removeEventListener('dragEnd', handleGlobalDragEnd)
    }
  })
}
export default useWhiteboardDrop
