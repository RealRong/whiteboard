import type {
  NodesView,
  ViewportTransformView
} from '../instance/read'

export type NodeRead = {
  get: {
    viewportTransform: () => Readonly<ViewportTransformView>
    node: () => NodesView
  }
}
