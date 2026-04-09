import Link from "next/link";

export default function RegistrationWindow() {
  return (
    <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
      <h1 className="mb-6 text-2xl font-semibold text-gray-900">Регистрация</h1>

      <form className="space-y-4">
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Логин
          </label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Введите логин"
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
            className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none transition focus:border-black"
          />
        </div>

        <p className="pt-1 text-sm text-gray-600">Уже зарегистрированы?</p>

        <Link
          href="/signin"
          className="inline-flex w-full items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
        >
          Войти в систему
        </Link>
      </form>
    </section>
  );
}
