# Repository Guidelines

Always reply in Chinese.

## Project Structure & Module Organization
- `packages/whiteboard-core`: core types, algorithms, and data structures.
- `packages/whiteboard-react`: React components, hooks, and UI rendering.
- `packages/whiteboard-plugins`: optional business extensions.
- `src/`: current in-repo implementation (legacy/reference while refactoring).
- `_rendevoz/typings/`: legacy type definitions used for migration.
- `REFACTOR_GUIDE.md`: migration plan and dependency notes.

## Build, Test, and Development Commands
- `pnpm install`: install workspace dependencies.
- `pnpm -r build`: run each package’s build script (add per-package scripts as they appear).
- `pnpm -r lint`: run each package’s lint script (placeholder until configured).
- `pnpm -r test`: run each package’s test script (placeholder until configured).

## Coding Style & Naming Conventions
- Language: TypeScript; React in `whiteboard-react`.
- Follow existing formatting in each file; JSON/YAML uses 2-space indentation.
- Package names are scoped as `@whiteboard/*`.
- Prefer clear, domain-focused names (e.g., `WhiteboardStore`, `useWhiteboardInstance`).

## Testing Guidelines
- No test framework is configured yet.
- When adding tests, prefer colocated paths like `packages/<pkg>/src/__tests__/` and file names `*.test.ts(x)` or `*.spec.ts(x)`.
- Add or document the test command in each package’s `package.json`.

## Commit & Pull Request Guidelines
- Git history currently shows only `Init`; no established convention yet.
- Use short, imperative commit messages (e.g., “Add core types scaffold”).
- PRs should include a brief summary, any breaking changes, and UI screenshots when `whiteboard-react` changes.
- Link relevant issues or notes from `REFACTOR_GUIDE.md` when refactoring.

## Configuration & Migration Notes
- The workspace is intended to split legacy code into core/react/plugins; keep changes aligned with that goal.
- If a change depends on missing legacy dependencies, document the adapter or stub you introduce.

## AI Development Guidelines (English)
- Use Jotai for shared state; do not introduce React Providers.
- Aggregate atoms by responsibility; avoid overly granular atoms.
- Components must not read/write atoms directly; only hooks access atoms.
- Hooks are semantic and single-responsibility; avoid `useXxxState/useXxxModel` naming.
- Prefer small composable hooks; avoid “mega hooks”.
- Components compose multiple hooks and small components; keep props minimal when data can be read via hooks.
- Rendering inside hooks should be thin: return props or thin render helpers; avoid large JSX blocks in hooks.
- Separate concerns: instance/services handle side effects and DOM bindings; atoms represent UI state.
- Hooks must be pure: only read/write state, compose business APIs and render helpers; no lifecycle or side effects.
- All lifecycle and side effects (event listeners, observers, external callbacks, core.dispatch) live in components or a dedicated lifecycle layer that imports hooks.
- Prefer local semantic hooks in `xxx/hooks` and renderers in `xxx/components`; keep component files focused on composition.
- Event handlers for UI interaction should be exposed by hooks (e.g. hover/selection handlers), not built directly in components.
- Avoid wrapper “aggregator” hooks that only pass data through; inline in the component or split into small semantic hooks.
- Hooks may return render helpers, but keep them small and avoid large JSX blocks in hooks.
- Instance/services structure:
  - Place instance and services under `packages/whiteboard-react/src/common/instance/`.
  - Hooks that expose instance access live in `packages/whiteboard-react/src/common/hooks/`.
  - Services are pure side-effect handlers (DOM events, observers), no React rendering.
  - Instance is the integration point for services; avoid storing UI state inside instance.
  - Cross-module read-only runtime getters must live under `packages/whiteboard-react/src/common/instance/query/` (e.g., node geometry queries).
  - Keep `whiteboardInstance.ts` as composition-only: do not inline query implementation there; compose query module like api/commands/runtime.
  - Query methods should be pure/read-only and may keep internal memoization based on source atom references.
  - Any new capability added to instance must be split by responsibility into submodules first (e.g., `api/`, `commands/`, `query/`, `runtime/`, `services/`, `state/`, `store/`, `geometry/`, `edge/`).
  - `whiteboardInstance.ts` is the final composition layer only: it should wire modules into `instance` (api/commands/query/runtime/services) and must not contain feature logic implementations.
  - Avoid duplicate imperative geometry/state reads across modules; prefer reusing `instance.query` getters as the single source for cross-module runtime reads.
  - For container-level canvas event handlers (pointer/wheel/key), prefer top-level single-point composition (`useCanvasHandlers` -> lifecycle binding) instead of prematurely mounting them onto `instance`.
  - Only elevate handlers into `instance` when there are multiple real consumers (e.g., non-React host, plugin runtime, shared imperative entry).
  - Handler hot-path should prefer event-time getters (`instance.state.get`, `instance.viewport.get/getZoom/screenToWorld`) and avoid atom subscriptions in handler composition hooks.
