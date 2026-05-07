import Link from "next/link";

import RefocusBrandTitle from "../components/RefocusBrandTitle";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#e6edf3]">
      <header className="sticky top-0 z-20 flex w-full items-start justify-between gap-4 border-b border-[#c6d7e5] bg-white px-5 py-4 shadow-sm sm:items-center md:px-8">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 md:gap-x-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#21486b] md:text-4xl">Refocus</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-0.5 sm:pt-0">
          <Link
            href="/signInPage"
            className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] md:text-sm"
          >
            Войти
          </Link>
          <Link
            href="/registrationPage"
            className="rounded-md border border-[#8fb0cc] bg-[#edf5fb] px-3 py-2 text-xs font-semibold text-[#1f4e72] transition hover:bg-[#dfeef9] md:text-sm"
          >
            Регистрация
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-full flex-col gap-6 px-4 py-8 md:px-8 md:py-10">
        <section className="rounded-2xl bg-[#f8fbff] p-8 shadow-lg md:p-10">
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

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#1f3344]">Подбор специалиста</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
                Анкетирование помогает быстро подобрать психолога под ваш запрос и симптомы.
              </p>
            </article>
            <article className="rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#1f3344]">Запись в 2 клика</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
                Выбирайте свободный слот, подтверждайте запись и следите за статусом приема.
              </p>
            </article>
            <article className="rounded-xl border border-[#c6d7e5] bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-[#1f3344]">Документы под рукой</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#5f7a92]">
                Договоры, рецепты и протоколы приема доступны пациенту в личном кабинете.
              </p>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}