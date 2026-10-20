import { useCallback, useState } from "react";

const isSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Japanese pronunciation via the SpeechSynthesis API. `force` plays even when muted. */
export function useSpeech(isMuted: boolean) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback(
    (text: string, force = false) => {
      if (!isSupported() || (isMuted && !force)) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        utterance.rate = 0.9;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isMuted]
  );

  const stop = useCallback(() => {
    if (isSupported()) window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