- Naming conventions:
  - Hooks: `useXxx` (semantic responsibility).
  - Services: `xxxService` (e.g., `nodeSizeObserverService`).
  - Instances: `whiteboardInstance` (single entry), export factory/initializer when needed.
- Preferred architecture pattern (best practice):
  - Core runtime (drag/resize/snap/group) follows the legacy style: instance-centric, command/handler driven, event flow first.
  - UI composition (layers/components) follows the new style: semantic hooks + thin components + Jotai state.
  - Keep the boundary explicit: runtime owns behavior; UI owns composition.
- Viewport/zoom performance pattern (getter + CSS variables):
  - Prefer runtime getters (e.g. `instance.viewport.getZoom()`) for hot-path interaction math (drag, hit-test, snap threshold, reconnect calculations).
  - Do not subscribe to atom/state for zoom in hot handlers unless rerender is strictly required.
  - Use atom/state only when value changes must trigger React render/effect for UI composition.
  - Inject `--wb-zoom` at a high-level container (from viewport runtime), then consume it in visual-only elements.
  - Prefer CSS `calc(... / var(--wb-zoom, 1))` for handle sizes, offsets, border widths, icon/font sizes.
  - Prefer `vectorEffect="non-scaling-stroke"` for SVG lines/paths that should keep screen-space stroke width.
  - Keep zoom model single-source: document viewport in Jotai/core state, runtime geometry in instance, visual scaling in CSS vars.
  - Decision rule:
    - If it is interaction logic math: getter first.
    - If it is visual scale only: CSS variable first.
    - If it must drive React rendering semantics: state subscription.
- Anti-patterns (avoid these):
  - Do not pass `zoom` through many hooks/props only for math; read it from runtime getter at use-site.
  - Do not create extra zoom atoms/selectors for each feature or layer.
  - Do not use React state updates in `pointermove` for visual-only scale changes.
  - Do not recompute zoom-based inline styles in large render loops when CSS vars can express them.
  - Do not mix world-space and screen-space values without explicit naming (e.g. `thresholdScreen` vs `thresholdWorld`).
  - Do not keep multiple zoom sources (atom + local state + ref) alive simultaneously.
  - Do not move single-consumer canvas handlers into `instance` just for abstraction; avoid adding global API surface without reuse demand.
- Example (how to emulate the pattern):
```ts
// runtime action hook (legacy-style behavior module)
export const useNodeInteraction = (node, rect) => {
  const instance = useInstance()
  const selection = useSelection()
  const dragHandlers = useNodeDragRuntime(instance, node, rect)
  const onPointerDown = (event) => {
    selection.handlePointerDown(event, node.id)
    dragHandlers.onPointerDown(event)
  }
  return { dragHandlers, onPointerDown }
}

// UI component (new-style composition)
export const NodeItem = ({ node }) => {
  const presentation = useNodePresentation(node)
  const interaction = useNodeInteraction(node, presentation.rect)
  const transform = useNodeTransform(node)
  return (
    <>
      <NodeBlock {...presentation.containerProps} {...interaction.dragHandlers} />
      {transform.renderHandles()}
    </>
  )
}
```
