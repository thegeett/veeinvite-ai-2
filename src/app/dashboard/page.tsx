import { redirect } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { createClient } from '@/lib/supabase/server';
import { mapCoupleRow } from '@/lib/db/mappers';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth/login?next=/dashboard');
  }

  const { data: coupleRow } = await supabase
    .from('couples')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!coupleRow) {
    redirect('/onboarding');
  }

  const couple = mapCoupleRow(coupleRow);
  if (!couple) {
    redirect('/onboarding');
  }

  return <DashboardShell initialCouple={couple!} />;
}
