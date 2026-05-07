"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminSidebar from "@/app/components/AdminSidebar";
import AdminTopBar from "@/app/components/AdminTopBar";
import CreateEmployeeSection from "@/app/components/CreateEmployeeSection";
import DoctorScheduleSection from "@/app/components/DoctorScheduleSection";
import ScheduleEditModal from "@/app/components/ScheduleEditModal";
import UserPasswordResetModal from "@/app/components/UserPasswordResetModal";
import UsersSection from "@/app/components/UsersSection";
import {
  CLINIC_CLOSE_TIME,
  CLINIC_OPEN_TIME,
  MAX_SLOT_DURATION_MINUTES,
  addDaysToIsoDate,
  clampTimeToClinicHours,
  formatDateLocal,
  getAutoEndForStart,
  getAutoStartForEnd,
  getCurrentLocalTimeHHMM,
  timeToMinutes,
} from "@/lib/scheduleTime";

type UserRole = "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";
type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  createdAt: string;
};

type DoctorOption = {
  id: number;
  fullName: string;
  email: string;
};

type ScheduleRow = {
  id: number;
  doctorId: number;
  weekStartDate: string;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  isActive: boolean;
  doctor: {
    fullName: string;
  };
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "PATIENT", label: "Пациент" },
  { value: "DOCTOR", label: "Врач" },
  { value: "MANAGER", label: "Менеджер" },
  { value: "SYSTEM_ADMIN", label: "Системный администратор" },
];

const roleLabelByValue: Record<UserRole, string> = Object.fromEntries(
  roleOptions.map((option) => [option.value, option.label]),
) as Record<UserRole, string>;

const weekdayOptions: Array<{ value: Weekday; label: string }> = [
  { value: "MONDAY", label: "Понедельник" },
  { value: "TUESDAY", label: "Вторник" },
  { value: "WEDNESDAY", label: "Среда" },
  { value: "THURSDAY", label: "Четверг" },
  { value: "FRIDAY", label: "Пятница" },
  { value: "SATURDAY", label: "Суббота" },
  { value: "SUNDAY", label: "Воскресенье" },
];

const weekdayLabelByValue: Record<Weekday, string> = Object.fromEntries(
  weekdayOptions.map((option) => [option.value, option.label]),
) as Record<Weekday, string>;

