"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  getEmailValidationError,
  getFullNameValidationError,
  getPasswordValidationError,
} from "@/lib/authValidation";

export default function RegistrationWindow() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessToast(null);

    const fullNameError = getFullNameValidationError(fullName);
    if (fullNameError) {
      setErrorMessage(fullNameError);
      return;
    }

    const emailError = getEmailValidationError(email);
    if (emailError) {
      setErrorMessage(emailError);
      return;
    }

    const passwordError = getPasswordValidationError(password);
    if (passwordError) {
      setErrorMessage(passwordError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? "Не удалось зарегистрироваться.");
        return;
      }

      setSuccessToast("Успешно.");
      setTimeout(() => {
        router.push("/signInPage");
      }, 900);
    } catch {
      setErrorMessage("Ошибка сети. Повторите попытку.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Регистрация</h1>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="fullName"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            ФИО
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Иванов Иван Иванович"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Пароль
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Введите пароль"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 outline-none transition focus:border-black"
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((prev) => !prev)}
              aria-label={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              title={isPasswordVisible ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-0 inline-flex items-center justify-center px-3 text-gray-600 transition hover:text-gray-800"
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
        </div>

        {errorMessage ? (
          <p className="text-sm text-red-600">{errorMessage}</p>
        ) : null}

        <p className="pt-1 text-sm text-gray-600">
          Уже зарегистрированы?{" "}
          <Link
            href="/signInPage"
            className="font-medium text-black underline underline-offset-2 transition-opacity hover:opacity-70"
          >
            Войти в систему
          </Link>
        </p>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          {isSubmitting ? "Регистрация..." : "Зарегистрироваться"}
        </button>
      </form>

      {successToast ? (
        <div className="fixed bottom-6 right-6 max-w-sm rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {successToast}
        </div>
      ) : null}
    </section>
  );
}
