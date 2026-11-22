import { EnvironmentId } from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";

vi.mock(import("~/assets/longLivedAssetUrls"), () => ({
  useLongLivedAssetUrl: (
    _environment: unknown,
    resource: import("@t3tools/contracts").AssetResource,
  ) =>
    resource._tag === "attachment" && resource.attachmentId === "missing"
      ? { _tag: "Failure", message: "Missing attachment" }
      : {
          _tag: "Success",
          url: "about:blank",
          expiresAt: Date.now() + 60 * 60_000,
        },
}));
vi.mock(import("~/assets/assetUrls"), async (importOriginal) => ({
  ...(await importOriginal()),
  useAssetUrlRefresh: () => async () => "about:blank",
}));

import { HtmlRenderFrame } from "./HtmlRenderFrame";

describe("HtmlRenderFrame", () => {
  it("reports leaving full screen when it unmounts while expanded", async () => {
    const onFullscreenChange = vi.fn();
    await using screen = await render(
      <HtmlRenderFrame
        environmentId={EnvironmentId.make("environment")}
        htmlRender={{ attachmentId: "attachment", title: "Report", height: 200 }}
        threadRef={undefined}
        onFullscreenChange={onFullscreenChange}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Open full screen" }));
    await expect.element(screen.getByRole("dialog")).toBeVisible();
    expect(onFullscreenChange).toHaveBeenLastCalledWith(true);

    await screen.unmount();
    expect(onFullscreenChange).toHaveBeenLastCalledWith(false);
  });
});

it("keeps a missing tall HTML attachment compact so adjacent history stays visible", async () => {
  await using screen = await render(
    <HtmlRenderFrame
      environmentId={EnvironmentId.make("environment")}
      htmlRender={{ attachmentId: "missing", title: "Missing report", height: 1800 }}
      threadRef={undefined}
    />,
  );
  await expect.element(screen.getByText("Unable to load Missing report")).toBeVisible();
  expect(
    screen
      .getByText("Unable to load Missing report")
      .element()
      .parentElement!.getBoundingClientRect().height,
  ).toBeLessThan(100);
});
