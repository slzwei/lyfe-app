/**
 * Auto-mock for lib/supabase.ts
 * Jest automatically uses this when tests call jest.mock('@/lib/supabase')
 * or jest.mock('./supabase') from within lib/
 *
 * Query tracking: every chained method call (.select, .eq, .in, .order, etc.)
 * is recorded in __calls so tests can assert the actual query shape.
 *
 * Usage:
 *   const chain = mockSupa.__getChain('leads');
 *   chain.__resolveWith({ data: [...], error: null });
 *   await fetchLeads(userId);
 *   expect(chain.__calls).toContainEqual({ method: 'eq', args: ['assigned_to', userId] });
 *   expect(chain.__calls).toContainEqual({ method: 'select', args: ['*'] });
 */

interface ChainCall {
    method: string;
    args: any[];
}

interface ChainMock {
    __resolveWith: (val: any) => void;
    __calls: ChainCall[];
    __resetCalls: () => void;
    [key: string]: any;
}

function createChainMock(resolveValue: any = { data: null, error: null }): ChainMock {
    let _resolve = resolveValue;
    const _calls: ChainCall[] = [];

    const handler: ProxyHandler<Record<string, any>> = {
        get(target, prop: string) {
            if (prop === '__resolveWith') {
                return (val: any) => {
                    _resolve = val;
                };
            }
            if (prop === '__calls') {
                return _calls;
            }
            if (prop === '__resetCalls') {
                return () => {
                    _calls.length = 0;
                };
            }
            if (prop === 'then') {
                return (onFulfilled: any) => Promise.resolve(_resolve).then(onFulfilled);
            }
            if (!target[`_fn_${prop}`]) {
                target[`_fn_${prop}`] = jest.fn((...args: any[]) => {
                    _calls.push({ method: prop, args });
                    return new Proxy({}, handler);
                });
            }
            return target[`_fn_${prop}`];
        },
    };

    return new Proxy(
        {
            __resolveWith: (val: any) => {
                _resolve = val;
            },
        },
        handler,
    ) as ChainMock;
}

const chains: Record<string, ChainMock> = {};

export const supabase: any = {
    from: jest.fn((table: string) => {
        if (!chains[table]) {
            chains[table] = createChainMock();
        }
        return chains[table];
    }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
        getSession: jest.fn().mockResolvedValue({ data: { session: { access_token: 'mock-token' } } }),
        signInWithOtp: jest.fn().mockResolvedValue({ error: null }),
        verifyOtp: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
        signOut: jest.fn().mockResolvedValue({ error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    storage: {
        from: jest.fn(() => ({
            upload: jest.fn().mockResolvedValue({ error: null }),
            remove: jest.fn().mockResolvedValue({ error: null }),
            getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/file.pdf' } }),
            createSignedUrl: jest
                .fn()
                .mockResolvedValue({ data: { signedUrl: 'https://example.com/file.pdf?token=mock' }, error: null }),
        })),
    },
    functions: {
        invoke: jest.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
    channel: jest.fn(() => ({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
    })),
    removeChannel: jest.fn(),
    __getChain: (table: string) => {
        if (!chains[table]) chains[table] = createChainMock();
        return chains[table];
    },
    __resetChains: () => {
        Object.keys(chains).forEach((k) => delete chains[k]);
    },
};
