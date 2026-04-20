import { useCallback, useEffect, useRef, useState } from "react";
import { apiGetCase, apiSearchCases, RawCase, RawUser } from "./datadog-api";
import { showError } from "./util";

type State = {
  casesAreLoading: boolean;
  mine: RawCase[];
  others: RawCase[];
  users: Map<string, RawUser>;
};

type Filters = {
  query: string;
  status: string;
  projectId: string;
  defaultFilter: string;
  currentUserId?: string;
};

const buildFilter = ({ query, status, projectId, defaultFilter }: Omit<Filters, "currentUserId">, extra: string) => {
  const parts: string[] = [];
  if (defaultFilter) parts.push(defaultFilter);
  if (projectId) parts.push(`project_id:${projectId}`);
  if (status) parts.push(`status:${status}`);
  if (extra) parts.push(extra);
  if (query) parts.push(query);
  return parts.join(" ");
};

const applyInArray = (arr: RawCase[], caseId: string, updater: (c: RawCase) => RawCase) =>
  arr.map(c => (c.id === caseId ? updater(c) : c));

const byCreatedAtDesc = (a: RawCase, b: RawCase) => {
  const at = a.attributes?.created_at ?? "";
  const bt = b.attributes?.created_at ?? "";
  return at < bt ? 1 : at > bt ? -1 : 0;
};

export const useCases = (filters: Filters) => {
  const [state, setState] = useState<State>({
    casesAreLoading: true,
    mine: [],
    others: [],
    users: new Map(),
  });
  const [reloadKey, setReloadKey] = useState(0);
  const snapshotRef = useRef<{ mine: RawCase[]; others: RawCase[] } | null>(null);
  const currentUserIdRef = useRef(filters.currentUserId);
  currentUserIdRef.current = filters.currentUserId;

  useEffect(() => {
    setState(prev => ({ ...prev, casesAreLoading: true }));

    Promise.all([
      apiSearchCases({ filter: buildFilter(filters, "assignee.handle:@me"), pageSize: 50 }),
      apiSearchCases({ filter: buildFilter(filters, "-assignee.handle:@me"), pageSize: 50 }),
    ])
      .then(([minePage, othersPage]) => {
        const users = new Map<string, RawUser>([...minePage.users, ...othersPage.users]);
        setState({
          casesAreLoading: false,
          mine: minePage.data,
          others: othersPage.data,
          users,
        });
      })
      .catch(showError);
  }, [filters.query, filters.status, filters.projectId, filters.defaultFilter, reloadKey]);

  const invalidate = useCallback(() => setReloadKey(k => k + 1), []);

  const mutateCase = useCallback((caseId: string, updater: (c: RawCase) => RawCase): (() => void) => {
    setState(prev => {
      snapshotRef.current = { mine: prev.mine, others: prev.others };
      return {
        ...prev,
        mine: applyInArray(prev.mine, caseId, updater),
        others: applyInArray(prev.others, caseId, updater),
      };
    });
    return () => {
      setState(prev => (snapshotRef.current ? { ...prev, ...snapshotRef.current } : prev));
    };
  }, []);

  const refetchCase = useCallback(async (caseId: string) => {
    try {
      const { case: updated, users: newUsers } = await apiGetCase(caseId);
      setState(prev => {
        const mineWithout = prev.mine.filter(c => c.id !== caseId);
        const othersWithout = prev.others.filter(c => c.id !== caseId);
        const belongsToMe =
          currentUserIdRef.current !== undefined &&
          updated.relationships?.assignee?.data?.id === currentUserIdRef.current;
        const mergedUsers = new Map([...prev.users, ...newUsers]);
        const nextMine = belongsToMe ? [...mineWithout, updated].sort(byCreatedAtDesc) : mineWithout;
        const nextOthers = belongsToMe ? othersWithout : [...othersWithout, updated].sort(byCreatedAtDesc);
        return { ...prev, mine: nextMine, others: nextOthers, users: mergedUsers };
      });
    } catch (e) {
      showError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  return { ...state, invalidate, mutateCase, refetchCase };
};
