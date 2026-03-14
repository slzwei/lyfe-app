module.exports = {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    useNetInfo: jest.fn().mockReturnValue({ isConnected: true, isInternetReachable: true }),
};
