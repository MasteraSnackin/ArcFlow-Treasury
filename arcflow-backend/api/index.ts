/**
 * Vercel serverless entry point.
 *
 * Imports the Express app (which registers all routes at module load time)
 * and re-exports it as the default handler. Vercel routes every incoming
 * request through this handler instead of calling app.listen().
 *
 * Limitations in serverless mode:
 *   - PayoutWorker (WebSocket event listener) is not started — no persistent
 *     connection is possible in a short-lived function invocation.
 *   - The in-memory PayoutStore is reset on every cold start.
 *   - /payouts/* and /webhooks/circle return 503 until the worker is wired.
 *   - /status always returns { status: "ok" } correctly.
 *
 * For full worker functionality, deploy to a long-running host (e.g. Heroku).
 */
export { app as default } from "../src/server";
