import { useCachedPromise } from "@raycast/utils";
import { apiCurrentUser } from "./datadog-api";

export const useCurrentUser = () => {
  const { data } = useCachedPromise(apiCurrentUser, [], { keepPreviousData: true });
  return data;
};
