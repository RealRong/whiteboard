import { DrawPreview } from './DrawPreview'
import {
  useInternalInstance,
  useStoreValue
} from '../../runtime/hooks'

export const DrawLayer = () => {
  const instance = useInternalInstance()
  const preview = useStoreValue(instance.host.draw.preview)

  return <DrawPreview preview={preview} />
}
