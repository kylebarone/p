# Enterprise Widget System with Data Profile Abstraction

You're right to separate these concerns. Let me clarify the architecture with proper data profile abstraction.

## 1. Data Profile vs Pivot Config Relationship

**Key Distinction:**
- **Data Profile** = How to fetch/source the data (can be complex, multi-source)
- **Pivot Config** = How to transform and display that data
- **Widget Spec** = Combines data profile + visualization config (pivot/KPI/summary)

```typescript
// Core Data Profile Types
interface DataProfile {
  id: string;
  name: string;
  type: 'simple' | 'joined' | 'union' | 'computed';
  sources: DataSource[];
  transformations?: Transformation[];
  cache?: CacheConfig;
  refreshStrategy?: RefreshStrategy;
}

// Single source (OLAP or SQL)
interface SimpleDataProfile extends DataProfile {
  type: 'simple';
  sources: [DataSource]; // exactly one
}

// Multiple sources with joins
interface JoinedDataProfile extends DataProfile {
  type: 'joined';
  sources: DataSource[];
  joins: JoinConfig[];
}

// Multiple sources unioned/concatenated
interface UnionDataProfile extends DataProfile {
  type: 'union';
  sources: DataSource[];
  unionType: 'union' | 'union_all';
}

// Computed from other profiles
interface ComputedDataProfile extends DataProfile {
  type: 'computed';
  sources: DataSource[];
  computation: ComputationConfig;
}

interface DataSource {
  id: string;
  alias: string;
  sourceType: 'olap' | 'sql' | 'api' | 'profile_ref';
  config: OLAPConfig | SQLConfig | APIConfig | ProfileRefConfig;
}

interface OLAPConfig {
  cube: string;
  dimensions: string[];
  measures: string[];
  filters?: Filter[];
  timeRange?: TimeRange;
}

interface SQLConfig {
  query: string;
  datasource: string;
  parameters?: Record<string, any>;
}

interface APIConfig {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, any>;
  transform?: string; // JSONPath or JMESPath
}

interface ProfileRefConfig {
  profileId: string; // Reference to another data profile
}

interface JoinConfig {
  left: string; // source alias
  right: string; // source alias
  type: 'inner' | 'left' | 'right' | 'full';
  on: JoinCondition[];
}

interface JoinCondition {
  leftField: string;
  rightField: string;
  operator?: '=' | '!=' | '>' | '<' | '>=' | '<=';
}

interface Transformation {
  type: 'filter' | 'aggregate' | 'derive' | 'pivot' | 'unpivot';
  config: any;
}

interface ComputationConfig {
  type: 'blend' | 'lookup' | 'calculation';
  expression: string;
  dependencies: string[]; // field dependencies
}
```

## 2. Widget Specification System

```typescript
// Widget Spec - The Master Config
interface WidgetSpec {
  id: string;
  type: 'pivot' | 'kpi' | 'executive_summary' | 'chart' | 'artifact';
  title: string;
  dataSource: DataSourceReference;
  visualization: VisualizationConfig;
  position: WidgetPosition;
  interactions?: InteractionConfig;
}

interface DataSourceReference {
  mode: 'profile' | 'artifact' | 'inline';
  profileId?: string; // Reference to DataProfile
  artifactId?: string; // Reference to static artifact/markdown
  inlineData?: any[]; // For static data
}

interface VisualizationConfig {
  type: string;
  config: PivotConfig | KPIConfig | SummaryConfig | ChartConfig;
}

// KPI Card Config
interface KPIConfig {
  metric: MetricConfig;
  comparison?: ComparisonConfig;
  target?: TargetConfig;
  format?: FormatConfig;
  trend?: TrendConfig;
}

interface MetricConfig {
  field: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'last';
  label: string;
}

interface ComparisonConfig {
  type: 'previous_period' | 'previous_year' | 'target' | 'custom';
  field?: string;
  label?: string;
}

interface TrendConfig {
  enabled: boolean;
  field: string;
  timeField: string;
  sparkline?: boolean;
}

// Executive Summary Config
interface SummaryConfig {
  template: string; // Template with {{placeholders}}
  metrics: SummaryMetric[];
  sections?: SummarySection[];
}

interface SummaryMetric {
  key: string;
  field: string;
  aggregation: string;
  format?: FormatConfig;
  label?: string;
}

interface SummarySection {
  title: string;
  metrics: string[]; // keys from SummaryMetric
  narrative?: string; // Optional text template
}

// Dashboard Spec
interface DashboardSpec {
  id: string;
  name: string;
  version: string;
  dataProfiles: Record<string, DataProfile>;
  widgets: WidgetSpec[];
  globalFilters?: GlobalFilter[];
  layout?: LayoutConfig;
}
```

