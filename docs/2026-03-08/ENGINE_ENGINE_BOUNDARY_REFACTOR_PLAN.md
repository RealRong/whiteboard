# Whiteboard Engine Boundary Refactor Plan

## Goal

Make `@whiteboard/engine` converge to a smaller and clearer kernel:

1. Single write funnel: `command -> plan -> reduce -> history -> commit`
2. Single read funnel: `committed document -> read model -> projection/index`
3. Keep only document-semantic reactions in engine
4. Remove UI/host/editor-policy leakage from engine public surface

## Target Boundary

Engine should own:

- committed `Document`
- write planning and reduce
- history
- read model / projection / index
- document-semantic reactions such as group autofit
- engine config that directly affects write/read semantics

Engine should not own:

- DOM/container lifecycle
- keyboard shortcut contracts
- pointer event contracts
- edge-connect draft state used only by UI interaction
- React render contracts / node render props / DOM refs
- editor interaction policies that do not affect engine semantics
- benchmark-only kernels mixed into runtime source tree

## Problems In Current Structure

### 1. Host viewport bridge leaks into command/runtime API

Current issues:

- `commands.host.containerResized(...)` is not a command
- `runtime.applyConfig({ viewport })` mixes host/transient input with engine config
- `clientToScreen/clientToWorld/containerRect` are host bridge concerns, not document mutation concerns

Refactor direction:

- remove `commands.host`
- remove `viewport` from engine runtime config
- keep host rect update as imperative runtime input only
- prefer `engine.runtime.setContainerRect(rect)` over pushing host facts through commands

### 2. Engine public exports leak UI contracts

Current leaked contracts include:

- shortcut types
- pointer input types
- edge connect draft/state types
- internal tuning/default constants
- internal impact types
- helper adapters that are no longer part of the stable public API

Refactor direction:

- keep engine public exports limited to stable engine contracts
- move shortcut / UI interaction types to `whiteboard-react`
- stop exporting internal-only defaults and helper adapters

### 3. Internal type layering still carries fake abstractions

Current issue:

- `InternalInstance = Instance & {...}` forces construction of fake fields like `runtime: undefined as never`

Refactor direction:

- replace with a dedicated internal context type used only inside engine
- internal context should contain only actual engine dependencies

### 4. Thin wrappers still create noise

Current issue:

- runtime API assembly is split across tiny wrapper files that only forward functions

Refactor direction:

- inline tiny runtime assembly in `engine.ts`
- keep files only when they own real domain behavior

## Concrete Implementation Order

### Phase 1. Public boundary cleanup

- remove engine public exports that are no longer engine-stable
- move shortcut contracts to `whiteboard-react`
- stop exporting internal defaults such as `DEFAULT_INTERNALS` and `DEFAULT_TUNING`
- stop exporting `ReadImpact`, `Mutation`, `ApplyMutationsApi`, `toApplyConfig`, `resolveInstanceConfig`

### Phase 2. Runtime boundary cleanup

- replace `runtime.applyConfig` with `runtime.configure`
- runtime config keeps only `mindmapLayout` and `history`
- add `runtime.setContainerRect(rect)` as the host bridge entry
- remove `commands.host`

### Phase 3. Internal organization cleanup

- replace `InternalInstance` with a dedicated internal context type
- remove fake instance assembly in `engine.ts`
- keep command/reaction/planner deps explicit and minimal

## Deferred But Recommended Follow-ups

1. Move `src/perf` out of engine runtime source tree
2. Move `runtime/write/api` to `commands/`
3. Rename `state/factory` to `internal/store`
4. Consider replacing Jotai inside engine with a tiny internal store/signal layer
5. Revisit whether `ViewportHost` should live under a host/bridge namespace instead of `runtime/`

## Acceptance Criteria

- engine public surface becomes smaller and more semantic
- no host lifecycle method remains under `commands`
- engine runtime config no longer carries committed viewport
- internal context no longer extends public instance type
- engine and react still build after the boundary changes
