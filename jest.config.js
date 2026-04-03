module.exports = {
    preset: 'jest-expo/ios',
    setupFilesAfterEnv: ['./jest.setup.js'],
    transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@supabase/.*|expo-router)',
    ],
    testPathIgnorePatterns: ['/node_modules/', '/.claude/', '\\.android\\.test\\.'],
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
    ],
    coverageThreshold: {
        // Current: stmts 82.2%, branches 72.8%, funcs 73.4%, lines 84.0%
        // Set ~2% below current to catch regressions
        global: {
            statements: 80,
            branches: 70,
            functions: 71,
            lines: 82,
        },
    },
};
