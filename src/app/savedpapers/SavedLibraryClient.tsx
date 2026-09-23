"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import SavedPaper from "../components/SavedPaper";
import { Paper } from "../components/SavedPaper";
import styles from "./savedpage.module.scss";
import Link from "next/link";
import { LoadingOverlay } from "../components/Loading";
import type { SerializedProject } from "../lib/project-types";
import {
  classifyPaperTopic,
  PAPER_TOPICS,
  type PaperTopic,
} from "../lib/paper-topics";

const PAPERS_PER_PAGE = 6;
type LibraryTab = "papers" | "syntheses" | "projects";
type TopicFilter = "all" | PaperTopic;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Desktop: horizontal snap carousel. Mobile CSS restores a vertical stack. */
function PaperGroupCarousel({
  topic,
  papers,
  deletePaper,
}: {
  topic: string;
  papers: Paper[];
  deletePaper: (paper: Paper) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateOverflow = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const overflowing = max > 4;
    setCanPrev(overflowing && el.scrollLeft > 4);
    setCanNext(overflowing && el.scrollLeft < max - 4);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateOverflow();
    el.addEventListener("scroll", updateOverflow, { passive: true });
    const ro = new ResizeObserver(updateOverflow);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateOverflow);
      ro.disconnect();
    };
  }, [papers.length, updateOverflow]);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>(`.${styles.carouselSlide}`);
    const amount = slide ? slide.offsetWidth + 12 : Math.max(280, el.clientWidth * 0.75);
    el.scrollBy({
      left: direction * amount,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const showArrows = canPrev || canNext;

  return (
    <div
      className={styles.paperCarousel}
      data-single={papers.length === 1 ? "true" : undefined}
    >
      {showArrows ? (
        <button
          type="button"
          className={styles.carouselPrev}
          aria-label={`Previous ${topic} papers`}
          disabled={!canPrev}
          onClick={() => scrollByCard(-1)}
        >
          <span aria-hidden="true">‹</span>
        </button>
      ) : null}
      <div
        ref={scrollerRef}
        className={styles.paperGroupList}
        role="list"
        aria-label={`${topic} papers`}
      >
        {papers.map((page) => (
          <div
            className={styles.carouselSlide}
            role="listitem"
            key={`${page.primarySource}-${page.idName}-${page.paperId}`}
          >
            <SavedPaper page={page} isLink={true} deletePaper={deletePaper} />
          </div>
        ))}
      </div>
      {showArrows ? (
        <button
          type="button"
          className={styles.carouselNext}
          aria-label={`Next ${topic} papers`}
          disabled={!canNext}
          onClick={() => scrollByCard(1)}
        >
          <span aria-hidden="true">›</span>
        </button>
      ) : null}
    </div>
  );
}

type SavedSynthesis = {
  id: string;
  question: string;
  createdAt: string;
  papers?: unknown[];
  meta?: { papersUsed?: number };
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function projectProgress(project: SerializedProject) {
  return {
    done: project.plan.filter((step) => step.status === "done").length,
    total: project.plan.length,
  };
}

type SavedLibraryClientProps = {
  initialTab: LibraryTab;
  header: ReactNode;
};

const SavedLibraryClient = ({
  initialTab,
  header,
}: SavedLibraryClientProps) => {
  const [allPapers, setAllPapers] = useState<Paper[]>([]);
  const [syntheses, setSyntheses] = useState<SavedSynthesis[]>([]);
  const [projects, setProjects] = useState<SerializedProject[]>([]);
  const [activeTab, setActiveTab] = useState<LibraryTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTopic, setActiveTopic] = useState<TopicFilter>("all");

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
  }, [fetchLibrary]);

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

  const filteredPapers = useMemo(
    () =>
      activeTopic === "all"
        ? categorizedPapers
        : categorizedPapers.filter((item) => item.topic === activeTopic),
    [activeTopic, categorizedPapers],
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPapers.length / PAPERS_PER_PAGE),
  );

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const startIndex = (currentPage - 1) * PAPERS_PER_PAGE;
  const visiblePapers = filteredPapers.slice(
    startIndex,
    startIndex + PAPERS_PER_PAGE,
  );
  const visiblePaperGroups = PAPER_TOPICS.map((topic) => ({
    topic,
    papers: visiblePapers
      .filter((item) => item.topic === topic)
      .map((item) => item.paper),
  })).filter((group) => group.papers.length > 0);
  const counts = useMemo(
    () => ({
      papers: allPapers.length,
      syntheses: syntheses.length,
      projects: projects.length,
    }),
    [allPapers.length, projects.length, syntheses.length],
  );

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

  async function deleteProject(project: SerializedProject) {
    if (!window.confirm(`Delete “${project.title}”?`)) return;
    setProjects((current) => current.filter((item) => item.id !== project.id));
    const response = await fetch(`/api/projects/${project.id}`, {
      method: "DELETE",
    });
    if (!response.ok) void fetchLibrary();
  }

  const tabs: Array<{ id: LibraryTab; label: string }> = [
    { id: "papers", label: "Papers" },
    { id: "syntheses", label: "Syntheses" },
    { id: "projects", label: "Research plans" },
  ];

  return (
    <>
      <LoadingOverlay visible={loading} label="Loading your library…" />
      {header}
      <div className={styles.tabs} role="tablist" aria-label="Library">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? styles.activeTab : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label} <span>{counts[tab.id]}</span>
          </button>
        ))}
      </div>
      {loading ? (
        <div className={styles.savedPapersSkeleton} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className={`${styles.savedPaperSkeletonCard} loading-skeleton`}
            />
          ))}
        </div>
      ) : error ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Library unavailable</p>
          <p className={styles.emptyMessage}>{error}</p>
          <button className={styles.searchButton} onClick={fetchLibrary}>
            Try again
          </button>
        </div>
      ) : activeTab === "papers" ? (
        allPapers.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No saved papers yet</p>
            <p className={styles.emptyMessage}>
              Open a paper from a synthesis or quick search and save it here for
              later.
            </p>
            <Link href="/discover?mode=search" className={styles.searchButton}>
              Search papers
            </Link>
          </div>
        ) : (
          <>
            <div
              className={styles.topicFilters}
              aria-label="Filter papers by research area"
            >
              <span className={styles.topicFilterLabel}>Research areas</span>
              <div className={styles.topicFilterScroller}>
                <button
                  type="button"
                  aria-pressed={activeTopic === "all"}
                  className={
                    activeTopic === "all" ? styles.activeTopicFilter : ""
                  }
                  onClick={() => {
                    setActiveTopic("all");
                    setCurrentPage(1);
                  }}
                >
                  All <span>{allPapers.length}</span>
                </button>
                {topicCounts.map(({ topic, count }) => (
                  <button
                    key={topic}
                    type="button"
                    aria-pressed={activeTopic === topic}
                    className={
                      activeTopic === topic ? styles.activeTopicFilter : ""
                    }
                    onClick={() => {
                      setActiveTopic(topic);
                      setCurrentPage(1);
                    }}
                  >
                    {topic} <span>{count}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.allpapers}>
              {visiblePaperGroups.map(({ topic, papers }) => (
                <section className={styles.paperGroup} key={topic}>
                  <header className={styles.paperGroupHeader}>
                    <span aria-hidden="true" />
                    <h2>{topic}</h2>
                    <span>{papers.length}</span>
                  </header>
                  <PaperGroupCarousel
                    topic={topic}
                    papers={papers}
                    deletePaper={deletePaper}
                  />
                </section>
              ))}
            </div>
            {totalPages > 1 ? (
              <div className={styles.pagination}>
                <button
                  className={styles.pagebutton}
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Previous
                </button>

                <span className={styles.pagenumber}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className={styles.pagebutton}
                  type="button"
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )
      ) : activeTab === "syntheses" ? (
        syntheses.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyTitle}>No topic syntheses yet</p>
            <p className={styles.emptyMessage}>
              Discover analyzes evidence across papers and saves the result here
              automatically.
            </p>
            <Link href="/discover" className={styles.searchButton}>
              Discover a question
            </Link>
          </div>
        ) : (
          <div className={styles.libraryList}>
            {syntheses.map((synthesis) => (
              <article key={synthesis.id} className={styles.libraryCard}>
                <Link href={`/discover?saved=${synthesis.id}`}>
                  <span className={styles.cardKicker}>Topic synthesis</span>
                  <h2>{synthesis.question}</h2>
                  <p>
                    {formatDate(synthesis.createdAt)} ·{" "}
                    {synthesis.meta?.papersUsed ??
                      synthesis.papers?.length ??
                      0}{" "}
                    papers
                  </p>
                </Link>
                <div className={styles.cardActions}>
                  <Link href={`/discover?saved=${synthesis.id}`}>
                    Open synthesis <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteSynthesis(synthesis)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : projects.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No research plans yet</p>
          <p className={styles.emptyMessage}>
            Start with Discover, then turn a promising evidence gap into a
            step-by-step plan.
          </p>
          <Link href="/discover" className={styles.searchButton}>
            Find a research gap
          </Link>
        </div>
      ) : (
        <div className={styles.libraryList}>
          {projects.map((project) => {
            const progress = projectProgress(project);
            return (
              <article key={project.id} className={styles.libraryCard}>
                <Link href={`/projects/${project.id}`}>
                  <span className={styles.cardKicker}>Research plan</span>
                  <h2>{project.title}</h2>
                  <p>
                    {formatDate(project.createdAt)} · {progress.done}/
                    {progress.total} steps done
                  </p>
                </Link>
                <div className={styles.cardActions}>
                  <Link href={`/projects/${project.id}`}>
                    Open plan <span aria-hidden="true">→</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteProject(project)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
};

export default SavedLibraryClient;
