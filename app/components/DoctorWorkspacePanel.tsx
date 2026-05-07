"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AvatarCropModal from "@/app/components/AvatarCropModal";
import { formatRuPhoneForDisplay } from "@/lib/authValidation";
import { psychotherapyDiseaseGroups, psychotherapySymptomGroups } from "@/lib/psychotherapyPresets";
import { addDaysToIsoDate, formatDateLocal } from "@/lib/scheduleTime";

type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
type Section = "PROFILE" | "SCHEDULE" | "PATIENTS";
type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type AppointmentFilter = "ALL" | "FREE" | AppointmentStatus;

type Props = {
  currentUserName: string;
  currentUserEmail: string;
};

type ScheduleRow = {
  id: number;
  weekStartDate: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  appointment: {
    id: number;
    status: AppointmentStatus;
    patient: {
      id: number;
      fullName: string;
      email: string;
    };
  } | null;
};

type Diploma = {
  localId: string;
  serverId?: number;
  title: string;
  issuedBy: string;
  year: string;
  pdfFile: File | null;
  previewUrl?: string;
  hasPdf: boolean;
  openUrl?: string;
};

type EducationRow = {
  localId: string;
  when: string;
  institution: string;
  specialty: string;
};

type ApiError = { message?: string };
type ProfilePayload = {
  profile?: {
    avatarUrl?: string;
    doctorBio?: string;
    sessionPrice?: number | null;
    symptoms?: string[];
    diseases?: string[];
    education?: Array<{
      when?: string;
      institution?: string;
      specialty?: string;
    }>;
    diplomas?: Array<{
      id: number;
      title?: string;
      issuedBy?: string | null;
      year?: number | null;
      fileUrl?: string;
    }>;
  };
  message?: string;
};
type SchedulePayload = { schedules?: ScheduleRow[]; message?: string };
type DoctorAppointmentRow = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  contactPhone: string | null;
  status: AppointmentStatus;
  createdAt: string;
  patient: {
    id: number;
    fullName: string;
    email: string;
  };
};
type PatientNoteRow = {
  id: number;
  content: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
  doctorFullName: string;
};

const MAX_AVATAR_BYTES_CLIENT = 5 * 1024 * 1024;
const MAX_AVATAR_SOURCE_BYTES = 15 * 1024 * 1024;

const weekdays: Array<{ value: Weekday; label: string }> = [
  { value: "MONDAY", label: "Понедельник" },
  { value: "TUESDAY", label: "Вторник" },
  { value: "WEDNESDAY", label: "Среда" },
  { value: "THURSDAY", label: "Четверг" },
  { value: "FRIDAY", label: "Пятница" },
  { value: "SATURDAY", label: "Суббота" },
  { value: "SUNDAY", label: "Воскресенье" },
];

function mondayOf(date = new Date()): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekToIso(week: string): string | null {
  const match = week.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const w = Number(match[2]);
  const jan4 = new Date(y, 0, 4);
  const firstMonday = mondayOf(jan4);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (w - 1) * 7);
  return formatDateLocal(monday);
}

function isoToWeekInput(date = new Date()): string {
  const monday = mondayOf(date);
  const y = monday.getFullYear();
  const jan4 = new Date(y, 0, 4);
  const firstMonday = mondayOf(jan4);
  const w = Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${y}-W${String(w).padStart(2, "0")}`;
}

function newDiplomaLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function newEducationLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function emptyEducation(): EducationRow {
  return {
    localId: newEducationLocalId(),
    when: "",
    institution: "",
    specialty: "",
  };
}

function isBlankNewRow(d: Diploma): boolean {
  return (
    d.serverId == null &&
    !d.title.trim() &&
    !d.issuedBy.trim() &&
    !d.year.trim() &&
    !d.pdfFile &&
    !d.hasPdf
  );
}

function isBlankEducationRow(item: EducationRow): boolean {
  return !item.when.trim() && !item.institution.trim() && !item.specialty.trim();
}

function normalizeEducationYear(value: string): string {
  const trimmed = value.trim();
  if (/^\d{4}$/.test(trimmed)) return trimmed;
  const fromDate = trimmed.match(/^\d{2}\.\d{2}\.(\d{4})$/);
  if (fromDate) return fromDate[1];
  return trimmed.replace(/\D/g, "").slice(0, 4);
}

function isValidEducationYear(value: string): boolean {
  const trimmed = value.trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const year = Number(trimmed);
  const currentYear = new Date().getFullYear();
  return year >= 1900 && year <= currentYear;
}

function formatEducationYearInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

function isLikelyJpegFile(file: File): boolean {
  if (file.type === "image/jpeg") return true;
  if (file.type && file.type !== "") return false;
  return /\.jpe?g$/i.test(file.name);
}

function isRasterImageFile(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === "image/svg+xml") return false;
  if (t.startsWith("image/")) return true;
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(file.name);
}

function isLikelyPdfFile(file: File): boolean {
  if (file.type === "application/pdf") return true;
  if (file.type && file.type !== "") return false;
  return /\.pdf$/i.test(file.name);
}

function pickFirstRasterImageFromList(files: FileList | null): File | null {
  if (!files?.length) return null;
  for (const f of Array.from(files)) {
    if (isRasterImageFile(f)) return f;
  }
  return null;
}

function withAvatarCacheBust(url: string, bust: number): string {
  if (!url) return "";
  if (url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${bust}`;
}

function hasProfileDataInPayload(profile: NonNullable<ProfilePayload["profile"]>): boolean {
  const hasAvatar = Boolean((profile.avatarUrl ?? "").trim());
  const hasBio = Boolean((profile.doctorBio ?? "").trim());
  const hasSessionPrice = typeof profile.sessionPrice === "number" && profile.sessionPrice > 0;
  const hasSymptoms = (profile.symptoms ?? []).some((s) => s.trim().length > 0);
  const hasDiseases = (profile.diseases ?? []).some((d) => d.trim().length > 0);
  const hasDiplomas = (profile.diplomas ?? []).length > 0;
  const hasEducation = (profile.education ?? []).length > 0;
  return hasAvatar || hasBio || hasSessionPrice || hasSymptoms || hasDiseases || hasDiplomas || hasEducation;
}

function cloneEducationRows(rows: EducationRow[]): EducationRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneDiplomaRows(rows: Diploma[]): Diploma[] {
  return rows.map((row) => ({ ...row }));
}

