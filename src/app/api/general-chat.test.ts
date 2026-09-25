import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormattedPaper } from "./general-interfaces";
const completion = vi.hoisted(()=>vi.fn());
vi.mock("./openrouter",()=>({createPrivateChatCompletion:completion}));
vi.mock("../lib/paper-context",()=>({selectPaperContext:()=>"Licensed evidence",truncateAtSentence:(s:string)=>s}));
import { respondToMessage } from "./general-chat";
describe("paper chat discovery context",()=>{
 beforeEach(()=>completion.mockResolvedValue({choices:[{message:{content:"Answer"}}]}));
 it("includes stated goals alongside stored conversation without treating them as evidence",async()=>{
  await respondToMessage("Explain that",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,[{sender:"user",message:"I am new to this field"},{sender:"ai",message:"What are you trying to test?"}],undefined,"Discovery question: delivery. Goal: understand feasibility.");
  const {messages}=completion.mock.calls.at(-1)![0];
  expect(messages.some((m:{content:string})=>m.content.includes("User-supplied discovery context (not scientific evidence)"))).toBe(true);
  expect(messages.some((m:{content:string})=>m.content==="I am new to this field")).toBe(true);
  expect(messages[0].content).toContain("Do not infer psychological traits");
 });
 it("retains the newest replies when the history budget is exceeded",async()=>{
  const history=Array.from({length:12},(_,i)=>({sender:"user",message:`reply-${i}:`+"x".repeat(1900)}));
  await respondToMessage("Next",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,history);
  const {messages}=completion.mock.calls.at(-1)![0];
  expect(messages.some((m:{content:string})=>m.content.startsWith("reply-11:"))).toBe(true);
  expect(messages.some((m:{content:string})=>m.content.startsWith("reply-0:"))).toBe(false);
 });
 it("still rejects papers not approved for AI processing",async()=>{
  await expect(respondToMessage("Explain",{access:{canSendToAI:false}} as FormattedPaper,[])).rejects.toThrow("not approved");
 });
 it("instructs the model not to invent figures or ask users to share them",async()=>{
  await respondToMessage("Explain the figures",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,[]);
  const {messages}=completion.mock.calls.at(-1)![0];
  expect(messages[0].content).toContain("Do not claim figures");
  expect(messages[0].content).toContain("Never ask the user to upload");
 });
});
