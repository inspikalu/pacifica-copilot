import { DashboardConsole } from "@/components/dashboard/dashboard-console";
import { getDashboardData } from "@/server/queries/dashboard";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getSession();
  
  if (!session) {
    redirect("/onboard");
  }

  const data = await getDashboardData(session.userId);

  if (!data) {
    // Session exists but no account linked yet
    redirect("/onboard");
  }

  return <DashboardConsole data={data} />;
}
