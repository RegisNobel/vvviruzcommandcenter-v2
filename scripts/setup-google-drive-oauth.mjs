import http from "node:http";
import {randomBytes} from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const DEFAULT_PORT = 53682;
const DEFAULT_SCOPE = "https://www.googleapis.com/auth/drive";

function readArg(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));

  if (exact) {
    return exact.slice(name.length + 1);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function requireValue(name, value) {
  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function makeHtml(title, body) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        background: #101113;
        color: #f4efe1;
        font-family: ui-sans-serif, system-ui, sans-serif;
        margin: 0;
        padding: 48px;
      }
      main {
        border: 1px solid #343840;
        border-radius: 24px;
        margin: 0 auto;
        max-width: 720px;
        padding: 32px;
      }
      code {
        color: #e0b94f;
      }
    </style>
  </head>
  <body>
    <main>${body}</main>
  </body>
</html>`;
}

async function exchangeCodeForToken({clientId, clientSecret, code, redirectUri}) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  const payload = await response.json();

  if (!response.ok || !payload.refresh_token) {
    const message =
      payload.error_description ||
      payload.error ||
      "Google did not return a refresh token. Re-run with prompt=consent or revoke the app and try again.";
    throw new Error(message);
  }

  return payload;
}

async function main() {
  const port = Number(readArg("--port") || process.env.GOOGLE_DRIVE_OAUTH_PORT || DEFAULT_PORT);
  const redirectUri =
    readArg("--redirect-uri") ||
    process.env.GOOGLE_DRIVE_OAUTH_REDIRECT_URI ||
    `http://127.0.0.1:${port}/oauth2callback`;
  const redirectUrl = new URL(redirectUri);
  const clientId = requireValue(
    "GOOGLE_DRIVE_OAUTH_CLIENT_ID",
    readArg("--client-id") || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID
  );
  const clientSecret = requireValue(
    "GOOGLE_DRIVE_OAUTH_CLIENT_SECRET",
    readArg("--client-secret") || process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET
  );
  const scope = readArg("--scope") || process.env.GOOGLE_DRIVE_OAUTH_SCOPE || DEFAULT_SCOPE;
  const state = randomBytes(24).toString("hex");

  if (!["127.0.0.1", "localhost"].includes(redirectUrl.hostname)) {
    throw new Error("This helper only supports localhost or 127.0.0.1 redirect URIs.");
  }

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("include_granted_scopes", "true");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", scope);
  authUrl.searchParams.set("state", state);

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", redirectUri);

      if (requestUrl.pathname !== redirectUrl.pathname) {
        response.writeHead(404, {"Content-Type": "text/html; charset=utf-8"});
        response.end(makeHtml("Not found", "<h1>Not found</h1>"));
        return;
      }

      if (requestUrl.searchParams.get("state") !== state) {
        throw new Error("OAuth state mismatch. Start the setup again.");
      }

      const error = requestUrl.searchParams.get("error");
      if (error) {
        throw new Error(error);
      }

      const code = requireValue("OAuth code", requestUrl.searchParams.get("code") || "");
      const token = await exchangeCodeForToken({clientId, clientSecret, code, redirectUri});

      response.writeHead(200, {"Content-Type": "text/html; charset=utf-8"});
      response.end(
        makeHtml(
          "Google Drive OAuth complete",
          "<h1>Google Drive OAuth complete</h1><p>The refresh token is in your terminal. You can close this tab.</p>"
        )
      );

      console.log("\nGoogle Drive OAuth setup complete.");
      console.log("Store these as sensitive production Vercel environment variables:");
      console.log("GOOGLE_DRIVE_AUTH_MODE=oauth");
      console.log(`GOOGLE_DRIVE_OAUTH_CLIENT_ID=${clientId}`);
      console.log("GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=<the same client secret you used>");
      console.log(`GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=${token.refresh_token}`);
      console.log("GOOGLE_DRIVE_BACKUP_ENABLED=1");
      console.log("\nKeep the refresh token private. It grants Drive access for backups.");

      server.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "OAuth setup failed.";
      response.writeHead(500, {"Content-Type": "text/html; charset=utf-8"});
      response.end(makeHtml("Google Drive OAuth failed", `<h1>Setup failed</h1><p>${message}</p>`));
      console.error(`\nGoogle Drive OAuth setup failed: ${message}`);
      server.close();
    }
  });

  server.listen(port, redirectUrl.hostname, () => {
    console.log("Google Drive OAuth setup");
    console.log(`Listening on ${redirectUri}`);
    console.log("\nOpen this URL in your browser and approve access:");
    console.log(authUrl.toString());
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
