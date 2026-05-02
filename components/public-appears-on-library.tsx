import Image from "next/image";
import Link from "next/link";
import {Play, ExternalLink} from "lucide-react";
import type {AppearsOnRecord} from "@/lib/types";

export function PublicAppearsOnLibrary({
  records,
  emptyText
}: {
  records: AppearsOnRecord[];
  emptyText: string;
}) {
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[34px] border border-white/10 bg-[#0f1217]/92 px-6 py-20 text-center">
        <p className="text-[#8d949d]">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {records.map((record) => {
        const primaryLink = record.spotify_url || record.apple_music_url || record.youtube_url || record.youtube_music_url || "#";
        
        return (
          <Link
            key={record.id}
            href={primaryLink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-3 rounded-2xl border border-transparent p-3 transition hover:border-white/10 hover:bg-[#161a20]"
          >
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[#0f1217]">
              {record.cover_art_url ? (
                <Image
                  src={record.cover_art_url}
                  alt={record.title}
                  fill
                  className="object-cover transition duration-500 group-hover:scale-105"
                  unoptimized
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-[#1c2128]">
                  <Play className="opacity-20" size={32} />
                </div>
              )}
              
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition duration-300 group-hover:opacity-100">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c9a347] text-[#13161a] shadow-lg">
                  <ExternalLink size={20} className="ml-0.5" />
                </div>
              </div>
            </div>

            <div className="px-1">
              <h3 className="truncate font-semibold tracking-[-0.01em] text-[#ece6da]">
                {record.title}
              </h3>
              <p className="truncate text-sm text-[#8d949d] mt-0.5">
                {record.artists}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
