import type { WriteInput } from '@engine-types/command/api'
import type { Change } from '@engine-types/write/change'

export type ReactionModule = {
  topic: string
  seed?: () => void
  ingest: (change: Change) => void
  flush: () => WriteInput | null
}

type TopicDispatcher = (topic: string) => void

export type ReactionRegistry = {
  seed: (dispatchTopic: TopicDispatcher) => void
  ingest: (change: Change, dispatchTopic: TopicDispatcher) => void
  flush: (topic: string) => WriteInput | null
}

const assertUniqueTopics = (modules: readonly ReactionModule[]) => {
  const seen = new Set<string>()
  modules.forEach((module) => {
    if (!seen.has(module.topic)) {
      seen.add(module.topic)
      return
    }
    throw new Error(`Duplicated reaction topic: ${module.topic}`)
  })
}

export const createReactionRegistry = (
  modules: readonly ReactionModule[]
): ReactionRegistry => {
  assertUniqueTopics(modules)
  const moduleByTopic = new Map<string, ReactionModule>(
    modules.map((module) => [module.topic, module])
  )

  const seed: ReactionRegistry['seed'] = (dispatchTopic) => {
    modules.forEach((module) => {
      module.seed?.()
      dispatchTopic(module.topic)
    })
  }

  const ingest: ReactionRegistry['ingest'] = (change, dispatchTopic) => {
    modules.forEach((module) => {
      module.ingest(change)
      dispatchTopic(module.topic)
    })
  }

  const flush: ReactionRegistry['flush'] = (topic) => {
    const module = moduleByTopic.get(topic)
    if (!module) return null
    return module.flush()
  }

  return {
    seed,
    ingest,
    flush
  }
}
