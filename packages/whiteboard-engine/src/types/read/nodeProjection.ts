import type { NodesView } from '../../instance/read'

export type NodeReadProjection = {
  getView: () => NodesView
}
