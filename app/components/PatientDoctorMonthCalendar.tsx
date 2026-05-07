"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

const MONTH_NAMES_RU = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

type Slot = { startTime: string; endTime: string };
type SelectedSlot = { dateIso: string; startTime: string; endTime: string };

function mondayBasedWeekIndex(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

function buildMonthGrid(y: number, m: number): (number | null)[][] {
  const first = new Date(y, m - 1, 1);
  const lead = mondayBasedWeekIndex(first);
  const dim = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

function isoForDay(y: number, month: number, day: number): string {
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

type Props = {
  doctorId: number;
  /** В карточке врача рядом с «О себе» — без верхней границы и отступа */
  embedded?: boolean;
};

export default function PatientDoctorMonthCalendar({ doctorId, embedded = false }: Props) {
  const initial = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [slotsByDate, setSlotsByDate] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [bookingSlot, setBookingSlot] = useState<SelectedSlot | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/patient/doctors/${doctorId}/slots-month?year=${year}&month=${month}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => null)) as
        | { slotsByDate?: Record<string, Slot[]>; message?: string }
        | null;
      if (!res.ok) {
        setSlotsByDate({});
        setError(data?.message ?? "Не удалось загрузить расписание.");
        return;
      }
      setSlotsByDate(data?.slotsByDate && typeof data.slotsByDate === "object" ? data.slotsByDate : {});
    } catch {
      setSlotsByDate({});
      setError("Ошибка сети при загрузке расписания.");
    } finally {
      setLoading(false);
    }
  }, [doctorId, year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIso(null);
  }, [year, month, doctorId]);

  function goPrevMonth() {
    setMonth((m) => {
      if (m <= 1) {
        setYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function goNextMonth() {
    setMonth((m) => {
      if (m >= 12) {
        setYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  const slotsForSelected = selectedIso ? slotsByDate[selectedIso] ?? [] : [];

  async function submitBooking() {
    if (!bookingSlot) return;
    setBookingLoading(true);
    setBookingError(null);
    try {
      const res = await fetch("/api/patient/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          slotDate: bookingSlot.dateIso,
          startTime: bookingSlot.startTime,
          endTime: bookingSlot.endTime,
          contactPhone,
        }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setBookingError(data?.message ?? "Не удалось записаться.");
        return;
      }
      setBookingSlot(null);
      setContactPhone("");
      setSelectedIso(null);
      await load();
    } catch {
      setBookingError("Ошибка сети при создании записи.");
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <div
      className={
        embedded ? "w-full" : "mt-5 w-full border-t border-[#e2ecf4] pt-5"
      }
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">Свободные слоты</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={goPrevMonth}
          className="rounded-md border border-[#bfd2e2] bg-white px-3 py-1.5 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
          aria-label="Предыдущий месяц"
        >
          ←
        </button>
        <p className="text-center text-sm font-semibold text-[#1f3344] md:text-base">
          {MONTH_NAMES_RU[month - 1]} {year}
        </p>
        <button
          type="button"
          onClick={goNextMonth}
          className="rounded-md border border-[#bfd2e2] bg-white px-3 py-1.5 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
          aria-label="Следующий месяц"
        >
          →
        </button>
      </div>

      {error ? (
        <p className="mt-2 text-sm text-red-600">{error}</p>
      ) : null}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[280px] border-collapse text-center text-sm">
          <thead>
            <tr>
              {WEEKDAY_SHORT.map((d) => (
                <th key={d} className="pb-2 text-xs font-semibold text-[#5f7a92]">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri}>
                {row.map((day, ci) => {
                  if (day == null) {
                    return (
                      <td key={`e-${ri}-${ci}`} className="p-0.5">
                        <div className="h-9 md:h-10" />
                      </td>
                    );
                  }
                  const iso = isoForDay(year, month, day);
                  const hasSlots = (slotsByDate[iso]?.length ?? 0) > 0;
                  const isSelected = selectedIso === iso;
                  return (
                    <td key={iso} className="p-0.5">
                      <button
                        type="button"
                        disabled={!hasSlots}
                        onClick={() => hasSlots && setSelectedIso((prev) => (prev === iso ? null : iso))}
                        className={`flex h-9 w-full min-w-0 items-center justify-center rounded-lg text-sm font-medium transition md:h-10 ${
                          !hasSlots
                            ? "cursor-default text-[#b0c4d4]"
                            : isSelected
                              ? "ring-2 ring-[#2f698f] ring-offset-1 ring-offset-white"
                              : ""
                        } ${
                          hasSlots
                            ? "border border-amber-300/70 bg-amber-100/75 text-amber-950/90 hover:bg-amber-100"
                            : "border border-transparent bg-transparent"
                        }`}
                        aria-label={
                          hasSlots
                            ? `${day}, есть слоты`
                            : `${day}, без слотов`
                        }
                      >
                        {day}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading ? (
        <p className="mt-2 text-xs text-[#6b859a]">Загрузка календаря…</p>
      ) : null}

      {selectedIso && slotsForSelected.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200/85 bg-amber-50/65 p-3">
          <p className="text-xs font-semibold text-amber-950/85">
            Время на {new Date(selectedIso + "T12:00:00").toLocaleDateString("ru-RU", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slotsForSelected.map((s) => (
              <button
                key={`${s.startTime}-${s.endTime}`}
                type="button"
                onClick={() => {
                  setBookingError(null);
                  setBookingSlot({ dateIso: selectedIso, startTime: s.startTime, endTime: s.endTime });
                }}
                className="rounded-md border border-amber-300/75 bg-amber-50/90 px-3 py-1.5 text-sm font-semibold tabular-nums text-amber-950/90 shadow-sm transition hover:bg-amber-100"
              >
                {s.startTime}–{s.endTime}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {bookingSlot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1f3344]">Подтверждение записи</h3>
              <button
                type="button"
                onClick={() => {
                  setBookingSlot(null);
                  setBookingError(null);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-2xl leading-none text-[#39556d] transition hover:bg-[#edf4fa]"
                aria-label="Закрыть"
              >
                &times;
              </button>
            </div>
            <p className="mt-3 text-sm text-[#39556d]">
              Вы записываетесь на{" "}
              {new Date(`${bookingSlot.dateIso}T12:00:00`).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}{" "}
              в {bookingSlot.startTime}–{bookingSlot.endTime}.
            </p>
            <div className="mt-4">
              <label htmlFor={`contact-phone-${doctorId}`} className="mb-1 block text-sm font-medium text-[#1f3344]">
                Контактный телефон
              </label>
              <input
                id={`contact-phone-${doctorId}`}
                type="tel"
                autoComplete="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+7 999 123-45-67"
                className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
              />
            </div>
            {bookingError ? <p className="mt-3 text-sm text-red-600">{bookingError}</p> : null}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void submitBooking()}
                disabled={bookingLoading || !contactPhone.trim()}
                className="inline-flex flex-1 items-center justify-center rounded-md bg-[#2f698f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#275877] disabled:opacity-60"
              >
                {bookingLoading ? "Записываем..." : "Подтвердить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBookingSlot(null);
                  setBookingError(null);
                }}
                disabled={bookingLoading}
                className="inline-flex items-center justify-center rounded-md border border-[#9fb9cf] bg-white px-4 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#edf5fb] disabled:opacity-60"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
