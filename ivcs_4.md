# Production Implementation Guide

[select production_roadmap post-artfiact]

## 📋 Implementation Roadmap

### Phase 1: Foundation Setup (Day 1-2)
### Phase 2: Core Extractors (Day 3-4)
### Phase 3: Backend Integration (Day 5-6)
### Phase 4: SML Integration (Day 7+)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Application                        │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────┐  │
│  │  PDF Viewer    │  │  Table Viewer  │  │ Dashboard Viewer │  │
│  │                │  │                │  │                  │  │
│  │ ┌────────────┐ │  │ ┌────────────┐ │  │ ┌──────────────┐ │  │
│  │ │ Selection  │ │  │ │ Selection  │ │  │ │  Selection   │ │  │
│  │ │  Overlay   │ │  │ │  Overlay   │ │  │ │   Overlay    │ │  │
│  │ └────────────┘ │  │ └────────────┘ │  │ └──────────────┘ │  │
│  └────────────────┘  └────────────────┘  └──────────────────┘  │
│           │                   │                      │           │
│           └───────────────────┴──────────────────────┘           │
│                               │                                   │
│                   ┌───────────▼──────────┐                       │
│                   │  SelectionProvider   │                       │
│                   │   (React Context)    │                       │
│                   └───────────┬──────────┘                       │
│                               │                                   │
│              ┌────────────────┼────────────────┐                │
│              │                │                │                │
│    ┌─────────▼────────┐ ┌────▼─────┐ ┌────────▼────────┐      │
│    │  PDFExtractor    │ │  Table   │ │   Dashboard     │      │
│    │                  │ │ Extractor│ │   Extractor     │      │
│    └─────────┬────────┘ └────┬─────┘ └────────┬────────┘      │
│              │                │                │                │
│              └────────────────┼────────────────┘                │
│                               │                                   │
└───────────────────────────────┼───────────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │   Backend Adapter    │
                    │   (MCP/REST/SML)     │
                    └───────────┬──────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
   ┌────────▼────────┐ ┌────────▼────────┐ ┌───────▼────────┐
   │   MCP Server    │ │   REST API      │ │  SML Service   │
   │                 │ │                 │ │                │
   │ • PDF Tools     │ │ • Table Data    │ │ • Semantic     │
   │ • Text Extract  │ │ • Cell Ranges   │ │   Layer        │
   │ • Image Capture │ │ • Metadata      │ │ • Context Link │
   └─────────────────┘ └─────────────────┘ └────────────────┘
```

## 📁 Production File Structure

```
your-project/
├── src/
│   ├── features/                          # Feature-based structure
│   │   └── visual-selection/
│   │       ├── types/
│   │       │   ├── index.ts              ✅ Export all types
│   │       │   ├── coordinates.ts         ✅ Coordinate interfaces
│   │       │   ├── extraction.ts          ✅ Extraction result types
│   │       │   ├── config.ts              ✅ Configuration types
│   │       │   ├── context.ts             ✅ Context types
│   │       │   └── selection.ts           ✅ Selection types
│   │       │
│   │       ├── extractors/
│   │       │   ├── index.ts               ✅ Export extractors
│   │       │   ├── BaseExtractor.ts       ✅ Abstract base
│   │       │   ├── PDFExtractor.ts        ✅ PDF implementation
│   │       │   ├── TableExtractor.ts      ✅ Table implementation
│   │       │   └── DashboardExtractor.ts  ✅ Dashboard implementation
│   │       │
│   │       ├── backends/
│   │       │   ├── index.ts               ✅ Export adapters
│   │       │   ├── BackendAdapter.ts      ✅ Abstract adapter
│   │       │   ├── MCPBackend.ts          ✅ MCP implementation
│   │       │   ├── RESTBackend.ts         ✅ REST implementation
│   │       │   └── SMLBackend.ts          🔜 Your SML integration
│   │       │
│   │       ├── hooks/
│   │       │   ├── index.ts               ✅ Export hooks
│   │       │   ├── useSelectionMode.ts    ✅ Selection state
│   │       │   ├── useExtractor.ts        ✅ Extractor hook
│   │       │   └── useDebouncedSelection.ts ✅ Performance
│   │       │
│   │       ├── components/
│   │       │   ├── index.ts               ✅ Export components
│   │       │   ├── SelectionOverlay.tsx   ✅ Drawing UI
│   │       │   ├── SelectableContent.tsx  ✅ Content wrapper
│   │       │   ├── PersistentSelection.tsx ✅ Visual markers
│   │       │   ├── ContextSidebar.tsx     ✅ Chat UI
│   │       │   ├── ContextCard.tsx        ✅ Context preview
│   │       │   └── Message.tsx            ✅ Chat message
│   │       │
│   │       ├── context/
│   │       │   ├── index.ts               ✅ Export context
│   │       │   └── SelectionContext.tsx   ✅ Main provider
│   │       │
│   │       ├── config/
│   │       │   ├── index.ts               ✅ Export config
│   │       │   ├── extractors.ts          ✅ Extractor configs
│   │       │   └── constants.ts           ✅ App constants
│   │       │
│   │       ├── utils/
│   │       │   ├── index.ts               ✅ Export utils
│   │       │   ├── coordinates.ts         ✅ Coord helpers
│   │       │   └── canvas.ts              ✅ Canvas utilities
│   │       │
│   │       └── index.ts                   ✅ Feature barrel export
│   │
│   ├── app/                               # Your existing app structure
│   │   ├── PDFViewerPage.tsx             🔜 Integrate SelectionProvider
│   │   ├── TableViewerPage.tsx           🔜 Integrate SelectionProvider
│   │   └── DashboardPage.tsx             🔜 Integrate SelectionProvider
│   │
│   └── lib/
│       └── sml/                           🔜 Your SML integration
│           ├── semantic-layer.ts
│           └── context-enricher.ts
│
├── tests/
│   └── visual-selection/
│       ├── extractors/
│       ├── backends/
│       └── components/
│
└── package.json
```

---

## 🚀 Step-by-Step Implementation

### **Step 1: Install Dependencies**

```bash
npm install --save-dev typescript @types/react @types/node

