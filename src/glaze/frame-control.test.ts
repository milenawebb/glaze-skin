import { describe, it, expect } from "vitest";
import { attachFrameAction } from "./frame-control";
function pointer(el: HTMLElement,type:string,x=10){const e=new Event(type,{bubbles:true});Object.assign(e,{pointerId:1,clientX:x,clientY:10,button:0});el.dispatchEvent(e);}
describe("frame button release actions",()=>{
  it("activates on pointerup without a click, and ignores the duplicate click",()=>{
    const el=document.createElement("button");let count=0;const off=attachFrameAction(el,()=>count++);
    pointer(el,"pointerdown");expect(count).toBe(0);pointer(el,"pointerup");expect(count).toBe(1);
    el.dispatchEvent(new MouseEvent("click",{detail:1}));expect(count).toBe(1);off();
  });
  it("keeps keyboard click fallback and rejects drags and cancellations",()=>{
    const el=document.createElement("button");let count=0;const off=attachFrameAction(el,()=>count++);
    pointer(el,"pointerdown");pointer(el,"pointerup",40);expect(count).toBe(0);
    pointer(el,"pointerdown");pointer(el,"pointercancel");pointer(el,"pointerup");expect(count).toBe(0);
    el.click();expect(count).toBe(1);off();
  });
});