"use client";

/**
 * Thin promise wrapper around a search worker. Only the latest request is
 * honoured: starting a new search makes older pending ones resolve as stale.
 * If the worker cannot start (blocked, bundler without worker support, script
 * 404), searches fall back to the main thread instead of hanging.
 */
export class EngineClient<Req, Res> {
  private worker: Worker | null = null;
  private broken = false;
  private seq = 0;
  private pending = new Map<number, { req: Req; resolve: (r: Res | null) => void }>();

  constructor(
    private spawn: () => Worker,
    private fallback: (req: Req) => Promise<Res>
  ) {}

  private ensure() {
    if (this.broken || typeof window === "undefined") return null;
    if (this.worker) return this.worker;
    try {
      this.worker = this.spawn();
      this.worker.onmessage = (e: MessageEvent<{ id: number; result: Res }>) => {
        const p = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        p?.resolve(e.data.result);
      };
      this.worker.onerror = (e) => {
        e.preventDefault?.();
        this.markBroken();
      };
    } catch {
      this.markBroken();
    }
    return this.worker;
  }

  /** Worker failed: stop using it and re-run whatever was waiting on the main thread. */
  private markBroken() {
    this.broken = true;
    this.worker?.terminate();
    this.worker = null;
    const waiting = [...this.pending.entries()];
    this.pending.clear();
    for (const [id, { req, resolve }] of waiting) this.runFallback(id, req, resolve);
  }

  private runFallback(id: number, req: Req, resolve: (r: Res | null) => void) {
    setTimeout(() => {
      this.fallback(req)
        .then((r) => resolve(id === this.seq ? r : null))
        .catch(() => resolve(null));
    }, 0);
  }

  /** Resolves with null if a newer request superseded this one. */
  request(req: Req): Promise<Res | null> {
    const id = ++this.seq;
    this.pending.forEach((p) => p.resolve(null));
    this.pending.clear();
    const w = this.ensure();
    return new Promise((resolve) => {
      if (!w) return this.runFallback(id, req, resolve);
      this.pending.set(id, { req, resolve });
      w.postMessage({ id, ...(req as object) });
    });
  }

  /** Abort the running search (the worker is restarted lazily). */
  cancel() {
    this.pending.forEach((p) => p.resolve(null));
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  dispose() {
    this.cancel();
  }
}