# For canvas capture (if not already installed)
npm install html2canvas

# For PDF support (if not already installed)
npm install pdfjs-dist

# Optional: For testing
npm install --save-dev vitest @testing-library/react @testing-library/user-event
```

### **Step 2: Create Type Definitions First**

Start with `types/` - this gives you IntelliSense immediately:

```typescript
// types/index.ts - Create this FIRST
export * from './coordinates';
export * from './extraction';
export * from './config';
export * from './context';
export * from './selection';
```

Copy the complete type files from the production architecture section.

### **Step 3: Build Base Infrastructure**

**Order matters!** Build in this sequence:

```
1. types/          → Define all interfaces
2. backends/       → Create adapter pattern
3. extractors/     → Build extraction logic
4. hooks/          → State management
5. context/        → Provider setup
6. components/     → UI layer
```

### **Step 4: Test Each Layer Independently**

```typescript
// Example: Test PDFExtractor in isolation
import { PDFExtractor } from './extractors/PDFExtractor';
import { MockMCPBackend } from './backends/__mocks__/MCPBackend';

const extractor = new PDFExtractor({ enrich: true });
const backend = new MockMCPBackend();

const bbox = {
  x: 100,
  y: 100,
  width: 200,
  height: 150,
  viewport: { width: 800, height: 600 }
};

const context = {
  backend,
  pageNumber: 1,
  pdfPage: mockPdfPage,
  pdfDocument: mockDoc,
  scale: 1.5
};

const result = await extractor.extract(bbox, context);
console.log(result); // Verify structure
```

---

## 🔌 Integration Points

### **1. Integrating with Your PDF Viewer**

```typescript
// app/PDFViewerPage.tsx
import { SelectionProvider, SelectableContent, ContextSidebar } from '@/features/visual-selection';
import { PDFExtractor } from '@/features/visual-selection/extractors';
import { MCPBackend } from '@/features/visual-selection/backends';

