type AdminSection = "OVERVIEW" | "CREATE_EMPLOYEE" | "USERS" | "DOCTOR_SCHEDULE";

type AdminSidebarProps = {
  activeSection: AdminSection;
  onChangeSection: (section: AdminSection) => void;
};

export default function AdminSidebar({
  activeSection,
  onChangeSection,
}: AdminSidebarProps) {
  return (
    <aside className="w-60 shrink-0 self-stretch rounded-2xl border border-[#b9cddd] bg-[#f8fbff] p-4 shadow-md">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[#4f6f88]">
        Панель управления
      </p>
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => onChangeSection("OVERVIEW")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
            activeSection === "OVERVIEW"
              ? "bg-[#2f698f] text-white"
              : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
          }`}
        >
          Обзор
        </button>
        <button
          type="button"
          onClick={() => onChangeSection("CREATE_EMPLOYEE")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
            activeSection === "CREATE_EMPLOYEE"
              ? "bg-[#2f698f] text-white"
              : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
          }`}
        >
          Создать сотрудника
        </button>
        <button
          type="button"
          onClick={() => onChangeSection("USERS")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
            activeSection === "USERS"
              ? "bg-[#2f698f] text-white"
              : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
          }`}
        >
          Пользователи и роли
        </button>
        <button
          type="button"
          onClick={() => onChangeSection("DOCTOR_SCHEDULE")}
          className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition ${
            activeSection === "DOCTOR_SCHEDULE"
              ? "bg-[#2f698f] text-white"
              : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
          }`}
        >
          Расписание врачей
        </button>
      </div>
    </aside>
  );
}
