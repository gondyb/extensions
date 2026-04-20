import { createHash } from "crypto";
import { client, v1, v2 } from "@datadog/datadog-api-client";
import fetch, { Response } from "node-fetch";
import { APM } from "./types";
import { Credentials } from "./credentials";

export let resolvedSite = "";
let API_KEY = "";
let APP_KEY = "";
let SERVER = "";

export let notebooksApi: v1.NotebooksApi;
export let monitorsApi: v1.MonitorsApi;
export let rumApi: v2.RUMApi;
export let caseManagementApi: v2.CaseManagementApi;

export const initApi = (creds: Credentials) => {
  API_KEY = creds.apiKey;
  APP_KEY = creds.appKey;
  SERVER = creds.site;
  resolvedSite = creds.site;

  const configuration = client.createConfiguration({ authMethods: { apiKeyAuth: API_KEY, appKeyAuth: APP_KEY } });
  configuration.setServerVariables({ site: SERVER });

  notebooksApi = new v1.NotebooksApi(configuration);
  monitorsApi = new v1.MonitorsApi(configuration);
  rumApi = new v2.RUMApi(configuration);
  caseManagementApi = new v2.CaseManagementApi(configuration);
};

export const apiAPM = ({ env }: { env: string }): Promise<APM[]> =>
  fetch(`https://api.${SERVER}/api/v1/service_dependencies?env=${env}`, requestParams())
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
    requestParams(),
  )
    .then(parseResponseToJSON)
    .then(json => json as DashboardSearchAPIResponse);

export type RawCase = {
  id: string;
  type: string;
  attributes: {
    key?: string;
    title?: string;
    priority?: string;
    status?: string;
    status_name?: string;
    type_id?: string;
    created_at?: string;
    modified_at?: string;
  };
  relationships?: {
    assignee?: { data?: { id?: string } | null };
  };
};

export type RawUser = {
  id: string;
  email?: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
};

type RawUserJson = {
  id: string;
  type: "user";
  attributes?: { email?: string; name?: string; handle?: string; icon?: string };
};

export type CasesPage = {
  data: RawCase[];
  users: Map<string, RawUser>;
};

const md5 = (s: string) => createHash("md5").update(s.toLowerCase().trim()).digest("hex");
export const gravatarUrl = (email: string, size = 48) =>
  `https://secure.gravatar.com/avatar/${md5(email)}?s=${size}&d=retro`;

const toUser = (u: RawUserJson): RawUser => ({
  id: u.id,
  email: u.attributes?.email,
  name: u.attributes?.name,
  handle: u.attributes?.handle,
  avatarUrl: u.attributes?.icon || (u.attributes?.email ? gravatarUrl(u.attributes.email) : undefined),
});

const parseUsers = (included: RawUserJson[] | undefined): Map<string, RawUser> => {
  const map = new Map<string, RawUser>();
  (included ?? []).filter(i => i.type === "user").forEach(u => map.set(u.id, toUser(u)));
  return map;
};

export const apiGetCase = (caseId: string): Promise<{ case: RawCase; users: Map<string, RawUser> }> => {
  const qs = new URLSearchParams();
  qs.set("include", "assignees,created_by");
  return fetch(`https://api.${SERVER}/api/v2/cases/${caseId}?${qs.toString()}`, requestParams())
    .then(parseResponseToJSON)
    .then(json => {
      const body = json as { data: RawCase; included?: RawUserJson[] };
      return { case: body.data, users: parseUsers(body.included) };
    });
};

export const apiSearchCases = ({
  filter,
  pageSize = 50,
}: {
  filter: string;
  pageSize?: number;
}): Promise<CasesPage> => {
  const qs = new URLSearchParams();
  if (filter) qs.set("filter", filter);
  qs.set("page[size]", String(pageSize));
  qs.set("sort[field]", "created_at");
  qs.set("sort[asc]", "false");
  qs.set("include", "assignees,created_by");
  return fetch(`https://api.${SERVER}/api/v2/cases?${qs.toString()}`, requestParams())
    .then(parseResponseToJSON)
    .then(json => {
      const body = json as { data: RawCase[]; included?: RawUserJson[] };
      return { data: body.data ?? [], users: parseUsers(body.included) };
    });
};

export type CurrentUser = { id: string; handle: string; name: string };

export const apiCurrentUser = (): Promise<CurrentUser> =>
  fetch(`https://api.${SERVER}/api/v2/current_user`, requestParams())
    .then(parseResponseToJSON)
    .then(json => {
      const u = (json as { data: { id: string; attributes: { handle: string; name: string } } }).data;
      return { id: u.id, handle: u.attributes.handle, name: u.attributes.name };
    });

export type StatusGroup = "open" | "in_progress" | "closed";
export type StatusOption = { name: string };
export type CaseTypeStatuses = {
  caseTypeId: string;
  open: StatusOption[];
  in_progress: StatusOption[];
  closed: StatusOption[];
};

type StatusesConfigRaw = {
  data: Array<{
    id: string;
    attributes: {
      statuses_config: Record<StatusGroup, { status_options: StatusOption[]; default: string }>;
    };
  }>;
};

export const apiCaseTypeStatuses = (): Promise<CaseTypeStatuses[]> =>
  fetch(`https://api.${SERVER}/api/unstable/cases/types/statuses`, requestParams())
    .then(parseResponseToJSON)
    .then(json => (json as StatusesConfigRaw).data)
    .then(entries =>
      entries.map(e => ({
        caseTypeId: e.id,
        open: e.attributes.statuses_config.open?.status_options ?? [],
        in_progress: e.attributes.statuses_config.in_progress?.status_options ?? [],
        closed: e.attributes.statuses_config.closed?.status_options ?? [],
      })),
    );

const STATUS_ENUM_BY_GROUP: Record<string, string> = {
  open: "OPEN",
  in_progress: "IN_PROGRESS",
  closed: "CLOSED",
};

export const apiUpdateCaseStatus = (caseId: string, group: string, statusName: string) =>
  fetch(`https://api.${SERVER}/api/v2/cases/${caseId}/status`, {
    ...requestParams(),
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "case",
        attributes: { status: STATUS_ENUM_BY_GROUP[group] ?? group, status_name: statusName },
      },
    }),
  }).then(parseResponseToJSON);

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

const requestParams = () => ({
  headers: {
    "Content-Type": "application/json",
    "DD-API-KEY": API_KEY,
    "DD-APPLICATION-KEY": APP_KEY,
  },
});
