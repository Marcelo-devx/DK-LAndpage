// Detects "stale build" errors (old JS chunk hashes no longer present after a new deploy)
// and forces a single automatic reload so users don't see a broken white screen.

const RELOAD_FLAG_KEY = "chunk-error-reload-attempted";

function isChunkLoadError(message: string | undefined | null): boolean {
  if (!message) return false;
  const patterns = [
    /Failed to load module script/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /Loading chunk [\d\w-]+ failed/i,
    /ChunkLoadError/i,
  ];
  return patterns.some((pattern) => pattern.test(message));
}

function reloadOnce() {
  // Avoid infinite reload loops if the error persists (e.g. real network issue).
  if (sessionStorage.getItem(RELOAD_FLAG_KEY)) return;
  sessionStorage.setItem(RELOAD_FLAG_KEY, "1");
  window.location.reload();
}

export function setupChunkErrorReload() {
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.message)) {
      reloadOnce();
    }
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = typeof reason === "string" ? reason : reason?.message;
    if (isChunkLoadError(message)) {
      reloadOnce();
    }
  });

  // Clear the flag once the app has successfully rendered, so a future
  // legitimate stale-build error can still trigger a reload.
  window.setTimeout(() => {
    sessionStorage.removeItem(RELOAD_FLAG_KEY);
  }, 10000);
}
