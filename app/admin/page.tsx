import { redirect } from "next/navigation";

import DoctorWorkspacePanel from "@/app/components/DoctorWorkspacePanel";
import ManagerPanel from "@/app/components/ManagerPanel";
import SuperadminPanel from "@/app/components/SuperadminPanel";
import { getSessionUser } from "@/lib/sessionUser";

export default async function AdminPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/signInPage");
  }

  if (sessionUser.role === "PATIENT") {
    redirect(`/user/${sessionUser.id}`);
  }

  if (sessionUser.role === "SYSTEM_ADMIN") {
    return (
      <SuperadminPanel
        currentUserName={sessionUser.fullName}
        currentUserEmail={sessionUser.email}
      />
    );
  }

  if (sessionUser.role === "DOCTOR") {
    return (
      <DoctorWorkspacePanel
        currentUserName={sessionUser.fullName}
        currentUserEmail={sessionUser.email}
      />
    );
  }

  if (sessionUser.role === "MANAGER") {
    return (
      <ManagerPanel
        currentUserName={sessionUser.fullName}
        currentUserEmail={sessionUser.email}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-3 text-2xl font-semibold text-gray-900">Панель сотрудника</h1>
        <p className="text-gray-700">Расширенная админ-панель доступна SYSTEM_ADMIN.</p>
        <p className="text-gray-700">ФИО: {sessionUser.fullName}</p>
        <p className="mt-2 text-gray-700">Роль: {sessionUser.role}</p>
      </section>
    </main>
  );
}
