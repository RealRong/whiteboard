import { useEffect, useMemo, type RefObject } from 'react'
import type {
  ShortcutAction,
  ShortcutBinding,
  ShortcutOverrides
} from '../types/common/shortcut'
import { useInternalInstance } from '../runtime/hooks'
import {
  isEditableTarget,
  isInputIgnoredTarget
} from '../runtime/input/target'
import { resolveNodeSelectionCan } from '../features/node/summary'

const ModifierOrder = ['Ctrl', 'Alt', 'Shift', 'Meta'] as const

const DEFAULT_SHORTCUT_BINDINGS: readonly ShortcutBinding[] = [
  { key: 'Mod+G', action: 'group.create' },
  { key: 'Shift+Mod+G', action: 'group.ungroup' },
  { key: 'Mod+A', action: 'selection.selectAll' },
  { key: 'Escape', action: 'selection.clear' },
  { key: 'Backspace', action: 'selection.delete' },
  { key: 'Delete', action: 'selection.delete' },
  { key: 'Mod+D', action: 'selection.duplicate' },
  { key: 'Mod+Z', action: 'history.undo' },
  { key: 'Shift+Mod+Z', action: 'history.redo' },
  { key: 'Mod+Y', action: 'history.redo' }
] as const

type Platform = 'mac' | 'win' | 'linux'

const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'win'
  const value = navigator.platform.toLowerCase()
  if (value.includes('mac')) return 'mac'
  if (value.includes('win')) return 'win'
  return 'linux'
}

const normalizeKey = (value: string) => {
  if (value === ' ') return 'Space'
  if (value.length === 1) return value.toUpperCase()
  return value
}

const normalizeBindingChord = (
  raw: string,
  platform: Platform
): string | undefined => {
  const tokens = raw
    .split('+')
    .map((token) => token.trim())
    .filter(Boolean)

  if (!tokens.length) return undefined

  let keyToken: string | undefined
  const modifiers = new Set<string>()

  tokens.forEach((token) => {
    const lowered = token.toLowerCase()
    if (lowered === 'mod') {
      modifiers.add(platform === 'mac' ? 'Meta' : 'Ctrl')
      return
    }
    if (lowered === 'ctrl' || lowered === 'control') {
      modifiers.add('Ctrl')
      return
    }
    if (lowered === 'meta' || lowered === 'cmd' || lowered === 'command') {
      modifiers.add('Meta')
      return
    }
    if (lowered === 'alt' || lowered === 'option') {
      modifiers.add('Alt')
      return
    }
    if (lowered === 'shift') {
      modifiers.add('Shift')
      return
    }
    keyToken = normalizeKey(token)
  })

  if (!keyToken) return undefined
  return [...ModifierOrder.filter((modifier) => modifiers.has(modifier)), keyToken].join('+')
}

const chordFromKeyboardEvent = (
  event: KeyboardEvent
): string | undefined => {
  const normalized = normalizeKey(event.key)
  if (
    normalized === 'Control'
    || normalized === 'Shift'
    || normalized === 'Alt'
    || normalized === 'Meta'
  ) {
    return undefined
  }

  const parts: string[] = []
  if (event.ctrlKey) parts.push('Ctrl')
  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')
  if (event.metaKey) parts.push('Meta')
  parts.push(normalized)
  return parts.join('+')
}

const createShortcutMap = (
  bindings: readonly { key: string; action: ShortcutAction }[],
  platform: Platform
) => {
  const map = new Map<string, ShortcutAction>()
  bindings.forEach((binding) => {
    const normalized = normalizeBindingChord(binding.key, platform)
    if (!normalized) return
    map.set(normalized, binding.action)
  })
  return map
}

const resolveShortcutBindings = (
  defaults: readonly ShortcutBinding[] = DEFAULT_SHORTCUT_BINDINGS,
  overrides?: ShortcutOverrides
): readonly ShortcutBinding[] => {
  if (!overrides) {
    return defaults
  }

  return typeof overrides === 'function'
    ? overrides(defaults)
    : overrides
}

const canDispatchShortcutAction = (
  instance: ReturnType<typeof useInternalInstance>,
  action: ShortcutAction
) => {
  const selection = instance.read.selection.get()
  const can = resolveNodeSelectionCan(selection.items.nodes)
  const pureNodeSelection = selection.items.edgeCount === 0
  const hasSelection = selection.items.count > 0

  switch (action) {
    case 'group.create':
      return pureNodeSelection && can.makeGroup
    case 'group.ungroup':
      return pureNodeSelection && can.ungroup
    case 'selection.selectAll':
      return true
    case 'selection.clear':
      return (
        hasSelection
        || instance.state.frame.get().id !== undefined
        || !instance.read.tool.is('select')
      )
    case 'selection.delete':
      return hasSelection
    case 'selection.duplicate':
      return pureNodeSelection && can.duplicate
    case 'history.undo':
    case 'history.redo':
      return true
    default:
      return false
  }
}

