// lib/highcharts.js
// ✅ Highcharts loader that NEVER runs on the server (SSR-safe)

let Highcharts = null;

if (typeof window !== "undefined") {
  // Load core library
  Highcharts = require("highcharts");

  // Load modules only in the browser
  require("highcharts/highcharts-more")(Highcharts);
  require("highcharts/highcharts-3d")(Highcharts);
  require("highcharts/modules/drilldown")(Highcharts);
  require("highcharts/modules/exporting")(Highcharts);
  require("highcharts/modules/export-data")(Highcharts);
  require("highcharts/modules/accessibility")(Highcharts);
  require("highcharts/modules/sankey")(Highcharts);
  require("highcharts/modules/organization")(Highcharts);
  require("highcharts/modules/sunburst")(Highcharts);
  require("highcharts/modules/heatmap")(Highcharts);
  require("highcharts/modules/treemap")(Highcharts);
}

export default Highcharts;
