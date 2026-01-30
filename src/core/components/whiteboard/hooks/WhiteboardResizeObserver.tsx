import { assignProperties, trimNumber } from '@/utils'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks/useWhiteboardInstance'
import { memo, useRef, useState } from 'react'

export default memo(() => {
  const instance = useWhiteboardInstance()
  const canObserve = useRef(false)
  const resizeObserver = useState(
    new ResizeObserver(entries => {
      if (!canObserve.current) return
      const batchNewSize: { id: number; width?: number; height?: number }[] = []
      const nodeSizeChange: { id: number; width?: number; height?: number }[] = []
      for (const entry of entries) {
        const target = entry.target
        const nodeId = Number(target.getAttribute('data-node-id'))
        const node = instance.getNode?.(nodeId)
        if (node) {
          const box = {
            width: entry.borderBoxSize[0].inlineSize,
            height: entry.borderBoxSize[0].blockSize
          }
          const newSize = {
            width: trimNumber(box.width),
            height: trimNumber(box.height)
          }
          if (newSize.width === 0 && newSize.height === 0) return
          instance.nodeOps?.updateRelatedEdges(nodeId)
          if (newSize.width !== node.width || newSize.height !== node.height) {
            nodeSizeChange.push({ ...newSize, id: nodeId })
            if (!instance.nodeOps?.getNodeFuncs(nodeId)?.sizeAlreadyDefined()) {
              batchNewSize.push({ ...newSize, id: nodeId })
            }
          }
        }
      }
      if (nodeSizeChange.length) {
        const sizeChanged = nodeSizeChange.map(i => ({ ...instance.getNode?.(i.id), ...i }))
        console.log(sizeChanged)
        instance.emit?.({
          type: 'nodeSizeChange',
          changed: sizeChanged
        })
      }
      if (batchNewSize.length) {
        setTimeout(() => {
          instance.updateWhiteboard?.(w => {
            batchNewSize.forEach(s => {
              const o = w.nodes?.get(s.id)
              if (o) {
                const newNode = { ...o, ...s }
                w.nodes?.set(s.id, newNode)
              }
            })
          }, false)
        })
      }
    })
  )[0]
  assignProperties(instance, {
    startResizeObserving: () => {
      canObserve.current = true
    },
    nodeOps: {
      ...instance.nodeOps,
      observe: element => resizeObserver.observe(element),
      unobserve: element => resizeObserver.unobserve(element)
    }
  })

  return null
})
