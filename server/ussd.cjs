const express = require("express");
const pool = require("./db.cjs");

const router = express.Router();

/*
=========================================================
TREBA USSD SERVICE
=========================================================

USSD code:
*1001#

Main menu:

1. Request a trip
2. My trips
3. Cancel trip
4. Help

The USSD service uses the existing Treba PostgreSQL
database.

USSD session data is stored in:
- ussd_sessions
- ussd_requests

Trip requests are stored in:
- trip_requests

=========================================================
*/

function normalizePhone(phone) {
  return String(phone || "")
    .replace(/\s+/g, "")
    .trim();
}

/*
=========================================================
FIND PASSENGER
=========================================================
*/

async function findPassengerByPhone(phone) {
  const result = await pool.query(
    `
    SELECT
      u.id,
      u.full_name,
      u.phone,
      u.email,
      u.account_status,
      pp.id AS passenger_profile_id
    FROM users u
    LEFT JOIN passenger_profiles pp
      ON pp.user_id = u.id
    WHERE REPLACE(u.phone, ' ', '') = REPLACE($1, ' ', '')
      AND (
        u.app_role = 'passenger'
        OR u.role = 'passenger'
      )
    LIMIT 1
    `,
    [phone]
  );

  return result.rows[0] || null;
}

/*
=========================================================
SAVE USSD SESSION
=========================================================
*/

async function saveSession({
  sessionId,
  phone,
  serviceCode,
  text,
  currentMenu,
  sessionData,
}) {
  await pool.query(
    `
    INSERT INTO ussd_sessions (
      session_id,
      phone,
      service_code,
      text,
      current_menu,
      session_data,
      status,
      expires_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6::jsonb,
      'active',
      NOW() + INTERVAL '10 minutes'
    )
    ON CONFLICT (session_id)
    DO UPDATE SET
      phone = EXCLUDED.phone,
      service_code = EXCLUDED.service_code,
      text = EXCLUDED.text,
      current_menu = EXCLUDED.current_menu,
      session_data = EXCLUDED.session_data,
      status = 'active',
      updated_at = NOW(),
      expires_at = NOW() + INTERVAL '10 minutes'
    `,
    [
      sessionId,
      phone,
      serviceCode,
      text,
      currentMenu,
      JSON.stringify(sessionData || {}),
    ]
  );
}

/*
=========================================================
SAVE USSD REQUEST
=========================================================
*/

async function saveUssdRequest({
  sessionId,
  phone,
  serviceCode,
  requestText,
  responseText,
  userId,
  status = "received",
}) {
  await pool.query(
    `
    INSERT INTO ussd_requests (
      session_id,
      phone,
      service_code,
      request_text,
      response_text,
      user_id,
      status
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7
    )
    `,
    [
      sessionId,
      phone,
      serviceCode,
      requestText,
      responseText,
      userId || null,
      status,
    ]
  );
}

/*
=========================================================
USSD RESPONSE HELPER
=========================================================
*/

async function sendUssdResponse({
  res,
  sessionId,
  phone,
  serviceCode,
  input,
  response,
  userId,
  currentMenu,
  sessionData,
  status = "received",
}) {
  try {
    await saveSession({
      sessionId,
      phone,
      serviceCode,
      text: input,
      currentMenu,
      sessionData,
    });

    await saveUssdRequest({
      sessionId,
      phone,
      serviceCode,
      requestText: input,
      responseText: response,
      userId,
      status,
    });
  } catch (error) {
    console.error("USSD LOGGING ERROR:", error.message);
  }

  return res.type("text/plain").send(response);
}

/*
=========================================================
MAIN USSD ENDPOINT
=========================================================

Expected telecom fields:

sessionId
serviceCode
phoneNumber
text

=========================================================
*/

