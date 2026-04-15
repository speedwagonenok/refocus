type OverviewSectionProps = {
  usersCount: number;
  employeeCount: number;
  patientCount: number;
};

export default function OverviewSection({
  usersCount,
  employeeCount,
  patientCount,
}: OverviewSectionProps) {
  return (
    <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#1f3344]">Обзор системы</h2>
      <p className="mt-2 text-sm text-[#446079]">
        Здесь вы видите общие показатели и можете перейти к нужным действиям через панель
        слева.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[#bfd2e2] bg-[#edf4fa] p-4">
          <p className="text-xs text-[#4f6f88]">Всего пользователей</p>
          <p className="mt-1 text-2xl font-semibold text-[#1f3344]">{usersCount}</p>
        </div>
        <div className="rounded-lg border border-[#bfd2e2] bg-[#edf4fa] p-4">
          <p className="text-xs text-[#4f6f88]">Сотрудники</p>
          <p className="mt-1 text-2xl font-semibold text-[#1f3344]">{employeeCount}</p>
        </div>
        <div className="rounded-lg border border-[#bfd2e2] bg-[#edf4fa] p-4">
          <p className="text-xs text-[#4f6f88]">Пациенты</p>
          <p className="mt-1 text-2xl font-semibold text-[#1f3344]">{patientCount}</p>
        </div>
      </div>
    </div>
  );
}
