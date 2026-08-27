const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function setupUSSD() {
  try {
    console.log("========================================");
    console.log("TREBA USSD / SMS DATABASE SETUP");
    console.log("========================================");

    /*
     * Check database connection.
     */
    await pool.query("SELECT NOW()");
    console.log("✓ PostgreSQL connection successful");

    /*
     * Create USSD sessions.
     *
     * A session stores the temporary state of a
     * passenger or driver while using USSD.
     */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ussd_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT NOT NULL UNIQUE,
        phone TEXT NOT NULL,
        service_code TEXT,
        network_code TEXT,
        text TEXT,
        current_menu TEXT,
        user_id UUID,
        session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        status VARCHAR(30) NOT NULL DEFAULT 'active',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);

    console.log("✓ ussd_sessions ready");

    /*
     * Create SMS message log.
     *
     * This lets Treba track outgoing/incoming SMS,
     * delivery status and provider message IDs.
     */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sms_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        phone TEXT NOT NULL,
        direction VARCHAR(20) NOT NULL DEFAULT 'outbound',
        message_type VARCHAR(50),
        message TEXT NOT NULL,
        provider VARCHAR(50),
        provider_message_id TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'pending',
        error_message TEXT,
        related_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ
      )
    `);

    console.log("✓ sms_messages ready");

    /*
     * Create USSD request log.
     *
     * This provides an audit trail of USSD requests.
     */
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ussd_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id TEXT,
        phone TEXT NOT NULL,
        service_code TEXT,
        network_code TEXT,
        request_text TEXT,
        response_text TEXT,
        user_id UUID,
        status VARCHAR(30) NOT NULL DEFAULT 'received',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("✓ ussd_requests ready");

    /*
     * Useful indexes.
     */
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone
      ON ussd_sessions(phone)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ussd_sessions_session_id
      ON ussd_sessions(session_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_messages_phone
      ON sms_messages(phone)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sms_messages_user_id
      ON sms_messages(user_id)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ussd_requests_phone
      ON ussd_requests(phone)
    `);

    /*
     * Display resulting tables.
     */
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'ussd_sessions',
          'sms_messages',
          'ussd_requests'
        )
      ORDER BY table_name
    `);

    console.log("");
    console.log("USSD/SMS tables:");
    
    for (const row of result.rows) {
      console.log(`✓ ${row.table_name}`);
    }

    console.log("");
    console.log("========================================");
    console.log("TREBA USSD / SMS SETUP COMPLETE");
    console.log("========================================");
  } catch (error) {
    console.error("");
    console.error("TREBA USSD/SMS SETUP FAILED");
    console.error("----------------------------------------");
    console.error(error);
    console.error("----------------------------------------");
    console.error("Message:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

setupUSSD();