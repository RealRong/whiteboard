import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(scriptDir, '..')
const srcRoot = join(projectRoot, 'src')

const toPosix = (value) => value.replaceAll('\\', '/')

const collectFiles = (root, output = []) => {
  const entries = readdirSync(root)
  for (const entry of entries) {
    const fullPath = join(root, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      collectFiles(fullPath, output)
      continue
    }
    if (!entry.endsWith('.ts') && !entry.endsWith('.tsx')) {
      continue
    }
    output.push(fullPath)
  }
  return output
}

const rules = [
  {
    name: 'input/sessions 禁止直写 state/render/mutate',
    root: join(srcRoot, 'input', 'sessions'),
    checks: [
      {
        pattern: /\bstate\.write\s*\(/g,
        message: '禁止在 session 中直接调用 state.write'
      },
      {
        pattern: /\brender\.write\s*\(/g,
        message: '禁止在 session 中直接调用 render.write'
      },
      {
        pattern: /\bmutate\s*\(/g,
        message: '禁止在 session 中直接调用 mutate'
      }
    ]
  },
  {
    name: 'runtime/query|view 禁止写入口',
    root: join(srcRoot, 'runtime'),
    include: (path) =>
      path.includes('/runtime/query/')
      || path.includes('/runtime/view/'),
    checks: [
      {
        pattern: /\bcommands\b/g,
        message: '禁止在 query/view 中依赖 commands'
      },
      {
        pattern: /\bmutate\b/g,
        message: '禁止在 query/view 中依赖 mutate'
      }
    ]
  }
]

const violations = []

for (const rule of rules) {
  const files = collectFiles(rule.root)
  for (const filePath of files) {
    const rel = toPosix(relative(projectRoot, filePath))
    if (rule.include && !rule.include(`/${toPosix(filePath)}`)) {
      continue
    }
    const content = readFileSync(filePath, 'utf8')
    for (const check of rule.checks) {
      check.pattern.lastIndex = 0
      if (!check.pattern.test(content)) continue
      violations.push({
        rule: rule.name,
        file: rel,
        message: check.message
      })
    }
  }
}

if (!violations.length) {
  process.exit(0)
}

console.error('Architecture checks failed:\n')
for (const violation of violations) {
  console.error(`- [${violation.rule}] ${violation.file}: ${violation.message}`)
}
console.error('\n请将写操作收敛到 Session -> Domain -> Writer -> Mutation Pipeline。')
process.exit(1)
