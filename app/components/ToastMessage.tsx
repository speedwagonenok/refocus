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
      className={`mt-4 rounded-md border px-4 py-3 text-sm font-medium transition-all duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      } ${
        toast.type === "success"
          ? "border-[#8fb0cc] bg-[#edf5fb] text-[#1f4e72]"
          : "border-[#d6a8b0] bg-[#f6ecef] text-[#8e3f52]"
      }`}
    >
      {toast.message}
    </div>
  );
}
