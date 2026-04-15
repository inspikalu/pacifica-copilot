import { notFound } from "next/navigation";
import { getSnapshotData } from "@/server/queries/dashboard";
import { DashboardConsole } from "@/components/dashboard/dashboard-console";

interface ReplayPageProps {
  params: Promise<{ snapshotId: string }>;
}

export default async function ReplayPage({ params }: ReplayPageProps) {
  const { snapshotId } = await params;
  const data = await getSnapshotData(snapshotId);

  if (!data) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <DashboardConsole data={data} isReadOnly={true} isReplay={true} />
    </div>
  );
}
