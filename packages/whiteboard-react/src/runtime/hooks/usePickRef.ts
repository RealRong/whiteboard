import { useCallback, useEffect, useRef } from 'react'
import type { Pick } from '../pick'
import { toPickKey } from '../pick'
import { useInternalInstance } from './useWhiteboard'

export const usePickRef = (
  pick: Pick
) => {
  const instance = useInternalInstance()
  const elementRef = useRef<Element | null>(null)
  const releaseRef = useRef<(() => void) | null>(null)
  const key = toPickKey(pick)

  const bind = useCallback((element: Element | null) => {
    if (elementRef.current === element) {
      return
    }

    releaseRef.current?.()
    releaseRef.current = null
    elementRef.current = element

    if (element) {
      releaseRef.current = instance.internals.pick.bind(element, pick)
    }
  }, [instance, key])

  useEffect(() => {
    const element = elementRef.current
    if (!element) {
      return
    }

    releaseRef.current?.()
    releaseRef.current = instance.internals.pick.bind(element, pick)

    return () => {
      releaseRef.current?.()
      releaseRef.current = null
    }
  }, [instance, key])

  return bind
}
