import { IWhiteboardInstance, IWhiteboardMindmap, IWhiteboardNode, IWhiteboardOutline } from '~/typings'
import { assignProperties } from '@/utils'
import { MetaStore } from '@/api/stores'
import { Node } from 'slate'

const transformCommonNodeToOutline = (
  instance: IWhiteboardInstance,
  nodeId: number,
  mindmapChildValid = false
): IWhiteboardOutline | undefined => {
  const node = instance.getNode?.(nodeId)
  if (!node) return
  if (node.rootId && !mindmapChildValid) return
  const metaMap = MetaStore.getMetaObjectsMap()
  switch (node.type) {
    case 'metaObject': {
      if (node.metaObjectId) {
        const object = metaMap.get(node.metaObjectId)
        if (object) {
          return {
            name: object.name || (object.type.includes('Label') ? object.placeholderName : ''),
            icon: Global.utils.getIcon(object.type),
            nodeId: node.id,
            type: object.type
          }
        }
      }
      break
    }
    case 'mindmap': {
      return transformMindmapToOutline(instance, node)
    }
    case 'text': {
      const name = Node.string({ children: node.content })
      if (name) {
        return {
          name,
          nodeId: node.id,
          icon: 'park-text',
          type: 'whiteboard text'
        }
      }
      break
    }
  }
}
const transformMindmapToOutline = (instance: IWhiteboardInstance, node: IWhiteboardNode & { type: 'mindmap' }): IWhiteboardOutline => {
  let name = ''
  const icon = 'park-mindmap-map'
  const metaMap = MetaStore.getMetaObjectsMap()
  let children: Required<IWhiteboardOutline>['children'] = []
  if (node.nodeType === 'text') {
    name = Node.string({ children: node.content })
  }
  if (node.nodeType === 'metaObject') {
    const object = metaMap.get(node.metaObjectId)
    if (object) {
      name = object.name || (object.type.includes('Label') ? object.placeholderName : '')
    }
  }
  const parseChildren = (children: IWhiteboardMindmap[]): IWhiteboardOutline[] => {
    return children
      .map(c => {
        const childNodeId = c.root
        const parsed = transformCommonNodeToOutline(instance, childNodeId, true)
        if (parsed) {
          return {
            ...parsed,
            children: parseChildren(c.children)
          }
        }
      })
      .filter(i => i) as IWhiteboardOutline[]
  }
  if (node.rightChildren?.length) {
    children = [...children, ...parseChildren(node.rightChildren)]
  }
  if (node.leftChildren?.length) {
    children = [...children, ...parseChildren(node.leftChildren)]
  }
  return {
    name,
    icon,
    children,
    nodeId: node.id,
    type: 'whiteboard mindmap'
  }
}

export default function assignContentOps(instance: IWhiteboardInstance) {
  const groupType = 'whiteboard group'
  assignProperties(instance, {
    contentOps: {
      transformToOutline: () => {
        const allNodes = instance.getAllNode?.()
        if (!allNodes) throw 'Failed to get nodes!'
        const inGroupNodeIds = new Set<number>()
        const groupToNodesMap = new Map<number, IWhiteboardNode[]>()
        const outlineArray: IWhiteboardOutline[] = []

        allNodes.forEach(i => {
          if (i.type === 'group') {
            const inGroupNodes = instance.groupOps?.getNodesInGroup(i.id) || []
            groupToNodesMap.set(i.id, inGroupNodes)
            inGroupNodes.forEach(n => inGroupNodeIds.add(n.id))
          }
        })
        const notInGroupNodes: IWhiteboardNode[] = allNodes.filter(
          i => !inGroupNodeIds.has(i.id) && i.type !== 'group'
        ) as IWhiteboardNode[]

        const transformGroupToOutline = (groupId: number): IWhiteboardOutline | undefined => {
          const inGroupNodes = groupToNodesMap.get(groupId)
          groupToNodesMap.delete(groupId)
          const group = instance.getNode?.(groupId)
          if (!group) return
          if (inGroupNodes?.length) {
            const children = inGroupNodes
              .map(i => {
                if (i.type === 'group') {
                  // delete here
                  const result = transformGroupToOutline(i.id)
                  groupToNodesMap.delete(i.id)
                  return result
                }
                return transformCommonNodeToOutline(instance, i.id)
              })
              .filter(i => i) as IWhiteboardOutline[]
            children.sort(a => (a.children ? -1 : 1))
            return {
              nodeId: groupId,
              name: group.name,
              children,
              type: groupType
            }
          }
        }
        // first transform groups here
        groupToNodesMap.forEach((nodes, groupNode) => {
          const res = transformGroupToOutline(groupNode)
          if (res) {
            outlineArray.push(res)
          }
        })
        notInGroupNodes.forEach(n => {
          const res = transformCommonNodeToOutline(instance, n.id)
          if (res) {
            outlineArray.push(res)
          }
        })
        const record: Record<string, IWhiteboardOutline[]> = {}
        outlineArray.forEach(a => {
          record[a.type] = [...(record[a.type] || []), a]
        })
        return record
      }
    }
  })
}
