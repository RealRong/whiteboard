import type { Instance } from '@engine-types/instance'

type Options = {
  instance: Instance
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
