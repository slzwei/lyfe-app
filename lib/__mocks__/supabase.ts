/**
 * Auto-mock for lib/supabase.ts
 * Jest automatically uses this when tests call jest.mock('@/lib/supabase')
 * or jest.mock('./supabase') from within lib/
 */

function createChainMock(resolveValue: any = { data: null, error: null }) {
    let _resolve = resolveValue;

    const handler: ProxyHandler<Record<string, any>> = {
        get(target, prop: string) {
            if (prop === '__resolveWith') {
                return (val: any) => {
                    _resolve = val;
                };
            }
            if (prop === 'then') {
                return (onFulfilled: any) => Promise.resolve(_resolve).then(onFulfilled);
            }
            if (!target[`_fn_${prop}`]) {
                target[`_fn_${prop}`] = jest.fn(() => new Proxy({}, handler));
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
    );
}

const chains: Record<string, any> = {};

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
