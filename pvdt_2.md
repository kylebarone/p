# Enterprise Pivot Table System with MUI/TanStack

Let me design a comprehensive system for dashboards with multiple pivot tables, supporting both OLAP and SQL data sources.

## 1. Core Type Definitions & Schemas

```typescript
// Config Schema
interface PivotConfig {
  id: string;
  rows: DimensionConfig[];
  columns: DimensionConfig[];
  values: MeasureConfig[];
  options?: PivotOptions;
}

interface DimensionConfig {
  field: string;
  label?: string;
  sortOrder?: 'asc' | 'desc';
  showSubtotals?: boolean;
}

interface MeasureConfig {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinct_count';
  label?: string;
  format?: 'number' | 'currency' | 'percentage';
  precision?: number;
}

interface PivotOptions {
  showRowTotals?: boolean;
  showColumnTotals?: boolean;
  showGrandTotal?: boolean;
  allowDrilldown?: boolean;
  conditionalFormatting?: ConditionalFormat[];
}

// Data Query Profile Schema
interface DataQueryProfile {
  id: string;
  type: 'olap' | 'sql';
  query: OLAPQuery | SQLQuery;
  refreshInterval?: number; // ms
  cache?: CacheConfig;
}

interface OLAPQuery {
  type: 'olap';
  cube: string;
  dimensions: string[];
  measures: string[];
  filters?: MDXFilter[];
  timeRange?: TimeRange;
}

interface SQLQuery {
  type: 'sql';
  query: string;
  parameters?: Record<string, any>;
  datasource: string;
}

interface CacheConfig {
  enabled: boolean;
  ttl: number; // seconds
  key?: string;
}

// Dashboard Schema
interface DashboardConfig {
  id: string;
  name: string;
  widgets: PivotWidget[];
  layout?: LayoutConfig;
  globalFilters?: FilterConfig[];
}

interface PivotWidget {
  id: string;
  pivotConfig: PivotConfig;
  dataQueryProfile: DataQueryProfile;
  position: { x: number; y: number; w: number; h: number };
  renderer?: 'tanstack' | 'mui';
}
```

## 2. Query Abstraction Layer

```typescript
// query-executor.ts
import { QueryClient } from '@tanstack/react-query';

interface QueryResult {
  data: any[];
  metadata: {
    fields: string[];
    types: Record<string, string>;
    rowCount: number;
  };
}

class QueryExecutor {
  private queryClient: QueryClient;
  
  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient;
  }

  async execute(profile: DataQueryProfile): Promise<QueryResult> {
    const cacheKey = this.getCacheKey(profile);
    
    return this.queryClient.fetchQuery({
      queryKey: [cacheKey],
      queryFn: () => this.executeQuery(profile),
      staleTime: profile.cache?.ttl ? profile.cache.ttl * 1000 : 0,
    });
  }

  private async executeQuery(profile: DataQueryProfile): Promise<QueryResult> {
    switch (profile.type) {
      case 'olap':
        return this.executeOLAP(profile.query as OLAPQuery);
      case 'sql':
        return this.executeSQL(profile.query as SQLQuery);
      default:
        throw new Error(`Unsupported query type: ${profile.type}`);
    }
  }

  private async executeOLAP(query: OLAPQuery): Promise<QueryResult> {
    // Convert OLAP query to MDX
    const mdx = this.buildMDX(query);
    
    const response = await fetch('/api/olap/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mdx, cube: query.cube }),
    });
    
    const result = await response.json();
    return this.normalizeOLAPResult(result);
  }

  private async executeSQL(query: SQLQuery): Promise<QueryResult> {
    const response = await fetch('/api/sql/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query.query,
        parameters: query.parameters,
        datasource: query.datasource,
      }),
    });
    
    const result = await response.json();
    return {
      data: result.rows,
      metadata: {
        fields: result.fields,
        types: result.types,
        rowCount: result.rows.length,
      },
    };
  }

  private buildMDX(query: OLAPQuery): string {
    const dimensions = query.dimensions.map(d => `[${d}]`).join(', ');
    const measures = query.measures.map(m => `[Measures].[${m}]`).join(', ');
    
    let mdx = `SELECT 
      { ${measures} } ON COLUMNS,
      { ${dimensions} } ON ROWS
    FROM [${query.cube}]`;
    
    if (query.filters && query.filters.length > 0) {
      const filterStr = query.filters.map(f => f.expression).join(' AND ');
      mdx += ` WHERE (${filterStr})`;
    }
    
    return mdx;
  }

  private normalizeOLAPResult(result: any): QueryResult {
    // Transform OLAP result to flat array format
    const flatData: any[] = [];
    
    // OLAP results typically come as multi-dimensional arrays
    // Flatten them to row-based format
    result.axes[1].forEach((row: any, rowIdx: number) => {
      const rowData: any = {};
      
      row.members.forEach((member: any, dimIdx: number) => {
        rowData[result.dimensions[dimIdx]] = member.caption;
      });
      
      result.axes[0].forEach((col: any, colIdx: number) => {
        const measure = col.members[0].caption;
        rowData[measure] = result.cells[rowIdx][colIdx].value;
      });
      
      flatData.push(rowData);
    });
    
    return {
      data: flatData,
      metadata: {
        fields: Object.keys(flatData[0] || {}),
        types: {},
        rowCount: flatData.length,
      },
    };
  }

  private getCacheKey(profile: DataQueryProfile): string {
    if (profile.cache?.key) {
      return profile.cache.key;
    }
    return `query-${profile.id}-${JSON.stringify(profile.query)}`;
  }
}

export default QueryExecutor;
```

