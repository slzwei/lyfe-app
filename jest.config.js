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
    ],
    coverageThreshold: {
        // Current: stmts 63.2%, branches 55.6%, funcs 58.3%, lines 64.2%
        // Set ~2% below current to catch regressions
        global: {
            statements: 61,
            branches: 53,
            functions: 56,
            lines: 62,
        },
    },
};
