import type {
  Editor,
  EditorProjection
} from '../../public/editor'
import type { EditorProjectionGraph } from '../../internal/editor'
import type { PassiveInputProcessor } from '../../../runtime/input/passive'
import type { InteractionRegistration } from '../../../runtime/interaction/types'
import type { RuntimeRead } from '../../../runtime/read'

export type EditorFeatureCapsule = {
  key: string
  interactions?: readonly InteractionRegistration[]
  passive?: readonly PassiveInputProcessor[]
  read?: Partial<RuntimeRead>
  commands?: Partial<Editor['commands']>
  projections?: {
    model?: Partial<EditorProjectionGraph['model']>
    overlay?: Partial<EditorProjectionGraph['overlay']>
  }
  projection?: Partial<EditorProjection>
  lifecycle?: {
    reset?: () => void
    dispose?: () => void
  }
}