export default function DoctorWorkspacePanel({ currentUserName, currentUserEmail }: Props) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("PROFILE");
  const [weekInput, setWeekInput] = useState(() => isoToWeekInput());
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleError, setScheduleError] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleFilter, setScheduleFilter] = useState<AppointmentFilter>("ALL");
  const [scheduleSlotModal, setScheduleSlotModal] = useState<{
    dateIso: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    patientFullName: string;
    patientEmail: string;
  } | null>(null);
  const [appointments, setAppointments] = useState<DoctorAppointmentRow[]>([]);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [myPatientsSearch, setMyPatientsSearch] = useState("");
  const [selectedPatientIdForNotes, setSelectedPatientIdForNotes] = useState<number | null>(null);
  const [patientNotes, setPatientNotes] = useState<PatientNoteRow[]>([]);
  const [patientNotesLoading, setPatientNotesLoading] = useState(false);
  const [patientNotesError, setPatientNotesError] = useState("");
  const [patientNoteSaving, setPatientNoteSaving] = useState(false);
  const [patientNoteFile, setPatientNoteFile] = useState<File | null>(null);
  const [patientNoteDragOver, setPatientNoteDragOver] = useState(false);
  const patientNoteDragDepth = useRef(0);
  const patientNoteInputRef = useRef<HTMLInputElement>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const [avatarUrl, setAvatarUrl] = useState("");
  const [committedAvatarUrl, setCommittedAvatarUrl] = useState("");
  const [avatarCacheBust, setAvatarCacheBust] = useState(() => Date.now());
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const pendingAvatarPreviewUrlRef = useRef<string | null>(null);
  const [avatarDragOver, setAvatarDragOver] = useState(false);
  const avatarDragDepth = useRef(0);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const addDiplomaInputRef = useRef<HTMLInputElement>(null);
  const viewDiplomasScrollRef = useRef<HTMLDivElement>(null);
  const editDiplomasScrollRef = useRef<HTMLDivElement>(null);
  const addDiplomaDragDepth = useRef(0);
  const diplomaPreviewUrlsRef = useRef<string[]>([]);
  const [avatarCropSrc, setAvatarCropSrc] = useState<string | null>(null);

  const [doctorBio, setDoctorBio] = useState("");
  const [committedDoctorBio, setCommittedDoctorBio] = useState("");
  const [sessionPriceInput, setSessionPriceInput] = useState("");
  const [committedSessionPriceInput, setCommittedSessionPriceInput] = useState("");
  const [symptomsInput, setSymptomsInput] = useState("");
  const [committedSymptomsInput, setCommittedSymptomsInput] = useState("");
  const [diseasesInput, setDiseasesInput] = useState("");
  const [committedDiseasesInput, setCommittedDiseasesInput] = useState("");
  const [diplomas, setDiplomas] = useState<Diploma[]>([]);
  const [committedDiplomas, setCommittedDiplomas] = useState<Diploma[]>([]);
  const [educationRows, setEducationRows] = useState<EducationRow[]>([]);
  const [committedEducationRows, setCommittedEducationRows] = useState<EducationRow[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isProfileModeAnimating, setIsProfileModeAnimating] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [openedDiplomaUrl, setOpenedDiplomaUrl] = useState<string | null>(null);
  const [isAddDiplomaOpen, setIsAddDiplomaOpen] = useState(false);
  const [addDiplomaDragOver, setAddDiplomaDragOver] = useState(false);

  const weekStartIso = useMemo(() => weekToIso(weekInput), [weekInput]);
  const avatarDisplaySrc = useMemo(
    () => withAvatarCacheBust(avatarUrl, avatarCacheBust),
    [avatarUrl, avatarCacheBust],
  );
  const committedAvatarDisplaySrc = useMemo(
    () => withAvatarCacheBust(committedAvatarUrl, avatarCacheBust),
    [committedAvatarUrl, avatarCacheBust],
  );
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Доброе утро";
    if (hour >= 12 && hour < 18) return "Добрый день";
    return "Добрый вечер";
  }, []);
  const selectedSymptomsSet = useMemo(
    () =>
      new Set(
        symptomsInput
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      ),
    [symptomsInput],
  );
  const committedSymptomsViewList = useMemo(
    () =>
      committedSymptomsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [committedSymptomsInput],
  );
  const selectedDiseasesSet = useMemo(
    () =>
      new Set(
        diseasesInput
          .split(",")
          .map((d) => d.trim().toLowerCase())
          .filter(Boolean),
      ),
    [diseasesInput],
  );
  const committedDiseasesViewList = useMemo(
    () =>
      committedDiseasesInput
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
    [committedDiseasesInput],
  );
  const committedDiplomasForView = useMemo(
    () => committedDiplomas.filter((d) => d.serverId != null || !isBlankNewRow(d)),
    [committedDiplomas],
  );
  const committedEducationForView = useMemo(
    () => committedEducationRows.filter((row) => !isBlankEducationRow(row)),
    [committedEducationRows],
  );

  const grouped = useMemo(() => {
    return Object.fromEntries(
      weekdays.map((day) => [
        day.value,
        scheduleRows.filter((row) => {
          if (row.weekday !== day.value) return false;
          if (scheduleFilter === "ALL") return true;
          if (scheduleFilter === "FREE") return row.appointment == null;
          return row.appointment?.status === scheduleFilter;
        }),
      ]),
    ) as Record<Weekday, ScheduleRow[]>;
  }, [scheduleRows, scheduleFilter]);
  const sessionPriceForView = useMemo(() => {
    const n = Number(committedSessionPriceInput);
    if (!Number.isInteger(n) || n <= 0) return "";
    return n.toLocaleString("ru-RU");
  }, [committedSessionPriceInput]);
  const myPatients = useMemo(() => {
    const latestConfirmedByPatient = new Map<
      number,
      {
        id: number;
        fullName: string;
        email: string;
        lastConfirmedSessionAt: string;
      }
    >();
    for (const item of appointments) {
      if (item.status !== "CONFIRMED") continue;
      const sessionAtIso = `${item.slotDate.slice(0, 10)}T${item.startTime}:00`;
      const current = latestConfirmedByPatient.get(item.patient.id);
      if (!current || sessionAtIso > current.lastConfirmedSessionAt) {
        latestConfirmedByPatient.set(item.patient.id, {
          id: item.patient.id,
          fullName: item.patient.fullName,
          email: item.patient.email,
          lastConfirmedSessionAt: sessionAtIso,
        });
      }
    }
    return Array.from(latestConfirmedByPatient.values()).sort(
      (a, b) => b.lastConfirmedSessionAt.localeCompare(a.lastConfirmedSessionAt),
    );
  }, [appointments]);
  const filteredMyPatients = useMemo(() => {
    const q = myPatientsSearch.trim().toLowerCase();
    if (!q) return myPatients;
    return myPatients.filter(
      (patient) =>
        patient.fullName.toLowerCase().includes(q) || patient.email.toLowerCase().includes(q),
    );
  }, [myPatients, myPatientsSearch]);
  const selectedPatientForNotes = useMemo(
    () => myPatients.find((patient) => patient.id === selectedPatientIdForNotes) ?? null,
    [myPatients, selectedPatientIdForNotes],
  );
  const loadPatientNotes = useCallback(async (patientId: number) => {
    setPatientNotesLoading(true);
    setPatientNotesError("");
    try {
      const res = await fetch(`/api/doctor/patients/${patientId}/notes`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { notes?: PatientNoteRow[]; message?: string }
        | null;
      if (!res.ok || !Array.isArray(data?.notes)) {
        setPatientNotes([]);
        setPatientNotesError(data?.message ?? "Не удалось загрузить заметки.");
        return;
      }
      setPatientNotes(data.notes);
    } catch {
      setPatientNotes([]);
      setPatientNotesError("Ошибка сети при загрузке заметок.");
    } finally {
      setPatientNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedPatientForNotes) {
      setPatientNotes([]);
      setPatientNotesError("");
      setPatientNoteFile(null);
      return;
    }
    void loadPatientNotes(selectedPatientForNotes.id);
  }, [selectedPatientForNotes, loadPatientNotes]);

  function isLikelyPdfFile(file: File): boolean {
    if (file.type === "application/pdf") return true;
    if (file.type && file.type !== "") return false;
    return /\.pdf$/i.test(file.name);
  }

  function setPatientNotePickedFile(file: File | null) {
    if (!file) return;
    if (!isLikelyPdfFile(file)) {
      setPatientNotesError("Можно прикрепить только PDF файл.");
      return;
    }
    setPatientNotesError("");
    setPatientNoteFile(file);
  }

  async function savePatientNote() {
    if (!selectedPatientForNotes) return;
    if (!patientNoteFile) {
      setPatientNotesError("Прикрепите PDF файл заметки.");
      return;
    }
    setPatientNoteSaving(true);
    setPatientNotesError("");
    try {
      const fd = new FormData();
      fd.append("file", patientNoteFile);
      const res = await fetch(`/api/doctor/patients/${selectedPatientForNotes.id}/notes`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setPatientNotesError(data?.message ?? "Не удалось сохранить заметку.");
        return;
      }
      setPatientNoteFile(null);
      await loadPatientNotes(selectedPatientForNotes.id);
    } catch {
      setPatientNotesError("Ошибка сети при сохранении заметки.");
    } finally {
      setPatientNoteSaving(false);
    }
  }

  function clearPendingAvatarPreview() {
    if (pendingAvatarPreviewUrlRef.current) {
      URL.revokeObjectURL(pendingAvatarPreviewUrlRef.current);
      pendingAvatarPreviewUrlRef.current = null;
    }
    setPendingAvatarFile(null);
  }

  function resetEditStateToCommitted() {
    setAvatarUrl(committedAvatarUrl);
    setDoctorBio(committedDoctorBio);
    setSessionPriceInput(committedSessionPriceInput);
    setSymptomsInput(committedSymptomsInput);
    setDiseasesInput(committedDiseasesInput);
    setEducationRows(cloneEducationRows(committedEducationRows));
    setDiplomas((prev) => {
      for (const row of prev) {
        if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
      }
      return cloneDiplomaRows(committedDiplomas);
    });
    clearPendingAvatarPreview();
  }

  function openProfileEditor() {
    resetEditStateToCommitted();
    setIsProfileEditOpen(true);
  }

  function closeProfileEditorWithoutSave() {
    resetEditStateToCommitted();
    setIsProfileEditOpen(false);
  }

  const loadProfile = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setProfileLoading(true);
    if (!options?.preserveMessage) {
      setProfileMessage(null);
    }
    try {
      const res = await fetch("/api/doctor/profile", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as ProfilePayload | null;
      if (!res.ok || !data?.profile) {
        setProfileMessage({ ok: false, text: data?.message ?? "Не удалось загрузить профиль." });
        return;
      }
      setProfileExists(hasProfileDataInPayload(data.profile));
      const nextAvatarUrl = data.profile.avatarUrl ?? "";
      const nextDoctorBio = data.profile.doctorBio ?? "";
      const nextSessionPriceInput =
        typeof data.profile.sessionPrice === "number" && Number.isFinite(data.profile.sessionPrice)
          ? String(Math.trunc(data.profile.sessionPrice))
          : "";
      const nextSymptomsInput = (data.profile.symptoms ?? []).join(", ");
      const nextDiseasesInput = (data.profile.diseases ?? []).join(", ");
      setAvatarUrl(nextAvatarUrl);
      setCommittedAvatarUrl(nextAvatarUrl);
      setAvatarCacheBust(Date.now());
      setDoctorBio(nextDoctorBio);
      setCommittedDoctorBio(nextDoctorBio);
      setSessionPriceInput(nextSessionPriceInput);
      setCommittedSessionPriceInput(nextSessionPriceInput);
      setSymptomsInput(nextSymptomsInput);
      setCommittedSymptomsInput(nextSymptomsInput);
      setDiseasesInput(nextDiseasesInput);
      setCommittedDiseasesInput(nextDiseasesInput);
      const educationList = (data.profile.education ?? []).map((item) => ({
        localId: newEducationLocalId(),
        when: normalizeEducationYear(item.when ?? ""),
        institution: item.institution ?? "",
        specialty: item.specialty ?? "",
      }));
      const nextEducationRows = educationList;
      setEducationRows(cloneEducationRows(nextEducationRows));
      setCommittedEducationRows(cloneEducationRows(nextEducationRows));
      const list = (data.profile.diplomas ?? []).map((d) => ({
        localId: newDiplomaLocalId(),
        serverId: d.id,
        title: d.title ?? "",
        issuedBy: d.issuedBy ?? "",
        year: d.year == null ? "" : String(d.year),
        pdfFile: null,
        previewUrl: undefined,
        hasPdf: true,
        openUrl: d.fileUrl,
      }));
      setDiplomas((prev) => {
        for (const row of prev) {
          if (row.previewUrl) URL.revokeObjectURL(row.previewUrl);
        }
        return cloneDiplomaRows(list);
      });
      setCommittedDiplomas(cloneDiplomaRows(list));
      clearPendingAvatarPreview();
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadSchedule = useCallback(async () => {
    if (!weekStartIso) {
      setScheduleRows([]);
      setScheduleError("Некорректная неделя.");
      return;
    }
    setScheduleLoading(true);
    setScheduleError("");
    try {
      const res = await fetch(`/api/doctor/schedules?weekStartDate=${weekStartIso}`, { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as SchedulePayload | null;
      if (!res.ok || !data?.schedules) {
        setScheduleRows([]);
        setScheduleError(data?.message ?? "Не удалось загрузить расписание.");
        return;
      }
      setScheduleRows(data.schedules);
    } finally {
      setScheduleLoading(false);
    }
  }, [weekStartIso]);

  const loadAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    setAppointmentsError("");
    try {
      const res = await fetch("/api/doctor/appointments", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | { appointments?: DoctorAppointmentRow[]; message?: string }
        | null;
      if (!res.ok || !data?.appointments) {
        setAppointments([]);
        setAppointmentsError(data?.message ?? "Не удалось загрузить записи.");
        return;
      }
      setAppointments(data.appointments);
    } finally {
      setAppointmentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (section === "SCHEDULE") void loadSchedule();
  }, [section, loadSchedule]);

  useEffect(() => {
    if (section === "PATIENTS") void loadAppointments();
  }, [section, loadAppointments]);

  useEffect(() => {
    setIsProfileModeAnimating(true);
    const rafId = requestAnimationFrame(() => setIsProfileModeAnimating(false));
    return () => cancelAnimationFrame(rafId);
  }, [isProfileEditOpen]);

  useEffect(() => {
    diplomaPreviewUrlsRef.current = diplomas
      .map((row) => row.previewUrl)
      .filter((url): url is string => Boolean(url));
  }, [diplomas]);

  useEffect(() => {
    return () => {
      for (const url of diplomaPreviewUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function removeDiplomaRow(localId: string) {
    setDiplomas((prev) => {
      const removed = prev.find((d) => d.localId === localId);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((d) => d.localId !== localId);
    });
  }

  function addDiplomaFromFile(file: File): boolean {
    if (!isLikelyPdfFile(file)) {
      setProfileMessage({ ok: false, text: "Можно добавить только PDF файл диплома." });
      return false;
    }
    const localId = newDiplomaLocalId();
    setDiplomas((prev) => [
      ...prev,
      {
        localId,
        title: "",
        issuedBy: "",
        year: "",
        pdfFile: file,
        previewUrl: URL.createObjectURL(file),
        hasPdf: false,
      },
    ]);
    setProfileMessage({ ok: true, text: "Диплом добавлен в список." });
    return true;
  }

  function removeDiplomaWithConfirm(localId: string) {
    const confirmed = window.confirm("Удалить этот диплом?");
    if (!confirmed) return;
    removeDiplomaRow(localId);
    setProfileMessage({ ok: true, text: "Диплом удален из списка." });
  }

  function removeEducationRow(localId: string) {
    setEducationRows((prev) => prev.filter((item) => item.localId !== localId));
  }

  async function uploadAvatarFile(file: File): Promise<boolean> {
    if (!isLikelyJpegFile(file)) {
      setProfileMessage({ ok: false, text: "Выберите фото в формате JPEG (.jpg или .jpeg)." });
      return false;
    }
    if (file.size > MAX_AVATAR_BYTES_CLIENT) {
      setProfileMessage({ ok: false, text: "Файл фото слишком большой (максимум 5 МБ)." });
      return false;
    }
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/doctor/profile/avatar", { method: "POST", body: fd });
      const data = (await res.json().catch(() => null)) as ApiError & { avatarUrl?: string } | null;
      if (!res.ok) {
        setProfileMessage({ ok: false, text: data?.message ?? "Не удалось загрузить фото." });
        return false;
      }
      if (data?.avatarUrl) setAvatarUrl(data.avatarUrl);
      setAvatarCacheBust(Date.now());
      return true;
    } finally {
      setAvatarUploading(false);
    }
  }

  async function saveProfile() {
    const rows = diplomas.filter((d) => !isBlankNewRow(d));
    const education = educationRows.filter((row) => !isBlankEducationRow(row));
    for (const d of rows) {
      if (d.serverId == null && !d.pdfFile) {
        setProfileMessage({ ok: false, text: "Для нового диплома прикрепите PDF." });
        return;
      }
    }
    for (const item of education) {
      if (!item.when.trim() || !item.institution.trim() || !item.specialty.trim()) {
        setProfileMessage({
          ok: false,
          text: "Для каждой записи образования заполните дату, учреждение и специальность.",
        });
        return;
      }
      if (!isValidEducationYear(item.when)) {
        setProfileMessage({
          ok: false,
          text: "Год получения образования должен быть в формате ГГГГ и не быть в будущем.",
        });
        return;
      }
    }

    const metaOk: Array<{ id: number | null; title: string; issuedBy: string | null; year: number | null }> =
      rows.map((d, idx) => ({
        id: d.serverId ?? null,
        title: d.title.trim() || `Сертификат/диплом ${idx + 1}`,
        issuedBy: null,
        year: null,
      }));

    const trimmedSessionPrice = sessionPriceInput.trim();
    if (trimmedSessionPrice && !/^\d+$/.test(trimmedSessionPrice)) {
      setProfileMessage({ ok: false, text: "Цена за сеанс должна содержать только цифры." });
      return;
    }
    if (trimmedSessionPrice) {
      if (trimmedSessionPrice.length > 1 && trimmedSessionPrice.startsWith("0")) {
        setProfileMessage({ ok: false, text: "Цена за сеанс не должна начинаться с нуля." });
        return;
      }
      const value = Number(trimmedSessionPrice);
      if (!Number.isInteger(value) || value < 1 || value > 1_000_000) {
        setProfileMessage({ ok: false, text: "Цена за сеанс должна быть от 1 до 1000000." });
        return;
      }
    }

    setProfileSaving(true);
    setProfileMessage(null);
    try {
      if (pendingAvatarFile) {
        const avatarOk = await uploadAvatarFile(pendingAvatarFile);
        if (!avatarOk) {
          return;
        }
      }

      const fd = new FormData();
      fd.append("doctorBio", doctorBio);
      fd.append("sessionPrice", trimmedSessionPrice);
      fd.append("symptoms", symptomsInput);
      fd.append("diseases", diseasesInput);
      fd.append(
        "educationMeta",
        JSON.stringify(
          education.map((item) => ({
            when: item.when.trim(),
            institution: item.institution.trim(),
            specialty: item.specialty.trim(),
          })),
        ),
      );
      fd.append("diplomasMeta", JSON.stringify(metaOk));
      for (const d of rows) {
        if (d.serverId != null && d.pdfFile) fd.append(`replace_${d.serverId}`, d.pdfFile);
        if (d.serverId == null && d.pdfFile) fd.append("newDiploma", d.pdfFile);
      }
      const res = await fetch("/api/doctor/profile", { method: "PATCH", body: fd });
      const data = (await res.json().catch(() => null)) as ApiError | null;
      if (!res.ok) {
        setProfileMessage({ ok: false, text: data?.message ?? "Не удалось сохранить профиль." });
        return;
      }
      setProfileMessage({ ok: true, text: data?.message ?? "Профиль врача обновлен." });
      await loadProfile({ preserveMessage: true });
      setIsProfileEditOpen(false);
    } finally {
      setProfileSaving(false);
    }
  }

  function dismissAvatarCrop() {
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  function openAvatarCropFromFile(file: File) {
    if (!isRasterImageFile(file)) {
      setProfileMessage({ ok: false, text: "Выберите файл изображения (например JPEG или PNG)." });
      return;
    }
    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      setProfileMessage({ ok: false, text: "Файл слишком большой (максимум 15 МБ для исходного фото)." });
      return;
    }
    setProfileMessage(null);
    setAvatarCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function setPendingAvatarFromCrop(file: File) {
    clearPendingAvatarPreview();
    const previewUrl = URL.createObjectURL(file);
    pendingAvatarPreviewUrlRef.current = previewUrl;
    setPendingAvatarFile(file);
    setAvatarUrl(previewUrl);
  }

  function addSymptomPreset(symptom: string) {
    const current = symptomsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = current.some((s) => s.toLowerCase() === symptom.toLowerCase());
    const next = exists
      ? current.filter((s) => s.toLowerCase() !== symptom.toLowerCase())
      : [...current, symptom];
    setSymptomsInput(next.join(", "));
  }

  function addDiseasePreset(disease: string) {
    const current = diseasesInput
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    const exists = current.some((d) => d.toLowerCase() === disease.toLowerCase());
    const next = exists
      ? current.filter((d) => d.toLowerCase() !== disease.toLowerCase())
      : [...current, disease];
    setDiseasesInput(next.join(", "));
  }

  function scrollDiplomasRow(target: "view" | "edit", direction: "left" | "right") {
    const ref = target === "view" ? viewDiplomasScrollRef : editDiplomasScrollRef;
    if (!ref.current) return;
    const node = ref.current;
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

  function getSlotStatusClasses(status: AppointmentStatus | null): string {
    if (status === "PENDING") {
      return "border border-amber-300/70 bg-amber-50/95 text-amber-900/90";
    }
    if (status === "CONFIRMED") {
      return "border border-[#8fb0cc] bg-[#edf5fb] text-[#1f4e72]";
    }
    if (status === "CANCELLED") {
      return "border border-red-300/70 bg-red-100/70 text-red-900/80";
    }
    return "border border-[#cddae6] bg-[#f3f7fb] text-[#5f7a92]";
  }

  async function logout() {
    setLogoutLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#e6edf3]">
      <header className="sticky top-0 z-20 flex w-full items-center justify-between bg-[#21486b] px-5 py-4 text-white shadow-lg md:px-8">
        <h1 className="text-lg font-semibold md:text-xl">Панель врача</h1>
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
            disabled={logoutLoading}
            className="rounded-md border border-[#8fb0cc] bg-[#2f698f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#275877] disabled:opacity-60 md:text-sm"
          >
            {logoutLoading ? "Выход..." : "Выйти"}
          </button>
        </div>
      </header>

      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl gap-4 px-4 py-6 md:gap-6 md:px-6">
        <aside className="w-60 shrink-0 self-stretch rounded-2xl border border-[#b9cddd] bg-[#f8fbff] p-4 shadow-md">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6f88]">
            Панель управления
          </p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setSection("PROFILE")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                section === "PROFILE"
                  ? "bg-[#2f698f] text-white"
                  : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
              }`}
            >
              Мой профиль
            </button>
            <button
              type="button"
              onClick={() => setSection("SCHEDULE")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                section === "SCHEDULE"
                  ? "bg-[#2f698f] text-white"
                  : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
              }`}
            >
              Мое расписание
            </button>
            <button
              type="button"
              onClick={() => setSection("PATIENTS")}
              className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
                section === "PATIENTS"
                  ? "bg-[#2f698f] text-white"
                  : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
              }`}
            >
              Мои пациенты
            </button>
          </div>
        </aside>

        <section className="min-w-0 flex-1 rounded-2xl bg-[#f8fbff] p-8 shadow-lg">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-[#1f3344]">
              {section === "PROFILE"
                ? isProfileEditOpen
                  ? "Редактирование профиля"
                  : "Мой профиль"
                : section === "SCHEDULE"
                  ? "Мое расписание"
                  : "Мои пациенты"}
            </h1>
            {section === "PROFILE" && !isProfileEditOpen ? (
              <button
                type="button"
                onClick={openProfileEditor}
                aria-label={profileExists ? "Редактировать профиль" : "Создать профиль"}
                title={profileExists ? "Редактировать профиль" : "Создать профиль"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#8fb0cc] bg-white text-[#1f4e72] transition hover:bg-[#edf4fa]"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
              </button>
            ) : null}
          </div>

          {section === "PROFILE" ? (
            <div className="mt-6 space-y-4 rounded-xl border border-[#c6d7e5] bg-white p-5">
              {profileLoading ? (
                <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
                  Загрузка профиля...
                </div>
              ) : (
                isProfileEditOpen ? (
                  <div
                    className={`space-y-5 rounded-2xl bg-white px-5 pb-5 pt-3 transition-opacity duration-200 ease-out ${
                      isProfileModeAnimating ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="mb-0.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={closeProfileEditorWithoutSave}
                        disabled={profileSaving || avatarUploading}
                        aria-label="Закрыть"
                        className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa] disabled:opacity-60"
                      >
                        &times;
                      </button>
                    </div>

                    <div>
                      <div className="flex items-stretch gap-4">
                        <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c6d7e5] bg-[#edf4fa]">
                          {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatarDisplaySrc} alt="Фото врача" className="h-full w-full object-cover" />
                          ) : (
                            <span className="px-2 text-center text-xs text-[#5f7a92]">Нет фото</span>
                          )}
                        </div>
                        <div className="flex min-h-32 min-w-0 flex-1 flex-col gap-2">
                          <input
                            ref={avatarFileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                            className="sr-only"
                            disabled={avatarUploading || !!avatarCropSrc}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              if (file) openAvatarCropFromFile(file);
                            }}
                          />
                          <div
                            role="presentation"
                            onDragEnter={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              avatarDragDepth.current += 1;
                              setAvatarDragOver(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              avatarDragDepth.current = Math.max(0, avatarDragDepth.current - 1);
                              if (avatarDragDepth.current === 0) setAvatarDragOver(false);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              avatarDragDepth.current = 0;
                              setAvatarDragOver(false);
                              const file = pickFirstRasterImageFromList(e.dataTransfer.files);
                              if (file) openAvatarCropFromFile(file);
                            }}
                            className={`flex min-h-32 w-full flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 text-center transition ${
                              avatarDragOver ? "border-[#2f698f] bg-[#e8f2fa]" : "border-[#bfd2e2] bg-[#f8fbff]"
                            }`}
                          >
                            <p className="text-sm font-medium text-[#39556d]">Перетащите изображение</p>
                            <p className="mt-1 text-sm font-medium text-[#39556d]">или</p>
                            <button
                              type="button"
                              disabled={avatarUploading || !!avatarCropSrc}
                              onClick={() => avatarFileInputRef.current?.click()}
                              className="mt-2 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:opacity-60"
                            >
                              Выберите файл
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="mb-1 text-sm font-medium text-[#1f3344]">О себе</p>
                      <textarea
                        className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
                        rows={4}
                        placeholder="Описание"
                        value={doctorBio}
                        onChange={(e) => setDoctorBio(e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium text-[#1f3344]">Цена за сеанс</p>
                      <input
                        className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
                        inputMode="numeric"
                        maxLength={7}
                        placeholder="Цена за сеанс"
                        value={sessionPriceInput}
                        onChange={(e) => setSessionPriceInput(e.target.value.replace(/\D/g, "").slice(0, 7))}
                      />
                    </div>
                    <div className="rounded-md border border-[#dbe8f2] bg-[#f8fbff] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7a92]">
                        Выберите симптомы (только из списка)
                      </p>
                      <div className="space-y-2">
                        {psychotherapySymptomGroups.map((group) => (
                          <div key={group.title}>
                            <p className="mb-1 text-xs font-medium text-[#446079]">{group.title}</p>
                            <div className="flex flex-wrap gap-2">
                              {group.items.map((item) => {
                                const selected = selectedSymptomsSet.has(item.toLowerCase());
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => addSymptomPreset(item)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                      selected
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
                    </div>
                    <div className="rounded-md border border-[#dbe8f2] bg-[#f8fbff] p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7a92]">
                        Выберите заболевания (только из списка)
                      </p>
                      <div className="space-y-2">
                        {psychotherapyDiseaseGroups.map((group) => (
                          <div key={group.title}>
                            <p className="mb-1 text-xs font-medium text-[#446079]">{group.title}</p>
                            <div className="flex flex-wrap gap-2">
                              {group.items.map((item) => {
                                const selected = selectedDiseasesSet.has(item.toLowerCase());
                                return (
                                  <button
                                    key={item}
                                    type="button"
                                    onClick={() => addDiseasePreset(item)}
                                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                      selected
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
                    </div>

                    <div>
                      <div className="mb-2">
                        <p className="text-sm font-medium text-[#1f3344]">Образование</p>
                      </div>
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEducationRows((prev) => {
                              if (prev.some((row) => isBlankEducationRow(row))) {
                                setProfileMessage({
                                  ok: false,
                                  text: "Сначала заполните текущую пустую запись образования.",
                                });
                                return prev;
                              }
                              return [...prev, emptyEducation()];
                            })
                          }
                          className="group w-full rounded-lg border border-[#c6d7e5] bg-[#f8fbff] p-3 text-[#2f698f] transition hover:border-[#2f698f] hover:bg-[#edf4fa] md:grid md:grid-cols-2 md:gap-3"
                        >
                          <span className="inline-flex min-h-[8.75rem] w-full items-center justify-center md:col-span-2">
                            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#8fb0cc] bg-[#edf5fb] text-2xl font-semibold leading-none">
                              +
                            </span>
                          </span>
                        </button>
                        {educationRows.length === 0 ? null : educationRows.map((item) => (
                          <div
                            key={item.localId}
                            className="rounded-lg border border-[#c6d7e5] bg-[#f8fbff] p-3 md:grid md:grid-cols-2 md:gap-3"
                          >
                            <input
                              className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                              placeholder="Год получения (ГГГГ)"
                              inputMode="numeric"
                              maxLength={4}
                              value={item.when}
                              onChange={(e) =>
                                setEducationRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === item.localId
                                      ? { ...x, when: formatEducationYearInput(e.target.value) }
                                      : x,
                                  ),
                                )
                              }
                            />
                            <input
                              className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                              placeholder="Образовательное учреждение"
                              value={item.institution}
                              onChange={(e) =>
                                setEducationRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === item.localId ? { ...x, institution: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <input
                              className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f] md:col-span-2"
                              placeholder="Наименование специальности"
                              value={item.specialty}
                              onChange={(e) =>
                                setEducationRows((prev) =>
                                  prev.map((x) =>
                                    x.localId === item.localId ? { ...x, specialty: e.target.value } : x,
                                  ),
                                )
                              }
                            />
                            <div className="flex items-end justify-end md:col-span-2">
                              <button
                                type="button"
                                onClick={() => removeEducationRow(item.localId)}
                                className="rounded-md border border-[#c99daa] bg-[#f6ecef] px-3 py-2 text-sm font-semibold text-[#8e3f52] transition hover:bg-[#f1e2e7]"
                              >
                                Удалить образование
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[#dbe8f2] bg-[#f8fbff] p-4">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#1f3344]">
                          Сертификаты и дипломы ({diplomas.length})
                        </p>
                        <input
                          ref={addDiplomaInputRef}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            e.target.value = "";
                            if (file) {
                              const added = addDiplomaFromFile(file);
                              if (added) setIsAddDiplomaOpen(false);
                            }
                          }}
                        />
                      </div>
                      <div ref={editDiplomasScrollRef} className="overflow-x-hidden pb-1">
                        <div className={`flex min-w-max gap-3 ${diplomas.length <= 4 ? "justify-center" : ""}`}>
                          <button
                            type="button"
                            onClick={() => setIsAddDiplomaOpen(true)}
                            className="group flex h-56 w-40 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[#bfd2e2] bg-white text-[#2f698f] transition hover:border-[#2f698f] hover:bg-[#edf4fa]"
                          >
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#8fb0cc] bg-[#edf5fb] text-xl font-semibold">
                              +
                            </span>
                          </button>
                          {diplomas.map((d) => {
                            const source = d.previewUrl ?? d.openUrl ?? null;
                            return (
                              <div key={d.localId} className="group relative h-56 w-40 shrink-0">
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeDiplomaWithConfirm(d.localId);
                                  }}
                                  aria-label="Удалить диплом"
                                  className="absolute right-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-lg leading-none font-medium text-[#8e3f52] opacity-0 shadow-sm transition hover:bg-[#f6ecef] group-hover:opacity-100"
                                >
                                  &times;
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (source) setOpenedDiplomaUrl(source);
                                  }}
                                  className="group relative h-56 w-40 shrink-0 overflow-hidden rounded-lg bg-[#f8fbff] text-left transition"
                                >
                                  {source ? (
                                    <object
                                      data={`${source}#toolbar=0&navpanes=0&scrollbar=0`}
                                      type="application/pdf"
                                      className="h-full w-full pointer-events-none"
                                    >
                                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                        PDF
                                      </div>
                                    </object>
                                  ) : (
                                    <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                      PDF
                                    </div>
                                  )}
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
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      {diplomas.length > 4 ? (
                        <div className="mt-2 flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => scrollDiplomasRow("edit", "left")}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollDiplomasRow("edit", "right")}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                          >
                            →
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={profileSaving}
                        className="rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275877] disabled:opacity-60"
                        onClick={() => void saveProfile()}
                      >
                        {profileSaving ? "Сохранение..." : "Сохранить профиль"}
                      </button>
                      <button
                        type="button"
                        disabled={profileSaving || avatarUploading}
                        onClick={closeProfileEditorWithoutSave}
                        className="rounded-md border border-[#8fb0cc] bg-white px-4 py-2 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa] disabled:opacity-60"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`space-y-4 transition-opacity duration-200 ease-out ${
                      isProfileModeAnimating ? "opacity-0" : "opacity-100"
                    }`}
                  >
                    <div className="rounded-2xl border border-[#dbe8f2] bg-white p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <div className="flex min-w-0 items-center gap-5">
                          <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#edf4fa]">
                            {committedAvatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={committedAvatarDisplaySrc}
                                alt="Фото врача"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="px-2 text-center text-xs text-[#5f7a92]">Нет фото</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">Общая информация</p>
                            <p className="truncate text-lg font-semibold text-[#1f3344]">{currentUserName}</p>
                            <p className="mt-1 text-sm text-[#5f7a92]">
                              Цена за сеанс: {sessionPriceForView ? `${sessionPriceForView} ₽` : "Не указана"}
                            </p>
                            <div className="mt-3">
                              <p className="mb-1 text-sm font-semibold text-[#1f3344]">О себе</p>
                              <div className="min-h-[3rem] whitespace-pre-wrap break-words rounded-md text-sm leading-relaxed text-[#39556d]">
                                {committedDoctorBio.trim() ? (
                                  committedDoctorBio
                                ) : (
                                  <span className="text-[#6b859a]">Не указано</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4">
                        <p className="mb-2 text-sm font-semibold text-[#1f3344]">Помогу с (симптомы)</p>
                        {committedSymptomsViewList.length > 0 ? (
                          <ul className="flex flex-wrap gap-2">
                            {committedSymptomsViewList.map((s, idx) => (
                              <li
                                key={`${s}-${idx}`}
                                className="max-w-full break-words rounded-full border border-[#bfd2e2] bg-[#edf4fa] px-3 py-1 text-sm text-[#39556d]"
                              >
                                {s}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-[#6b859a]">Не указаны</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4">
                        <p className="mb-2 text-sm font-semibold text-[#1f3344]">Помогу с (заболевания)</p>
                        {committedDiseasesViewList.length > 0 ? (
                          <ul className="flex flex-wrap gap-2">
                            {committedDiseasesViewList.map((d, idx) => (
                              <li
                                key={`${d}-${idx}`}
                                className="max-w-full break-words rounded-full border border-emerald-300/70 bg-emerald-50/95 px-3 py-1 text-sm font-medium text-emerald-900/90"
                              >
                                {d}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-[#6b859a]">Не указаны</p>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4 lg:col-span-2">
                        <p className="mb-1 text-sm font-semibold text-[#1f3344]">Образование</p>
                        {committedEducationForView.length === 0 ? (
                          <p className="text-sm text-[#6b859a]">Не указано</p>
                        ) : (
                          <ul className="space-y-2">
                            {committedEducationForView.map((item) => (
                              <li key={item.localId} className="rounded-lg px-1 py-1">
                                <p className="text-sm text-[#5f7a92]">{item.when}</p>
                                <p className="text-sm text-[#5f7a92]">
                                  {item.institution}. Специализация &quot;{item.specialty}&quot;
                                </p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#dbe8f2] bg-white p-4 lg:col-span-2">
                        <p className="mb-2 text-sm font-semibold text-[#1f3344]">
                          Сертификаты и дипломы ({committedDiplomasForView.length})
                        </p>
                        {committedDiplomasForView.length === 0 ? (
                          <p className="text-sm text-[#6b859a]">Не указаны</p>
                        ) : (
                          <div>
                            <div ref={viewDiplomasScrollRef} className="overflow-x-hidden pb-1">
                              <div
                                className={`flex min-w-max gap-3 ${
                                  committedDiplomasForView.length <= 4 ? "justify-center" : ""
                                }`}
                              >
                              {committedDiplomasForView.map((d) => {
                                const source = d.previewUrl ?? d.openUrl ?? null;
                                return (
                                  <button
                                    key={d.localId}
                                    type="button"
                                    onClick={() => source && setOpenedDiplomaUrl(source)}
                                    className="group relative h-56 w-40 shrink-0 overflow-hidden rounded-lg bg-[#f8fbff] text-left transition"
                                  >
                                    {source ? (
                                      <object
                                        data={`${source}#toolbar=0&navpanes=0&scrollbar=0`}
                                        type="application/pdf"
                                        className="h-full w-full pointer-events-none"
                                      >
                                        <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                          PDF
                                        </div>
                                      </object>
                                    ) : (
                                      <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                        PDF
                                      </div>
                                    )}
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
                            {committedDiplomasForView.length > 4 ? (
                              <div className="mt-2 flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => scrollDiplomasRow("view", "left")}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                                >
                                  ←
                                </button>
                                <button
                                  type="button"
                                  onClick={() => scrollDiplomasRow("view", "right")}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                                >
                                  →
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}

            </div>
          ) : section === "SCHEDULE" ? (
            <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
              <div className="mb-3 flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
                <input
                  className="w-full min-w-0 rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f] md:flex-[1_1_0%]"
                  type="week"
                  value={weekInput}
                  onChange={(e) => setWeekInput(e.target.value)}
                />
                <div className="relative w-full min-w-0 md:max-w-full md:flex-[0_1_20rem]">
                  <select
                    value={scheduleFilter}
                    onChange={(e) => setScheduleFilter(e.target.value as AppointmentFilter)}
                    className="w-full appearance-none rounded-md border border-[#9fb9cf] bg-white px-3 py-2 pr-9 text-sm font-medium text-[#39556d] outline-none transition focus:border-[#2f698f]"
                    aria-label="Фильтр записей в календаре врача"
                  >
                    <option value="ALL">Показать все</option>
                    <option value="FREE">Свободные</option>
                    <option value="PENDING">Ожидает подтверждения</option>
                    <option value="CONFIRMED">Подтвержден</option>
                    <option value="CANCELLED">Отменен</option>
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#5f7a92]">
                    <svg
                      viewBox="0 0 20 20"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m5 7 5 5 5-5" />
                    </svg>
                  </span>
                </div>
              </div>
              {scheduleError ? (
                <p className="mb-3 text-sm text-red-600">
                  {scheduleError}
                </p>
              ) : null}
              {scheduleLoading ? (
                <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
                  Загрузка расписания...
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {weekdays.map((day, idx) => (
                    <section key={day.value} className="rounded-lg border border-[#bfd2e2] bg-[#f8fbff] p-3">
                      <p className="font-semibold text-[#274862]">{day.label}</p>
                      {weekStartIso ? (
                        <p className="text-xs text-[#6b859a]">{addDaysToIsoDate(weekStartIso, idx)}</p>
                      ) : null}
                      {(grouped[day.value] ?? []).length === 0 ? (
                        <p className="mt-1 text-sm text-[#6b859a]">Слотов нет</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {(grouped[day.value] ?? []).map((slot) => (
                            <button
                              type="button"
                              key={slot.id}
                              onClick={() => {
                                if (!slot.appointment || !weekStartIso) return;
                                setScheduleSlotModal({
                                  dateIso: addDaysToIsoDate(weekStartIso, idx),
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                  status: slot.appointment.status,
                                  patientFullName: slot.appointment.patient.fullName,
                                  patientEmail: slot.appointment.patient.email,
                                });
                              }}
                              className={`rounded-md px-3 py-1 text-left text-sm ${getSlotStatusClasses(
                                slot.appointment?.status ?? null,
                              )} ${slot.appointment ? "cursor-pointer" : "cursor-default"}`}
                            >
                              <div className="tabular-nums">
                                {slot.startTime} - {slot.endTime}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
              <input
                type="text"
                value={myPatientsSearch}
                onChange={(e) => setMyPatientsSearch(e.target.value)}
                placeholder="Поиск пациента по ФИО или email"
                className="mb-3 w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
              />
              {appointmentsError ? (
                <p className="mb-3 text-sm text-red-600">{appointmentsError}</p>
              ) : null}
              {appointmentsLoading ? (
                <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
                  Загрузка пациентов...
                </div>
              ) : selectedPatientForNotes ? (
                <div className="rounded-lg border border-[#dbe8f2] bg-[#f8fbff] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1f3344]">{selectedPatientForNotes.fullName}</p>
                      <p className="text-sm text-[#5f7a92]">{selectedPatientForNotes.email}</p>
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSelectedPatientIdForNotes(null)}
                        className="rounded-md border border-[#8fb0cc] bg-white px-3 py-1.5 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa]"
                      >
                        Назад к списку
                      </button>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-semibold text-[#1f3344]">Заметки</p>
                  <input
                    ref={patientNoteInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      setPatientNotePickedFile(file);
                    }}
                  />
                  <div
                    role="presentation"
                    onDragEnter={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      patientNoteDragDepth.current += 1;
                      setPatientNoteDragOver(true);
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      patientNoteDragDepth.current = Math.max(0, patientNoteDragDepth.current - 1);
                      if (patientNoteDragDepth.current === 0) setPatientNoteDragOver(false);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      patientNoteDragDepth.current = 0;
                      setPatientNoteDragOver(false);
                      const file = e.dataTransfer.files?.[0] ?? null;
                      setPatientNotePickedFile(file);
                    }}
                    className={`mt-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                      patientNoteDragOver ? "border-[#2f698f] bg-[#e8f2fa]" : "border-[#bfd2e2] bg-white"
                    }`}
                  >
                    <p className="text-sm font-medium text-[#39556d]">Перетащите PDF файл заметки</p>
                    <p className="mt-1 text-sm font-medium text-[#39556d]">или</p>
                    <button
                      type="button"
                      onClick={() => patientNoteInputRef.current?.click()}
                      className="mt-2 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#dfeef9]"
                    >
                      Выберите файл
                    </button>
                    {patientNoteFile ? (
                      <p className="mt-3 text-xs font-medium text-[#39556d]">{patientNoteFile.name}</p>
                    ) : null}
                  </div>

                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void savePatientNote()}
                      disabled={patientNoteSaving}
                      className="rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275877] disabled:opacity-60"
                    >
                      {patientNoteSaving ? "Сохранение..." : "Прикрепить заметку"}
                    </button>
                  </div>

                    {patientNotesError ? (
                    <p className="mt-2 text-sm text-red-600">{patientNotesError}</p>
                    ) : null}

                    {patientNotesLoading ? (
                      <p className="mt-3 text-sm text-[#6b859a]">Загрузка заметок...</p>
                    ) : patientNotes.length === 0 ? (
                      <p className="mt-3 text-sm text-[#6b859a]">Заметок пока нет.</p>
                    ) : (
                      <ul className="mt-3 space-y-2">
                        {patientNotes.map((note) => (
                          <li
                            key={note.id}
                            className="flex flex-col gap-2 rounded-lg border border-[#dbe8f2] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              {note.fileName ? (
                                <p className="text-sm font-semibold text-[#1f3344]">{note.fileName}</p>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm text-[#2b3f50]">{note.content}</p>
                              )}
                              <p className="mt-1 text-xs text-[#5f7a92]">{note.doctorFullName}</p>
                              <p className="mt-0.5 text-xs text-[#6b859a]">
                                {new Date(note.createdAt).toLocaleString("ru-RU")}
                              </p>
                            </div>
                            {note.fileName ? (
                              <a
                                href={`/api/doctor/patients/${selectedPatientForNotes.id}/notes/${note.id}/file`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1.5 text-sm font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
                              >
                                Открыть PDF
                              </a>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
              ) : filteredMyPatients.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#6b859a]">
                  Пациенты не найдены.
                </p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-[#c6d7e5] bg-white">
                  <table className="min-w-full text-left text-sm text-[#2b3f50]">
                    <thead className="sticky top-0 z-10 bg-[#edf4fa] text-[#34556f]">
                      <tr>
                        <th className="px-4 py-3">Пациент</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Заметки</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMyPatients.map((patient) => (
                        <tr
                          key={patient.id}
                          className="border-t border-[#e3edf5] transition-colors hover:bg-[#f4f9fd]"
                        >
                          <td className="px-4 py-3">{patient.fullName}</td>
                          <td className="px-4 py-3">{patient.email}</td>
                          <td className="px-4 py-3 text-[#5f7a92]">
                            <button
                              type="button"
                              onClick={() => setSelectedPatientIdForNotes(patient.id)}
                              className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
                            >
                              Просмотр
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {section === "PROFILE" && profileMessage ? (
            <p className={`mt-4 text-sm ${profileMessage.ok ? "text-[#2f698f]" : "text-red-600"}`}>
              {profileMessage.text}
            </p>
          ) : null}
        </section>
      </div>

      {false ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Редактирование профиля"
        >
          <div
            className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[#1f3344]">Редактирование профиля</h2>
              <button
                type="button"
                onClick={closeProfileEditorWithoutSave}
                disabled={profileSaving || avatarUploading}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa] disabled:opacity-60"
              >
                &times;
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-medium text-[#1f3344]">Фото профиля</p>
                <div className="flex items-stretch gap-4">
                  <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c6d7e5] bg-[#edf4fa]">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarDisplaySrc} alt="Фото врача" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-2 text-center text-xs text-[#5f7a92]">Нет фото</span>
                    )}
                  </div>
                  <div className="flex min-h-32 min-w-0 flex-1 flex-col gap-2">
                    <input
                      ref={avatarFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                      className="sr-only"
                      disabled={avatarUploading || !!avatarCropSrc}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) openAvatarCropFromFile(file);
                      }}
                    />
                    <div
                      role="presentation"
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        avatarDragDepth.current += 1;
                        setAvatarDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        avatarDragDepth.current = Math.max(0, avatarDragDepth.current - 1);
                        if (avatarDragDepth.current === 0) setAvatarDragOver(false);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        avatarDragDepth.current = 0;
                        setAvatarDragOver(false);
                        const file = pickFirstRasterImageFromList(e.dataTransfer.files);
                        if (file) openAvatarCropFromFile(file);
                      }}
                      className={`flex min-h-32 w-full flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-4 text-center transition ${
                        avatarDragOver ? "border-[#2f698f] bg-[#e8f2fa]" : "border-[#bfd2e2] bg-[#f8fbff]"
                      }`}
                    >
                      <p className="text-sm font-medium text-[#39556d]">Перетащите изображение</p>
                      <p className="mt-1 text-sm font-medium text-[#39556d]">или</p>
                      <button
                        type="button"
                        disabled={avatarUploading || !!avatarCropSrc}
                        onClick={() => avatarFileInputRef.current?.click()}
                        className="mt-2 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:opacity-60"
                      >
                        Выберите файл
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm font-medium text-[#1f3344]">О себе</p>
                <textarea
                  className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
                  rows={4}
                  placeholder="Описание"
                  value={doctorBio}
                  onChange={(e) => setDoctorBio(e.target.value)}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium text-[#1f3344]">Цена за сеанс</p>
                <input
                  className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
                  inputMode="numeric"
                  maxLength={7}
                  placeholder="Цена за сеанс"
                  value={sessionPriceInput}
                  onChange={(e) => setSessionPriceInput(e.target.value.replace(/\D/g, "").slice(0, 7))}
                />
              </div>
              <div className="rounded-md border border-[#dbe8f2] bg-[#f8fbff] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7a92]">
                  Выберите симптомы (только из списка)
                </p>
                <div className="space-y-2">
                  {psychotherapySymptomGroups.map((group) => (
                    <div key={group.title}>
                      <p className="mb-1 text-xs font-medium text-[#446079]">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const selected = selectedSymptomsSet.has(item.toLowerCase());
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => addSymptomPreset(item)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                selected
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
              </div>
              <div className="rounded-md border border-[#dbe8f2] bg-[#f8fbff] p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-[#5f7a92]">
                  Выберите заболевания (только из списка)
                </p>
                <div className="space-y-2">
                  {psychotherapyDiseaseGroups.map((group) => (
                    <div key={group.title}>
                      <p className="mb-1 text-xs font-medium text-[#446079]">{group.title}</p>
                      <div className="flex flex-wrap gap-2">
                        {group.items.map((item) => {
                          const selected = selectedDiseasesSet.has(item.toLowerCase());
                          return (
                            <button
                              key={item}
                              type="button"
                              onClick={() => addDiseasePreset(item)}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                                selected
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
              </div>

              <div>
                <div className="mb-2">
                  <p className="text-sm font-medium text-[#1f3344]">Образование</p>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() =>
                      setEducationRows((prev) => {
                        if (prev.some((row) => isBlankEducationRow(row))) {
                          setProfileMessage({
                            ok: false,
                            text: "Сначала заполните текущую пустую запись образования.",
                          });
                          return prev;
                        }
                        return [...prev, emptyEducation()];
                      })
                    }
                    className="group w-full rounded-lg border border-[#c6d7e5] bg-[#f8fbff] p-3 text-[#2f698f] transition hover:border-[#2f698f] hover:bg-[#edf4fa] md:grid md:grid-cols-2 md:gap-3"
                  >
                    <span className="inline-flex min-h-[8.75rem] w-full items-center justify-center md:col-span-2">
                      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-[#8fb0cc] bg-[#edf5fb] text-2xl font-semibold leading-none">
                        +
                      </span>
                    </span>
                  </button>
                  {educationRows.length === 0 ? null : educationRows.map((item) => (
                    <div
                      key={item.localId}
                      className="rounded-lg border border-[#c6d7e5] bg-[#f8fbff] p-3 md:grid md:grid-cols-2 md:gap-3"
                    >
                      <input
                        className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                        placeholder="Год получения (ГГГГ)"
                        inputMode="numeric"
                        maxLength={4}
                        value={item.when}
                        onChange={(e) =>
                          setEducationRows((prev) =>
                            prev.map((x) =>
                              x.localId === item.localId
                                ? { ...x, when: formatEducationYearInput(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                      <input
                        className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                        placeholder="Образовательное учреждение"
                        value={item.institution}
                        onChange={(e) =>
                          setEducationRows((prev) =>
                            prev.map((x) =>
                              x.localId === item.localId ? { ...x, institution: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <input
                        className="rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f] md:col-span-2"
                        placeholder="Наименование специальности"
                        value={item.specialty}
                        onChange={(e) =>
                          setEducationRows((prev) =>
                            prev.map((x) =>
                              x.localId === item.localId ? { ...x, specialty: e.target.value } : x,
                            ),
                          )
                        }
                      />
                      <div className="flex items-end justify-end md:col-span-2">
                        <button
                          type="button"
                          onClick={() => removeEducationRow(item.localId)}
                          className="rounded-md border border-[#c99daa] bg-[#f6ecef] px-3 py-2 text-sm font-semibold text-[#8e3f52] transition hover:bg-[#f1e2e7]"
                        >
                          Удалить образование
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#dbe8f2] bg-[#f8fbff] p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#1f3344]">
                    Сертификаты и дипломы ({diplomas.length})
                  </p>
                  <input
                    ref={addDiplomaInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (file) {
                        const added = addDiplomaFromFile(file);
                        if (added) setIsAddDiplomaOpen(false);
                      }
                    }}
                  />
                </div>
                <div ref={editDiplomasScrollRef} className="overflow-x-hidden pb-1">
                  <div className={`flex min-w-max gap-3 ${diplomas.length <= 4 ? "justify-center" : ""}`}>
                    <button
                      type="button"
                      onClick={() => setIsAddDiplomaOpen(true)}
                      className="group flex h-56 w-40 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[#bfd2e2] bg-white text-[#2f698f] transition hover:border-[#2f698f] hover:bg-[#edf4fa]"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#8fb0cc] bg-[#edf5fb] text-xl font-semibold">
                        +
                      </span>
                    </button>
                    {diplomas.map((d) => {
                      const source = d.previewUrl ?? d.openUrl ?? null;
                      return (
                        <div key={d.localId} className="group relative h-56 w-40 shrink-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              removeDiplomaWithConfirm(d.localId);
                            }}
                            aria-label="Удалить диплом"
                            className="absolute right-1 top-1 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-lg leading-none font-medium text-[#8e3f52] opacity-0 shadow-sm transition hover:bg-[#f6ecef] group-hover:opacity-100"
                          >
                            &times;
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (source) setOpenedDiplomaUrl(source);
                            }}
                            className="group relative h-56 w-40 shrink-0 overflow-hidden rounded-lg bg-[#f8fbff] text-left transition"
                          >
                            {source ? (
                              <object
                                data={`${source}#toolbar=0&navpanes=0&scrollbar=0`}
                                type="application/pdf"
                                className="h-full w-full pointer-events-none"
                              >
                                <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                  PDF
                                </div>
                              </object>
                            ) : (
                              <div className="flex h-full items-center justify-center px-2 text-center text-xs text-[#5f7a92]">
                                PDF
                              </div>
                            )}
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
                        </div>
                      );
                    })}
                  </div>
                </div>
                {diplomas.length > 4 ? (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => scrollDiplomasRow("edit", "left")}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollDiplomasRow("edit", "right")}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#bfd2e2] bg-white text-xl font-semibold text-[#39556d] transition hover:bg-[#edf4fa]"
                    >
                      →
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={profileSaving}
                  className="rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#275877] disabled:opacity-60"
                  onClick={() => void saveProfile()}
                >
                  {profileSaving ? "Сохранение..." : "Сохранить профиль"}
                </button>
                <button
                  type="button"
                  disabled={profileSaving || avatarUploading}
                  onClick={closeProfileEditorWithoutSave}
                  className="rounded-md border border-[#8fb0cc] bg-white px-4 py-2 text-sm font-medium text-[#39556d] transition hover:bg-[#edf4fa] disabled:opacity-60"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {openedDiplomaUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр диплома"
        >
          <div
            className="h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[#c6d7e5] bg-white shadow-2xl"
          >
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

      {isAddDiplomaOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Добавление сертификата или диплома"
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-medium text-[#1f3344]">Добавить сертификат/диплом</h3>
              <button
                type="button"
                onClick={() => setIsAddDiplomaOpen(false)}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa]"
              >
                &times;
              </button>
            </div>

            <div
              role="presentation"
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addDiplomaDragDepth.current += 1;
                setAddDiplomaDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addDiplomaDragDepth.current = Math.max(0, addDiplomaDragDepth.current - 1);
                if (addDiplomaDragDepth.current === 0) setAddDiplomaDragOver(false);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                addDiplomaDragDepth.current = 0;
                setAddDiplomaDragOver(false);
                const file = e.dataTransfer.files?.[0] ?? null;
                if (!file) return;
                const added = addDiplomaFromFile(file);
                if (added) setIsAddDiplomaOpen(false);
              }}
              className={`rounded-xl border-2 border-dashed px-4 py-10 text-center transition ${
                addDiplomaDragOver ? "border-[#2f698f] bg-[#e8f2fa]" : "border-[#bfd2e2] bg-[#f8fbff]"
              }`}
            >
              <p className="text-sm font-medium text-[#39556d]">Перетащите PDF файл сюда</p>
              <p className="mt-1 text-sm font-medium text-[#39556d]">или</p>
              <button
                type="button"
                onClick={() => addDiplomaInputRef.current?.click()}
                className="mt-2 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-sm font-medium text-[#1f4e72] transition hover:bg-[#dfeef9]"
              >
                Выберите файл
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {avatarCropSrc ? (
        <AvatarCropModal
          imageSrc={avatarCropSrc}
          busy={avatarUploading}
          onCancel={dismissAvatarCrop}
          onConfirm={(file) => {
            dismissAvatarCrop();
            setPendingAvatarFromCrop(file);
          }}
        />
      ) : null}

      {scheduleSlotModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Информация о записи"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[#1f3344]">Информация о записи</h3>
              <button
                type="button"
                onClick={() => setScheduleSlotModal(null)}
                aria-label="Закрыть"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa]"
              >
                &times;
              </button>
            </div>
            <div className="space-y-2 text-sm text-[#39556d]">
              <p>
                <span className="font-semibold text-[#1f3344]">Дата:</span>{" "}
                {new Date(`${scheduleSlotModal.dateIso}T12:00:00`).toLocaleDateString("ru-RU")}
              </p>
              <p>
                <span className="font-semibold text-[#1f3344]">Время:</span>{" "}
                {scheduleSlotModal.startTime} - {scheduleSlotModal.endTime}
              </p>
              <p>
                <span className="font-semibold text-[#1f3344]">Пациент:</span>{" "}
                {scheduleSlotModal.patientFullName}
              </p>
              <p>
                <span className="font-semibold text-[#1f3344]">Email:</span>{" "}
                {scheduleSlotModal.patientEmail}
              </p>
              <p>
                <span className="font-semibold text-[#1f3344]">Статус:</span>{" "}
                {scheduleSlotModal.status === "CONFIRMED"
                  ? "подтвержден"
                  : scheduleSlotModal.status === "CANCELLED"
                    ? "отменен"
                    : "ожидает подтверждения"}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
