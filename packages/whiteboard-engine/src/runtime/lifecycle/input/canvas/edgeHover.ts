import type { InternalInstance } from '@engine-types/instance/instance'

type Options = {
  instance: InternalInstance
  enabled: boolean
}

export const createEdgeHover = ({ instance, enabled }: Options) => {
  const edgeHover = instance.runtime.services.edgeHover

  const cancel = () => {
    edgeHover.cancel()
  }

  const onPointerMove = (event: PointerEvent) => {
    edgeHover.onPointerMove({ clientX: event.clientX, clientY: event.clientY, enabled })
  }

  return {
    onPointerMove,
    cancel
  }
}
