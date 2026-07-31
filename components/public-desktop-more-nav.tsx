"use client";

import {ChevronDown} from "lucide-react";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect, useId, useRef, useState} from "react";

type MoreNavItem = {
  href: string;
  label: string;
};

export function PublicDesktopMoreNav({
  items,
  label
}: {
  items: MoreNavItem[];
  label: string;
}) {
  const pathname = usePathname();
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      ref={containerRef}
    >
      <button
        aria-controls={menuId}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="public-nav-link inline-flex cursor-pointer items-center gap-1.5"
        onClick={() => setIsOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          size={14}
        />
      </button>

      {isOpen ? (
        <div
          className="public-nav-more-panel absolute right-0 top-[calc(100%+0.65rem)] z-50 grid min-w-52 gap-1 p-2 shadow-2xl"
          id={menuId}
          role="menu"
        >
          {items.map((item) => (
            <Link
              className="public-nav-more-link px-4 py-3 text-sm font-semibold transition"
              href={item.href}
              key={item.href}
              onClick={() => setIsOpen(false)}
              role="menuitem"
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
