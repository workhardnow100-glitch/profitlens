import Highcharts from "highcharts";
import Highcharts3D from "highcharts/highcharts-3d";
import HighchartsReact from "highcharts-react-official";
import { useState, useMemo } from "react";

Highcharts3D(Highcharts);

export default function TransactionsDonut({ transactions, view = "month" }) {
  // Group transactions by category/client/profit-loss
  const breakdown = useMemo(() => {
    const data = {};

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount) || 0;
      const category = tx.amount > 0 ? "Income" : "Expense";
      const key = `${category} - ${tx.category || "Uncategorised"}`;
      data[key] = (data[key] || 0) + Math.abs(amount);
    });

    return Object.entries(data).map(([name, y]) => ({ name, y }));
  }, [transactions, view]);

  const options = {
    chart: {
      type: "pie",
      options3d: { enabled: true, alpha: 45, beta: 0 },
    },
    title: { text: `Transactions Breakdown (${view})` },
    plotOptions: {
      pie: {
        innerSize: 100,
        depth: 45,
        dataLabels: { enabled: true, format: "{point.name}: £{point.y:.2f}" },
      },
    },
    series: [{ name: "Amount", data: breakdown }],
  };

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
