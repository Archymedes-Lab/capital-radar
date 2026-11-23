export async function register() {
  // Node-only work lives in its own file so the Edge build (used because middleware exists) never sees it.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./instrumentation-node");
    await startScheduler();
  }
}
