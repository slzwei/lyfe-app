import { useContext } from 'react';
import { NetworkContext, type NetworkContextType } from '@/contexts/NetworkContext';

export function useNetworkStatus(): NetworkContextType {
    const context = useContext(NetworkContext);
    if (!context) {
        throw new Error('useNetworkStatus must be used within a NetworkProvider');
    }
    return context;
}