## 3. FastAPI Backend Structure

```python
# backend/models/data_profile.py
from pydantic import BaseModel, Field
from typing import Literal, Union, Optional, List, Dict, Any
from enum import Enum

class SourceType(str, Enum):
    OLAP = "olap"
    SQL = "sql"
    API = "api"
    PROFILE_REF = "profile_ref"

class OLAPConfig(BaseModel):
    cube: str
    dimensions: List[str]
    measures: List[str]
    filters: Optional[List[Dict[str, Any]]] = None
    time_range: Optional[Dict[str, str]] = None

class SQLConfig(BaseModel):
    query: str
    datasource: str
    parameters: Optional[Dict[str, Any]] = None

class APIConfig(BaseModel):
    endpoint: str
    method: Literal["GET", "POST"] = "GET"
    params: Optional[Dict[str, Any]] = None
    transform: Optional[str] = None

class ProfileRefConfig(BaseModel):
    profile_id: str

class DataSource(BaseModel):
    id: str
    alias: str
    source_type: SourceType
    config: Union[OLAPConfig, SQLConfig, APIConfig, ProfileRefConfig]

class JoinCondition(BaseModel):
    left_field: str
    right_field: str
    operator: str = "="

class JoinConfig(BaseModel):
    left: str
    right: str
    type: Literal["inner", "left", "right", "full"]
    on: List[JoinCondition]

class DataProfile(BaseModel):
    id: str
    name: str
    type: Literal["simple", "joined", "union", "computed"]
    sources: List[DataSource]
    joins: Optional[List[JoinConfig]] = None
    union_type: Optional[Literal["union", "union_all"]] = None
    transformations: Optional[List[Dict[str, Any]]] = None
    cache: Optional[Dict[str, Any]] = None

# backend/services/query_executor.py
import pandas as pd
from typing import List, Dict, Any
import httpx
from sqlalchemy import create_engine, text
import asyncio

class QueryExecutor:
    def __init__(self, config):
        self.config = config
        self.olap_client = None  # Initialize OLAP client
        self.sql_engines = {}  # Map of datasource -> engine
        
    async def execute_profile(self, profile: DataProfile) -> pd.DataFrame:
        """Execute a data profile and return DataFrame"""
        
        if profile.type == "simple":
            return await self._execute_simple(profile)
        elif profile.type == "joined":
            return await self._execute_joined(profile)
        elif profile.type == "union":
            return await self._execute_union(profile)
        elif profile.type == "computed":
            return await self._execute_computed(profile)
    
    async def _execute_simple(self, profile: DataProfile) -> pd.DataFrame:
        source = profile.sources[0]
        return await self._fetch_source(source)
    
    async def _execute_joined(self, profile: DataProfile) -> pd.DataFrame:
        # Fetch all sources in parallel
        tasks = [self._fetch_source(source) for source in profile.sources]
        dataframes = await asyncio.gather(*tasks)
        
        # Create dict of alias -> dataframe
        df_map = {source.alias: df for source, df in zip(profile.sources, dataframes)}
        
        # Perform joins sequentially
        result = None
        for join_config in profile.joins:
            left_df = df_map[join_config.left] if result is None else result
            right_df = df_map[join_config.right]
            
            # Build join conditions
            left_on = [cond.left_field for cond in join_config.on]
            right_on = [cond.right_field for cond in join_config.on]
            
            result = pd.merge(
                left_df,
                right_df,
                how=join_config.type,
                left_on=left_on,
                right_on=right_on,
                suffixes=('_left', '_right')
            )
        
        return result
    
    async def _execute_union(self, profile: DataProfile) -> pd.DataFrame:
        # Fetch all sources in parallel
        tasks = [self._fetch_source(source) for source in profile.sources]
        dataframes = await asyncio.gather(*tasks)
        
        # Concatenate
        result = pd.concat(dataframes, ignore_index=True)
        
        if profile.union_type == "union":
            result = result.drop_duplicates()
        
        return result
    
    async def _fetch_source(self, source: DataSource) -> pd.DataFrame:
        if source.source_type == SourceType.SQL:
            return await self._fetch_sql(source.config)
        elif source.source_type == SourceType.OLAP:
            return await self._fetch_olap(source.config)
        elif source.source_type == SourceType.API:
            return await self._fetch_api(source.config)
        elif source.source_type == SourceType.PROFILE_REF:
            # Recursive call to another profile
            ref_profile = await self._load_profile(source.config.profile_id)
            return await self.execute_profile(ref_profile)
    
    async def _fetch_sql(self, config: SQLConfig) -> pd.DataFrame:
        engine = self._get_sql_engine(config.datasource)
        
        with engine.connect() as conn:
            result = conn.execute(
                text(config.query),
                config.parameters or {}
            )
            df = pd.DataFrame(result.fetchall(), columns=result.keys())
        
        return df
    
    async def _fetch_olap(self, config: OLAPConfig) -> pd.DataFrame:
        # Build MDX query
        mdx = self._build_mdx(config)
        
        # Execute via OLAP client (e.g., xmla, mondrian)
        result = await self.olap_client.execute(mdx)
        
        # Convert to DataFrame
        return self._olap_to_dataframe(result)
    
    async def _fetch_api(self, config: APIConfig) -> pd.DataFrame:
        async with httpx.AsyncClient() as client:
            if config.method == "GET":
                response = await client.get(config.endpoint, params=config.params)
            else:
                response = await client.post(config.endpoint, json=config.params)
            
            data = response.json()
            
            # Apply transform if specified (JSONPath/JMESPath)
            if config.transform:
                data = self._apply_transform(data, config.transform)
            
            return pd.DataFrame(data)
    
    def _build_mdx(self, config: OLAPConfig) -> str:
        dimensions = ', '.join([f"[{d}]" for d in config.dimensions])
        measures = ', '.join([f"[Measures].[{m}]" for m in config.measures])
        
        mdx = f"""
        SELECT 
            {{{measures}}} ON COLUMNS,
            {{{dimensions}}} ON ROWS
        FROM [{config.cube}]
        """
        
        if config.filters:
            filter_expr = ' AND '.join([f"[{f['dimension']}].[{f['value']}]" 
                                       for f in config.filters])
            mdx += f" WHERE ({filter_expr})"
        
        return mdx

# backend/api/routes.py
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import pandas as pd
from typing import Dict, Any

router = APIRouter()
executor = QueryExecutor(config)

@router.post("/api/data/execute")
async def execute_data_profile(profile: DataProfile) -> JSONResponse:
    """Execute a data profile and return results"""
    try:
        df = await executor.execute_profile(profile)
        
        # Convert to JSON-serializable format
        result = {
            "data": df.to_dict(orient='records'),
            "metadata": {
                "columns": list(df.columns),
                "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()},
                "row_count": len(df),
                "memory_usage": df.memory_usage(deep=True).sum()
            }
        }
        
        return JSONResponse(content=result)
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/api/dashboard/hydrate")
async def hydrate_dashboard(spec: DashboardSpec) -> JSONResponse:
    """Hydrate all data profiles in a dashboard"""
    try:
        results = {}
        
        for profile_id, profile in spec.dataProfiles.items():
            df = await executor.execute_profile(profile)
            results[profile_id] = {
                "data": df.to_dict(orient='records'),
                "metadata": {
                    "columns": list(df.columns),
                    "row_count": len(df)
                }
            }
        
        return JSONResponse(content={"profiles": results})
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/profiles/{profile_id}/preview")
async def preview_profile(profile_id: str, limit: int = 100):
    """Preview a data profile with row limit"""
    profile = await load_profile(profile_id)
    df = await executor.execute_profile(profile)
    
    return JSONResponse(content={
        "data": df.head(limit).to_dict(orient='records'),
        "total_rows": len(df),
        "columns": list(df.columns)
    })
```

