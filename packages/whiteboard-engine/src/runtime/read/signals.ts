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

  const apply = (node: boolean, edge: boolean, mindmap: boolean) => {
    if (node) {
      bump(atoms.node)
    }
    if (edge) {
      bump(atoms.edge)
    }
    if (mindmap) {
      bump(atoms.mindmap)
    }
  }

  return {
    apply
  }
}
