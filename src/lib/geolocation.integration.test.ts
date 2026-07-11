import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requestBestCurrentPosition, type LocationCaptureResult } from './geo';

type PositionSuccess = (position: GeolocationPosition) => void;
type PositionFailure = (error: GeolocationPositionError) => void;

describe('high-accuracy geolocation capture', () => {
  let success: PositionSuccess;
  let failure: PositionFailure;
  const clearWatch = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', globalThis);
    vi.stubGlobal('navigator', {
      geolocation: {
        watchPosition: (onSuccess: PositionSuccess, onFailure: PositionFailure, options: PositionOptions) => {
          success = onSuccess;
          failure = onFailure;
          expect(options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
          return 7;
        },
        clearWatch,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearWatch.mockReset();
  });

  it('keeps watching after a weak first result and returns the improved reading', () => {
    const results: LocationCaptureResult[] = [];
    requestBestCurrentPosition({
      purpose: 'customer',
      waitMs: 8000,
      onResult: (value) => { results.push(value); },
      onError: () => undefined,
    });

    success(position(36.37, 6.62, 120));
    expect(results).toHaveLength(0);
    success(position(36.365, 6.6147, 18));
    expect(results).toHaveLength(0);
    vi.advanceTimersByTime(4000);
    expect(results[0]?.accepted).toBe(true);
    expect(results[0]?.point.accuracy).toBe(18);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('returns the best weak reading after the improvement window for manual adjustment', () => {
    const results: LocationCaptureResult[] = [];
    requestBestCurrentPosition({
      purpose: 'restaurant',
      waitMs: 8000,
      onResult: (value) => { results.push(value); },
      onError: () => undefined,
    });
    success(position(36.365, 6.6147, 95));
    vi.advanceTimersByTime(8000);
    expect(results[0]?.accepted).toBe(false);
    expect(results[0]?.point.accuracy).toBe(95);
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('surfaces permission denial without retaining a watcher', () => {
    const onError = vi.fn();
    requestBestCurrentPosition({
      purpose: 'customer',
      onResult: () => undefined,
      onError,
    });
    failure({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    expect(onError).toHaveBeenCalledOnce();
  });

  it('keeps waiting after a transient unavailable signal and accepts a later GPS fix', () => {
    const results: LocationCaptureResult[] = [];
    const onError = vi.fn();
    requestBestCurrentPosition({
      purpose: 'customer',
      waitMs: 8000,
      onResult: (value) => { results.push(value); },
      onError,
    });
    failure({ code: 2, message: 'warming up', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError);
    expect(onError).not.toHaveBeenCalled();
    success(position(36.365, 6.6147, 22));
    vi.advanceTimersByTime(4000);
    expect(results[0]?.accepted).toBe(true);
  });

  it('does not accept the first good reading before the refinement window', () => {
    const results: LocationCaptureResult[] = [];
    requestBestCurrentPosition({
      purpose: 'customer',
      waitMs: 8000,
      minWatchMs: 4000,
      onResult: (value) => { results.push(value); },
      onError: () => undefined,
    });
    success(position(36.365, 6.6147, 45));
    vi.advanceTimersByTime(3999);
    expect(results).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(results[0]?.point.accuracy).toBe(45);
  });
});

function position(lat: number, lng: number, accuracy: number): GeolocationPosition {
  return {
    coords: {
      latitude: lat,
      longitude: lng,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}
