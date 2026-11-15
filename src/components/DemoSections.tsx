import { useState } from "react";

const USAGE = `import { GlazePlayer } from "glaze";

export function MyVideo() {
  return (
    <GlazePlayer
      playbackId="YOUR_MUX_PLAYBACK_ID"
      title="My video"
      sounds={false}
    />
  );
}`;

const FEATURES = [
  "Four flavors: Rainbow and Strawberry candy with sprinkles, smooth Lilac and Matcha",
  "Real ASMR sounds for every crack, crunch and squish, off by default",
  "Full controls: play, seek, volume, captions, speed and fullscreen in one glass bar",
  "A dedicated phone layout, with room to squish with your thumbs",
  "Keyboard shortcuts: Space or K to play, arrows to seek and change volume, F, M and C",
  "Accessible: visible keyboard focus, readable contrast, and calm, motion-free cracking for people who prefer reduced motion",
];

const PROPS = [
  ["playbackId", "string", "required", "Mux playback ID of the video to play."],
  ["sounds", "boolean", "false", "Start with squish sounds on. A remembered viewer choice takes priority."],
  ["title", "string", "\"Video\"", "Accessible name for the player."],
  ["resetKey", "number", "0", "Change this number to puff the frame smooth and glaze it again."],
];

const icon = { viewBox: "0 0 32 32", "aria-hidden": true, className: "demo-card-icon" } as const;

const STEPS = [
  { title: "Crack", text: "Tap the glaze once and it cracks.", svg: <svg {...icon}><circle cx="16" cy="16" r="12" /><path d="M16 16 10 9M16 16l8-4M16 16l-2 9M16 16l7 6M12 11l-4 1" /></svg> },
  { title: "Chip", text: "Tap again and the pieces break away. Or drag to strip it off.", svg: <svg {...icon}><path d="M5 20 12 8l7 6-4 9Z" /><path d="m22 8 4 3-3 3M24 19l3 2-2 3" /></svg> },
  { title: "Squish", text: "Press the soft inside and it dents under your finger, then slowly puffs back up.", svg: <svg {...icon}><path d="M4 22c4 0 6-6 12-6s8 6 12 6" /><path d="M16 4v8m-3-3 3 3 3-3" /></svg> },
];

export function DemoSections() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(USAGE); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { /* Clipboard unavailable. */ }
  };
  return (
    <div className="demo-content">
      <section aria-labelledby="how-heading">
        <p className="demo-eyebrow">How to play</p>
        <h2 id="how-heading">Indulge your senses</h2>
        <div className="demo-cards">
          {STEPS.map(s => <div key={s.title} className="demo-card">{s.svg}<h3>{s.title}</h3><p>{s.text}</p></div>)}
        </div>
        <p className="demo-keys">Keyboard: Space play · ← → skip · ↑ ↓ volume · M mute · C captions · F fullscreen</p>
        <p className="demo-note">Made a mess? Hit Reset and it's glazed and new again.</p>
      </section>
      <section aria-labelledby="inside-heading">
        <h2 id="inside-heading">A real player under the glaze</h2>
        <ul className="demo-sprinkles">{FEATURES.map(f => <li key={f}>{f}</li>)}</ul>
      </section>
      <section aria-labelledby="use-heading">
        <h2 id="use-heading">Add Glaze to your site</h2>
        <p>Glaze is a skin for Video.js v10. Drop it in, point it at your video, and choose whether sounds start on.</p>
        <div className="demo-code">
          <button type="button" className="demo-copy" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
          <pre><code>{USAGE}</code></pre>
        </div>
        <div className="demo-table-wrap">
          <table className="demo-table">
            <thead><tr><th scope="col">Prop</th><th scope="col">Type</th><th scope="col">Default</th><th scope="col">What it does</th></tr></thead>
            <tbody>{PROPS.map(([n, t, d, w]) => <tr key={n}><td><code>{n}</code></td><td>{t}</td><td>{d}</td><td>{w}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <footer className="demo-footer">
        <a href="https://github.com/milenawebb/glaze-skin" target="_blank" rel="noopener noreferrer">GitHub</a> · Apache 2.0 · A sensory experience by <a href="https://milenawebb.com" target="_blank" rel="noopener noreferrer">Milena Webb</a>
      </footer>
    </div>
  );
}
