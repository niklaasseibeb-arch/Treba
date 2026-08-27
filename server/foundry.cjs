const { AIProjectClient } = require("@azure/ai-projects");
const { DefaultAzureCredential } = require("@azure/identity");
require("dotenv").config();

const PROJECT_ENDPOINT = process.env.FOUNDRY_PROJECT_ENDPOINT;

if (!PROJECT_ENDPOINT) {
  throw new Error(
    "FOUNDRY_PROJECT_ENDPOINT is not configured in .env"
  );
}

const credential = new DefaultAzureCredential();

const project = new AIProjectClient(
  PROJECT_ENDPOINT,
  credential
);

const ANALYZER_AGENT = "Treba-Analyzer";
const ANALYZER_VERSION = "4";

/*
 * =========================================================
 * GET ANALYZER
 * =========================================================
 */

async function getAnalyzer() {
  return await project.agents.get(
    ANALYZER_AGENT
  );
}

/*
 * =========================================================
 * TEST FOUNDRY CONNECTION
 * =========================================================
 */

async function testFoundryConnection() {
  const agent = await getAnalyzer();

  return {
    ok: true,
    message: "Treba Foundry connection OK",
    agent: {
      id: agent.id,
      name: agent.name,
      version: ANALYZER_VERSION,
    },
  };
}

/*
 * =========================================================
 * TEST ANALYZER AGENT
 * =========================================================
 */

async function testAnalyzerAgent() {
  const agent = await getAnalyzer();

  return {
    ok: true,
    message: "Treba-Analyzer agent connection OK",
    agent: {
      id: agent.id,
      name: agent.name,
      version: ANALYZER_VERSION,
    },
  };
}

/*
 * =========================================================
 * CREATE ANALYZER SESSION
 * =========================================================
 */

async function createAnalyzerSession() {
  return await project.agents.createSession(
    ANALYZER_AGENT,
    {
      type: "version_ref",
      agent_version: ANALYZER_VERSION,
    }
  );
}

/*
 * =========================================================
 * TEST ANALYZER SESSION
 * =========================================================
 */

async function testAnalyzerSession() {
  const session =
    await createAnalyzerSession();

  return {
    ok: true,
    message:
      "Treba-Analyzer session created successfully",
    session: {
      id: session.agent_session_id,
      status: session.status,
      versionIndicator:
        session.version_indicator,
    },
  };
}

/*
 * =========================================================
 * INVOKE ANALYZER
 *
 * Calls the Azure AI Foundry hosted-agent
 * Responses endpoint.
 * =========================================================
 */

async function invokeAnalyzer(
  input,
  sessionId = null
) {
  if (
    typeof input !== "string" ||
    !input.trim()
  ) {
    throw new Error(
      "Analyzer input is required"
    );
  }

  const token =
    await credential.getToken(
      "https://ai.azure.com/.default"
    );

  if (!token?.token) {
    throw new Error(
      "Failed to obtain Azure AI Foundry access token"
    );
  }

  const url =
    `${PROJECT_ENDPOINT}/agents/` +
    `${encodeURIComponent(ANALYZER_AGENT)}` +
    `/endpoint/protocols/openai/responses` +
    `?api-version=v1`;

  const body = {
    input: input.trim(),
  };

  if (sessionId) {
    body.agent_session_id = sessionId;
  }

  const response = await fetch(
    url,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${token.token}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const text =
    await response.text();

  if (!response.ok) {
    throw new Error(
      `Foundry Analyzer request failed ` +
      `(${response.status}): ${text}`
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      raw: text,
    };
  }
}

/*
 * =========================================================
 * RUN ANALYZER AGENT
 *
 * Creates a version-specific hosted-agent session
 * and then invokes Treba-Analyzer.
 * =========================================================
 */

async function runAnalyzerAgent(input) {
  if (
    typeof input !== "string" ||
    !input.trim()
  ) {
    throw new Error(
      "Analyzer input is required"
    );
  }

  const session =
    await createAnalyzerSession();

  const response =
    await invokeAnalyzer(
      input,
      session.agent_session_id
    );

  return {
    ok: true,
    agent: {
      id: ANALYZER_AGENT,
      version: ANALYZER_VERSION,
    },
    session: {
      id: session.agent_session_id,
      status: session.status,
    },
    response,
  };
}

/*
 * =========================================================
 * EXPORTS
 * =========================================================
 */

module.exports = {
  project,
  getAnalyzer,
  testFoundryConnection,
  testAnalyzerAgent,
  createAnalyzerSession,
  testAnalyzerSession,
  invokeAnalyzer,
  runAnalyzerAgent,
};