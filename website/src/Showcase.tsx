import WorldMap from "react-svg-worldmap";
import { createRegionsDetailProvider } from "react-svg-worldmap-regions";
import { gdpData } from "./countryData";

// Create the provider once. Each country's states and provinces download
// the first time you zoom in on it, and never before.
const regions = createRegionsDetailProvider();

export default function Showcase(): JSX.Element {
  return (
    <WorldMap
      title="GDP per capita"
      data={gdpData}
      valuePrefix="$"
      color="#e65100"
      size="responsive"
      // Blue water, slate borders, Equal Earth's true-to-area shapes.
      theme="atlas"
      projection="equalEarth"
      // Drag, scroll or double-click to zoom. Country names appear where
      // they fit, and borders sharpen as you zoom in.
      zoom
      // Zoomed in far enough, the map draws the regions of the countries in
      // view.
      detailLevel="regions"
      detailProvider={regions}
      frame
    />
  );
}
