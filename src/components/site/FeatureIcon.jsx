import {
  IconUsers, IconBook, IconVideo, IconMic, IconClipboard,
  IconCard, IconAward, IconShield, IconSearch, IconPrinter, IconSpark,
} from './Icons.jsx';

/**
 * The catalogue names its icons as strings, because it has to stay readable
 * by a test runner with no JSX. This is where a name becomes a drawing.
 *
 * An unknown name falls back rather than rendering nothing — a feature added
 * to the catalogue with a typo should still get a card.
 */
const BY_NAME = {
  users: IconUsers,
  book: IconBook,
  video: IconVideo,
  mic: IconMic,
  clipboard: IconClipboard,
  card: IconCard,
  award: IconAward,
  shield: IconShield,
  search: IconSearch,
  printer: IconPrinter,
};

export default function FeatureIcon({ name, ...rest }) {
  const Glyph = BY_NAME[name] || IconSpark;
  return <Glyph {...rest} />;
}
