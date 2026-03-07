import { Topbar } from '@/components/layout/topbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen } from 'lucide-react';
import Link from 'next/link';

export default function TrainingPage() {
  return (
    <>
      <Topbar title="Training" />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <GraduationCap className="h-5 w-5" />
                Exam Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Create and manage exam papers, questions, and review attempt results.
              </p>
              <Button asChild size="sm">
                <Link href="/exams">Go to Exams</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-5 w-5" />
                Study Modules
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Training module management will be available when the study feature is built on the mobile app. Currently, the mobile app lists study modules but detailed chapter content is not yet implemented.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
