import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { hasValidMutationOrigin, readBoundedJson } from "./request-security";
describe("mutation boundaries",()=>{
 it("rejects cross-site and sibling-site browser requests even without Origin",()=>{
  for(const site of ["cross-site","same-site"]) expect(hasValidMutationOrigin(new NextRequest("https://app.test/api/chat",{headers:{"sec-fetch-site":site}}))).toBe(false);
 });
 it("rejects forged origins and referrers",()=>{
  for(const header of ["origin","referer"]) expect(hasValidMutationOrigin(new NextRequest("https://app.test/api/chat",{headers:{[header]:"https://evil.test"}}))).toBe(false);
 });
 it("allows same-origin JSON requests",()=>{expect(hasValidMutationOrigin(new NextRequest("https://app.test/api/chat",{headers:{origin:"https://app.test","sec-fetch-site":"same-origin"}}))).toBe(true);});
 it("bounds actual bytes without trusting Content-Length",async()=>{await expect(readBoundedJson(new Request("https://app.test",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({message:"x".repeat(100)})}),32)).rejects.toMatchObject({status:413});});
 it("rejects form submissions, arrays and invalid JSON",async()=>{
  for(const body of ["[]","null","bad"])await expect(readBoundedJson(new Request("https://app.test",{method:"POST",headers:{"content-type":"application/json"},body}))).rejects.toMatchObject({status:400});
  await expect(readBoundedJson(new Request("https://app.test",{method:"POST",body:"x"}))).rejects.toMatchObject({status:415});
 });
});
