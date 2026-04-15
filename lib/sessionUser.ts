import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE } from "@/lib/session";

export async function getSessionUser() {
  const cookieStore = await cookies();
  const rawId = cookieStore.get(USER_SESSION_COOKIE)?.value;
  if (!rawId) {
    return null;
  }

  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      role: true,
    },
  });
}
