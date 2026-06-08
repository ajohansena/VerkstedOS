'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  createPhotoUploadAction,
  finalizePhotoAction,
  type UploadTicket,
} from '@/app/actions/documents';

type Category = 'before' | 'during' | 'after';

interface Labels {
  before: string;
  during: string;
  after: string;
  drop: string;
  choose: string;
  camera: string;
  uploading: string;
  done: string;
  failed: string;
}

interface FileProgress {
  id: string;
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
}

/**
 * Photo uploader (User surface, mobile-first). Drag & drop, mobile camera
 * capture, and multiple-file selection. Each file: mint a signed URL (server
 * action) → PUT bytes DIRECTLY to Supabase Storage with progress → finalize.
 * The bytes never pass through the app server. Glove-friendly large targets.
 */
export function PhotoUploader({
  caseId,
  labels,
}: {
  caseId: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>('before');
  const [files, setFiles] = useState<FileProgress[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (file: File): Promise<void> => {
      const localId = `${file.name}-${Date.now()}-${Math.random()}`;
      setFiles((prev) => [
        ...prev,
        { id: localId, name: file.name, progress: 0, status: 'uploading' },
      ]);

      const ticket: UploadTicket = await createPhotoUploadAction({
        caseId,
        category,
        filename: file.name,
        contentType: file.type,
        byteSize: file.size,
      });

      if (!ticket.ok) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === localId ? { ...f, status: 'error', progress: 0 } : f,
          ),
        );
        return;
      }

      await new Promise<void>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', ticket.signedUrl, true);
        xhr.setRequestHeader('x-upsert', 'true');
        if (file.type) xhr.setRequestHeader('content-type', file.type);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setFiles((prev) =>
              prev.map((f) => (f.id === localId ? { ...f, progress: pct } : f)),
            );
          }
        };
        xhr.onload = async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            await finalizePhotoAction(ticket.documentId);
            setFiles((prev) =>
              prev.map((f) =>
                f.id === localId ? { ...f, status: 'done', progress: 100 } : f,
              ),
            );
          } else {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === localId ? { ...f, status: 'error' } : f,
              ),
            );
          }
          resolve();
        };
        xhr.onerror = () => {
          setFiles((prev) =>
            prev.map((f) => (f.id === localId ? { ...f, status: 'error' } : f)),
          );
          resolve();
        };
        xhr.send(file);
      });
    },
    [caseId, category],
  );

  const handleFiles = useCallback(
    async (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const images = Array.from(list).filter((f) =>
        f.type.startsWith('image/'),
      );
      for (const file of images) {
        await uploadOne(file);
      }
      router.refresh();
    },
    [uploadOne, router],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['before', labels.before],
            ['during', labels.during],
            ['after', labels.after],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`h-11 rounded-md border px-4 text-sm font-medium ${
              category === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-6 text-center text-sm ${
          dragging ? 'border-primary bg-muted/50' : 'border-input'
        }`}
      >
        <p className="text-muted-foreground">{labels.drop}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => fileInput.current?.click()}
          >
            {labels.choose}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => cameraInput.current?.click()}
          >
            {labels.camera}
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="truncate">{f.name}</span>
                <span className="text-muted-foreground">
                  {f.status === 'uploading'
                    ? `${labels.uploading} ${f.progress}%`
                    : f.status === 'done'
                      ? labels.done
                      : labels.failed}
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                <div
                  className={`h-1.5 rounded-full ${
                    f.status === 'error' ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${f.progress}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
