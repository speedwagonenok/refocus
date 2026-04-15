import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/sessionUser";

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/signInPage");
  }

  if (sessionUser.role === "PATIENT") {
    redirect(`/user/${sessionUser.id}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-3 text-2xl font-semibold text-gray-900">
          Панель сотрудника
        </h1>
        <p className="text-gray-700">ФИО: {sessionUser.fullName}</p>
        <p className="mt-2 text-gray-700">ID: {sessionUser.id}</p>
        <p className="mt-2 text-gray-700">Роль: {sessionUser.role}</p>
      </section>
    </main>
  );
}
