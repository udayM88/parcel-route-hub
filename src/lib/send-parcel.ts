export const APP_STORE_URL = "https://apps.apple.com/in/app/viasetu/id6801613415";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.viasetu.app";
export const SEND_PARCEL_EVENT = "viasetu:send-parcel-prompt";

export function mobilePlatform(): "ios" | "android" | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return null;
}

/** On phones/tablets, offer the app first; desktop goes straight to web login. */
export function requestSendParcel(navigate: (to: string) => void) {
  if (mobilePlatform()) window.dispatchEvent(new Event(SEND_PARCEL_EVENT));
  else navigate("/login");
}
