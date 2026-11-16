import { describe, it, expect } from "vitest";
import { attachFrameAction, CHOICE_GUARD_MS } from "./frame-control";
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
  it("never acts on a ghost click landing on a newly shown button",()=>{
    const el=document.createElement("button");let count=0;const off=attachFrameAction(el,()=>count++);
    el.dispatchEvent(new MouseEvent("click",{detail:1}));expect(count).toBe(0);off();
  });
  it("ignores taps while blocked, such as the first 350ms after the flavor row opens",()=>{
    const el=document.createElement("button");let count=0;let blocked=true;const off=attachFrameAction(el,()=>count++,()=>blocked);
    pointer(el,"pointerdown");pointer(el,"pointerup");expect(count).toBe(0);
    blocked=false;pointer(el,"pointerdown");pointer(el,"pointerup");expect(count).toBe(1);off();
  });
  it("uses a 350ms guard",()=>{expect(CHOICE_GUARD_MS).toBe(350);});
});
