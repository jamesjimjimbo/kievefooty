type ClubCrestProps = {
  seed: string;
  label?: string;
  size?: "sm" | "md" | "lg";
  imageUrl?: string | null;
};

function crestVariant(seed: string) {
  return [...seed].reduce((total, character) => total + character.charCodeAt(0), 0) % 6;
}

export function ClubCrest({ seed, label, size = "md", imageUrl }: ClubCrestProps) {
  const initials = (label ?? seed)
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`club-crest club-crest-${size} crest-${crestVariant(seed)}${imageUrl ? " club-crest-custom" : ""}`}
      aria-label={`${label ?? "Club"} crest`}
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      <i />
      <b>{initials}</b>
    </span>
  );
}
