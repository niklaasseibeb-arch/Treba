const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const {
  initializeApp,
  getApps,
  cert,
} = require("firebase-admin/app");

const {
  getAuth: getFirebaseAuth,
} = require("firebase-admin/auth");
require("dotenv").config();

const pool = require("./db.cjs");
const { registerDriverOnboardingRoutes, ensureDriverOnboardingSchema } = require("./driver-onboarding.cjs");
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


function getFirebaseAdminAuth() {
  if (!getApps().length) {
    const serviceAccountJson =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    const projectId =
      process.env.FIREBASE_PROJECT_ID;

    const clientEmail =
      process.env.FIREBASE_CLIENT_EMAIL;

    const privateKey =
      process.env.FIREBASE_PRIVATE_KEY;

    if (serviceAccountJson) {
      let serviceAccount;

      try {
        serviceAccount =
          JSON.parse(serviceAccountJson);
      } catch (error) {
        throw new Error(
          "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"
        );
      }

      initializeApp({
        credential: cert(serviceAccount),
      });
    } else if (
      projectId &&
      clientEmail &&
      privateKey
    ) {
      initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, "\n"),
        }),
      });
    } else {
      initializeApp({});
    }
  }

  return getFirebaseAuth();
}

async function verifyFirebaseIdToken(idToken) {
  if (!idToken) {
    throw new Error("Firebase ID token is required");
  }

  const auth = getFirebaseAdminAuth();

  return auth.verifyIdToken(idToken);
}

function normalizePhone(rawPhone) {
  let value = String(rawPhone || "")
    .trim()
    .replace(/[\s\-().]/g, "");

  if (!value) {
    return "";
  }

  if (value.startsWith("00")) {
    value = "+" + value.slice(2);
  }

  if (/^0\d{9}$/.test(value)) {
    return "+264" + value.slice(1);
  }

  if (/^264\d{9}$/.test(value)) {
    return "+" + value;
  }

  if (/^\+264\d{9}$/.test(value)) {
    return value;
  }

  return value;
}

function phoneCandidates(rawPhone) {
  const raw = String(rawPhone || "")
    .trim();

  const normalized = normalizePhone(raw);

  return [
    ...new Set(
      [raw, normalized]
        .filter(Boolean)
    ),
  ];
}

function validateAuthPassword(password) {
  const value = String(password || "");

  if (value.length < 6 || value.length > 30) {
    return "Password must be between 6 and 30 characters";
  }

  if (!/[A-Za-z]/.test(value)) {
    return "Password must contain at least one letter";
  }

  if (!/\d/.test(value)) {
    return "Password must contain at least one number";
  }

  return null;
}

function internalPhoneEmail(phone) {
  const digits = String(phone || "")
    .replace(/\D/g, "");

  return `treba+${digits}@phone.treba.local`;
}

function isDevPhoneBypassEnabled() {
  return String(
    process.env.DEV_BYPASS_PHONE_VERIFICATION || ""
  ).toLowerCase() === "true";
}

async function verifyPhoneIdentity({
  phone,
  firebaseIdToken,
}) {
  const cleanPhone = normalizePhone(phone);

  if (!cleanPhone) {
    throw new Error("Valid phone number is required");
  }

  if (isDevPhoneBypassEnabled()) {
    return {
      uid: null,
      phone_number: cleanPhone,
      verified: false,
    };
  }

  if (!firebaseIdToken) {
    const error = new Error(
      "Firebase phone verification is required"
    );

    error.code = "FIREBASE_ID_TOKEN_REQUIRED";
    throw error;
  }

  const decoded =
    await verifyFirebaseIdToken(firebaseIdToken);

  const firebasePhone =
    normalizePhone(decoded.phone_number);

  if (!firebasePhone) {
    const error = new Error(
      "Firebase identity does not contain a verified phone number"
    );

    error.code = "FIREBASE_PHONE_MISSING";
    throw error;
  }

  if (firebasePhone !== cleanPhone) {
    const error = new Error(
      "Verified Firebase phone number does not match the supplied phone number"
    );

    error.code = "FIREBASE_PHONE_MISMATCH";
    throw error;
  }

  return {
    uid: decoded.uid,
    phone_number: firebasePhone,
    verified: true,
    decoded,
  };
}

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
 * AUTH REGISTER â€” V1
 * =========================================================
 *
 * Public signup supports passenger/driver only.
 *
 * Required:
 *   full_name
 *   phone
 *   password
 *   confirm_password
 *   app_role
 *   firebase_id_token
 *
 * Firebase verifies the phone identity.
 * Treba remains authoritative for password, role,
 * account state and Treba JWT session.
 */

