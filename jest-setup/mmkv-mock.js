const stores = new Map();

function createMMKV(configuration = {}) {
  const id = configuration.id ?? 'default';
  if (!stores.has(id)) stores.set(id, new Map());
  const store = stores.get(id);

  return {
    set: (key, value) => store.set(key, value),
    getString: (key) => {
      const value = store.get(key);
      return typeof value === 'string' ? value : undefined;
    },
    remove: (key) => store.delete(key),
    clearAll: () => store.clear(),
  };
}

module.exports = { createMMKV };
