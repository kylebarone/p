# Architecture Review & Refinement

Let me walk through our solution critically, identify strengths, potential issues, and suggest refinements.

## 1. Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DASHBOARD LAYER                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Dashboard Spec (JSON/Config)                          │ │
│  │  - Widget Specs[]                                      │ │
│  │  - Data Profiles{}                                     │ │
│  │  - Layout Config                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    WIDGET LAYER                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Pivot   │  │   KPI    │  │ Summary  │  │ Artifact │   │
│  │  Widget  │  │  Widget  │  │  Widget  │  │  Widget  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         ▲              ▲              ▲              ▲       │
│         └──────────────┴──────────────┴──────────────┘       │
│                    Widget Factory                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Data Profile Resolution                               │ │
│  │  - Profile → Query Execution                           │ │
│  │  - Join/Union Logic                                    │ │
│  │  - Transformation Pipeline                             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 BACKEND EXECUTION                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   OLAP   │  │   SQL    │  │   API    │  │ Profile  │   │
│  │  Executor│  │ Executor │  │ Executor │  │   Ref    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 2. Critical Analysis

### ✅ **Strengths**

**1. Clear Separation of Concerns**
```typescript
// Data fetching is decoupled from visualization
DataProfile → QueryExecutor → Data
WidgetSpec → WidgetFactory → Component → Render
```

**2. Extensibility**
- New widget types: Just add to factory
- New data sources: Implement executor interface
- New transformations: Add to pipeline

**3. Type Safety**
- Strong TypeScript contracts throughout
- Discriminated unions for profiles/configs
- Compile-time validation

### ⚠️ **Potential Issues**

**1. Over-Abstraction in Data Profiles**
```typescript
// Current: Complex nested structure
interface DataProfile {
  sources: DataSource[];
  joins?: JoinConfig[];
  transformations?: Transformation[];
  // Too many responsibilities?
}
```

**Problem**: Data profiles mixing fetch logic with transformation logic.

**2. Widget Factory Tight Coupling**
```typescript
// Current: Single factory knows all widget types
switch (spec.type) {
  case 'pivot': return <PivotTableWidget />
  case 'kpi': return <KPICardWidget />
  // Adding new widget = modify factory
}
```

**3. Transformation Logic Split**
```typescript
// Backend does joins/unions
// Frontend does pivot transformations
// Where should aggregations live?
```

**4. Query Execution Patterns**
```typescript
// Current: Each widget independently fetches
useQuery({
  queryKey: ['widget-data', spec.id],
  queryFn: () => fetchProfile(spec.dataSource.profileId)
})
// What if multiple widgets share same profile?
```

## 3. Refined Architecture

Let's address these issues with a cleaner approach:

### **A. Simplified Data Flow**

```typescript
// Clear responsibility boundaries
interface DataProfileV2 {
  id: string;
  // ONLY fetch configuration - no transformations
  source: DataSourceUnion;
  cache?: CacheConfig;
}

type DataSourceUnion = 
  | { type: 'olap'; config: OLAPConfig }
  | { type: 'sql'; config: SQLConfig }
  | { type: 'api'; config: APIConfig }
  | { type: 'composite'; sources: CompositeSource[] };

interface CompositeSource {
  profile: string;
  alias: string;
  operation: 'join' | 'union';
  config: JoinConfig | UnionConfig;
}

// Transformations at WIDGET level, not profile level
interface WidgetSpecV2 {
  id: string;
  type: WidgetType;
  dataSource: {
    profileId: string;
    transforms?: DataTransform[]; // Widget-specific transforms
  };
  visualization: VisualizationConfig;
}

type DataTransform = 
  | { type: 'filter'; condition: FilterCondition }
  | { type: 'aggregate'; groupBy: string[]; measures: Measure[] }
  | { type: 'sort'; fields: SortField[] }
  | { type: 'limit'; count: number };
```

**Benefits**:
- Data profiles = pure data fetching
- Widgets = data transformation + visualization
- Clear boundary: Backend fetches, Frontend transforms

