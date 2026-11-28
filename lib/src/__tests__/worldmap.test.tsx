import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import WorldMap from "react-svg-worldmap";
import type { DetailProvider } from "react-svg-worldmap";
import { createRegionsDetailProvider } from "../index.js";

vi.mock("react-path-tooltip", () => ({ PathTooltip: () => null }));

const DATA = [{ country: "us" as const, value: 1 }];
const regionPaths = (container: HTMLElement) =>
  container.querySelectorAll('[data-map-sublayer="regions"] path');

function spyOn(provider: DetailProvider) {
  return { ...provider, loadRegions: vi.fn(provider.loadRegions) };
}

describe("WorldMap with the regions provider", () => {
  it("renders the same map without regions as with regions zoomed out", () => {
    const plain = render(<WorldMap data={DATA} size={640} zoom />);
    const provider = spyOn(createRegionsDetailProvider());
    const withRegions = render(
      <WorldMap
        data={DATA}
        size={640}
        zoom
        detailLevel="regions"
        detailProvider={provider}
      />,
    );
    expect(withRegions.container.innerHTML).toBe(plain.container.innerHTML);
    expect(provider.loadRegions).not.toHaveBeenCalled();
  });

  it("loads regions only once zoomed in, for the countries in view", async () => {
    const provider = spyOn(createRegionsDetailProvider());
    const { container } = render(
      <WorldMap
        data={DATA}
        size={640}
        zoom={{ initialScale: 2 }}
        detailLevel="regions"
        detailProvider={provider}
      />,
    );
    await act(() => Promise.resolve());
    expect(provider.loadRegions).not.toHaveBeenCalled();
    expect(regionPaths(container)).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    // Decoding a large country takes a moment.
    await waitFor(
      () => expect(regionPaths(container).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    const asked = provider.loadRegions.mock.calls.map(([code]) => code);
    // Zooming in from the top-left corner shows North America and Russia.
    expect(asked).toEqual(expect.arrayContaining(["US", "CA", "RU"]));
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.length).toBeLessThan(175);
    const drawn = [...regionPaths(container)].map((path) =>
      path.getAttribute("data-country-code"),
    );
    for (const code of drawn) expect(asked).toContain(code);
  });

  it("draws only the allowed countries", async () => {
    const provider = spyOn(createRegionsDetailProvider({ countries: ["US"] }));
    const { container } = render(
      <WorldMap
        data={DATA}
        size={640}
        zoom={{ initialScale: 2 }}
        detailLevel="regions"
        detailProvider={provider}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    // Decoding a large country takes a moment.
    await waitFor(
      () => expect(regionPaths(container).length).toBeGreaterThan(0),
      { timeout: 5000 },
    );
    for (const path of regionPaths(container))
      expect(path.getAttribute("data-country-code")).toBe("US");
    expect(provider.loadRegions.mock.calls.map(([code]) => code)).toEqual([
      "US",
    ]);
  });
});
