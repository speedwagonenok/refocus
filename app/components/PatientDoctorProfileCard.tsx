"use client";

import PatientDoctorMonthCalendar from "@/app/components/PatientDoctorMonthCalendar";
import PatientDiplomasGallery from "@/app/components/PatientDiplomasGallery";
import {
  ALL_PSYCHOTHERAPY_DISEASES,
  ALL_PSYCHOTHERAPY_SYMPTOMS,
} from "@/lib/psychotherapyPresets";

export type PatientDoctorPublicDiploma = {
  id: number;
  title: string;
  issuedBy: string | null;
  year: number | null;
};
export type PatientDoctorEducation = {
  when: string;
  institution: string;
  specialty: string;
};

export type PatientDoctorPublicProfile = {
  id: number;
  fullName: string;
  doctorBio: string | null;
  hasAvatar: boolean;
  matchedSymptoms: string[];
  profileSymptoms: string[];
  profileDiseases: string[];
  profileEducation: PatientDoctorEducation[];
  sessionPrice: number | null;
  diplomas: PatientDoctorPublicDiploma[];
};

function orderedProfileSymptoms(profileSymptoms: string[] | undefined): string[] {
  const list = profileSymptoms ?? [];
  const inProfile = new Set(list);
  const primary = ALL_PSYCHOTHERAPY_SYMPTOMS.filter((label) => inProfile.has(label));
  const extra = list.filter((label) => !ALL_PSYCHOTHERAPY_SYMPTOMS.includes(label));
  return [...primary, ...extra];
}

function orderedProfileDiseases(profileDiseases: string[] | undefined): string[] {
  const list = profileDiseases ?? [];
  const inProfile = new Set(list);
  const primary = ALL_PSYCHOTHERAPY_DISEASES.filter((label) => inProfile.has(label));
  const extra = list.filter((label) => !ALL_PSYCHOTHERAPY_DISEASES.includes(label));
  return [...primary, ...extra];
}

type Props = {
  doc: PatientDoctorPublicProfile;
  /** Раздел «Все специалисты»: подсветить все симптомы из профиля как выбранные */
  highlightAllProfileSymptoms?: boolean;
};

export default function PatientDoctorProfileCard({
  doc,
  highlightAllProfileSymptoms = false,
}: Props) {
  return (
    <li className="overflow-visible rounded-xl border border-[#bfd2e2] bg-white p-5 shadow-sm md:p-6">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="mx-auto flex w-full max-w-[11rem] shrink-0 flex-col items-center gap-3 self-start sticky top-24 z-[1]">
          <div className="relative h-36 w-36 overflow-hidden rounded-full border border-[#c6d7e5] bg-[#edf4fa] md:h-44 md:w-44">
            {doc.hasAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/patient/doctors/${doc.id}/avatar`}
                alt={doc.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#39556d] md:text-3xl">
                {doc.fullName.trim().charAt(0).toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="w-full text-center">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[#5f7a92]">Цена за сеанс</p>
            {doc.sessionPrice != null && doc.sessionPrice > 0 ? (
              <p className="mt-1 text-xl font-bold tabular-nums leading-snug text-[#1f3344] md:text-2xl">
                {doc.sessionPrice.toLocaleString("ru-RU")} <span className="whitespace-nowrap">₽ / час</span>
              </p>
            ) : (
              <p className="mt-1 text-base font-semibold text-[#6b859a] md:text-lg">не указана</p>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-lg font-semibold text-[#1f3344] md:text-xl">{doc.fullName}</p>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6 lg:gap-8">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">О себе</p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#5f7a92]">
                {doc.doctorBio?.trim() ? doc.doctorBio : "Описание в профиле не указано."}
              </p>
            </div>
            <div className="min-w-0 flex-1 md:max-w-[min(100%,22rem)] lg:max-w-md">
              <PatientDoctorMonthCalendar doctorId={doc.id} embedded />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">Симптомы в профиле</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {orderedProfileSymptoms(doc.profileSymptoms).map((s) => {
                const isMatch =
                  highlightAllProfileSymptoms || doc.matchedSymptoms.includes(s);
                return (
                  <span
                    key={s}
                    className={
                      isMatch
                        ? "max-w-full break-words rounded-full border border-[#2f698f] bg-[#e8f2fa] px-2.5 py-1 text-xs font-medium text-[#21486b] sm:text-sm"
                        : "max-w-full break-words rounded-full border border-[#e8eef2] bg-[#fafcfd] px-2.5 py-1 text-xs text-[#8a9bab] sm:text-sm"
                    }
                  >
                    {s}
                  </span>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">Заболевания в профиле</p>
            {orderedProfileDiseases(doc.profileDiseases).length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {orderedProfileDiseases(doc.profileDiseases).map((disease) => (
                  <span
                    key={disease}
                    className="max-w-full break-words rounded-full border border-emerald-300/70 bg-emerald-50/95 px-2.5 py-1 text-xs font-medium text-emerald-900/90 sm:text-sm"
                  >
                    {disease}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#6b859a]">Не указаны</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#5f7a92]">Образование</p>
            {(doc.profileEducation ?? []).length > 0 ? (
              <ul className="mt-2 space-y-2">
                {(doc.profileEducation ?? []).map((item, idx) => (
                  <li
                    key={`${item.when}-${item.institution}-${item.specialty}-${idx}`}
                    className="rounded-lg border border-[#dbe8f2] bg-[#f8fbff] px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-[#1f3344]">{item.when}</p>
                    <p className="mt-0.5 text-sm text-[#5f7a92]">{item.institution}</p>
                    <p className="mt-0.5 text-sm text-[#5f7a92]">Специальность: {item.specialty}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[#6b859a]">Не указано</p>
            )}
          </div>

          <PatientDiplomasGallery doctorId={doc.id} diplomas={doc.diplomas ?? []} />
        </div>
      </div>
    </li>
  );
}
