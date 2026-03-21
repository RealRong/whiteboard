import { useState, type RefObject } from 'react'
import { DrawPreview } from './DrawPreview'
import type { DrawPreview as DrawPreviewValue } from './state'
import { useBindDrawInput } from './useBindDrawInput'

export const DrawLayer = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const [preview, setPreview] = useState<DrawPreviewValue | null>(null)

  useBindDrawInput({
    containerRef,
    setPreview
  })

  return <DrawPreview preview={preview} />
}
