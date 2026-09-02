import { describe, expect, it } from "vitest";
import { parseArticleXml } from "./section-paser";

describe("parseArticleXml figures", () => {
    it("extracts every section and subsection figure with stable metadata", () => {
        const xml = `<?xml version="1.0"?>
<article xmlns:xlink="http://www.w3.org/1999/xlink">
  <body>
    <sec>
      <title>Results</title>
      <p>Main result.</p>
      <fig id="fig-1">
        <label>Figure 1</label>
        <caption><title>Primary outcome</title><p>Values show means.</p></caption>
        <graphic id="g1" xlink:href="figure-1.png" />
        <permissions><license xlink:href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</license></permissions>
      </fig>
      <fig id="fig-2">
        <label>Figure 2</label>
        <caption><p>Two panels are shown.</p></caption>
        <graphic xlink:href="figure-2.jpg" />
      </fig>
      <sec>
        <title>Secondary analysis</title>
        <p>Subsection result.</p>
        <fig id="fig-3">
          <label>Figure 3</label>
          <caption><p>Secondary outcome.</p></caption>
          <graphic xlink:href="/images/figure-3.webp" />
        </fig>
      </sec>
    </sec>
  </body>
</article>`;
        const sections = parseArticleXml(xml, (sourceRef) =>
            `https://example.test/${sourceRef}`,
        );

        expect(sections[0].figures).toHaveLength(2);
        expect(sections[0].figures?.[0]).toMatchObject({
            id: "fig-1",
            label: "Figure 1",
            captionTitle: "Primary outcome",
            caption: "Values show means.",
            sourceImageRef: "figure-1.png",
            rawLicense: "CC BY 4.0",
            licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
            hasSeparateRights: true,
            canAnalyzeSourceImage: false,
        });
        expect(sections[0].figures?.[1].id).toBe("fig-2");
        expect(sections[0].subSections[0].figures?.[0]).toMatchObject({
            id: "fig-3",
            sectionTitle: "Results",
            subSectionTitle: "Secondary analysis",
        });
    });

    it("keeps figures that have captions but no image reference", () => {
        const xml = `<article><body><sec><title>Results</title>
          <fig id="caption-only"><label>Figure S1</label><caption><p>Caption only.</p></caption></fig>
        </sec></body></article>`;
        const figure = parseArticleXml(xml, () => "")[0].figures?.[0];
        expect(figure).toMatchObject({
            id: "caption-only",
            label: "Figure S1",
            caption: "Caption only.",
        });
        expect(figure?.imageUrl).toBeUndefined();
    });

    it("attaches floats-group figures to the section that cites them", () => {
        const xml = `<?xml version="1.0"?>
<article xmlns:xlink="http://www.w3.org/1999/xlink">
  <front>
    <abstract abstract-type="graphical">
      <title>Graphical abstract</title>
      <fig id="undfig1">
        <graphic xlink:href="fx1.jpg" />
      </fig>
    </abstract>
  </front>
  <body>
    <sec>
      <title>Results</title>
      <p>See <xref rid="fig1" ref-type="fig">Fig. 1</xref>.</p>
      <sec>
        <title>Secondary analysis</title>
        <p>Also <xref rid="fig2" ref-type="fig">Fig. 2</xref>.</p>
      </sec>
    </sec>
  </body>
  <floats-group>
    <fig id="fig1">
      <label>Fig. 1</label>
      <caption><p>Primary outcome.</p></caption>
      <graphic xlink:href="gr1.jpg" />
    </fig>
    <fig id="fig2">
      <label>Fig. 2</label>
      <caption><p>Secondary outcome.</p></caption>
      <graphic xlink:href="gr2.jpg" />
    </fig>
    <fig id="fig3">
      <label>Fig. 3</label>
      <caption><p>Uncited figure.</p></caption>
      <graphic xlink:href="gr3.jpg" />
    </fig>
  </floats-group>
</article>`;
        const sections = parseArticleXml(
            xml,
            (sourceRef) => `https://example.test/${sourceRef}`,
        );
        const graphical = sections.find((section) => section.title === "graphical");
        const results = sections.find((section) => section.title === "Results");
        const figures = sections.find((section) => section.title === "Figures");

        expect(graphical?.figures?.[0]).toMatchObject({
            id: "undfig1",
            imageUrl: "https://example.test/fx1.jpg",
        });
        expect(results?.figures?.[0]).toMatchObject({
            id: "fig1",
            caption: "Primary outcome.",
            imageUrl: "https://example.test/gr1.jpg",
        });
        expect(results?.subSections[0].figures?.[0]).toMatchObject({
            id: "fig2",
            subSectionTitle: "Secondary analysis",
        });
        expect(figures?.figures?.[0]).toMatchObject({
            id: "fig3",
            caption: "Uncited figure.",
        });
    });
});