### **B. Plugin-Based Widget System**

```typescript
// widget-registry.ts
type WidgetComponent<T = any> = React.FC<{
  data: any[];
  config: T;
  title: string;
}>;

class WidgetRegistry {
  private widgets = new Map<string, WidgetComponent>();
  
  register<T>(type: string, component: WidgetComponent<T>) {
    this.widgets.set(type, component);
  }
  
  get(type: string): WidgetComponent | undefined {
    return this.widgets.get(type);
  }
}

export const widgetRegistry = new WidgetRegistry();

// Register built-in widgets
widgetRegistry.register('pivot', PivotTableWidget);
widgetRegistry.register('kpi', KPICardWidget);
widgetRegistry.register('executive_summary', ExecutiveSummaryWidget);

// Easy to extend
widgetRegistry.register('custom_chart', MyCustomChartWidget);
```

```tsx
// WidgetFactory v2 - Ultra simple
const WidgetFactory: React.FC<{ spec: WidgetSpec }> = ({ spec }) => {
  const WidgetComponent = widgetRegistry.get(spec.type);
  
  if (!WidgetComponent) {
    return <UnknownWidgetError type={spec.type} />;
  }
  
  const { data, isLoading } = useWidgetData(spec);
  
  if (isLoading) return <WidgetSkeleton />;
  
  return (
    <WidgetComponent 
      data={data} 
      config={spec.visualization.config}
      title={spec.title}
    />
  );
};
```

**Benefits**:
- Zero coupling - factory doesn't know widget types
- Tree-shakeable - unused widgets excluded from bundle
- Plugin architecture - third-party widgets easy to add

### **C. Optimized Data Fetching**

```typescript
// Shared profile cache across widgets
const useDashboardData = (dashboardSpec: DashboardSpec) => {
  const profileIds = useMemo(() => {
    // Extract unique profile IDs from all widgets
    return [...new Set(
      dashboardSpec.widgets.map(w => w.dataSource.profileId)
    )];
  }, [dashboardSpec]);
  
  // Fetch all profiles in parallel, once
  const queries = useQueries({
    queries: profileIds.map(id => ({
      queryKey: ['profile', id],
      queryFn: () => fetchProfile(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  
  return useMemo(() => {
    const profileMap = new Map();
    profileIds.forEach((id, idx) => {
      if (queries[idx].data) {
        profileMap.set(id, queries[idx].data);
      }
    });
    return profileMap;
  }, [queries, profileIds]);
};

// Widget data hook - uses shared cache
const useWidgetData = (spec: WidgetSpec) => {
  const profileData = useQueryClient().getQueryData(['profile', spec.dataSource.profileId]);
  
  const transformedData = useMemo(() => {
    if (!profileData) return [];
    
    // Apply widget-specific transforms
    return applyTransforms(profileData, spec.dataSource.transforms || []);
  }, [profileData, spec.dataSource.transforms]);
  
  return {
    data: transformedData,
    isLoading: !profileData,
  };
};
```

**Benefits**:
- Single fetch per profile, regardless of widget count
- TanStack Query handles caching/deduplication
- Widget-level transforms run client-side

### **D. Cleaner Pivot Engine**

