"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import PatientDoctorProfileCard, {
  type PatientDoctorPublicProfile,
} from "@/app/components/PatientDoctorProfileCard";
import { psychotherapySymptomGroups } from "@/lib/psychotherapyPresets";

type InlineNoticeType = "success" | "error";

type PatientTab =
  | "CABINET"
  | "QUESTIONNAIRE"
  | "ALL_SPECIALISTS";
type CabinetSubTab = "DOCUMENTS" | "APPOINTMENTS";

type QuestionnaireSubTab = "FORM" | "MATCH";
type PriceSort = "ASC" | "DESC";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type PatientDocumentType = "CONTRACT" | "PRESCRIPTION" | "VISIT_PROTOCOL";
type DocumentsFilter = "ALL" | PatientDocumentType;
type PatientAppointmentItem = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  doctor: {
    id: number;
    fullName: string;
  };
  sessionPrice: number | null;
};
type PatientDocumentItem = {
  id: number;
  type: PatientDocumentType;
  fileName: string;
  createdAt: string;
};

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
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function isoForDay(y: number, month: number, day: number): string {
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const patientMenuItems: Array<{ id: PatientTab; label: string }> = [
  { id: "CABINET", label: "Личный кабинет" },
  { id: "QUESTIONNAIRE", label: "Анкетирование" },
  { id: "ALL_SPECIALISTS", label: "Все специалисты" },
];

type PatientWorkspacePanelProps = {
  currentUserName: string;
  currentUserEmail: string;
};

export default function PatientWorkspacePanel({
  currentUserName,
  currentUserEmail,
}: PatientWorkspacePanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PatientTab>("CABINET");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [questionnaireNotice, setQuestionnaireNotice] = useState<{
    type: InlineNoticeType;
    message: string;
  } | null>(null);
  const [ageModalOpen, setAgeModalOpen] = useState(true);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchedDoctors, setMatchedDoctors] = useState<PatientDoctorPublicProfile[]>([]);
  const [matchAttempted, setMatchAttempted] = useState(false);
  const [allDoctors, setAllDoctors] = useState<PatientDoctorPublicProfile[] | null>(null);
  const [allDoctorsLoading, setAllDoctorsLoading] = useState(false);
  const [allDoctorsError, setAllDoctorsError] = useState<string | null>(null);
  const [allDoctorsSearch, setAllDoctorsSearch] = useState("");
  const [allDoctorsPriceSort, setAllDoctorsPriceSort] = useState<PriceSort>("ASC");
  const [questionnaireSubTab, setQuestionnaireSubTab] = useState<QuestionnaireSubTab>("FORM");
  const [matchPriceSort, setMatchPriceSort] = useState<PriceSort>("ASC");
  const [cabinetSubTab, setCabinetSubTab] = useState<CabinetSubTab>("DOCUMENTS");
  const [appointmentsCalendarYear, setAppointmentsCalendarYear] = useState(() => new Date().getFullYear());
  const [appointmentsCalendarMonth, setAppointmentsCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [patientAppointments, setPatientAppointments] = useState<PatientAppointmentItem[]>([]);
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<string | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [patientDocuments, setPatientDocuments] = useState<PatientDocumentItem[]>([]);
  const [documentsFilter, setDocumentsFilter] = useState<DocumentsFilter>("ALL");

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Доброе утро";
    if (hour >= 12 && hour < 18) return "Добрый день";
    return "Добрый вечер";
  }, []);
  const appointmentsGrid = useMemo(
    () => buildMonthGrid(appointmentsCalendarYear, appointmentsCalendarMonth),
    [appointmentsCalendarMonth, appointmentsCalendarYear],
  );
  const appointmentsByDate = useMemo(() => {
    const out: Record<string, PatientAppointmentItem[]> = {};
    for (const item of patientAppointments) {
      if (!out[item.slotDate]) out[item.slotDate] = [];
      out[item.slotDate].push(item);
    }
    return out;
  }, [patientAppointments]);
  const visibleAllDoctors = useMemo(() => {
    const list = allDoctors ?? [];
    const query = allDoctorsSearch.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter((doc) => doc.fullName.toLowerCase().includes(query));
  }, [allDoctors, allDoctorsSearch]);
  const sortedVisibleAllDoctors = useMemo(() => {
    const list = [...visibleAllDoctors];
    return list.sort((a, b) => {
      const aPrice = typeof a.sessionPrice === "number" && a.sessionPrice > 0 ? a.sessionPrice : null;
      const bPrice = typeof b.sessionPrice === "number" && b.sessionPrice > 0 ? b.sessionPrice : null;
      if (aPrice == null && bPrice == null) return a.fullName.localeCompare(b.fullName);
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      return allDoctorsPriceSort === "ASC" ? aPrice - bPrice : bPrice - aPrice;
    });
  }, [visibleAllDoctors, allDoctorsPriceSort]);
  const sortedMatchedDoctors = useMemo(() => {
    const list = [...matchedDoctors];
    return list.sort((a, b) => {
      const aPrice = typeof a.sessionPrice === "number" && a.sessionPrice > 0 ? a.sessionPrice : null;
      const bPrice = typeof b.sessionPrice === "number" && b.sessionPrice > 0 ? b.sessionPrice : null;
      if (aPrice == null && bPrice == null) {
        const byMatches = b.matchedSymptoms.length - a.matchedSymptoms.length;
        if (byMatches !== 0) return byMatches;
        return a.fullName.localeCompare(b.fullName);
      }
      if (aPrice == null) return 1;
      if (bPrice == null) return -1;
      return matchPriceSort === "ASC" ? aPrice - bPrice : bPrice - aPrice;
    });
  }, [matchedDoctors, matchPriceSort]);
  const selectedDateAppointments = selectedAppointmentDate
    ? appointmentsByDate[selectedAppointmentDate] ?? []
    : [];
  const documentTypeLabel: Record<PatientDocumentType, string> = {
    CONTRACT: "Договор",
    PRESCRIPTION: "Рецепт",
    VISIT_PROTOCOL: "Протокол приема",
  };
  const visiblePatientDocuments = useMemo(() => {
    if (documentsFilter === "ALL") return patientDocuments;
    return patientDocuments.filter((item) => item.type === documentsFilter);
  }, [patientDocuments, documentsFilter]);

  const toggleSymptom = useCallback((item: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(item)) next.delete(item);
      else next.add(item);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "ALL_SPECIALISTS" || allDoctors !== null) {
      return;
    }
    let cancelled = false;
    setAllDoctorsLoading(true);
    setAllDoctorsError(null);
    void (async () => {
      try {
        const res = await fetch("/api/patient/doctors", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | { message?: string; doctors?: PatientDoctorPublicProfile[] }
          | null;
        if (cancelled) return;
        if (!res.ok) {
          setAllDoctors([]);
          setAllDoctorsError(data?.message ?? "Не удалось загрузить список врачей.");
          return;
        }
        const raw = Array.isArray(data?.doctors) ? data.doctors : [];
        setAllDoctors(
          raw.map((d) => {
            const row = d as PatientDoctorPublicProfile & { diseases?: string[] };
            const profileDiseases = Array.isArray(row.profileDiseases)
              ? row.profileDiseases
              : Array.isArray(row.diseases)
                ? row.diseases
                : [];
            const diplomasRaw = row.diplomas as unknown;
            const diplomas: PatientDoctorPublicProfile["diplomas"] = Array.isArray(diplomasRaw)
              ? diplomasRaw
                  .filter(
                    (x): x is PatientDoctorPublicProfile["diplomas"][number] =>
                      x != null &&
                      typeof x === "object" &&
                      typeof (x as { id: unknown }).id === "number" &&
                      typeof (x as { title: unknown }).title === "string",
                  )
                  .map((x) => ({
                    id: x.id,
                    title: (x.title as string).trim() || "Документ",
                    issuedBy:
                      typeof x.issuedBy === "string" && x.issuedBy.trim() ? x.issuedBy.trim() : null,
                    year: typeof x.year === "number" && Number.isInteger(x.year) ? x.year : null,
                  }))
              : [];
            const educationRaw = (row as { profileEducation?: unknown }).profileEducation;
            const profileEducation: PatientDoctorPublicProfile["profileEducation"] = Array.isArray(educationRaw)
              ? educationRaw
                  .filter(
                    (
                      item,
                    ): item is PatientDoctorPublicProfile["profileEducation"][number] =>
                      item != null &&
                      typeof item === "object" &&
                      typeof (item as { when: unknown }).when === "string" &&
                      typeof (item as { institution: unknown }).institution === "string" &&
                      typeof (item as { specialty: unknown }).specialty === "string",
                  )
                  .map((item) => ({
                    when: item.when.trim(),
                    institution: item.institution.trim(),
                    specialty: item.specialty.trim(),
                  }))
                  .filter((item) => item.when && item.institution && item.specialty)
              : [];
            return {
              ...d,
              profileSymptoms: Array.isArray(d.profileSymptoms) ? d.profileSymptoms : [],
              profileDiseases,
              profileEducation,
              matchedSymptoms: Array.isArray(d.matchedSymptoms) ? d.matchedSymptoms : [],
              sessionPrice:
                typeof d.sessionPrice === "number" && Number.isFinite(d.sessionPrice)
                  ? d.sessionPrice
                  : null,
              diplomas,
            };
          }),
        );
      } catch {
        if (!cancelled) {
          setAllDoctors([]);
          setAllDoctorsError("Ошибка сети при загрузке списка врачей.");
        }
      } finally {
        if (!cancelled) {
          setAllDoctorsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, allDoctors]);

  useEffect(() => {
    if (activeTab !== "CABINET" || cabinetSubTab !== "APPOINTMENTS") {
      return;
    }
    let cancelled = false;
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    void (async () => {
      try {
        const res = await fetch(
          `/api/patient/appointments?year=${appointmentsCalendarYear}&month=${appointmentsCalendarMonth}`,
          { cache: "no-store" },
        );
        const data = (await res.json().catch(() => null)) as
          | { message?: string; appointments?: PatientAppointmentItem[] }
          | null;
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data?.appointments)) {
          setPatientAppointments([]);
          setAppointmentsError(data?.message ?? "Не удалось загрузить записи на прием.");
          return;
        }
        setPatientAppointments(data.appointments);
      } catch {
        if (!cancelled) {
          setPatientAppointments([]);
          setAppointmentsError("Ошибка сети при загрузке записей на прием.");
        }
      } finally {
        if (!cancelled) {
          setAppointmentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, cabinetSubTab, appointmentsCalendarYear, appointmentsCalendarMonth]);

  useEffect(() => {
    if (activeTab !== "CABINET" || cabinetSubTab !== "DOCUMENTS") {
      return;
    }
    let cancelled = false;
    setDocumentsLoading(true);
    setDocumentsError(null);
    void (async () => {
      try {
        const res = await fetch("/api/patient/documents", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | { message?: string; documents?: PatientDocumentItem[] }
          | null;
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data?.documents)) {
          setPatientDocuments([]);
          setDocumentsError(data?.message ?? "Не удалось загрузить документы.");
          return;
        }
        setPatientDocuments(data.documents);
      } catch {
        if (!cancelled) {
          setPatientDocuments([]);
          setDocumentsError("Ошибка сети при загрузке документов.");
        }
      } finally {
        if (!cancelled) {
          setDocumentsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, cabinetSubTab]);

  useEffect(() => {
    setSelectedAppointmentDate(null);
  }, [appointmentsCalendarMonth, appointmentsCalendarYear]);

  async function handleContinue() {
    setQuestionnaireNotice(null);
    if (selected.size === 0) {
      setQuestionnaireNotice({ type: "error", message: "Выберите хотя бы один симптом из списка." });
      return;
    }
    setMatchLoading(true);
    try {
      const res = await fetch("/api/patient/doctor-matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: Array.from(selected) }),
      });
      const data = (await res.json().catch(() => null)) as
        | { message?: string; doctors?: PatientDoctorPublicProfile[] }
        | null;
      if (!res.ok) {
        setQuestionnaireNotice({
          type: "error",
          message: data?.message ?? "Не удалось подобрать специалистов.",
        });
        return;
      }
      const raw = Array.isArray(data?.doctors) ? data.doctors : [];
      setMatchedDoctors(
        raw.map((d) => {
          const row = d as PatientDoctorPublicProfile & { diseases?: string[] };
          const profileDiseases = Array.isArray(row.profileDiseases)
            ? row.profileDiseases
            : Array.isArray(row.diseases)
              ? row.diseases
              : [];
          const diplomasRaw = row.diplomas as unknown;
          const diplomas: PatientDoctorPublicProfile["diplomas"] = Array.isArray(diplomasRaw)
            ? diplomasRaw
                .filter(
                  (x): x is PatientDoctorPublicProfile["diplomas"][number] =>
                    x != null &&
                    typeof x === "object" &&
                    typeof (x as { id: unknown }).id === "number" &&
                    typeof (x as { title: unknown }).title === "string",
                )
                .map((x) => ({
                  id: x.id,
                  title: (x.title as string).trim() || "Документ",
                  issuedBy:
                    typeof x.issuedBy === "string" && x.issuedBy.trim() ? x.issuedBy.trim() : null,
                  year: typeof x.year === "number" && Number.isInteger(x.year) ? x.year : null,
                }))
            : [];
          const educationRaw = (row as { profileEducation?: unknown }).profileEducation;
          const profileEducation: PatientDoctorPublicProfile["profileEducation"] = Array.isArray(educationRaw)
            ? educationRaw
                .filter(
                  (
                    item,
                  ): item is PatientDoctorPublicProfile["profileEducation"][number] =>
                    item != null &&
                    typeof item === "object" &&
                    typeof (item as { when: unknown }).when === "string" &&
                    typeof (item as { institution: unknown }).institution === "string" &&
                    typeof (item as { specialty: unknown }).specialty === "string",
                )
                .map((item) => ({
                  when: item.when.trim(),
                  institution: item.institution.trim(),
                  specialty: item.specialty.trim(),
                }))
                .filter((item) => item.when && item.institution && item.specialty)
            : [];
          return {
            ...d,
            profileSymptoms: Array.isArray(d.profileSymptoms)
              ? d.profileSymptoms
              : Array.isArray(d.matchedSymptoms)
                ? d.matchedSymptoms
                : [],
            profileDiseases,
            profileEducation,
            sessionPrice:
              typeof d.sessionPrice === "number" && Number.isFinite(d.sessionPrice) ? d.sessionPrice : null,
            diplomas,
          };
        }),
      );
      setMatchAttempted(true);
      setQuestionnaireSubTab("MATCH");
      setQuestionnaireNotice({
        type: "success",
        message: `Подобрано специалистов: ${data?.doctors?.length ?? 0}.`,
      });
    } catch {
      setQuestionnaireNotice({ type: "error", message: "Ошибка сети при подборе специалистов." });
    } finally {
      setMatchLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function goAppointmentsPrevMonth() {
    setAppointmentsCalendarMonth((m) => {
      if (m <= 1) {
        setAppointmentsCalendarYear((y) => y - 1);
        return 12;
      }
      return m - 1;
    });
  }

  function goAppointmentsNextMonth() {
    setAppointmentsCalendarMonth((m) => {
      if (m >= 12) {
        setAppointmentsCalendarYear((y) => y + 1);
        return 1;
      }
      return m + 1;
    });
  }

  return (
    <main className="min-h-screen bg-[#e6edf3]">
      <header className="sticky top-0 z-20 flex w-full items-start justify-between gap-4 border-b border-[#c6d7e5] bg-white px-5 py-4 shadow-sm sm:items-center md:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 md:gap-x-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#21486b] md:text-4xl">Refocus</h1>
          <span
            className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-[#39556d] md:text-base"
            title="Контактный телефон клиники"
          >
            <svg
              className="h-5 w-5 shrink-0 text-[#2f698f] md:h-6 md:w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            8 800 ***-**-**
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-0.5 sm:pt-0">
          <div className="text-right">
            <p className="text-sm font-medium text-[#1f3344] md:text-base">
              {greeting}, {currentUserName}
            </p>
            <p className="text-xs text-[#5f7a92] md:text-sm">{currentUserEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:opacity-60 md:text-sm"
          >
            {isLoggingOut ? "Выход..." : "Выйти"}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-full px-4 py-6 sm:px-6 md:px-10">
        <nav
          className="mb-8 flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-[#c6d7e5] pb-3"
          aria-label="Меню личного кабинета"
        >
          {patientMenuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`cursor-pointer border-0 bg-transparent p-0 text-left text-base font-medium transition hover:text-[#2f698f] md:text-lg ${
                activeTab === item.id
                  ? "text-[#21486b] underline decoration-2 underline-offset-[10px]"
                  : "text-[#5f7a92]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {activeTab === "CABINET" ? (
          <section className="rounded-2xl border border-[#c6d7e5] bg-[#f8fbff] p-8 shadow-lg md:p-10">
            <div
              className="flex w-full flex-col gap-2 sm:flex-row"
              role="tablist"
              aria-label="Разделы личного кабинета"
            >
              <button
                type="button"
                role="tab"
                aria-selected={cabinetSubTab === "DOCUMENTS"}
                onClick={() => setCabinetSubTab("DOCUMENTS")}
                className={`min-h-[2.75rem] w-full flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:min-h-[3rem] sm:text-base ${
                  cabinetSubTab === "DOCUMENTS"
                    ? "bg-[#2f698f] text-white"
                    : "border border-[#b5cadb] bg-white text-[#39556d] hover:bg-[#edf4fa]"
                }`}
              >
                Мои документы
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={cabinetSubTab === "APPOINTMENTS"}
                onClick={() => setCabinetSubTab("APPOINTMENTS")}
                className={`min-h-[2.75rem] w-full flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition sm:min-h-[3rem] sm:text-base ${
                  cabinetSubTab === "APPOINTMENTS"
                    ? "bg-[#2f698f] text-white"
                    : "border border-[#b5cadb] bg-white text-[#39556d] hover:bg-[#edf4fa]"
                }`}
              >
                Записи на прием
              </button>
            </div>
            {cabinetSubTab === "DOCUMENTS" ? (
              <div className="mt-6 w-full rounded-xl border border-[#bfd2e2] bg-white p-5 md:p-6">
                <div className="mb-3 flex justify-end">
                  <select
                    value={documentsFilter}
                    onChange={(e) => setDocumentsFilter(e.target.value as DocumentsFilter)}
                    className="w-full max-w-xs rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-sm font-medium text-[#39556d] outline-none transition focus:border-[#2f698f] md:text-base"
                    aria-label="Фильтр документов по типу"
                  >
                    <option value="ALL">Все документы</option>
                    <option value="VISIT_PROTOCOL">Протоколы приема</option>
                    <option value="PRESCRIPTION">Рецепты</option>
                    <option value="CONTRACT">Договоры</option>
                  </select>
                </div>
                {documentsError ? <p className="mt-2 text-sm text-red-600">{documentsError}</p> : null}
                {documentsLoading ? (
                  <p className="mt-2 text-sm text-[#5f7a92]">Загрузка документов…</p>
                ) : visiblePatientDocuments.length === 0 ? (
                  <p className="mt-2 text-sm text-[#5f7a92]">Документов пока нет.</p>
                ) : (
                  <ul className="mt-4 space-y-2">
                    {visiblePatientDocuments.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2 rounded-lg border border-[#dbe8f2] bg-[#f8fbff] p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-sm font-semibold text-[#1f3344]">
                            {documentTypeLabel[item.type]}
                          </p>
                          <p className="text-sm text-[#39556d]">{item.fileName}</p>
                          <p className="text-sm text-[#5f7a92]">
                            Добавлен: {new Date(item.createdAt).toLocaleDateString("ru-RU")}
                          </p>
                        </div>
                        <a
                          href={`/api/patient/files/document/${item.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1.5 text-sm font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
                        >
                          Открыть PDF
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {cabinetSubTab === "APPOINTMENTS" ? (
              <div className="mt-6 w-full rounded-xl border border-[#bfd2e2] bg-white p-5 md:p-6">
                <h3 className="text-base font-semibold text-[#1f3344] md:text-lg">Записи на прием</h3>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={goAppointmentsPrevMonth}
                    className="rounded-md border border-[#bfd2e2] bg-white px-3 py-1.5 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
                    aria-label="Предыдущий месяц"
                  >
                    ←
                  </button>
                  <p className="text-sm font-semibold text-[#1f3344] md:text-base">
                    {MONTH_NAMES_RU[appointmentsCalendarMonth - 1]} {appointmentsCalendarYear}
                  </p>
                  <button
                    type="button"
                    onClick={goAppointmentsNextMonth}
                    className="rounded-md border border-[#bfd2e2] bg-white px-3 py-1.5 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
                    aria-label="Следующий месяц"
                  >
                    →
                  </button>
                </div>

                {appointmentsError ? (
                  <p className="mt-3 text-sm text-red-600">{appointmentsError}</p>
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
                      {appointmentsGrid.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((day, ci) => {
                            if (day == null) {
                              return (
                                <td key={`e-${ri}-${ci}`} className="p-0.5">
                                  <div className="h-9 md:h-10" />
                                </td>
                              );
                            }
                            const iso = isoForDay(appointmentsCalendarYear, appointmentsCalendarMonth, day);
                            const hasAppointments = (appointmentsByDate[iso]?.length ?? 0) > 0;
                            const isSelected = selectedAppointmentDate === iso;
                            return (
                              <td key={iso} className="p-0.5">
                                <button
                                  type="button"
                                  disabled={!hasAppointments}
                                  onClick={() =>
                                    hasAppointments &&
                                    setSelectedAppointmentDate((prev) => (prev === iso ? null : iso))
                                  }
                                  className={`flex h-9 w-full min-w-0 items-center justify-center rounded-lg text-sm font-medium transition md:h-10 ${
                                    !hasAppointments
                                      ? "cursor-default text-[#b0c4d4]"
                                      : isSelected
                                        ? "ring-2 ring-[#2f698f] ring-offset-1 ring-offset-white"
                                        : ""
                                  } ${
                                    hasAppointments
                                      ? "border border-amber-300/70 bg-amber-100/75 text-amber-950/90 hover:bg-amber-100"
                                      : "border border-transparent bg-transparent"
                                  }`}
                                  aria-label={
                                    hasAppointments
                                      ? `${day}, есть записи`
                                      : `${day}, без записей`
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

                {appointmentsLoading ? (
                  <p className="mt-2 text-xs text-[#6b859a]">Загрузка записей…</p>
                ) : null}

                {selectedAppointmentDate && selectedDateAppointments.length > 0 ? (
                  <div className="mt-4 rounded-lg border border-amber-200/85 bg-amber-50/65 p-3">
                    <p className="text-xs font-semibold text-amber-950/85">
                      Записи на{" "}
                      {new Date(`${selectedAppointmentDate}T12:00:00`).toLocaleDateString("ru-RU", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <ul className="mt-2 space-y-2">
                      {selectedDateAppointments.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-md border border-amber-300/75 bg-amber-50/90 px-3 py-2 text-sm text-amber-950/90"
                        >
                          <p className="font-semibold">{item.doctor.fullName}</p>
                          <p className="mt-0.5">
                            Статус:{" "}
                            {item.status === "CONFIRMED"
                              ? "подтверждена"
                              : item.status === "CANCELLED"
                                ? "отменена"
                                : "ожидает подтверждения"}
                          </p>
                          <p className="mt-0.5 tabular-nums">
                            Время: {item.startTime}–{item.endTime}
                          </p>
                          <p className="mt-0.5">
                            Стоимость:{" "}
                            {item.sessionPrice != null && item.sessionPrice > 0
                              ? `${item.sessionPrice.toLocaleString("ru-RU")} ₽ / час`
                              : "не указана"}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {activeTab === "QUESTIONNAIRE" ? (
          <section className="rounded-2xl border border-[#c6d7e5] bg-[#f8fbff] p-8 shadow-lg md:p-10">
            <div
              className="mb-8 flex w-full flex-col gap-3 sm:flex-row sm:gap-4"
              role="tablist"
              aria-label="Разделы анкетирования"
            >
              <button
                type="button"
                role="tab"
                aria-selected={questionnaireSubTab === "FORM"}
                onClick={() => setQuestionnaireSubTab("FORM")}
                className={`min-h-[2.75rem] w-full flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition sm:min-h-[3rem] sm:text-base ${
                  questionnaireSubTab === "FORM"
                    ? "bg-[#2f698f] text-white shadow-sm"
                    : "border border-[#b5cadb] bg-white text-[#39556d] shadow-sm hover:bg-[#edf4fa]"
                }`}
              >
                Анкетирование
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={questionnaireSubTab === "MATCH"}
                onClick={() => setQuestionnaireSubTab("MATCH")}
                className={`min-h-[2.75rem] w-full flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium transition sm:min-h-[3rem] sm:text-base ${
                  questionnaireSubTab === "MATCH"
                    ? "bg-[#2f698f] text-white shadow-sm"
                    : "border border-[#b5cadb] bg-white text-[#39556d] shadow-sm hover:bg-[#edf4fa]"
                }`}
              >
                Подбор специалиста
              </button>
            </div>

            {questionnaireSubTab === "FORM" ? (
              <div>
                <h2 className="text-xl font-semibold text-[#1f3344] md:text-2xl">Что вас беспокоит?</h2>
                <p className="mt-3 text-sm leading-relaxed text-[#5f7a92] md:text-base">
                  Отметьте симптомы, которые вам сейчас ближе всего — по ним подбираются специалисты с совпадающими
                  пунктами в профиле.
                </p>

                <div className="mt-8 space-y-8">
                  {psychotherapySymptomGroups.map((group) => (
                    <div key={group.title}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7a92]">
                        {group.title}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const isOn = selected.has(item);
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => toggleSymptom(item)}
                              className={`max-w-full break-words rounded-full border px-3 py-2 text-left text-sm font-medium transition ${
                                isOn
                                  ? "border-[#2f698f] bg-[#2f698f] text-white"
                                  : "border-[#bfd2e2] bg-white text-[#39556d] hover:bg-[#edf4fa]"
                              }`}
                            >
                              {item}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={matchLoading}
                    onClick={() => void handleContinue()}
                    className="rounded-md bg-[#2f698f] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#275877] disabled:opacity-60"
                  >
                    {matchLoading ? "Подбор..." : "Продолжить"}
                  </button>
                </div>
                {questionnaireNotice ? (
                  <p
                    className={`mt-3 text-sm ${
                      questionnaireNotice.type === "success" ? "text-[#2f698f]" : "text-red-600"
                    }`}
                  >
                    {questionnaireNotice.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <div role="tabpanel">
                {questionnaireNotice ? (
                  <p
                    className={`mb-3 text-sm ${
                      questionnaireNotice.type === "success" ? "text-[#2f698f]" : "text-red-600"
                    }`}
                  >
                    {questionnaireNotice.message}
                  </p>
                ) : null}
                {!matchAttempted ? (
                  <p className="mt-3 text-sm leading-relaxed text-[#5f7a92] md:text-base">
                    На вкладке «Анкетирование» отметьте симптомы и нажмите «Продолжить» — здесь появятся врачи с
                    совпадениями в профиле.
                  </p>
                ) : matchedDoctors.length === 0 ? (
                  <p className="mt-3 text-sm leading-relaxed text-[#5f7a92] md:text-base">
                    Пока нет врачей с совпадающими симптомами. Измените выбор на вкладке «Анкетирование» и снова нажмите
                    «Продолжить».
                  </p>
                ) : (
                  <>
                    <div className="mt-4 flex justify-end">
                      <select
                        value={matchPriceSort}
                        onChange={(e) => setMatchPriceSort(e.target.value as PriceSort)}
                        className="w-full max-w-xs rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-sm font-medium text-[#39556d] outline-none transition focus:border-[#2f698f] md:text-base"
                        aria-label="Сортировка по стоимости в подборе"
                      >
                        <option value="ASC">По стоимости: сначала дешевле</option>
                        <option value="DESC">По стоимости: сначала дороже</option>
                      </select>
                    </div>
                    <ul className="mt-6 flex w-full flex-col gap-5">
                      {sortedMatchedDoctors.map((doc) => (
                        <PatientDoctorProfileCard key={doc.id} doc={doc} />
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </section>
        ) : null}

        {activeTab === "ALL_SPECIALISTS" ? (
          <section className="rounded-2xl border border-[#c6d7e5] bg-[#f8fbff] p-8 shadow-lg md:p-10">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                value={allDoctorsSearch}
                onChange={(e) => setAllDoctorsSearch(e.target.value)}
                placeholder="Поиск специалиста по ФИО"
                className="w-full flex-1 rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
              />
              <select
                value={allDoctorsPriceSort}
                onChange={(e) => setAllDoctorsPriceSort(e.target.value as PriceSort)}
                className="w-full max-w-xs rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-sm font-medium text-[#39556d] outline-none transition focus:border-[#2f698f] md:text-base"
                aria-label="Сортировка по стоимости во всех специалистах"
              >
                <option value="ASC">По стоимости: сначала дешевле</option>
                <option value="DESC">По стоимости: сначала дороже</option>
              </select>
            </div>
            {allDoctorsLoading ? (
              <p className="text-sm text-[#5f7a92]">Загрузка списка…</p>
            ) : allDoctorsError ? (
              <p className="text-sm text-red-600">{allDoctorsError}</p>
            ) : sortedVisibleAllDoctors.length === 0 ? (
              <p className="text-sm text-[#6b859a]">В системе пока нет зарегистрированных врачей.</p>
            ) : (
              <ul className="flex w-full flex-col gap-5">
                {sortedVisibleAllDoctors.map((doc) => (
                  <PatientDoctorProfileCard key={doc.id} doc={doc} highlightAllProfileSymptoms />
                ))}
              </ul>
            )}
          </section>
        ) : null}

      </div>

      {ageModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refocus-age-modal-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[#c6d7e5] bg-white p-6 shadow-2xl md:p-8">
            <h2
              id="refocus-age-modal-title"
              className="text-lg font-semibold text-[#1f3344] md:text-xl"
            >
              Внимание!
            </h2>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#39556d] md:text-base">
              <p>
                Сервисом Refocus можно пользоваться с 16 лет в соответствии с законами РФ.
              </p>
              <p>
                Нажав кнопку «Подтвердить», вы подтверждаете, что вам исполнилось 16 лет.
              </p>
              <p>
                <span className="font-medium text-[#1f3344]">Телефон психологической помощи детям: </span>
                <span className="font-medium tabular-nums text-[#1f3344]">8 (495) 051</span>
              </p>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="order-2 rounded-md border border-[#8fb0cc] bg-white px-4 py-2.5 text-sm font-medium text-[#1f4e72] transition hover:bg-[#edf4fa] sm:order-1"
              >
                Мне нет 16 лет
              </button>
              <button
                type="button"
                onClick={() => setAgeModalOpen(false)}
                className="order-1 rounded-md bg-[#2f698f] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#275877] sm:order-2"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
