import {
  useCallback,
  useEffect,
  useRef,
  type MutableRefObject
} from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import type { PointerSourceEvent } from './inputShared'

type PatchSessionMode = 'edge-drag' | 'edge-path'

type PatchSessionStartInput<Active> = {
  event: Pick<PointerSourceEvent, 'pointerId'>
  capture: Element | null
  active: Active
}

type PatchSessionUpdateResult = 'keep' | 'cancel'

export const useEdgePatchSession = <Active,>({
  mode,
  update,
  commit
}: {
  mode: PatchSessionMode
  update: (
    active: Active,
    input: {
      clientX: number
      clientY: number
    }
  ) => PatchSessionUpdateResult | void
  commit: (active: Active) => void
}): {
  activeRef: MutableRefObject<Active | null>
  start: (input: PatchSessionStartInput<Active>) => boolean
  cancel: () => void
} => {
  const instance = useInternalInstance()
  const activeRef = useRef<Active | null>(null)
  const sessionRef = useRef<ReturnType<typeof instance.interaction.start>>(null)

  const clear = useCallback(() => {
    activeRef.current = null
    sessionRef.current = null
    instance.internals.edge.preview.patch.clear()
  }, [instance])

  const cancel = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.cancel()
      return
    }
    clear()
  }, [clear])

  const runUpdate = useCallback((
    input: {
      clientX: number
      clientY: number
    }
  ) => {
    const active = activeRef.current
    if (!active) {
      return false
    }

    if (update(active, input) === 'cancel') {
      cancel()
      return false
    }

    return true
  }, [cancel, update])

  const start = useCallback((input: PatchSessionStartInput<Active>) => {
    const nextSession = instance.interaction.start({
      mode,
      pointerId: input.event.pointerId,
      capture: input.capture,
      pan: {
        frame: (pointer) => {
          runUpdate(pointer)
        }
      },
      cleanup: clear,
      move: (moveEvent, session) => {
        if (!runUpdate(moveEvent)) {
          return
        }

        session.pan(moveEvent)
      },
      up: (_upEvent, session) => {
        const active = activeRef.current
        if (!active) {
          return
        }

        commit(active)
        session.finish()
      }
    })
    if (!nextSession) {
      return false
    }

    activeRef.current = input.active
    sessionRef.current = nextSession
    return true
  }, [clear, commit, instance, mode, runUpdate])

  useEffect(() => () => {
    cancel()
  }, [cancel])

  return {
    activeRef,
    start,
    cancel
  }
}
