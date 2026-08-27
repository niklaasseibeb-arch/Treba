const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const pool = require("./db.cjs");
const ussdRouter = require("./ussd.cjs");
const {
  testAnalyzerAgent,
} = require("./foundry.cjs");
const { openai } = require("./foundry.cjs");

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// Treba USSD/SMS service
app.use("/api", ussdRouter);

/*
 * =========================================================
 * CONFIGURATION
 * =========================================================
 */

const PORT = Number(process.env.API_PORT || 5000);

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "TREBA_DEVELOPMENT_SECRET_CHANGE_THIS";

/*
 * =========================================================
 * HEALTH CHECK
 * =========================================================
 */

app.get("/api/health", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS user
    `);

    res.json({
      ok: true,
      message: "Treba API is running",
      database: result.rows[0].database,
      user: result.rows[0].user,
    });
  } catch (error) {
    console.error("HEALTH CHECK ERROR:", error);

    res.status(500).json({
      ok: false,
      message: "Database connection failed",
      error: error.message,
    });
  }
});

/*
 * =========================================================
 * DATABASE SCHEMA
 * =========================================================
 */

app.get("/api/schema", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    res.json({
      ok: true,
      database: "treba",
      tables: result.rows.map(
        (row) => row.table_name
      ),
    });
  } catch (error) {
    console.error("SCHEMA ERROR:", error);

    res.status(500).json({
      ok: false,
      message: "Failed to read database schema",
      error: error.message,
    });
  }
});

/*
 * =========================================================
 * DATABASE TABLE DETAILS
 * =========================================================
 */

app.get("/api/schema/details", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    res.json({
      ok: true,
      columns: result.rows,
    });
  } catch (error) {
    console.error(
      "SCHEMA DETAILS ERROR:",
      error
    );

    res.status(500).json({
      ok: false,
      message:
        "Failed to read database column information",
      error: error.message,
    });
  }
});

/*
 * =========================================================
 * AUTH DATABASE SETUP
 *
 * Safe to run more than once.
 * =========================================================
 */

app.post("/api/setup/auth", async (req, res) => {
  try {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN
      NOT NULL DEFAULT false
    `);

    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
    `);

    res.json({
      ok: true,
      message:
        "Treba authentication columns are ready",
    });
  } catch (error) {
    console.error(
      "AUTH DATABASE SETUP ERROR:",
      error
    );

    res.status(500).json({
      ok: false,
      message:
        "Failed to prepare authentication database",
      error: error.message,
    });
  }
});

/*
 * =========================================================
 * JWT HELPERS
 * =========================================================
 */

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      app_role: user.app_role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

function getTokenFromRequest(req) {
  const authHeader =
    req.headers.authorization;

  if (
    !authHeader ||
    !authHeader.startsWith("Bearer ")
  ) {
    return null;
  }

  return authHeader.substring(7);
}

function authenticateToken(req, res, next) {
  const token =
    getTokenFromRequest(req);

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "Authentication required",
    });
  }

  try {
    const decoded =
      jwt.verify(token, JWT_SECRET);

    req.auth = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      ok: false,
      message: "Invalid or expired session",
    });
  }
}

/*
 * =========================================================
 * AUTH REGISTER
 * =========================================================
 */

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        email,
        password,
        full_name,
        phone,
        app_role,
      } = req.body;

      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      const cleanName =
        String(full_name || "").trim();

      const cleanPhone =
        String(phone || "").trim();

      const role =
        app_role === "driver"
          ? "driver"
          : "passenger";

      /*
       * Validation
       */

      if (!cleanEmail) {
        return res.status(400).json({
          ok: false,
          message:
            "Email address is required",
        });
      }

      if (!password) {
        return res.status(400).json({
          ok: false,
          message:
            "Password is required",
        });
      }

      if (password.length < 8) {
        return res.status(400).json({
          ok: false,
          message:
            "Password must be at least 8 characters",
        });
      }

      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          message:
            "Full name is required",
        });
      }

      /*
       * Check existing account.
       */

      const existing =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [cleanEmail]
        );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          ok: false,
          message:
            "An account with this email already exists",
        });
      }

      /*
       * Hash password.
       */

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      /*
       * Create user.
       *
       * Email verification is initially false.
       * We can add real email OTP verification
       * after the basic authentication flow works.
       */

      const result =
        await pool.query(
          `
          INSERT INTO users (
            role,
            app_role,
            full_name,
            phone,
            email,
            account_status,
            profile_completion,
            password_hash,
            email_verified
          )
          VALUES (
            'user',
            $1,
            $2,
            $3,
            $4,
            'active',
            false,
            $5,
            false
          )
          RETURNING
            id,
            role,
            app_role,
            full_name,
            phone,
            email,
            account_status,
            profile_completion,
            email_verified,
            created_at
          `,
          [
            role,
            cleanName,
            cleanPhone || null,
            cleanEmail,
            passwordHash,
          ]
        );

      const user =
        result.rows[0];

      /*
       * Create passenger profile
       * immediately for passengers.
       */

      if (role === "passenger") {
        await pool.query(
          `
          INSERT INTO passenger_profiles (
            user_id,
            full_name,
            phone,
            email
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            user.id,
            cleanName,
            cleanPhone,
            cleanEmail,
          ]
        );
      }

      /*
       * Driver profile will be created
       * when driver onboarding is completed.
       */

      const token =
        createToken(user);

      res.status(201).json({
        ok: true,
        message:
          "Account created successfully",
        token,
        user,
      });
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "Failed to create account",
        error: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * AUTH LOGIN
 * =========================================================
 */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
      } = req.body;

      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      if (!cleanEmail || !password) {
        return res.status(400).json({
          ok: false,
          message:
            "Email and password are required",
        });
      }

      /*
       * Find account.
       */

      const result =
        await pool.query(
          `
          SELECT
            id,
            role,
            app_role,
            full_name,
            phone,
            email,
            account_status,
            profile_completion,
            email_verified,
            password_hash,
            created_at
          FROM users
          WHERE LOWER(email) = LOWER($1)
          LIMIT 1
          `,
          [cleanEmail]
        );

      if (result.rows.length === 0) {
        return res.status(401).json({
          ok: false,
          message:
            "Invalid email or password",
        });
      }

      const user =
        result.rows[0];

      /*
       * Account status.
       */

      if (
        user.account_status !==
        "active"
      ) {
        return res.status(403).json({
          ok: false,
          message:
            "Your account is not active",
        });
      }

      /*
       * Password.
       */

      if (!user.password_hash) {
        return res.status(401).json({
          ok: false,
          message:
            "This account does not have a password login configured",
        });
      }

      const passwordMatches =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!passwordMatches) {
        return res.status(401).json({
          ok: false,
          message:
            "Invalid email or password",
        });
      }

      /*
       * Update login timestamp.
       */

      await pool.query(
        `
        UPDATE users
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [user.id]
      );

      /*
       * Remove password hash
       * from returned user.
       */

      delete user.password_hash;

      const token =
        createToken(user);

      res.json({
        ok: true,
        message:
          "Login successful",
        token,
        user,
      });
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "Login failed",
        error: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * AUTH ME
 * =========================================================
 */

app.get(
  "/api/auth/me",
  authenticateToken,
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            id,
            role,
            app_role,
            full_name,
            phone,
            email,
            account_status,
            profile_completion,
            email_verified,
            created_at,
            updated_at
          FROM users
          WHERE id = $1
          LIMIT 1
          `,
          [req.auth.id]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "User account not found",
        });
      }

      res.json({
        ok: true,
        user: result.rows[0],
      });
    } catch (error) {
      console.error(
        "AUTH ME ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "Failed to load authenticated user",
        error: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * AUTH LOGOUT
 *
 * JWT logout is handled client-side by
 * removing the token.
 * =========================================================
 */

app.post(
  "/api/auth/logout",
  authenticateToken,
  async (req, res) => {
    res.json({
      ok: true,
      message: "Logged out successfully",
    });
  }
);

/*
 * =========================================================
 * GET PASSENGER PROFILE
 * =========================================================
 */

app.get(
  "/api/passengers/:userId",
  async (req, res) => {
    try {
      const {
        userId,
      } = req.params;

      const result =
        await pool.query(
          `
          SELECT *
          FROM passenger_profiles
          WHERE user_id = $1
          LIMIT 1
          `,
          [userId]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          error:
            "Passenger profile not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error(
        "GET PASSENGER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load passenger profile",
        details: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * CREATE PASSENGER PROFILE
 * =========================================================
 */

app.post(
  "/api/passengers",
  async (req, res) => {
    try {
      const {
        user_id,
        full_name,
        phone,
        email,
        profile_photo_url,
        preferred_contact_method,
        emergency_contact_name,
        emergency_contact_phone,
        payment_methods,
      } = req.body;

      if (
        !user_id ||
        !full_name ||
        !phone
      ) {
        return res.status(400).json({
          error:
            "user_id, full_name and phone are required",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO passenger_profiles (
            user_id,
            full_name,
            phone,
            email,
            profile_photo_url,
            preferred_contact_method,
            emergency_contact_name,
            emergency_contact_phone,
            payment_methods
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9
          )
          RETURNING *
          `,
          [
            user_id,
            full_name,
            phone,
            email || null,
            profile_photo_url ||
              null,
            preferred_contact_method ||
              null,
            emergency_contact_name ||
              null,
            emergency_contact_phone ||
              null,
            payment_methods || [],
          ]
        );

      res.status(201).json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "CREATE PASSENGER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to create passenger profile",
        details: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * UPDATE PASSENGER PROFILE
 * =========================================================
 */

app.put(
  "/api/passengers/:id",
  async (req, res) => {
    try {
      const {
        id,
      } = req.params;

      const {
        full_name,
        phone,
        email,
        profile_photo_url,
        preferred_contact_method,
        emergency_contact_name,
        emergency_contact_phone,
        payment_methods,
      } = req.body;

      const result =
        await pool.query(
          `
          UPDATE passenger_profiles
          SET
            full_name = COALESCE($1, full_name),
            phone = COALESCE($2, phone),
            email = COALESCE($3, email),
            profile_photo_url = COALESCE($4, profile_photo_url),
            preferred_contact_method = COALESCE($5, preferred_contact_method),
            emergency_contact_name = COALESCE($6, emergency_contact_name),
            emergency_contact_phone = COALESCE($7, emergency_contact_phone),
            payment_methods = COALESCE($8, payment_methods),
            updated_at = NOW()
          WHERE id = $9
          RETURNING *
          `,
          [
            full_name,
            phone,
            email,
            profile_photo_url,
            preferred_contact_method,
            emergency_contact_name,
            emergency_contact_phone,
            payment_methods,
            id,
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          error:
            "Passenger profile not found",
        });
      }

      res.json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "UPDATE PASSENGER ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to update passenger profile",
        details: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * TREBA ANALYZER AGENT
 * =========================================================
 */

app.get(
  "/api/agents/analyzer",
  async (req, res) => {
    try {
      const result =
        await testAnalyzerAgent();

      res.json(result);
    } catch (error) {
      console.error(
        "TREBA ANALYZER ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "Treba-Analyzer connection failed",
      });
    }
  }
);

/*
 * =========================================================
 * FOUNDRY AGENT
 * =========================================================
 */

app.post("/api/agent", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        ok: false,
        message: "message is required",
      });
    }

    const response = await openai.responses.create({
      model: process.env.FOUNDRY_MODEL_DEPLOYMENT,
      input: message,
    });

    res.json({
      ok: true,
      response: response.output_text,
    });
  } catch (error) {
    console.error("FOUNDRY AGENT ERROR:", error);

    res.status(500).json({
      ok: false,
      message: "Agent request failed",
    });
  }
});

/*
 * =========================================================
 * START SERVER
 * =========================================================
 */

app.listen(
  PORT,
  () => {
    console.log(
      `Treba API running on http://localhost:${PORT}`
    );
  }
);

