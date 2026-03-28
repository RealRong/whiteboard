import { DrawPreview } from './DrawPreview'
import type { DrawPreview as DrawPreviewValue } from '@whiteboard/editor'

export const DrawLayer = ({
  preview
}: {
  preview: DrawPreviewValue | null
}) => {
  return <DrawPreview preview={preview} />
}
