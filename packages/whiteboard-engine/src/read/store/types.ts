import type { ReadModel } from '@engine-types/read'
import type { EngineReadIndex } from '@engine-types/instance'

export type ReadSnapshot = {
  model: ReadModel
  index: EngineReadIndex
}
