import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ==================== MOCK DATA SERVICE ====================
class MockDataService {
  static generateRandomData(ref) {
    const generators = {
      sales_by_region: () => {
        const regions = ['North', 'South', 'East', 'West'];
        const products = ['Laptop', 'Phone', 'Tablet'];
        const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
        const data = [];
        
        regions.forEach(region => {
          products.forEach(product => {
            quarters.forEach(quarter => {
              data.push({
                region,
                product,
                quarter,
                revenue: Math.floor(Math.random() * 200000) + 50000,
                units: Math.floor(Math.random() * 1000) + 200,
                avg_price: Math.floor(Math.random() * 500) + 100,
              });
            });
          });
        });
        return data;
      },

      monthly_trends: () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return months.map((month) => ({
          month,
          revenue: Math.floor(Math.random() * 100000) + 80000,
          orders: Math.floor(Math.random() * 800) + 1000,
          customers: Math.floor(Math.random() * 400) + 500,
        }));
      },

      kpi_metrics: () => [{
        current: Math.floor(Math.random() * 500000) + 1000000,
        previous: Math.floor(Math.random() * 500000) + 900000,
        target: 1200000,
      }],

      product_performance: () => {
        const products = ['Laptop', 'Phone', 'Tablet', 'Desktop', 'Monitor', 'Keyboard'];
        return products.map(product => ({
          product,
          category: Math.random() > 0.5 ? 'Electronics' : 'Accessories',
          sales: Math.floor(Math.random() * 300000) + 50000,
          margin: Math.random() * 30 + 10,
          units_sold: Math.floor(Math.random() * 2000) + 500,
        }));
      },

      regional_analysis: () => {
        const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
        const years = ['2023', '2024'];
        const data = [];
        regions.forEach(region => {
          years.forEach(year => {
            data.push({
              region,
              year,
              revenue: Math.floor(Math.random() * 1000000) + 500000,
              growth: Math.random() * 40 - 10,
              market_share: Math.random() * 30 + 10,
            });
          });
        });
        return data;
      },
    };

    return generators[ref] ? generators[ref]() : [];
  }
}

// ==================== TRANSFORMERS ====================
class PivotTransformer {
  transform(data, config) {
    const { rows, columns, values } = config;

    const rowPaths = this.extractPaths(data, rows);
    const columnPaths = this.extractPaths(data, columns);
    const aggregationMap = this.buildAggregationMap(data, rows, columns);

    const cells = new Map();
    rowPaths.forEach(rowPath => {
      const rowKey = rowPath.join('|');
      columnPaths.forEach(colPath => {
        const colKey = colPath.join('|');
        const key = `${rowKey}::${colKey}`;
        const rows = aggregationMap.get(rowKey)?.get(colKey) || [];
        
        values.forEach(measure => {
          const value = this.aggregate(rows, measure);
          cells.set(`${key}::${measure.field}`, value);
        });
      });
    });

    const rowTotals = new Map();
    const columnTotals = new Map();
    
    if (config.options?.showRowTotals) {
      rowPaths.forEach(rowPath => {
        const rowKey = rowPath.join('|');
        const totals = {};
        values.forEach(measure => {
          let sum = 0;
          columnPaths.forEach(colPath => {
            sum += cells.get(`${rowKey}::${colPath.join('|')}::${measure.field}`) || 0;
          });
          totals[measure.field] = sum;
        });
        rowTotals.set(rowKey, totals);
      });
    }

    if (config.options?.showColumnTotals) {
      columnPaths.forEach(colPath => {
        const colKey = colPath.join('|');
        const totals = {};
        values.forEach(measure => {
          let sum = 0;
          rowPaths.forEach(rowPath => {
            sum += cells.get(`${rowPath.join('|')}::${colKey}::${measure.field}`) || 0;
          });
          totals[measure.field] = sum;
        });
        columnTotals.set(colKey, totals);
      });
    }

    const grandTotal = {};
    values.forEach(measure => {
      let sum = 0;
      cells.forEach((value, key) => {
        if (key.endsWith(`::${measure.field}`)) sum += value || 0;
      });
      grandTotal[measure.field] = sum;
    });

    return { rowPaths, columnPaths, cells, rowTotals, columnTotals, grandTotal };
  }

