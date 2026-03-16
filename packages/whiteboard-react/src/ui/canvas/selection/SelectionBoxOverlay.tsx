import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'

export const SelectionBoxOverlay = () => {
  const instance = useInternalInstance()
  const selectionBox = useStoreValue(instance.internals.selectionBox)

  if (!selectionBox) return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${selectionBox.x}px, ${selectionBox.y}px)`,
        width: selectionBox.width,
        height: selectionBox.height
      }}
    />
  )
}
