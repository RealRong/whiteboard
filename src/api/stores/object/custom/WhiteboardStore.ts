import { IWhiteboardEdge, IWhiteboardNode } from '~/typings'
import createObjectStore from '@/api/stores/object/object.store'
import { slateToMarkdown } from '@/core/components/editor/plugins/slateToMarkdown'
import { MetaStore } from '@/api/stores'

export default () => {
  return createObjectStore('whiteboard', {
    onSearch: async o => {
      const nodes = o.nodes instanceof Map ? Array.from(o.nodes.values()) : (o.nodes as IWhiteboardNode[])
      const texts = nodes
        .filter(i => i.type === 'text' || (i.type === 'mindmap' && i.nodeType === 'text'))
        .map(i => slateToMarkdown((i as IWhiteboardNode & { type: 'text' }).content))
        .join(' ')
      const names = nodes
        .filter(i => i.type === 'metaObject')
        .map(i => (i as IWhiteboardNode & { type: 'metaObject' }).metaObjectId)
        .map(i => MetaStore.getCachedMetaObject(i)?.name)
        .filter(i => i)
        .join(' ')
      return names + texts
    },
    afterUpdateProcess: {
      triggerSearch: true
    },
    transformData: whiteboard => {
      return {
        ...whiteboard,
        edges: Array.isArray(whiteboard.edges)
          ? new Map((whiteboard.edges as unknown as IWhiteboardEdge[])?.map(e => [e.id, e]))
          : whiteboard.edges instanceof Map
            ? whiteboard.edges
            : new Map(),
        nodes: Array.isArray(whiteboard.nodes)
          ? new Map((whiteboard.nodes as unknown as IWhiteboardNode[])?.map(e => [e.id, e]))
          : whiteboard.nodes instanceof Map
            ? whiteboard.nodes
            : new Map()
      }
    }
  })
}
