import type { PaginationFilters, PaginationOptions } from '@/types';

interface PaginateArgs {
  options?: PaginationOptions;
  filters?: PaginationFilters;
  omit?: string[];
  include?: Record<string, any>;
}

async function paginate<T>(this: any, args: PaginateArgs) {
  const { options = {}, filters = {}, include = {}, omit = [] } = args;

  const page = Number(options.page) || 1;
  const limit = Number(options.limit) || 10;
  const offset = (page - 1) * limit;

  const where: Record<string, any> = { ...filters };

  // Handle Array Filters (comma separated strings)
  Object.keys(where).forEach((key) => {
    const value = where[key];
    if (typeof value === 'string' && value.includes(',')) {
      where[key] = { in: value.split(',').map((v) => v.trim()) };
    }
  });

  // Search Logic (Partial match)
  if (where.search) {
    const searchStr = where.search as string;
    delete where.search;

    const firstColonIndex = searchStr.indexOf(':');
    if (firstColonIndex !== -1) {
      const key = searchStr.substring(0, firstColonIndex);
      const value = searchStr.substring(firstColonIndex + 1);

      where[key] = {
        contains: value,
        mode: 'insensitive',
      };
    }
  }

  // Build sorting criteria from query string
  let sort: Record<string, 'asc' | 'desc'>[];
  if (options.sortBy) {
    const sortingCriteria = [] as any;
    options.sortBy.split(',').forEach((sortOption) => {
      const [key, order] = sortOption.split(':');
      sortingCriteria.push({ [key]: order === 'desc' ? 'desc' : 'asc' });
    });
    sort = sortingCriteria;
  } else {
    sort = [{ createdAt: 'asc' }];
  }

  // Handle omitted fields, Prisma 6+
  const omitOptions: Record<string, boolean> = {};
  omit?.forEach((opt: string) => {
    omitOptions[opt] = true;
  });

  // Fetch paginated data with the sorting criteria
  const [results, totalRecords] = await Promise.all([
    this.findMany({
      where,
      include,
      take: limit,
      skip: offset,
      orderBy: sort,
      omit: omitOptions,
    }),
    this.count({ where }),
  ]);

  const totalPages = Math.ceil(totalRecords / limit);

  return {
    results: results as T[],
    page,
    limit,
    totalRecords,
    totalPages,
  };
}

export default paginate;
