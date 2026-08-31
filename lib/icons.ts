import * as PhosphorIcons from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

/** Category.icon stores a kebab-case Phosphor icon name, e.g. "users-three" -> UsersThree. */
export function resolveIcon(name: string): Icon {
  const pascalName = name
    .trim()
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  const icons = PhosphorIcons as unknown as Record<string, Icon>;
  return icons[pascalName] ?? PhosphorIcons.Tag;
}
