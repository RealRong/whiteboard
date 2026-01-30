import { atom, useAtomValue } from 'jotai'
import { IWhiteboardEdge, IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import useUpdateWhiteboard from '@/core/components/whiteboard/hooks/useUpdateWhiteboard'
import { assignProperties } from '@/utils'
import { WhiteboardAtom } from '@/core/components/whiteboard/StateHooks'
import Id from '@/utils/id'
import assignLayoutOps from '@/core/components/whiteboard/hooks/ops/layout'
import assignNodeOps from '@/core/components/whiteboard/hooks/ops/node'
import assignCoordOps from '@/core/components/whiteboard/hooks/ops/coord'
import assignContainerOps from '@/core/components/whiteboard/hooks/ops/container'
import assignGroupOps from '@/core/components/whiteboard/hooks/ops/group'
import useWhiteboardHighlight from '@/core/components/whiteboard/hooks/useWhiteboardHighlight'
import assignContentOps from '@/core/components/whiteboard/hooks/ops/content'
import { getSetting } from '@/core'
import { MetaStore } from '@/api/stores'
import assignMindmapOps from '@/core/components/whiteboard/hooks/ops/mindmap'
import { IWhiteboardState } from '@/core/components/whiteboard/hooks/useWhiteboardState'

export const WhiteboardInstanceAtom = atom<
  IWhiteboardInstance & {
    getState: () => IWhiteboardState
  }
>({})

export const useWhiteboardInstance = () => useAtomValue(WhiteboardInstanceAtom)

export const useAssignWhiteboardInstance = () => {
  const instance = useWhiteboardInstance()
  const updateWhiteboard = useUpdateWhiteboard(instance)
  const store = instance.values.store
  assignProperties(instance, {
    moveToMetaNode: (metaId, opts) => {
      const nodes = instance.getAllNode?.()
      if (nodes) {
        const target = nodes.find(i => i.type === 'metaObject' && i.metaObjectId === metaId)
        if (target) {
          instance.containerOps?.fitToNode(target.id)
          if (opts?.select) {
            instance.selectOps?.selectNode(target.id)
          }
        }
      }
    },
    getNode: id => {
      const n = store.get(WhiteboardAtom)?.nodes?.get(id)
      if (!n) {
        if (import.meta.env.DEV) {
          throw new Error('Can not find whiteboard node with id: ' + id)
        }
      }
      return n
    },
    deleteNode: id => {
      const origin = instance.getNode?.(id)
      if (origin) {
        const whiteboardId = store.get(WhiteboardAtom)?.id
        if (origin.type === 'metaObject' && whiteboardId) {
          const whiteboardMeta = MetaStore.getMetaObjectByObjectId(whiteboardId)
          if (whiteboardMeta) {
            const link = MetaStore.getMetaLinkBySourceAndTarget(origin.metaObjectId, whiteboardMeta.id)
            if (link) {
              MetaStore.deleteMetaLink(link, true)
            }
          }
        }
      }
      instance.updateWhiteboard(w => {
        w.nodes?.delete(id)
        instance.values.NODE_TO_EDGE_MAP.get(id)?.forEach(l => {
          w.edges?.delete(l)
        })
      }, true)
    },
    deleteEdge: id => {
      const setting = getSetting()
      if (setting.whiteboard.enableAddLinkBetweenObjectsWhenConnect) {
        const e = instance.getEdge?.(id)
        if (e) {
          const sourceNode = instance.getNode?.(e.sourceId)
          const targetNode = instance.getNode?.(e.targetId)
          if (sourceNode?.type === 'metaObject' && targetNode?.type === 'metaObject') {
            const metaLink = MetaStore.getMetaLinkBySourceAndTarget(sourceNode.metaObjectId, targetNode.metaObjectId)
            if (metaLink) {
              MetaStore.deleteMetaLink(metaLink, true)
            }
          }
        }
      }
      instance.updateWhiteboard(w => {
        w.edges?.delete(id)
      }, true)
    },
    updateWhiteboard: updateWhiteboard,
    insertNode: async node => {
      const nodes = Array.isArray(node) ? node : [node]
      if (nodes.some(i => !i.type || i.x === undefined || i.y === undefined)) return Promise.reject()
      const newNodes = nodes.map(
        node =>
          ({
            ...node,
            id: node.id || Id.getId()
          }) as Required<IWhiteboardNode>
      )
      await instance.updateWhiteboard(w => {
        if (w.nodes) {
          const maxZ = Math.max(...Array.from(w.nodes.values()).map(i => i.z), 0)
          newNodes.forEach((n, idx) => {
            const targetZ = maxZ + idx
            w.nodes?.set(n.id, { ...n, z: targetZ + 1 })
            n.z = targetZ
          })
        }
      }, true)
      return newNodes
    },
    updateEdge: async (obj, updater, withUndo = true) => {
      let id: number | undefined = undefined
      if (typeof obj === 'number') {
        id = obj
      }
      if (typeof obj === 'object') {
        id = obj.id
      }
      if (!id) return
      await instance.updateWhiteboard(w => {
        const origin = w.edges?.get(id!)
        if (origin) {
          const newNode = (updater ? updater(origin) : typeof obj === 'object' ? { ...origin, ...obj } : undefined) as
            | IWhiteboardEdge
            | undefined
          if (newNode) {
            w.edges?.set(id!, newNode)
          }
        }
      }, withUndo)
    },
    updateNode: async (obj, updater, withUndo = true) => {
      let id: number | undefined = undefined
      if (typeof obj === 'number') {
        id = obj
      }
      if (typeof obj === 'object') {
        id = obj.id
      }
      if (!id) return
      await instance.updateWhiteboard(w => {
        const origin = w.nodes?.get(id!)
        if (origin) {
          const newNode = (updater ? updater(origin) : typeof obj === 'object' ? { ...origin, ...obj } : undefined) as
            | IWhiteboardNode
            | undefined
          if (newNode) {
            w.nodes?.set(id!, newNode)
          }
        }
      }, withUndo)
    },
    deleteNodes: ids => {
      instance.emit({ type: 'nodeDeleted', deleted: ids })
      instance.updateWhiteboard(w => {
        ids.forEach(i => {
          w.nodes?.delete(i)
          instance.values.NODE_TO_EDGE_MAP.get(i)?.forEach(l => {
            w.edges?.delete(l)
          })
        })
      }, true)
    }
  })
  assignLayoutOps(instance)
  assignNodeOps(instance)
  assignCoordOps(instance)
  useWhiteboardHighlight()
  assignContainerOps(instance)
  assignGroupOps(instance)
  assignMindmapOps(instance)
  assignContentOps(instance)
}