const dispatchShortcutAction = (
  instance: ReturnType<typeof useInternalInstance>,
  action: ShortcutAction
) => {
  if (!canDispatchShortcutAction(instance, action)) {
    return false
  }

  const selection = instance.read.selection.get()
  const pureNodeSelection = selection.items.edgeCount === 0

  switch (action) {
    case 'selection.selectAll':
      instance.commands.selection.selectAll()
      return true
    case 'selection.clear':
      if (!instance.read.tool.is('select')) {
        instance.commands.tool.select()
      }
      instance.commands.frame.exit()
      return true
    case 'selection.delete':
      if (!selection.target.nodeIds.length && !selection.target.edgeIds.length) {
        return false
      }

      if (selection.target.edgeIds.length > 0) {
        const result = instance.commands.edge.delete([...selection.target.edgeIds])
        if (!result.ok) {
          return false
        }
      }

      if (selection.target.nodeIds.length > 0) {
        const result = instance.commands.node.deleteCascade([...selection.target.nodeIds])
        if (!result.ok) {
          return false
        }
      }

      return true
    case 'selection.duplicate': {
      if (!pureNodeSelection) {
        return false
      }

      const result = instance.commands.node.duplicate([...selection.target.nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return false
      }
      instance.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'group.create': {
      if (!pureNodeSelection) {
        return false
      }

      const result = instance.commands.node.group.create([...selection.target.nodeIds])
      if (!result.ok) {
        return false
      }
      instance.commands.selection.replace({
        nodeIds: [result.data.groupId]
      })
      return true
    }
    case 'group.ungroup': {
      if (!pureNodeSelection) {
        return false
      }

      const groupIds = selection.target.nodeIds.filter((nodeId) =>
        selection.items.nodes.some((node) => node.id === nodeId && node.type === 'group')
      )
      const result = instance.commands.node.group.ungroupMany(groupIds)
      if (!result.ok) {
        return false
      }
      instance.commands.selection.replace({
        nodeIds: result.data.nodeIds
      })
      return true
    }
    case 'history.undo':
      return instance.commands.history.undo().ok
    case 'history.redo':
      return instance.commands.history.redo().ok
    default:
      return false
  }
}

export const useCanvasKeyboard = ({
  containerRef,
  shortcuts
}: {
  containerRef: RefObject<HTMLDivElement | null>
  shortcuts?: ShortcutOverrides
}) => {
  const instance = useInternalInstance()
  const platform = useMemo(() => detectPlatform(), [])
  const bindings = useMemo(
    () => resolveShortcutBindings(DEFAULT_SHORTCUT_BINDINGS, shortcuts),
    [shortcuts]
  )
  const shortcutMap = useMemo(
    () => createShortcutMap(bindings, platform),
    [bindings, platform]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const focusContainer = () => {
      if (document.activeElement === container) {
        return
      }
      container.focus({ preventScroll: true })
    }

    const onPointerDown = (event: PointerEvent) => {
      if (isEditableTarget(event.target) || isInputIgnoredTarget(event.target)) {
        return
      }
      focusContainer()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
      ) {
        return
      }

      if (instance.interaction.handleKeyDown(event)) {
        if (event.cancelable) {
          event.preventDefault()
        }
        event.stopPropagation()
        return
      }

      if (event.repeat) return

      const chord = chordFromKeyboardEvent(event)
      if (!chord) return

      const action = shortcutMap.get(chord)
      if (!action) return
      if (!dispatchShortcutAction(instance, action)) return

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented
        || isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
      ) {
        if (event.code === 'Space' && instance.interaction.space.get()) {
          instance.interaction.handleKeyUp(event)
        }
        return
      }

      if (!instance.interaction.handleKeyUp(event)) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    }

    const onBlur = () => {
      instance.interaction.handleBlur()
    }

    container.addEventListener('pointerdown', onPointerDown, true)
    container.addEventListener('keydown', onKeyDown)
    container.addEventListener('keyup', onKeyUp)
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', onBlur)
    }

    return () => {
      container.removeEventListener('pointerdown', onPointerDown, true)
      container.removeEventListener('keydown', onKeyDown)
      container.removeEventListener('keyup', onKeyUp)
      if (typeof window !== 'undefined') {
        window.removeEventListener('blur', onBlur)
      }
    }
  }, [containerRef, instance, shortcutMap])
}
