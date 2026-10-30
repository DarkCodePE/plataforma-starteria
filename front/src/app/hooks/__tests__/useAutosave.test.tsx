import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

/**
 * useAutosave uses setTimeout for debouncing and exponential backoff retries.
 * With vi.useFakeTimers we control time deterministically. To avoid races
 * between fake timers and React state batching we use
 * `vi.advanceTimersByTimeAsync` inside `act` so microtasks flush in order.
 */
describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts in idle when no time has been advanced', () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useAutosave({ data: { x: 1 }, saveFn, delay: 100 }),
    );
    expect(result.current.state).toBe('idle');
    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('does not persist the initial render because mounting is read-only', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutosave({ data: { x: 1 }, saveFn, delay: 100 }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(saveFn).not.toHaveBeenCalled();
  });

  it('debounces saves and transitions to saved after success', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ data }: { data: { x: number } }) =>
        useAutosave({ data, saveFn, delay: 1000 }),
      { initialProps: { data: { x: 1 } } },
    );

    // Change data before debounce fires — should reset the timer.
    rerender({ data: { x: 2 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveFn).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(saveFn).toHaveBeenCalledWith({ x: 2 });
    expect(result.current.state).toBe('saved');
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    expect(result.current.isDirty).toBe(false);
  });

  it('does not save when enabled=false', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    renderHook(() =>
      useAutosave({ data: { x: 1 }, saveFn, delay: 100, enabled: false }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('skips save when stringified data is unchanged from last save', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ data }: { data: { x: number } }) =>
        useAutosave({ data, saveFn, delay: 100 }),
      { initialProps: { data: { x: 1 } } },
    );

    // Trigger first save with a real data change.
    rerender({ data: { x: 2 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(saveFn).toHaveBeenCalledTimes(1);

    // Re-render with same data — should not save again.
    rerender({ data: { x: 2 } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure (up to maxRetries) then settles to error state', async () => {
    const saveFn = vi
      .fn<(d: unknown) => Promise<void>>()
      .mockRejectedValue(new Error('save failed'));

    const { result, rerender } = renderHook(
      ({ data }: { data: { x: number } }) => useAutosave({ data, saveFn, delay: 50, maxRetries: 2 }),
      { initialProps: { data: { x: 1 } } },
    );
    rerender({ data: { x: 2 } });

    // Initial debounce fires at t=50; with maxRetries=2 we expect exactly
    // 1 initial + 2 retries = 3 saveFn calls. Backoff is 2^retry * 1000ms,
    // so retries land roughly at t=2050 and t=6050. Advance well past that.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(saveFn).toHaveBeenCalledTimes(3);
    expect(result.current.state).toBe('error');
    expect(result.current.error?.message).toBe('save failed');
  });

  it('retrySave resets retry counter and re-attempts', async () => {
    const saveFn = vi
      .fn<(d: unknown) => Promise<void>>()
      .mockRejectedValueOnce(new Error('first fail'))
      .mockResolvedValueOnce(undefined);

    const { result, rerender } = renderHook(
      ({ data }: { data: { x: number } }) => useAutosave({ data, saveFn, delay: 50, maxRetries: 0 }),
      { initialProps: { data: { x: 1 } } },
    );
    rerender({ data: { x: 2 } });

    // Initial save -> fails -> goes to error (maxRetries=0)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60);
    });
    expect(result.current.state).toBe('error');

    // Manually retry: should call saveFn again and succeed.
    await act(async () => {
      result.current.retrySave();
      // flush the microtask queue (no setTimeout in retrySave path)
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(saveFn).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe('saved');
  });

  it('wraps thrown non-Error values into Error', async () => {
    const saveFn = vi
      .fn<(d: unknown) => Promise<void>>()
      .mockRejectedValue('string error');

    const { result, rerender } = renderHook(
      ({ data }: { data: { x: number } }) => useAutosave({ data, saveFn, delay: 10, maxRetries: 0 }),
      { initialProps: { data: { x: 1 } } },
    );
    rerender({ data: { x: 2 } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20);
    });
    expect(result.current.state).toBe('error');
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('string error');
  });

  it('establishes a fresh baseline when autosave becomes enabled after hydration', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined);
    const { rerender } = renderHook(
      ({ data, enabled }: { data: { x: number }; enabled: boolean }) =>
        useAutosave({ data, enabled, saveFn, delay: 100 }),
      { initialProps: { data: { x: 1 }, enabled: false } },
    );

    rerender({ data: { x: 2 }, enabled: false });
    rerender({ data: { x: 2 }, enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(saveFn).not.toHaveBeenCalled();

    rerender({ data: { x: 3 }, enabled: true });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(saveFn).toHaveBeenCalledWith({ x: 3 });
  });
});