## 3. Pivot Data Transformation Engine

```typescript
// pivot-engine.ts
interface PivotResult {
  structure: PivotStructure;
  totals: PivotTotals;
}

interface PivotStructure {
  rowHeaders: HeaderNode[];
  columnHeaders: HeaderNode[];
  cells: Map<string, CellValue>;
}

interface HeaderNode {
  label: string;
  path: string[];
  level: number;
  children?: HeaderNode[];
  isTotal?: boolean;
}

interface CellValue {
  value: number | null;
  formatted: string;
  metadata?: Record<string, any>;
}

interface PivotTotals {
  rowTotals: Map<string, Record<string, number>>;
  columnTotals: Map<string, Record<string, number>>;
  grandTotal: Record<string, number>;
}

class PivotEngine {
  transform(data: any[], config: PivotConfig): PivotResult {
    // Build aggregation map
    const aggregationMap = this.buildAggregationMap(data, config);
    
    // Extract unique row and column paths
    const rowPaths = this.extractPaths(data, config.rows);
    const columnPaths = this.extractPaths(data, config.columns);
    
    // Build hierarchical headers
    const rowHeaders = this.buildHeaders(rowPaths, config.rows);
    const columnHeaders = this.buildHeaders(columnPaths, config.columns);
    
    // Build cell map
    const cells = this.buildCells(aggregationMap, rowPaths, columnPaths, config);
    
    // Calculate totals
    const totals = this.calculateTotals(cells, rowPaths, columnPaths, config);
    
    return {
      structure: { rowHeaders, columnHeaders, cells },
      totals,
    };
  }

  private buildAggregationMap(
    data: any[],
    config: PivotConfig
  ): Map<string, Map<string, AggregateState>> {
    const map = new Map<string, Map<string, AggregateState>>();

    data.forEach(row => {
      const rowKey = config.rows.map(r => row[r.field] ?? 'null').join('|');
      const colKey = config.columns.map(c => row[c.field] ?? 'null').join('|');

      if (!map.has(rowKey)) {
        map.set(rowKey, new Map());
      }

      const colMap = map.get(rowKey)!;
      if (!colMap.has(colKey)) {
        colMap.set(colKey, this.createAggregateState(config.values));
      }

      const state = colMap.get(colKey)!;
      this.updateAggregateState(state, row, config.values);
    });

    return map;
  }

  private createAggregateState(measures: MeasureConfig[]): AggregateState {
    const state: AggregateState = {};
    
    measures.forEach(measure => {
      state[measure.field] = {
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        values: [],
      };
    });
    
    return state;
  }

  private updateAggregateState(
    state: AggregateState,
    row: any,
    measures: MeasureConfig[]
  ): void {
    measures.forEach(measure => {
      const value = Number(row[measure.field]) || 0;
      const agg = state[measure.field];
      
      agg.sum += value;
      agg.count += 1;
      agg.min = Math.min(agg.min, value);
      agg.max = Math.max(agg.max, value);
      
      if (measure.aggregation === 'distinct_count') {
        agg.values.push(value);
      }
    });
  }

  private extractPaths(data: any[], dimensions: DimensionConfig[]): string[][] {
    const pathSet = new Set<string>();
    
    data.forEach(row => {
      const path = dimensions.map(d => row[d.field] ?? 'null');
      pathSet.add(path.join('|'));
    });
    
    return Array.from(pathSet).map(p => p.split('|'));
  }

  private buildHeaders(paths: string[][], dimensions: DimensionConfig[]): HeaderNode[] {
    if (dimensions.length === 0) return [];
    
    const tree: HeaderNode[] = [];
    
    paths.forEach(path => {
      let currentLevel = tree;
      
      path.forEach((value, level) => {
        let node = currentLevel.find(n => n.label === value && n.level === level);
        
        if (!node) {
          node = {
            label: value,
            path: path.slice(0, level + 1),
            level,
            children: level < dimensions.length - 1 ? [] : undefined,
          };
          currentLevel.push(node);
        }
        
        if (node.children) {
          currentLevel = node.children;
        }
      });
    });
    
    return tree;
  }

  private buildCells(
    aggregationMap: Map<string, Map<string, AggregateState>>,
    rowPaths: string[][],
    columnPaths: string[][],
    config: PivotConfig
  ): Map<string, CellValue> {
    const cells = new Map<string, CellValue>();
    
    rowPaths.forEach(rowPath => {
      const rowKey = rowPath.join('|');
      
      columnPaths.forEach(colPath => {
        const colKey = colPath.join('|');
        const cellKey = `${rowKey}::${colKey}`;
        
        const aggState = aggregationMap.get(rowKey)?.get(colKey);
        
        if (aggState) {
          config.values.forEach(measure => {
            const state = aggState[measure.field];
            let value: number | null = null;
            
            switch (measure.aggregation) {
              case 'sum':
                value = state.sum;
                break;
              case 'avg':
                value = state.count > 0 ? state.sum / state.count : null;
                break;
              case 'count':
                value = state.count;
                break;
              case 'min':
                value = state.min === Infinity ? null : state.min;
                break;
              case 'max':
                value = state.max === -Infinity ? null : state.max;
                break;
              case 'distinct_count':
                value = new Set(state.values).size;
                break;
            }
            
            const measureKey = `${cellKey}::${measure.field}`;
            cells.set(measureKey, {
              value,
              formatted: this.formatValue(value, measure),
            });
          });
        }
      });
    });
    
    return cells;
  }

  private calculateTotals(
    cells: Map<string, CellValue>,
    rowPaths: string[][],
    columnPaths: string[][],
    config: PivotConfig
  ): PivotTotals {
    // Implementation for row totals, column totals, and grand total
    const rowTotals = new Map<string, Record<string, number>>();
    const columnTotals = new Map<string, Record<string, number>>();
    const grandTotal: Record<string, number> = {};
    
    // Calculate row totals
    if (config.options?.showRowTotals) {
      rowPaths.forEach(rowPath => {
        const rowKey = rowPath.join('|');
        const totals: Record<string, number> = {};
        
        config.values.forEach(measure => {
          let sum = 0;
          columnPaths.forEach(colPath => {
            const cellKey = `${rowKey}::${colPath.join('|')}::${measure.field}`;
            const cell = cells.get(cellKey);
            if (cell?.value !== null) {
              sum += cell.value;
            }
          });
          totals[measure.field] = sum;
        });
        
        rowTotals.set(rowKey, totals);
      });
    }
    
    // Similar logic for column totals and grand total...
    
    return { rowTotals, columnTotals, grandTotal };
  }

  private formatValue(value: number | null, measure: MeasureConfig): string {
    if (value === null) return '-';
    
    const precision = measure.precision ?? 2;
    
    switch (measure.format) {
      case 'currency':
        return `$${value.toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
      case 'percentage':
        return `${(value * 100).toFixed(precision)}%`;
      case 'number':
      default:
        return value.toFixed(precision).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
  }
}