  extractPaths(data, dimensions) {
    if (!dimensions.length) return [[]];
    const pathSet = new Set();
    data.forEach(row => {
      const path = dimensions.map(dim => String(row[dim] ?? 'null'));
      pathSet.add(JSON.stringify(path));
    });
    return Array.from(pathSet).map(p => JSON.parse(p)).sort();
  }

  buildAggregationMap(data, rows, columns) {
    const map = new Map();
    data.forEach(row => {
      const rowKey = rows.map(r => String(row[r] ?? 'null')).join('|');
      const colKey = columns.map(c => String(row[c] ?? 'null')).join('|');
      
      if (!map.has(rowKey)) map.set(rowKey, new Map());
      if (!map.get(rowKey).has(colKey)) map.get(rowKey).set(colKey, []);
      map.get(rowKey).get(colKey).push(row);
    });
    return map;
  }

  aggregate(rows, measure) {
    if (!rows.length) return null;
    const values = rows.map(r => Number(r[measure.field])).filter(v => !isNaN(v));
    if (!values.length) return null;

    switch (measure.aggregation) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'count': return values.length;
      case 'min': return Math.min(...values);
      case 'max': return Math.max(...values);
      case 'distinct_count': return new Set(values).size;
      default: return null;
    }
  }
}

// ==================== FORMATTERS ====================
const formatValue = (value, config = {}) => {
  if (value == null) return '-';
  
  const { type = 'number', precision = 2, currency = 'USD' } = config;
  
  switch (type) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      }).format(value);
    case 'percentage':
      return `${value.toFixed(precision)}%`;
    case 'number':
    default:
      return value.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
      });
  }
};

