/**
 * Global Loading Overlay Utility
 * Provides showLoader() and hideLoader() functions
 * Uses deadline SVG animation for all async operations
 * Implements smooth fade with minimum display time (700ms)
 */

let loaderStartTime = 0;
const MIN_LOADER_TIME = 700; // milliseconds

export function showLoader() {
  loaderStartTime = Date.now();
  const loader = document.getElementById("global-loader");
  console.log('showLoader called, element:', loader);
  if (loader) {
    loader.classList.add("show");
    console.log('Loader shown, classes:', loader.className);
  } else {
    console.warn('global-loader element not found!');
  }
}

export function hideLoader() {
  const loader = document.getElementById("global-loader");
  console.log('hideLoader called, element:', loader);
  
  const elapsed = Date.now() - loaderStartTime;
  const remaining = MIN_LOADER_TIME - elapsed;
  
  if (remaining > 0) {
    console.log(`Loader held for ${remaining}ms before hiding`);
    setTimeout(() => {
      if (loader) {
        loader.classList.remove("show");
        console.log('Loader hidden after minimum time, classes:', loader.className);
      }
    }, remaining);
  } else {
    if (loader) {
      loader.classList.remove("show");
      console.log('Loader hidden immediately (operation took longer than min time)');
    }
  }
}

/**
 * Wrapper function for async operations
 * Usage: await withLoader(asyncFunction)
 * Automatically manages showLoader/hideLoader
 */
export async function withLoader(asyncFn) {
  try {
    showLoader();
    return await asyncFn();
  } finally {
    hideLoader();
  }
}
