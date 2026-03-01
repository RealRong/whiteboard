import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { ReadRuntimeContext } from '../context'
import type { ReadFeature } from '../featureTypes'
import { model as createMindmapModel } from './model'
import { view as createMindmapView } from './view'
import { viewModel as createMindmapViewModel } from './viewModel'

type MindmapReadAtomKey = 'mindmapIds' | 'mindmapById'

type MindmapReadGetterKey = MindmapReadAtomKey

export type MindmapReadFeature = ReadFeature<
  MindmapReadAtomKey,
  MindmapReadGetterKey
>

export const feature = (context: ReadRuntimeContext): MindmapReadFeature => {
  const readSnapshot = (): ReadModelSnapshot => context.get('snapshot')
  const readMindmapLayout = (): MindmapLayoutConfig =>
    context.get('mindmapLayout')

  const model = createMindmapModel({
    config: context.config
  })

  const mindmapViewModel = createMindmapViewModel({
    getTrees: () =>
      model.trees({
        visibleNodes: readSnapshot().nodes.visible,
        layout: readMindmapLayout()
      })
  })

  const atoms = createMindmapView({
    mindmapLayoutAtom: context.atom('mindmapLayout'),
    readSnapshotAtom: context.atom('snapshot'),
    getSnapshot: mindmapViewModel.getSnapshot
  })

  return {
    atoms,
    get: {
      mindmapIds: () => context.readAtom(atoms.mindmapIds),
      mindmapById: (id) => context.readAtom(atoms.mindmapById(id))
    }
  }
}
