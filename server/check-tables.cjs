const pool = require("./db.cjs");

async function main() {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.table(result.rows);
  } catch (error) {
    console.error("DATABASE ERROR:");
    console.error(error);
  } finally {
    await pool.end();
  }
}

main();
