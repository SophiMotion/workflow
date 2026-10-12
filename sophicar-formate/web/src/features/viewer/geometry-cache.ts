export class GeometryPromiseCache<T> {
  private readonly entries = new Map<string, Promise<T>>();

  get(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing) return existing;
    const pending = loader().catch((error) => {
      this.entries.delete(key);
      throw error;
    });
    this.entries.set(key, pending);
    return pending;
  }

  clear(dispose?: (value: T) => void): void {
    if (dispose) {
      this.entries.forEach((pending) => void pending.then(dispose));
    }
    this.entries.clear();
  }
}
