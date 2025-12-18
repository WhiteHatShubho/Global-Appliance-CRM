/**
 * Global Loading Overlay Utility
 * Provides showLoader() and hideLoader() functions
 * Used for ALL async operations (Firebase, API calls, etc)
 */

export function showLoader() {
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = "flex";
  }
}

export function hideLoader() {
  const loader = document.getElementById("globalLoader");
  if (loader) {
    loader.style.display = "none";
  }
}

/**
 * Wrapper function for async operations
 * Usage: await withLoader(asyncFunction)
 */
export async function withLoader(asyncFn) {
  try {
    showLoader();
    return await asyncFn();
  } finally {
    hideLoader();
  }
}
