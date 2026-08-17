from pathlib import Path
import re

p = Path('web/src/components/free-profile/IntapLinkGratis.experience.ts')
s = p.read_text()

shared_import = "import { FREE_PROFILE_STARTER_CONTENT, resolveFreeStarterContent, type FreeStarterContentPack } from '../../../../shared/free-profile-starter-content'\n"
if shared_import not in s:
    marker = "import type {\n  FreeProfileAppearanceColors,\n} from './IntapLinkGratis.types'\n"
    if marker not in s:
        raise SystemExit('Expected experience import block not found.')
    s = s.replace(marker, marker + shared_import, 1)

replacement = '''function toFreeProfileStarterPack(pack: FreeStarterContentPack): FreeProfileStarterPack {
  return {
    category: pack.category,
    role: pack.role,
    bio: pack.bio,
    heroLabel: pack.heroLabel,
    recommendedPalette: pack.recommendedPalette,
    services: pack.services.map(({ title, description }) => ({ title, description })),
    portfolio: [],
  }
}

export const FREE_STARTER_PACKS: Record<string, FreeProfileStarterPack> = Object.fromEntries(
  Object.entries(FREE_PROFILE_STARTER_CONTENT).map(([category, pack]) => [category, toFreeProfileStarterPack(pack)]),
)

export function resolveStarterPack(
  category?: string | null,
): FreeProfileStarterPack {
  return toFreeProfileStarterPack(resolveFreeStarterContent(category))
}
'''

pattern = re.compile(
    r"export const FREE_STARTER_PACKS: Record<\n  string,\n  FreeProfileStarterPack\n> = \{.*?\n\}\n\nexport function resolveStarterPack\(\n  category\?: string \| null,\n\): FreeProfileStarterPack \{.*?\n\}\n",
    re.S,
)

if replacement not in s:
    next_s, count = pattern.subn(replacement, s, count=1)
    if count != 1:
        raise SystemExit(f'Expected one starter-pack block, found {count}.')
    s = next_s

p.write_text(s)
print('Wired web starter-pack resolver to canonical 24-category shared resource.')
