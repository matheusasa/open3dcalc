import postgres from "postgres";

function getConnectionString(): string {
  return (
    process.env["DATABASE_URL"] ??
    "postgresql://open3dcalc:open3dcalc@localhost:5432/open3dcalc"
  );
}

let sql: postgres.Sql | null = null;

export function getSqlClient(): postgres.Sql {
  if (!sql) {
    sql = postgres(getConnectionString());
  }
  return sql;
}