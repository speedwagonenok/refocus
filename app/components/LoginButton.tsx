import Link from "next/link";

export default function LoginButton() {
  return (
    <Link
      href="/signInPage"
      className="inline-flex items-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85"
    >
      Войти
    </Link>
  );
}
