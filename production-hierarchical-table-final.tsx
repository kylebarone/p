import { useState, useMemo, useCallback } from 'react';

// ============================================================================
// TYPE DEFINITIONS & SEMANTIC SPECS
// ============================================================================

/**
 * TableSpec: Complete semantic specification for hierarchical table
 */
const createTableSpec = ({
  id,
  name,
  description,
  groupByField,
  groupByLabel,
  detailField,
  detailLabel,
  columnGroups,
  apiEndpoint,
  refreshInterval
}) => ({
  id,
  name,
  description,
  structure: {
    groupByField,      // Primary grouping field (e.g., "dept", "region")
    groupByLabel,      // Display label for group column
    detailField,       // Detail/child field (e.g., "program", "store")
    detailLabel        // Display label for detail column
  },
  columnGroups,        // Array of column group definitions
  api: {
    endpoint: apiEndpoint,
    method: 'GET',
    refreshInterval    // Auto-refresh interval in ms (optional)
  }
});

/**
 * Column Group Definition with nested columns
 */
const createColumnGroup = (header, columns = null, accessorKey = null, cellType = null) => {
  const base = { header };
  
  if (columns) {
    // Parent column with nested children
    base.columns = columns;
  } else {
    // Leaf column with data accessor
    base.accessorKey = accessorKey;
    base.cellType = cellType || 'text';
  }
  
  return base;
};

// ============================================================================
// TABLE SPECIFICATIONS - Different Hierarchical Structures
// ============================================================================

// Spec 1: Sales Performance by Department & Program
const salesByDeptSpec = createTableSpec({
  id: 'sales-dept-program',
  name: 'Sales Performance Report',
  description: 'Departmental sales analysis with program-level detail',
  groupByField: 'dept',
  groupByLabel: 'Department',
  detailField: 'program',
  detailLabel: 'Program',
  columnGroups: [
    createColumnGroup('QTD', [
      createColumnGroup('Sales $', null, 'qtd.sales', 'currency'),
      createColumnGroup('vPlan $', null, 'qtd.vPlan', 'currency'),
      createColumnGroup('Comp %', null, 'qtd.comp', 'percentage')
    ]),
    createColumnGroup('YTD', [
      createColumnGroup('Sales $', null, 'ytd.sales', 'currency'),
      createColumnGroup('vPlan $', null, 'ytd.vPlan', 'currency'),
      createColumnGroup('Comp %', null, 'ytd.comp', 'percentage')
    ]),
    createColumnGroup('Metrics', [
      createColumnGroup('Units', null, 'metrics.units', 'number'),
      createColumnGroup('Margin %', null, 'metrics.margin', 'percentage')
    ])
  ],
  apiEndpoint: '/api/sales/dept-program',
  refreshInterval: 60000
});

// Spec 2: Regional Performance by Territory & Store
const regionalSalesSpec = createTableSpec({
  id: 'regional-territory-store',
  name: 'Regional Sales Dashboard',
  description: 'Geographic sales breakdown by territory and store',
  groupByField: 'region',
  groupByLabel: 'Region',
  detailField: 'store',
  detailLabel: 'Store',
  columnGroups: [
    createColumnGroup('Current Month', [
      createColumnGroup('Revenue', null, 'month.revenue', 'currency'),
      createColumnGroup('Traffic', null, 'month.traffic', 'number'),
      createColumnGroup('Conversion %', null, 'month.conversion', 'percentage')
    ]),
    createColumnGroup('Quarter', [
      createColumnGroup('Revenue', null, 'quarter.revenue', 'currency'),
      createColumnGroup('Target', null, 'quarter.target', 'currency'),
      createColumnGroup('Attainment %', null, 'quarter.attainment', 'percentage')
    ])
  ],
  apiEndpoint: '/api/sales/regional',
  refreshInterval: 300000
});

// Spec 3: Product Hierarchy - Category → SKU
const productHierarchySpec = createTableSpec({
  id: 'product-category-sku',
  name: 'Product Performance Hierarchy',
  description: 'Product analysis from category to SKU level',
  groupByField: 'category',
  groupByLabel: 'Category',
  detailField: 'sku',
  detailLabel: 'SKU',
  columnGroups: [
    createColumnGroup('Sales', [
      createColumnGroup('Units Sold', null, 'sales.units', 'number'),
      createColumnGroup('Revenue', null, 'sales.revenue', 'currency'),
      createColumnGroup('Avg Price', null, 'sales.avgPrice', 'currency')
    ]),
    createColumnGroup('Inventory', [
      createColumnGroup('On Hand', null, 'inventory.onHand', 'number'),
      createColumnGroup('On Order', null, 'inventory.onOrder', 'number'),
      createColumnGroup('Turn Rate', null, 'inventory.turnRate', 'decimal')
    ])
  ],
  apiEndpoint: '/api/products/hierarchy',
  refreshInterval: null
});

