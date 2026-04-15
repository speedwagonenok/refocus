type ToastType = "success" | "error";

type ToastMessageProps = {
  toast: { type: ToastType; message: string } | null;
  isVisible: boolean;
};

export default function ToastMessage({ toast, isVisible }: ToastMessageProps) {
  if (!toast) {
    return null;
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 max-w-sm rounded-md px-4 py-3 text-sm font-medium text-white shadow-lg transition-all duration-300 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      } ${
        toast.type === "success"
          ? "border border-[#2b5d86] bg-[#2f698f]"
          : "border border-[#9b3f4b] bg-[#c25766]"
      }`}
    >
      {toast.message}
    </div>
  );
}
