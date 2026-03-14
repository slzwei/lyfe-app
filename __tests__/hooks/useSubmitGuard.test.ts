import { renderHook, act } from '@testing-library/react-native';
import { useSubmitGuard } from '@/hooks/useSubmitGuard';

describe('useSubmitGuard', () => {
    it('starts with isSubmitting = false', () => {
        const { result } = renderHook(() => useSubmitGuard());
        expect(result.current.isSubmitting).toBe(false);
    });

    it('sets isSubmitting true during execution and resets after', async () => {
        const { result } = renderHook(() => useSubmitGuard());

        let resolve: (v: string) => void;
        const fn = jest.fn(
            () =>
                new Promise<string>((r) => {
                    resolve = r;
                }),
        );

        let guardPromise: Promise<string | undefined>;
        act(() => {
            guardPromise = result.current.guard(fn);
        });

        // While the promise is pending, isSubmitting should be true
        expect(result.current.isSubmitting).toBe(true);

        await act(async () => {
            resolve!('done');
            await guardPromise!;
        });

        expect(result.current.isSubmitting).toBe(false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('prevents double-call while submitting', async () => {
        const { result } = renderHook(() => useSubmitGuard());

        let resolve: () => void;
        const fn = jest.fn(
            () =>
                new Promise<void>((r) => {
                    resolve = r;
                }),
        );

        let firstPromise: Promise<void | undefined>;
        act(() => {
            firstPromise = result.current.guard(fn);
        });

        // Second call should be no-op
        let secondResult: void | undefined;
        act(() => {
            secondResult = result.current.guard(fn) as any;
        });

        // fn should only have been called once
        expect(fn).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolve!();
            await firstPromise!;
        });

        expect(result.current.isSubmitting).toBe(false);
    });

    it('resets isSubmitting after error', async () => {
        const { result } = renderHook(() => useSubmitGuard());

        const error = new Error('test error');
        const fn = jest.fn(() => Promise.reject(error));

        await act(async () => {
            try {
                await result.current.guard(fn);
            } catch {
                // expected
            }
        });

        expect(result.current.isSubmitting).toBe(false);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('returns the value from the guarded function', async () => {
        const { result } = renderHook(() => useSubmitGuard());

        let guardResult: string | undefined;
        await act(async () => {
            guardResult = await result.current.guard(() => Promise.resolve('hello'));
        });

        expect(guardResult).toBe('hello');
    });

    it('returns undefined when guard rejects a double-call', async () => {
        const { result } = renderHook(() => useSubmitGuard());

        let resolve: () => void;
        const fn = jest.fn(
            () =>
                new Promise<void>((r) => {
                    resolve = r;
                }),
        );

        let firstPromise: Promise<void | undefined>;
        act(() => {
            firstPromise = result.current.guard(fn);
        });

        let secondResult: void | undefined;
        await act(async () => {
            secondResult = await result.current.guard(fn);
        });

        expect(secondResult).toBeUndefined();

        await act(async () => {
            resolve!();
            await firstPromise!;
        });
    });
});