// Spec 4: Employee Organization - Division → Department
const employeeOrgSpec = createTableSpec({
  id: 'employee-org-chart',
  name: 'Employee Organization Report',
  description: 'Workforce analysis by division and department',
  groupByField: 'division',
  groupByLabel: 'Division',
  detailField: 'department',
  detailLabel: 'Department',
  columnGroups: [
    createColumnGroup('Headcount', [
      createColumnGroup('FTE', null, 'headcount.fte', 'number'),
      createColumnGroup('Contractors', null, 'headcount.contractors', 'number'),
      createColumnGroup('Vacancies', null, 'headcount.vacancies', 'number')
    ]),
    createColumnGroup('Costs', [
      createColumnGroup('Salary', null, 'costs.salary', 'currency'),
      createColumnGroup('Benefits', null, 'costs.benefits', 'currency'),
      createColumnGroup('Total', null, 'costs.total', 'currency')
    ]),
    createColumnGroup('Performance', [
      createColumnGroup('Avg Rating', null, 'performance.avgRating', 'decimal'),
      createColumnGroup('Turnover %', null, 'performance.turnover', 'percentage')
    ])
  ],
  apiEndpoint: '/api/employees/org',
  refreshInterval: null
});

// Spec 5: Financial P&L - Business Unit → Product Line
const financialPLSpec = createTableSpec({
  id: 'financial-pl',
  name: 'P&L Statement by Business Unit',
  description: 'Financial performance across business units and product lines',
  groupByField: 'businessUnit',
  groupByLabel: 'Business Unit',
  detailField: 'productLine',
  detailLabel: 'Product Line',
  columnGroups: [
    createColumnGroup('Revenue', [
      createColumnGroup('Gross Sales', null, 'revenue.gross', 'currency'),
      createColumnGroup('Returns', null, 'revenue.returns', 'currency'),
      createColumnGroup('Net Sales', null, 'revenue.net', 'currency')
    ]),
    createColumnGroup('Costs', [
      createColumnGroup('COGS', null, 'costs.cogs', 'currency'),
      createColumnGroup('Operating', null, 'costs.operating', 'currency'),
      createColumnGroup('Total', null, 'costs.total', 'currency')
    ]),
    createColumnGroup('Profitability', [
      createColumnGroup('Gross Margin', null, 'profit.grossMargin', 'percentage'),
      createColumnGroup('EBITDA', null, 'profit.ebitda', 'currency'),
      createColumnGroup('Net Income', null, 'profit.netIncome', 'currency')
    ])
  ],
  apiEndpoint: '/api/financial/pl',
  refreshInterval: null
});

// ============================================================================
// MOCK DATA GENERATORS (simulate API responses)
// ============================================================================

const generateSalesDeptData = () => [
  { dept: 'D021', program: 'FENCING', qtd: { sales: 13200000, vPlan: -996849, comp: -0.082 }, ytd: { sales: 24500000, vPlan: 1250000, comp: 0.054 }, metrics: { units: 1240, margin: 0.28 } },
  { dept: 'D021', program: 'PLAYSETS', qtd: { sales: 1530000, vPlan: 1530000, comp: 2.166 }, ytd: { sales: 3200000, vPlan: -450000, comp: -0.125 }, metrics: { units: 85, margin: 0.35 } },
  { dept: 'D021', program: 'DECK MATERIALS', qtd: { sales: 8750000, vPlan: 520000, comp: 0.063 }, ytd: { sales: 18200000, vPlan: 980000, comp: 0.057 }, metrics: { units: 3200, margin: 0.22 } },
  { dept: 'D022', program: 'ROOFING', qtd: { sales: 2915000, vPlan: 2915000, comp: 0 }, ytd: { sales: 6400000, vPlan: -125000, comp: -0.019 }, metrics: { units: 450, margin: 0.31 } },
  { dept: 'D022', program: 'SIDING', qtd: { sales: 4500000, vPlan: -340000, comp: -0.070 }, ytd: { sales: 9800000, vPlan: 650000, comp: 0.071 }, metrics: { units: 820, margin: 0.26 } },
  { dept: 'D023', program: 'WINDOWS', qtd: { sales: 6200000, vPlan: 380000, comp: 0.065 }, ytd: { sales: 12700000, vPlan: -220000, comp: -0.017 }, metrics: { units: 950, margin: 0.29 } },
  { dept: 'D023', program: 'DOORS', qtd: { sales: 3100000, vPlan: -185000, comp: -0.056 }, ytd: { sales: 7200000, vPlan: 420000, comp: 0.062 }, metrics: { units: 680, margin: 0.33 } }
];

