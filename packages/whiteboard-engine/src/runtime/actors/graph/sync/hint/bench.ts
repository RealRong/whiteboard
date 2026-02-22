import type { Node, Operation } from '@whiteboard/core/types'
import { buildHint } from './index'

const runtime = globalThis as {
  process?: {
    env?: Record<string, string | undefined>
    exitCode?: number
  }
}

const env = runtime.process?.env ?? {}

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const RUNS = Math.max(1, Math.floor(toNumber(env.WB_BENCH_RUNS, 5)))
const WARMUP_RUNS = Math.max(0, Math.floor(toNumber(env.WB_BENCH_WARMUP_RUNS, 1)))
const ENFORCE_THRESHOLD = env.WB_BENCH_ENFORCE === '1'

const NODE_HINT_MOVE_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_MOVE_BUDGET_MS, 0.8)
const NODE_HINT_COLLAPSED_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_COLLAPSED_BUDGET_MS, 0.8)
const NODE_HINT_TYPE_SWITCH_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_TYPE_SWITCH_BUDGET_MS, 0.8)
const NODE_HINT_CREATE_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_CREATE_BUDGET_MS, 0.8)
const NODE_HINT_DELETE_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_DELETE_BUDGET_MS, 0.8)
const NODE_HINT_ORDER_BUDGET_MS = toNumber(env.WB_BENCH_NODE_HINT_ORDER_BUDGET_MS, 0.8)

type Scenario = {
  key: string
  name: string
  operations: Operation[]
  loops: number
  budgetMs: number
}

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const toNode = (
  id: string,
  type: string,
  options?: {
    parentId?: string
    x?: number
    y?: number
  }
): Node => ({
  id,
  type,
  parentId: options?.parentId,
  position: {
    x: options?.x ?? 0,
    y: options?.y ?? 0
  }
})

const createNodes = (groupCount: number, childrenPerGroup: number) => {
  const groups: Node[] = []
  const children: Node[] = []

  for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
    const groupId = `g_${groupIndex}`
    groups.push(toNode(groupId, 'group', { x: groupIndex * 40, y: groupIndex * 24 }))
    for (let childIndex = 0; childIndex < childrenPerGroup; childIndex += 1) {
      const childId = `n_${groupIndex}_${childIndex}`
      children.push(
        toNode(childId, 'card', {
          parentId: groupId,
          x: groupIndex * 40 + childIndex * 2,
          y: groupIndex * 24 + childIndex * 2
        })
      )
    }
  }

  return {
    groups,
    children,
    all: [...groups, ...children]
  }
}

const take = <T>(items: T[], count: number) => items.slice(0, Math.min(count, items.length))

const toDeleteOperation = (node: Node): Operation => ({
  type: 'node.delete',
  id: node.id,
  before: node
})

type ScenarioSample = {
  elapsedMs: number
  perLoopMs: number
  opsPerSecond: number
  checksum: number
}

