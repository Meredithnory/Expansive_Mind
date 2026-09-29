import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FormattedPaper } from "./general-interfaces";
const completion = vi.hoisted(()=>vi.fn());
vi.mock("./openrouter",()=>({createPrivateChatCompletion:completion}));
vi.mock("../lib/paper-context",()=>({truncateAtSentence:(s:string)=>s,selectAbstractContext:(s:string)=>s}));
vi.mock("../lib/chat-context",()=>({selectChatContext:()=>"Licensed evidence"}));
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
 it("uses the budget model and caps each answer",async()=>{
  await respondToMessage("Explain",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,[]);
  const request=completion.mock.calls.at(-1)![0];
  expect(request.model).toBe("anthropic/claude-haiku-4.5");
  expect(request.max_tokens).toBe(600);
 });
 it("still rejects papers not approved for AI processing that have no abstract",async()=>{
  await expect(respondToMessage("Explain",{access:{canSendToAI:false}} as FormattedPaper,[])).rejects.toThrow("not approved");
 });
 it("answers an unlicensed paper from its abstract only",async()=>{
  await respondToMessage("What was the sample size?",{access:{canSendToAI:false},title:"Study",abstract:"We enrolled 42 adults.",paper:[{title:"Results",content:"Body text must not be sent.",subSections:[]}]} as unknown as FormattedPaper,[]);
  const {messages}=completion.mock.calls.at(-1)![0];
  const all=messages.map((m:{content:string})=>m.content).join("\n");
  expect(all).toContain("We enrolled 42 adults.");
  expect(all).not.toContain("Body text must not be sent.");
  expect(all).not.toContain("Licensed evidence");
  expect(messages[0].content).toContain("Only this paper's abstract is available to you");
 });
 it("never sends a Scholar snippet as an abstract",async()=>{
  await expect(respondToMessage("Explain",{access:{canSendToAI:false},source:"scholar",abstract:"Snippet"} as FormattedPaper,[])).rejects.toThrow("not approved");
 });
 it("instructs the model not to invent figures or ask users to share them",async()=>{
  await respondToMessage("Explain the figures",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,[]);
  const {messages}=completion.mock.calls.at(-1)![0];
  expect(messages[0].content).toContain("Do not claim figures");
  expect(messages[0].content).toContain("Never ask the user to upload");
 });
 it("asks for next questions and keeps old ones out of the history",async()=>{
  await respondToMessage("And then?",{access:{canSendToAI:true},title:"Study"} as FormattedPaper,[{sender:"ai",message:"About 30%.\n:::next\nWhat did FLOW show?\n:::"}]);
  const {messages}=completion.mock.calls.at(-1)![0];
  expect(messages[0].content).toContain(":::next");
  expect(messages.some((m:{content:string})=>m.content==="About 30%.")).toBe(true);
  expect(messages.some((m:{content:string})=>m.content.includes("What did FLOW show?"))).toBe(false);
 });
});
