import { trackEvent } from "../utils/gtm";
import { booleanCodec, usePersistentState } from "./usePersistentState";

/** Audio and display settings shared by the vocabulary of every level, so a toggle applies to N5 and N2 alike. */
export function useVocabSettings() {
  const [isMuted, setIsMuted] = usePersistentState("mimikara_is_muted", false, booleanCodec);
  const [hideHanViet, setHideHanViet] = usePersistentState("mimikara_hide_han_viet", false, booleanCodec);
  const [hideHiragana, setHideHiragana] = usePersistentState("mimikara_hide_hiragana", false, booleanCodec);

  const toggleMute = () => {
    setIsMuted(!isMuted);
    trackEvent("toggle_mute", { muted: !isMuted });
  };

  const toggleHanViet = () => {
    setHideHanViet(!hideHanViet);
    trackEvent("toggle_hide_han_viet", { hide: !hideHanViet });
  };

  const toggleHiragana = () => {
    setHideHiragana(!hideHiragana);
    trackEvent("toggle_hide_hiragana", { hide: !hideHiragana });
  };

  return { isMuted, hideHanViet, hideHiragana, toggleMute, toggleHanViet, toggleHiragana };
}

export type VocabSettings = ReturnType<typeof useVocabSettings>;
