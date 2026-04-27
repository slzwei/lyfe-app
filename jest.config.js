module.exports = {
    preset: 'jest-expo/ios',
    setupFilesAfterEnv: ['./jest.setup.js'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|expo-router)',
    ],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/.claude/',
        '\\.android\\.test\\.',
        // useLastSeen.ts is WIP/uncommitted — tests reference a module that
        // doesn't exist on main. Re-enable once the hook lands.
        '__tests__/hooks/useLastSeen\\.test\\.ts',
        '__tests__/screens/RootLayout\\.test\\.tsx',
    ],
    modulePathIgnorePatterns: ['<rootDir>/.claude/'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/$1',
        '^@expo/vector-icons$': '<rootDir>/__tests__/mocks/vectorIcons.js',
        '^expo-crypto$': '<rootDir>/__tests__/mocks/expo-crypto.js',
        '^@react-native-community/netinfo$': '<rootDir>/__tests__/mocks/netinfo.js',
    },
    collectCoverageFrom: [
        'lib/**/*.ts',
        'hooks/**/*.ts',
        'contexts/**/*.tsx',
        'components/**/*.tsx',
        'constants/**/*.ts',
        'app/**/*.tsx',
        '!**/*.d.ts',
        '!lib/supabase.ts', // Module-level createClient() — mocked globally, tested via __tests__/lib/supabase.test.ts
        '!lib/leads/index.ts', // Barrel re-export — no logic
        '!lib/recruitment/index.ts', // Barrel re-export — no logic
        '!lib/offline/index.ts', // Barrel re-export — no logic
    ],
    coverageThreshold: {
        // Current: stmts 70.38%, branches 61.99%, funcs 64.10%, lines 71.61%
        // Set within 0.5% of current to catch further regressions while keeping
        // CI honest — raise these as suite expands. Phase D will add notification
        // deep-link + reassign flow tests; phase F will add edge-function contracts.
        global: {
            statements: 70,
            branches: 61,
            functions: 64,
            lines: 71,
        },
    },
};
