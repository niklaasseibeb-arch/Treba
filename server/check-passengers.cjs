const pool = require("./db.cjs");

pool.query(`
  SELECT
    id,
    full_name,
    phone,
    app_role,
    account_status
  FROM users
  WHERE app_role = 'passenger'
  ORDER BY created_at DESC
  LIMIT 10
`)
.then(result => {
  console.log(JSON.stringify(result.rows, null, 2));
  process.exit(0);
})
.catch(error => {
  console.error(error);
  process.exit(1);
});
