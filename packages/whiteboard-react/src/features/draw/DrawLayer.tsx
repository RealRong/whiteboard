import { DrawPreview } from './DrawPreview'
import { useBoardRuntime } from '../../board'
import { useStoreValue } from '../../shared/hooks/useStoreValue'

export const DrawLayer = () => {
  const editor = useBoardRuntime()
  const preview = useStoreValue(editor.read.feedback.draw)

  return <DrawPreview preview={preview} />
}
