import { SealedRollDetail } from "@/components/roll/sealed-roll-detail";

export default async function RollPage({ params }: PageProps<"/roll/[id]">) {
  const { id } = await params;
  return <SealedRollDetail rollId={id} />;
}
