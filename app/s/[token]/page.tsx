import { SharedEntry } from "../../SharedEntry";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <SharedEntry token={token} />;
}
