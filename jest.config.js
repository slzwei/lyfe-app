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
        '!**/*.d.ts',
    ],
    coverageThreshold: {
        global: {
            statements: 65,
            branches: 50,
            functions: 65,
            lines: 65,
        },
    },
};
