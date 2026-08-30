// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AutoCleanupTrigger } from "./auto-cleanup-trigger";

describe("AutoCleanupTrigger", () => {
  it("dispatches once with keepalive and swallows network failure", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", request);
    render(<AutoCleanupTrigger />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith("/api/admin/cleanup/auto", { method: "POST", keepalive: true });
  });
});
