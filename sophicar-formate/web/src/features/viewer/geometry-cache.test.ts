import { GeometryPromiseCache } from './geometry-cache';

describe('GeometryPromiseCache', () => {
  it('parses one component only once when occurrences reuse it', async () => {
    const cache = new GeometryPromiseCache<number>();
    const loader = vi.fn(async () => 42);
    const values = await Promise.all([cache.get('link', loader), cache.get('link', loader)]);
    expect(values).toEqual([42, 42]);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
