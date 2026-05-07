import Link from "next/link";

type Props = {
  className?: string;
};

export default function LoginButton({ className = "" }: Props) {
  return (
    <Link
      href="/signInPage"
      className={`inline-flex items-center justify-center rounded-md bg-[#21486b] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a3a57] ${className}`}
    >
      Войти
    </Link>
  );
}
