export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'moves_device_id';
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(key, id);
  }
  return id;
}


