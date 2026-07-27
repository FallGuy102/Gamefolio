import { StudioApp } from "../../StudioApp";

export const dynamic = "force-dynamic";

export default async function GamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StudioApp initialView="game" initialGameId={id} />;
}
