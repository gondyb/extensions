import { execFile } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const shellEscape = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

const expandHome = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return homedir();
  if (trimmed === "~" || trimmed.startsWith("~/")) return trimmed.replace(/^~/, homedir());
  return trimmed;
};

export type CaseContext = {
  key: string;
  title: string;
  url: string;
  description?: string;
};

const buildPrompt = (c: CaseContext) => {
  const parts = [`You're working on Datadog case ${c.key}: "${c.title}".`, `URL: ${c.url}`];
  if (c.description && c.description.trim()) {
    parts.push("", "Description:", c.description.trim());
  }
  parts.push(
    "",
    "Please: (1) investigate the codebase to understand the relevant areas, (2) write a plan, (3) implement the change end-to-end — tests included where they make sense. You're in yolo mode, so take all autonomous actions needed without asking.",
  );
  return parts.join("\n");
};

const resolveCmuxBinary = (): string => {
  for (const p of ["/usr/local/bin/cmux", "/opt/homebrew/bin/cmux"]) {
    if (existsSync(p)) return p;
  }
  return "cmux";
};

export const launchClaudeCmux = async (c: CaseContext, cwdPref: string | undefined) => {
  const cwd = expandHome(cwdPref ?? "");
  const prompt = buildPrompt(c);
  const claudeCmd = `claude --dangerously-skip-permissions ${shellEscape(prompt)}`;

  const pathExt = `${process.env.PATH || ""}:/opt/homebrew/bin:/usr/local/bin`;
  await execFileAsync(resolveCmuxBinary(), ["new-workspace", "--cwd", cwd, "--command", claudeCmd], {
    env: { ...process.env, PATH: pathExt },
    timeout: 10_000,
  });
};
