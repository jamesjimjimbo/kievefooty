type ClubCrestProps = {
  seed: string;
  label?: string;
  size?: "sm" | "md" | "lg";
};

function crestVariant(seed: string) {
  return [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % 6;
}

export function ClubCrest({ seed, label, size = "md" }: ClubCrestProps) {
  const initials = (label ?? seed)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`club-crest club-crest-${size} crest-${crestVariant(seed)}`}
      aria-label={`${label ?? "Club"} crest`}
    >
      <i />
      <b>{initials}</b>
    </span>
  );
}
