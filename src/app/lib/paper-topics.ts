export const PAPER_TOPICS = [
  "AI & Research Methods",
  "Cancer & Cell Therapy",
  "Neuroscience",
  "Metabolism & Nutrition",
  "Dermatology & Regeneration",
  "Genetics & Molecular Biology",
  "Immunology & Infectious Disease",
  "General Biomedical Research",
] as const;

export type PaperTopic = (typeof PAPER_TOPICS)[number];

type TopicRule = {
  topic: Exclude<PaperTopic, "General Biomedical Research">;
  terms: string[];
};

const TOPIC_RULES: TopicRule[] = [
  {
    topic: "AI & Research Methods",
    terms: [
      "artificial intelligence",
      "generative ai",
      "machine learning",
      "deep learning",
      "language model",
      "open science",
      "publication",
      "scholarly",
      "research ethics",
      "systematic review",
      "meta-analysis",
    ],
  },
  {
    topic: "Cancer & Cell Therapy",
    terms: [
      "cancer",
      "tumor",
      "tumour",
      "oncology",
      "car-t",
      "car t",
      "carcinoma",
      "leukemia",
      "lymphoma",
      "melanoma",
      "metastasis",
      "chemotherapy",
    ],
  },
  {
    topic: "Neuroscience",
    terms: [
      "brain",
      "neural",
      "neuron",
      "neurolog",
      "cognitive",
      "parkinson",
      "alzheimer",
      "dementia",
      "spinal cord",
      "neurodegener",
      "psychiatr",
    ],
  },
  {
    topic: "Metabolism & Nutrition",
    terms: [
      "metaboli",
      "nutrition",
      "protein intake",
      "obesity",
      "diabetes",
      "glp-1",
      "gip/glp",
      "sarcopenia",
      "liver",
      "adipose",
      "microbiome",
      "gut",
    ],
  },
  {
    topic: "Dermatology & Regeneration",
    terms: [
      "skin",
      "dermat",
      "cosmetic",
      "skincare",
      "wound",
      "regenerat",
      "stem cell",
      "exosome",
      "extracellular vesicle",
      "tissue engineering",
    ],
  },
  {
    topic: "Genetics & Molecular Biology",
    terms: [
      "gene",
      "genetic",
      "genomic",
      "crispr",
      "base editing",
      "rna",
      "dna",
      "protein",
      "molecular",
      "epigen",
      "mutation",
    ],
  },
  {
    topic: "Immunology & Infectious Disease",
    terms: [
      "immune",
      "immun",
      "infection",
      "infectious",
      "viral",
      "virus",
      "bacter",
      "vaccine",
      "inflammation",
      "sepsis",
      "antibody",
    ],
  },
];

function occurrenceScore(text: string, term: string) {
  let score = 0;
  let position = text.indexOf(term);
  while (position !== -1) {
    score += 1;
    position = text.indexOf(term, position + term.length);
  }
  return score;
}

export function classifyPaperTopic(
  title: string,
  description = "",
): PaperTopic {
  const normalizedTitle = title.toLowerCase();
  const normalizedDescription = description.toLowerCase();
  let bestTopic: PaperTopic = "General Biomedical Research";
  let bestScore = 0;

  for (const rule of TOPIC_RULES) {
    const score = rule.terms.reduce(
      (total, term) =>
        total +
        occurrenceScore(normalizedTitle, term) * 3 +
        occurrenceScore(normalizedDescription, term),
      0,
    );

    if (score > bestScore) {
      bestTopic = rule.topic;
      bestScore = score;
    }
  }

  return bestTopic;
}
