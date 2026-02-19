import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addChild,
  createMindmap,
  layoutMindmap,
  layoutMindmapTidy,
  moveSubtree,
  removeSubtree
} from '../dist/index.js'

test('mindmap commands', () => {
  let nodeSeq = 1
  const idGenerator = {
    treeId: () => 'mindmap_1',
    nodeId: () => `node_${nodeSeq++}`
  }

  const tree = createMindmap({ idGenerator })
  assert.equal(tree.id, 'mindmap_1')
  assert.equal(tree.rootId, 'node_1')

  const addOne = addChild(tree, tree.rootId, { kind: 'text', text: 'child-1' }, { side: 'right', idGenerator })
  assert.ok(addOne.ok)
  const tree1 = addOne.tree
  const addTwo = addChild(tree1, tree1.rootId, { kind: 'text', text: 'child-2' }, { side: 'left', idGenerator })
  assert.ok(addTwo.ok)
  const tree2 = addTwo.tree

  const children = tree2.children[tree2.rootId]
  assert.equal(children.length, 2)

  const move = moveSubtree(tree2, children[1], children[0])
  assert.ok(move.ok)
  const tree3 = move.tree
  assert.equal(tree3.nodes[children[1]].parentId, children[0])

  const removed = removeSubtree(tree3, children[0])
  assert.ok(removed.ok)
  const tree4 = removed.tree
  assert.ok(tree4.nodes[children[0]] === undefined)
  assert.ok(tree4.rootId)
})

test('mindmap layout outputs coordinates', () => {
  let nodeSeq = 1
  const idGenerator = {
    treeId: () => 'mindmap_layout',
    nodeId: () => `node_${nodeSeq++}`
  }
  const tree = createMindmap({ idGenerator })
  const add = addChild(tree, tree.rootId, { kind: 'text', text: 'child' }, { side: 'right', idGenerator })
  assert.ok(add.ok)
  const tree1 = add.tree

  const getNodeSize = () => ({ width: 120, height: 30 })
  const layout = layoutMindmap(tree1, getNodeSize)
  const tidy = layoutMindmapTidy(tree1, getNodeSize)

  assert.ok(layout.node[tree1.rootId])
  assert.ok(tidy.node[tree1.rootId])
  assert.ok(layout.bbox.width >= 0 && layout.bbox.height >= 0)
  assert.ok(tidy.bbox.width >= 0 && tidy.bbox.height >= 0)
})
