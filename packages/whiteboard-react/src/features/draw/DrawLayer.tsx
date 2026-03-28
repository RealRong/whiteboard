import { DrawPreview } from './DrawPreview'
import {
  useEditor,
  useStoreValue
} from '../../runtime/hooks'

export const DrawLayer = () => {
  const editor = useEditor()
  const preview = useStoreValue(editor.host.draw.preview)

  return <DrawPreview preview={preview} />
}
