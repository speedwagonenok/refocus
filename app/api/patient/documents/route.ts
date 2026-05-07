import { Role } from "@prisma/client";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/sessionUser";

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.role !== Role.PATIENT) {
    return NextResponse.json({ message: "Доступ запрещен." }, { status: 403 });
  }

  const documents = await prisma.patientDocument.findMany({
    where: { patientId: sessionUser.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      type: true,
      filePath: true,
      createdAt: true,
    },
  });
  return NextResponse.json(
    {
      documents: documents.map((item) => ({
        id: item.id,
        type: item.type,
        createdAt: item.createdAt,
        fileName: item.filePath.split("/").pop() ?? `document-${item.id}.pdf`,
      })),
    },
    { status: 200 },
  );
}
