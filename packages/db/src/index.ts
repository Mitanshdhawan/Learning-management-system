import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

// Load this package's own .env (DATABASE_URL / DIRECT_URL) regardless of which
// app imports it or what the current working directory is. In production these
// come from the real environment and the missing file is simply ignored.
const here = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(here, '../.env') })

// Reuse a single PrismaClient across hot-reloads in dev to avoid exhausting
// database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Re-export Prisma types & enums so consumers import everything from '@toplms/db'.
export * from '@prisma/client'
