import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { USER_SESSION_COOKIE } from "@/lib/session";

type UserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionUserId = cookieStore.get(USER_SESSION_COOKIE)?.value;

  if (!sessionUserId) {
    redirect("/signInPage");
  }

  if (sessionUserId !== id) {
    redirect(`/user/${sessionUserId}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <section className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="mb-3 text-2xl font-semibold text-gray-900">
          Страница пользователя
        </h1>
        <p className="text-gray-700">ID пользователя: {id}</p>
      </section>
    </main>
  );
}
