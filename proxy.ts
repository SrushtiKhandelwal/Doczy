import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// All routes are public by default.
// Auth is enforced at the API route level (not via middleware/proxy).
// This keeps the homepage accessible to unauthenticated users (they see the auth gate).
const isProtectedApiRoute = createRouteMatcher(["/api/convert(.*)"]);

const proxyHandler = clerkMiddleware(async (auth, req) => {
  // Let /api/convert handle its own auth check with a rich error response.
  // We don't block at the middleware level so we can return structured JSON errors.
  void isProtectedApiRoute(req);
});

export default function proxy(req: any, event: any) {
  return proxyHandler(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
