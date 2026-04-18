const { PrismaClient } = require("@prisma/client");

const globalForPrisma = global;

function buildDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  // Supabase pooler + Prisma can exhaust session-mode clients under multiple
  // devices if the client opens more than one connection.
  // These params keep Prisma on a single, PgBouncer-friendly connection path.
  const separator = rawUrl.includes("?") ? "&" : "?";
  return `${rawUrl}${separator}pgbouncer=true&connection_limit=1&pool_timeout=0`;
}

const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: buildDatabaseUrl(process.env.DATABASE_URL),
      },
    },
    log: ["error", "warn"],
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
