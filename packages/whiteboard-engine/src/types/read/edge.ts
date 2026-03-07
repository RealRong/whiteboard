import type {
  EdgesView
} from '../instance/read'
import type { EdgeChange } from './change'

export type EdgeReadCache = {
  applyChange: (change: EdgeChange) => void
  getView: () => EdgesView
}
