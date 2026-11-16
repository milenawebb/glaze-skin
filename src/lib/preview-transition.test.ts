import { expect, it, vi } from "vitest";
import { createPreviewTransition } from "./preview-transition";

function fixture(reduced = false) {
  const area = document.createElement("div");
  const pending: { finish: () => void; cancel: ReturnType<typeof vi.fn>; duration: number }[] = [];
  area.animate = vi.fn((_frames, options) => {
    let finish = () => {};
    const finished = new Promise<Animation>(resolve => { finish = () => resolve({} as Animation); });
    const cancel = vi.fn();
    pending.push({ finish, cancel, duration: typeof options === "object" ? Number(options.duration) : 0 });
    return { finished, cancel } as unknown as Animation;
  });
  const apply = vi.fn();
  return { apply, pending, job: createPreviewTransition(area, apply, () => reduced) };
}

it("switches only after 120ms fade-out and then fades in for 160ms", async () => {
  const { job, apply, pending } = fixture();
  const done = job.select("Mobile");
  expect(pending[0]?.duration).toBe(120);
  expect(apply).not.toHaveBeenCalled();
  pending[0]?.finish();
  await Promise.resolve();
  expect(apply).toHaveBeenCalledWith("Mobile");
  expect(pending[1]?.duration).toBe(160);
  pending[1]?.finish(); await done;
});

it("switches instantly without animation for reduced motion", async () => {
  const { job, apply, pending } = fixture(true);
  await job.select("Tablet");
  expect(apply).toHaveBeenCalledWith("Tablet");
  expect(pending).toHaveLength(0);
});

it("ignores an earlier size request when another tab is selected", async () => {
  const { job, apply, pending } = fixture();
  const first = job.select("Mobile"), second = job.select("Tablet");
  pending[0]?.finish(); await first;
  expect(apply).not.toHaveBeenCalled();
  pending[1]?.finish(); await Promise.resolve();
  expect(apply).toHaveBeenCalledExactlyOnceWith("Tablet");
  pending[2]?.finish(); await second;
});