// ==================== WIDGETS ====================
const PivotTableWidget = ({ data, config, title }) => {
  const pivotResult = useMemo(() => {
    const transformer = new PivotTransformer();
    return transformer.transform(data, config);
  }, [data, config]);

  const [sortConfig, setSortConfig] = useState(null);

  const sortedRowPaths = useMemo(() => {
    if (!sortConfig) return pivotResult.rowPaths;
    
    return [...pivotResult.rowPaths].sort((a, b) => {
      const aKey = a.join('|');
      const bKey = b.join('|');
      const cellKey = sortConfig.columnPath ? 
        `::${sortConfig.columnPath}::${sortConfig.field}` : 
        `::${sortConfig.field}`;
      
      const aValue = pivotResult.cells.get(aKey + cellKey) || 0;
      const bValue = pivotResult.cells.get(bKey + cellKey) || 0;
      
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    });
  }, [pivotResult, sortConfig]);

  const handleSort = (columnPath, field) => {
    setSortConfig(prev => {
      if (prev?.columnPath === columnPath && prev?.field === field) {
        return { columnPath, field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { columnPath, field, direction: 'desc' };
    });
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gridColumn: `span ${config.position?.w || 6}`,
      gridRow: `span ${config.position?.h || 4}`
    }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr>
              {config.rows.map((row, i) => (
                <th key={i} style={{
                  background: '#f7fafc',
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#4a5568',
                  borderBottom: '2px solid #e2e8f0',
                  position: 'sticky',
                  top: 0
                }}>{row}</th>
              ))}
              {pivotResult.columnPaths.map(colPath => 
                config.values.map((measure, i) => (
                  <th 
                    key={`${colPath.join('_')}_${i}`}
                    onClick={() => handleSort(colPath.join('|'), measure.field)}
                    style={{
                      background: '#f7fafc',
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#4a5568',
                      borderBottom: '2px solid #e2e8f0',
                      cursor: 'pointer',
                      userSelect: 'none',
                      position: 'sticky',
                      top: 0
                    }}
                  >
                    {colPath.join(' > ')}{config.values.length > 1 ? ` - ${measure.label || measure.field}` : ''}
                    {sortConfig?.columnPath === colPath.join('|') && sortConfig?.field === measure.field && (
                      <span> {sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                ))
              )}
              {config.options?.showRowTotals && config.values.map(measure => (
                <th key={`total_${measure.field}`} style={{
                  background: '#f7fafc',
                  padding: '12px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#4a5568',
                  borderBottom: '2px solid #e2e8f0',
                  position: 'sticky',
                  top: 0
                }}>
                  Total {measure.label || measure.field}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRowPaths.map((rowPath, idx) => {
              const rowKey = rowPath.join('|');
              return (
                <tr key={idx} style={{ background: idx % 2 === 0 ? 'white' : '#f7fafc' }}>
                  {rowPath.map((cell, i) => (
                    <td key={i} style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
                      <strong>{cell}</strong>
                    </td>
                  ))}
                  {pivotResult.columnPaths.map(colPath =>
                    config.values.map((measure, i) => {
                      const cellKey = `${rowKey}::${colPath.join('|')}::${measure.field}`;
                      const value = pivotResult.cells.get(cellKey);
                      return (
                        <td key={`${colPath.join('_')}_${i}`} style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid #e2e8f0',
                          textAlign: 'right',
                          fontFamily: 'monospace'
                        }}>
                          {formatValue(value, measure.format)}
                        </td>
                      );
                    })
                  )}
                  {config.options?.showRowTotals && config.values.map(measure => (
                    <td key={`total_${measure.field}`} style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #e2e8f0',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      background: '#f7fafc',
                      fontWeight: 600
                    }}>
                      {formatValue(pivotResult.rowTotals.get(rowKey)?.[measure.field], measure.format)}
                    </td>
                  ))}
                </tr>
              );
            })}
            {config.options?.showColumnTotals && (
              <tr style={{ background: '#edf2f7', fontWeight: 700 }}>
                <td colSpan={config.rows.length} style={{ padding: '12px 16px' }}>
                  <strong>Grand Total</strong>
                </td>
                {pivotResult.columnPaths.map(colPath =>
                  config.values.map((measure, i) => (
                    <td key={`${colPath.join('_')}_${i}`} style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontFamily: 'monospace'
                    }}>
                      {formatValue(pivotResult.columnTotals.get(colPath.join('|'))?.[measure.field], measure.format)}
                    </td>
                  ))
                )}
                {config.options?.showRowTotals && config.values.map(measure => (
                  <td key={`grand_${measure.field}`} style={{
                    padding: '12px 16px',
                    textAlign: 'right',
                    fontFamily: 'monospace'
                  }}>
                    {formatValue(pivotResult.grandTotal[measure.field], measure.format)}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const KPICardWidget = ({ data, config, title }) => {
  const value = useMemo(() => {
    const values = data.map(r => Number(r[config.metric])).filter(v => !isNaN(v));
    if (!values.length) return null;
    
    switch (config.aggregation) {
      case 'sum': return values.reduce((a, b) => a + b, 0);
      case 'avg': return values.reduce((a, b) => a + b, 0) / values.length;
      case 'count': return values.length;
      case 'max': return Math.max(...values);
      case 'min': return Math.min(...values);
      case 'distinct_count': return new Set(values).size;
      default: return null;
    }
  }, [data, config]);

  const comparison = useMemo(() => {
    if (!config.comparison || !data.length) return null;
    const compValues = data.map(r => Number(r[config.comparison.metric])).filter(v => !isNaN(v));
    if (!compValues.length) return null;
    const compValue = compValues.reduce((a, b) => a + b, 0) / compValues.length;
    const diff = value - compValue;
    const percentChange = (diff / compValue) * 100;
    return { value: percentChange, isPositive: diff > 0 };
  }, [data, config, value]);

  const targetProgress = useMemo(() => {
    if (!config.target || !value) return null;
    return (value / config.target) * 100;
  }, [value, config.target]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gridColumn: `span ${config.position?.w || 3}`,
      gridRow: `span ${config.position?.h || 2}`
    }}>
      <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#718096', fontWeight: 600, marginBottom: '8px' }}>
        {title}
      </div>
      <div style={{ fontSize: '40px', fontWeight: 700, color: '#1a202c', margin: '8px 0' }}>
        {formatValue(value, config.format)}
      </div>
      {comparison && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', marginBottom: '8px' }}>
          <span style={{ fontWeight: 600, color: comparison.isPositive ? '#38a169' : '#e53e3e' }}>
            {comparison.isPositive ? '↑' : '↓'} {Math.abs(comparison.value).toFixed(1)}%
          </span>
          <span style={{ color: '#718096' }}>{config.comparison.label}</span>
        </div>
      )}
      {targetProgress !== null && (
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#718096', marginBottom: '4px' }}>
            <span>Target Progress</span>
            <span>{targetProgress.toFixed(0)}%</span>
          </div>
          <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(targetProgress, 100)}%`,
              background: targetProgress >= 100 ? '#38a169' : '#4299e1',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}
    </div>
  );
};

const ChartWidget = ({ data, config, title }) => {
  const { chartType, xAxis, yAxis, options = {} } = config;
  const yFields = Array.isArray(yAxis) ? yAxis : [yAxis];

  const ChartComponent = {
    line: LineChart,
    bar: BarChart,
    area: AreaChart,
  }[chartType] || LineChart;

  const DataComponent = {
    line: Line,
    bar: Bar,
    area: Area,
  }[chartType] || Line;

  const colors = ['#4299e1', '#48bb78', '#ed8936', '#9f7aea', '#f56565'];

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gridColumn: `span ${config.position?.w || 6}`,
      gridRow: `span ${config.position?.h || 3}`
    }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      <div style={{ flex: 1, padding: '16px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent data={data}>
            {options.grid && <CartesianGrid strokeDasharray="3 3" />}
            <XAxis dataKey={xAxis} />
            <YAxis />
            {options.tooltip && <Tooltip />}
            {options.legend && <Legend />}
            {yFields.map((field, idx) => (
              <DataComponent
                key={field}
                type="monotone"
                dataKey={field}
                stroke={colors[idx % colors.length]}
                fill={colors[idx % colors.length]}
                fillOpacity={chartType === 'area' ? 0.6 : 1}
                strokeWidth={chartType === 'line' ? 2 : 0}
              />
            ))}
          </ChartComponent>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SummaryWidget = ({ data, config, title }) => {
  const metrics = useMemo(() => {
    const result = {};
    Object.entries(config.metrics).forEach(([key, metricDef]) => {
      const values = data.map(r => Number(r[metricDef.field])).filter(v => !isNaN(v));
      let value = null;
      
      switch (metricDef.aggregation) {
        case 'sum': value = values.reduce((a, b) => a + b, 0); break;
        case 'avg': value = values.reduce((a, b) => a + b, 0) / values.length; break;
        case 'count': value = values.length; break;
        case 'max': value = Math.max(...values); break;
        case 'min': value = Math.min(...values); break;
      }
      
      result[key] = formatValue(value, metricDef.format);
    });
    return result;
  }, [data, config]);

  const renderedTemplate = useMemo(() => {
    let text = config.template;
    Object.entries(metrics).forEach(([key, value]) => {
      text = text.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return text;
  }, [config.template, metrics]);

  return (
    <div style={{
      background: 'white',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      padding: '24px',
      height: '100%',
      gridColumn: `span ${config.position?.w || 6}`,
      gridRow: `span ${config.position?.h || 2}`
    }}>
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>{title}</h3>
      <div style={{ lineHeight: 1.8, color: '#4a5568' }}>{renderedTemplate}</div>
    </div>
  );
};

// ==================== DASHBOARD CONFIGS ====================
const DASHBOARD_CONFIGS = {
  sales_analytics: {
    id: 'sales_analytics',
    name: 'Sales Analytics Dashboard',
    description: 'Comprehensive sales performance across regions and products',
    widgets: [
      {
        id: 'kpi1',
        type: 'kpi',
        title: 'Total Revenue',
        dataRef: 'kpi_metrics',
        config: {
          metric: 'current',
          aggregation: 'sum',
          comparison: { metric: 'previous', label: 'vs Last Period' },
          target: 1200000,
          format: { type: 'currency', currency: 'USD', precision: 0 },
          position: { w: 3, h: 2 }
        }
      },
      {
        id: 'kpi2',
        type: 'kpi',
        title: 'Average Deal Size',
        dataRef: 'sales_by_region',
        config: {
          metric: 'avg_price',
          aggregation: 'avg',
          format: { type: 'currency', currency: 'USD', precision: 2 },
          position: { w: 3, h: 2 }
        }
      },
      {
        id: 'kpi3',
        type: 'kpi',
        title: 'Total Units',
        dataRef: 'sales_by_region',
        config: {
          metric: 'units',
          aggregation: 'sum',
          format: { type: 'number', precision: 0 },
          position: { w: 3, h: 2 }
        }
      },
      {
        id: 'kpi4',
        type: 'kpi',
        title: 'Product Count',
        dataRef: 'sales_by_region',
        config: {
          metric: 'product',
          aggregation: 'distinct_count',
          format: { type: 'number', precision: 0 },
          position: { w: 3, h: 2 }
        }
      },
      {
        id: 'pivot1',
        type: 'pivot',
        title: 'Sales by Region & Product',
        dataRef: 'sales_by_region',
        config: {
          rows: ['region', 'product'],
          columns: ['quarter'],
          values: [
            { field: 'revenue', aggregation: 'sum', label: 'Revenue', format: { type: 'currency', currency: 'USD', precision: 0 } },
          ],
          options: { showRowTotals: true, showColumnTotals: true },
          position: { w: 8, h: 5 }
        }
      },
      {
        id: 'chart1',
        type: 'chart',
        title: 'Monthly Revenue Trend',
        dataRef: 'monthly_trends',
        config: {
          chartType: 'line',
          xAxis: 'month',
          yAxis: 'revenue',
          options: { grid: true, tooltip: true },
          position: { w: 4, h: 3 }
        }
      },
      {
        id: 'summary1',
        type: 'summary',
        title: 'Performance Summary',
        dataRef: 'kpi_metrics',
        config: {
          template: 'Current period revenue of {{current_revenue}} represents significant growth from previous period ({{previous_revenue}}). Target: {{target_revenue}}.',
          metrics: {
            current_revenue: { field: 'current', aggregation: 'sum', format: { type: 'currency', precision: 0 } },
            previous_revenue: { field: 'previous', aggregation: 'sum', format: { type: 'currency', precision: 0 } },
            target_revenue: { field: 'target', aggregation: 'sum', format: { type: 'currency', precision: 0 } }
          },
          position: { w: 4, h: 2 }
        }
      }
    ]
  },

  product_analysis: {
    id: 'product_analysis',
    name: 'Product Performance Analysis',
    description: 'Deep dive into product-level metrics and trends',
    widgets: [
      {
        id: 'pivot2',
        type: 'pivot',
        title: 'Product Performance by Category',
        dataRef: 'product_performance',
        config: {
          rows: ['category', 'product'],
          columns: [],
          values: [
            { field: 'sales', aggregation: 'sum', label: 'Sales', format: { type: 'currency', precision: 0 } },
            { field: 'margin', aggregation: 'avg', label: 'Margin %', format: { type: 'percentage', precision: 1 } },
          ],
          options: { showRowTotals: true },
          position: { w: 7, h: 6 }
        }
      },
      {
        id: 'chart2',
        type: 'chart',
        title: 'Sales by Product',
        dataRef: 'product_performance',
        config: {
          chartType: 'bar',
          xAxis: 'product',
          yAxis: 'sales',
          options: { grid: true, tooltip: true },
          position: { w: 5, h: 6 }
        }
      }
    ]
  },

  regional_overview: {
    id: 'regional_overview',
    name: 'Regional Market Overview',
    description: 'Geographic performance and market penetration analysis',
    widgets: [
      {
        id: 'pivot3',
        type: 'pivot',
        title: 'Regional Performance by Year',
        dataRef: 'regional_analysis',
        config: {
          rows: ['region'],
          columns: ['year'],
          values: [
            { field: 'revenue', aggregation: 'sum', label: 'Revenue', format: { type: 'currency', precision: 0 } },
            { field: 'growth', aggregation: 'avg', label: 'Growth %', format: { type: 'percentage', precision: 1 } },
          ],
          options: { showRowTotals: true, showColumnTotals: true },
          position: { w: 8, h: 4 }
        }
      },
      {
        id: 'chart3',
        type: 'chart',
        title: 'Regional Revenue',
        dataRef: 'regional_analysis',
        config: {
          chartType: 'bar',
          xAxis: 'region',
          yAxis: 'revenue',
          options: { grid: true, tooltip: true },
          position: { w: 4, h: 4 }
        }
      },
      {
        id: 'chart4',
        type: 'chart',
        title: 'Growth Trends',
        dataRef: 'regional_analysis',
        config: {
          chartType: 'area',
          xAxis: 'region',
          yAxis: 'growth',
          options: { grid: true, tooltip: true },
          position: { w: 12, h: 3 }
        }
      }
    ]
  },
};

// ==================== WIDGET FACTORY ====================
const WidgetFactory = ({ spec, data }) => {
  const components = {
    pivot: PivotTableWidget,
    kpi: KPICardWidget,
    chart: ChartWidget,
    summary: SummaryWidget,
  };

  const Component = components[spec.type];
  if (!Component) return <div>Unknown widget type: {spec.type}</div>;

  return <Component data={data} config={spec.config} title={spec.title} />;
};

// ==================== MAIN APP ====================
export default function DashboardPrototype() {
  const [selectedDashboard, setSelectedDashboard] = useState('sales_analytics');
  const [dataCache, setDataCache] = useState({});

  const dashboardSpec = DASHBOARD_CONFIGS[selectedDashboard];

  useEffect(() => {
    const refs = new Set(dashboardSpec.widgets.map(w => w.dataRef));
    const newCache = {};
    
    refs.forEach(ref => {
      newCache[ref] = MockDataService.generateRandomData(ref);
    });
    
    setDataCache(newCache);
  }, [selectedDashboard, dashboardSpec]);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <header style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '24px 32px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>🎯 Dashboard System Prototype</h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '14px', fontWeight: 500, color: '#4a5568' }}>Dashboard:</label>
            <select 
              value={selectedDashboard} 
              onChange={(e) => setSelectedDashboard(e.target.value)}
              style={{
                padding: '8px 16px',
                border: '1px solid #cbd5e0',
                borderRadius: '6px',
                background: 'white',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="sales_analytics">Sales Analytics</option>
              <option value="product_analysis">Product Analysis</option>
              <option value="regional_overview">Regional Overview</option>
            </select>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '32px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 700, marginBottom: '8px' }}>{dashboardSpec.name}</h2>
          <p style={{ color: '#718096', fontSize: '16px' }}>{dashboardSpec.description}</p>
        </div>

        <div style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gridAutoRows: '80px'
        }}>
          {dashboardSpec.widgets.map(widget => (
            <WidgetFactory 
              key={widget.id} 
              spec={widget} 
              data={dataCache[widget.dataRef] || []} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}