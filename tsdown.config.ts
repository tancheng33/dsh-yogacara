import { defineConfig } from 'tsdown'

/**
 * Self-contained build: transpiles `src/` and emits declarations without
 * project references, so `prepare` works after a bare `github:` install where
 * no monorepo checkout is present.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/citta.ts', 'src/caitasika.ts', 'src/conversation.ts', 'src/projection.ts'],
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  dts: true,
  unbundle: true,
  clean: true,
  // Peer deps resolve from the host harness installation, never bundled.
  external: [/^@deepseek-ai\/(?!schemastery)/],
})
