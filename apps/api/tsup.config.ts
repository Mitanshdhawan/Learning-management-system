import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // Bundle the internal workspace packages (they ship TS source, not dist)...
  noExternal: [/@toplms\//],
  // ...but never bundle the Prisma client. Its runtime uses dynamic require(),
  // which esbuild can't inline into an ESM bundle ("Dynamic require of fs …").
  // It's loaded from node_modules at runtime instead (Prisma's own guidance).
  external: ['@prisma/client', '.prisma/client'],
})
