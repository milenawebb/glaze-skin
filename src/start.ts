import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { setResponseHeader, removeResponseHeader } from "@tanstack/react-start/server";
import { EMBED_FRAME_POLICY, isEmbedPage } from "./lib/embed-policy";

const embedMiddleware = createMiddleware().server(async ({ pathname, next }) => {
  if (isEmbedPage(pathname)) {
    removeResponseHeader("X-Frame-Options");
    setResponseHeader("Content-Security-Policy", EMBED_FRAME_POLICY);
  }
  return next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

// requestMiddleware runs on every request; functionMiddleware only on server functions, where
// client sendContext is unvalidated input. Append to these arrays, never replace them.
// Enabling Lovable Cloud adds functionMiddleware: [attachSupabaseAuth], the bearer token that
// requireSupabaseAuth server functions need. Add it by hand only if Lovable Cloud or a
// user-managed Supabase project is connected, no middleware here sets Authorization, and the
// project did not intentionally replace it.
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware, embedMiddleware],
}));
