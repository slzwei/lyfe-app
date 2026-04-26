import { useRouter } from 'expo-router';

type TabRoute =
    | '/(tabs)/home'
    | '/(tabs)/home/analytics'
    | '/(tabs)/home/pipeline'
    | '/(tabs)/home/notifications'
    | `/(tabs)/home/lead/${string}`
    | `/(tabs)/home/event/${string}`
    | '/(tabs)/exams'
    | `/(tabs)/exams/take/${string}`
    | `/(tabs)/exams/results/${string}`
    | `/(tabs)/exams/results/enneagram/${string}`
    | `/(tabs)/exams/results/vark/${string}`
    | `/(tabs)/exams/results/disc/${string}`
    | `/(tabs)/exams/disc`
    | `/(tabs)/exams/exam/${string}`
    | '/(tabs)/exams/study'
    | '/(tabs)/events'
    | `/(tabs)/events/${string}`
    | '/(tabs)/events/create'
    | '/(tabs)/leads'
    | `/(tabs)/leads/${string}`
    | '/(tabs)/leads/add'
    | '/(tabs)/candidates'
    | `/(tabs)/candidates/${string}`
    | `/(tabs)/candidates/progress/${string}`
    | '/(tabs)/team'
    | `/(tabs)/team/agent/${string}`
    | `/(tabs)/team/manager/${string}`
    | `/(tabs)/team/candidate/${string}`
    | `/(tabs)/team/lead/${string}`
    | '/(tabs)/team/add-candidate'
    | '/(tabs)/profile'
    | '/(tabs)/profile/notifications'
    | '/(tabs)/profile/privacy'
    | '/(tabs)/profile/terms'
    | `/(tabs)/profile/results/vark/${string}`
    | `/(tabs)/profile/results/enneagram/${string}`
    | `/(tabs)/profile/results/disc/${string}`
    | `/(tabs)/profile/results/${string}`
    | `/(tabs)/profile/take/${string}`
    | '/(tabs)/roadmap'
    | `/(tabs)/roadmap/exam/${string}`
    | `/(tabs)/roadmap/results/${string}`
    | `/(tabs)/roadmap/results/enneagram/${string}`
    | `/(tabs)/roadmap/results/vark/${string}`
    | `/(tabs)/roadmap/results/disc/${string}`
    | `/(tabs)/roadmap/module/${string}`
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
        // @ts-expect-error — Expo Router Href type doesn't accept dynamic template strings
        push: (route: TabRoute | (string & {})) => router.push(route),
        // @ts-expect-error — Expo Router Href type doesn't accept dynamic template strings
        replace: (route: TabRoute | (string & {})) => router.replace(route),
        back: () => router.back(),
    };
}
