/**
 * Tropic Office — typography entry point (platform-free).
 *
 * Re-exports the tokens from typography-tokens.ts. Kept as a named entry so
 * web consumers (lyfe-sg, tailwind configs, etc.) can do:
 *     import { Fonts, FontStacks } from '@/design/typography';
 *
 * RN consumers should ALSO import the Type helper from ./typography.native
 * (which has Platform-aware letter-spacing baked in).
 *
 * NOTE: the primitives live in ./typography-tokens (not here) because Metro's
 * `.native` resolution would otherwise make typography.native.ts import
 * itself. See typography-tokens.ts header.
 */

export { Fonts, FontStacks, FontSize, FontWeight, LetterSpacing, LineHeight } from './typography-tokens';
