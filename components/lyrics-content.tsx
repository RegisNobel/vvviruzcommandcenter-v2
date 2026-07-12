import type {ReactNode} from "react";

import {parseLyrics} from "@/lib/lyrics";

type LyricsContentProps = {
  lyrics: string;
  className?: string;
  headingClassName?: string;
  lineClassName?: string;
  spacerClassName?: string;
  emptyState?: ReactNode;
};

export function LyricsContent({
  lyrics,
  className = "",
  headingClassName = "",
  lineClassName = "",
  spacerClassName = "h-4",
  emptyState = null
}: LyricsContentProps) {
  const tokens = parseLyrics(lyrics);

  if (tokens.length === 0) {
    return emptyState;
  }

  return (
    <div className={`min-w-0 max-w-full ${className}`.trim()}>
      {tokens.map((token) => {
        if (token.type === "heading") {
          return (
            <h3
              className={`max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${headingClassName}`.trim()}
              key={token.key}
            >
              {token.text}
            </h3>
          );
        }

        if (token.type === "spacer") {
          return (
            <div
              aria-hidden="true"
              className={spacerClassName}
              key={token.key}
            />
          );
        }

        return (
          <div
            className={`max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${lineClassName}`.trim()}
            key={token.key}
          >
            {token.text}
          </div>
        );
      })}
    </div>
  );
}
