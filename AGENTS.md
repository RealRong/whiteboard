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
- Instance/services structure:
  - Place instance and services under `packages/whiteboard-react/src/common/instance/`.
  - Hooks that expose instance access live in `packages/whiteboard-react/src/common/hooks/`.
  - Services are pure side-effect handlers (DOM events, observers), no React rendering.
  - Instance is the integration point for services; avoid storing UI state inside instance.
- Naming conventions:
  - Hooks: `useXxx` (semantic responsibility).
  - Services: `xxxService` (e.g., `nodeSizeObserverService`).
  - Instances: `whiteboardInstance` (single entry), export factory/initializer when needed.
