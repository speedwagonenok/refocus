import { FormEvent } from "react";

type UserRole = "PATIENT" | "DOCTOR" | "REGISTRAR" | "SYSTEM_ADMIN";

type CreateEmployeeSectionProps = {
  fullName: string;
  email: string;
  password: string;
  role: UserRole;
  isCreating: boolean;
  roleOptions: Array<{ value: UserRole; label: string }>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: UserRole) => void;
};

export default function CreateEmployeeSection({
  fullName,
  email,
  password,
  role,
  isCreating,
  roleOptions,
  onSubmit,
  onFullNameChange,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
}: CreateEmployeeSectionProps) {
  return (
    <form
      className="mt-6 grid gap-4 rounded-xl border border-[#c6d7e5] bg-white p-4"
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <input
          type="text"
          placeholder="ФИО"
          value={fullName}
          onChange={(event) => onFullNameChange(event.target.value)}
          required
          className="w-full rounded-md border border-[#b5cadb] px-3 py-2 text-[#2b3f50] placeholder:text-[#5b748a] outline-none transition focus:border-[#2f698f]"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          required
          className="w-full rounded-md border border-[#b5cadb] px-3 py-2 text-[#2b3f50] placeholder:text-[#5b748a] outline-none transition focus:border-[#2f698f]"
        />
        <input
          type="password"
          placeholder="Временный пароль"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
          className="w-full rounded-md border border-[#b5cadb] px-3 py-2 text-[#2b3f50] placeholder:text-[#5b748a] outline-none transition focus:border-[#2f698f]"
        />
        <select
          value={role}
          onChange={(event) => onRoleChange(event.target.value as UserRole)}
          className="w-full rounded-md border border-[#b5cadb] px-3 py-2 text-[#2b3f50] outline-none transition focus:border-[#2f698f]"
        >
          {roleOptions
            .filter((option) => option.value !== "PATIENT")
            .map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={isCreating}
        className="inline-flex w-fit items-center justify-center rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#275877] disabled:opacity-60"
      >
        {isCreating ? "Создание..." : "Создать сотрудника"}
      </button>
    </form>
  );
}
