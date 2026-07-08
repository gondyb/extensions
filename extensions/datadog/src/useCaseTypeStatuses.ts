import { useCachedPromise } from "@raycast/utils";
import { apiCaseTypeStatuses, CaseTypeStatuses } from "./datadog-api";

export const useCaseTypeStatuses = () => {
  const { data } = useCachedPromise(apiCaseTypeStatuses, [], { keepPreviousData: true });
  const byCaseTypeId = new Map<string, CaseTypeStatuses>();
  (data ?? []).forEach(c => byCaseTypeId.set(c.caseTypeId, c));
  return byCaseTypeId;
};