app.post(
  "/api/auth/register",
  async (req, res) => {
    try {
      const {
        full_name,
        phone,
        password,
        confirm_password,
        app_role,
        firebase_id_token,
      } = req.body;

      const cleanName =
        String(full_name || "").trim();

      const cleanPhone =
        normalizePhone(phone);

      const role =
        app_role === "driver"
          ? "driver"
          : app_role === "passenger"
            ? "passenger"
            : null;

      if (!cleanName) {
        return res.status(400).json({
          ok: false,
          message: "Full name is required",
        });
      }

      if (!cleanPhone) {
        return res.status(400).json({
          ok: false,
          message: "Phone number is required",
        });
      }

      if (!role) {
        return res.status(400).json({
          ok: false,
          message:
            "Account type must be passenger or driver",
        });
      }

      if (!password) {
        return res.status(400).json({
          ok: false,
          message: "Password is required",
        });
      }

      const passwordError =
        validateAuthPassword(password);

      if (passwordError) {
        return res.status(400).json({
          ok: false,
          message: passwordError,
        });
      }

      if (
        String(confirm_password || "") !==
        String(password)
      ) {
        return res.status(400).json({
          ok: false,
          message: "Passwords do not match",
        });
      }

      const identity =
        await verifyPhoneIdentity({
          phone: cleanPhone,
          firebaseIdToken:
            firebase_id_token,
        });

      const candidates =
        phoneCandidates(cleanPhone);

      const existing =
        await pool.query(
          `
          SELECT
            id,
            firebase_uid,
            phone,
            account_status
          FROM users
          WHERE phone = ANY($1::text[])
             OR (
               $2::text IS NOT NULL
               AND firebase_uid = $2::text
             )
          LIMIT 1
          `,
          [
            candidates,
            identity.uid,
          ]
        );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          ok: false,
          message:
            "An account with this phone number already exists",
          code: "PHONE_ALREADY_REGISTERED",
        });
      }

      const passwordHash =
        await bcrypt.hash(password, 12);

      const internalEmail =
        internalPhoneEmail(cleanPhone);

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
            email_verified,
            firebase_uid,
            phone_verified_at
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
            false,
            $6,
            $7
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
            firebase_uid,
            phone_verified_at,
            created_at
          `,
          [
            role,
            cleanName,
            cleanPhone,
            internalEmail,
            passwordHash,
            identity.uid,
            identity.verified
              ? new Date()
              : null,
          ]
        );

      const user =
        result.rows[0];

      /*
       * Passenger profile is created immediately.
       * Driver operational profile remains under
       * Driver V1 onboarding.
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
            internalEmail,
          ]
        );
      }

      const token =
        createToken(user);

      const responseUser = {
        ...user,
      };

      delete responseUser.firebase_uid;

      res.status(201).json({
        ok: true,
        message:
          "Account created successfully",
        token,
        user: responseUser,
      });
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error
      );

      if (
        error.code ===
        "FIREBASE_ID_TOKEN_REQUIRED"
      ) {
        return res.status(401).json({
          ok: false,
          message:
            "Phone verification is required before account creation",
          code: error.code,
        });
      }

      if (
        error.code ===
          "FIREBASE_PHONE_MISSING" ||
        error.code ===
          "FIREBASE_PHONE_MISMATCH"
      ) {
        return res.status(401).json({
          ok: false,
          message: error.message,
          code: error.code,
        });
      }

      if (
        error.code ===
        "auth/id-token-expired"
      ) {
        return res.status(401).json({
          ok: false,
          message:
            "Firebase verification has expired. Please verify your phone again.",
          code: error.code,
        });
      }

      if (
        error.code ===
        "auth/invalid-id-token"
      ) {
        return res.status(401).json({
          ok: false,
          message:
            "Invalid Firebase verification",
          code: error.code,
        });
      }

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
 * AUTH LOGIN â€” V1
 * =========================================================
 *
 * Normal login uses:
 *   phone + password
 *
 * Firebase SMS is NOT required for every login.
 */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        phone,
        password,
      } = req.body;

      const cleanPhone =
        normalizePhone(phone);

      if (!cleanPhone || !password) {
        return res.status(400).json({
          ok: false,
          message:
            "Phone number and password are required",
        });
      }

      const candidates =
        phoneCandidates(cleanPhone);

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
            firebase_uid,
            phone_verified_at,
            password_hash,
            created_at
          FROM users
          WHERE phone = ANY($1::text[])
          LIMIT 1
          `,
          [candidates]
        );

      if (result.rows.length === 0) {
        return res.status(401).json({
          ok: false,
          message:
            "Invalid phone number or password",
        });
      }

      const user =
        result.rows[0];

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
            "Invalid phone number or password",
        });
      }

      await pool.query(
        `
        UPDATE users
        SET
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [user.id]
      );

      delete user.password_hash;

      const token =
        createToken(user);

      res.json({
        ok: true,
        message: "Login successful",
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
        message: "Login failed",
        error: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * AUTH GOOGLE â€” V1
 * =========================================================
 *
 * Google authentication is identity verification only.
 *
 * A new Google identity is NOT automatically assigned
 * passenger/driver/admin access.
 *
 * The Google identity must already be linked to a
 * Treba user account.
 */

app.post(
  "/api/auth/google",
  async (req, res) => {
    try {
      const {
        firebase_id_token,
      } = req.body;

      if (!firebase_id_token) {
        return res.status(401).json({
          ok: false,
          message:
            "Firebase Google ID token is required",
        });
      }

      const decoded =
        await verifyFirebaseIdToken(
          firebase_id_token
        );

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
            firebase_uid,
            phone_verified_at,
            created_at
          FROM users
          WHERE firebase_uid = $1
          LIMIT 1
          `,
          [decoded.uid]
        );

      if (result.rows.length === 0) {
        return res.status(409).json({
          ok: false,
          message:
            "This Google account is not linked to a Treba account",
          code:
            "GOOGLE_ACCOUNT_NOT_LINKED",
        });
      }

      const user =
        result.rows[0];

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

      await pool.query(
        `
        UPDATE users
        SET
          last_login_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        `,
        [user.id]
      );

      const token =
        createToken(user);

      delete user.firebase_uid;

      res.json({
        ok: true,
        message:
          "Google login successful",
        token,
        user,
      });
    } catch (error) {
      console.error(
        "GOOGLE AUTH ERROR:",
        error
      );

      res.status(401).json({
        ok: false,
        message:
          "Google authentication failed",
        error: error.message,
      });
    }
  }
);

