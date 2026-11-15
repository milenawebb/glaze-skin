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
- The Glaze skin lives self-contained in src/glaze/ (entry index.ts, own CSS vars, no app imports) to ship as its own package.
- All skin sounds stay in src/glaze/sounds.ts, one function per sound, so recordings can replace synthesis.
- Shell debris uses cached material, pooled shapes and one frame-batched queue capped at forty to avoid GPU readback and phone stalls.
- Route skin audio through one master highpass; click sound selection stays tied to press-down material until the gesture becomes a drag, preventing squish plus fracture on jitter or recovery.
- Decode recording assets on sound enable and keep press tracking, variation and shared drag voice limits in sounds.ts so audio remains package-local and unlocks on the enabling gesture.
- Control audio observes press/release in window capture before React glaze changes; coating animations never trigger control audio, preventing duplicate clips and slider propagation issues.
- Keep haptics in src/glaze/haptics.ts gated by the shared sound switch; touch.ts holds pressure and narrow-frame rules so exact device behavior can be tested without WebGL.
- Read frame renderer insets from the player’s computed padding so touch hit testing and the rendered ring stay aligned with narrow layouts.
- Phone layout positions the existing controls through data-compact rather than mounting duplicates, preserving media, squish, and crust state across resizes; compact pill faces separate 32px artwork from 44px buttons.
- Render the bottom-band face in the frame shader using the same dent map and lighting, so permanent dents deform rather than erase it; animate its expression independently of the dent reset.
- Speed uses the shared four-option popup on every size, upward on wider players and downward on phones; keep popup state local so media and control state survive resizes.
- Native tracks stay hidden; captions.ts selects the exposed HLS engine subtitle loader directly because the library bridge only loads showing tracks, and owns cuechange/timeupdate/source-safe listeners for the single overlay and local CC state.
- Reserve the time display width from the duration and keep seek glaze absolutely overlaid, so time changes and cracking cannot shift the progress track.
- Queue frame inputs for RAF; use local height/coating texSubImage2D and indexed holes. Replay normalized vectors only after 100ms settled resize; retain WebGL resources. Reset uses one shader fade for both maps.
- Foam fingertip lobes and signed bulges live in fingertip.ts; signed height encoding, Gaussian tails, CSS-space blur and contribution recovery preserve ring-free dents. Reset cancels recovery.
- Clip all fracture paths against current glaze and retained holes before storage/replay; hole painting replaces fissure pixels, and pointer material transitions select foam squish versus glaze crunch so exposed areas only dent.
- Classify frame gestures before fracture: release within the threshold uses two-step cracking, while drags retain overlapping jagged strip polygons without adding fissures; strip.ts owns threshold and widths for concrete tests.
- Phone controls (and .sq-frame-tools, display: contents when wide) reuse one bottom glass row and an absolutely positioned top pill without duplicate media or buttons; captions stay above the bottom row while visible and near the bottom when hidden.
- Frame candy controls live above the canvas and fragments; viewer preferences use guarded localStorage in preferences.ts, while shader palette interpolation changes shell/foam without touching dent or coating maps and sprinkles use independent color uniforms.
- Bottom-band buttons own deduplicated pointerup/click actions and per-instance squish listeners; capture-dismiss the compact picker to prevent outside taps damaging the frame.
- Each fixed option in preferences.ts derives its internal glaze style; color and material interpolate together without modifying shared coating, dent or recovery maps, so selection never resets damage or playback.
- The sounds prop is a startup fallback beneath saved viewer preferences; mount preloads recordings without resume, and player window-capture unlock runs before control/frame presses so suspended audio can schedule the first clip.
- Phone video taps toggle controls on touch/pen pointerup, not click/down; ignore implicit touch leave so Safari cannot immediately undo the tap, and keep hidden rows non-interactive.
- Compact flavor choices open horizontally beside the existing toggle in the bottom band above other player layers; demo-only preview tabs use viewport visibility independently of the skin's width.
- Dent rise-back is a shader uniform over a rise map, baked once per press; phones halve map sizes and restore maps after GPU context loss.
- chip.ts owns tap snapping, finger-sized break-offs, island and crumb rules; no cracks or pieces without glaze near the tap.
- hint.ts schedules visit-scoped hints; ghost presses use transient shader uniforms, never retained maps.
<!-- AGENT-MEMORY:END -->
