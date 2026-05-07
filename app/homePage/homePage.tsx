import Link from "next/link";

import LoginButton from "../components/LoginButton";
import RefocusBrandTitle from "../components/RefocusBrandTitle";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#e6edf3] px-4 py-8 md:px-8 md:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="rounded-3xl border border-[#c6d7e5] bg-gradient-to-br from-white to-[#f3f8fc] p-6 shadow-lg md:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <RefocusBrandTitle className="text-left text-5xl sm:text-6xl md:text-7xl" />
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#39556d] md:text-lg">
                Онлайн-пространство для бережной психологической помощи: подбор специалиста,
                понятная запись на прием и документы в личном кабинете.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#bfd2e2] bg-[#edf4fa] px-3 py-1 text-xs font-semibold text-[#39556d] md:text-sm">
                  Конфиденциально
                </span>
                <span className="rounded-full border border-[#bfd2e2] bg-[#edf4fa] px-3 py-1 text-xs font-semibold text-[#39556d] md:text-sm">
                  Онлайн-формат
                </span>
                <span className="rounded-full border border-[#bfd2e2] bg-[#edf4fa] px-3 py-1 text-xs font-semibold text-[#39556d] md:text-sm">
                  Удобный кабинет
                </span>
              </div>
            </div>

            <section className="w-full rounded-2xl border border-[#d8e4ef] bg-white p-6 shadow-md md:p-7">
              <p className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.08em] text-[#4f6f88]">
                Начать работу
              </p>
              <div className="flex flex-col gap-3">
                <LoginButton className="w-full py-3 text-base" />
                <Link
                  href="/registrationPage"
                  className="inline-flex w-full items-center justify-center rounded-md border border-[#21486b] bg-white px-4 py-3 text-base font-semibold text-[#21486b] transition hover:bg-[#edf4fa]"
                >
                  Регистрация
                </Link>
              </div>
            </section>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#1f3344]">Подбор специалиста</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
              Анкетирование помогает быстро подобрать психолога под ваш запрос и симптомы.
            </p>
          </article>
          <article className="rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#1f3344]">Запись в 2 клика</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
              Выбирайте свободный слот, подтверждайте запись и следите за статусом приема.
            </p>
          </article>
          <article className="rounded-2xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-[#1f3344]">Документы под рукой</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
              Договоры, рецепты и протоколы приема доступны пациенту в личном кабинете.
            </p>
          </article>
        </section>
      </div>
    </main>
  );
}