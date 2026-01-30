import { IWhiteboardInstance } from '~/typings'
import { assignProperties } from '@/utils'
import { transformXY } from '@/core/components/whiteboard/utils'

const assignCoordOps = (instance: IWhiteboardInstance) => {
  assignProperties(instance, {
    coordOps: {
      transformWhiteboardRectToWindowRect: rect => {
        const container = instance.getContainerNode?.()
        const transform = instance.getTransform?.()
        if (container && transform) {
          const bounding = container.getBoundingClientRect()
          return {
            left: rect.left * transform.scale + bounding.x,
            top: rect.top * transform.scale + bounding.y,
            width: rect.width * transform.scale,
            height: rect.height * transform.scale
          }
        } else {
          throw new Error('Failed to transform coordinate!')
        }
      },
      transformWhiteboardPositionToWindowPosition: e => {
        const container = instance.getContainerNode?.()
        const transform = instance.getTransform?.()
        if (container && transform) {
          const bounding = container.getBoundingClientRect()
          return {
            x: e.x * transform.scale + bounding.x,
            y: e.y * transform.scale + bounding.y
          }
        } else {
          throw new Error('Failed to transform coordinate!')
        }
      },
      transformWindowPositionToPosition: e => {
        const container = instance.getContainerNode?.()
        const transform = instance.getTransform?.()
        if (container && transform) {
          return transformXY(container.getBoundingClientRect(), e.x, e.y, transform.scale)
        } else {
          throw new Error('Failed to transform coordinate!')
        }
      }
    }
  })
}

export default assignCoordOps
