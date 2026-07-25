"use client";

import {
  type KeyboardEvent,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {createPortal} from "react-dom";
import {Check, ChevronDown, Search, X} from "lucide-react";

export type ReleasePickerOption = {
  id: string;
  title: string;
  slug?: string;
  release_date?: string;
  collaborator_name?: string;
  status?: string;
  type?: string;
  upc?: string;
  isrc?: string;
};

type EmptyOption = {
  label: string;
  value: string;
};

type PopoverPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const RECENT_RELEASES_KEY = "vvviruz-command-center:recent-release-ids";
const MAX_RECENT_RELEASES = 5;

function normalizeSearchValue(value: string | undefined) {
  return (value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getReleaseSearchText(release: ReleasePickerOption) {
  return [
    release.title,
    release.collaborator_name,
    release.slug,
    release.upc,
    release.isrc,
    release.release_date,
    release.type,
    release.status
  ]
    .map(normalizeSearchValue)
    .filter(Boolean)
    .join(" ");
}

function readRecentReleaseIds() {
  try {
    const stored = window.localStorage.getItem(RECENT_RELEASES_KEY);
    const values = stored ? JSON.parse(stored) : [];
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function rememberReleaseId(releaseId: string) {
  if (!releaseId) {
    return;
  }

  try {
    const nextIds = [
      releaseId,
      ...readRecentReleaseIds().filter((currentId) => currentId !== releaseId)
    ].slice(0, MAX_RECENT_RELEASES);

    window.localStorage.setItem(RECENT_RELEASES_KEY, JSON.stringify(nextIds));
  } catch {
    // Selection still works when storage is unavailable.
  }
}

export function ReleasePicker({
  releases,
  value,
  defaultValue = "",
  onValueChange,
  name,
  emptyOption,
  placeholder = "Select a release",
  searchPlaceholder = "Search title, collaborator, slug, UPC, or ISRC",
  ariaLabel = "Select release",
  className = "",
  disabled = false
}: {
  releases: ReleasePickerOption[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (releaseId: string) => void;
  name?: string;
  emptyOption?: EmptyOption;
  placeholder?: string;
  searchPlaceholder?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    defaultValue || (!emptyOption ? releases[0]?.id || "" : "")
  );
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recentReleaseIds, setRecentReleaseIds] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [popoverPosition, setPopoverPosition] = useState<PopoverPosition | null>(null);
  const selectedValue = (isControlled ? value : internalValue) || "";
  const selectedRelease = releases.find((release) => release.id === selectedValue) ?? null;
  const selectedLabel =
    selectedRelease?.title ||
    (emptyOption?.value === selectedValue ? emptyOption.label : "") ||
    placeholder;

  useEffect(() => {
    setRecentReleaseIds(readRecentReleaseIds());
  }, []);

  const orderedReleases = useMemo(() => {
    const recentOrder = new Map(
      recentReleaseIds.map((releaseId, index) => [releaseId, index])
    );

    return releases
      .map((release, index) => ({release, originalIndex: index}))
      .sort((left, right) => {
        const leftRecent = recentOrder.get(left.release.id);
        const rightRecent = recentOrder.get(right.release.id);

        if (leftRecent !== undefined || rightRecent !== undefined) {
          if (leftRecent === undefined) return 1;
          if (rightRecent === undefined) return -1;
          return leftRecent - rightRecent;
        }

        return left.originalIndex - right.originalIndex;
      })
      .map(({release}) => release);
  }, [recentReleaseIds, releases]);

  const filteredReleases = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(query);

    if (!normalizedQuery) {
      return orderedReleases;
    }

    return orderedReleases
      .filter((release) => getReleaseSearchText(release).includes(normalizedQuery))
      .sort((left, right) => {
        const leftTitle = normalizeSearchValue(left.title);
        const rightTitle = normalizeSearchValue(right.title);
        const leftStarts = leftTitle.startsWith(normalizedQuery);
        const rightStarts = rightTitle.startsWith(normalizedQuery);

        if (leftStarts !== rightStarts) {
          return leftStarts ? -1 : 1;
        }

        return leftTitle.localeCompare(rightTitle);
      });
  }, [orderedReleases, query]);

  const visibleOptions = useMemo(
    () => [
      ...(emptyOption &&
      (!query || normalizeSearchValue(emptyOption.label).includes(normalizeSearchValue(query)))
        ? [{kind: "empty" as const, id: emptyOption.value, label: emptyOption.label}]
        : []),
      ...filteredReleases.map((release) => ({
        kind: "release" as const,
        id: release.id,
        label: release.title,
        release
      }))
    ],
    [emptyOption, filteredReleases, query]
  );

  function updatePopoverPosition() {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gutter = 12;
    const gap = 6;
    const desiredWidth = Math.min(
      Math.max(rect.width, 340),
      Math.max(280, viewportWidth - gutter * 2)
    );
    const left = Math.min(
      Math.max(gutter, rect.left),
      Math.max(gutter, viewportWidth - desiredWidth - gutter)
    );
    const spaceBelow = viewportHeight - rect.bottom - gutter - gap;
    const spaceAbove = rect.top - gutter - gap;
    const openAbove = spaceBelow < 260 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(220, Math.min(420, openAbove ? spaceAbove : spaceBelow));
    const top = openAbove
      ? Math.max(gutter, rect.top - maxHeight - gap)
      : Math.min(viewportHeight - gutter - maxHeight, rect.bottom + gap);

    setPopoverPosition({left, top, width: desiredWidth, maxHeight});
  }

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePopoverPosition();
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());

    function handleViewportChange() {
      updatePopoverPosition();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;

      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function selectValue(nextValue: string) {
    if (!isControlled) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);

    if (nextValue) {
      rememberReleaseId(nextValue);
      setRecentReleaseIds(readRecentReleaseIds());
    }

    setIsOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        visibleOptions.length ? Math.min(current + 1, visibleOptions.length - 1) : 0
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = visibleOptions[activeIndex];

      if (activeOption) {
        selectValue(activeOption.id);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      setQuery("");
      triggerRef.current?.focus();
    }
  }

  const popover =
    isOpen && popoverPosition
      ? createPortal(
          <div
            className="z-[100] overflow-hidden rounded-xl border border-edge bg-[#111419] shadow-[0_24px_80px_rgba(0,0,0,0.62)]"
            ref={popoverRef}
            style={{
              left: popoverPosition.left,
              maxHeight: popoverPosition.maxHeight,
              position: "fixed",
              top: popoverPosition.top,
              width: popoverPosition.width
            }}
          >
            <div className="border-b border-edge p-3">
              <div className="flex items-center gap-2 rounded-lg border border-edge bg-input px-3 focus-within:border-brand-primary/60">
                <Search aria-hidden="true" className="shrink-0 text-muted" size={15} />
                <input
                  aria-controls={listboxId}
                  aria-label="Search releases"
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  ref={searchInputRef}
                  value={query}
                />
                {query ? (
                  <button
                    aria-label="Clear release search"
                    className="rounded p-1 text-muted transition hover:bg-surface-hover hover:text-ink"
                    onClick={() => setQuery("")}
                    type="button"
                  >
                    <X aria-hidden="true" size={14} />
                  </button>
                ) : null}
              </div>
            </div>

            <div
              aria-label="Release options"
              className="overflow-y-auto p-2"
              id={listboxId}
              role="listbox"
              style={{maxHeight: Math.max(150, popoverPosition.maxHeight - 70)}}
            >
              {visibleOptions.length ? (
                visibleOptions.map((option, index) => {
                  const isSelected = option.id === selectedValue;
                  const isActive = index === activeIndex;

                  return (
                    <button
                      aria-selected={isSelected}
                      className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                        isActive
                          ? "bg-brand-primary-soft text-ink"
                          : "text-secondary hover:bg-surface-hover hover:text-ink"
                      }`}
                      id={`${listboxId}-option-${index}`}
                      key={`${option.kind}:${option.id || "empty"}`}
                      onClick={() => selectValue(option.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      role="option"
                      type="button"
                    >
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-semibold">
                          {option.label}
                        </span>
                        {option.kind === "release" ? (
                          <span className="mt-1 block text-[11px] uppercase tracking-[0.12em] text-muted">
                            {[
                              option.release.release_date,
                              option.release.type,
                              option.release.status,
                              option.release.collaborator_name
                                ? `with ${option.release.collaborator_name}`
                                : ""
                            ]
                              .filter(Boolean)
                              .join(" / ")}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check
                          aria-hidden="true"
                          className="mt-0.5 shrink-0 text-brand-primary"
                          size={16}
                        />
                      ) : null}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-secondary">No releases found</p>
                  <p className="mt-1 text-xs text-muted">Try a title, collaborator, slug, UPC, or ISRC.</p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative ${className}`}>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="field-input flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((current) => !current);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen(true);
          } else if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
        ref={triggerRef}
        role="combobox"
        type="button"
      >
        <span className={`min-w-0 truncate ${selectedRelease ? "font-semibold text-ink" : "text-muted"}`}>
          {selectedLabel}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      {popover}
    </div>
  );
}
