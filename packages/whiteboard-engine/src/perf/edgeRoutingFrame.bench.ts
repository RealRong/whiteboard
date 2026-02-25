import {
  type Document,
  type Edge,
  type Node,
  type Point
} from '@whiteboard/core/types'
import { createEngine } from '../instance/create'
import type { PointerInput } from '../types/common'

const NODE_COUNT = 5000
const EDGE_COUNT = 10000
const GRID_COLS = 100
const RUNS = 5
const WARMUP_FRAMES = 80
const MEASURE_FRAMES = 240
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

const FRAME_BUDGET_MS = toNumber(
  env.WB_BENCH_ROUTING_FRAME_BUDGET_MS ?? env.WB_BENCH_FRAME_BUDGET_MS,
  16
)
const ENFORCE_THRESHOLD = env.WB_BENCH_ENFORCE === '1'

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const cloneDoc = <T,>(value: T): T => {
  const structuredCloneFn = (
    globalThis as { structuredClone?: <V>(input: V) => V }
  ).structuredClone
  if (structuredCloneFn) {
    return structuredCloneFn(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const ensureRaf = () => {
  const runtimeRef = globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: (timestamp: number) => void) => number
    cancelAnimationFrame?: (id: number) => void
  }
  if (typeof runtimeRef.requestAnimationFrame === 'function') return
  runtimeRef.requestAnimationFrame = (callback) => {
    callback(now())
    return 0
  }
  runtimeRef.cancelAnimationFrame = () => {}
}

const createNodes = (): Node[] => {
  const nodes: Node[] = []
  for (let index = 0; index < NODE_COUNT; index += 1) {
    const row = Math.floor(index / GRID_COLS)
    const col = index % GRID_COLS
    nodes.push({
      id: `n_${index}`,
      type: 'card',
      position: {
        x: col * 180,
        y: row * 120
      },
      size: {
        width: 140,
        height: 80
      }
    })
  }
  return nodes
}

const createEdges = (): Edge[] => {
  const edges: Edge[] = []
  const routingPoints = [
    { x: 220, y: 120 },
    { x: 360, y: 160 }
  ]
  edges.push({
    id: 'e_route',
    type: 'linear',
    source: { nodeId: 'n_0' },
    target: { nodeId: 'n_1' },
    routing: {
      mode: 'manual',
      points: routingPoints
    }
  })
  for (let index = 1; index < EDGE_COUNT; index += 1) {
    const sourceIndex = index % NODE_COUNT
    const targetIndex = (index * 7 + 13) % NODE_COUNT
    edges.push({
      id: `e_${index}`,
      type: 'linear',
      source: { nodeId: `n_${sourceIndex}` },
      target: {
        nodeId: `n_${targetIndex === sourceIndex ? (targetIndex + 1) % NODE_COUNT : targetIndex}`
      }
    })
  }
  return edges
}

const createDocument = (): Document => {
  const nodes = createNodes()
  const edges = createEdges()
  return {
    id: 'bench-doc-routing',
    name: 'edge-routing-frame-bench',
    nodes,
    edges,
    order: {
      nodes: nodes.map((node) => node.id),
      edges: edges.map((edge) => edge.id)
    },
    viewport: {
      center: { x: 0, y: 0 },
      zoom: 1
    }
  }
}

const percentile = (values: number[], p: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(
    0,
    Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  )
  return sorted[index] ?? 0
}

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0

const format = (value: number) => `${value.toFixed(4)}ms`

const createPointerInput = (options: {
  instance: ReturnType<typeof createEngine>
  pointerId: number
  client: Point
}): PointerInput => {
  const { instance, pointerId, client } = options
  const screen = instance.query.viewport.clientToScreen(
    client.x,
    client.y
  )
  return {
    pointerId,
    button: 0,
    client,
    screen,
    world: instance.query.viewport.screenToWorld(screen),
    modifiers: {
      shift: false,
      alt: false,
      ctrl: false,
      meta: false
    }
  }
}

const main = () => {
  ensureRaf()

  let doc = createDocument()
  const instance = createEngine({
    document: doc,
    onDocumentChange: (nextDoc) => {
      doc = nextDoc
    }
  })
  const syncDoc = (next: Document) => {
    void instance.commands.doc.reset(next)
  }

  const edgeId = 'e_route'
  const routingIndex = 0
  const baseEdge = instance.projection.getSnapshot().edges.visible.find((edge) => edge.id === edgeId)
  if (!baseEdge || !baseEdge.routing?.points?.length) {
    throw new Error(`Missing routing edge: ${edgeId}`)
  }
  const basePoints = [...baseEdge.routing.points]
  const startClient = basePoints[routingIndex]
  if (!startClient) {
    throw new Error(`Missing routing point index: ${routingIndex}`)
  }

  const runSamples: number[][] = []
  for (let run = 0; run < RUNS; run += 1) {
    const pointerId = run + 1
    const draft = instance.domains.edge.interaction.routing.begin({
      edgeId,
      index: routingIndex,
      pointer: createPointerInput({
        instance,
        pointerId,
        client: startClient
      })
    })
    if (!draft) {
      throw new Error(`routingDrag.begin failed at run ${run + 1}`)
    }
    const activeSession = instance.render.read('interactionSession').active
    if (
      !activeSession
      || activeSession.kind !== 'routingDrag'
      || activeSession.pointerId !== pointerId
    ) {
      throw new Error(`routingDrag.begin failed at run ${run + 1}`)
    }

    for (let frame = 0; frame < WARMUP_FRAMES; frame += 1) {
      const client = {
        x: startClient.x + frame * 0.9,
        y: startClient.y + Math.sin(frame / 8) * 6
      }
      instance.domains.edge.interaction.routing.updateDraft({
        draft,
        pointer: createPointerInput({
          instance,
          pointerId,
          client
        })
      })
    }

    const samples: number[] = []
    for (let frame = 0; frame < MEASURE_FRAMES; frame += 1) {
      const client = {
        x: startClient.x + (WARMUP_FRAMES + frame) * 0.9,
        y: startClient.y + Math.sin(frame / 10) * 6
      }
      const startedAt = now()
      instance.domains.edge.interaction.routing.updateDraft({
        draft,
        pointer: createPointerInput({
          instance,
          pointerId,
          client
        })
      })
      samples.push(now() - startedAt)
    }

    instance.domains.edge.interaction.routing.commitDraft(draft)

    const resetDoc = cloneDoc(doc)
    const resetEdge = resetDoc.edges.find((edge) => edge.id === edgeId)
    if (resetEdge) {
      resetEdge.routing = {
        ...(resetEdge.routing ?? {}),
        mode: 'manual',
        points: basePoints
      }
    }
    syncDoc(resetDoc)
    runSamples.push(samples)
  }

  const allSamples = runSamples.flat()
  const p50 = percentile(allSamples, 50)
  const p95 = percentile(allSamples, 95)
  const p99 = percentile(allSamples, 99)
  const avg = average(allSamples)
  const max = allSamples.length ? Math.max(...allSamples) : 0
  const min = allSamples.length ? Math.min(...allSamples) : 0
  const pass = p95 < FRAME_BUDGET_MS

  console.log(
    [
      'edge-routing-frame bench',
      `nodes=${NODE_COUNT}`,
      `edges=${EDGE_COUNT}`,
      `runs=${RUNS}`,
      `warmup=${WARMUP_FRAMES}`,
      `frames=${MEASURE_FRAMES}`
    ].join(' | ')
  )
  runSamples.forEach((samples, index) => {
    console.log(
      [
        `run-${index + 1}`,
        `p50=${format(percentile(samples, 50))}`,
        `p95=${format(percentile(samples, 95))}`,
        `p99=${format(percentile(samples, 99))}`,
        `avg=${format(average(samples))}`,
        `max=${format(Math.max(...samples))}`
      ].join(' | ')
    )
  })
  console.log(
    [
      'overall',
      `min=${format(min)}`,
      `p50=${format(p50)}`,
      `p95=${format(p95)}`,
      `p99=${format(p99)}`,
      `avg=${format(avg)}`,
      `max=${format(max)}`
    ].join(' | ')
  )
  console.log(['target', `p95<${FRAME_BUDGET_MS}ms`, pass ? 'PASS' : 'FAIL'].join(' | '))

  if (ENFORCE_THRESHOLD && !pass && runtime.process) {
    runtime.process.exitCode = 1
    console.error(
      [
        'threshold check failed',
        `expected p95<${FRAME_BUDGET_MS}ms`,
        `actual p95=${format(p95)}`
      ].join(' | ')
    )
  }
}

main()
