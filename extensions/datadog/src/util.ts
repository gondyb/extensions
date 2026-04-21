import { showToast, Toast, getPreferenceValues } from "@raycast/api";
import { resolvedSite } from "./datadog-api";

export const showError = (e: Error) => showToast(Toast.Style.Failure, e.message);

export const linkDomain = () => {
  const override = getPreferenceValues().domain;
  if (override) return override;
  return resolvedSite ? `app.${resolvedSite}` : "app.datadoghq.com";
};

export function notEmpty<TValue>(value: TValue): value is NonNullable<TValue> {
  return value !== null && value !== undefined && value != "";
}
