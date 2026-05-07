type Props = {
  className?: string;
};

export default function RefocusBrandTitle({ className = "" }: Props) {
  return (
    <h1
      className={`text-center text-5xl font-bold tracking-tight text-[#21486b] sm:text-6xl md:text-7xl ${className}`}
    >
      Refocus
    </h1>
  );
}
