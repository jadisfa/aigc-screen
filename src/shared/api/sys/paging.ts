export type PageSearchParamsInput = {
  pageNo: number;
  pageSize: number;
  total?: number;
};

export function buildPageSearchParams(params: PageSearchParamsInput): URLSearchParams {
  const qs = new URLSearchParams({
    pageNo: String(params.pageNo),
    pageSize: String(params.pageSize),
  });
  if (typeof params.total === "number") {
    qs.set("total", String(params.total));
  }
  return qs;
}
