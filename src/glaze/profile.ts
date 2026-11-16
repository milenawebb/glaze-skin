export function timed<T>(name:string,run:()=>T):T { const start=performance.now();try{return run();}finally{const w=window as unknown as {swipeTimings?:Record<string,number[]>};const t=w.swipeTimings??={};(t[name]??=[]).push(performance.now()-start);}}
export function profiled<T extends (...args:any[])=>any>(name:string,fn:T):T{return ((...args:Parameters<T>)=>timed(name,()=>fn(...args))) as T;}
