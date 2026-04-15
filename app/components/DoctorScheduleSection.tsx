import { RefObject } from "react";
import { addDaysToIsoDate } from "@/lib/scheduleTime";

type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

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

type DoctorScheduleSectionProps = {
  selectedWeekValue: string;
  onWeekValueChange: (value: string) => void;
  doctorSearchQuery: string;
  onDoctorSearchChange: (value: string) => void;
  onDoctorSearchFocus: () => void;
  doctorDropdownRef: RefObject<HTMLDivElement | null>;
  isDoctorDropdownOpen: boolean;
  filteredDoctors: DoctorOption[];
  scheduleDoctorId: string;
  onDoctorSelect: (doctor: DoctorOption) => void;
  isPastWeekSelected: boolean;
  selectedDoctor: DoctorOption | null;
  weekdayOptions: Array<{ value: Weekday; label: string }>;
  schedulesByWeekday: Record<Weekday, ScheduleRow[]>;
  selectedWeekStartDate: string | null;
  todayIsoDate: string;
  onEditDay: (weekday: Weekday) => void;
  dayEditorWeekday: Weekday | null;
  isPastDayEditorSelected: boolean;
  getWeekdayLabel: (weekday: Weekday) => string;
  onCreateSchedule: (event: React.FormEvent<HTMLFormElement>) => void;
  scheduleStartTime: string;
  onScheduleStartTimeChange: (value: string) => void;
  scheduleEndTime: string;
  onScheduleEndTimeChange: (value: string) => void;
  clinicOpenTime: string;
  clinicCloseTime: string;
  isCreatingSchedule: boolean;
  isSchedulesLoading: boolean;
  dayEditorSchedules: ScheduleRow[];
  onBeginScheduleEdit: (schedule: ScheduleRow) => void;
  onDeleteSchedule: (scheduleId: number) => void;
  deletingScheduleId: number | null;
};

