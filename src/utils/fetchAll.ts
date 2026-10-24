// types.ts
export interface PageResult {
  pageNo: number;
  pageSize: number;
  total: number;
}

// export interface ApiResponse<T> {
//   code: string;
//   message: string;
//   data: {
//     page: PageResult;
//     items: T[];
//   };
//   timestamp: number;
//   trace?: {
//     traceId: string;
//   };
// }

// 通用并发分页获取函数,
export async function fetchAllPagesConcurrent<T, P extends Record<string, any>>(
  fetchFn: (
    params: P & { pageNo: number; pageSize: number },
  ) => Promise<{ page: PageResult; items: T[] }>,
  baseParams: P,
  pageSize: number = 50,
  concurrency: number = 3,
): Promise<T[]> {
  // 先获取第一页以确定总量
  const firstResponse = await fetchFn({
    ...baseParams,
    pageNo: 1,
    pageSize,
  });

  const total = firstResponse?.page?.total;
  const totalPages = Math.ceil(total / pageSize);

  // 如果只有一页或没有数据，直接返回
  if (totalPages <= 1 || total === 0 || !firstResponse?.hasMore) {
    return firstResponse.items;
  }

  // 准备所有页面的请求（从第2页开始）
  const pageRequests: Promise<{ page: PageResult; items: T[] }>[] = [];
  for (let pageNo = 2; pageNo <= totalPages; pageNo++) {
    pageRequests.push(
      fetchFn({
        ...baseParams,
        pageNo,
        pageSize,
      }),
    );
  }

  // 分批并发执行
  const allItems = [...firstResponse.items];
  for (let i = 0; i < pageRequests.length; i += concurrency) {
    const batch = pageRequests.slice(i, i + concurrency);
    const responses = await Promise.all(batch);
    responses.forEach((response) => {
      allItems.push(...response.items);
    });
  }

  return allItems;
}
