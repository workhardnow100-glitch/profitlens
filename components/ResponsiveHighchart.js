// components/ResponsiveHighchart.js
import dynamic from "next/dynamic";

const HighchartsReact = dynamic(() => import("highcharts-react-official"), { ssr: false });

export default function ResponsiveHighchart({ highcharts, options }) {
  return (
    <div className="w-full bg-white/70 rounded-lg border shadow-sm p-4 sm:p-6 mb-6">
      {highcharts && options ? (
        <HighchartsReact highcharts={highcharts} options={options} />
      ) : (
        <p className="text-slate-500">Preparing chart...</p>
      )}
    </div>
  );
}
