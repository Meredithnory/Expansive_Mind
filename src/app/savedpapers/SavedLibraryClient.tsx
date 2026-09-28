"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import SavedPaper, { type Paper } from "../components/SavedPaper";
import { LoadingOverlay } from "../components/Loading";
import SharePaperModal from "../components/paperchatbot/SharePaperModal";
import ShareBriefDialog from "../discover/ShareBriefDialog";
import type { SerializedProject } from "../lib/project-types";
import type { HighlightNotesPaper } from "../lib/highlight-notes";
import {
  classifyPaperTopic,
  PAPER_TOPICS,
  type PaperTopic,
} from "../lib/paper-topics";
import {
  PlanIcon,
  PlusIcon,
  SearchIcon,
  ShareIcon,
  TrashIcon,
} from "../components/LibraryIcons";
import HighlightsTab from "./HighlightsTab";
import {
  matchesLibraryQuery,
  nextProjectStep,
  normalizeLibraryQuery,
  plansPerSynthesis,
  projectProgress,
  synthesisGapTitles,
  type LibraryTab,
} from "./library-view";
import styles from "./savedpage.module.scss";

type TopicFilter = "all" | PaperTopic;

type SavedSynthesis = {
  id: string;
  question: string;
  createdAt: string;
  shared?: boolean;
  report?: unknown;
  papers?: unknown[];
  meta?: { papersUsed?: number };
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function paperCount(synthesis: SavedSynthesis) {
  const count = synthesis.meta?.papersUsed ?? synthesis.papers?.length ?? 0;
  return `${count} ${count === 1 ? "paper" : "papers"}`;
}

function SharedBadge() {
  return <span className={styles.sharedBadge}>Shared</span>;
}

type SavedLibraryClientProps = {
  initialTab: LibraryTab;
};

const SavedLibraryClient = ({ initialTab }: SavedLibraryClientProps) => {
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [syntheses, setSyntheses] = useState<SavedSynthesis[]>([]);
  const [projects, setProjects] = useState<SerializedProject[]>([]);
  const [highlights, setHighlights] = useState<HighlightNotesPaper[] | null>(null);
  const [highlightError, setHighlightError] = useState("");
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeTopic, setActiveTopic] = useState<TopicFilter>("all");
  const [sharingPaper, setSharingPaper] = useState<Paper | null>(null);
  const [sharingBriefId, setSharingBriefId] = useState<string | null>(null);
  const closePaperShare = useCallback(() => setSharingPaper(null), []);
  const closeBriefShare = useCallback(() => setSharingBriefId(null), []);
  const query = normalizeLibraryQuery(search);

  const fetchHighlights = useCallback(async () => {
    setHighlightError("");
    try {
      const response = await fetch("/api/highlights/all", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Highlights could not be loaded.");
      }
      setHighlights(Array.isArray(data.papers) ? data.papers : []);
    } catch (err) {
      setHighlightError(
        err instanceof Error ? err.message : "Highlights could not be loaded.",
      );
    }
  }, []);

  const fetchLibrary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [papersResponse, synthesesResponse, projectsResponse] =
        await Promise.all([
          fetch("/api/all-user-papers", { cache: "no-store" }),
          fetch("/api/discover", { cache: "no-store" }),
          fetch("/api/projects", { cache: "no-store" }),
        ]);
      const [papersData, synthesesData, projectsData] = await Promise.all([
        papersResponse.json(),
        synthesesResponse.json(),
        projectsResponse.json(),
      ]);

      if (!papersResponse.ok || !synthesesResponse.ok || !projectsResponse.ok) {
        throw new Error("Some library items could not be loaded.");
      }
      setAllPapers(Array.isArray(papersData.papers) ? papersData.papers : []);
      setSyntheses(
        Array.isArray(synthesesData.discoveries)
          ? synthesesData.discoveries
          : [],
      );
      setProjects(
        Array.isArray(projectsData.projects) ? projectsData.projects : [],
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load your library.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLibrary();
    void fetchHighlights();
  }, [fetchLibrary, fetchHighlights]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const categorizedPapers = useMemo(
    () =>
      allPapers.map((paper) => ({
        paper,
        topic: classifyPaperTopic(paper.title, paper.description),
      })),
    [allPapers],
  );

  const topicCounts = useMemo(
    () =>
      PAPER_TOPICS.map((topic) => ({
        topic,
        count: categorizedPapers.filter((item) => item.topic === topic).length,
      })).filter((item) => item.count > 0),
    [categorizedPapers],
  );

  const visiblePapers = categorizedPapers.filter(
    (item) =>
      (activeTopic === "all" || item.topic === activeTopic) &&
      matchesLibraryQuery(query, item.paper.title, item.paper.authors),
  );
  const visibleSyntheses = syntheses.filter((synthesis) =>
    matchesLibraryQuery(query, synthesis.question),
  );
  const visibleProjects = projects.filter((project) =>
    matchesLibraryQuery(query, project.title),
  );
  const planCounts = useMemo(() => plansPerSynthesis(projects), [projects]);
  const questionsById = useMemo(
    () => new Map(syntheses.map((synthesis) => [synthesis.id, synthesis.question])),
    [syntheses],
  );
  const highlightCount = highlights?.reduce(
    (sum, paper) => sum + paper.highlights.length,
    0,
  );

  const tabs: Array<{ id: LibraryTab; label: string; short?: string; count?: number }> = [
    { id: "syntheses", label: "Syntheses", count: syntheses.length },
    { id: "papers", label: "Papers", count: allPapers.length },
    { id: "projects", label: "Research plans", short: "Plans", count: projects.length },
    { id: "highlights", label: "Highlights", count: highlightCount },
  ];

  async function deletePaper(paper: Paper) {
    setAllPapers((prev) =>
      prev.filter(
        (saved) =>
          !(
            saved.paperId === paper.paperId &&
            saved.idName === paper.idName &&
            saved.primarySource === paper.primarySource
          ),
      ),
    );

    try {
      const res = await fetch("/api/delete-paper", {
        method: "DELETE",
        body: JSON.stringify({
          primarySource: paper.primarySource,
          paperId: paper.paperId,
          idName: paper.idName,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
    } catch (err) {
      console.error("Error deleting paper:", err);
      void fetchLibrary();
    }
  }

  async function deleteSynthesis(synthesis: SavedSynthesis) {
    if (!window.confirm(`Delete “${synthesis.question}”?`)) return;
    setSyntheses((current) =>
      current.filter((item) => item.id !== synthesis.id),
    );
    const response = await fetch("/api/discover", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: synthesis.id }),
    });
    if (!response.ok) void fetchLibrary();
  }

  const markShared = useCallback(() => {
    setSyntheses((current) =>
      current.map((item) =>
        item.id === sharingBriefId ? { ...item, shared: true } : item,
      ),
    );
  }, [sharingBriefId]);

  async function deleteProject(project: SerializedProject) {
    if (!window.confirm(`Delete “${project.title}”?`)) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    if (!response.ok) void fetchLibrary();
  }

  async function removeHighlight(id: string) {
    const previous = highlights;
    setHighlights((current) =>
      (current ?? [])
        .map((paper) => ({
          ...paper,
          highlights: paper.highlights.filter((h) => h.id !== id),
        }))
        .filter((paper) => paper.highlights.length > 0),
    );
    const response = await fetch("/api/highlights", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlightId: id }),
    });
    if (!response.ok) {
      setHighlights(previous);
      void fetchHighlights();
    }
  }

  function showPlans() {
    setSearch("");
    setActiveTab("projects");
  }

  const noMatch = (what: string) => (
    <p className={styles.noMatch}>No {what} match that search.</p>
  );

  function renderSyntheses() {
    if (syntheses.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No topic syntheses yet</p>
          <p className={styles.emptyMessage}>
            Discover analyzes evidence across papers and saves the result here
            automatically.
          </p>
          <Link href="/discover" className={styles.primaryButton}>
            Discover a question
          </Link>
        </div>
      );
    }
    if (visibleSyntheses.length === 0) return noMatch("syntheses");

    const [lead, ...rest] = visibleSyntheses;
    const isNewest = lead.id === syntheses[0]?.id;
    const gaps = synthesisGapTitles(lead.report);
    const plans = planCounts.get(lead.id) ?? 0;

    return (
      <div className={styles.synthesesGrid}>
        <article className={styles.leadCard}>
          <div className={styles.cardTop}>
            <span className={`${styles.kicker} ${styles.kickerPink}`}>
              {isNewest ? "Latest · " : ""}
              {formatDate(lead.createdAt)} · {paperCount(lead)}
            </span>
            {lead.shared ? <SharedBadge /> : null}
          </div>
          <h2 className={styles.leadTitle}>
            <Link href={`/discover?saved=${lead.id}`}>{lead.question}</Link>
          </h2>
          {gaps.length > 0 ? (
            <div className={styles.gapList}>
              <span className={styles.label}>Gaps it found</span>
              {gaps.map((gap, index) => (
                <Link
                  key={`${index}-${gap}`}
                  href={`/discover?saved=${lead.id}`}
                  className={styles.gapRow}
                >
                  <strong className={index === 0 ? styles.gapFirst : undefined}>
                    Gap {index + 1}
                  </strong>
                  {gap}
                </Link>
              ))}
            </div>
          ) : null}
          {plans > 0 ? (
            <button type="button" className={styles.planLink} onClick={showPlans}>
              <span className={styles.planLinkText}>
                <span className={styles.planIcon}>
                  <PlanIcon />
                </span>
                <span>
                  {plans} research {plans === 1 ? "plan" : "plans"}
                  <span className={styles.desktopOnly}>
                    {" "}
                    started from this synthesis
                  </span>
                </span>
              </span>
              <span className={styles.planLinkCta}>See plans →</span>
            </button>
          ) : null}
          <div className={styles.leadActions}>
            <Link href={`/discover?saved=${lead.id}`} className={styles.ghostButton}>
              <span>
                Open<span className={styles.desktopOnly}> synthesis</span>
              </span>
            </Link>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setSharingBriefId(lead.id)}
            >
              <ShareIcon />
              Share brief
            </button>
            <button
              type="button"
              className={styles.iconButton}
              aria-label={`Delete “${lead.question}”`}
              onClick={() => void deleteSynthesis(lead)}
            >
              <TrashIcon />
            </button>
          </div>
        </article>
        {rest.length > 0 ? (
          <div className={styles.synthesisList}>
            {rest.map((synthesis) => (
              <article key={synthesis.id} className={styles.synthesisCard}>
                <div className={styles.cardTop}>
                  <span className={styles.kicker}>
                    {formatDate(synthesis.createdAt)} · {paperCount(synthesis)}
                  </span>
                  {synthesis.shared ? <SharedBadge /> : null}
                </div>
                <h2>
                  <Link href={`/discover?saved=${synthesis.id}`}>
                    {synthesis.question}
                  </Link>
                </h2>
                <div className={styles.inlineActions}>
                  <Link href={`/discover?saved=${synthesis.id}`}>
                    <span>
                      Open<span className={styles.desktopOnly}> synthesis</span>
                    </span>
                    <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSharingBriefId(synthesis.id)}
                  >
                    Share brief
                  </button>
                  <button
                    type="button"
                    className={styles.quietIcon}
                    aria-label={`Delete “${synthesis.question}”`}
                    onClick={() => void deleteSynthesis(synthesis)}
                  >
                    <TrashIcon size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderPapers() {
    if (allPapers.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No saved papers yet</p>
          <p className={styles.emptyMessage}>
            Open a paper from a synthesis or quick search and save it here for
            later.
          </p>
          <Link href="/discover?mode=search" className={styles.primaryButton}>
            Search papers
          </Link>
        </div>
      );
    }
    return (
      <div className={styles.tabPanel}>
        <div
          className={styles.chipRow}
          role="group"
          aria-label="Filter papers by research area"
        >
          <span className={styles.chipLabel}>Research areas</span>
          <button
            type="button"
            aria-pressed={activeTopic === "all"}
            className={styles.chip}
            onClick={() => setActiveTopic("all")}
          >
            All <span className={styles.chipCount}>{allPapers.length}</span>
          </button>
          {topicCounts.map(({ topic, count }) => (
            <button
              key={topic}
              type="button"
              aria-pressed={activeTopic === topic}
              className={styles.chip}
              onClick={() => setActiveTopic(topic)}
            >
              {topic} <span className={styles.chipCount}>{count}</span>
            </button>
          ))}
        </div>
        {visiblePapers.length === 0 ? (
          noMatch("saved papers")
        ) : (
          <ul className={styles.paperList} aria-label="Saved papers">
            {visiblePapers.map(({ paper, topic }) => (
              <li key={`${paper.primarySource}-${paper.idName}-${paper.paperId}`}>
                <SavedPaper
                  page={paper}
                  topic={topic}
                  deletePaper={deletePaper}
                  onShare={setSharingPaper}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function renderProjects() {
    if (projects.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No research plans yet</p>
          <p className={styles.emptyMessage}>
            Start with Discover, then turn a promising evidence gap into a
            step-by-step plan.
          </p>
          <Link href="/discover" className={styles.primaryButton}>
            Find a research gap
          </Link>
        </div>
      );
    }
    if (visibleProjects.length === 0) return noMatch("research plans");
    return (
      <div className={styles.planGrid}>
        {visibleProjects.map((project) => {
          const progress = projectProgress(project);
          const next = nextProjectStep(project);
          const source = project.sourceDiscoveryID
            ? questionsById.get(project.sourceDiscoveryID)
            : undefined;
          const percent =
            progress.total > 0
              ? Math.round((progress.done / progress.total) * 100)
              : 0;
          return (
            <article key={project.id} className={styles.planCard}>
              <span className={`${styles.kicker} ${styles.kickerAmber}`}>
                Research plan · {formatDate(project.createdAt)}
              </span>
              <h2>
                <Link href={`/projects/${project.id}`}>{project.title}</Link>
              </h2>
              {source && project.sourceDiscoveryID ? (
                <p className={styles.planSource}>
                  From{" "}
                  <Link href={`/discover?saved=${project.sourceDiscoveryID}`}>
                    {source}
                  </Link>
                </p>
              ) : null}
              {progress.total > 0 ? (
                <div className={styles.progress}>
                  <span>
                    {progress.done} of {progress.total} steps done
                  </span>
                  <span className={styles.progressTrack} aria-hidden="true">
                    <span style={{ width: `${percent}%` }} />
                  </span>
                </div>
              ) : null}
              {next ? (
                <div className={styles.nextStep}>
                  <span className={styles.label}>Next step</span>
                  <span>{next}</span>
                </div>
              ) : null}
              <div className={styles.leadActions}>
                <Link href={`/projects/${project.id}`} className={styles.ghostButton}>
                  Open plan <span aria-hidden="true">→</span>
                </Link>
                <button
                  type="button"
                  className={styles.iconButton}
                  aria-label={`Delete “${project.title}”`}
                  onClick={() => void deleteProject(project)}
                >
                  <TrashIcon />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  let content: React.ReactNode;
  if (activeTab === "highlights") {
    content = (
      <HighlightsTab
        papers={highlights}
        error={highlightError}
        query={query}
        onRetry={() => void fetchHighlights()}
        onRemove={(id) => void removeHighlight(id)}
      />
    );
  } else if (loading) {
    content = (
      <div className={styles.skeletonList} aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div key={item} className={`${styles.skeletonCard} loading-skeleton`} />
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <div className={styles.emptyState}>
        <p className={styles.emptyTitle}>Library unavailable</p>
        <p className={styles.emptyMessage}>{error}</p>
        <button type="button" className={styles.primaryButton} onClick={fetchLibrary}>
          Try again
        </button>
      </div>
    );
  } else if (activeTab === "syntheses") {
    content = renderSyntheses();
  } else if (activeTab === "papers") {
    content = renderPapers();
  } else {
    content = renderProjects();
  }

  return (
    <>
      <LoadingOverlay visible={loading} label="Loading your library…" />
      <header className={styles.libraryHeader}>
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>Your workspace</p>
          <h1>Research Library</h1>
          <p>
            Papers you read, topic syntheses you generated, and research plans
            you are moving forward.
          </p>
        </div>
        <div className={styles.headerActions}>
          <label className={styles.search}>
            <SearchIcon />
            <input
              type="search"
              aria-label="Search your library"
              placeholder="Search your library"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Link href="/discover" className={styles.primaryButton}>
            <PlusIcon />
            Start a discovery
          </Link>
        </div>
      </header>
      <div className={styles.tabs} role="tablist" aria-label="Library">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.short ? (
              <>
                <span className={styles.desktopOnly}>{tab.label}</span>
                <span className={styles.phoneOnly}>{tab.short}</span>
              </>
            ) : (
              tab.label
            )}
            {tab.count != null ? ` · ${tab.count}` : null}
          </button>
        ))}
      </div>
      <div key={activeTab} className={styles.tabContent}>
        {content}
      </div>
      {sharingPaper ? (
        <SharePaperModal
          open
          onClose={closePaperShare}
          paper={{
            source: sharingPaper.database,
            paperId: sharingPaper.paperId,
            idName: sharingPaper.idName,
            title: sharingPaper.title,
          }}
        />
      ) : null}
      {sharingBriefId ? (
        <ShareBriefDialog
          discoveryId={sharingBriefId}
          onClose={closeBriefShare}
          onShared={markShared}
        />
      ) : null}
    </>
  );
};

export default SavedLibraryClient;
