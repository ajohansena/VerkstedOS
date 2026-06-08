'use client';

import { useState } from 'react';

interface GalleryPhoto {
  id: string;
  filename: string;
  thumbUrl: string | null;
  fullUrl: string | null;
}

interface Group {
  role: string;
  label: string;
  photos: GalleryPhoto[];
}

/**
 * Photo gallery + full-screen viewer (User surface). Shows before/during/after
 * groups of thumbnails; clicking a thumbnail opens a full-screen lightbox.
 * Thumbnails are Supabase transform URLs (or the original when transforms are
 * unavailable). Pure presentation — all URLs are pre-signed server-side.
 */
export function PhotoGallery({
  groups,
  emptyLabel,
}: {
  groups: Group[];
  emptyLabel: string;
}) {
  const [active, setActive] = useState<GalleryPhoto | null>(null);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        {groups.map((group) => (
          <div key={group.role} className="rounded-md border p-2">
            <p className="mb-1 text-xs font-medium">
              {group.label} ({group.photos.length})
            </p>
            {group.photos.length > 0 ? (
              <div className="grid grid-cols-2 gap-1">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setActive(photo)}
                    className="aspect-square overflow-hidden rounded bg-muted"
                    title={photo.filename}
                  >
                    {photo.thumbUrl ? (
                      <img
                        src={photo.thumbUrl}
                        alt={photo.filename}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center px-1 text-[10px] text-muted-foreground">
                        {photo.filename}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{emptyLabel}</p>
            )}
          </div>
        ))}
      </div>

      {active ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-4 top-4 h-11 rounded-md bg-white/10 px-4 text-sm text-white"
          >
            ✕
          </button>
          {active.fullUrl ? (
            <img
              src={active.fullUrl}
              alt={active.filename}
              className="max-h-full max-w-full rounded object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <p className="text-sm text-white">{active.filename}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
