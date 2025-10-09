import React, { useState, useCallback, useRef, useEffect, createContext, useContext, useMemo } from 'react';

// ============= TYPES =============
interface PixelCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
  viewport: { width: number; height: number };
}

interface Selection {
  id: string;
  timestamp: string;
  bbox: PixelCoordinates;
  contentType: string;
  extracted: {
    type: string;
    text?: string;
    image?: string;
    metadata?: any;
  };
}

// ============= CONTEXT =============
const SelectionContext = createContext<any>(null);

const useSelection = () => {
  const context = useContext(SelectionContext);
  if (!context) throw new Error('useSelection must be used within SelectionProvider');
  return context;
};

const SelectionProvider = ({ children, contentType }) => {
  const [isActive, setIsActive] = useState(false);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [activeSelection, setActiveSelection] = useState<Selection | null>(null);

  const startSelection = useCallback(() => setIsActive(true), []);
  const endSelection = useCallback(() => setIsActive(false), []);

  const addSelection = useCallback((selection: Omit<Selection, 'id' | 'timestamp'>) => {
    const newSelection: Selection = {
      ...selection,
      id: `sel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };
    setSelections(prev => [...prev, newSelection]);
    return newSelection;
  }, []);

  const removeSelection = useCallback((id: string) => {
    setSelections(prev => prev.filter(s => s.id !== id));
  }, []);

  const clearSelections = useCallback(() => setSelections([]), []);

  const handleExtraction = useCallback(async (bbox: PixelCoordinates, context: any) => {
    // Mock extraction based on content type
    let extracted;
    
    if (contentType === 'pdf') {
      extracted = {
        type: 'pdf',
        text: `This is extracted text from PDF page 1 at coordinates (${Math.round(bbox.x)}, ${Math.round(bbox.y)}). The selection captures content about neural networks and their applications in modern AI systems.`,
        metadata: {
          page: 1,
          totalPages: 10,
          documentTitle: 'AI Research Paper'
        }
      };
    } else if (contentType === 'table') {
      extracted = {
        type: 'table',
        text: 'Region\tQ1\tQ2\tQ3\tQ4\nNorth\t$125K\t$142K\t$138K\t$156K\nSouth\t$98K\t$105K\t$112K\t$128K',
        metadata: {
          columns: ['Region', 'Q1', 'Q2', 'Q3', 'Q4'],
          cellRange: 'A1:E3',
          description: 'Revenue by Region and Quarter'
        }
      };
    } else {
      extracted = {
        type: 'dashboard',
        text: 'Revenue Chart: $1.2M total, 15% growth YoY',
        metadata: {
          components: [
            { id: 'chart-1', type: 'line-chart', name: 'Revenue Trend' },
            { id: 'metric-1', type: 'kpi', name: 'Total Revenue' }
          ],
          description: 'Dashboard with 2 components'
        }
      };
    }

    const selection = addSelection({ bbox, contentType, extracted });
    endSelection();
    return selection;
  }, [contentType, addSelection, endSelection]);

  return (
    <SelectionContext.Provider value={{
      isActive,
      selections,
      activeSelection,
      startSelection,
      endSelection,
      handleExtraction,
      removeSelection,
      clearSelections,
      setActiveSelection,
      contentType
    }}>
      {children}
    </SelectionContext.Provider>
  );
};

// ============= COMPONENTS =============

const SelectionOverlay = ({ containerRef, onSelectionComplete }) => {
  const { isActive } = useSelection();
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);

  const getRelativeCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    if (!containerRef?.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      viewportWidth: rect.width,
      viewportHeight: rect.height
    };
  }, [containerRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isActive) return;
    e.preventDefault();
    const coords = getRelativeCoords(e);
    if (coords) {
      setStart(coords);
      setDrawing(true);
    }
  }, [isActive, getRelativeCoords]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!drawing || !start) return;
    const coords = getRelativeCoords(e);
    if (coords) setCurrent({ x: coords.x, y: coords.y });
  }, [drawing, start, getRelativeCoords]);

  const handleMouseUp = useCallback(() => {
    if (!drawing || !start || !current) {
      setDrawing(false);
      return;
    }

    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);

    if (width < 10 || height < 10) {
      setDrawing(false);
      setStart(null);
      setCurrent(null);
      return;
    }

    const bbox: PixelCoordinates = {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width,
      height,
      viewport: { width: start.viewportWidth, height: start.viewportHeight }
    };

    onSelectionComplete?.(bbox);
    setDrawing(false);
    setStart(null);
    setCurrent(null);
  }, [drawing, start, current, onSelectionComplete]);

  useEffect(() => {
    if (drawing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [drawing, handleMouseMove, handleMouseUp]);

  const currentBox = useMemo(() => {
    if (!start || !current) return null;
    return {
      x: Math.min(start.x, current.x),
      y: Math.min(start.y, current.y),
      width: Math.abs(current.x - start.x),
      height: Math.abs(current.y - start.y)
    };
  }, [start, current]);

  if (!isActive) return null;

  return (
    <div
      className="absolute inset-0 z-50"
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
    >
      {currentBox && (
        <div
          className="absolute border-2 border-blue-500 bg-blue-500/10 pointer-events-none"
          style={{
            left: currentBox.x,
            top: currentBox.y,
            width: currentBox.width,
            height: currentBox.height
          }}
        >
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
            {Math.round(currentBox.width)} × {Math.round(currentBox.height)}
          </div>
        </div>
      )}
    </div>
  );
};

const PersistentSelection = ({ selection }) => {
  const { removeSelection } = useSelection();
  const [isHovered, setIsHovered] = useState(false);

  const colors = {
    pdf: 'border-blue-500 bg-blue-500/10',
    table: 'border-green-500 bg-green-500/10',
    dashboard: 'border-purple-500 bg-purple-500/10'
  };

  return (
    <div
      className={`absolute border-2 transition-all ${colors[selection.contentType] || 'border-gray-500 bg-gray-500/10'}`}
      style={{
        left: selection.bbox.x,
        top: selection.bbox.y,
        width: selection.bbox.width,
        height: selection.bbox.height,
        opacity: isHovered ? 0.8 : 0.4,
        pointerEvents: 'auto'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <>
          <div className="absolute -top-8 right-0 flex gap-1 bg-white shadow-lg rounded px-2 py-1">
            <button
              onClick={() => removeSelection(selection.id)}
              className="text-red-500 hover:text-red-700 font-bold"
            >
              ×
            </button>
          </div>
          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded capitalize">
            {selection.contentType}
          </div>
        </>
      )}
    </div>
  );
};

const SelectableContent = ({ children, contentRef, context = {} }) => {
  const { isActive, handleExtraction, selections } = useSelection();

  const onComplete = useCallback(async (bbox: PixelCoordinates) => {
    await handleExtraction(bbox, { containerRef: contentRef, ...context });
  }, [handleExtraction, contentRef, context]);

  return (
    <div className="relative h-full" ref={contentRef}>
      {children}
      <SelectionOverlay containerRef={contentRef} onSelectionComplete={onComplete} />
      {selections.map(selection => (
        <PersistentSelection key={selection.id} selection={selection} />
      ))}
    </div>
  );
};

const ContextCard = ({ context }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const icons = { pdf: '📄', table: '📊', dashboard: '📈' };

  return (
    <div className="bg-white border rounded-lg p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="text-2xl">{icons[context.contentType]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-gray-500 capitalize">{context.contentType}</span>
            {context.extracted.metadata?.page && (
              <span className="text-xs text-gray-400">Page {context.extracted.metadata.page}</span>
            )}
          </div>
          <p className="text-sm text-gray-700 line-clamp-2">
            {context.extracted.text?.substring(0, 80)}...
          </p>
        </div>
        <button className="text-gray-400 hover:text-gray-600">{isExpanded ? '−' : '+'}</button>
      </div>
      {isExpanded && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div>
            <strong className="text-xs text-gray-600">Full Text:</strong>
            <p className="text-xs text-gray-700 mt-1">{context.extracted.text}</p>
          </div>
          {context.extracted.metadata && (
            <div>
              <strong className="text-xs text-gray-600">Metadata:</strong>
              <pre className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded overflow-x-auto">
                {JSON.stringify(context.extracted.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Message = ({ message }) => {
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${isUser ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-xs mt-1 ${isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
};

const ContextSidebar = () => {
  const { isActive, startSelection, endSelection, selections, clearSelections } = useSelection();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMsg]);

    // Mock AI response
    setTimeout(() => {
      const aiMsg = {
        role: 'assistant',
        content: `I can see you've selected ${selections.length} region(s). ${selections.length > 0 ? `The last selection shows: "${selections[selections.length - 1]?.extracted.text?.substring(0, 100)}..."` : 'Please select a region to analyze.'}`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, aiMsg]);
    }, 500);

    setInput('');
  };

  return (
    <div className="w-96 border-l flex flex-col h-full bg-white">
      <div className="p-4 border-b flex items-center justify-between bg-gray-50">
        <div>
          <h2 className="font-semibold text-lg">AI Assistant</h2>
          <p className="text-xs text-gray-500">{selections.length} context{selections.length !== 1 ? 's' : ''} selected</p>
        </div>
        <button
          onClick={isActive ? endSelection : startSelection}
          className={`px-3 py-1.5 rounded font-medium transition-colors ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}
        >
          {isActive ? 'Cancel' : 'Select'}
        </button>
      </div>

      {selections.length > 0 && (
        <div className="p-4 border-b bg-blue-50 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Active Contexts</span>
            <button onClick={clearSelections} className="text-xs text-red-600 hover:text-red-800 font-medium">
              Clear All
            </button>
          </div>
          <div className="space-y-2">
            {selections.map(ctx => <ContextCard key={ctx.id} context={ctx} />)}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-sm">Select a region to get started</p>
            <p className="text-xs mt-2">Draw a box around content to ask questions</p>
          </div>
        ) : (
          messages.map((msg, i) => <Message key={i} message={msg} />)
        )}
      </div>

      <div className="p-4 border-t bg-gray-50">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            placeholder="Ask about selected content..."
            className="flex-1 border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors self-end"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// ============= MOCK CONTENT =============

const PDFContent = () => (
  <div className="h-full bg-gray-100 p-8 overflow-auto">
    <div className="max-w-3xl mx-auto bg-white shadow-lg p-12 min-h-full">
      <h1 className="text-3xl font-bold mb-4">Neural Networks in Modern AI</h1>
      <p className="mb-4 text-gray-700 leading-relaxed">
        Deep learning has revolutionized the field of artificial intelligence through the development 
        of sophisticated neural network architectures. These networks, inspired by biological neurons, 
        consist of interconnected layers that process and transform data.
      </p>
      <h2 className="text-2xl font-semibold mb-3 mt-6">Architecture Overview</h2>
      <p className="mb-4 text-gray-700 leading-relaxed">
        Modern neural networks typically employ multiple hidden layers, enabling them to learn 
        hierarchical representations of data. Each layer extracts increasingly abstract features, 
        from simple patterns in early layers to complex concepts in deeper layers.
      </p>
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 my-6">
        <p className="text-sm text-blue-900">
          <strong>Key Insight:</strong> The power of deep learning lies in its ability to automatically 
          discover relevant features from raw data, eliminating the need for manual feature engineering.
        </p>
      </div>
      <h2 className="text-2xl font-semibold mb-3 mt-6">Training Methodology</h2>
      <p className="mb-4 text-gray-700 leading-relaxed">
        Training involves iteratively adjusting network weights using backpropagation and gradient 
        descent. The process minimizes a loss function that quantifies the difference between 
        predicted and actual outputs.
      </p>
    </div>
  </div>
);

const TableContent = () => (
  <div className="h-full bg-white p-4 overflow-auto">
    <h2 className="text-xl font-semibold mb-4">Quarterly Revenue by Region</h2>
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-gray-100">
          <th className="border border-gray-300 px-4 py-3 text-left font-semibold">Region</th>
          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Q1 2024</th>
          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Q2 2024</th>
          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Q3 2024</th>
          <th className="border border-gray-300 px-4 py-3 text-right font-semibold">Q4 2024</th>
        </tr>
      </thead>
      <tbody>
        <tr className="hover:bg-gray-50">
          <td className="border border-gray-300 px-4 py-3 font-medium">North America</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$125,400</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$142,100</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$138,750</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$156,200</td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="border border-gray-300 px-4 py-3 font-medium">South America</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$98,300</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$105,600</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$112,400</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$128,900</td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="border border-gray-300 px-4 py-3 font-medium">Europe</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$156,700</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$168,200</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$175,800</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$189,400</td>
        </tr>
        <tr className="hover:bg-gray-50">
          <td className="border border-gray-300 px-4 py-3 font-medium">Asia Pacific</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$203,500</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$218,900</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$225,100</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$242,600</td>
        </tr>
        <tr className="bg-gray-200 font-bold">
          <td className="border border-gray-300 px-4 py-3">Total</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$583,900</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$634,800</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$652,050</td>
          <td className="border border-gray-300 px-4 py-3 text-right">$717,100</td>
        </tr>
      </tbody>
    </table>
  </div>
);

const DashboardContent = () => (
  <div className="h-full bg-gray-50 p-6 overflow-auto">
    <h2 className="text-2xl font-bold mb-6">Sales Dashboard</h2>
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-6 border-2 border-transparent hover:border-purple-300 transition-colors" data-component-id="kpi-1">
        <div className="text-sm text-gray-500 mb-1">Total Revenue</div>
        <div className="text-3xl font-bold text-gray-900">$1.2M</div>
        <div className="text-sm text-green-600 mt-1">↑ 15% vs last quarter</div>
      </div>
      <div className="bg-white rounded-lg shadow p-6 border-2 border-transparent hover:border-purple-300 transition-colors" data-component-id="kpi-2">
        <div className="text-sm text-gray-500 mb-1">Active Users</div>
        <div className="text-3xl font-bold text-gray-900">24,568</div>
        <div className="text-sm text-green-600 mt-1">↑ 8% vs last quarter</div>
      </div>
    </div>
    <div className="bg-white rounded-lg shadow p-6 mb-4 border-2 border-transparent hover:border-purple-300 transition-colors" data-component-id="chart-1">
      <h3 className="font-semibold mb-4">Revenue Trend</h3>
      <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 rounded flex items-end justify-around p-4">
        <div className="w-16 bg-blue-500 rounded-t" style={{height: '60%'}}></div>
        <div className="w-16 bg-blue-500 rounded-t" style={{height: '75%'}}></div>
        <div className="w-16 bg-blue-500 rounded-t" style={{height: '70%'}}></div>
        <div className="w-16 bg-blue-500 rounded-t" style={{height: '85%'}}></div>
        <div className="w-16 bg-purple-500 rounded-t" style={{height: '90%'}}></div>
      </div>
    </div>
    <div className="bg-white rounded-lg shadow p-6 border-2 border-transparent hover:border-purple-300 transition-colors" data-component-id="chart-2">
      <h3 className="font-semibold mb-4">Top Products</h3>
      <div className="space-y-3">
        {['Product A', 'Product B', 'Product C'].map((product, i) => (
          <div key={i}>
            <div className="flex justify-between text-sm mb-1">
              <span>{product}</span>
              <span className="font-medium">${(Math.random() * 500 + 100).toFixed(0)}K</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full" style={{width: `${90 - i * 15}%`}}></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============= MAIN APP =============

export default function App() {
  const [contentType, setContentType] = useState('pdf');
  const contentRef = useRef(null);

  const tabs = [
    { id: 'pdf', label: 'PDF Document', icon: '📄' },
    { id: 'table', label: 'Data Table', icon: '📊' },
    { id: 'dashboard', label: 'Dashboard', icon: '📈' }
  ];

  return (
    <SelectionProvider contentType={contentType}>
      <div className="flex h-screen bg-gray-100">
        <div className="flex-1 flex flex-col">
          {/* Tabs */}
          <div className="bg-white border-b px-4 py-2 flex gap-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setContentType(tab.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  contentType === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <SelectableContent contentRef={contentRef}>
            <div ref={contentRef} className="h-full">
              {contentType === 'pdf' && <PDFContent />}
              {contentType === 'table' && <TableContent />}
              {contentType === 'dashboard' && <DashboardContent />}
            </div>
          </SelectableContent>
        </div>

        {/* Sidebar */}
        <ContextSidebar />
      </div>
    </SelectionProvider>
  );
}
