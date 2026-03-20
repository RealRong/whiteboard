import { useInternalInstance, useStoreValue } from '../../runtime/hooks'
import { DrawStrokeShape } from './stroke'

export const DrawPreview = () => {
  const instance = useInternalInstance()
  const preview = useStoreValue(instance.internals.draw.preview)

  if (!preview || preview.points.length === 0) {
    return null
  }

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-draw-preview-layer"
      aria-hidden="true"
    >
      <DrawStrokeShape
        points={preview.points}
        color={preview.style.color}
        width={preview.style.width}
        opacity={preview.style.opacity}
      />
    </svg>
  )
}
