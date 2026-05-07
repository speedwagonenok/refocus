import { FormEvent, useState } from "react";

import { formatRuPhoneForDisplay } from "@/lib/authValidation";

type UserRole = "PATIENT" | "DOCTOR" | "MANAGER" | "SYSTEM_ADMIN";

type EditingUser = {
  id: number;
  fullName: string;
  email: string;
  phone?: string | null;
  role: UserRole;
};

type UserPasswordResetModalProps = {
  editingUser: EditingUser | null;
  newPassword: string;
  isSubmitting: boolean;
  getRoleLabel: (role: UserRole) => string;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
};

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

export default function UserPasswordResetModal({
  editingUser,
  newPassword,
  isSubmitting,
  getRoleLabel,
  onPasswordChange,
  onSubmit,
  onCancel,
}: UserPasswordResetModalProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  if (!editingUser) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#10263a]/40 px-4">
      <form
        className="w-full max-w-xl rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-xl"
        onSubmit={onSubmit}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-[#1f3344]">Редактирование пользователя</h4>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Закрыть"
            className="inline-flex h-8 w-8 items-center justify-center self-center rounded-md text-2xl leading-none font-medium text-[#1f3344] transition hover:bg-[#edf4fa]"
          >
            &times;
          </button>
        </div>
        <div className="mt-3 space-y-1 text-sm text-[#3f6079]">
          <p>
            <span className="font-medium text-[#1f3344]">ФИО:</span> {editingUser.fullName}
          </p>
          <p>
            <span className="font-medium text-[#1f3344]">Email:</span> {editingUser.email}
          </p>
          {editingUser.role === "PATIENT" ? (
            <p>
              <span className="font-medium text-[#1f3344]">Телефон:</span>{" "}
              <span className="tabular-nums">{formatRuPhoneForDisplay(editingUser.phone)}</span>
            </p>
          ) : null}
          <p>
            <span className="font-medium text-[#1f3344]">Роль:</span>{" "}
            {getRoleLabel(editingUser.role)}
          </p>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-[#1f3344]" htmlFor="reset-password">
            Сброс пароля
          </label>
          <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <input
                id="reset-password"
                type={isPasswordVisible ? "text" : "password"}
                value={newPassword}
                onChange={(event) => onPasswordChange(event.target.value)}
                className="w-full rounded-md border border-[#9fb9cf] bg-white px-3 py-2 pr-10 text-[#1f3344] outline-none transition focus:border-[#2f698f]"
                placeholder="Введите новый пароль"
                required
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
          <p className="mt-2 text-xs text-[#5f7a92]">
            Минимум 8 символов, минимум одна заглавная английская буква и один спецсимвол.
          </p>
        </div>
        <div className="mt-5 flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-md bg-[#2f698f] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#275877] disabled:opacity-60"
          >
            {isSubmitting ? "Сброс..." : "Сбросить пароль"}
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
