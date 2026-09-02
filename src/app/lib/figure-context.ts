import type {
    FormattedPaper,
    PaperFigure,
} from "../api/general-interfaces";
import { truncateAtSentence } from "./paper-context";

const MAX_NEARBY_TEXT = 3_000;

export function findPaperFigure(
    paper: FormattedPaper,
    figureId: string,
): PaperFigure | null {
    const topLevel = paper.figures?.find((figure) => figure.id === figureId);
    if (topLevel) return topLevel;
    for (const section of paper.paper) {
        const sectionFigure = section.figures?.find(
            (figure) => figure.id === figureId,
        );
        if (sectionFigure) return sectionFigure;
        for (const subSection of section.subSections) {
            const figure = subSection.figures?.find(
                (candidate) => candidate.id === figureId,
            );
            if (figure) return figure;
        }
    }
    return null;
}

export function buildFigureContext(
    paper: FormattedPaper,
    figure?: PaperFigure | null,
    userCaption?: string,
) {
    const parts = [`Paper title: ${paper.title}`];
    if (figure) {
        parts.push(`Figure: ${figure.label}`);
        if (figure.captionTitle) {
            parts.push(`Caption title: ${figure.captionTitle}`);
        }
        if (figure.caption) parts.push(`Caption: ${figure.caption}`);

        const section = paper.paper.find(
            (candidate) => candidate.title === figure.sectionTitle,
        );
        const subSection = section?.subSections.find(
            (candidate) => candidate.title === figure.subSectionTitle,
        );
        const nearby = [section?.content, subSection?.content]
            .filter(Boolean)
            .join("\n\n");
        if (nearby) {
            parts.push(
                `Nearby paper context:\n${truncateAtSentence(nearby, MAX_NEARBY_TEXT)}`,
            );
        }
    } else if (userCaption?.trim()) {
        parts.push(`Selected excerpt or caption: ${userCaption.trim()}`);
    }
    return parts.join("\n\n");
}
