"use client";
// Search result filters. Desktop: a source chip row and a Published menu.
// Phone: a Filters box whose buttons open a bottom sheet. See the
// "Search results" page of the design canvas.
import React, { useEffect, useId, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import styles from "./search-results.module.scss";
import { PAYMENTS_VISIBLE } from "../lib/payments";
import {
    DATE_FILTERS,
    SOURCE_FILTERS,
    dateFilterLabel,
    sourceFilterLabel,
    type DateFilter,
    type SourceFilter,
} from "../lib/search-filters";

/** While paid plans are hidden, Scholar is only offered to people who can use it. */
function visibleSources(scholarLocked: boolean) {
    return PAYMENTS_VISIBLE || !scholarLocked
        ? SOURCE_FILTERS
        : SOURCE_FILTERS.filter((filter) => !filter.pro);
}

type FiltersProps = {
    source: SourceFilter;
    date: DateFilter;
    onChange: (source: SourceFilter, date: DateFilter) => void;
    /** Show the Pro lock on Scholar (everyone but Pro). */
    scholarLocked: boolean;
};

function ChevronIcon() {
    return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function LockIcon() {
    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

function SlidersIcon() {
    return (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="16" cy="7" r="2" stroke="currentColor" strokeWidth="2" />
            <circle cx="10" cy="17" r="2" stroke="currentColor" strokeWidth="2" />
        </svg>
    );
}

const FOCUSABLE =
    'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function SearchFilterBar({ source, date, onChange, scholarLocked }: FiltersProps) {
    const [menuOpen, setMenuOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!menuOpen) return;
        const wrap = wrapRef.current;
        wrap?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
        const onPointerDown = (event: PointerEvent) => {
            if (!wrap?.contains(event.target as Node)) setMenuOpen(false);
        };
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            setMenuOpen(false);
            buttonRef.current?.focus();
        };
        window.addEventListener("pointerdown", onPointerDown);
        window.addEventListener("keydown", onKeyDown);
        return () => {
            window.removeEventListener("pointerdown", onPointerDown);
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [menuOpen]);

    const moveFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
        );
        const at = items.indexOf(document.activeElement as HTMLElement);
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(at + step + items.length) % items.length]?.focus();
    };

    const pickDate = (next: DateFilter) => {
        setMenuOpen(false);
        buttonRef.current?.focus();
        if (next !== date) onChange(source, next);
    };

    return (
        <div className={styles.filterBar}>
            <div role="group" aria-label="Source" className={styles.sourceGroup}>
                <span className={styles.eyebrow} aria-hidden="true">
                    Source
                </span>
                {visibleSources(scholarLocked).map((filter) => {
                    const on = source === filter.value;
                    return (
                        <button
                            key={filter.value}
                            type="button"
                            aria-pressed={on}
                            className={clsx(styles.sourceChip, on && styles.chipOn)}
                            onClick={() => {
                                if (!on) onChange(filter.value, date);
                            }}
                        >
                            {filter.color ? (
                                <span className={styles.dot} style={{ background: filter.color }} aria-hidden="true" />
                            ) : null}
                            {filter.chipLabel}
                            {filter.pro && scholarLocked ? (
                                <span className={styles.proBadge}>
                                    <LockIcon />
                                    Pro
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
            <div className={styles.dateWrap} ref={wrapRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    className={clsx(styles.dateButton, date !== "any" && styles.chipOn)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    aria-controls={menuOpen ? menuId : undefined}
                    onClick={() => setMenuOpen((open) => !open)}
                >
                    <span className={styles.dateButtonLabel}>Published</span>
                    {dateFilterLabel(date)}
                    <ChevronIcon />
                </button>
                {menuOpen ? (
                    <div
                        id={menuId}
                        role="menu"
                        aria-label="Published"
                        className={styles.dateMenu}
                        onKeyDown={moveFocus}
                    >
                        {DATE_FILTERS.map((filter) => {
                            const on = date === filter.value;
                            return (
                                <button
                                    key={filter.value}
                                    type="button"
                                    role="menuitemradio"
                                    aria-checked={on}
                                    className={clsx(styles.dateItem, on && styles.dateItemOn)}
                                    onClick={() => pickDate(filter.value)}
                                >
                                    {filter.label}
                                    <span aria-hidden="true">{on ? "✓" : ""}</span>
                                </button>
                            );
                        })}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export function SearchFilterBox({ source, date, onChange, scholarLocked }: FiltersProps) {
    const [sheetOpen, setSheetOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const filtered = source !== "all" || date !== "any";

    const openSheet = (event: React.MouseEvent<HTMLButtonElement>) => {
        triggerRef.current = event.currentTarget;
        setSheetOpen(true);
    };

    return (
        <section aria-label="Filters" className={styles.filterBox}>
            <div className={styles.filterBoxHead}>
                <span className={styles.filterBoxTitle}>
                    <SlidersIcon />
                    Filters
                </span>
                {filtered ? (
                    <button
                        type="button"
                        className={styles.filterBoxClear}
                        onClick={() => onChange("all", "any")}
                    >
                        Clear
                    </button>
                ) : null}
            </div>
            <div className={styles.filterBoxButtons}>
                <button
                    type="button"
                    aria-haspopup="dialog"
                    className={clsx(styles.filterPick, source !== "all" && styles.filterPickOn)}
                    onClick={openSheet}
                >
                    <span className={styles.filterPickText}>
                        <span className={styles.filterPickLabel}>Source</span>
                        <span className={styles.filterPickValue}>{sourceFilterLabel(source)}</span>
                    </span>
                    <ChevronIcon />
                </button>
                <button
                    type="button"
                    aria-haspopup="dialog"
                    className={clsx(styles.filterPick, date !== "any" && styles.filterPickOn)}
                    onClick={openSheet}
                >
                    <span className={styles.filterPickText}>
                        <span className={styles.filterPickLabel}>Published</span>
                        <span className={styles.filterPickValue}>{dateFilterLabel(date)}</span>
                    </span>
                    <ChevronIcon />
                </button>
            </div>
            {sheetOpen ? (
                <FilterSheet
                    source={source}
                    date={date}
                    scholarLocked={scholarLocked}
                    returnFocus={triggerRef}
                    onClose={() => setSheetOpen(false)}
                    onApply={(nextSource, nextDate) => {
                        setSheetOpen(false);
                        if (nextSource !== source || nextDate !== date) {
                            onChange(nextSource, nextDate);
                        }
                    }}
                />
            ) : null}
        </section>
    );
}

/** Picks are staged here and applied together, so one search runs, not one per tap. */
function FilterSheet({
    source,
    date,
    scholarLocked,
    returnFocus,
    onClose,
    onApply,
}: {
    source: SourceFilter;
    date: DateFilter;
    scholarLocked: boolean;
    returnFocus: RefObject<HTMLButtonElement | null>;
    onClose: () => void;
    onApply: (source: SourceFilter, date: DateFilter) => void;
}) {
    const [draftSource, setDraftSource] = useState(source);
    const [draftDate, setDraftDate] = useState(date);
    const sheetRef = useRef<HTMLElement>(null);
    const onCloseRef = useRef(onClose);
    const titleId = useId();
    const groupName = useId();

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const sheet = sheetRef.current;
        const returnTo = returnFocus.current;
        sheet?.querySelector<HTMLElement>("input:checked")?.focus();
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
                return;
            }
            if (event.key !== "Tab" || !sheet) return;
            const focusable = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE));
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        };
        document.addEventListener("keydown", onKeyDown);
        return () => {
            document.removeEventListener("keydown", onKeyDown);
            returnTo?.focus();
        };
    }, [returnFocus]);

    return createPortal(
        <div className={styles.sheetLayer}>
            <button
                type="button"
                className={styles.sheetBackdrop}
                aria-label="Close filters"
                tabIndex={-1}
                onClick={onClose}
            />
            <section
                ref={sheetRef}
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <span className={styles.sheetHandle} aria-hidden="true" />
                <div className={styles.sheetHead}>
                    <h2 id={titleId} className={styles.sheetTitle}>
                        Filters
                    </h2>
                    <button type="button" className={styles.sheetClose} aria-label="Close filters" onClick={onClose}>
                        ×
                    </button>
                </div>
                <fieldset className={styles.sheetGroup}>
                    <legend className={styles.sheetLegend}>Source</legend>
                    <div className={styles.sheetSources}>
                        {visibleSources(scholarLocked).map((filter) => (
                            <label
                                key={filter.value}
                                className={clsx(styles.sheetSource, draftSource === filter.value && styles.sheetSourceOn)}
                            >
                                <input
                                    type="radio"
                                    className={styles.srOnly}
                                    name={`${groupName}-source`}
                                    value={filter.value}
                                    checked={draftSource === filter.value}
                                    onChange={() => setDraftSource(filter.value)}
                                />
                                <span
                                    className={styles.sheetDot}
                                    style={{ background: filter.color ?? "#e6eef8" }}
                                    aria-hidden="true"
                                />
                                <span className={styles.sheetSourceName}>
                                    {filter.label}
                                    {filter.pro && scholarLocked ? " · Pro" : ""}
                                </span>
                                <span className={styles.sheetRadio} aria-hidden="true" />
                            </label>
                        ))}
                    </div>
                </fieldset>
                <fieldset className={styles.sheetGroup}>
                    <legend className={styles.sheetLegend}>Published</legend>
                    <div className={styles.sheetDates}>
                        {DATE_FILTERS.map((filter) => (
                            <label
                                key={filter.value}
                                className={clsx(styles.sheetDate, draftDate === filter.value && styles.sheetDateOn)}
                            >
                                <input
                                    type="radio"
                                    className={styles.srOnly}
                                    name={`${groupName}-date`}
                                    value={filter.value}
                                    checked={draftDate === filter.value}
                                    onChange={() => setDraftDate(filter.value)}
                                />
                                {filter.label}
                            </label>
                        ))}
                    </div>
                </fieldset>
                <div className={styles.sheetActions}>
                    <button
                        type="button"
                        className={styles.sheetClear}
                        onClick={() => {
                            setDraftSource("all");
                            setDraftDate("any");
                        }}
                    >
                        Clear
                    </button>
                    <button
                        type="button"
                        className={styles.sheetApply}
                        onClick={() => onApply(draftSource, draftDate)}
                    >
                        Show results
                    </button>
                </div>
            </section>
        </div>,
        document.body,
    );
}
