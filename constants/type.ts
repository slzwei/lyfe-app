/**
 * Lyfe App — Tropic typography tokens.
 *
 * Font names and the Type scale are sourced from the root design system
 * (`lyfe-design/src/typography.ts` + `typography.native.ts` → synced to
 * `@/design/typography*.ts`).
 *
 * Role rules (enforced):
 * - SERIF  (Fraunces):     greetings ONLY · ONE hero number per screen · ONE italic per screen
 * - SANS   (Albert Sans):  everything else
 * - MONO   (JetBrains Mono): timestamps + short IDs only
 *
 * Usage:
 *   import { Fonts, Type } from '@/constants/type';
 *   <Text style={[Type.display, { color: colors.textPrimary }]}>…</Text>
 *   <Text style={{ fontFamily: Fonts.serifItalic, fontSize: 24 }}>…</Text>
 */

export { Fonts } from '@/design/typography';
export { Type } from '@/design/typography.native';