export function PDFViewerPage() {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  
  // Initialize backend
  const backend = useMemo(() => new MCPBackend('/api/mcp'), []);
  
  // Initialize extractor
  const extractor = useMemo(() => new PDFExtractor({
    enrich: true,
    includeSurrounding: false,
    timeout: 30000
  }), []);

  // Load your PDF (existing logic)
  useEffect(() => {
    // Your PDF loading logic
    loadPDF('/path/to/pdf').then(setPdfDoc);
  }, []);

  return (
    <SelectionProvider
      contentType="pdf"
      extractor={extractor}
      backend={backend}
      onExtracted={(selection) => {
        // Optional: Log to analytics
        analytics.track('region_selected', {
          type: 'pdf',
          page: selection.extracted.metadata?.page
        });
      }}
    >
      <div className="flex h-screen">
        <SelectableContent
          contentRef={pdfRef}
          context={{
            pageNumber: page,
            pdfPage: pdfDoc?.getPage(page),
            pdfDocument: pdfDoc,
            scale: 1.5
          }}
          className="flex-1"
        >
          <div ref={pdfRef}>
            {/* Your existing PDF viewer component */}
            <YourPDFViewer page={page} document={pdfDoc} />
          </div>
        </SelectableContent>

        <ContextSidebar 
          onSendToAgent={async (message) => {
            // Connect to your AI agent
            return await yourAgentAPI.chat(message);
          }}
        />
      </div>
    </SelectionProvider>
  );
}
```

### **2. SML Backend Integration**

Create a custom backend for your Semantic Modeling Language:

```typescript
// backends/SMLBackend.ts
import { BackendAdapter } from './BackendAdapter';
import { 
  PDFCoordinates, 
  CellCoordinates, 
  NormalizedCoordinates 
} from '../types';

export class SMLBackend extends BackendAdapter {
  constructor(
    private smlEndpoint: string,
    private semanticLayer: SemanticLayerClient // Your SML client
  ) {
    super();
  }

