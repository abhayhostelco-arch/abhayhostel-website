import Image from "next/image";

export function ProfileAvatar({
  name,
  src,
  size = 36,
  className = "avatar",
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return src ? (
    <span className={`${className} avatar-image`} style={{ width: size, height: size }}>
      <Image src={src} width={size} height={size} alt={`${name}'s profile picture`} unoptimized />
    </span>
  ) : <span className={className} style={{ width: size, height: size }} aria-hidden="true">{initials || "?"}</span>;
}