type ScenarioResult = {
  scenario: Scenario
  samples: ScenarioSample[]
  p50Ms: number
  p95Ms: number
  avgMs: number
  maxMs: number
  avgOpsPerSecond: number
  checksum: number
  pass: boolean
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[index] ?? 0
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const formatMs = (value: number) => `${value.toFixed(4)}ms`

const runScenarioOnce = (
  scenario: Scenario,
  getNodes: () => Node[]
): ScenarioSample => {
  let checksum = 0
  const startedAt = now()
  for (let index = 0; index < scenario.loops; index += 1) {
    const hint = buildHint(scenario.operations, getNodes)
    checksum += hint.kind === 'full' ? 1 : 0
    checksum += hint.kind === 'partial' && hint.orderChanged ? 1 : 0
    checksum += hint.kind === 'partial' ? hint.dirtyNodeIds?.length ?? 0 : 0
  }
  const elapsedMs = now() - startedAt
  const perLoopMs = elapsedMs / scenario.loops
  const opsPerSecond = scenario.loops > 0 ? (scenario.loops * 1000) / elapsedMs : 0

  return {
    elapsedMs,
    perLoopMs,
    opsPerSecond,
    checksum
  }
}

const runScenario = (scenario: Scenario, getNodes: () => Node[]): ScenarioResult => {
  for (let run = 0; run < WARMUP_RUNS; run += 1) {
    runScenarioOnce(scenario, getNodes)
  }

  const samples: ScenarioSample[] = []
  for (let run = 0; run < RUNS; run += 1) {
    samples.push(runScenarioOnce(scenario, getNodes))
  }

  const perLoopSamples = samples.map((sample) => sample.perLoopMs)
  const opsPerSecondSamples = samples.map((sample) => sample.opsPerSecond)
  const checksum = samples.reduce((sum, sample) => sum + sample.checksum, 0)
  const p50Ms = percentile(perLoopSamples, 50)
  const p95Ms = percentile(perLoopSamples, 95)
  const avgMs = average(perLoopSamples)
  const maxMs = perLoopSamples.length ? Math.max(...perLoopSamples) : 0
  const avgOpsPerSecond = average(opsPerSecondSamples)
  const pass = p95Ms < scenario.budgetMs

  console.log(
    [
      scenario.name,
      `loops=${scenario.loops}`,
      `ops=${scenario.operations.length}`,
      `runs=${RUNS}`,
      `warmup=${WARMUP_RUNS}`,
      `p50=${formatMs(p50Ms)}`,
      `p95=${formatMs(p95Ms)}`,
      `avg=${formatMs(avgMs)}`,
      `max=${formatMs(maxMs)}`,
      `ops/s=${avgOpsPerSecond.toFixed(2)}`,
      `budget<${scenario.budgetMs}ms`,
      pass ? 'PASS' : 'FAIL',
      `checksum=${checksum}`
    ].join(' | ')
  )

  return {
    scenario,
    samples,
    p50Ms,
    p95Ms,
    avgMs,
    maxMs,
    avgOpsPerSecond,
    checksum,
    pass
  }
}

const main = () => {
  const dataset = createNodes(120, 40)
  const groupSample = take(dataset.groups, 24)
  const childSample = take(dataset.children, 320)

  const moveOps: Operation[] = childSample.map((node, index) => ({
    type: 'node.update',
    id: node.id,
    before: node,
    patch: {
      position: {
        x: node.position.x + (index % 3),
        y: node.position.y + (index % 2)
      }
    }
  }))

  const collapsedOps: Operation[] = groupSample.map((group) => ({
    type: 'node.update',
    id: group.id,
    before: group,
    patch: {
      data: {
        collapsed: true
      }
    }
  }))

  const typeSwitchOps: Operation[] = take(dataset.children, 64).map((node) => ({
    type: 'node.update',
    id: node.id,
    before: node,
    patch: {
      type: 'group'
    }
  }))

  const createOps: Operation[] = take(dataset.groups, 64).map((group, index) => ({
    type: 'node.create',
    node: toNode(`new_${index}`, 'card', {
      parentId: group.id,
      x: index,
      y: index
    })
  }))

  const deleteOps: Operation[] = [
    ...take(dataset.children, 80).map(toDeleteOperation),
    ...take(dataset.groups, 8).map(toDeleteOperation)
  ]

  const scenarios: Scenario[] = [
    {
      key: 'move-bulk',
      name: 'move-bulk',
      operations: moveOps,
      loops: 800,
      budgetMs: NODE_HINT_MOVE_BUDGET_MS
    },
    {
      key: 'collapsed-groups',
      name: 'collapsed-groups',
      operations: collapsedOps,
      loops: 600,
      budgetMs: NODE_HINT_COLLAPSED_BUDGET_MS
    },
    {
      key: 'type-switch-group',
      name: 'type-switch-group',
      operations: typeSwitchOps,
      loops: 500,
      budgetMs: NODE_HINT_TYPE_SWITCH_BUDGET_MS
    },
    {
      key: 'create-with-ancestors',
      name: 'create-with-ancestors',
      operations: createOps,
      loops: 1000,
      budgetMs: NODE_HINT_CREATE_BUDGET_MS
    },
    {
      key: 'delete-mixed',
      name: 'delete-mixed',
      operations: deleteOps,
      loops: 700,
      budgetMs: NODE_HINT_DELETE_BUDGET_MS
    },
    {
      key: 'order-with-ancestors',
      name: 'order-with-ancestors',
      operations: [
        {
          type: 'node.order.set',
          ids: take(dataset.children, 200).map((node) => node.id)
        }
      ],
      loops: 2000,
      budgetMs: NODE_HINT_ORDER_BUDGET_MS
    }
  ]

  console.log(
    `hint bench | nodes=${dataset.all.length} | groups=${dataset.groups.length} | children=${dataset.children.length}`
  )
  const results = scenarios.map((scenario) => runScenario(scenario, () => dataset.all))
  const failed = results.filter((result) => !result.pass)
  const pass = failed.length === 0

  console.log(
    [
      'target',
      'all-scenario p95<budget',
      pass ? 'PASS' : 'FAIL'
    ].join(' | ')
  )

  if (ENFORCE_THRESHOLD && !pass && runtime.process) {
    runtime.process.exitCode = 1
    console.error(
      [
        'threshold check failed',
        ...failed.map(
          (result) =>
            `${result.scenario.key}: p95=${formatMs(result.p95Ms)} expected<${result.scenario.budgetMs}ms`
        )
      ].join(' | ')
    )
  }
}

main()
