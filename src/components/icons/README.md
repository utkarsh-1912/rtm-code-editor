# Icons

Every icon in CoLabs goes through one component and one registry.

```jsx
import Icon from "../components/icons/Icon";

<Icon name="mic" size={16} filled={!isMuted} />
```

| Prop        | What it does                                                              |
| ----------- | ------------------------------------------------------------------------- |
| `name`      | A key from [`registry.js`](registry.js). Unknown names render nothing and warn in development. |
| `size`      | One of the tokens **12 / 14 / 16 / 20 / 24**. Default `16`. Other values snap to the nearest token and warn in development. |
| `filled`    | Shows the solid twin. See the rules below.                                |
| `label`     | Names the icon for screen readers (`role="img"`). Without it the icon is `aria-hidden`. |
| `className`, `style`, other props | Passed through to the `<svg>`.                  |

The colour is always `currentColor`. Set `color` on the button, not on the icon.

## Where the glyphs come from

- **Fluent UI System Icons** (`@fluentui/react-icons`, MIT). Each one has a `…Regular` (outline) and a `…Filled` version. `registry.js` imports each icon from its own module in the headless build (`@fluentui/react-icons/headless/svg/<icon>`). That means:
  - only the icons listed in the registry reach the bundle;
  - the Griffel CSS-in-JS runtime used by the package's main entry is not pulled in.
- **CoLabs brand icons**, for ideas Fluent doesn't cover. They are drawn on a 24 px grid at Fluent's weight (1.5 px line) with round caps and joins, and each has an outline and a filled version. So far:
- `ai`, [`AiIcon.js`](AiIcon.js): a chat bubble (the same shape as Chat) with a spark inside, meaning an assistant you talk to. Filled is a solid bubble with the spark cut out.
- `github`, [`GitHubIcon.js`](GitHubIcon.js): outline from Lucide's GitHub icon (ISC). Still to draw: room, project, diagram, layout cards, presence cursor.

The set follows the owner's reference sheet: the Microsoft Teams style of Fluent icons, with rounded shapes and an outline and a filled version of each.

## Pick the glyph that shows what the action does

| Action | Name | Glyph |
| --- | --- | --- |
| Start a call | `call` | phone handset |
| Leave a call | `call-leave` | handset hung up |
| Whiteboard | `whiteboard` | board with pen |
| AI Copilot | `ai` | chat bubble with a spark (CoLabs brand icon) |
| Invite people | `invite` | team with + |
| People | `people` | team of three |
| Chat | `chat` | speech bubble |
| Command palette | `palette` | ⌘ key |
| Search | `search` | magnifier |
| Focus mode | `focus` | target |
| Analytics | `analytics` | bar chart |
| Version history | `history` | clock with arrow |
| Import snippet | `snippet` | code block |
| Back to dashboard | `dashboard` | home |
| Leave room | `leave-room` | door with arrow |
| Copy spectator link | `spectator` | link |
| Save to disk | `save-disk` | save |
| Add files / folder | `add-files` / `add-folder` | document + / folder + |

## Rules

1. **Outline by default.** Use `filled` only for:
   - a toggle that is pressed or active (mic live, camera on, presenting, pinned);
   - the current item in a navigation bar (the selected mobile tab);
   - the glyph inside a solid primary button (the play icon on Run), where an outline looks too thin.
2. **One icon per meaning.**
   - Whiteboard uses `whiteboard` everywhere: the header, the command palette and the mobile tab bar.
   - Don't register a second glyph for an idea that already has a name.
   - Don't reuse one glyph for two ideas. The call is `call`; the camera toggle is `video`.
3. **Icon-only buttons need both `aria-label` and a tooltip** (`title`, or the shared tooltip). Put `aria-label` on the button and leave the icon decorative. Use `label` only when the icon itself carries meaning, outside any labelled control.
4. **Use the size tokens only.** As a guide:
   - 12 for inline badges, such as the mute dot on a tile;
   - 14 for dense toolbars;
   - 16 for buttons, including the 38 px round call controls;
   - 20 for header actions and mobile tabs;
   - 24 for empty states.
5. **To add an icon**, find the Fluent name (search the [Fluent icon catalog](https://react.fluentui.dev/?path=/docs/icons-catalog--docs)) and import both variants from `headless/svg/<kebab-name>`. Then add one entry to `registry.js` under the right group. For a brand icon, draw both variants on the 24 px grid and register them the same way `ai` is.
6. **Don't import `lucide-react` or `@fluentui/react-icons` outside this folder.** Once the migration is finished, an ESLint `no-restricted-imports` rule will enforce this.

## Migration status

- [x] Registry and `<Icon>`; AI Copilot has its own brand icon (`icons/AiIcon.js`), replacing the earlier `components/AiIcon.js`
- [x] Call controls in `VideoChat.js`: mic, video, screen share, pin, leave, dock / pop-out, window controls
- [x] Workspace header actions, ⋯ menu, command palette, status-bar chips and mobile tab bars in `editor.js` and `ProjectPage.js`
- [x] Rest of `ProjectPage.js`: web preview (`../WebPreview.js`), output panel buttons, file-tab close, sidebar close, zen exit
- [x] GitHub logo in `editor.js` (brand `github` icon) and `WorkspaceHeader.js` itself (Run, ⋯, search, theme, leave call)
- [ ] `GistModal.js`: being replaced by the GitHub integration branch; use `<Icon name="github" />` there
- [x] Room tools: editor toolbar, chat, output (I/O and SQL tables), problem pane, layout menu and card handles, share dialog, snippets, AI Copilot, version history, focus mode, command palette, dialog close button
- [ ] Whiteboard (`WhiteboardModal.js` and `whiteboard/`), left for the whiteboard work in progress
- [ ] Site pages
- [ ] `no-restricted-imports` lint rule for `lucide-react`
