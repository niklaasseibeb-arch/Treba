const pool = require("./db.cjs");

async function main() {
  try {
    for (const table of ["driver_profiles", "vehicles", "routes"]) {
      console.log("\n========================================");
      console.log("TABLE:", table);
      console.log("========================================");

      const result = await pool.query(`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      console.table(result.rows);
    }
  } catch (error) {
    console.error("DATABASE ERROR:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
