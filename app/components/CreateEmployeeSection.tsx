import { FormEvent, useState } from "react";

type UserRole = "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";

const passwordSpecialChars = "!@#$%^&*";

function getRandomChar(source: string): string {
  return source[Math.floor(Math.random() * source.length)] ?? "A";
}

function generateTemporaryPassword(length = 12): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const allChars = uppercase + lowercase + digits + passwordSpecialChars;

  const requiredChars = [
    getRandomChar(uppercase),
    getRandomChar(lowercase),
    getRandomChar(digits),
    getRandomChar(passwordSpecialChars),
  ];

  while (requiredChars.length < length) {
    requiredChars.push(getRandomChar(allChars));
  }

  return requiredChars.sort(() => Math.random() - 0.5).join("");
}

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

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
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={isPasswordVisible ? "text" : "password"}
              placeholder="Временный пароль"
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
              required
              className="w-full rounded-md border border-[#b5cadb] px-3 py-2 pr-10 text-[#2b3f50] placeholder:text-[#5b748a] outline-none transition focus:border-[#2f698f]"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-[#1f4e72] transition hover:text-[#163c59]"
            >
              {isPasswordVisible ? (
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
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.11 1 12c.73-1.73 1.86-3.31 3.22-4.61" />
                  <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c5 0 9.27 3.89 11 8a11.84 11.84 0 0 1-1.56 2.83" />
                  <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24" />
                  <path d="M1 1l22 22" />
                </svg>
              ) : (
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
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onPasswordChange(generateTemporaryPassword())}
            className="shrink-0 rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9]"
          >
            Сгенерировать
          </button>
        </div>
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
