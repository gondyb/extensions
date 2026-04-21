# Datadog Changelog

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

* datadog notebooks, monitors and customizable domain

## [Add dropdown to select host] - 2022-02-01

* Datadog: add dropdown to select host 

## [Add Datadog extension] - 2022-01-20

Initial version code
