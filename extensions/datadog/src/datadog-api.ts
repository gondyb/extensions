import { client, v1, v2 } from "@datadog/datadog-api-client";
import fetch, { Response } from "node-fetch";
import { APM } from "./types";
import { resolveCredentials } from "./credentials";

export let credentialsError: Error | undefined;
export let resolvedSite = "";
let API_KEY = "";
let APP_KEY = "";
let SERVER = "";
try {
  const creds = resolveCredentials();
  API_KEY = creds.apiKey;
  APP_KEY = creds.appKey;
  SERVER = creds.site;
  resolvedSite = creds.site;
} catch (e) {
  credentialsError = e instanceof Error ? e : new Error(String(e));
}

const configuration = client.createConfiguration({ authMethods: { apiKeyAuth: API_KEY, appKeyAuth: APP_KEY } });
configuration.setServerVariables({
  site: SERVER,
});

export const notebooksApi = new v1.NotebooksApi(configuration);
export const monitorsApi = new v1.MonitorsApi(configuration);
export const rumApi = new v2.RUMApi(configuration);

export const apiAPM = ({ env }: { env: string }): Promise<APM[]> =>
  fetch(`https://api.${SERVER}/api/v1/service_dependencies?env=${env}`, params)
    .then(parseResponseToJSON)
    .then(json => json as Record<string, { calls: string[] }>)
    .then(rec => Object.entries(rec).sort(([l], [r]) => (l < r ? -1 : 1)))
    .then(entries => entries.map(([name, { calls }]) => ({ env, name, calls }) as APM));

export type DashboardSearchAPIResponse = {
  total: number;
  dashboards: DashboardSummaryDefinition[];
};

export type DashboardSummaryDefinition = {
  id: string;
  popularity: number;
  is_favorite: boolean;
  is_shared: boolean;
  author: Author;
  url: string;
  title: string;
};

export type Author = {
  handle: string;
  name: string;
};

export const apiDashboards = ({ query }: { query: string }): Promise<DashboardSearchAPIResponse> =>
  fetch(
    encodeURI(
      `https://app.${SERVER}/api/v1/dashboard_search?with_suggested=true&query=${query}&start=0&count=50&sort=`,
    ),
    params,
  )
    .then(parseResponseToJSON)
    .then(json => json as DashboardSearchAPIResponse);

const parseResponseToJSON = (resp: Response) =>
  resp.json().then(json => {
    if (resp.ok) return json;

    const raw = (json as { errors?: Array<string | { title?: string; detail?: string; code?: string }> }).errors;
    const messages = (raw ?? []).map(e => {
      if (typeof e === "string") return e;
      return e.detail || e.title || e.code || JSON.stringify(e);
    });

    throw new Error(messages.length ? messages.join(", ") : `HTTP ${resp.status}`);
  });

const params = {
  headers: {
    "Content-Type": "application/json",
    "DD-API-KEY": API_KEY,
    "DD-APPLICATION-KEY": APP_KEY,
  },
};