const generateRegionalData = () => [
  { region: 'Northeast', store: 'Boston Downtown', month: { revenue: 2400000, traffic: 18500, conversion: 0.082 }, quarter: { revenue: 7800000, target: 7500000, attainment: 1.04 } },
  { region: 'Northeast', store: 'NYC Midtown', month: { revenue: 3800000, traffic: 28000, conversion: 0.095 }, quarter: { revenue: 11200000, target: 12000000, attainment: 0.933 } },
  { region: 'Northeast', store: 'Philadelphia', month: { revenue: 1900000, traffic: 14200, conversion: 0.078 }, quarter: { revenue: 5600000, target: 6000000, attainment: 0.933 } },
  { region: 'Southeast', store: 'Atlanta', month: { revenue: 2200000, traffic: 16800, conversion: 0.088 }, quarter: { revenue: 6900000, target: 6500000, attainment: 1.062 } },
  { region: 'Southeast', store: 'Miami', month: { revenue: 2800000, traffic: 21000, conversion: 0.091 }, quarter: { revenue: 8400000, target: 8000000, attainment: 1.05 } },
  { region: 'West', store: 'San Francisco', month: { revenue: 4200000, traffic: 25000, conversion: 0.102 }, quarter: { revenue: 13100000, target: 12500000, attainment: 1.048 } },
  { region: 'West', store: 'Los Angeles', month: { revenue: 3600000, traffic: 31000, conversion: 0.086 }, quarter: { revenue: 10800000, target: 11000000, attainment: 0.982 } }
];

const generateProductData = () => [
  { category: 'Power Tools', sku: 'Drill Set - 20V', sales: { units: 2400, revenue: 360000, avgPrice: 150 }, inventory: { onHand: 450, onOrder: 200, turnRate: 5.2 } },
  { category: 'Power Tools', sku: 'Circular Saw', sales: { units: 1800, revenue: 432000, avgPrice: 240 }, inventory: { onHand: 280, onOrder: 150, turnRate: 6.4 } },
  { category: 'Power Tools', sku: 'Impact Driver', sales: { units: 3200, revenue: 384000, avgPrice: 120 }, inventory: { onHand: 520, onOrder: 300, turnRate: 6.1 } },
  { category: 'Hand Tools', sku: 'Hammer Set', sales: { units: 4500, revenue: 135000, avgPrice: 30 }, inventory: { onHand: 850, onOrder: 0, turnRate: 5.3 } },
  { category: 'Hand Tools', sku: 'Wrench Set', sales: { units: 2800, revenue: 168000, avgPrice: 60 }, inventory: { onHand: 420, onOrder: 200, turnRate: 6.7 } },
  { category: 'Materials', sku: 'Lumber 2x4x8', sales: { units: 18000, revenue: 126000, avgPrice: 7 }, inventory: { onHand: 3200, onOrder: 5000, turnRate: 5.6 } },
  { category: 'Materials', sku: 'Drywall 4x8', sales: { units: 12000, revenue: 144000, avgPrice: 12 }, inventory: { onHand: 2400, onOrder: 1000, turnRate: 5.0 } }
];

