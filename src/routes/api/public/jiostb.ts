import { createFileRoute } from "@tanstack/react-router";

const h = async ({ request }: { request: Request }) => {
  const { handlePlaylist } = await import("@/lib/playlist-handler.server");
  return handlePlaylist(request);
};

export const Route = createFileRoute("/api/public/jiostb")({
  server: { handlers: { GET: h, HEAD: h, OPTIONS: h } },
});
