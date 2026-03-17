import { useRouter } from 'expo-router';

type TabRoute =
    | '/(tabs)/home'
    | '/(tabs)/home/analytics'
    | '/(tabs)/home/pipeline'
    | '/(tabs)/home/notifications'
    | `/(tabs)/home/lead/${string}`
    | '/(tabs)/exams'
    | `/(tabs)/exams/take/${string}`
    | `/(tabs)/exams/results/${string}`
    | '/(tabs)/exams/study'
    | '/(tabs)/events'
    | `/(tabs)/events/${string}`
    | '/(tabs)/events/create'
    | '/(tabs)/leads'
    | `/(tabs)/leads/${string}`
    | '/(tabs)/leads/add'
    | '/(tabs)/candidates'
    | `/(tabs)/candidates/${string}`
    | '/(tabs)/team'
    | `/(tabs)/team/agent/${string}`
    | `/(tabs)/team/candidate/${string}`
    | '/(tabs)/team/add-candidate'
    | '/(tabs)/profile'
    | '/(tabs)/profile/notifications'
    | '/(tabs)/profile/privacy'
    | '/(tabs)/profile/terms'
    | '/(tabs)/pa'
    | `/(tabs)/pa/candidate/${string}`
    | `/(tabs)/pa/event/${string}`
    | '/(tabs)/pa/event/create'
    | '/(tabs)/pa/add-candidate'
    | '/(tabs)/admin';

export type { TabRoute };

export function useTypedRouter() {
    const router = useRouter();
    return {
        push: (route: TabRoute | (string & {})) => router.push(route as any),
        replace: (route: TabRoute | (string & {})) => router.replace(route as any),
        back: () => router.back(),
    };
}
