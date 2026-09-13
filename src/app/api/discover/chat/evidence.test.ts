import { describe, it, expect } from "vitest";
import { validateAnswer } from "./evidence";
const sources = [{id:"Paper 1",title:"Trial",url:"/paper/1",text:"The experiment did not measure customer demand or willingness to pay."}];
describe("report assistant citation validation",()=>{
 it("keeps exact quotes with server-owned source URLs",()=>{expect(validateAnswer({claims:[{text:"Demand was unmeasured",sourceId:"Paper 1",quote:sources[0].text,url:"https://invented.test"}]},sources).claims[0].url).toBe("/paper/1");});
 it("rejects fabricated quotes and invented references",()=>{expect(validateAnswer({claims:[{text:"Proven",sourceId:"Paper 1",quote:"Customer demand was strong and reproducible."},{text:"Proven",sourceId:"Paper 99",quote:sources[0].text}]},sources).claims).toEqual([]);});
 it("suppresses uncited model conclusions",()=>{expect(validateAnswer({interpretation:"Guaranteed profit"},sources).interpretation).not.toContain("Guaranteed");});
 it("handles missing and malformed model output",()=>{expect(validateAnswer(null,sources).claims).toEqual([]);});
});