## 4. Frontend Widget Rendering System

```tsx
// widget-factory.tsx
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import PivotTableWidget from './widgets/PivotTableWidget';
import KPICardWidget from './widgets/KPICardWidget';
import ExecutiveSummaryWidget from './widgets/ExecutiveSummaryWidget';
import ArtifactWidget from './widgets/ArtifactWidget';

interface WidgetFactoryProps {
  spec: WidgetSpec;
}

const WidgetFactory: React.FC<WidgetFactoryProps> = ({ spec }) => {
  // Handle data fetching based on source mode
  const { data, isLoading, error } = useQuery({
    queryKey: ['widget-data', spec.id, spec.dataSource.profileId],
    queryFn: async () => {
      if (spec.dataSource.mode === 'artifact') {
        return { mode: 'artifact', artifactId: spec.dataSource.artifactId };
      }
      
      if (spec.dataSource.mode === 'inline') {
        return { mode: 'inline', data: spec.dataSource.inlineData };
      }
      
      // Fetch from profile
      const response = await fetch('/api/data/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spec.dataSource.profileId),
      });
      
      const result = await response.json();
      return { mode: 'profile', data: result.data, metadata: result.metadata };
    },
    enabled: spec.dataSource.mode !== 'artifact',
  });

  if (isLoading) {
    return <WidgetSkeleton />;
  }

  if (error) {
    return <WidgetError error={error} />;
  }

  // Route to appropriate widget component
  switch (spec.type) {
    case 'pivot':
      return (
        <PivotTableWidget
          config={spec.visualization.config as PivotConfig}
          data={data?.data || []}
          title={spec.title}
        />
      );
    
    case 'kpi':
      return (
        <KPICardWidget
          config={spec.visualization.config as KPIConfig}
          data={data?.data || []}
          title={spec.title}
        />
      );
    
    case 'executive_summary':
      return (
        <ExecutiveSummaryWidget
          config={spec.visualization.config as SummaryConfig}
          data={data?.data || []}
          title={spec.title}
        />
      );
    
    case 'artifact':
      return (
        <ArtifactWidget
          artifactId={data?.artifactId}
          title={spec.title}
        />
      );
    
    default:
      return <div>Unknown widget type: {spec.type}</div>;
  }
};

export default WidgetFactory;
```

