import type {
  NodesView,
  ViewportTransformView
} from '../instance/read'

export type NodeReadRuntime = {
  get: {
    viewportTransform: () => Readonly<ViewportTransformView>
    node: () => NodesView
  }
}
