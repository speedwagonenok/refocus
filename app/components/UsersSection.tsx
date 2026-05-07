import { formatRuPhoneForDisplay } from "@/lib/authValidation";

type UserRole = "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";
type ActiveTab = "EMPLOYEES" | "PATIENTS";

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  hasConfirmedAppointment?: boolean;
  role: UserRole;
  createdAt: string;
};

type UsersSectionProps = {
  layoutVariant?: "standard" | "manager";
  activeTab: ActiveTab;
  roleFilter: "ALL" | UserRole;
  searchQuery: string;
  loading: boolean;
  visibleUsers: UserRow[];
  roleOptions: Array<{ value: UserRole; label: string }>;
  onTabChange: (tab: ActiveTab) => void;
  onRoleFilterChange: (value: "ALL" | UserRole) => void;
  onSearchQueryChange: (value: string) => void;
  onOpenUserEdit: (user: UserRow) => void;
  onDeleteEmployee: (user: UserRow) => void;
  deletingEmployeeId: number | null;
  getRoleLabel: (role: UserRole) => string;
  onManagerAttachDocument?: (user: UserRow) => void;
};

export default function UsersSection({
  layoutVariant = "standard",
  activeTab,
  roleFilter,
  searchQuery,
  loading,
  visibleUsers,
  roleOptions,
  onTabChange,
  onRoleFilterChange,
  onSearchQueryChange,
  onOpenUserEdit,
  onDeleteEmployee,
  deletingEmployeeId,
  getRoleLabel,
  onManagerAttachDocument,
}: UsersSectionProps) {
  const isManagerView = layoutVariant === "manager";
  const showPhoneColumn = isManagerView || activeTab === "PATIENTS";
  const showRoleColumn = !isManagerView;
  const showCreatedColumn = !isManagerView;
  const searchPlaceholder = isManagerView
    ? "Поиск по ФИО, email и телефону"
    : activeTab === "EMPLOYEES"
      ? "Поиск по ФИО и email"
      : "Поиск по ФИО, email и телефону";
  const showManagerAttachColumn = isManagerView && activeTab === "PATIENTS";
  const emptyColSpan = isManagerView
    ? showManagerAttachColumn
      ? 4
      : 3
    : showPhoneColumn
      ? 6
      : 5;

  return (
    <>
      {isManagerView ? null : (
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onTabChange("EMPLOYEES")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === "EMPLOYEES"
                ? "bg-[#2f698f] text-white"
                : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
            }`}
          >
            Сотрудники
          </button>
          <button
            type="button"
            onClick={() => onTabChange("PATIENTS")}
            className={`rounded-md px-3 py-2 text-sm font-medium transition ${
              activeTab === "PATIENTS"
                ? "bg-[#2f698f] text-white"
                : "border border-[#b5cadb] text-[#39556d] hover:bg-[#edf4fa]"
            }`}
          >
            Пациенты
          </button>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
        <h2 className="text-lg font-semibold text-[#1f3344]">
          {isManagerView ? "Поиск по пациентам" : "Фильтры"}
        </h2>
        <div
          className={`mt-3 grid gap-4 ${isManagerView ? "md:grid-cols-1" : "md:grid-cols-3"}`}
        >
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
          />
          {isManagerView ? null : (
            <>
              <select
                value={roleFilter}
                onChange={(event) => onRoleFilterChange(event.target.value as "ALL" | UserRole)}
                disabled={activeTab === "PATIENTS"}
                className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] outline-none transition focus:border-[#2f698f] disabled:border-[#c8d7e4] disabled:bg-[#eef4f9] disabled:text-[#6f8aa0]"
              >
                <option value="ALL">Все роли</option>
                {roleOptions
                  .filter((option) => activeTab === "PATIENTS" || option.value !== "PATIENT")
                  .map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
              </select>
              <p className="self-center text-sm font-medium text-[#446079]">
                {activeTab === "EMPLOYEES"
                  ? "Фильтры применяются к сотрудникам."
                  : "Во вкладке пациентов фильтр роли выключен."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-[#c6d7e5] bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-3 p-10 text-[#5f7a92]">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#bdd0df] border-t-[#2f698f]" />
            Загрузка пользователей...
          </div>
        ) : (
          <table className="min-w-full text-left text-sm text-[#2b3f50]">
            <thead className="sticky top-0 z-10 bg-[#edf4fa] text-[#34556f]">
              <tr>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Email</th>
                {showPhoneColumn ? <th className="px-4 py-3">Телефон</th> : null}
                {showRoleColumn ? <th className="px-4 py-3">Роль</th> : null}
                {showCreatedColumn ? <th className="px-4 py-3">Создан</th> : null}
                {showManagerAttachColumn ? <th className="px-4 py-3">Документы</th> : null}
                {isManagerView ? null : <th className="px-4 py-3">Действие</th>}
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-[#e3edf5] transition-colors hover:bg-[#f4f9fd]"
                >
                  <td className="px-4 py-3">{user.fullName}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  {showPhoneColumn ? (
                    <td className="px-4 py-3 whitespace-nowrap font-medium tabular-nums text-[#1f3344]">
                      {formatRuPhoneForDisplay(user.phone)}
                    </td>
                  ) : null}
                  {showRoleColumn ? (
                    <td className="px-4 py-3 text-[#1f3344]">{getRoleLabel(user.role)}</td>
                  ) : null}
                  {showCreatedColumn ? (
                    <td className="px-4 py-3 text-[#2b3f50]">
                      {new Date(user.createdAt).toLocaleString("ru-RU")}
                    </td>
                  ) : null}
                  {showManagerAttachColumn ? (
                    <td className="px-4 py-3">
                      {user.hasConfirmedAppointment ? (
                        <button
                          type="button"
                          onClick={() => onManagerAttachDocument?.(user)}
                          className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
                        >
                          Прикрепить
                        </button>
                      ) : (
                        <span className="text-[#6b859a]">—</span>
                      )}
                    </td>
                  ) : null}
                  {isManagerView ? null : (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenUserEdit(user)}
                          className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
                        >
                          Редактировать
                        </button>
                        {activeTab === "EMPLOYEES" ? (
                          <button
                            type="button"
                            onClick={() => onDeleteEmployee(user)}
                            disabled={deletingEmployeeId === user.id}
                            className="rounded-md border border-[#c99daa] bg-[#f6ecef] px-3 py-1 text-xs font-semibold text-[#8e3f52] transition hover:bg-[#f1e2e7] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingEmployeeId === user.id ? "Удаление..." : "Удалить"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {visibleUsers.length === 0 ? (
                <tr className="border-t border-[#e3edf5]">
                  <td className="px-4 py-6 text-center text-[#5f7a92]" colSpan={emptyColSpan}>
                    {isManagerView
                      ? "Пациенты не найдены."
                      : activeTab === "EMPLOYEES"
                        ? "По выбранным фильтрам сотрудников не найдено."
                        : "По выбранным фильтрам пациентов не найдено."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
