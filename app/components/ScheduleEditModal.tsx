import { FormEvent } from "react";

type ScheduleEditModalProps = {
  editingScheduleId: number | null;
  editScheduleStartTime: string;
  editScheduleEndTime: string;
  clinicOpenTime: string;
  clinicCloseTime: string;
  updatingScheduleId: number | null;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

export default function ScheduleEditModal({
  editingScheduleId,
  editScheduleStartTime,
  editScheduleEndTime,
  clinicOpenTime,
  clinicCloseTime,
  updatingScheduleId,
  onStartTimeChange,
  onEndTimeChange,
  onSubmit,
  onCancel,
}: ScheduleEditModalProps) {
  if (!editingScheduleId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10263a]/40 px-4">
      <form
        className="w-full max-w-xl rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-[#1f3344]">Редактирование слота</h4>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa]"
          >
            &times;
          </button>
        </div>
        <p className="mt-3 text-xs text-[#5f7a92]">
          Рабочие часы клиники: {clinicOpenTime} — {clinicCloseTime}
        </p>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1f3344]">Начало</label>
            <input
              type="time"
              value={editScheduleStartTime}
              onChange={(event) => onStartTimeChange(event.target.value)}
              min={clinicOpenTime}
              max={clinicCloseTime}
              className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#1f3344]">Окончание</label>
            <input
              type="time"
              value={editScheduleEndTime}
              onChange={(event) => onEndTimeChange(event.target.value)}
              min={clinicOpenTime}
              max={clinicCloseTime}
              className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
              required
            />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={updatingScheduleId === editingScheduleId}
            className="inline-flex items-center justify-center rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#275877] disabled:opacity-60"
          >
            {updatingScheduleId === editingScheduleId ? "Сохранение..." : "Сохранить изменения"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center justify-center rounded-md border border-[#9fb9cf] bg-white px-4 py-2 text-sm font-medium text-[#1f4e72] transition-colors hover:bg-[#edf5fb]"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
