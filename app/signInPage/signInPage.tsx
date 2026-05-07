import LoginWindow from "@/app/components/LoginWindow";
import RefocusBrandTitle from "@/app/components/RefocusBrandTitle";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:items-center md:justify-between md:gap-12 lg:gap-16">
        <div className="flex w-full shrink-0 flex-col items-center justify-center md:flex-1">
          <RefocusBrandTitle />
        </div>
        <div className="flex w-full justify-center md:flex-1 md:justify-center">
          <LoginWindow />
        </div>
      </div>
    </main>
  );
}
