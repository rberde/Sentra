import { promises as fs } from "fs";
import { randomUUID } from "crypto";
import path from "path";

const PLAID_TOKEN_FILE = path.join(process.cwd(), ".pfre-plaid-token.json");
export const PLAID_SESSION_COOKIE = "pfre_plaid_session";

type PlaidTokenRecord = {
  accessToken: string;
  sessionToken: string;
  updatedAt: string;
};

export async function savePlaidAccessToken(accessToken: string): Promise<string> {
  const sessionToken = randomUUID();
  const record: PlaidTokenRecord = {
    accessToken,
    sessionToken,
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(PLAID_TOKEN_FILE, JSON.stringify(record), {
    encoding: "utf-8",
    mode: 0o600,
  });

  return sessionToken;
}

export async function readPlaidAccessToken(req: Request): Promise<string | null> {
  try {
    const raw = await fs.readFile(PLAID_TOKEN_FILE, "utf-8");
    const parsed = JSON.parse(raw) as Partial<PlaidTokenRecord>;
    const sessionCookie = readCookie(req, PLAID_SESSION_COOKIE);
    if (
      typeof parsed.accessToken === "string" &&
      parsed.accessToken.length > 0 &&
      typeof parsed.sessionToken === "string" &&
      parsed.sessionToken.length > 0 &&
      sessionCookie === parsed.sessionToken
    ) {
      return parsed.accessToken;
    }
  } catch {
    return null;
  }

  return null;
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}
