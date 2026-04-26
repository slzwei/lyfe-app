import CandidateListScreen from '@/components/CandidateListScreen';
import { useViewMode } from '@/contexts/ViewModeContext';

export default function CandidatesScreen() {
    const { viewMode, canToggle } = useViewMode();
    const isManagerView = canToggle && viewMode === 'manager';

    return (
        <CandidateListScreen
            candidateRoute={(id) => `/(tabs)/candidates/${id}`}
            addRoute="/(tabs)/candidates/add-candidate"
            isManagerView={isManagerView}
        />
    );
}
