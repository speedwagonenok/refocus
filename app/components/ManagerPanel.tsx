"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import UsersSection from "@/app/components/UsersSection";
import { formatRuPhoneForDisplay } from "@/lib/authValidation";

type UserRole = "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  hasConfirmedAppointment?: boolean;
  role: UserRole;
  createdAt: string;
};
type ManagerSection = "PATIENTS" | "APPOINTMENTS";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type PatientDocumentType = "CONTRACT" | "PRESCRIPTION" | "VISIT_PROTOCOL";
type ManagerAppointmentRow = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  contactPhone: string | null;
  status: AppointmentStatus;
  doctor: {
    id: number;
    fullName: string;
    email: string;
  };
  patient: {
    id: number;
    fullName: string;
    email: string;
  };
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "PATIENT", label: "Пациент" },
];

const roleLabelByValue: Record<UserRole, string> = {
  PATIENT: "Пациент",
  DOCTOR: "Врач",
  MANAGER: "Менеджер",
  SYSTEM_ADMIN: "Системный администратор",
};

type ManagerPanelProps = {
  currentUserName: string;
  currentUserEmail: string;
};

function getAppointmentDateTimeMs(slotDate: string, time: string): number {
  return new Date(`${slotDate}T${time}:00`).getTime();
}

function sortAppointmentsByNearestFirst(items: ManagerAppointmentRow[]): ManagerAppointmentRow[] {
  const nowMs = Date.now();
  return [...items].sort((a, b) => {
    const aStartMs = getAppointmentDateTimeMs(a.slotDate, a.startTime);
    const bStartMs = getAppointmentDateTimeMs(b.slotDate, b.startTime);
    const aUpcoming = aStartMs >= nowMs;
    const bUpcoming = bStartMs >= nowMs;

    if (aUpcoming !== bUpcoming) {
      return aUpcoming ? -1 : 1;
    }

    return aStartMs - bStartMs;
  });
}

