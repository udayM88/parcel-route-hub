import { useEffect } from "react";
import { ChatboxPosition, Crisp } from "crisp-sdk-web";
import { getAuthSession } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";

const CRISP_WEBSITE_ID = "0f163c1b-0824-46f1-9e7e-68aaa3c55367";
const CRISP_Z_INDEX = 2147483000;

let configured = false;

/** Opens the Crisp chatbox (same widget used across the site). */
export const openCrispChat = () => {
  try {
    Crisp.chat.open();
  } catch {
    /* noop */
  }
};

const applySession = async () => {
  const session = getAuthSession();

  if (session) {
    try {
      Crisp.setTokenId(session.user_id);
      const name = session.full_name || session.userName;
      if (name) Crisp.user.setNickname(name);
      if (session.phone) Crisp.user.setPhone(session.phone);
    } catch {
      /* noop */
    }
    return;
  }

  // Business portal users authenticate through Supabase, not the consumer OTP session.
  try {
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if (user) {
      Crisp.setTokenId(user.id);
      if (user.email) Crisp.user.setEmail(user.email);
      const name = (user.user_metadata?.full_name as string) || (user.user_metadata?.company_name as string);
      if (name) Crisp.user.setNickname(name);
      return;
    }
  } catch {
    /* noop */
  }

  try {
    Crisp.setTokenId();
    Crisp.session.reset();
  } catch {
    /* noop */
  }
};

export function CrispChat() {
  const { pathname } = useLocation();
  const disabled = pathname.startsWith("/feedback/");

  useEffect(() => {
    if (disabled) {
      if (configured) {
        try {
          Crisp.chat.hide();
        } catch {
          /* noop */
        }
      }
      return;
    }

    if (!configured) {
      Crisp.configure(CRISP_WEBSITE_ID);
      try {
        Crisp.setPosition(ChatboxPosition.Right);
        Crisp.setZIndex(CRISP_Z_INDEX);
      } catch {
        /* noop */
      }
      configured = true;
    }
    try {
      Crisp.chat.show();
    } catch {
      /* noop */
    }
    void applySession();

    const onStorage = (e: StorageEvent) => {
      if (e.key === "auth_session" || e.key === "prayog_auth") void applySession();
    };
    window.addEventListener("storage", onStorage);

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void applySession();
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      sub?.subscription?.unsubscribe();
    };
  }, [disabled]);

  return null;
}

export default CrispChat;
