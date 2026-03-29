import { DrawPreview } from './DrawPreview'
import {
  useEditorRuntime,
  useStoreValue
} from '../../runtime/hooks'

export const DrawLayer = () => {
  const editor = useEditorRuntime()
  const preview = useStoreValue(editor.projection.draw)

  return <DrawPreview preview={preview} />
}
