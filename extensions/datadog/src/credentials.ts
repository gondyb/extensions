import { execSync } from "child_process";
import { getPreferenceValues } from "@raycast/api";

export type Credentials = {
  apiKey: string;
  appKey: string;
  site: string;
};

export const siteFromDomain = (domain: string): string => {
  const d = domain.toLowerCase().trim();
  return d.startsWith("app.") ? d.slice(4) : d;
};

const parseEnvOutput = (output: string) => {
  const map: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match) map[match[1]] = match[2];
  }
  return map;
};

const runAuthCommand = (command: string): Record<string, string> => {
  const pathExt = `${process.env.PATH || ""}:/opt/homebrew/bin:/usr/local/bin`;
  const output = execSync(command, {
    encoding: "utf-8",
    timeout: 120_000,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PATH: pathExt },
    shell: "/bin/zsh",
  });
  return parseEnvOutput(output);
};

export const resolveCredentials = (): Credentials => {
  const prefs = getPreferenceValues();
  const method = prefs["auth-method"] || "api-keys";
  const domainSite = prefs.domain ? siteFromDomain(prefs.domain) : "";
  const legacySite = prefs.server || "";

  if (method === "command") {
    const command = (prefs["auth-command"] || "").trim();
    if (!command) {
      throw new Error(
        "Auth Command is empty. Set a command in Raycast preferences that prints DD_API_KEY=… and DD_APP_KEY=… on stdout.",
      );
    }
    let env: Record<string, string>;
    try {
      env = runAuthCommand(command);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Auth command failed: ${msg}`);
    }
    if (!env.DD_API_KEY || !env.DD_APP_KEY) {
      throw new Error("Auth command output did not contain DD_API_KEY and DD_APP_KEY.");
    }
    const site = env.DD_SITE || domainSite || legacySite;
    if (!site) {
      throw new Error(
        "No site could be determined. Set Domain in preferences or have the auth command output DD_SITE.",
      );
    }
    return { apiKey: env.DD_API_KEY, appKey: env.DD_APP_KEY, site };
  }

  if (!prefs["api-key"] || !prefs["app-key"]) {
    throw new Error("API Key and App Key are required when Authentication is 'API & App Keys'.");
  }
  const site = domainSite || legacySite;
  if (!site) {
    throw new Error("Domain is required when Authentication is 'API & App Keys'.");
  }
  return { apiKey: prefs["api-key"], appKey: prefs["app-key"], site };
};