/*
 * =========================================================
 * AUTH PASSWORD FORGOT â€” V1
 * =========================================================
 *
 * Firebase Client SDK performs the phone SMS verification.
 * This endpoint intentionally returns a generic response
 * so account existence is not exposed.
 */

app.post(
  "/api/auth/password/forgot",
  async (req, res) => {
    const cleanPhone =
      normalizePhone(req.body?.phone);

    res.json({
      ok: true,
      message:
        "If an account exists for this phone number, continue with Firebase phone verification to reset the password.",
      phone:
        cleanPhone || null,
    });
  }
);

/*
 * =========================================================
 * AUTH PASSWORD RESET â€” V1
 * =========================================================
 *
 * Client verifies the SMS code with Firebase and sends
 * the resulting Firebase ID token here.
 */

app.post(
  "/api/auth/password/reset",
  async (req, res) => {
    try {
      const {
        phone,
        password,
        confirm_password,
        firebase_id_token,
      } = req.body;

      const cleanPhone =
        normalizePhone(phone);

      if (!cleanPhone) {
        return res.status(400).json({
          ok: false,
          message: "Phone number is required",
        });
      }

      const passwordError =
        validateAuthPassword(password);

      if (passwordError) {
        return res.status(400).json({
          ok: false,
          message: passwordError,
        });
      }

      if (
        String(confirm_password || "") !==
        String(password || "")
      ) {
        return res.status(400).json({
          ok: false,
          message: "Passwords do not match",
        });
      }

      const identity =
        isDevPhoneBypassEnabled()
          ? {
              uid: null,
              phone_number: cleanPhone,
              verified: false,
            }
          : await verifyPhoneIdentity({
              phone: cleanPhone,
              firebaseIdToken:
                firebase_id_token,
            });

      const candidates =
        phoneCandidates(cleanPhone);

      const result =
        await pool.query(
          `
          SELECT
            id,
            firebase_uid,
            phone,
            account_status
          FROM users
          WHERE phone = ANY($1::text[])
          LIMIT 1
          `,
          [candidates]
        );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "Account not found",
        });
      }

      const user =
        result.rows[0];

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

      if (
        identity.uid &&
        user.firebase_uid &&
        user.firebase_uid !== identity.uid
      ) {
        return res.status(401).json({
          ok: false,
          message:
            "Firebase identity does not match the Treba account",
        });
      }

      const passwordHash =
        await bcrypt.hash(password, 12);

      await pool.query(
        `
        UPDATE users
        SET
          password_hash = $1,
          firebase_uid =
            CASE
              WHEN firebase_uid IS NULL
                AND $2::text IS NOT NULL
              THEN $2::text
              ELSE firebase_uid
            END,
          phone_verified_at =
            CASE
              WHEN $3::boolean = true
              THEN NOW()
              ELSE phone_verified_at
            END,
          updated_at = NOW()
        WHERE id = $4
        `,
        [
          passwordHash,
          identity.uid,
          identity.verified,
          user.id,
        ]
      );

      res.json({
        ok: true,
        message:
          "Password reset successful",
      });
    } catch (error) {
      console.error(
        "PASSWORD RESET ERROR:",
        error
      );

      res.status(401).json({
        ok: false,
        message:
          "Password reset verification failed",
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

registerDriverOnboardingRoutes(app, pool, authenticateToken);
app.listen(
  PORT,
  () => {
    console.log(
      `Treba API running on http://localhost:${PORT}`
    );
  }
);



