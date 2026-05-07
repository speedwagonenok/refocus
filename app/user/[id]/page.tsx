import { redirect } from "next/navigation";

import PatientWorkspacePanel from "@/app/components/PatientWorkspacePanel";
import { getSessionUser } from "@/lib/sessionUser";

type UserPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function UserPage({ params }: UserPageProps) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    redirect("/signInPage");
  }

  if (String(sessionUser.id) !== id) {
    redirect(`/user/${sessionUser.id}`);
  }

  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    redirect("/signInPage");
  }

  if (sessionUser.id !== numericId) {
    redirect("/signInPage");
  }

  if (sessionUser.role !== "PATIENT") {
    redirect("/admin");
  }

  return (
    <PatientWorkspacePanel
      currentUserName={sessionUser.fullName}
      currentUserEmail={sessionUser.email}
    />
  );
}
