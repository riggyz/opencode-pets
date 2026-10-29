# OpenCode Pets

An in-window companion for OpenCode Desktop V2's experimental GUI plugin API.
Requires the GUI API shipped with OpenCode 2.2.0. No fork, server plugin, AI
calls, or external pet service is needed.

## Install from GitHub

Requires **OpenCode Desktop 2.2.0 or later** with the compatible experimental GUI
plugin API. Install globally so Desktop can load the plugin in every window:

```sh
opencode plugin add github:riggyz/opencode-pets
```

The repository includes the prebuilt GUI bundle; users do not need to clone the
repository or run a build. Pets remain inside the OpenCode window.

Five pets are included: **Byte**, **Euromoji** (hatchback), **Shrocket** (shark
rocket), **Thurmble** (turtle), and **Unicorn** (mecha helmet). They are available
offline immediately after installation and participate in session-name-based
pet selection. Local Codex-compatible pets can still be added alongside them.

To pin a published Git tag or commit, append `#<tag-or-commit>` to the GitHub
package specification. Tags must exist in the repository before installing them.
Check for and apply updates with:

```sh
opencode plugin check
opencode plugin update github:riggyz/opencode-pets
```

To remove the plugin:

```sh
opencode plugin remove github:riggyz/opencode-pets
```

## Distribution

`package.json` exports `dist/gui-experimental.cjs`, which is committed so GitHub
installations work without install-time build scripts. After changing plugin
source, rebuild and include the updated bundle in the same commit:

```sh
npm ci
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

Push the source and bundle together before advertising an updated GitHub install
or creating a release tag.

### Release a version

`main` only accepts changes through pull requests, so releases go through one:

1. Run the **Release** workflow from the GitHub Actions tab on `main` and choose
   `patch`, `minor`, or `major`. It runs tests and typecheck, bumps the version,
   rebuilds the bundle, and opens a `chore(release): vX.Y.Z` pull request.
2. Merge that pull request. The **Publish release** workflow tags the merged
   commit as `vX.Y.Z` and creates the GitHub Release.

Users can then install or pin that release:

```sh
opencode plugin add github:riggyz/opencode-pets#v0.1.1
```

`private: true` prevents accidental npm publishing; it does not prevent GitHub
installs. User-installed Codex pets are not bundled.

## Develop and load

```sh
cd opencode-pets
npm ci
npm run build
npm run dev
```

Add the **absolute package directory** to `plugins` in your global
`~/.config/opencode/opencode.json(c)` (preserve existing entries):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-pets"
    }
  ]
}
```

Desktop loads GUI plugins from global config, not project config. By default the
resident pet stays in the window on Home, drafts, and across project/chat switches,
idling when no chat is active. Other active sessions appear as guests. The optional `options.onlyDirectory` string restricts
visibility to a mounted chat in that exact directory; use it only for scoped
testing, since it deliberately hides the pet elsewhere. Save the config to load the plugin;
each successful `npm run dev` rebuild hot-reloads its GUI and main process.
Do not restart the service to apply changes.

## Use

- Hover a pet (or focus it with the keyboard) to pet it and trigger a jump. Drag
  horizontally to move it; dragging never opens a session.
- The resident pet follows the chat on screen. Each other working, waiting,
  failed, or unread-reply parent chat gets one guest. Each active subagent gets a
  baby (55% of the base size) that trails its parent pet, including nested
  subagents. Babies disappear when work finishes; waiting subagents keep their
  baby and make the parent wait too. Babies slightly overlap (20%) and hop in a
  phased sine-wave ripple. Reduced motion disables the ripple.
- Each root chat gets a deterministic pet from its full session name and the
  available catalog, independent of catalog order. Babies inherit that sprite.
  Renaming a session or changing the catalog can change its assigned pet. The
  manual picker applies only to the fallback companion on Home.
- Positions belong to the window-wide colony. Switching chats changes which
  family is current without remounting or repositioning it. Pets occupy the
  outer thirds of the window; dragging and wandering also keep the center clear.
  Very narrow windows scale pets down to fit a side lane, and crowded baby
  trains compress their overlap rather than entering the center.
- The pet plane tracks the top of the visible input dock, including question and
  permission prompts that replace the text composer, and follows size/layout
  changes using DOM hooks and resize/mutation observers (the experimental SDK
  has no composer geometry API). Without a visible input dock it falls back to
  the bottom edge. Host DOM changes may require updating this integration.
- Click a guest to open/focus its exact session through OpenCode's tab API. Click
  the resident to dismiss its completed/error reaction. Clicking does not pet it.
- Idle, viewed, interrupted, removed, or disconnected guests walk off the nearest
  window edge before disappearing. Resumed work cancels departure. Opening a
   guest makes it current in place, without duplicating that session.
- Hover/focus shows a small pill with the first 16 characters of the session
  title and its project name on a second line. No automatic text bubbles, native tooltips, or
  status dots. Right-click a guest for **Open session**. Babies use their own
  session title; clicking one always opens/focuses its root chat, even while
  viewing a child session in that family.