```typescript
// Pure transformation functions - easier to test
class PivotTransformer {
  transform(data: any[], config: PivotConfig): PivotTable {
    const grouped = this.groupData(data, config);
    const pivoted = this.pivotGroups(grouped, config);
    const totals = this.calculateTotals(pivoted, config);
    
    return { pivoted, totals };
  }
  
  private groupData(data: any[], config: PivotConfig) {
    // Pure function - no side effects
    const groups = new Map<string, any[]>();
    
    data.forEach(row => {
      const key = this.buildKey(row, [...config.rows, ...config.columns]);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    });
    
    return groups;
  }
  
  private pivotGroups(groups: Map<string, any[]>, config: PivotConfig) {
    // Separate aggregation logic
    const aggregator = new Aggregator(config.values);
    
    const result = new Map<string, CellValue>();
    
    groups.forEach((rows, key) => {
      const [rowKey, colKey] = key.split('::');
      
      config.values.forEach(measure => {
        const value = aggregator.aggregate(rows, measure);
        result.set(`${rowKey}::${colKey}::${measure.field}`, {
          value,
          formatted: this.format(value, measure),
        });
      });
    });
    
    return result;
  }
  
  private buildKey(row: any, dimensions: DimensionConfig[]): string {
    return dimensions
      .map(dim => row[dim.field] ?? 'null')
      .join('::');
  }
  
  private format(value: number | null, measure: MeasureConfig): string {
    // Formatting logic
  }
}

// Separate aggregation concerns
class Aggregator {
  constructor(private measures: MeasureConfig[]) {}
  
  aggregate(rows: any[], measure: MeasureConfig): number | null {
    const values = rows
      .map(row => Number(row[measure.field]))
      .filter(v => !isNaN(v));
    
    if (values.length === 0) return null;
    
    switch (measure.aggregation) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'count':
        return values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'distinct_count':
        return new Set(values).size;
      default:
        return null;
    }
  }
}
```

**Benefits**:
- Pure functions - easy to test
- Single responsibility - each class has one job
- Composable - can swap aggregators, formatters

### **E. TanStack Table Integration - Simplified**

```tsx
// Use TanStack's power without over-engineering
const PivotTableWidget: React.FC<PivotTableWidgetProps> = ({ 
  data, 
  config, 
  title 
}) => {
  // Transform data
  const pivotData = useMemo(() => {
    const transformer = new PivotTransformer();
    return transformer.transform(data, config);
  }, [data, config]);
  
  // Build flat row structure for TanStack
  const tableData = useMemo(() => 
    buildFlatRows(pivotData, config),
    [pivotData, config]
  );
  
  // Build columns dynamically
  const columns = useMemo(() => 
    buildColumns(pivotData, config),
    [pivotData, config]
  );
  
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // Add features as needed
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
  
  return (
    <TableContainer>
      <Typography variant="h6" sx={{ p: 2 }}>{title}</Typography>
      <Table>
        <TableHead>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableCell 
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                  sx={{ 
                    cursor: header.column.getCanSort() ? 'pointer' : 'default',
                    fontWeight: 600,
                    bgcolor: 'grey.100'
                  }}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext()
                  )}
                  {/* Sort indicator */}
                  {header.column.getIsSorted() && (
                    <span>{header.column.getIsSorted() === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>
                  {flexRender(
                    cell.column.columnDef.cell,
                    cell.getContext()
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

// Helper to build flat row structure
function buildFlatRows(pivotData: PivotTable, config: PivotConfig) {
  const rows: any[] = [];
  
  // Extract unique row paths
  const rowPaths = extractRowPaths(pivotData);
  
  rowPaths.forEach(rowPath => {
    const row: any = {};
    
    // Add row dimension values
    config.rows.forEach((dim, idx) => {
      row[`dim_${idx}`] = rowPath[idx];
    });
    
    // Add cell values for each column
    const colPaths = extractColPaths(pivotData);
    colPaths.forEach(colPath => {
      const cellKey = buildCellKey(rowPath, colPath);
      config.values.forEach(measure => {
        const key = `${cellKey}::${measure.field}`;
        row[key] = pivotData.pivoted.get(`${cellKey}::${measure.field}`)?.value;
      });
    });
    
    rows.push(row);
  });
  
  return rows;
}

// Helper to build column definitions
function buildColumns(pivotData: PivotTable, config: PivotConfig): ColumnDef<any>[] {
  const columns: ColumnDef<any>[] = [];
  
  // Row dimension columns
  config.rows.forEach((dim, idx) => {
    columns.push({
      id: `dim_${idx}`,
      accessorKey: `dim_${idx}`,
      header: dim.label || dim.field,
      enableSorting: true,
    });
  });
  
  // Value columns for each column dimension combination
  const colPaths = extractColPaths(pivotData);
  colPaths.forEach(colPath => {
    config.values.forEach(measure => {
      const colLabel = colPath.join(' > ');
      columns.push({
        id: `${colPath.join('_')}_${measure.field}`,
        accessorKey: `${buildCellKey([''], colPath)}::${measure.field}`,
        header: `${colLabel} - ${measure.label || measure.field}`,
        cell: (info) => info.getValue() ?? '-',
        enableSorting: true,
      });
    });
  });
  
  return columns;
}
```

