import {afterEach,expect,it,vi} from "vitest";
import {settledResize,RESIZE_SETTLE_MS} from "./resize";
afterEach(()=>vi.useRealTimers());
it("rebuilds once 100ms after the last size change, not during animation",()=>{
  vi.useFakeTimers();const rebuild=vi.fn();const job=settledResize(rebuild);
  for(let i=0;i<20;i++){job.schedule();vi.advanceTimersByTime(16);}
  expect(rebuild).not.toHaveBeenCalled();vi.advanceTimersByTime(83);expect(rebuild).not.toHaveBeenCalled();vi.advanceTimersByTime(1);expect(rebuild).toHaveBeenCalledTimes(1);expect(RESIZE_SETTLE_MS).toBe(100);
});
it("uses cancellable idle work when available",()=>{
  vi.useFakeTimers();const rebuild=vi.fn(),request=vi.fn(()=>42),cancel=vi.fn();
  const job=settledResize(rebuild,{setTimeout:window.setTimeout.bind(window),clearTimeout:window.clearTimeout.bind(window),requestIdleCallback:request,cancelIdleCallback:cancel});
  job.schedule();vi.advanceTimersByTime(100);expect(request).toHaveBeenCalledTimes(1);expect(rebuild).not.toHaveBeenCalled();job.schedule();expect(cancel).toHaveBeenCalledWith(42);job.cancel();vi.advanceTimersByTime(200);expect(request).toHaveBeenCalledTimes(1);
});