export default function DoctorScheduleSection({
  selectedWeekValue,
  onWeekValueChange,
  doctorSearchQuery,
  onDoctorSearchChange,
  onDoctorSearchFocus,
  doctorDropdownRef,
  isDoctorDropdownOpen,
  filteredDoctors,
  scheduleDoctorId,
  onDoctorSelect,
  isPastWeekSelected,
  selectedDoctor,
  weekdayOptions,
  schedulesByWeekday,
  selectedWeekStartDate,
  todayIsoDate,
  onEditDay,
  dayEditorWeekday,
  isPastDayEditorSelected,
  getWeekdayLabel,
  onCreateSchedule,
  scheduleStartTime,
  onScheduleStartTimeChange,
  scheduleEndTime,
  onScheduleEndTimeChange,
  clinicOpenTime,
  clinicCloseTime,
  isCreatingSchedule,
  isSchedulesLoading,
  dayEditorSchedules,
  onBeginScheduleEdit,
  onDeleteSchedule,
  deletingScheduleId,
}: DoctorScheduleSectionProps) {
  return (
    <>
      <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
        <h2 className="text-lg font-semibold text-[#1f3344]">Выберите врача</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            type="week"
            value={selectedWeekValue}
            onChange={(event) => onWeekValueChange(event.target.value)}
            className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
          />
          <div className="relative" ref={doctorDropdownRef}>
            <input
              type="text"
              value={doctorSearchQuery}
              onFocus={onDoctorSearchFocus}
              onChange={(event) => onDoctorSearchChange(event.target.value)}
              placeholder="Поиск врача по ФИО или email"
              className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
            />
            {isDoctorDropdownOpen ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-[#9fb9cf] bg-white shadow-lg">
                {filteredDoctors.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-[#6b859a]">Врачи не найдены.</p>
                ) : (
                  filteredDoctors.map((doctor) => (
                    <button
                      key={doctor.id}
                      type="button"
                      onClick={() => onDoctorSelect(doctor)}
                      className={`block w-full border-b border-[#eef3f8] px-3 py-2 text-left transition last:border-b-0 hover:bg-[#edf5fb] ${
                        String(doctor.id) === scheduleDoctorId ? "bg-[#f4f9fd]" : ""
                      }`}
                    >
                      <span className="block text-sm font-medium text-[#1f3344]">
                        {doctor.fullName}
                      </span>
                      <span className="block text-xs text-[#5f7a92]">{doctor.email}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
        {isPastWeekSelected ? (
          <p className="mt-3 rounded-md border border-[#d9c8a1] bg-[#fff7e6] px-3 py-2 text-sm text-[#8a6b2f]">
            Выбрана прошедшая неделя: доступно только для просмотра.
          </p>
        ) : null}
      </div>

      {scheduleDoctorId ? (
        <>
          <div className="mt-5 rounded-xl border border-[#c6d7e5] bg-white p-4">
            <h3 className="text-base font-semibold text-[#1f3344]">
              Расписание: {selectedDoctor?.fullName ?? "Врач"}
            </h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {weekdayOptions.map((weekday) => {
                const daySlots = schedulesByWeekday[weekday.value] ?? [];
                const dayDate =
                  selectedWeekStartDate != null
                    ? addDaysToIsoDate(
                        selectedWeekStartDate,
                        weekdayOptions.findIndex((option) => option.value === weekday.value),
                      )
                    : null;
                const isPastDay = dayDate ? dayDate < todayIsoDate : false;
                return (
                  <section
                    key={weekday.value}
                    className="rounded-lg border border-[#bfd2e2] bg-[#f8fbff] p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#274862]">{weekday.label}</p>
                        {dayDate ? <p className="text-xs text-[#6b859a]">{dayDate}</p> : null}
                      </div>
                      {!isPastWeekSelected && !isPastDay ? (
                        <button
                          type="button"
                          onClick={() => onEditDay(weekday.value)}
                          className="rounded-md border border-[#9fb9cf] bg-white px-2 py-1 text-xs text-[#1f4e72] transition hover:bg-[#edf5fb]"
                          title="Редактировать день"
                        >
                          ✎
                        </button>
                      ) : null}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-[#3f6079]">
                      {daySlots.length === 0 ? (
                        <p className="text-[#6b859a]">Слотов нет</p>
                      ) : (
                        daySlots.map((slot) => (
                          <p key={slot.id}>
                            {slot.startTime} - {slot.endTime}
                          </p>
                        ))
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>

          {dayEditorWeekday && !isPastWeekSelected && !isPastDayEditorSelected ? (
            <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
              <h3 className="text-lg font-semibold text-[#1f3344]">
                Редактирование дня: {getWeekdayLabel(dayEditorWeekday)}
              </h3>
              <form className="mt-3 grid gap-4 md:grid-cols-3" onSubmit={onCreateSchedule}>
                <input
                  type="time"
                  value={scheduleStartTime}
                  onChange={(event) => onScheduleStartTimeChange(event.target.value)}
                  min={clinicOpenTime}
                  max={clinicCloseTime}
                  className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                  required
                />
                <input
                  type="time"
                  value={scheduleEndTime}
                  onChange={(event) => onScheduleEndTimeChange(event.target.value)}
                  min={clinicOpenTime}
                  max={clinicCloseTime}
                  className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                  required
                />
                <button
                  type="submit"
                  disabled={isCreatingSchedule}
                  className="inline-flex items-center justify-center rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#275877] disabled:opacity-60"
                >
                  {isCreatingSchedule ? "Добавление..." : "Добавить слот в день"}
                </button>
              </form>

              <div className="mt-5 overflow-x-auto rounded-xl border border-[#c6d7e5] bg-white">
                {isSchedulesLoading ? (
                  <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
                    Загрузка расписания...
                  </div>
                ) : (
                  <table className="min-w-full text-left text-sm text-[#2b3f50]">
                    <thead className="sticky top-0 z-10 bg-[#edf4fa] text-[#34556f]">
                      <tr>
                        <th className="px-4 py-3">Начало</th>
                        <th className="px-4 py-3">Окончание</th>
                        <th className="px-4 py-3">Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayEditorSchedules.map((schedule) => (
                        <tr
                          key={schedule.id}
                          className="border-t border-[#e3edf5] transition-colors hover:bg-[#f4f9fd]"
                        >
                          <td className="px-4 py-3">{schedule.startTime}</td>
                          <td className="px-4 py-3">{schedule.endTime}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => onBeginScheduleEdit(schedule)}
                                disabled={isPastWeekSelected}
                                className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Редактировать
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteSchedule(schedule.id)}
                                disabled={
                                  deletingScheduleId === schedule.id || isPastWeekSelected
                                }
                                className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingScheduleId === schedule.id ? "Удаление..." : "Удалить"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {dayEditorSchedules.length === 0 ? (
                        <tr className="border-t border-[#e3edf5]">
                          <td className="px-4 py-6 text-center text-[#5f7a92]" colSpan={3}>
                            Для выбранного дня слотов нет.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-10 text-center text-sm text-[#446079]">
          Выберите врача, чтобы увидеть его недельное расписание.
        </div>
      )}
    </>
  );
}
