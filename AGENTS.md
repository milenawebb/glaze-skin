<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

<!-- AGENT-MEMORY:BEGIN -->
- The Squishy skin lives self-contained in src/squishy/ (entry index.ts, own CSS vars, no app imports) so it can ship as its own package.
- All skin sounds stay in src/squishy/sounds.ts, one function per sound, so recordings can replace synthesis.
- Decode recording assets on sound enable and keep press tracking, variation and shared drag voice limits in sounds.ts so audio remains package-local and unlocks on the enabling gesture.
- Keep haptics in src/squishy/haptics.ts gated by the shared sound switch; touch.ts holds pressure and narrow-frame rules so exact device behavior can be tested without WebGL.
- Read frame renderer insets from the player’s computed padding so touch hit testing and the rendered ring stay aligned with narrow layouts.
- Phone layout positions the existing controls through data-compact rather than mounting duplicates, preserving media, squish, and crust state across resizes; compact pill faces separate 32px artwork from 44px buttons.
- Render the bottom-band face in the frame shader using the same dent map and lighting, so permanent dents deform rather than erase it; animate its expression independently of the dent reset.
- Keep the playback-speed tap cycle in controls.ts with a concrete behavior test so the button and its sequence stay aligned.
- Store broken frame glaze in its own height-map-sized texture, independent of dents, so local matte patches and Reset never erase the face or alter squishing.
<!-- AGENT-MEMORY:END -->
