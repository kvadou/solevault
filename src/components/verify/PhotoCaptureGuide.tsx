"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Check, ChevronLeft, ChevronRight, Upload, X } from "lucide-react";

const REQUIRED_ANGLES = [
  { key: "left_side", label: "Left Side", description: "Full left profile at eye level" },
  { key: "right_side", label: "Right Side", description: "Full right profile at eye level" },
  { key: "sole", label: "Sole", description: "Bottom of shoe, flat against surface" },
  { key: "tongue_tag", label: "Tongue Tag", description: "Close-up of the tongue label" },
  { key: "heel_tab", label: "Heel Tab", description: "Back of the shoe, heel area" },
  { key: "box_label", label: "Box Label", description: "Label on the shoe box" },
] as const;

export type CapturedPhotos = Record<string, string>;

interface PhotoCaptureGuideProps {
  onComplete: (photos: CapturedPhotos) => void;
  onCancel: () => void;
}

export function PhotoCaptureGuide({ onComplete, onCancel }: PhotoCaptureGuideProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhotos>({});
  const [urlInput, setUrlInput] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);

    if (file.size > MAX_FILE_SIZE) {
      setFileError("File is too large. Maximum size is 10MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotos((prev) => ({ ...prev, [currentAngle.key]: dataUrl }));
      // Auto-advance to next unfilled angle
      if (currentIndex < REQUIRED_ANGLES.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const completedCount = Object.keys(photos).length;
  const currentAngle = REQUIRED_ANGLES[currentIndex];
  const isComplete = completedCount === REQUIRED_ANGLES.length;

  function handleAddPhoto() {
    if (!urlInput.trim()) return;
    setPhotos((prev) => ({ ...prev, [currentAngle.key]: urlInput.trim() }));
    setUrlInput("");
    // Auto-advance to next unfilled angle
    if (currentIndex < REQUIRED_ANGLES.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  }

  function handleRemovePhoto(key: string) {
    setPhotos((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            Photo {completedCount}/{REQUIRED_ANGLES.length}
          </span>
          <button
            onClick={onCancel}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
            style={{ width: `${(completedCount / REQUIRED_ANGLES.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Angle selector dots */}
      <div className="flex items-center justify-center gap-2">
        {REQUIRED_ANGLES.map((angle, idx) => (
          <button
            key={angle.key}
            onClick={() => setCurrentIndex(idx)}
            className={`h-3 w-3 rounded-full transition-colors ${
              idx === currentIndex
                ? "bg-[var(--accent)] scale-125"
                : photos[angle.key]
                ? "bg-green-500"
                : "bg-[var(--border)]"
            }`}
            title={angle.label}
          />
        ))}
      </div>

      {/* Current angle card */}
      <div className="rounded-lg border border-[var(--border)] overflow-hidden">
        <div className="aspect-[4/3] relative bg-[var(--muted)] flex items-center justify-center">
          {photos[currentAngle.key] ? (
            <Image
              src={photos[currentAngle.key]}
              alt={currentAngle.label}
              fill
              className="object-cover"
            />
          ) : (
            <div className="text-center space-y-2 p-6">
              <Camera className="h-12 w-12 text-[var(--muted-foreground)] mx-auto" />
              <p className="text-lg font-semibold">{currentAngle.label}</p>
              <p className="text-sm text-[var(--muted-foreground)]">
                {currentAngle.description}
              </p>
            </div>
          )}

          {photos[currentAngle.key] && (
            <button
              onClick={() => handleRemovePhoto(currentAngle.key)}
              className="absolute top-2 right-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* File upload / URL input for adding photo */}
        {!photos[currentAngle.key] && (
          <div className="p-4 space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <Upload className="h-4 w-4" />
              Take Photo or Choose File
            </button>
            {fileError && (
              <p className="text-xs text-red-500">{fileError}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span className="flex-1 border-t border-[var(--border)]" />
              or enter image URL
              <span className="flex-1 border-t border-[var(--border)]" />
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddPhoto()}
                placeholder="https://..."
                className="flex-1 rounded-md border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              />
              <button
                onClick={handleAddPhoto}
                disabled={!urlInput.trim()}
                className="rounded-md bg-[var(--muted)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--border)] transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>

        {isComplete ? (
          <button
            onClick={() => onComplete(photos)}
            className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors inline-flex items-center gap-2"
          >
            <Check className="h-4 w-4" /> Submit for Verification
          </button>
        ) : (
          <button
            onClick={() =>
              setCurrentIndex(Math.min(REQUIRED_ANGLES.length - 1, currentIndex + 1))
            }
            disabled={currentIndex === REQUIRED_ANGLES.length - 1}
            className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-30 transition-colors"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Thumbnail grid */}
      <div className="grid grid-cols-6 gap-2">
        {REQUIRED_ANGLES.map((angle) => (
          <button
            key={angle.key}
            onClick={() => setCurrentIndex(REQUIRED_ANGLES.findIndex((a) => a.key === angle.key))}
            className={`aspect-square rounded-md border overflow-hidden relative ${
              photos[angle.key]
                ? "border-green-500"
                : "border-[var(--border)] bg-[var(--muted)]"
            }`}
          >
            {photos[angle.key] ? (
              <>
                <Image
                  src={photos[angle.key]}
                  alt={angle.label}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
                <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                  <Check className="h-4 w-4 text-green-600" />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <Camera className="h-3 w-3 text-[var(--muted-foreground)]" />
              </div>
            )}
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 truncate px-0.5">
              {angle.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
