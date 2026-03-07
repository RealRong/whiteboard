import type { ReadSignals } from '@engine-types/read/change'
import type { PrimitiveAtom, createStore } from 'jotai/vanilla'

export const createReadSignals = ({
  store,
  atoms
}: {
  store: ReturnType<typeof createStore>
  atoms: {
    node: PrimitiveAtom<number>
    edge: PrimitiveAtom<number>
    mindmap: PrimitiveAtom<number>
  }
}) => {
  const bump = (atom: PrimitiveAtom<number>) => {
    store.set(atom, (revision: number) => revision + 1)
  }

  const apply = (signals: ReadSignals) => {
    if (signals.node) {
      bump(atoms.node)
    }
    if (signals.edge) {
      bump(atoms.edge)
    }
    if (signals.mindmap) {
      bump(atoms.mindmap)
    }
  }

  return {
    apply
  }
}
