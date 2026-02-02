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
