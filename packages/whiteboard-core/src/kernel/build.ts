import type { Document, Intent } from '../types'
import { createBuildOperations } from '../core/build'
import { createCoreRegistries } from '../core/registry'
import { createCoreState } from '../core/state'
import { createValidateIntent } from '../core/validate'
import { createCommandRegistry } from '../core/plugins'
import { applyKernelRegistries, cloneDocument, createKernelFailure } from './internal'
import type { KernelBuildResult, KernelContext } from './types'

export const buildIntent = (
  document: Document,
  intent: Intent,
  context: KernelContext = {}
): KernelBuildResult => {
  const state = createCoreState({
    document: cloneDocument(document),
    now: context.now
  })
  const { registry } = createCommandRegistry()
  const registries = createCoreRegistries(registry)
  applyKernelRegistries(registries, context.registries)

  const validateIntent = createValidateIntent(state, registries)
  const { buildOperations } = createBuildOperations({
    state,
    registries,
    validateIntent,
    createFailure: createKernelFailure
  })

  const buildResult = buildOperations(intent)
  if (!('operations' in buildResult)) {
    if (buildResult.ok === false) {
      return buildResult
    }
    return createKernelFailure('unknown', 'Invalid build result.')
  }

  return {
    ok: true,
    operations: buildResult.operations,
    value: buildResult.value
  }
}
