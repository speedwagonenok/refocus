type AdminTopBarProps = {
  greeting: string;
  currentUserName: string;
  currentUserEmail: string;
  isLoggingOut: boolean;
  onLogout: () => void;
};

export default function AdminTopBar({
  greeting,
  currentUserName,
  currentUserEmail,
  isLoggingOut,
  onLogout,
}: AdminTopBarProps) {
  return (
    <header className="sticky top-0 z-20 flex w-full items-center justify-between bg-[#21486b] px-5 py-4 text-white shadow-lg md:px-8">
      <h1 className="text-lg font-semibold md:text-xl">Панель администратора</h1>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-[#d7e7f4] md:text-base">
            {greeting}, {currentUserName}
          </p>
          <p className="text-xs text-[#b9d3e6] md:text-sm">{currentUserEmail}</p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={isLoggingOut}
          className="rounded-md border border-[#8fb0cc] bg-[#2f698f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#275877] disabled:opacity-60 md:text-sm"
        >
          {isLoggingOut ? "Выход..." : "Выйти"}
        </button>
      </div>
    </header>
  );
}