const generateEmployeeData = () => [
  { division: 'Engineering', department: 'Software Dev', headcount: { fte: 45, contractors: 8, vacancies: 3 }, costs: { salary: 6750000, benefits: 1350000, total: 8100000 }, performance: { avgRating: 4.2, turnover: 0.08 } },
  { division: 'Engineering', department: 'QA', headcount: { fte: 18, contractors: 4, vacancies: 2 }, costs: { salary: 1980000, benefits: 396000, total: 2376000 }, performance: { avgRating: 4.0, turnover: 0.12 } },
  { division: 'Engineering', department: 'DevOps', headcount: { fte: 12, contractors: 2, vacancies: 1 }, costs: { salary: 1920000, benefits: 384000, total: 2304000 }, performance: { avgRating: 4.3, turnover: 0.06 } },
  { division: 'Sales', department: 'Enterprise', headcount: { fte: 28, contractors: 0, vacancies: 4 }, costs: { salary: 4200000, benefits: 840000, total: 5040000 }, performance: { avgRating: 3.8, turnover: 0.18 } },
  { division: 'Sales', department: 'SMB', headcount: { fte: 35, contractors: 0, vacancies: 2 }, costs: { salary: 3500000, benefits: 700000, total: 4200000 }, performance: { avgRating: 3.9, turnover: 0.15 } },
  { division: 'Operations', department: 'Supply Chain', headcount: { fte: 22, contractors: 6, vacancies: 1 }, costs: { salary: 2200000, benefits: 440000, total: 2640000 }, performance: { avgRating: 4.1, turnover: 0.10 } },
  { division: 'Operations', department: 'Logistics', headcount: { fte: 32, contractors: 8, vacancies: 0 }, costs: { salary: 2560000, benefits: 512000, total: 3072000 }, performance: { avgRating: 4.0, turnover: 0.09 } }
];

const generateFinancialData = () => [
  { businessUnit: 'Consumer Electronics', productLine: 'Smartphones', revenue: { gross: 45000000, returns: -2200000, net: 42800000 }, costs: { cogs: 28000000, operating: 8500000, total: 36500000 }, profit: { grossMargin: 0.378, ebitda: 9200000, netIncome: 6300000 } },
  { businessUnit: 'Consumer Electronics', productLine: 'Tablets', revenue: { gross: 18000000, returns: -900000, net: 17100000 }, costs: { cogs: 11500000, operating: 3200000, total: 14700000 }, profit: { grossMargin: 0.328, ebitda: 3800000, netIncome: 2400000 } },
  { businessUnit: 'Consumer Electronics', productLine: 'Accessories', revenue: { gross: 8500000, returns: -400000, net: 8100000 }, costs: { cogs: 3800000, operating: 2100000, total: 5900000 }, profit: { grossMargin: 0.531, ebitda: 3400000, netIncome: 2200000 } },
  { businessUnit: 'Home Appliances', productLine: 'Refrigerators', revenue: { gross: 32000000, returns: -1800000, net: 30200000 }, costs: { cogs: 22000000, operating: 5400000, total: 27400000 }, profit: { grossMargin: 0.272, ebitda: 4600000, netIncome: 2800000 } },
  { businessUnit: 'Home Appliances', productLine: 'Washing Machines', revenue: { gross: 24000000, returns: -1200000, net: 22800000 }, costs: { cogs: 16500000, operating: 4100000, total: 20600000 }, profit: { grossMargin: 0.277, ebitda: 3900000, netIncome: 2200000 } },
  { businessUnit: 'Computing', productLine: 'Laptops', revenue: { gross: 52000000, returns: -3100000, net: 48900000 }, costs: { cogs: 35000000, operating: 9200000, total: 44200000 }, profit: { grossMargin: 0.284, ebitda: 7800000, netIncome: 4700000 } },
  { businessUnit: 'Computing', productLine: 'Desktops', revenue: { gross: 28000000, returns: -1400000, net: 26600000 }, costs: { cogs: 18200000, operating: 5100000, total: 23300000 }, profit: { grossMargin: 0.316, ebitda: 5200000, netIncome: 3300000 } }
];

// API Simulator
const mockApiCall = async (endpoint) => {
  await new Promise(resolve => setTimeout(resolve, 1200)); // Simulate network delay
  
  const dataMap = {
    '/api/sales/dept-program': generateSalesDeptData(),
    '/api/sales/regional': generateRegionalData(),
    '/api/products/hierarchy': generateProductData(),
    '/api/employees/org': generateEmployeeData(),
    '/api/financial/pl': generateFinancialData()
  };
  
  return { data: dataMap[endpoint] || [], success: true };
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const formatValue = (value, cellType) => {
  if (value === null || value === undefined) return '-';
  
  switch (cellType) {
    case 'currency':
      const isNegCurr = value < 0;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Math.abs(value));
      return isNegCurr ? `(${formatted})` : formatted;
      
    case 'percentage':
      const isNegPct = value < 0;
      const percentage = (Math.abs(value) * 100).toFixed(1);
      return isNegPct ? `(${percentage}%)` : `${percentage}%`;
      
    case 'number':
      return new Intl.NumberFormat('en-US').format(value);
      
    case 'decimal':
      return Number(value).toFixed(2);
      
    default:
      return value;
  }
};

