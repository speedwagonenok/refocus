"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import {
  getFullNameValidationError,
  getPasswordValidationError,
} from "@/lib/authValidation";

export default function RegistrationWindow() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const fullNameError = getFullNameValidationError(fullName);
    if (fullNameError) {
      setErrorMessage(fullNameError);
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
        body: JSON.stringify({ fullName, password }),
      });

      const data = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;

      if (!response.ok) {
        setErrorMessage(data?.message ?? "Не удалось зарегистрироваться.");
        return;
      }

      setShowSuccessToast(true);
      setTimeout(() => {
        router.push("/signInPage");
      }, 1200);
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
            placeholder="Введите ФИО"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
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
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Введите пароль"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
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

      {showSuccessToast ? (
        <div className="fixed bottom-6 right-6 rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          Регистрация успешна
        </div>
      ) : null}
    </section>
  );
}
