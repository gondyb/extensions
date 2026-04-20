import { Action, ActionPanel, Detail, Icon, openExtensionPreferences } from "@raycast/api";
import { ComponentType } from "react";
import { credentialsError } from "./datadog-api";

const CredentialsErrorView = ({ error }: { error: Error }) => {
  const markdown = `# Datadog credentials unavailable

${error.message}

Open the extension preferences to update your authentication settings.`;

  return (
    <Detail
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
        </ActionPanel>
      }
    />
  );
};

export function withCredentials<P extends object>(Component: ComponentType<P>) {
  const Wrapped = (props: P) => {
    if (credentialsError) return <CredentialsErrorView error={credentialsError} />;
    return <Component {...props} />;
  };
  Wrapped.displayName = `withCredentials(${Component.displayName || Component.name || "Component"})`;
  return Wrapped;
}
