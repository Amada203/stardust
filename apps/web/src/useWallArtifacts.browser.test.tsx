import type { EnvironmentId } from "@t3tools/contracts";
import { expect, it, vi } from "vite-plus/test";
import { render } from "../test/render";
import { loadWallArtifacts } from "./lib/artifactWallClient";
import { useWallArtifacts } from "./useWallArtifacts";

vi.mock("./lib/artifactWallClient", () => ({ loadWallArtifacts: vi.fn() }));
vi.mock("./state/session", () => ({ usePreparedConnection: () => null }));

function Reader({ threadId }: { threadId: string }) {
  const state = useWallArtifacts("environment-local" as EnvironmentId, threadId);
  return <output>{state.loading ? "loading" : (state.error ?? state.artifacts.length)}</output>;
}

function Readers({
  second = true,
  threadId = "shared-collection",
}: {
  second?: boolean;
  threadId?: string;
}) {
  return (
    <div>
      <Reader key="main" threadId={threadId} />
      {second ? <Reader key="wall" threadId={threadId} /> : null}
    </div>
  );
}

it("shares the pending request and cancels only after the final consumer leaves", async () => {
  const load = vi.mocked(loadWallArtifacts).mockReset();
  load.mockImplementation(() => new Promise(() => {}));
  await using screen = await render(
    <Readers />,
    // Only the collection subscription is exercised; it has no routing dependency.
    { router: false },
  );
  expect(load).toHaveBeenCalledTimes(1);
  const signal = load.mock.calls[0]![3];
  expect(signal.aborted).toBe(false);
  await screen.rerender(<Readers second={false} />);
  expect(load).toHaveBeenCalledTimes(1);
  expect(signal.aborted).toBe(false);
  await screen.rerender(<Readers second={false} threadId="another-collection" />);
  expect(signal.aborted).toBe(true);
  expect(load).toHaveBeenCalledTimes(2);
  expect(load.mock.calls[1]![1]).toBe("another-collection");
});
