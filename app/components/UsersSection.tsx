type UserRole = "PATIENT" | "DOCTOR" | "REGISTRAR" | "SYSTEM_ADMIN";
type ActiveTab = "EMPLOYEES" | "PATIENTS";

type UserRow = {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

type UsersSectionProps = {
  activeTab: ActiveTab;
  roleFilter: "ALL" | UserRole;
  searchQuery: string;
  loading: boolean;
  visibleUsers: UserRow[];
  draftRoles: Record<number, UserRole>;
  currentUserId: number;
  isUpdatingId: number | null;
  roleOptions: Array<{ value: UserRole; label: string }>;
  onTabChange: (tab: ActiveTab) => void;
  onRoleFilterChange: (value: "ALL" | UserRole) => void;
  onSearchQueryChange: (value: string) => void;
  onDraftRoleChange: (userId: number, role: UserRole) => void;
  onRoleUpdate: (userId: number) => void;
  getRoleLabel: (role: UserRole) => string;
};

export default function UsersSection({
  activeTab,
  roleFilter,
  searchQuery,
  loading,
  visibleUsers,
  draftRoles,
  currentUserId,
  isUpdatingId,
  roleOptions,
  onTabChange,
  onRoleFilterChange,
  onSearchQueryChange,
  onDraftRoleChange,
  onRoleUpdate,
  getRoleLabel,
}: UsersSectionProps) {
  return (
    <>
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

      <div className="mt-6 rounded-xl border border-[#c6d7e5] bg-white p-4">
        <h2 className="text-lg font-semibold text-[#1f3344]">Фильтры</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          <input
            type="text"
            placeholder="Поиск по ФИО, email или ID"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 text-[#1f3344] placeholder:text-[#4f6f88] outline-none transition focus:border-[#2f698f]"
          />
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
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">ФИО</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Роль</th>
                <th className="px-4 py-3">Создан</th>
                <th className="px-4 py-3">Действие</th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-t border-[#e3edf5] transition-colors hover:bg-[#f4f9fd]"
                >
                  <td className="px-4 py-3">{user.id}</td>
                  <td className="px-4 py-3">{user.fullName}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3 text-[#1f3344]">
                    <select
                      value={draftRoles[user.id] ?? user.role}
                      onChange={(event) =>
                        onDraftRoleChange(user.id, event.target.value as UserRole)
                      }
                      className="rounded-md border border-[#9fb9cf] bg-white px-2 py-1 text-xs text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                    >
                      {roleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-[#2b3f50]">
                    {new Date(user.createdAt).toLocaleString("ru-RU")}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const draftRole = draftRoles[user.id] ?? user.role;
                      const roleChanged = draftRole !== user.role;
                      const isCurrentUser = user.id === currentUserId;
                      const disabled = isUpdatingId === user.id || isCurrentUser || !roleChanged;

                      return (
                        <button
                          type="button"
                          onClick={() => onRoleUpdate(user.id)}
                          disabled={disabled}
                          className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-1 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] disabled:cursor-not-allowed disabled:opacity-60"
                          title={
                            isCurrentUser
                              ? "Свою роль меняем только через второго SYSTEM_ADMIN"
                              : roleChanged
                                ? `Сохранить роль: ${getRoleLabel(draftRole)}`
                                : "Роль не изменена"
                          }
                        >
                          {isUpdatingId === user.id ? "Сохранение..." : "Сохранить"}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {visibleUsers.length === 0 ? (
                <tr className="border-t border-[#e3edf5]">
                  <td className="px-4 py-6 text-center text-[#5f7a92]" colSpan={6}>
                    {activeTab === "EMPLOYEES"
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