router.post("/ussd", async (req, res) => {
  const sessionId =
    req.body.sessionId ||
    req.body.sessionID ||
    `local-${Date.now()}`;

  const serviceCode =
    req.body.serviceCode ||
    "*1001#";

  const phone = normalizePhone(
    req.body.phoneNumber ||
    req.body.phone ||
    ""
  );

  const input = String(
    req.body.text || ""
  ).trim();

  try {
    /*
    -----------------------------------------------------
    MAIN MENU
    -----------------------------------------------------
    */

    if (!input) {
      return sendUssdResponse({
        res,
        sessionId,
        phone,
        serviceCode,
        input,
        currentMenu: "main",
        sessionData: {},
        response:
`CON Welcome to Treba

1. Request a trip
2. My trips
3. Cancel trip
4. Help`,
      });
    }

    /*
    -----------------------------------------------------
    SPLIT USER INPUT
    -----------------------------------------------------
    */

    const parts = input.split("*");

    /*
    =====================================================
    OPTION 1 - REQUEST A TRIP
    =====================================================
    */

    if (parts[0] === "1") {

      /*
      -----------------------------------------------
      STEP 1
      -----------------------------------------------
      */

      if (parts.length === 1) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "request_trip_from",
          sessionData: {
            action: "request_trip",
          },
          response:
`CON Request a trip

Enter departure town:`,
        });
      }

      /*
      -----------------------------------------------
      STEP 2
      Destination
      -----------------------------------------------
      */

      if (parts.length === 2) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "request_trip_to",
          sessionData: {
            action: "request_trip",
            origin: parts[1],
          },
          response:
`CON From: ${parts[1]}

Enter destination town:`,
        });
      }

      /*
      -----------------------------------------------
      STEP 3
      Travel date
      -----------------------------------------------
      */

      if (parts.length === 3) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "request_trip_date",
          sessionData: {
            action: "request_trip",
            origin: parts[1],
            destination: parts[2],
          },
          response:
`CON From: ${parts[1]}
To: ${parts[2]}

Enter travel date:

YYYY-MM-DD`,
        });
      }

      /*
      -----------------------------------------------
      STEP 4
      Departure time
      -----------------------------------------------
      */

      if (parts.length === 4) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "request_trip_time",
          sessionData: {
            action: "request_trip",
            origin: parts[1],
            destination: parts[2],
            travel_date: parts[3],
          },
          response:
`CON From: ${parts[1]}
To: ${parts[2]}
Date: ${parts[3]}

Enter preferred departure time:

HH:MM`,
        });
      }

      /*
      -----------------------------------------------
      STEP 5
      Number of seats
      -----------------------------------------------
      */

      if (parts.length === 5) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "request_trip_seats",
          sessionData: {
            action: "request_trip",
            origin: parts[1],
            destination: parts[2],
            travel_date: parts[3],
            departure_time: parts[4],
          },
          response:
`CON From: ${parts[1]}
To: ${parts[2]}
Date: ${parts[3]}
Time: ${parts[4]}

Number of seats:`,
        });
      }

      /*
      -----------------------------------------------
      STEP 6
      CREATE TRIP REQUEST
      -----------------------------------------------
      */

      if (parts.length === 6) {
        const passenger =
          await findPassengerByPhone(phone);

        if (!passenger) {
          return sendUssdResponse({
            res,
            sessionId,
            phone,
            serviceCode,
            input,
            currentMenu: "registration_required",
            sessionData: {},
            response:
`END This mobile number is not registered with Treba.

Please register through the Treba app first.`,
            status: "completed",
          });
        }

        const origin = parts[1];
        const destination = parts[2];
        const travelDate = parts[3];
        const departureTime = parts[4];
        const seats = Number(parts[5]);

        /*
        Validate seats
        */

        if (
          !Number.isInteger(seats) ||
          seats < 1 ||
          seats > 10
        ) {
          return sendUssdResponse({
            res,
            sessionId,
            phone,
            serviceCode,
            input,
            currentMenu: "request_trip_seats",
            sessionData: {
              action: "request_trip",
            },
            response:
`END Invalid number of seats.

Please try again.`,
            status: "completed",
          });
        }

        /*
        Validate date
        */

        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(
            travelDate
          )
        ) {
          return sendUssdResponse({
            res,
            sessionId,
            phone,
            serviceCode,
            input,
            currentMenu: "request_trip_date",
            sessionData: {},
            response:
`END Invalid travel date.

Please use YYYY-MM-DD.`,
            status: "completed",
          });
        }

        /*
        Validate time
        */

        if (
          !/^\d{2}:\d{2}$/.test(
            departureTime
          )
        ) {
          return sendUssdResponse({
            res,
            sessionId,
            phone,
            serviceCode,
            input,
            currentMenu: "request_trip_time",
            sessionData: {},
            response:
`END Invalid departure time.

Please use HH:MM.`,
            status: "completed",
          });
        }

        /*
        Find matching Treba route
        */

        const routeResult =
          await pool.query(
            `
            SELECT
              id,
              route_code,
              origin_town,
              destination_town
            FROM routes
            WHERE LOWER(origin_town) = LOWER($1)
              AND LOWER(destination_town) = LOWER($2)
              AND active = true
            LIMIT 1
            `,
            [
              origin,
              destination,
            ]
          );

        const route =
          routeResult.rows[0] || null;

        /*
        Create trip request
        */

        const tripResult =
          await pool.query(
            `
            INSERT INTO trip_requests (
              passenger_id,
              passenger_name,
              route_id,
              origin,
              destination,
              travel_date,
              preferred_departure_time,
              number_of_seats,
              status,
              payment_status
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
              'pending',
              'pending'
            )
            RETURNING id
            `,
            [
              passenger.id,
              passenger.full_name,
              route?.id || null,
              origin,
              destination,
              travelDate,
              departureTime,
              seats,
            ]
          );

        const tripId =
          tripResult.rows[0].id;

        /*
        Log completed USSD request
        */

        const response =
