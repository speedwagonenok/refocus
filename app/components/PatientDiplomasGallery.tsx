"use client";

import { useRef, useState } from "react";

export type PatientDiplomaItem = {
  id: number;
  title: string;
  issuedBy: string | null;
  year: number | null;
};

type Props = {
  doctorId: number;
  diplomas: PatientDiplomaItem[];
};

export default function PatientDiplomasGallery({ doctorId, diplomas }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [openedDiplomaUrl, setOpenedDiplomaUrl] = useState<string | null>(null);

  const list = diplomas ?? [];

  function scrollRow(direction: "left" | "right") {
    const node = scrollRef.current;
    if (!node) return;
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    const edgeEpsilon = 8;
    const isAtStart = node.scrollLeft <= edgeEpsilon;
    const isAtEnd = maxScrollLeft - node.scrollLeft <= edgeEpsilon;

    if (direction === "right" && isAtEnd) {
      node.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direction === "left" && isAtStart) {
      node.scrollTo({ left: maxScrollLeft, behavior: "smooth" });
      return;
    }

    const amount = direction === "left" ? -320 : 320;
    node.scrollBy({ left: amount, behavior: "smooth" });
  }

  if (list.length === 0) {
    return (
      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#1f3344]">Сертификаты и дипломы (0)</p>
        <p className="text-sm text-[#6b859a]">Не указаны</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4">
        <p className="mb-2 text-sm font-semibold text-[#1f3344]">Сертификаты и дипломы ({list.length})</p>
        <div>
          <div ref={scrollRef} className="overflow-x-hidden pb-1">
            <div
              className={`flex min-w-max gap-3 ${list.length <= 4 ? "justify-center" : ""}`}
            >
              {list.map((d) => {
                const source = `/api/patient/doctors/${doctorId}/diploma/${d.id}`;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setOpenedDiplomaUrl(source)}
                    title={d.title}
                    className="group relative h-56 w-40 shrink-0 overflow-hidden rounded-lg bg-[#f8fbff] text-left transition"
                  >
                    <object
                      data={`${source}#toolbar=0&navpanes=0&scrollbar=0`}
                      type="application/pdf"
                      className="h-full w-full pointer-events-none"
                    >
                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                        PDF
                      </div>
                    </object>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/30">
                      <span className="rounded-full bg-white/90 p-2 text-[#2f698f] opacity-0 shadow-sm transition group-hover:opacity-100">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <circle cx="11" cy="11" r="7" />
                          <path d="m21 21-4.3-4.3" />
                        </svg>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {list.length > 4 ? (
            <div className="mt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => scrollRow("left")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                aria-label="Прокрутить влево"
              >
                ←
              </button>
              <button
                type="button"
                onClick={() => scrollRow("right")}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                aria-label="Прокрутить вправо"
              >
                →
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {openedDiplomaUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр диплома"
        >
          <div className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#c6d7e5] bg-white shadow-2xl">
            <div className="flex items-center justify-end border-b border-[#e2ecf4] p-3">
              <button
                type="button"
                onClick={() => setOpenedDiplomaUrl(null)}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
              >
                &times;
              </button>
            </div>
            <object
              data={`${openedDiplomaUrl}#toolbar=0`}
              type="application/pdf"
              className="h-[calc(90vh-57px)] w-full"
            >
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-[#5f7a92]">
                Не удалось показать предпросмотр PDF.
              </div>
            </object>
          </div>
        </div>
      ) : null}
    </>
  );
}
