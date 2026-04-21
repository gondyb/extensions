# Datadog Changelog

## [Launch Claude Code from a case] - 2026-04-21

* Add `Launch in Claude Code (Cmux)` action on every case — opens a new cmux workspace and runs `claude --dangerously-skip-permissions` with a prompt built from the case (key, title, URL, description).
* Per-command `Claude Workspace Directory` preference — sets the cwd cmux opens in.

## [Add Case Management] - 2026-04-20

* Add "List Cases" command — browse, search, and filter Case Management cases by project. Shows assignee Gravatar and case priority.
* Change case status directly from the list via the Change Status submenu (populated from each case's type configuration).
* Assign or unassign yourself from a case via the Assign to Me / Unassign action.
* Pin your cases to the top of the list in an "Assigned to Me" section.
* Per-command `Default Filter` preference — a raw Datadog search string prepended to every query.

## [Command Line authentication] - 2026-04-20

* Add "Command Line" authentication option — resolve credentials by running a shell command that prints `DD_API_KEY=…`, `DD_APP_KEY=…`, and optionally `DD_SITE=…` on stdout.
* Replace the `Server` dropdown with a single `Domain` textfield — the API site is inferred by stripping a leading `app.` prefix when present. The legacy `Server` preference is still read for backwards compatibility.
* Show a friendly "Open Extension Preferences" view instead of crashing when credentials cannot be resolved.

## [Add RUM Applications and other improvements] - 2024-03-17

* Add "List RUM Applications" command.
* Add copy to clipboard action to "List Dashboards", "List Monitors" and "List Notebooks" commands.
* Add icons to show favorite items on "List Dashboards" and "List Notebooks" commands.
* Add more terms to filter the notebooks on "List Notebooks" command such as its type and author's name and email.
* Add notebook author avatar image to "List Notebooks" command.

## [Add pagination to api] - 2022-06-15

* datadog notebooks, monitors and customizable domain

## [Datadog notebooks, monitors and customizable domain] - 2022-02-21
