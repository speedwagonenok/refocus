"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";

const MAX_OUTPUT_SIDE = 800;
const JPEG_QUALITY = 0.92;

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

function resizeCanvasIfNeeded(source: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const { width: w, height: h } = source;
  if (Math.max(w, h) <= maxSide) return source;
  const scale = maxSide / Math.max(w, h);
  const out = document.createElement("canvas");
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext("2d");
  if (!ctx) return source;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h, 0, 0, out.width, out.height);
  return out;
}

async function cropImageToJpegBlob(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("NO_2D_CONTEXT");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const scaled = resizeCanvasIfNeeded(canvas, MAX_OUTPUT_SIDE);

  return new Promise((resolve, reject) => {
    scaled.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("EMPTY_BLOB"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onConfirm: (file: File) => void;
  busy?: boolean;
};

export default function AvatarCropModal({ imageSrc, onCancel, onConfirm, busy }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState("");

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setError("");
    try {
      const blob = await cropImageToJpegBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      onConfirm(file);
    } catch {
      setError("Не удалось обработать изображение. Попробуйте другой файл.");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
    >
      <div
        className="flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#c6d7e5] bg-white shadow-xl"
      >
        <div className="border-b border-[#e2ecf4] px-4 py-3">
          <h2 id="avatar-crop-title" className="text-lg font-semibold text-[#1f3344]">
            Кадрирование фото
          </h2>
          <p className="mt-1 text-sm text-[#5f7a92]">
            Перемещайте и масштабируйте изображение так, чтобы лицо было в круге.
          </p>
        </div>

        <div className="relative h-72 w-full bg-[#1a1a1a] sm:h-80">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="border-t border-[#e2ecf4] px-4 py-3">
          <label htmlFor="avatar-crop-zoom" className="text-sm font-medium text-[#39556d]">
            Масштаб
          </label>
          <input
            id="avatar-crop-zoom"
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full accent-[#2f698f]"
            disabled={busy}
          />
        </div>

        {error ? (
          <p className="border-t border-[#f0d4d4] bg-[#fff5f5] px-4 py-2 text-sm text-[#a12a2a]">{error}</p>
        ) : null}

        <div className="flex justify-end gap-2 border-t border-[#e2ecf4] bg-[#f8fbff] px-4 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-[#8fb0cc] bg-white px-4 py-2 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa] disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={busy || !croppedAreaPixels}
            className="rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#255a7a] disabled:opacity-50"
          >
            {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
}