export default function ManagerPanel({ currentUserName, currentUserEmail }: ManagerPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [listError, setListError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [section, setSection] = useState<ManagerSection>("PATIENTS");
  const [appointments, setAppointments] = useState<ManagerAppointmentRow[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState<string | null>(null);
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<number | null>(null);
  const [appointmentsPhoneSearch, setAppointmentsPhoneSearch] = useState("");
  const [documentModalPatient, setDocumentModalPatient] = useState<UserRow | null>(null);
  const [documentType, setDocumentType] = useState<PatientDocumentType>("CONTRACT");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentDragOver, setDocumentDragOver] = useState(false);
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentMessage, setDocumentMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const documentDragDepth = useRef(0);
  const documentInputRef = useRef<HTMLInputElement>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Доброе утро";
    if (hour >= 12 && hour < 18) return "Добрый день";
    return "Добрый вечер";
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; users?: UserRow[] }
        | null;

      if (!response.ok || !data?.users) {
        setListError(data?.message ?? "Не удалось загрузить список пациентов.");
        return;
      }

      setUsers(data.users);
    } catch {
      setListError("Ошибка сети при загрузке пациентов.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError(null);
    try {
      const response = await fetch("/api/manager/appointments", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; appointments?: ManagerAppointmentRow[] }
        | null;
      if (!response.ok || !data?.appointments) {
        setAppointments([]);
        setAppointmentsError(data?.message ?? "Не удалось загрузить записи.");
        return;
      }
      setAppointments(sortAppointmentsByNearestFirst(data.appointments));
    } catch {
      setAppointmentsError("Ошибка сети при загрузке записей.");
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (section === "PATIENTS") {
      void loadUsers();
    }
  }, [loadUsers, section]);

  useEffect(() => {
    if (section === "APPOINTMENTS") {
      void loadAppointments();
    }
  }, [loadAppointments, section]);

  const visibleUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (!normalizedQuery) {
        return true;
      }
      const queryDigits = normalizedQuery.replace(/\D/g, "");
      const phoneMatch =
        queryDigits.length > 0 &&
        user.phone != null &&
        user.phone.includes(queryDigits);
      return (
        user.fullName.toLowerCase().includes(normalizedQuery) ||
        user.email.toLowerCase().includes(normalizedQuery) ||
        phoneMatch
      );
    });
  }, [users, searchQuery]);
  const visibleAppointments = useMemo(() => {
    const queryDigits = appointmentsPhoneSearch.replace(/\D/g, "");
    if (!queryDigits) {
      return appointments;
    }
    return appointments.filter((item) => {
      const phoneDigits = (item.contactPhone ?? "").replace(/\D/g, "");
      return phoneDigits.includes(queryDigits);
    });
  }, [appointments, appointmentsPhoneSearch]);

  function isLikelyPdfFile(file: File): boolean {
    if (file.type === "application/pdf") return true;
    if (file.type && file.type !== "") return false;
    return /\.pdf$/i.test(file.name);
  }

  function handlePickDocumentFile(file: File | null) {
    if (!file) return;
    if (!isLikelyPdfFile(file)) {
      setDocumentMessage({ ok: false, text: "Можно прикрепить только PDF-файл." });
      return;
    }
    setDocumentMessage(null);
    setDocumentFile(file);
  }

  function closeDocumentModal() {
    setDocumentModalPatient(null);
    setDocumentType("CONTRACT");
    setDocumentFile(null);
    setDocumentMessage(null);
    documentDragDepth.current = 0;
    setDocumentDragOver(false);
  }

  async function submitPatientDocument() {
    if (!documentModalPatient) return;
    if (!documentFile) {
      setDocumentMessage({ ok: false, text: "Прикрепите PDF-файл." });
      return;
    }
    setDocumentUploading(true);
    setDocumentMessage(null);
    try {
      const fd = new FormData();
      fd.append("type", documentType);
      fd.append("file", documentFile);
      const response = await fetch(`/api/manager/patients/${documentModalPatient.id}/documents`, {
        method: "POST",
        body: fd,
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setDocumentMessage({ ok: false, text: data?.message ?? "Не удалось прикрепить документ." });
        return;
      }
      setDocumentMessage({ ok: true, text: data?.message ?? "Документ прикреплен." });
      await loadUsers();
      closeDocumentModal();
    } catch {
      setDocumentMessage({ ok: false, text: "Ошибка сети при прикреплении документа." });
    } finally {
      setDocumentUploading(false);
    }
  }

  function getRoleLabel(role: UserRole): string {
    return roleLabelByValue[role];
  }

  function renderAppointmentStatusLabel(status: AppointmentStatus) {
    if (status === "CONFIRMED") {
      return (
        <span className="inline-flex rounded-md border border-emerald-300/70 bg-emerald-50/95 px-3 py-1 text-xs font-medium text-emerald-900/90">
          Подтверждена
        </span>
      );
    }
    if (status === "CANCELLED") {
      return (
        <span className="inline-flex rounded-md border border-red-300/70 bg-red-100/70 px-3 py-1 text-xs font-semibold text-red-900/80">
          Отменена
        </span>
      );
    }
    return (
      <span className="inline-flex rounded-md border border-amber-300/70 bg-amber-50/95 px-3 py-1 text-xs font-semibold text-amber-900/90">
        Ожидает подтверждения
      </span>
    );
  }

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } finally {
      setIsLoggingOut(false);
    }
  }

  async function handleAppointmentAction(appointment: ManagerAppointmentRow, action: "confirm" | "cancel") {
    const confirmText =
      action === "confirm"
        ? `Подтвердить запись на ${appointment.startTime}-${appointment.endTime}?`
        : `Отменить запись на ${appointment.startTime}-${appointment.endTime}?`;
    const allowed = window.confirm(confirmText);
    if (!allowed) {
      return;
    }

    setUpdatingAppointmentId(appointment.id);
    try {
      const response = await fetch(`/api/manager/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        setAppointmentsError(data?.message ?? "Не удалось обновить запись.");
        return;
      }
      await loadAppointments();
    } catch {
      setAppointmentsError("Ошибка сети при обновлении записи.");
    } finally {
      setUpdatingAppointmentId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#e6edf3]">
      <header className="sticky top-0 z-20 flex w-full items-center justify-between bg-[#21486b] px-5 py-4 text-white shadow-lg md:px-8">
        <h1 className="text-lg font-semibold md:text-xl">Панель менеджера</h1>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-[#d7e7f4] md:text-base">
              {greeting}, {currentUserName}
            </p>
            <p className="text-xs text-[#b9d3e6] md:text-sm">{currentUserEmail}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={isLoggingOut}
            className="rounded-md border border-[#8fb0cc] bg-[#2f698f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#275877] disabled:opacity-60 md:text-sm"
          >
            {isLoggingOut ? "Выход..." : "Выйти"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl gap-4 px-4 py-6 md:gap-6 md:px-6">
        <aside className="w-60 shrink-0 self-stretch rounded-2xl border border-[#b9cddd] bg-[#f8fbff] p-4 shadow-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6f88]">
            Панель управления
          </p>
          <button
            type="button"
            onClick={() => setSection("PATIENTS")}
            className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
              section === "PATIENTS"
                ? "bg-[#2f698f] text-white"
                : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
            }`}
          >
            Пациенты
          </button>
          <button
            type="button"
            onClick={() => setSection("APPOINTMENTS")}
            className={`mt-2 w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
              section === "APPOINTMENTS"
                ? "bg-[#2f698f] text-white"
                : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
            }`}
          >
            Записи
          </button>
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl bg-[#f8fbff] p-8 shadow-lg">
          <h1 className="text-2xl font-semibold text-gray-900">
            {section === "PATIENTS" ? "Пациенты" : "Записи на прием"}
          </h1>
          {section === "PATIENTS" ? (
            <>
              <p className="mt-2 text-sm text-[#4f6f88]">
                Контактные телефоны доступны для связи с пациентами после регистрации.
              </p>
              {listError ? (
                <p className="mt-4 rounded-lg border border-[#e0b4b8] bg-[#fce8ea] px-4 py-3 text-sm text-[#8e3f52]">
                  {listError}
                </p>
              ) : null}
              <UsersSection
                layoutVariant="manager"
                activeTab="PATIENTS"
                roleFilter="ALL"
                searchQuery={searchQuery}
                loading={loading}
                visibleUsers={visibleUsers}
                roleOptions={roleOptions}
                onTabChange={() => {}}
                onRoleFilterChange={() => {}}
                onSearchQueryChange={setSearchQuery}
                onOpenUserEdit={() => {}}
                onDeleteEmployee={() => {}}
                deletingEmployeeId={null}
                getRoleLabel={getRoleLabel}
                onManagerAttachDocument={(user) => {
                  setDocumentModalPatient(user);
                  setDocumentType("CONTRACT");
                  setDocumentFile(null);
                  setDocumentMessage(null);
                }}
              />
            </>
          ) : (
            <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
              <input
                type="text"
                value={appointmentsPhoneSearch}
                onChange={(e) => setAppointmentsPhoneSearch(e.target.value)}
                placeholder="Поиск по телефону"
                className="mb-3 w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
              />
              {appointmentsError ? (
                <p className="mb-3 rounded-md border border-[#d8a7b2] bg-[#f6ecef] px-3 py-2 text-sm text-[#8e3f52]">
                  {appointmentsError}
                </p>
              ) : null}
              {appointmentsLoading ? (
                <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
                  Загрузка записей...
                </div>
              ) : visibleAppointments.length === 0 ? (
                <p className="text-sm text-[#6b859a]">Пока нет записей на прием.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-[#c6d7e5] bg-white">
                  <table className="min-w-full text-left text-sm text-[#2b3f50]">
                    <thead className="sticky top-0 z-10 bg-[#edf4fa] text-[#34556f]">
                      <tr>
                        <th className="px-4 py-3">Дата</th>
                        <th className="px-4 py-3">Время</th>
                        <th className="px-4 py-3">Врач</th>
                        <th className="px-4 py-3">Пациент</th>
                        <th className="px-4 py-3">Контакт</th>
                        <th className="px-4 py-3">Статус</th>
                        <th className="px-4 py-3">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleAppointments.map((a) => (
                        <tr key={a.id} className="border-t border-[#e3edf5] transition-colors hover:bg-[#f4f9fd]">
                          <td className="px-4 py-3 whitespace-nowrap">
                            {new Date(a.slotDate).toLocaleDateString("ru-RU")}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                            {a.startTime} - {a.endTime}
                          </td>
                          <td className="px-4 py-3">{a.doctor.fullName}</td>
                          <td className="px-4 py-3">{a.patient.fullName}</td>
                          <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                            {formatRuPhoneForDisplay(a.contactPhone)}
                          </td>
                          <td className="px-4 py-3">
                            {renderAppointmentStatusLabel(a.status)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void handleAppointmentAction(a, "confirm")}
                                disabled={a.status === "CONFIRMED" || updatingAppointmentId === a.id}
                                className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {a.status === "CONFIRMED"
                                  ? "Подтверждено"
                                  : updatingAppointmentId === a.id
                                    ? "Подтверждение..."
                                    : "Подтвердить"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleAppointmentAction(a, "cancel")}
                                disabled={a.status === "CANCELLED" || updatingAppointmentId === a.id}
                                className="rounded-md border border-[#c99daa] bg-[#f6ecef] px-3 py-1 text-xs font-semibold text-[#8e3f52] transition hover:bg-[#f1e2e7] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {a.status === "CANCELLED"
                                  ? "Отменена"
                                  : updatingAppointmentId === a.id
                                    ? "Отмена..."
                                    : "Отменить"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {documentModalPatient ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Прикрепление документа пациенту"
        >
          <div className="w-full max-w-xl rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1f3344]">
                Документы: {documentModalPatient.fullName}
              </h3>
              <button
                type="button"
                onClick={closeDocumentModal}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa]"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="mb-1 text-sm font-medium text-[#1f3344]">Тип документа</p>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value as PatientDocumentType)}
                  className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                >
                  <option value="CONTRACT">Договор</option>
                  <option value="PRESCRIPTION">Рецепт</option>
                  <option value="VISIT_PROTOCOL">Протокол приема</option>
                </select>
              </div>

              <input
                ref={documentInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  handlePickDocumentFile(file);
                }}
              />

              <div
                role="presentation"
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  documentDragDepth.current += 1;
                  setDocumentDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  documentDragDepth.current = Math.max(0, documentDragDepth.current - 1);
                  if (documentDragDepth.current === 0) setDocumentDragOver(false);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  documentDragDepth.current = 0;
                  setDocumentDragOver(false);
                  const file = e.dataTransfer.files?.[0] ?? null;
                  handlePickDocumentFile(file);
                }}
                className={`rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                  documentDragOver ? "border-[#2f698f] bg-[#e8f2fa]" : "border-[#bfd2e2] bg-[#f8fbff]"
                }`}
              >
                <p className="text-sm font-medium text-[#39556d]">Перетащите PDF файл сюда</p>
                <p className="mt-1 text-sm font-medium text-[#39556d]">или</p>
                <button
                  type="button"
                  onClick={() => documentInputRef.current?.click()}
                  className="mt-2 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#dfeef9]"
                >
                  Выберите файл
                </button>
                {documentFile ? (
                  <p className="mt-3 text-xs font-medium text-[#39556d]">{documentFile.name}</p>
                ) : null}
              </div>

              {documentMessage ? (
                <p className={`text-sm ${documentMessage.ok ? "text-[#2f698f]" : "text-red-600"}`}>
                  {documentMessage.text}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDocumentModal}
                  disabled={documentUploading}
                  className="rounded-md border border-[#8fb0cc] bg-white px-4 py-2 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa] disabled:opacity-60"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => void submitPatientDocument()}
                  disabled={documentUploading}
                  className="rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275877] disabled:opacity-60"
                >
                  {documentUploading ? "Сохранение..." : "Прикрепить"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