- Hover or focus the pet and click **···**, or right-click it, for the picker,
  size, wandering, refresh, and hide controls. Escape closes the settings.
- Use **Show pet / Hide pet** and **Refresh pets** in the command palette.
- All nine Codex behavior rows are wired:

  | Animation | Trigger |
  | --- | --- |
  | Idle | No work or pending attention |
  | Running right / left | Resident wandering; idle guests leaving |
  | Waving | Appearing while idle, or **Say hello** in the pet menu |
  | Jumping | Hover/focus the pet |
  | Failed | Session failure; tool/step errors and nonzero shell exits react for four seconds |
  | Waiting | The pet's session needs a question answered or permission granted |
  | Running | The pet's session is working |
  | Review | Unread completed reply; open/view the session or dismiss the resident |

- V2 pets briefly stop and look toward pointer movement using all 16 directional
  poses. The deadzone near the face falls back to idle; v1 pets use normal idle.
- State is tracked independently per server/session using the app's synchronized
  data and one event listener per connected server—not one subscription per pet.
  Active and prompted children are grouped under their root chat, even if absent
  from the root list. Missing metadata is fetched before creating a pet.
  Old already-viewed history and archived sessions do not create guests. Removing
  a server or replacing its connection cleans up listeners and transient timers.
- Hover feedback briefly overrides the pose, but never changes the underlying
  session state. Questions take priority over working/error states.
- A shell command returning nonzero is distinct from a failed tool invocation;
  both trigger an error reaction. A recoverable tool error does not permanently
  mark the chat failed. Interrupted sessions return to idle.
- Reduced-motion uses still frames, snaps babies to their follow positions,
  disables wandering, and removes idle guests
  immediately instead of animating departure. Animation pauses
  while the document is hidden; plugin disposal cleans up listeners/timers.
- Pet selection, size, wandering, and visibility are stored by OpenCode.

## Codex-compatible pet folders

Custom pets are read locally, without changing their files, from:

1. `${CODEX_HOME:-~/.codex}/pets/`
2. `~/.petdex/pets/`
3. `${XDG_CONFIG_HOME:-~/.config}/opencode/pets/`
4. Additional parent folders supplied in `options.directories` (absolute paths,
   with `~/` expansion supported).

Click **Refresh pets** after installing a pet. Each immediate child directory
is a package:

```text
my-cat/
  pet.json
  spritesheet.webp
```

```json
{
  "id": "my-cat",
  "displayName": "My Cat",
  "description": "An optional description",
  "spriteVersionNumber": 1,
  "spritesheetPath": "spritesheet.webp"
}
```

Omitting `spriteVersionNumber` means v1. PNG and WebP are supported. The atlas
must have eight columns of 192×208 cells:

| Version | Dimensions | Rows |
| --- | --- | --- |
| 1 | 1536×1872 | 9 |
| 2 | 1536×2288 | 11 |

The first nine rows are `idle`, `running-right`, `running-left`, `waving`,
`jumping`, `failed`, `waiting`, `running`, and `review`. Behavior loops use
Codex's frame counts (6/8/8/4/5/8/6/6/6) and per-frame hold durations, skipping
unused trailing cells. V2's extra rows contain 16 clockwise look poses, starting
up at row 9 / column 0, through row 10 / column 7. Custom timing metadata is not
used. No sound or OS notifications are sent; those belong in a separate plugin.

Only JSON and image bytes are read, never scripts from pet folders. Asset paths
must stay inside their pet folder, including after symlink resolution. Images
are capped at 20 MiB. Invalid packages are skipped and reported on refresh.
User-installed custom assets remain subject to their authors' licenses; they
are not downloaded or copied into the plugin. Byte and its generator are original
assets created for this plugin. The four additional default sprite sheets were
supplied for inclusion in this project. Each folder under `assets/` is also a
Codex-compatible pet package. The additional defaults use lossless WebP atlases
to reduce the shipped bundle size without changing their visible pixels.

## Verify

```sh
npm test
npm run typecheck
npm run build
npm audit
npm run preview -- --port 5178
```

The preview at `http://127.0.0.1:5178` renders the actual companion component
with a simulated session-state selector. It does not verify Desktop's plugin
host or IPC; check the installed plugin in Desktop as well. Regenerate Byte's
atlas with `npm run generate:pet`.

## Desktop troubleshooting

An entry in `opencode plugin list` only confirms server registration, not that
the GUI rendered. On macOS, inspect the current startup folder under
`~/Library/Application Support/ai.opencode.desktop/logs/`, especially
`renderer.log`. The plugin logs `[riggyz-pets] Desktop render check` with its
enabled flag and mounted sprite bounds after the window slot mounts.

The V2 SDK declares `data.session.permission.list(id)` as an array, but Desktop
returns `undefined` before that session's permissions are hydrated. Treat both
permission and form lists as optional. This is covered by a regression test;
the preview's fixture arrays alone do not reproduce the Desktop startup state.

API reference: https://opencode.ai/v2/docs/build/plugins/gui

Format references:
https://github.com/legeling/awesome-codex-pet#pet-versions
https://github.com/crafter-station/petdex#pet-package-format
