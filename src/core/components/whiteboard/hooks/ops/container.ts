import { Box, IWhiteboardInstance } from '~/typings'
import { assignProperties, boxContain, boxesIntersect } from '@/utils'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'

const assignContainerOps = (instance: IWhiteboardInstance) => {
  assignProperties(instance, {
    containerOps: {
      ...instance.containerOps,
      fitToNode: (nodeId, opts) => {
        const n = instance.getNode?.(nodeId)
        if (n) {
          instance.containerOps?.fitTo?.(
            {
              left: n.x,
              top: n.y,
              width: n.width ?? 0,
              height: n.height ?? 0
            },
            opts
          )
        }
      },
      getViewBox: () => {
        const transform = instance.getTransform?.()
        if (!transform) throw 'Failed to find container node!'
        const containerBounding = instance.getOutestContainerNode?.()?.getBoundingClientRect()
        if (!containerBounding) throw 'Failed to find container node!'
        const inViewBox: Box = {
          left: -transform.x / transform.scale,
          top: -transform.y / transform.scale,
          width: containerBounding.width / transform.scale,
          height: containerBounding.height / transform.scale
        }
        return inViewBox
      },
      getInViewNodes: fullyInView => {
        const inViewBox = instance.containerOps?.getViewBox()
        if (!inViewBox) throw 'Failed to get view box!'
        const allNodes = instance.getAllNode?.()
        if (!allNodes) throw 'Failed to get nodes'
        return allNodes?.filter(i => {
          const nodeBox = {
            left: i.x,
            top: i.y,
            width: i.width,
            height: i.height
          }
          if (fullyInView) {
            return boxContain(inViewBox, nodeBox)
          }
          return boxesIntersect(inViewBox, nodeBox)
        })
      },
      // placeholder here, real in whiteboard panzoom
      setTransform: (t, skipAnimation) => {
        instance.panzoom?.setTransform(t, undefined, skipAnimation)
      },
      moveBy: (x, y) => {
        instance.panzoom?.moveBy(x, y, false)
      },
      fitTo: (box, opts) => {
        const container = instance.getContainerNode?.().parentElement
        if (container) {
          const bounding = container.getBoundingClientRect()
          const padding = Math.min(bounding.height, bounding.width) * 0.18
          const widthRatio = (bounding.width - padding) / box.width
          const heightRatio = (bounding.height - padding) / box.height
          const ratio = Math.min(widthRatio, heightRatio)
          const boxTop = box.top + box.height / 2
          const boxCenterHori = box.left + box.width / 2
          const currentTransform = instance.getTransform?.()
          if (currentTransform) {
            if (ratio && currentTransform) {
              const s = opts?.changeScale === false ? currentTransform.scale : Math.min(ratio, opts?.maxScale || 0.8)
              const pos = {
                x: -boxCenterHori * s + (bounding.width / s / 2) * s,
                y: -boxTop * s + (bounding.height / s / 2) * s
              }
              instance.containerOps?.setTransform(
                {
                  x: pos.x,
                  y: pos.y,
                  scale: s
                },
                opts?.skipAnimation
              )
            }
          }
        }
      },
      fitToSelected: () => {
        const selected = instance.selectOps?.getSelectedNodes()
        console.log(selected)
        if (selected?.length) {
          const box = getBoxOfNodes(selected)
          box && instance.containerOps?.fitTo(box)
          console.log('get ere')
        }
      },
      zoomTo: () => {}
    }
  })
}

export default assignContainerOps
