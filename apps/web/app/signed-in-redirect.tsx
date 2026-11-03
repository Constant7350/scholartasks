"use client";

import { useEffect } from "react";
import { supabase } from "../lib/supabase";

/** Sends signed-in people from the public landing page to their home dashboard. */
export function SignedInRedirect() {
  useEffect(() => {
    supabase()?.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/home");
    });
  }, []);
  return null;
}
