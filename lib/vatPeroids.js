export function getQuarterPeriods(year) {
  return [
    { start: `${year}-01-01`, end: `${year}-03-31` },
    { start: `${year}-04-01`, end: `${year}-06-30` },
    { start: `${year}-07-01`, end: `${year}-09-30` },
    { start: `${year}-10-01`, end: `${year}-12-31` },
  ];
}
