import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sources: any[] = [];
const gains: any[] = [];
const filters: any[] = [];
let clock = 0;
let contextState = "running";
const resume = vi.fn(() => Promise.resolve());
const decode = vi.fn(async (data) => ({ url: data }));
class AudioContextMock {
  state = contextState;
  sampleRate = 48000;
  destination = {};
  get currentTime() { return clock; }
  resume = resume;
  decodeAudioData = decode;
  createBiquadFilter() {
    const filter = { type: "", frequency: { value: 0 }, connect: vi.fn() };
    filters.push(filter); return filter;
  }
  createBuffer() { return { silent: true }; }
  createBufferSource() {
    const source = { buffer: null, playbackRate: { setTargetAtTime: vi.fn() }, connect: vi.fn((node) => node), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
    sources.push(source);
    return source;
  }
  createGain() {
    const gain = { gain: { setTargetAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
    gains.push(gain);
    return gain;
  }
}
let sounds: typeof import("./sounds");
beforeEach(async () => {
  vi.resetModules(); sources.length = 0; gains.length = 0; filters.length = 0; clock = 0; contextState = "running";
  vi.stubGlobal("AudioContext", AudioContextMock);
  vi.stubGlobal("fetch", vi.fn(async (url) => ({ ok: true, arrayBuffer: async () => url })));
  sounds = await import("./sounds");
});
afterEach(() => { sounds.setSoundsEnabled(false); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks(); });
async function enable() {
  sounds.setSoundsEnabled(true);
  await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(10));
  sources.length = 0;
}
describe("recorded Glaze sounds", () => {
  it("sets the playback session and retries suspended audio on touchend, click and pageshow", async () => {
    const session={type:"auto"};Object.defineProperty(navigator,"audioSession",{configurable:true,value:session});
    contextState="suspended";sounds.setSoundsEnabled(true,false);
    expect(session.type).toBe("playback");
    for(const event of ["touchend","click","pageshow"]){const before=resume.mock.calls.length;window.dispatchEvent(new Event(event));expect(resume.mock.calls.length).toBeGreaterThan(before);expect(sources.at(-1).buffer.silent).toBe(true);}
    delete (navigator as unknown as {audioSession?:unknown}).audioSession;
  });
  it("preloads all ten recordings without resuming before a gesture", async () => {
    contextState = "suspended";
    sounds.setSoundsEnabled(true, false);
    expect(fetch).toHaveBeenCalledTimes(10);
    expect(resume).not.toHaveBeenCalled(); expect(sources).toHaveLength(0);
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(10));
    sounds.unlockSounds(); sounds.playCrack();
    expect(resume).toHaveBeenCalledTimes(2);
    expect(sources[1].buffer.url).toMatch(/\/crack-[12]\.mp3$/);
    expect(sources[1].start).toHaveBeenCalledOnce();
  });
  it("defaults off without fetching or creating audio voices", () => {
    expect(sounds.getSoundsEnabled()).toBe(false);
    sounds.playSquelch(); sounds.playCrack(); sounds.playShatter(); sounds.playCrunch();
    expect(fetch).not.toHaveBeenCalled(); expect(sources).toHaveLength(0);
  });
  it("unlocks synchronously and fetches/decodes all ten files on enable", async () => {
    sounds.setSoundsEnabled(true);
    expect(resume).toHaveBeenCalledOnce(); expect(sources[0].start).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(10);
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(10));
    sounds.setSoundsEnabled(false); sounds.setSoundsEnabled(true);
    expect(fetch).toHaveBeenCalledTimes(10);
  });
  it.each([
    ["playSquelch", "squish", 3], ["playCrack", "crack", 2],
    ["playShatter", "shatter", 2], ["playCrunch", "crunch", 3],
  ] as const)("maps %s to its recordings without immediate repeats", async (fn, group, count) => {
    await enable();
    let previous = "";
    const seen = new Set();
    for (let i = 0; i < 20; i++) {
      clock += 0.2; sounds[fn]();
      const source = sources.at(-1), url = source.buffer.url;
      expect(url).toMatch(new RegExp(`/${group}-[1-${count}]\\.mp3$`));
      expect(url).not.toBe(previous); previous = url; seen.add(url);
      const rate = source.playbackRate.setTargetAtTime.mock.calls[0][0];
      expect(rate).toBeGreaterThanOrEqual(0.95); expect(rate).toBeLessThanOrEqual(1.05);
      const volume = gains.at(-1).gain.setTargetAtTime.mock.calls[0][0];
      expect(volume).toBeGreaterThanOrEqual(0.65 * 0.9); expect(volume).toBeLessThanOrEqual(0.65 * 1.1);
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
  it("deep squishes keep pitch unchanged and become only 6% louder", async () => {
    await enable(); const update = sounds.playSquelch(0);
    const source = sources[0], gain = gains[0];
    const initialRate = source.playbackRate.setTargetAtTime.mock.calls[0][0];
    const initialGain = gain.gain.setTargetAtTime.mock.calls[0][0];
    update?.(1);
    expect(source.playbackRate.setTargetAtTime.mock.lastCall[0]).toBe(initialRate);
    expect(gain.gain.setTargetAtTime.mock.lastCall[0]).toBeCloseTo(initialGain * 1.06);
    expect(sources).toHaveLength(1);
  });
  it("never lowers squish pitch more than 4%, even at maximum depth", async () => {
    await enable(); vi.spyOn(Math,"random").mockReturnValue(0);
    const update=sounds.playSquelch(1); update?.(100);
    expect(sources[0].playbackRate.setTargetAtTime.mock.calls.every(([rate]:[number])=>rate>=0.96)).toBe(true);
    expect(sources[0].playbackRate.setTargetAtTime.mock.lastCall[0]).toBe(0.96);
  });
  it("routes every recording through one master 150Hz highpass", async () => {
    await enable();sounds.playSquelch();sounds.playCrack();sounds.playShatter();sounds.playCrunch();
    expect(filters).toHaveLength(1);expect(filters[0].type).toBe("highpass");expect(filters[0].frequency.value).toBe(150);
    expect(filters[0].connect).toHaveBeenCalledOnce();
    expect(gains).toHaveLength(4);
    for(const gain of gains)expect(gain.connect).toHaveBeenCalledWith(filters[0]);
  });
  it("throttles drag crunches to 150ms and replaces the oldest at two voices", async () => {
    await enable(); sounds.playCrunch(); clock = 0.149; sounds.playCrunch();
    expect(sources).toHaveLength(1);
    clock = 0.15; sounds.playCrunch(); expect(sources).toHaveLength(2);
    clock = 0.3; sounds.playCrunch(); expect(sources).toHaveLength(3);
    expect(sources[0].stop).toHaveBeenCalledOnce(); expect(sources[1].stop).not.toHaveBeenCalled();
    sources[1].onended(); clock = 0.45; sounds.playCrunch();
    expect(sources[2].stop).not.toHaveBeenCalled();
  });
  it("stops active recordings and prevents new playback when switched off", async () => {
    await enable(); sounds.playSquelch(); sounds.playCrack();
    sounds.setSoundsEnabled(false);
    expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    sounds.playShatter(); expect(sources).toHaveLength(2);
  });
  it.each(["mouse", "touch"])("starts no sound when a %s press is released", async (pointerType) => {
    await enable();
    const control = document.createElement("button");
    document.body.appendChild(control);
    const detach = sounds.attachPressSounds(control);
    const down = new Event("pointerdown", { bubbles: true });
    Object.assign(down, { button: 0, pointerType });
    control.dispatchEvent(down);
    expect(sources).toHaveLength(1);
    expect(gains).toHaveLength(1);
    window.dispatchEvent(new Event("pointerup"));
    expect(sources).toHaveLength(1);
    expect(gains).toHaveLength(1);
    detach();
    control.remove();
  });
  it("uses shatter for fresh glaze, then one quieter crack per ordinary press without repeats", async () => {
    await enable();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    sounds.playControlPress(true);
    expect(sources[0].buffer.url).toMatch(/\/shatter-[12]\.mp3$/);
    const shatterGain = gains.at(-1).gain.setTargetAtTime.mock.calls[0][0];
    sounds.playControlPress(false);
    const first = sources.at(-1).buffer.url;
    expect(first).toMatch(/\/crack-[12]\.mp3$/);
    expect(gains.at(-1).gain.setTargetAtTime.mock.calls[0][0]).toBeCloseTo(shatterGain * 0.75);
    sounds.playControlPress(false);
    expect(sources.at(-1).buffer.url).not.toBe(first);
    expect(sources).toHaveLength(3);
  });
  it("uses fresh-glaze state before handlers run and stays silent on seek dragging and release", async () => {
    await enable();
    const control = document.createElement("div");
    control.className = "sq-seek";
    control.innerHTML = '<span class="sq-crust"></span>';
    document.body.appendChild(control);
    const detach = sounds.attachPressSounds(control);
    const press = () => {
      const event = new Event("pointerdown", { bubbles: true });
      Object.assign(event, { button: 0 }); control.dispatchEvent(event);
    };
    press(); expect(sources).toHaveLength(1);
    expect(sources[0].buffer.url).toMatch(/\/shatter-[12]\.mp3$/);
    const glaze = control.querySelector<HTMLElement>(".sq-crust");
    if (glaze) glaze.dataset["cracking"] = "1";
    for (let i = 0; i < 10; i++) control.dispatchEvent(new Event("pointermove", { bubbles: true }));
    window.dispatchEvent(new Event("pointerup")); expect(sources).toHaveLength(1);
    press(); expect(sources).toHaveLength(2);
    expect(sources[1].buffer.url).toMatch(/\/crack-[12]\.mp3$/);
    window.dispatchEvent(new Event("pointerup"));
    control.replaceChildren(); press();
    expect(sources).toHaveLength(3);
    expect(sources[2].buffer.url).toMatch(/\/crack-[12]\.mp3$/);
    detach(); control.remove();
  });
});