import pkg from '../package.json'

const gitResult = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'])
const gitHash = gitResult.success ? gitResult.stdout.toString().trim() : 'unknown'

const result = Bun.spawnSync(
  [
    'bun',
    'build',
    'src/index.tsx',
    '--outdir',
    'dist',
    '--target',
    'bun',
    '--minify',
    '--external',
    '@opentui/core',
    '--external',
    '@opentui/react',
    '--external',
    'react',
    `--define`,
    `__GIT_COMMIT__="${gitHash}"`,
    `--define`,
    `__APP_VERSION__="${pkg.version}"`,
  ],
  { stdio: ['inherit', 'inherit', 'inherit'] }
)

process.exit(result.exitCode ?? 0)