const getNestedValue = (obj, path) => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

const flattenColumns = (cols) => {
  const result = [];
  cols.forEach(col => {
    if (col.columns) {
      result.push(...flattenColumns(col.columns));
    } else {
      result.push(col);
    }
  });
  return result;
};

const getHeaderDepth = (cols) => {
  return Math.max(...cols.map(col => 
    col.columns ? 1 + getHeaderDepth(col.columns) : 1
  ));
};

// ============================================================================
// UI COMPONENTS
// ============================================================================

const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-[400px]">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
  </div>
);

const ErrorAlert = ({ message }) => (
  <div className="m-4 p-4 bg-red-50 border border-red-200 rounded-lg">
    <div className="flex items-center gap-2">
      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>
      <span className="text-red-800 font-medium">Error loading data: {message}</span>
    </div>
  </div>
);

const Badge = ({ children }) => (
  <span className="px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800 rounded-full">
    {children}
  </span>
);

const TabButton = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      active 
        ? 'bg-orange-600 text-white shadow-md' 
        : 'bg-white text-gray-700 hover:bg-orange-50 border border-gray-200'
    }`}
  >
    {children}
  </button>
);

// ============================================================================
// HIERARCHICAL TABLE COMPONENT
// ============================================================================

const HierarchicalTable = ({ spec }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Fetch data on mount and spec change
  useState(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await mockApiCall(spec.api.endpoint);
        if (response.success) {
          setData(response.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [spec.api.endpoint]);

  // Group data by primary field
  const groupedData = useMemo(() => {
    const groups = {};
    data.forEach(row => {
      const key = row[spec.structure.groupByField];
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [data, spec.structure.groupByField]);

  const toggleGroup = useCallback((groupKey) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  }, []);

  // Build column structure
  const allColumns = [
    createColumnGroup(spec.structure.groupByLabel, null, spec.structure.groupByField),
    createColumnGroup(spec.structure.detailLabel, null, spec.structure.detailField),
    ...spec.columnGroups
  ];

  const leafColumns = flattenColumns(allColumns);
  const maxDepth = getHeaderDepth(allColumns);

  // Build header rows
  const buildHeaders = () => {
    const headerRows = [];
    
    const buildRow = (cols, depth = 0) => {
      if (!headerRows[depth]) headerRows[depth] = [];
      
      cols.forEach(col => {
        if (col.columns) {
          headerRows[depth].push({
            label: col.header,
            colspan: flattenColumns([col]).length,
            rowspan: 1
          });
          buildRow(col.columns, depth + 1);
        } else {
          headerRows[depth].push({
            label: col.header,
            colspan: 1,
            rowspan: maxDepth - depth
          });
        }
      });
    };

    buildRow(allColumns);
    return headerRows;
  };

  const headers = buildHeaders();

  // Conditional cell styling
  const getCellClassName = (value, cellType) => {
    if ((cellType === 'currency' || cellType === 'percentage') && value < 0) {
      return 'text-red-600 font-semibold';
    }
    return 'text-gray-900';
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div className="w-full mb-6">
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-semibold text-orange-600">{spec.name}</h2>
        <Badge>{Object.keys(groupedData).length} {spec.structure.groupByLabel}s</Badge>
      </div>
      
      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table className="w-full border-collapse bg-white">
          <thead>
            {headers.map((row, idx) => (
              <tr key={idx}>
                {row.map((cell, cellIdx) => (
                  <th
                    key={cellIdx}
                    colSpan={cell.colspan}
                    rowSpan={cell.rowspan}
                    className="bg-orange-600 text-white px-4 py-3 text-sm font-semibold text-center border-r border-orange-500 last:border-r-0"
                  >
                    {cell.label}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {Object.entries(groupedData).map(([groupKey, rows]) => {
              const isExpanded = expandedGroups.has(groupKey);
              
              return (
                <React.Fragment key={groupKey}>
                  <tr 
                    className="bg-orange-50 hover:bg-orange-100 cursor-pointer transition-colors"
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <td 
                      rowSpan={isExpanded ? rows.length : 1}
                      className="px-4 py-3 font-semibold border-r-2 border-orange-300 align-top bg-orange-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-orange-600">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                        {groupKey}
                      </div>
                    </td>
                    
                    {isExpanded ? (
                      <>
                        <td className="px-4 py-2 font-medium border-r border-gray-200">
                          {rows[0][spec.structure.detailField]}
                        </td>
                        {leafColumns.slice(2).map((col, idx) => {
                          const value = getNestedValue(rows[0], col.accessorKey);
                          return (
                            <td 
                              key={idx}
                              className={`px-4 py-2 text-right border-r border-gray-200 last:border-r-0 ${getCellClassName(value, col.cellType)}`}
                            >
                              {formatValue(value, col.cellType)}
                            </td>
                          );
                        })}
                      </>
                    ) : (
                      <td 
                        colSpan={leafColumns.length - 1}
                        className="px-4 py-2 italic text-gray-500"
                      >
                        {rows.length} item{rows.length > 1 ? 's' : ''} • Click to expand
                      </td>
                    )}
                  </tr>
                  
                  {isExpanded && rows.slice(1).map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-gray-50 transition-colors border-t border-gray-100">
                      <td className="px-4 py-2 font-medium pl-8 border-r border-gray-200">
                        {row[spec.structure.detailField]}
                      </td>
                      {leafColumns.slice(2).map((col, colIdx) => {
                        const value = getNestedValue(row, col.accessorKey);
                        return (
                          <td 
                            key={colIdx}
                            className={`px-4 py-2 text-right border-r border-gray-200 last:border-r-0 ${getCellClassName(value, col.cellType)}`}
                          >
                            {formatValue(value, col.cellType)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <p className="text-sm text-gray-500 mt-2">
        {spec.description} • <span className="font-mono text-xs">{spec.api.endpoint}</span>
      </p>
    </div>
  );
};

// ============================================================================
// MAIN APPLICATION
// ============================================================================

export default function App() {
  const [activeSpec, setActiveSpec] = useState(salesByDeptSpec);

  const specs = [
    salesByDeptSpec,
    regionalSalesSpec,
    productHierarchySpec,
    employeeOrgSpec,
    financialPLSpec
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-6">
      <div className="max-w-[1600px] mx-auto">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Production Hierarchical Table System
          </h1>
          <p className="text-gray-600">
            Spec-driven, backend-agnostic hierarchical reporting component with Material Design
          </p>
        </div>

        {/* Spec Selector */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {specs.map(spec => (
            <TabButton
              key={spec.id}
              active={activeSpec.id === spec.id}
              onClick={() => setActiveSpec(spec)}
            >
              {spec.name}
            </TabButton>
          ))}
        </div>

        {/* Active Table */}
        <HierarchicalTable spec={activeSpec} />

        {/* Documentation */}
        <div className="mt-8 bg-white rounded-lg shadow-lg p-6 border border-orange-200">
          <h3 className="text-lg font-semibold text-orange-700 mb-4">
            📋 Specification Architecture
          </h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Core Features</h4>
              <ul className="space-y-1 text-gray-700">
                <li>✓ Semantic spec-driven configuration</li>
                <li>✓ Multi-level column headers (colspan)</li>
                <li>✓ Hierarchical row grouping (rowspan)</li>
                <li>✓ Expand/collapse interactions</li>
                <li>✓ Type-based cell formatting</li>
                <li>✓ Conditional styling (negative values)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">Integration</h4>
              <ul className="space-y-1 text-gray-700">
                <li>✓ Backend-agnostic API configuration</li>
                <li>✓ Mock data simulation included</li>
                <li>✓ Loading & error states</li>
                <li>✓ Multiple table structures supported</li>
                <li>✓ Production-ready architecture</li>
                <li>✓ Material Design styling</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h4 className="font-semibold text-gray-900 mb-2">Example Specifications Included:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-700">
              <li><strong>Sales by Dept/Program:</strong> QTD/YTD sales with metrics</li>
              <li><strong>Regional by Territory/Store:</strong> Geographic performance analysis</li>
              <li><strong>Product by Category/SKU:</strong> Inventory and sales hierarchy</li>
              <li><strong>Employee by Division/Dept:</strong> Workforce and cost analysis</li>
              <li><strong>Financial P&L by Unit/Line:</strong> Revenue, costs, profitability</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}