## 5. Widget Components

```tsx
// widgets/KPICardWidget.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';

interface KPICardWidgetProps {
  config: KPIConfig;
  data: any[];
  title: string;
}

const KPICardWidget: React.FC<KPICardWidgetProps> = ({ config, data, title }) => {
  const kpiValue = useMemo(() => {
    if (!data.length) return null;
    
    const { field, aggregation } = config.metric;
    
    switch (aggregation) {
      case 'sum':
        return data.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
      case 'avg':
        const sum = data.reduce((acc, row) => acc + (Number(row[field]) || 0), 0);
        return sum / data.length;
      case 'count':
        return data.length;
      case 'last':
        return data[data.length - 1][field];
      case 'max':
        return Math.max(...data.map(row => Number(row[field]) || 0));
      case 'min':
        return Math.min(...data.map(row => Number(row[field]) || 0));
      default:
        return null;
    }
  }, [data, config.metric]);

  const comparison = useMemo(() => {
    if (!config.comparison || !data.length) return null;
    
    // Calculate comparison value based on type
    // This would need more sophisticated logic for previous_period, etc.
    const comparisonValue = data[0][config.comparison.field || ''];
    const change = kpiValue !== null ? ((kpiValue - comparisonValue) / comparisonValue) * 100 : 0;
    
    return {
      value: change,
      isPositive: change >= 0,
    };
  }, [data, config.comparison, kpiValue]);

  const formatValue = (value: number | null) => {
    if (value === null) return '-';
    
    const format = config.format;
    const precision = format?.precision ?? 2;
    
    switch (format?.type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: format.currency || 'USD',
          minimumFractionDigits: precision,
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(precision)}%`;
      case 'number':
      default:
        return value.toLocaleString('en-US', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        });
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary" gutterBottom>
          {title}
        </Typography>
        
        <Typography variant="h3" component="div" sx={{ my: 2 }}>
          {formatValue(kpiValue)}
        </Typography>
        
        {comparison && (
          <Box display="flex" alignItems="center" gap={1}>
            {comparison.isPositive ? (
              <TrendingUp color="success" />
            ) : (
              <TrendingDown color="error" />
            )}
            <Typography
              variant="body2"
              color={comparison.isPositive ? 'success.main' : 'error.main'}
            >
              {comparison.value.toFixed(1)}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {config.comparison?.label || 'vs previous'}
            </Typography>
          </Box>
        )}
        
        {config.trend?.enabled && (
          <Box mt={2}>
            {/* Render sparkline chart here */}
            <Typography variant="caption" color="text.secondary">
              Trend over time
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default KPICardWidget;
```

```tsx
// widgets/ExecutiveSummaryWidget.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, Typography, Divider } from '@mui/material';

interface ExecutiveSummaryWidgetProps {
  config: SummaryConfig;
  data: any[];
  title: string;
}

const ExecutiveSummaryWidget: React.FC<ExecutiveSummaryWidgetProps> = ({
  config,
  data,
  title,
}) => {
  const computedMetrics = useMemo(() => {
    const metrics: Record<string, any> = {};
    
    config.metrics.forEach((metric) => {
      const values = data.map(row => Number(row[metric.field]) || 0);
      
      switch (metric.aggregation) {
        case 'sum':
          metrics[metric.key] = values.reduce((a, b) => a + b, 0);
          break;
        case 'avg':
          metrics[metric.key] = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case 'count':
          metrics[metric.key] = data.length;
          break;
        case 'max':
          metrics[metric.key] = Math.max(...values);
          break;
        case 'min':
          metrics[metric.key] = Math.min(...values);
          break;
      }
    });
    
    return metrics;
  }, [data, config.metrics]);

  const renderTemplate = (template: string) => {
    let rendered = template;
    
    Object.entries(computedMetrics).forEach(([key, value]) => {
      const metric = config.metrics.find(m => m.key === key);
      const formatted = formatMetricValue(value, metric?.format);
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), formatted);
    });
    
    return rendered;
  };

  const formatMetricValue = (value: number, format?: FormatConfig) => {
    if (!format) return value.toLocaleString();
    
    switch (format.type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: format.currency || 'USD',
        }).format(value);
      case 'percentage':
        return `${(value * 100).toFixed(format.precision || 1)}%`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>
        
        <Typography
          variant="body1"
          sx={{ mb: 3, whiteSpace: 'pre-line' }}
        >
          {renderTemplate(config.template)}
        </Typography>
        
        {config.sections?.map((section, idx) => (
          <React.Fragment key={idx}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              {section.title}
            </Typography>
            
            <Box display="flex" gap={3} flexWrap="wrap">
              {section.metrics.map((metricKey) => {
                const metric = config.metrics.find(m => m.key === metricKey);
                return (
                  <Box key={metricKey}>
                    <Typography variant="caption" color="text.secondary">
                      {metric?.label || metricKey}
                    </Typography>
                    <Typography variant="h6">
                      {formatMetricValue(computedMetrics[metricKey], metric?.format)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            
            {section.narrative && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {renderTemplate(section.narrative)}
              </Typography>
            )}
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
};

export default ExecutiveSummaryWidget;
```

## 6. Dashboard Router Integration (TanStack Router)

```tsx
// routes/dashboard.$id.tsx
import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import WidgetFactory from '../components/WidgetFactory';

export const Route = createFileRoute('/dashboard/$id')({
  loader: async ({ params, context }) => {
    // Prefetch dashboard spec
    const spec = await context.queryClient.fetchQuery({
      queryKey: ['dashboard-spec', params.id],
      queryFn: () => fetch(`/api/dashboards/${params.id}`).then(r => r.json()),
    });
    
    // Prefetch all data profiles
    await context.queryClient.fetchQuery({
      queryKey: ['dashboard-hydrate', params.id],
      queryFn: () => 
        fetch('/api/dashboard/hydrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(spec),
        }).then(r => r.json()),
    });
    
    return { spec };
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { spec } = Route.useLoaderData();
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">{spec.name}</h1>
      
      <div className="grid grid-cols-12 gap-4">
        {spec.widgets.map((widget: WidgetSpec) => (
          <div
            key={widget.id}
            style={{
              gridColumn: `span ${widget.position.w}`,
              gridRow: `span ${widget.position.h}`,
            }}
          >
            <WidgetFactory spec={widget} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

This architecture gives you:

1. **Flexible Data Profiles** - Can combine OLAP, SQL, APIs with joins/unions
2. **Widget Abstraction** - Single factory pattern for all widget types
3. **FastAPI Backend** - Handles complex query execution and data transformation
4. **TanStack Integration** - Router for navigation, Query for data fetching
5. **Type Safety** - Full TypeScript coverage
6. **Performance** - Parallel fetching, caching, prefetching

Want me to dive deeper into any specific area like the transformation pipeline, caching strategy, or real-time updates?
