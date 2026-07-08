import { useCachedPromise } from "@raycast/utils";
import { Project } from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/Project";
import { caseManagementApi } from "./datadog-api";

export const useProjects = () => {
  const { data, isLoading } = useCachedPromise(
    async () => {
      const response = await caseManagementApi.getProjects();
      return (response.data ?? []) as Project[];
    },
    [],
    { keepPreviousData: true },
  );
  return { projects: data ?? [], projectsAreLoading: isLoading };
};
