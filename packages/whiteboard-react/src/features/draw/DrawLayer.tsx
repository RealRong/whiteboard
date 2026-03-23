import { DrawPreview } from './DrawPreview'
import type { DrawPreview as DrawPreviewValue } from './state'

export const DrawLayer = ({
  preview
}: {
  preview: DrawPreviewValue | null
}) => {
  return <DrawPreview preview={preview} />
}
