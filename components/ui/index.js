/*
 * ==========================================
 * UI
 * ==========================================
 *
 * Every piece the prototype draws, in one place, so a
 * screen is an arrangement of components rather than
 * a pile of its own styles.
 *
 * Mapped from `prototype/between-us-playground.html`:
 *
 *   .tap        -> Press
 *   .view       -> Screen
 *   .nav        -> NavBar + GlassButton
 *   .lt/.lt-sub -> LargeTitle + SubTitle
 *   .h2         -> SectionHeader
 *   .gh/.gfoot  -> GroupHeader + GroupFooter
 *   .card       -> Card
 *   .group/.cell-> Group + Cell
 *   .btn        -> Button
 *   .chip       -> Chip
 *   .seg        -> Segmented
 *   .sw         -> Toggle
 *   .av         -> Avatar
 *   .cal        -> DateBlock
 *   .love       -> LoveButton
 *   .empty      -> Empty
 *   .sheet      -> Sheet
 *   .ring       -> Ring
 */

export { default as Icon } from "./Icon";

export {
  Press,
  Screen,
  NavBar,
  GlassButton,
  LargeTitle,
  SubTitle,
  SectionHeader,
  GroupHeader,
  GroupFooter,
} from "./layout";

export {
  Card,
  Group,
  Cell,
  Button,
  Chip,
  Segmented,
  Toggle,
  Avatar,
  DateBlock,
  LoveButton,
  Empty,
  Sheet,
  Ring,
  motionAllowed,
} from "./parts";