  protected async call<T = unknown>(
    method: string,
    params: unknown
  ): Promise<BackendResponse<T>> {
    try {
      const response = await fetch(`${this.smlEndpoint}/${method}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();
      return { data: data as T };
    } catch (error) {
      return { 
        data: null as T, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // PDF Methods with SML enrichment
  async getTextInArea(coords: PDFCoordinates): Promise<{
    text: string;
    items: any[];
    semanticContext?: any; // SML context
  }> {
    const baseText = await this.handleResponse(
      this.call('pdf.getTextInArea', coords)
    );

    // Enrich with SML semantic context
    const semanticContext = await this.semanticLayer.getContextForRegion({
      type: 'pdf',
      coordinates: coords,
      text: baseText.text
    });

    return {
      ...baseText,
      semanticContext
    };
  }

  // Table Methods with SML metadata linkage
  async getCellData(cellRange: CellCoordinates): Promise<{
    cells: any[][];
    semanticMetadata?: any; // Link to SML definitions
  }> {
    const cellData = await this.handleResponse(
      this.call('table.getCellData', cellRange)
    );

    // Link cells to semantic definitions
    const semanticMetadata = await this.semanticLayer.linkCellsToDefinitions({
      range: cellRange,
      cells: cellData
    });

    return {
      cells: cellData,
      semanticMetadata
    };
  }

  private getToken(): string {
    // Your auth logic
    return localStorage.getItem('auth_token') || '';
  }
}
```

### **3. Enhanced Table Extractor with SML**

```typescript
// extractors/SMLTableExtractor.ts
import { TableExtractor } from './TableExtractor';
import { TableExtractionResult, TableContext } from '../types';

export class SMLTableExtractor extends TableExtractor {
  protected async enrichMetadata(
    data: Partial<TableExtractionResult>,
    context: TableContext
  ): Promise<Partial<TableExtractionResult>> {
    // Get base enrichment
    const baseEnriched = await super.enrichMetadata(data, context);

    // Add SML semantic enrichment
    const { backend } = context;
    if ('semanticMetadata' in (data as any)) {
      const smlMetadata = (data as any).semanticMetadata;
      
      return {
        ...baseEnriched,
        metadata: {
          ...baseEnriched.metadata,
          // Link to SML semantic model
          semanticModel: smlMetadata?.model,
          businessContext: smlMetadata?.businessContext,
          relatedMetrics: smlMetadata?.relatedMetrics,
          // Generate natural language description using SML
          naturalLanguageDescription: this.generateSMLDescription(
            data,
            smlMetadata
          )
        }
      };
    }

    return baseEnriched;
  }

  private generateSMLDescription(data: any, smlMetadata: any): string {
    // Use SML to generate semantic description
    const { model, businessContext } = smlMetadata || {};
    
    if (model && businessContext) {
      return `${model.name}: ${businessContext.description} - ` +
             `Shows ${data.metadata?.metrics?.map(m => m.name).join(', ')} ` +
             `grouped by ${data.metadata?.dimensions?.map(d => d.name).join(', ')}`;
    }

    return data.metadata?.description || '';
  }
}
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ USER INTERACTION FLOW                                            │
└─────────────────────────────────────────────────────────────────┘

1. USER DRAWS BOUNDING BOX
   │
   ├─→ SelectionOverlay captures mouse events
   │   └─→ Calculates pixel coordinates + viewport dimensions
   │
2. OVERLAY COMPLETES SELECTION
   │
   ├─→ Calls onSelectionComplete(bbox)
   │   └─→ SelectableContent.onComplete()
   │       └─→ useSelection().handleExtraction()
   │
3. EXTRACTION PROCESS
   │
   ├─→ SelectionProvider.handleExtraction()
   │   │
   │   ├─→ Build full context (merge props + containerRef)
   │   │
   │   ├─→ Extractor.extract(bbox, context)
   │   │   │
   │   │   ├─→ transformCoordinates(bbox, context)
   │   │   │   └─→ Returns: { pixels, normalized, native }
   │   │   │
   │   │   ├─→ fetchData(coords, context)
   │   │   │   │
   │   │   │   ├─→ Backend.getTextInArea(coords.native)
   │   │   │   ├─→ Backend.getImageOfArea(coords.native)
   │   │   │   └─→ Returns: { text, image }
   │   │   │
   │   │   └─→ enrichMetadata(data, context) [if enabled]
   │   │       │
   │   │       ├─→ Backend.getSurroundingContext()
   │   │       ├─→ SML.getSemanticContext()
   │   │       └─→ Returns: { ...data, metadata: {...} }
   │   │
   │   └─→ Returns complete ExtractionResult
   │
4. STORE SELECTION
   │
   ├─→ addSelection({ bbox, contentType, extracted })
   │   └─→ Generates ID + timestamp
   │       └─→ Updates selections state
   │
5. DISPLAY IN UI
   │
   ├─→ PersistentSelection renders on content
   ├─→ ContextCard shows in sidebar
   └─→ User can chat about selected context

┌─────────────────────────────────────────────────────────────────┐
│ COORDINATE TRANSFORMATION FLOW                                   │
└─────────────────────────────────────────────────────────────────┘

SCREEN PIXELS                    NORMALIZED (0-1)              NATIVE
────────────────────────────────────────────────────────────────────
{ x: 150, y: 200 }      →       { x: 0.25, y: 0.33 }
{ width: 300, height: 150 }     { width: 0.5, height: 0.25 }
viewport: { w: 600, h: 600 }                                        
                                                                     
                                                         ↓           
                                                                     
PDF POINTS                       TABLE CELLS           GRID UNITS
────────────────────────────────────────────────────────────────────
{ x: 108, y: 324 }    (flipped Y) { startRow: 5 }      { x: 2, y: 3 }
{ width: 216, height: 108 }        { endRow: 8 }       { w: 4, h: 2 }
{ page: 1 }                        { startCol: 2 }
(72 DPI points)                    { endCol: 5 }
                                   { range: "C6:F9" }
```

---

## ⚙️ Configuration Strategy

### **Environment-based Configuration**

```typescript
// config/extractors.ts
import { PDFExtractor, TableExtractor, DashboardExtractor } from '../extractors';
import { SMLTableExtractor } from '../extractors/SMLTableExtractor';

const isDevelopment = process.env.NODE_ENV === 'development';
const useSML = process.env.REACT_APP_USE_SML === 'true';

export const extractorConfigs = {
  pdf: {
    extractor: PDFExtractor,
    enrich: true,
    includeSurrounding: !isDevelopment, // Disable in dev for speed
    timeout: isDevelopment ? 10000 : 30000,
    retries: isDevelopment ? 1 : 2
  },
  
  table: {
    extractor: useSML ? SMLTableExtractor : TableExtractor, // Switch based on env
    enrich: true,
    timeout: 20000,
    retries: 3
  },
  
  dashboard: {
    extractor: DashboardExtractor,
    enrich: true,
    timeout: 15000
  }
};

// Backend selection
export function getBackend() {
  if (useSML) {
    return new SMLBackend(
      process.env.REACT_APP_SML_ENDPOINT!,
      semanticLayerClient
    );
  }
  
  if (process.env.REACT_APP_BACKEND_TYPE === 'mcp') {
    return new MCPBackend(process.env.REACT_APP_MCP_ENDPOINT!);
  }
  
  return new RESTBackend(process.env.REACT_APP_API_URL!);
}
```

### **Feature Flags for Gradual Rollout**

```typescript
// config/features.ts
export const featureFlags = {
  enableVisualSelection: process.env.REACT_APP_VISUAL_SELECTION === 'true',
  enableSMLEnrichment: process.env.REACT_APP_SML_ENRICHMENT === 'true',
  enablePersistentSelections: true,
  enableMultipleSelections: true,
  maxSelectionsPerPage: 10,
  enableAnalytics: process.env.NODE_ENV === 'production'
};

// Usage
import { featureFlags } from '@/config/features';

{featureFlags.enableVisualSelection && (
  <SelectionProvider>
    ...
  </SelectionProvider>
)}
```

---

## 🧪 Testing Strategy

### **Unit Tests**

```typescript
// __tests__/extractors/PDFExtractor.test.ts
import { PDFExtractor } from '@/features/visual-selection/extractors';
import { MockMCPBackend } from '@/features/visual-selection/backends/__mocks__';

describe('PDFExtractor', () => {
  let extractor: PDFExtractor;
  let mockBackend: MockMCPBackend;

  beforeEach(() => {
    extractor = new PDFExtractor({ enrich: true });
    mockBackend = new MockMCPBackend();
  });

  it('transforms coordinates correctly', () => {
    const bbox = {
      x: 100,
      y: 200,
      width: 300,
      height: 150,
      viewport: { width: 800, height: 600 }
    };

    const context = {
      backend: mockBackend,
      pageNumber: 1,
      pdfPage: { view: [0, 0, 612, 792] }, // Letter size in points
      pdfDocument: {},
      scale: 1.5
    };

    const coords = (extractor as any).transformCoordinates(bbox, context);

    expect(coords.pdf).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
      width: expect.any(Number),
      height: expect.any(Number),
      page: 1
    });
    
    expect(coords.normalized.x).toBeCloseTo(0.125);
    expect(coords.normalized.y).toBeCloseTo(0.333);
  });

  it('extracts and enriches data', async () => {
    const bbox = { /* ... */ };
    const context = { /* ... */ };

    mockBackend.setMockResponse('pdf.getTextInArea', {
      text: 'Sample text',
      items: []
    });

    const result = await extractor.extract(bbox, context);

    expect(result.type).toBe('pdf');
    expect(result.text).toBe('Sample text');
    expect(result.metadata).toBeDefined();
  });
});
```

### **Integration Tests**

```typescript
// __tests__/integration/selection-flow.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { SelectionProvider, SelectableContent } from '@/features/visual-selection';

describe('Selection Flow', () => {
  it('completes full selection flow', async () => {
    const onExtracted = jest.fn();
    const mockExtractor = new MockPDFExtractor();
    const mockBackend = new MockMCPBackend();

    const { container, getByText } = render(
      <SelectionProvider
        contentType="pdf"
        extractor={mockExtractor}
        backend={mockBackend}
        onExtracted={onExtracted}
      >
        <button onClick={() => /* start selection */}>Select</button>
        <SelectableContent contentRef={ref}>
          <div>Content</div>
        </SelectableContent>
      </SelectionProvider>
    );

    // Start selection
    fireEvent.click(getByText('Select'));

    // Simulate drawing
    const content = container.querySelector('[data-testid="selectable"]');
    fireEvent.mouseDown(content, { clientX: 100, clientY: 100 });
    fireEvent.mouseMove(content, { clientX: 300, clientY: 250 });
    fireEvent.mouseUp(content);

    // Verify extraction was called
    await waitFor(() => {
      expect(onExtracted).toHaveBeenCalledWith(
        expect.objectContaining({
          bbox: expect.any(Object),
          extracted: expect.any(Object)
        })
      );
    });
  });
});
```

---

## 🎯 Performance Optimization

### **1. Memoization Strategy**

```typescript
// Memoize expensive components
const SelectableContent = React.memo(({ children, ...props }) => {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison
  return prevProps.contentType === nextProps.contentType &&
         prevProps.selections.length === nextProps.selections.length;
});

// Memoize extractors
const extractor = useMemo(() => {
  return new PDFExtractor(config);
}, [config.enrich, config.timeout]); // Only recreate if config changes
```

### **2. Debouncing & Throttling**

```typescript
// Already implemented in useDebouncedSelection
const debouncedExtract = useDebouncedSelection(handleExtraction, 150);

// For rapid mouse movements during drawing
const throttledMove = useThrottle((e: MouseEvent) => {
  setCurrent(getRelativeCoords(e));
}, 16); // ~60fps
```

### **3. Lazy Loading**

```typescript
// Lazy load heavy components
const ContextSidebar = lazy(() => import('./components/ContextSidebar'));

// Usage
<Suspense fallback={<SidebarSkeleton />}>
  <ContextSidebar />
</Suspense>
```

### **4. Virtual Scrolling for Many Selections**

```typescript
// If you have many selections, use virtual scrolling
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={selections.length}
  itemSize={80}
>
  {({ index, style }) => (
    <div style={style}>
      <ContextCard context={selections[index]} />
    </div>
  )}
</FixedSizeList>
```

---

## 🚨 Common Gotchas & Solutions

### **1. Coordinate System Mismatches**

❌ **Problem:** PDF Y-axis is inverted (bottom-left origin)

✅ **Solution:** Always transform in extractor
```typescript
y: pdfHeight - (bbox.y / scale) - (bbox.height / scale)
```

### **2. Scroll Offset Issues**

❌ **Problem:** Selections misaligned when scrolled

✅ **Solution:** Account for scroll in table extractor
```typescript
const adjustedY = bbox.y + scrollOffset.y - gridConfig.headerHeight;
```

### **3. Memory Leaks**

❌ **Problem:** Event listeners not cleaned up

✅ **Solution:** Always cleanup in useEffect
```typescript
useEffect(() => {
  document.addEventListener('mousemove', handler);
  return () => document.removeEventListener('mousemove', handler);
}, [handler]);
```

### **4. Type Safety Issues**

❌ **Problem:** `any` types defeating TypeScript

✅ **Solution:** Use strict generics
```typescript
class BaseExtractor<TResult extends ExtractionResult, TContext> {
  // Fully typed
}
```

---

## 📊 Monitoring & Analytics

```typescript
// utils/analytics.ts
export function trackSelection(selection: Selection) {
  if (!featureFlags.enableAnalytics) return;

  analytics.track('region_selected', {
    contentType: selection.contentType,
    bbox: {
      width: selection.bbox.width,
      height: selection.bbox.height
    },
    hasText: !!selection.extracted.text,
    hasImage: !!selection.extracted.image,
    metadata: selection.extracted.metadata
  });
}

// In SelectionProvider
const handleExtraction = useCallback(async (bbox, context) => {
  const selection = await extractor.extract(bbox, context);
  
  // Track
  trackSelection(selection);
  
  // Store
  addSelection(selection);
  
  return selection;
}, []);
```

---

## 🔐 Security Considerations

```typescript
// 1. Sanitize extracted text
import DOMPurify from 'dompurify';

const sanitizedText = DOMPurify.sanitize(extractedText);

// 2. Validate coordinates
function validateBbox(bbox: PixelCoordinates): boolean {
  return (
    bbox.width > 0 &&
    bbox.height > 0 &&
    bbox.x >= 0 &&
    bbox.y >= 0 &&
    bbox.x + bbox.width <= bbox.viewport.width &&
    bbox.y + bbox.height <= bbox.viewport.height
  );
}

// 3. Rate limit backend calls
const rateLimiter = new RateLimiter({ maxRequests: 10, perMinutes: 1 });

async fetchData() {
  await rateLimiter.checkLimit();
  return this.backend.call(/* ... */);
}
```

---

## 📚 Quick Reference Commands

```bash
# Development
npm run dev

# Type check
npm run type-check

# Run tests
npm run test

# Build for production
npm run build

# Analyze bundle
npm run analyze
```

---

## 🎉 Final Checklist

- [ ] Install all dependencies
- [ ] Create types/ directory with all interfaces
- [ ] Implement BaseExtractor and backend adapters
- [ ] Build content-specific extractors (PDF, Table, Dashboard)
- [ ] Create hooks (useSelectionMode, useExtractor)
- [ ] Implement SelectionProvider context
- [ ] Build UI components (Overlay, SelectableContent, Sidebar)
- [ ] Integrate with existing pages
- [ ] Add SML backend integration
- [ ] Write unit tests for extractors
- [ ] Write integration tests for full flow
- [ ] Add error boundaries
- [ ] Implement analytics tracking
- [ ] Add feature flags
- [ ] Performance optimization (memoization, debouncing)
- [ ] Security hardening (sanitization, validation)
- [ ] Documentation for your team
- [ ] QA testing across all content types

---

This should give you everything you need to implement the production system! The architecture is solid, extensible, and ready for your SML integration. Excited to see what you build! 🚀
