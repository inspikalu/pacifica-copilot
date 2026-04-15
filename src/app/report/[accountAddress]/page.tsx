import { notFound } from "next/navigation";
import { DashboardConsole } from "@/components/dashboard/dashboard-console";
import { getReportData } from "@/server/queries/dashboard";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { accountAddress: string } }) {
  const data = await getReportData(params.accountAddress);

  if (!data) {
    return notFound();
  }

  return <DashboardConsole data={data} isReadOnly={true} />;
}
