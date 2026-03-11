# Engine / UI Boundary Refactor Plan

## Goal

Make `@whiteboard/engine` stop owning editor UI transient state.

Target boundary:

- `@whiteboard/core`
  - immutable document types
  - operations
  - reduce / geometry / mindmap algorithms
- `@whiteboard/engine`
  - write pipeline
  - commit
  - read model / indexes / projection
  - committed viewport host
  - runtime config that affects read results (`mindmapLayout`, history, viewport host)
- `@whiteboard/react`
  - selection
  - tool mode
  - interaction state (`focus`, `pointer`, `hover`)
  - selection box
  - viewport gesture preview
  - session lock
  - node / edge / routing preview state
  - hook-local pointer sessions

## Problems In Current Design

1. Engine still exposes UI state:
   - `selection`
   - `tool`
   - `interaction`
2. React preview/session state is physically stored in `engine.runtime.store`.
3. `useWhiteboardSelector` is coupled to engine state shape instead of editor UI state.
4. `Whiteboard` mounts `JotaiProvider` with `instance.runtime.store`, so UI state ownership is inverted.
5. `interaction` inside engine is weakly semantic and partly dead:
   - `focus.*` is UI DOM focus state
   - `hover.edgeId` is effectively unused
   - `pointer.button/modifiers` are not a stable engine fact

## Long-Term Target

### Engine instance

Engine should only expose:

- `read`
- `commands`
  - document / node / edge / viewport / mindmap / history / host
- `runtime`
  - `applyConfig`
  - `dispose`

Engine should no longer expose:

- `state`
- `runtime.store`
- `state.selection`
- `commands.tool`
- `commands.interaction`

### React instance

React composes its own instance on top of engine.

Suggested shape:

```ts
export type WhiteboardInstance = {
  engine: EngineInstance
  read: EngineRead
  commands: EngineCommands & EditorUiCommands
  ui: EditorUiApi
  runtime: {
    applyConfig: EngineRuntime['applyConfig']
    dispose: EngineRuntime['dispose']
  }
}
```

Where:

- `EditorUiApi` owns UI store and UI state reads/subscriptions
- `EditorUiCommands` owns:
  - `selection`
  - `tool`
  - `interaction`

## UI State Ownership

### React shared UI store

Move these into a dedicated React-side store:

- `tool`
- `selection`
- `interaction`
- `selectionBox`
- `viewportGesture`
- `sessionLock`
- `nodeInteractionPreview`
- `edgeConnectPreview`
- `edgeRoutingPreview`

### Hook-local state

Keep local inside hooks:

- active pointer id
- session refs
- drag refs
- requestAnimationFrame ids
- observers

## Selector Strategy

`useWhiteboardSelector` becomes a React-level editor-state hook.

It should read from a composed snapshot:

- UI store: `tool`, `selection`, `interaction`
- engine runtime facts: `viewport`, `mindmapLayout`

This keeps component ergonomics simple while removing UI ownership from engine.

## Engine Read Subscription Target

Keep engine read subscriptions only for:

- `viewport`
- `mindmapLayout`
- `node`
- `edge`
- `mindmap`

Remove engine read subscription keys for:

- `selection`
- `tool`
- `interaction`

## Execution Order

1. Remove `selection/tool/interaction` from engine public types and commands.
2. Shrink engine runtime API by deleting `runtime.store`.
3. Introduce React-side UI store and `WhiteboardInstance` composition.
4. Migrate preview/session state modules to the React UI store.
5. Migrate selectors and imperative interaction code to React UI state.
6. Update `Whiteboard` provider ownership so Jotai store is created in React.
7. Run lint/build for engine and react.

## Non-Goals

- do not change operation architecture
- do not change document format in this refactor
- do not reintroduce compatibility shims for engine UI state

## Success Criteria

1. `@whiteboard/engine` no longer exports or owns `selection/tool/interaction` state.
2. `@whiteboard/react` no longer depends on `engine.runtime.store`.
3. `Whiteboard` uses a React-owned Jotai store.
4. All current interactions still build and run through a single write path.
