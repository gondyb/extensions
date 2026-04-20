import { getPreferenceValues } from "@raycast/api";
import { useExec } from "@raycast/utils";
import { useMemo } from "react";

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

type Prefs = {
  "auth-method"?: string;
  "auth-command"?: string;
  "api-key"?: string;
  "app-key"?: string;
  domain?: string;
  server?: string;
};

const resolveApiKeyCreds = (prefs: Prefs): Credentials => {
  const domainSite = prefs.domain ? siteFromDomain(prefs.domain) : "";
  const legacySite = prefs.server || "";
  if (!prefs["api-key"] || !prefs["app-key"]) {
    throw new Error("API Key and App Key are required when Authentication is 'API & App Keys'.");
  }
  const site = domainSite || legacySite;
  if (!site) throw new Error("Domain is required when Authentication is 'API & App Keys'.");
  return { apiKey: prefs["api-key"], appKey: prefs["app-key"], site };
};

const resolveCommandCreds = (prefs: Prefs, output: string): Credentials => {
  const env = parseEnvOutput(output);
  if (!env.DD_API_KEY || !env.DD_APP_KEY) {
    throw new Error("Auth command output did not contain DD_API_KEY and DD_APP_KEY.");
  }
  const domainSite = prefs.domain ? siteFromDomain(prefs.domain) : "";
  const legacySite = prefs.server || "";
  const site = env.DD_SITE || domainSite || legacySite;
  if (!site) {
    throw new Error("No site could be determined. Set Domain in preferences or have the auth command output DD_SITE.");
  }
  return { apiKey: env.DD_API_KEY, appKey: env.DD_APP_KEY, site };
};

export type CredentialsState = {
  credentials?: Credentials;
  isLoading: boolean;
  error?: Error;
};

export const useCredentials = (): CredentialsState => {
  const prefs = getPreferenceValues<Prefs>();
  const method = prefs["auth-method"] || "api-keys";
  const command = (prefs["auth-command"] || "").trim();
  const isCommand = method === "command";

  const pathExt = `${process.env.PATH || ""}:/opt/homebrew/bin:/usr/local/bin`;
  const { data, isLoading, error } = useExec("/bin/zsh", ["-c", command || "true"], {
    execute: isCommand && command.length > 0,
    shell: false,
    env: { ...process.env, PATH: pathExt },
    timeout: 120_000,
    keepPreviousData: true,
  });

  return useMemo<CredentialsState>(() => {
    if (!isCommand) {
      try {
        return { credentials: resolveApiKeyCreds(prefs), isLoading: false };
      } catch (e) {
        return { isLoading: false, error: e instanceof Error ? e : new Error(String(e)) };
      }
    }
    if (!command) {
      return {
        isLoading: false,
        error: new Error(
          "Auth Command is empty. Set a command in Raycast preferences that prints DD_API_KEY=… and DD_APP_KEY=… on stdout.",
        ),
      };
    }
    if (error) return { isLoading: false, error: new Error(`Auth command failed: ${error.message}`) };
    if (isLoading || data === undefined) return { isLoading: true };
    try {
      return { credentials: resolveCommandCreds(prefs, data), isLoading: false };
    } catch (e) {
      return { isLoading: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  }, [isCommand, command, data, isLoading, error]);
};