## 4. Final Recommended Structure

```
src/
├── types/
│   ├── data-profile.ts       # Data fetching types
│   ├── widget-spec.ts         # Widget configuration types
│   ├── visualization.ts       # Viz-specific configs
│   └── dashboard.ts           # Dashboard types
│
├── services/
│   ├── api/
│   │   └── profiles.ts        # API calls to backend
│   ├── transformers/
│   │   ├── pivot.ts           # Pivot transformation
│   │   ├── aggregator.ts      # Aggregation logic
│   │   └── filters.ts         # Filter/transform logic
│   └── registry/
│       └── widget-registry.ts # Plugin system
│
├── hooks/
│   ├── useDashboardData.ts    # Shared data fetching
│   ├── useWidgetData.ts       # Widget-specific data
│   └── useTransform.ts        # Data transformation
│
├── widgets/
│   ├── PivotTableWidget/
│   │   ├── index.tsx
│   │   ├── PivotTable.tsx
│   │   └── utils.ts
│   ├── KPICardWidget/
│   │   └── index.tsx
│   ├── ExecutiveSummaryWidget/
│   │   └── index.tsx
│   └── index.ts               # Widget exports + registry
│
├── components/
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── DashboardGrid.tsx
│   │   └── WidgetContainer.tsx
│   ├── WidgetFactory.tsx
│   └── common/
│       ├── WidgetSkeleton.tsx
│       └── WidgetError.tsx
│
└── routes/
    └── dashboard.$id.tsx      # TanStack Router
```

## 5. Key Patterns Summary

### ✅ **Use These Patterns**

**1. Plugin Architecture**
```typescript
// Extensible without modification
widgetRegistry.register('my_widget', MyWidget);
```

**2. Pure Transformations**
```typescript
// Easy to test, compose, debug
const result = transform(data, config);
```

**3. Shared Data Fetching**
```typescript
// Fetch once, use many times
const profileData = useDashboardData(spec);
```

**4. Clear Boundaries**
```typescript
Backend  → Fetch (OLAP/SQL/API)
Frontend → Transform (Filter/Aggregate/Pivot)
Widget   → Render (MUI/TanStack)
```

### ❌ **Avoid These**

**1. Mixed Responsibilities**
```typescript
// Bad: Profile does fetching AND transformation
interface DataProfile {
  fetch: FetchConfig;
  transform: TransformConfig; // Move to widget level
}
```

**2. Tight Coupling**
```typescript
// Bad: Factory knows all widgets
switch (type) {
  case 'pivot': ...
  case 'kpi': ...
}
```

**3. Duplicate Fetches**
```typescript
// Bad: Each widget fetches independently
widgets.map(w => useQuery(['data', w.id], ...))
```

## 6. Performance Checklist

- ✅ **Memoization**: All expensive computations in `useMemo`
- ✅ **Query Deduplication**: TanStack Query handles this
- ✅ **Lazy Loading**: Widgets loaded on-demand
- ✅ **Virtualization**: For large pivot tables (react-window)
- ✅ **Code Splitting**: Widget bundles split by route
- ✅ **Suspense Boundaries**: Graceful loading states

This refined architecture is **maintainable** (clear boundaries), **expressive** (declarative configs), and **powerful** (plugin system, flexible transforms). 

Want to dive deeper into any specific pattern or build out a complete working example?
