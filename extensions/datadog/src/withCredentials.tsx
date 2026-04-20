import { Action, ActionPanel, Detail, Icon, openExtensionPreferences } from "@raycast/api";
import { ComponentType } from "react";
import { useCredentials } from "./credentials";
import { initApi } from "./datadog-api";

const CredentialsErrorView = ({ error }: { error: Error }) => (
  <Detail
    markdown={`# Datadog credentials unavailable\n\n${error.message}\n\nOpen the extension preferences to update your authentication settings.`}
    actions={
      <ActionPanel>
        <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
      </ActionPanel>
    }
  />
);

export function withCredentials<P extends object>(Component: ComponentType<P>) {
  const Wrapped = (props: P) => {
    const { credentials, error } = useCredentials();

    if (error) return <CredentialsErrorView error={error} />;
    if (!credentials) return <Detail isLoading markdown="# Resolving Datadog credentials…" />;

    initApi(credentials);
    return <Component {...props} />;
  };
  Wrapped.displayName = `withCredentials(${Component.displayName || Component.name || "Component"})`;
  return Wrapped;
}
