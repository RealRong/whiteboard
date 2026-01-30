import { RefObject, useLayoutEffect } from 'react'
import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import getNodeSize from '@/core/components/whiteboard/node/getNodeSize'

export const DEFAULT_NODE_WIDTH = 280
export const DEFAULT_NODE_PADDING = 40
// have a queue here to handle large mindmap initialization.
// other wise will process nodes one by one, really slow for mindmap with 2000+ child nodes
let UpdateQueue: Record<
  number,
  {
    observe: VoidFunction
    node: {
      height: number
      width: number
      id: number
    }
  }[]
> = {}
const handleQueues = (instance: IWhiteboardInstance) => {
  const values = Object.values(UpdateQueue)
  UpdateQueue = {}
  values.forEach(v => {
    if (!v.length) return
    const copied = v.slice()
    const needUpdateNodes = copied.map(i => i.node)
    instance.updateWhiteboard?.(w => {
      needUpdateNodes.forEach(n => {
        const origin = w.nodes?.get(n.id)
        if (origin) {
          w.nodes?.set(origin.id, { ...origin, ...n })
        }
      })
    })
    setTimeout(() => {
      copied.forEach(f => {
        f.observe()
      })
    })
  })
}
const useNodeSize = (containerRef: RefObject<HTMLElement | null>, node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (container) {
      if (!node.width) {
        const bounding = container.getBoundingClientRect()
        const transform = instance.getTransform?.()
        if (transform) {
          const w = Math.max(DEFAULT_NODE_WIDTH, bounding.width / transform.scale + DEFAULT_NODE_PADDING)
          const width = node.expanded ? 520 : Math.min(w, 500)
          const defaultAutoWidth = getNodeSize(node, false).width === 'auto'
          if (!defaultAutoWidth) {
            container.style.width = `${width}px`
          }
          const id = instance.values.id
          if (!id) return
          const arr = UpdateQueue[id] || []
          if (!arr.length) {
            Promise.resolve().then(() => {
              handleQueues(instance)
            })
          }
          arr.push({
            observe: () => {
              instance.nodeOps?.observe?.(container)
            },
            node: {
              id: node.id,
              width,
              height: bounding.height / transform.scale
            }
          })
          UpdateQueue[id] = arr
        }
      } else {
        instance.nodeOps?.observe?.(container)
      }
      return () => {
        instance.nodeOps?.unobserve?.(container)
      }
    }
  }, [containerRef.current])
}

export default useNodeSize