interface AggregateState {
  [field: string]: {
    sum: number;
    count: number;
    min: number;
    max: number;
    values: number[];
  };
}

export default PivotEngine;
```

## 4. React Component with TanStack Table

```tsx
// PivotTable.tsx
import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import { useQuery } from '@tanstack/react-query';
import QueryExecutor from './query-executor';
import PivotEngine from './pivot-engine';

interface PivotTableProps {
  config: PivotConfig;
  dataQueryProfile: DataQueryProfile;
  queryExecutor: QueryExecutor;
}

const PivotTable: React.FC<PivotTableProps> = ({
  config,
  dataQueryProfile,
  queryExecutor,
}) => {
  // Fetch data
  const { data: queryResult, isLoading, error } = useQuery({
    queryKey: ['pivot', dataQueryProfile.id],
    queryFn: () => queryExecutor.execute(dataQueryProfile),
    refetchInterval: dataQueryProfile.refreshInterval,
  });

  // Transform to pivot structure
  const pivotResult = useMemo(() => {
    if (!queryResult?.data) return null;
    
    const engine = new PivotEngine();
    return engine.transform(queryResult.data, config);
  }, [queryResult, config]);

  // Build TanStack Table columns
  const columns = useMemo<ColumnDef<any>[]>(() => {
    if (!pivotResult) return [];
    
    const cols: ColumnDef<any>[] = [];
    
    // Row header columns
    config.rows.forEach((rowDim, idx) => {
      cols.push({
        id: `row-${idx}`,
        accessorKey: `rowLabels.${idx}`,
        header: rowDim.label || rowDim.field,
        cell: (info) => info.getValue(),
      });
    });
    
    // Data columns (flatten column headers)
    const flatColumnHeaders = this.flattenHeaders(
      pivotResult.structure.columnHeaders
    );
    
    flatColumnHeaders.forEach((header, idx) => {
      config.values.forEach((measure) => {
        cols.push({
          id: `col-${idx}-${measure.field}`,
          header: `${header.label} - ${measure.label || measure.field}`,
          accessorFn: (row) => {
            const cellKey = `${row.rowKey}::${header.path.join('|')}::${measure.field}`;
            return pivotResult.structure.cells.get(cellKey)?.formatted || '-';
          },
          cell: (info) => (
            <div className="text-right font-mono">
              {info.getValue()}
            </div>
          ),
        });
      });
    });
    
    // Row totals column
    if (config.options?.showRowTotals) {
      config.values.forEach((measure) => {
        cols.push({
          id: `total-${measure.field}`,
          header: `Total ${measure.label || measure.field}`,
          accessorFn: (row) => {
            const total = pivotResult.totals.rowTotals.get(row.rowKey)?.[measure.field];
            return total !== undefined ? this.formatValue(total, measure) : '-';
          },
          cell: (info) => (
            <div className="text-right font-mono font-bold bg-gray-50">
              {info.getValue()}
            </div>
          ),
        });
      });
    }
    
    return cols;
  }, [pivotResult, config]);

  // Build table data
  const data = useMemo(() => {
    if (!pivotResult) return [];
    
    return this.flattenHeaders(pivotResult.structure.rowHeaders).map((header) => ({
      rowKey: header.path.join('|'),
      rowLabels: header.path,
    }));
  }, [pivotResult]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return <div>Loading pivot table...</div>;
  }

  if (error) {
    return <div>Error loading data: {error.message}</div>;
  }

  return (
    <div className="overflow-auto">
      <table className="min-w-full border-collapse border border-gray-300">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="border border-gray-300 px-4 py-2 bg-gray-100 text-left font-semibold"
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className="border border-gray-300 px-4 py-2"
                >
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  private flattenHeaders(headers: HeaderNode[]): HeaderNode[] {
    const flattened: HeaderNode[] = [];
    
    const traverse = (nodes: HeaderNode[]) => {
      nodes.forEach((node) => {
        if (!node.children || node.children.length === 0) {
          flattened.push(node);
        } else {
          traverse(node.children);
        }
      });
    };
    
    traverse(headers);
    return flattened;
  }

  private formatValue(value: number, measure: MeasureConfig): string {
    // Reuse formatting logic from PivotEngine
    const precision = measure.precision ?? 2;
    switch (measure.format) {
      case 'currency':
        return `$${value.toFixed(precision)}`;
      case 'percentage':
        return `${(value * 100).toFixed(precision)}%`;
      default:
        return value.toFixed(precision);
    }
  }
};

export default PivotTable;
```

## 5. Dashboard Orchestration & Hydration

```tsx
// Dashboard.tsx
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PivotTable from './PivotTable';
import QueryExecutor from './query-executor';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

const queryExecutor = new QueryExecutor(queryClient);

interface DashboardProps {
  config: DashboardConfig;
}

const Dashboard: React.FC<DashboardProps> = ({ config }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">{config.name}</h1>
        
        <div className="grid grid-cols-12 gap-4">
          {config.widgets.map((widget) => (
            <div
              key={widget.id}
              className="col-span-12 md:col-span-6 lg:col-span-4"
              style={{
                gridColumn: `span ${widget.position.w}`,
                gridRow: `span ${widget.position.h}`,
              }}
            >
              <div className="bg-white rounded-lg shadow p-4">
                <PivotTable
                  config={widget.pivotConfig}
                  dataQueryProfile={widget.dataQueryProfile}
                  queryExecutor={queryExecutor}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </QueryClientProvider>
  );
};

export default Dashboard;
```

## 6. Hydration Strategy & Server-Side Support

```tsx
// server-hydration.ts
import { dehydrate, QueryClient } from '@tanstack/react-query';
import QueryExecutor from './query-executor';

export async function prefetchDashboard(config: DashboardConfig) {
  const queryClient = new QueryClient();
  const executor = new QueryExecutor(queryClient);
  
  // Prefetch all widget queries in parallel
  await Promise.all(
    config.widgets.map((widget) =>
      queryClient.prefetchQuery({
        queryKey: ['pivot', widget.dataQueryProfile.id],
        queryFn: () => executor.execute(widget.dataQueryProfile),
      })
    )
  );
  
  return dehydrate(queryClient);
}

// Next.js page example
export async function getServerSideProps(context) {
  const dashboardConfig = await fetchDashboardConfig(context.params.id);
  const dehydratedState = await prefetchDashboard(dashboardConfig);
  
  return {
    props: {
      dehydratedState,
      dashboardConfig,
    },
  };
}
```

This architecture provides:
- **Query abstraction** supporting both OLAP and SQL
- **Efficient caching** with TanStack Query
- **Incremental hydration** for dashboard performance
- **Flexible rendering** with TanStack Table or MUI
- **Type safety** throughout the pipeline

Want me to elaborate on any specific part like the MUI implementation, advanced aggregations, or real-time updates?
