export const RESIZE_SETTLE_MS = 100;

/** Keep the current bitmap visible until a burst of layout changes has ended. */
export function settledResize(rebuild:()=>void,host:Pick<Window,"setTimeout"|"clearTimeout"|"requestIdleCallback"|"cancelIdleCallback">=window){
  let timer:number|undefined,idle:number|undefined;
  const cancel=()=>{if(timer!==undefined)host.clearTimeout(timer);if(idle!==undefined)host.cancelIdleCallback?.(idle);timer=undefined;idle=undefined;};
  return {
    schedule(){cancel();timer=host.setTimeout(()=>{timer=undefined;if(host.requestIdleCallback)idle=host.requestIdleCallback(()=>{idle=undefined;rebuild();},{timeout:100});else rebuild();},RESIZE_SETTLE_MS);},
    cancel,
  };
}