`END Treba trip request received.

${origin} to ${destination}
Date: ${travelDate}
Time: ${departureTime}
Seats: ${seats}

Your request is being matched with available drivers.`;

        await sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          userId: passenger.id,
          currentMenu: "completed",
          sessionData: {
            action: "request_trip",
            trip_request_id: tripId,
          },
          response,
          status: "completed",
        });

        return;
      }
    }

    /*
    =====================================================
    OPTION 2 - MY TRIPS
    =====================================================
    */

    if (parts[0] === "2") {

      const passenger =
        await findPassengerByPhone(phone);

      if (!passenger) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          currentMenu: "registration_required",
          sessionData: {},
          response:
`END Your mobile number is not registered with Treba.

Please register through the Treba app first.`,
          status: "completed",
        });
      }

      const trips =
        await pool.query(
          `
          SELECT
            id,
            origin,
            destination,
            travel_date,
            preferred_departure_time,
            status
          FROM trip_requests
          WHERE passenger_id = $1
          ORDER BY created_at DESC
          LIMIT 3
          `,
          [passenger.id]
        );

      if (trips.rows.length === 0) {
        return sendUssdResponse({
          res,
          sessionId,
          phone,
          serviceCode,
          input,
          userId: passenger.id,
          currentMenu: "my_trips",
          sessionData: {},
          response:
`END You have no recent Treba trip requests.`,
          status: "completed",
        });
      }

      let message =
        "END Your recent Treba trips:\n";

      trips.rows.forEach(
        (trip, index) => {
          message +=
            `${index + 1}. ${trip.origin} to ${trip.destination} - ${trip.status}\n`;
        }
      );

      return sendUssdResponse({
        res,
        sessionId,
        phone,
        serviceCode,
        input,
        userId: passenger.id,
        currentMenu: "my_trips",
        sessionData: {},
        response: message,
        status: "completed",
      });
    }

    /*
    =====================================================
    OPTION 3 - CANCEL TRIP
    =====================================================
    */

    if (parts[0] === "3") {

      return sendUssdResponse({
        res,
        sessionId,
        phone,
        serviceCode,
        input,
        currentMenu: "cancel_trip",
        sessionData: {
          action: "cancel_trip",
        },
        response:
`END Trip cancellation through USSD will be available shortly.

Please use the Treba app to cancel your trip.`,
        status: "completed",
      });
    }

    /*
    =====================================================
    OPTION 4 - HELP
    =====================================================
    */

    if (parts[0] === "4") {

      return sendUssdResponse({
        res,
        sessionId,
        phone,
        serviceCode,
        input,
        currentMenu: "help",
        sessionData: {},
        response:
`END Treba Help

Request trips using *1001#.

For assistance with trips, payments or your account, contact Treba support.`,
        status: "completed",
      });
    }

    /*
    =====================================================
    INVALID OPTION
    =====================================================
    */

    return sendUssdResponse({
      res,
      sessionId,
      phone,
      serviceCode,
      input,
      currentMenu: "invalid",
      sessionData: {},
      response:
`END Invalid Treba selection.

Please dial *1001# again.`,
      status: "completed",
    });

  } catch (error) {

    console.error(
      "USSD ERROR:",
      error
    );

    return res
      .type("text/plain")
      .send(
        `END Treba is temporarily unavailable. Please try again later.`
      );
  }
});

/*
=========================================================
HEALTH CHECK
=========================================================
*/

router.get(
  "/ussd/health",
  async (req, res) => {
    try {
      await pool.query(
        "SELECT 1"
      );

      res.json({
        ok: true,
        service: "Treba USSD",
        database: "connected",
      });

    } catch (error) {

      res.status(500).json({
        ok: false,
        service: "Treba USSD",
        database: "error",
        error: error.message,
      });
    }
  }
);

module.exports = router;