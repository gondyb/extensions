import { Action, ActionPanel, Color, getPreferenceValues, Icon, Image, List, showToast, Toast } from "@raycast/api";
import { getAvatarIcon } from "@raycast/utils";
import { useCachedState } from "@raycast/utils";
import { useState } from "react";
import {
  OPEN,
  IN_PROGRESS,
  CLOSED,
} from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/CaseStatus";
import { NOT_DEFINED } from "@datadog/datadog-api-client/dist/packages/datadog-api-client-v2/models/CasePriority";
import { apiUpdateCaseStatus, caseManagementApi, CaseTypeStatuses, CurrentUser, RawCase, RawUser } from "./datadog-api";
import { linkDomain } from "./util";
import { useCases } from "./useCases";
import { useProjects } from "./useProjects";
import { useCurrentUser } from "./useCurrentUser";
import { useCaseTypeStatuses } from "./useCaseTypeStatuses";
import { withCredentials } from "./withCredentials";

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "All Statuses", value: "" },
  { label: "Open", value: OPEN as string },
  { label: "In Progress", value: IN_PROGRESS as string },
  { label: "Closed", value: CLOSED as string },
];

function CommandListCases() {
  const { "default-filter": defaultFilter = "" } = getPreferenceValues();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useCachedState<string>("cases-project-id", "");
  const [status, setStatus] = useCachedState<string>("cases-status", "");

  const { projects, projectsAreLoading } = useProjects();
  const currentUser = useCurrentUser();
  const caseTypeStatuses = useCaseTypeStatuses();
  const { mine, others, users, casesAreLoading, mutateCase, refetchCase } = useCases({
    query,
    status,
    projectId,
    defaultFilter,
    currentUserId: currentUser?.id,
  });

  const selectedProject = projects.find(p => p.id === projectId);
  const statusLabel = STATUS_OPTIONS.find(o => o.value === status)?.label ?? "All Statuses";

  const scopeBadge = [
    selectedProject ? `project:${selectedProject.attributes.key}` : null,
    status ? `status:${statusLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const othersLabel = mine.length > 0 ? "Others" : "Cases";
  const othersTitle = scopeBadge
    ? `${othersLabel} — ${scopeBadge} (${others.length})`
    : `${othersLabel} (${others.length})`;

  return (
    <List
      isLoading={casesAreLoading || projectsAreLoading}
      onSearchTextChange={setQuery}
      searchBarPlaceholder="Search cases by title, assignee, tag, …"
      throttle
      searchBarAccessory={
        <List.Dropdown tooltip="Filter by project" value={projectId} onChange={setProjectId}>
          <List.Dropdown.Item title="All Projects" value="" icon={Icon.List} />
          <List.Dropdown.Section title="Projects">
            {projectId && !projects.some(p => p.id === projectId) ? (
              <List.Dropdown.Item key={projectId} title="Loading project…" value={projectId} icon={Icon.Folder} />
            ) : null}
            {projects.map(p => (
              <List.Dropdown.Item
                key={p.id}
                title={`${p.attributes.name} (${p.attributes.key})`}
                value={p.id}
                icon={Icon.Folder}
              />
            ))}
          </List.Dropdown.Section>
        </List.Dropdown>
      }
    >
      {mine.length > 0 ? (
        <List.Section title={`Assigned to Me (${mine.length})`}>
          {mine.map(c => (
            <CaseListItem
              key={c.id}
              c={c}
              status={status}
              setStatus={setStatus}
              currentUser={currentUser}
              typeStatuses={caseTypeStatuses.get(getCaseTypeId(c) ?? "")}
              users={users}
              refetchCase={refetchCase}
              mutateCase={mutateCase}
            />
          ))}
        </List.Section>
      ) : null}
      <List.Section title={othersTitle}>
        {others.map(c => (
          <CaseListItem
            key={c.id}
            c={c}
            status={status}
            setStatus={setStatus}
            currentUser={currentUser}
            typeStatuses={caseTypeStatuses.get(getCaseTypeId(c) ?? "")}
            users={users}
            refetchCase={refetchCase}
            mutateCase={mutateCase}
          />
        ))}
      </List.Section>
    </List>
  );
}

type CaseListItemProps = {
  c: RawCase;
  status: string;
  setStatus: (v: string) => void;
  currentUser: CurrentUser | undefined;
  typeStatuses: CaseTypeStatuses | undefined;
  users: Map<string, RawUser>;
  refetchCase: (caseId: string) => void;
  mutateCase: (caseId: string, updater: (c: RawCase) => RawCase) => () => void;
};

const CaseListItem = ({
  c,
  status,
  setStatus,
  currentUser,
  typeStatuses,
  users,
  refetchCase,
  mutateCase,
}: CaseListItemProps) => {
  const { id, attributes } = c;
  const key = attributes?.key ?? "";
  const title = attributes?.title ?? "Untitled case";
  const url = `https://${linkDomain()}/cases/${key || id}`;
  const modifiedAt = attributes?.modified_at ?? attributes?.created_at;
  const assigneeId = c.relationships?.assignee?.data?.id;
  const isMine = currentUser && assigneeId === currentUser.id;

  const assignee = assigneeId ? users.get(assigneeId) : undefined;
  const accessories: List.Item.Accessory[] = [];
  if (attributes?.priority && attributes.priority !== NOT_DEFINED) {
    accessories.push({
      tag: { value: attributes.priority, color: priorityColor(attributes.priority) },
      tooltip: `Priority: ${attributes.priority}`,
    });
  }
  if (modifiedAt) {
    accessories.push({ date: new Date(modifiedAt), tooltip: `Updated: ${new Date(modifiedAt).toLocaleString()}` });
  }
  accessories.push({
    icon: assigneeIcon(assignee),
    tooltip: `Assignee: ${assignee?.name ?? assignee?.handle ?? "Unassigned"}`,
  });

  const statusEnumByGroup: Record<string, string> = { open: "OPEN", in_progress: "IN_PROGRESS", closed: "CLOSED" };

  const onChangeStatus = async (group: "open" | "in_progress" | "closed", statusName: string) => {
    const revert = mutateCase(id, prev => ({
      ...prev,
      attributes: { ...prev.attributes, status: statusEnumByGroup[group], status_name: statusName },
    }));
    const toast = await showToast({ style: Toast.Style.Animated, title: `Setting status to ${statusName}…` });
    try {
      await apiUpdateCaseStatus(id, group, statusName);
      toast.style = Toast.Style.Success;
      toast.title = `Status set to ${statusName}`;
      refetchCase(id);
    } catch (e) {
      revert();
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to change status";
      toast.message = e instanceof Error ? e.message : String(e);
    }
  };

  const onAssignToMe = async () => {
    if (!currentUser) {
      await showToast({ style: Toast.Style.Failure, title: "Current user not loaded yet" });
      return;
    }
    const revert = mutateCase(id, prev => ({
      ...prev,
      relationships: { ...prev.relationships, assignee: { data: { id: currentUser.id } } },
    }));
    const toast = await showToast({ style: Toast.Style.Animated, title: `Assigning to ${currentUser.name}…` });
    try {
      await caseManagementApi.assignCase({
        caseId: id,
        body: { data: { type: "case", attributes: { assigneeId: currentUser.id } } },
      });
      toast.style = Toast.Style.Success;
      toast.title = "Assigned to you";
      refetchCase(id);
    } catch (e) {
      revert();
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to assign";
      toast.message = e instanceof Error ? e.message : String(e);
    }
  };

  const onUnassign = async () => {
    const revert = mutateCase(id, prev => ({
      ...prev,
      relationships: { ...prev.relationships, assignee: { data: null } },
    }));
    const toast = await showToast({ style: Toast.Style.Animated, title: "Unassigning…" });
    try {
      await caseManagementApi.unassignCase({
        caseId: id,
        body: { data: { type: "case" } },
      });
      toast.style = Toast.Style.Success;
      toast.title = "Unassigned";
      refetchCase(id);
    } catch (e) {
      revert();
      toast.style = Toast.Style.Failure;
      toast.title = "Failed to unassign";
      toast.message = e instanceof Error ? e.message : String(e);
    }
  };

  return (
    <List.Item
      id={id}
      icon={statusIcon(attributes?.status)}
      title={title}
      subtitle={key}
      keywords={[key, attributes?.status ?? "", attributes?.priority ?? ""]}
      accessories={accessories}
      actions={
        <ActionPanel>
          <Action.OpenInBrowser url={url} />
          <Action.CopyToClipboard title="Copy URL" content={url} />
          {key ? <Action.CopyToClipboard title="Copy Case Key" content={key} /> : null}
          <ActionPanel.Section title="Modify">
            <ActionPanel.Submenu
              title="Change Status"
              icon={Icon.CircleProgress}
              shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
            >
              {renderStatusOptions(typeStatuses, attributes?.status_name, onChangeStatus)}
            </ActionPanel.Submenu>
            <Action
              title={isMine ? "Unassign" : "Assign to Me"}
              icon={isMine ? Icon.PersonCircle : Icon.Person}
              shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
              onAction={isMine ? onUnassign : onAssignToMe}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Filters">
            <ActionPanel.Submenu
              title="Filter by Status"
              icon={Icon.Filter}
              shortcut={{ modifiers: ["cmd"], key: "s" }}
            >
              {STATUS_OPTIONS.map(opt => (
                <Action
                  key={opt.value || "all"}
                  title={opt.label}
                  icon={opt.value === status ? Icon.Checkmark : Icon.Circle}
                  onAction={() => setStatus(opt.value)}
                />
              ))}
            </ActionPanel.Submenu>
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
};

const getCaseTypeId = (c: RawCase): string | undefined => c.attributes?.type_id;

const assigneeIcon = (user: RawUser | undefined): Image.ImageLike => {
  if (!user) return Icon.Person;
  if (user.avatarUrl) return { source: user.avatarUrl, mask: Image.Mask.Circle, fallback: Icon.Person };
  return getAvatarIcon(user.name ?? user.handle ?? "?");
};

const renderStatusOptions = (
  typeStatuses: CaseTypeStatuses | undefined,
  currentStatusName: string | undefined,
  onChangeStatus: (group: "open" | "in_progress" | "closed", statusName: string) => void,
) => {
  if (!typeStatuses) return <Action title="Loading Statuses…" icon={Icon.Clock} onAction={() => {}} />;

  const groups: { group: "open" | "in_progress" | "closed"; label: string; caseStatus: string }[] = [
    { group: "open", label: "Open", caseStatus: OPEN as string },
    { group: "in_progress", label: "In Progress", caseStatus: IN_PROGRESS as string },
    { group: "closed", label: "Closed", caseStatus: CLOSED as string },
  ];

  return groups.flatMap(({ group, label, caseStatus }) => {
    const options = typeStatuses[group];
    if (!options || options.length === 0) return [];
    return [
      <ActionPanel.Section key={group} title={label}>
        {options.map(opt => (
          <Action
            key={`${group}-${opt.name}`}
            title={opt.name}
            icon={
              opt.name === currentStatusName
                ? { source: Icon.Checkmark, tintColor: Color.Green }
                : statusIcon(caseStatus)
            }
            onAction={() => onChangeStatus(group, opt.name)}
          />
        ))}
      </ActionPanel.Section>,
    ];
  });
};

const statusIcon = (status: string | undefined) => {
  switch (status) {
    case OPEN:
      return { source: Icon.Circle, tintColor: Color.Red };
    case IN_PROGRESS:
      return { source: Icon.CircleProgress50, tintColor: Color.Yellow };
    case CLOSED:
      return { source: Icon.CheckCircle, tintColor: Color.Green };
    default:
      return { source: Icon.QuestionMark, tintColor: Color.SecondaryText };
  }
};

const priorityColor = (priority: string) => {
  switch (priority) {
    case "P1":
      return Color.Red;
    case "P2":
      return Color.Orange;
    case "P3":
      return Color.Yellow;
    case "P4":
      return Color.Blue;
    case "P5":
      return Color.SecondaryText;
    default:
      return Color.SecondaryText;
  }
};

export default withCredentials(CommandListCases);