function getMondayDateForWeek(date = new Date()): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function getWeekInputValue(date = new Date()): string {
  const monday = getMondayDateForWeek(date);
  const year = monday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const firstMonday = getMondayDateForWeek(firstThursday);
  const diffMs = monday.getTime() - firstMonday.getTime();
  const week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function weekInputToMondayIso(weekValue: string): string | null {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const week = Number(match[2]);
  const jan4 = new Date(year, 0, 4);
  const firstMonday = getMondayDateForWeek(jan4);
  const monday = new Date(firstMonday);
  monday.setDate(firstMonday.getDate() + (week - 1) * 7);
  return formatDateLocal(monday);
}

type SuperadminPanelProps = {
  currentUserName: string;
  currentUserEmail: string;
};

type ActiveTab = "EMPLOYEES" | "PATIENTS";
type ToastType = "success" | "error";
type AdminSection = "CREATE_EMPLOYEE" | "USERS" | "DOCTOR_SCHEDULE";

export default function SuperadminPanel({
  currentUserName,
  currentUserEmail,
}: SuperadminPanelProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(
    null,
  );
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [resetUserPasswordValue, setResetUserPasswordValue] = useState("");
  const [isResettingUserPassword, setIsResettingUserPassword] = useState(false);
  const [deletingEmployeeId, setDeletingEmployeeId] = useState<number | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("DOCTOR");
  const [activeTab, setActiveTab] = useState<ActiveTab>("EMPLOYEES");
  const [activeSection, setActiveSection] = useState<AdminSection>("USERS");
  const [roleFilter, setRoleFilter] = useState<"ALL" | UserRole>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [isSchedulesLoading, setIsSchedulesLoading] = useState(false);
  const [isCreatingSchedule, setIsCreatingSchedule] = useState(false);
  const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);
  const [updatingScheduleId, setUpdatingScheduleId] = useState<number | null>(null);
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [doctorSearchQuery, setDoctorSearchQuery] = useState("");
  const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
  const [dayEditorWeekday, setDayEditorWeekday] = useState<Weekday | null>(null);
  const [selectedWeekValue, setSelectedWeekValue] = useState(() => getWeekInputValue());
  const [scheduleDoctorId, setScheduleDoctorId] = useState("");
  const [scheduleWeekday, setScheduleWeekday] = useState<Weekday>("MONDAY");
  const [scheduleStartTime, setScheduleStartTime] = useState("10:00");
  const [scheduleEndTime, setScheduleEndTime] = useState("11:00");
  const [editScheduleDoctorId, setEditScheduleDoctorId] = useState("");
  const [editScheduleWeekday, setEditScheduleWeekday] = useState<Weekday>("MONDAY");
  const [editScheduleStartTime, setEditScheduleStartTime] = useState("10:00");
  const [editScheduleEndTime, setEditScheduleEndTime] = useState("11:00");
  const doctorDropdownRef = useRef<HTMLDivElement | null>(null);
  const selectedWeekStartDate = useMemo(
    () => weekInputToMondayIso(selectedWeekValue),
    [selectedWeekValue],
  );
  const [todayIsoDate, setTodayIsoDate] = useState(() => formatDateLocal(new Date()));
  const [currentWeekStartDate, setCurrentWeekStartDate] = useState(() =>
    formatDateLocal(getMondayDateForWeek(new Date())),
  );
  const [currentTimeHHMM, setCurrentTimeHHMM] = useState(() => getCurrentLocalTimeHHMM());

  function handleTabChange(tab: ActiveTab) {
    setActiveTab(tab);
    setRoleFilter("ALL");
    setActiveSection("USERS");
  }

  function showToast(type: ToastType, message: string) {
    setToast({ type, message });
  }

  const loadUsers = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as
        | { message?: string; users?: UserRow[] }
        | null;

      if (!response.ok || !data?.users) {
        showToast("error", data?.message ?? "Не удалось загрузить пользователей.");
        return;
      }

      setUsers(data.users);
    } catch {
      showToast("error", "Ошибка сети при загрузке пользователей.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const loadSchedules = useCallback(async () => {
    if (!selectedWeekStartDate) {
      showToast("error", "Некорректная неделя для расписания.");
      return;
    }
    setIsSchedulesLoading(true);

    try {
      const response = await fetch(
        `/api/admin/schedules?weekStartDate=${selectedWeekStartDate}`,
        { cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | { message?: string; doctors?: DoctorOption[]; schedules?: ScheduleRow[] }
        | null;

      if (!response.ok || !data?.doctors || !data?.schedules) {
        showToast("error", data?.message ?? "Не удалось загрузить расписание врачей.");
        return;
      }

      setDoctors(data.doctors);
      setSchedules(data.schedules);
    } catch {
      showToast("error", "Ошибка сети при загрузке расписания врачей.");
    } finally {
      setIsSchedulesLoading(false);
    }
  }, [scheduleDoctorId, selectedWeekStartDate]);

  useEffect(() => {
    if (activeSection === "DOCTOR_SCHEDULE") {
      void loadSchedules();
    }
  }, [activeSection, loadSchedules]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        doctorDropdownRef.current &&
        !doctorDropdownRef.current.contains(event.target as Node)
      ) {
        setIsDoctorDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTodayIsoDate(formatDateLocal(new Date()));
      setCurrentWeekStartDate(formatDateLocal(getMondayDateForWeek(new Date())));
      setCurrentTimeHHMM(getCurrentLocalTimeHHMM());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "Доброе утро";
    }
    if (hour >= 12 && hour < 18) {
      return "Добрый день";
    }
    return "Добрый вечер";
  }, []);
  const activeSectionTitle = useMemo(() => {
    if (activeSection === "CREATE_EMPLOYEE") {
      return "Создать сотрудника";
    }
    if (activeSection === "USERS") {
      return "Пользователи и роли";
    }
    return "Расписание врачей";
  }, [activeSection]);
  const isPastWeekSelected = useMemo(() => {
    if (!selectedWeekStartDate) {
      return false;
    }
    return selectedWeekStartDate < currentWeekStartDate;
  }, [selectedWeekStartDate, currentWeekStartDate]);
  const visibleUsers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (activeTab === "EMPLOYEES" && user.role === "PATIENT") {
        return false;
      }

      if (activeTab === "PATIENTS" && user.role !== "PATIENT") {
        return false;
      }

      if (
        activeTab === "EMPLOYEES" &&
        roleFilter !== "ALL" &&
        user.role !== roleFilter
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      if (activeTab === "EMPLOYEES") {
        return (
          user.fullName.toLowerCase().includes(normalizedQuery) ||
          user.email.toLowerCase().includes(normalizedQuery)
        );
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
  }, [users, activeTab, roleFilter, searchQuery]);
  const filteredDoctors = useMemo(() => {
    const rawQuery = doctorSearchQuery.trim().toLowerCase();
    if (!rawQuery) {
      return doctors;
    }
    const idQuery = rawQuery.replace(/^id\s*[:\-]?\s*/, "").replace(/^#/, "");

    return doctors.filter(
      (doctor) =>
        doctor.fullName.toLowerCase().includes(rawQuery) ||
        doctor.email.toLowerCase().includes(rawQuery) ||
        String(doctor.id).includes(idQuery),
    );
  }, [doctors, doctorSearchQuery]);
  const selectedDoctor = useMemo(
    () => doctors.find((doctor) => String(doctor.id) === scheduleDoctorId) ?? null,
    [doctors, scheduleDoctorId],
  );
  const selectedDoctorSchedules = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          String(schedule.doctorId) === scheduleDoctorId &&
          (!selectedWeekStartDate ||
            schedule.weekStartDate.slice(0, 10) === selectedWeekStartDate),
      ),
    [schedules, scheduleDoctorId, selectedWeekStartDate],
  );
  const schedulesByWeekday = useMemo(
    () =>
      Object.fromEntries(
        weekdayOptions.map((weekday) => [
          weekday.value,
          selectedDoctorSchedules
            .filter((schedule) => schedule.weekday === weekday.value)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        ]),
      ) as Record<Weekday, ScheduleRow[]>,
    [selectedDoctorSchedules],
  );
  const dayEditorSchedules = useMemo(
    () => (dayEditorWeekday ? schedulesByWeekday[dayEditorWeekday] ?? [] : []),
    [dayEditorWeekday, schedulesByWeekday],
  );
  const selectedDayEditorDate = useMemo(() => {
    if (!dayEditorWeekday || !selectedWeekStartDate) {
      return null;
    }
    const dayIndex = weekdayOptions.findIndex(
      (weekday) => weekday.value === dayEditorWeekday,
    );
    if (dayIndex < 0) {
      return null;
    }
    return addDaysToIsoDate(selectedWeekStartDate, dayIndex);
  }, [dayEditorWeekday, selectedWeekStartDate]);
  const isPastDayEditorSelected = useMemo(() => {
    if (!selectedDayEditorDate) {
      return false;
    }
    return selectedDayEditorDate < todayIsoDate;
  }, [selectedDayEditorDate, todayIsoDate]);
  const isTodayDayEditorSelected = useMemo(
    () => selectedDayEditorDate === todayIsoDate,
    [selectedDayEditorDate, todayIsoDate],
  );

  function getRoleLabel(roleValue: UserRole): string {
    return roleLabelByValue[roleValue];
  }

  function getWeekdayLabel(weekday: Weekday): string {
    return weekdayLabelByValue[weekday];
  }

  function beginScheduleEdit(schedule: ScheduleRow) {
    if (isPastWeekSelected || isPastDayEditorSelected) {
      showToast("error", "Прошедшие даты доступны только для просмотра.");
      return;
    }
    setEditingScheduleId(schedule.id);
    setEditScheduleDoctorId(String(schedule.doctorId));
    setEditScheduleWeekday(schedule.weekday);
    setEditScheduleStartTime(schedule.startTime);
    setEditScheduleEndTime(schedule.endTime);
  }

  function selectDoctor(doctorId: string) {
    setScheduleDoctorId(doctorId);
    setDayEditorWeekday(null);
    setEditingScheduleId(null);
    setIsDoctorDropdownOpen(false);
  }

  function handleDoctorSearchChange(value: string) {
    setDoctorSearchQuery(value);
    setIsDoctorDropdownOpen(true);
  }

  function handleDoctorSelectFromSearch(doctor: DoctorOption) {
    selectDoctor(String(doctor.id));
    setDoctorSearchQuery(doctor.fullName);
  }

  function handleCreateStartTimeChange(value: string) {
    const clamped = clampTimeToClinicHours(value);
    setScheduleStartTime(clamped);
    setScheduleEndTime(getAutoEndForStart(clamped));
  }

  function handleCreateEndTimeChange(value: string) {
    const clamped = clampTimeToClinicHours(value);
    setScheduleEndTime(clamped);
    setScheduleStartTime(getAutoStartForEnd(clamped));
  }

  function handleEditStartTimeChange(value: string) {
    const clamped = clampTimeToClinicHours(value);
    setEditScheduleStartTime(clamped);
    setEditScheduleEndTime(getAutoEndForStart(clamped));
  }

  function handleEditEndTimeChange(value: string) {
    const clamped = clampTimeToClinicHours(value);
    setEditScheduleEndTime(clamped);
    setEditScheduleStartTime(getAutoStartForEnd(clamped));
  }

  async function handleCreateEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password, role }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось создать сотрудника.");
        return;
      }

      showToast("success", data?.message ?? "Сотрудник создан.");
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("DOCTOR");
      await loadUsers();
    } catch {
      showToast("error", "Ошибка сети при создании сотрудника.");
    } finally {
      setIsCreating(false);
    }
  }

  function openUserEditModal(user: UserRow) {
    setEditingUser(user);
    setResetUserPasswordValue("");
  }

  function closeUserEditModal() {
    setEditingUser(null);
    setResetUserPasswordValue("");
    setIsResettingUserPassword(false);
  }

  async function handleResetUserPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) {
      return;
    }

    const shouldReset = window.confirm(`Сбросить пароль пользователю ${editingUser.fullName}?`);
    if (!shouldReset) {
      return;
    }

    setIsResettingUserPassword(true);
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetUserPasswordValue }),
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось сбросить пароль.");
        return;
      }

      showToast("success", data?.message ?? "Пароль пользователя обновлен.");
      closeUserEditModal();
    } catch {
      showToast("error", "Ошибка сети при сбросе пароля.");
    } finally {
      setIsResettingUserPassword(false);
    }
  }

  async function handleDeleteEmployee(user: UserRow) {
    if (user.role === "PATIENT") {
      showToast("error", "Удаление доступно только для сотрудников.");
      return;
    }

    const shouldDelete = window.confirm(
      `Удалить сотрудника ${user.fullName}? Это действие необратимо.`,
    );
    if (!shouldDelete) {
      return;
    }

    setDeletingEmployeeId(user.id);
    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось удалить сотрудника.");
        return;
      }

      if (editingUser?.id === user.id) {
        closeUserEditModal();
      }

      showToast("success", data?.message ?? "Сотрудник удален.");
      await loadUsers();
    } catch {
      showToast("error", "Ошибка сети при удалении сотрудника.");
    } finally {
      setDeletingEmployeeId(null);
    }
  }

  async function handleCreateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startMinutes = timeToMinutes(scheduleStartTime);
    const endMinutes = timeToMinutes(scheduleEndTime);
    const openMinutes = timeToMinutes(CLINIC_OPEN_TIME);
    const closeMinutes = timeToMinutes(CLINIC_CLOSE_TIME);

    if (isPastWeekSelected || isPastDayEditorSelected) {
      showToast("error", "Прошедшие даты доступны только для просмотра.");
      return;
    }
    if (isTodayDayEditorSelected && scheduleStartTime < currentTimeHHMM) {
      showToast("error", "Для текущего дня нельзя указывать прошедшее время.");
      return;
    }

    if (!scheduleDoctorId) {
      showToast("error", "Сначала добавьте хотя бы одного врача.");
      return;
    }
    if (!selectedWeekStartDate) {
      showToast("error", "Выберите корректную неделю.");
      return;
    }
    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      showToast(
        "error",
        `Слоты доступны только в рабочее время: ${CLINIC_OPEN_TIME} – ${CLINIC_CLOSE_TIME}.`,
      );
      return;
    }
    if (endMinutes - startMinutes > MAX_SLOT_DURATION_MINUTES) {
      showToast("error", "Максимальная длительность одного слота - 1 час.");
      return;
    }
    const shouldCreate = window.confirm("Добавить этот слот расписания?");
    if (!shouldCreate) {
      return;
    }

    setIsCreatingSchedule(true);

    try {
      const response = await fetch("/api/admin/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: Number(scheduleDoctorId),
          weekStartDate: selectedWeekStartDate,
          weekday: scheduleWeekday,
          startTime: scheduleStartTime,
          endTime: scheduleEndTime,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось добавить слот.");
        return;
      }

      showToast("success", data?.message ?? "Слот расписания добавлен.");
      await loadSchedules();
    } catch {
      showToast("error", "Ошибка сети при добавлении слота.");
    } finally {
      setIsCreatingSchedule(false);
    }
  }

  async function handleSaveScheduleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const startMinutes = timeToMinutes(editScheduleStartTime);
    const endMinutes = timeToMinutes(editScheduleEndTime);
    const openMinutes = timeToMinutes(CLINIC_OPEN_TIME);
    const closeMinutes = timeToMinutes(CLINIC_CLOSE_TIME);

    if (isPastWeekSelected || isPastDayEditorSelected) {
      showToast("error", "Прошедшие даты доступны только для просмотра.");
      return;
    }
    if (isTodayDayEditorSelected && editScheduleStartTime < currentTimeHHMM) {
      showToast("error", "Для текущего дня нельзя указывать прошедшее время.");
      return;
    }

    if (!editingScheduleId) {
      return;
    }

    if (!editScheduleDoctorId) {
      showToast("error", "Выберите врача.");
      return;
    }
    if (!selectedWeekStartDate) {
      showToast("error", "Выберите корректную неделю.");
      return;
    }
    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      showToast(
        "error",
        `Слоты доступны только в рабочее время: ${CLINIC_OPEN_TIME} – ${CLINIC_CLOSE_TIME}.`,
      );
      return;
    }
    if (endMinutes - startMinutes > MAX_SLOT_DURATION_MINUTES) {
      showToast("error", "Максимальная длительность одного слота - 1 час.");
      return;
    }
    const shouldSave = window.confirm("Сохранить изменения слота?");
    if (!shouldSave) {
      return;
    }

    setUpdatingScheduleId(editingScheduleId);

    try {
      const response = await fetch(`/api/admin/schedules/${editingScheduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId: Number(editScheduleDoctorId),
          weekStartDate: selectedWeekStartDate,
          weekday: editScheduleWeekday,
          startTime: editScheduleStartTime,
          endTime: editScheduleEndTime,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось обновить слот.");
        return;
      }

      showToast("success", data?.message ?? "Слот обновлен.");
      setEditingScheduleId(null);
      await loadSchedules();
    } catch {
      showToast("error", "Ошибка сети при обновлении слота.");
    } finally {
      setUpdatingScheduleId(null);
    }
  }

  async function handleDeleteSchedule(scheduleId: number) {
    if (isPastWeekSelected || isPastDayEditorSelected) {
      showToast("error", "Прошедшие даты доступны только для просмотра.");
      return;
    }

    const shouldDelete = window.confirm("Удалить этот слот расписания?");
    if (!shouldDelete) {
      return;
    }

    setDeletingScheduleId(scheduleId);

    try {
      const response = await fetch(`/api/admin/schedules/${scheduleId}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        showToast("error", data?.message ?? "Не удалось удалить слот.");
        return;
      }

      showToast("success", data?.message ?? "Слот удален.");
      await loadSchedules();
    } catch {
      showToast("error", "Ошибка сети при удалении слота.");
    } finally {
      setDeletingScheduleId(null);
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

  return (
    <main className="min-h-screen bg-[#e6edf3]">
      <AdminTopBar
        greeting={greeting}
        currentUserName={currentUserName}
        currentUserEmail={currentUserEmail}
        isLoggingOut={isLoggingOut}
        onLogout={() => void handleLogout()}
      />

      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-7xl gap-4 px-4 py-6 md:gap-6 md:px-6">
        <AdminSidebar activeSection={activeSection} onChangeSection={setActiveSection} />

        <section className="min-w-0 flex-1 rounded-2xl bg-[#f8fbff] p-8 shadow-lg">
          <h1 className="text-2xl font-semibold text-gray-900">{activeSectionTitle}</h1>

          {activeSection === "CREATE_EMPLOYEE" ? (
            <CreateEmployeeSection
              fullName={fullName}
              email={email}
              password={password}
              role={role}
              isCreating={isCreating}
              roleOptions={roleOptions}
              onSubmit={handleCreateEmployee}
              onFullNameChange={setFullName}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onRoleChange={setRole}
            />
          ) : null}

          {activeSection === "USERS" ? (
            <UsersSection
              activeTab={activeTab}
              roleFilter={roleFilter}
              searchQuery={searchQuery}
              loading={loading}
              visibleUsers={visibleUsers}
              roleOptions={roleOptions}
              onTabChange={handleTabChange}
              onRoleFilterChange={setRoleFilter}
              onSearchQueryChange={setSearchQuery}
              onOpenUserEdit={openUserEditModal}
              onDeleteEmployee={(user) => void handleDeleteEmployee(user)}
              deletingEmployeeId={deletingEmployeeId}
              getRoleLabel={getRoleLabel}
            />
          ) : null}

          {activeSection === "DOCTOR_SCHEDULE" ? (
            <DoctorScheduleSection
              selectedWeekValue={selectedWeekValue}
              onWeekValueChange={(value) => {
                setSelectedWeekValue(value);
                setDayEditorWeekday(null);
                setEditingScheduleId(null);
              }}
              doctorSearchQuery={doctorSearchQuery}
              onDoctorSearchChange={handleDoctorSearchChange}
              onDoctorSearchFocus={() => setIsDoctorDropdownOpen(true)}
              doctorDropdownRef={doctorDropdownRef}
              isDoctorDropdownOpen={isDoctorDropdownOpen}
              filteredDoctors={filteredDoctors}
              scheduleDoctorId={scheduleDoctorId}
              onDoctorSelect={handleDoctorSelectFromSearch}
              isPastWeekSelected={isPastWeekSelected}
              selectedDoctor={selectedDoctor}
              weekdayOptions={weekdayOptions}
              schedulesByWeekday={schedulesByWeekday}
              selectedWeekStartDate={selectedWeekStartDate}
              todayIsoDate={todayIsoDate}
              onEditDay={(weekday) => {
                setDayEditorWeekday(weekday);
                setScheduleWeekday(weekday);
                setEditingScheduleId(null);
              }}
              onCloseDayEditor={() => {
                setDayEditorWeekday(null);
                setEditingScheduleId(null);
              }}
              dayEditorWeekday={dayEditorWeekday}
              isPastDayEditorSelected={isPastDayEditorSelected}
              getWeekdayLabel={getWeekdayLabel}
              onCreateSchedule={handleCreateSchedule}
              scheduleStartTime={scheduleStartTime}
              onScheduleStartTimeChange={handleCreateStartTimeChange}
              scheduleEndTime={scheduleEndTime}
              onScheduleEndTimeChange={handleCreateEndTimeChange}
              clinicOpenTime={CLINIC_OPEN_TIME}
              clinicCloseTime={CLINIC_CLOSE_TIME}
              isCreatingSchedule={isCreatingSchedule}
              isSchedulesLoading={isSchedulesLoading}
              dayEditorSchedules={dayEditorSchedules}
              onBeginScheduleEdit={beginScheduleEdit}
              onDeleteSchedule={(id) => void handleDeleteSchedule(id)}
              deletingScheduleId={deletingScheduleId}
            />
          ) : null}
          {toast ? (
            <p
              className={`mt-4 text-sm ${
                toast.type === "success" ? "text-[#2f698f]" : "text-red-600"
              }`}
            >
              {toast.message}
            </p>
          ) : null}
        </section>
      </div>

      <ScheduleEditModal
        editingScheduleId={editingScheduleId}
        editScheduleStartTime={editScheduleStartTime}
        editScheduleEndTime={editScheduleEndTime}
        clinicOpenTime={CLINIC_OPEN_TIME}
        clinicCloseTime={CLINIC_CLOSE_TIME}
        updatingScheduleId={updatingScheduleId}
        onStartTimeChange={handleEditStartTimeChange}
        onEndTimeChange={handleEditEndTimeChange}
        onSubmit={handleSaveScheduleEdit}
        onCancel={() => setEditingScheduleId(null)}
      />

      <UserPasswordResetModal
        editingUser={editingUser}
        newPassword={resetUserPasswordValue}
        isSubmitting={isResettingUserPassword}
        getRoleLabel={getRoleLabel}
        onPasswordChange={setResetUserPasswordValue}
        onSubmit={handleResetUserPassword}
        onCancel={closeUserEditModal}
      />
    </main>
  );
}
