# PDF Processing Experiment - Engineering Spike

## Executive Summary

This experiment compares **5 different approaches** to PDF question-answering using Google's Agent Development Kit (ADK). The goal is to demonstrate the spectrum of engineering complexity—from simple to sophisticated—and help stakeholders understand where commercial tools (Gemini, Copilot, Claude) fit on this spectrum.

**Target Audience**: Client team evaluating PDF processing solutions  
**Deliverable**: Interactive demo showing each approach with comparative results  
**Timeline**: Iterative development with incremental agent implementation

---

## Problem Statement

Organizations need to extract insights from PDF documents through natural language queries. The engineering approaches vary dramatically in:
- **Complexity**: From raw PDF input to sophisticated agentic systems
- **Performance**: Accuracy, speed, context awareness
- **Cost**: Infrastructure, development time, maintenance
- **Flexibility**: Adaptability to different document types

This experiment quantifies these tradeoffs across 5 implementations.

---

## Experiment Architecture

### High-Level Flow

```
┌─────────────────┐
│  Question Set   │ (Standardized inputs)
│  (input_cases/) │
└────────┬────────┘
         │
         ├─────────────┬─────────────┬─────────────┬─────────────┐
         ▼             ▼             ▼             ▼             ▼
    ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐   ┌────────┐
    │Agent 1 │   │Agent 2 │   │Agent 3 │   │Agent 4 │   │Agent 5 │
    │(Basic) │   │(+Proc) │   │(+RAG)  │   │(+Tools)│   │(+MCP)  │
    └───┬────┘   └───┬────┘   └───┬────┘   └───┬────┘   └───┬────┘
        │            │            │            │            │
        └────────────┴────────────┴────────────┴────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Session Storage │ (Results + Metadata)
                    │  (Per Agent Run) │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Analysis/Eval UI │
                    └──────────────────┘
```

### Repository Structure

```
genie_pdf_experiment/
├── README.md                          # Experiment overview
├── EXPERIMENT_DESIGN_SPIKE.md         # This document
├── HELPFUL_LINKS.md                   # Resources and references
│
├── data/
│   ├── pdfs/                          # Source documents
│   │   ├── finance_report.pdf
│   │   ├── thd_101.pdf
│   │   └── claude_docs.pdf
│   │
│   └── input_cases/                   # Test cases
│       └── question_sets/
│           ├── 0_basic_extraction.json
│           ├── 1_multi_doc_reasoning.json
│           ├── 2_complex_analysis.json
│           └── 3_table_heavy.json
│
├── agents/                            # 5 Agent Implementations
│   ├── agent_settings.py              # Shared config (model, temperature, etc.)
│   ├── README.md                      # Agent comparison overview
│   │
│   ├── 1_gemini_base/
│   │   ├── agent.py                   # ADK Agent definition
│   │   ├── prompts.py                 # System instructions
│   │   └── README.md                  # Implementation notes
│   │
│   ├── 2_gemini_pdf_processed/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   ├── preprocessor.py            # LLM-based PDF description
│   │   └── README.md
│   │
│   ├── 3_fixed_rag/
│   │   ├── agent.py                   # Sequential RAG pipeline
│   │   ├── prompts.py
│   │   ├── retriever.py               # Vector/Trad/Hybrid search
│   │   └── README.md
│   │
│   ├── 4_agent_with_tools/
│   │   ├── agent.py                   # LLM decides when to search
│   │   ├── prompts.py
│   │   └── README.md
│   │
│   └── 5_gemini_pdf_mcp/
│       ├── agent.py                   # Uses MCP protocol
│       ├── prompts.py
│       ├── mcp_client.py              # MCP integration
│       └── README.md
│
├── tools/                             # Shared tools (used by agents 3, 4, 5)
│   ├── __init__.py
│   ├── vector_search.py               # Vertex AI Search
│   ├── traditional_search.py          # Keyword/BM25
│   ├── hybrid_search.py               # Combined approach
│   └── README.md
│
├── mcps/                              # MCP server implementation
│   ├── pdf_mcp_server.py              # Standalone MCP server
│   └── README.md
│
├── results/                           # Experiment outputs
│   └── runs/                          # Auto-generated per run
│       └── {timestamp}_{agent}_{case_id}/
│           ├── session.json           # Full session data
│           ├── metadata.json          # Run config, timing
│           └── events.jsonl           # Event stream
│
├── main.py                            # Experiment runner script
├── analysis.py                        # Result aggregation/comparison
├── requirements.txt
└── .env.example
```

---

## The 5 Agent Implementations

### Agent 1: Gemini Base (Baseline)
**Complexity**: ⭐ (Simplest)  
**Architecture**: Raw PDF → Gemini multimodal input

```python
# Pseudocode
agent = Agent(
    name="gemini_base",
    model="gemini-2.0-flash-exp",
    instruction="""You are a PDF analysis assistant.
    Answer questions based on the provided PDF document."""
)

# PDF provided as binary blob in session
```

**Strengths**:
- Zero infrastructure (Gemini handles PDF natively)
- Fast to implement
- Good for simple documents

**Weaknesses**:
- Limited to Gemini's native PDF understanding
- No control over chunking/extraction
- Context window limits for large docs


### Agent 2: Gemini + Preprocessed Description
**Complexity**: ⭐⭐  
**Architecture**: PDF → LLM extraction → Description → Gemini reasoning

```python
# Pseudocode
preprocessor = Agent(
    name="pdf_preprocessor",
    instruction="Extract text, tables, structure from PDF. Create detailed description.",
    output_key="pdf_description"
)

qa_agent = Agent(
    name="qa_agent",
    instruction="Answer questions using the pdf_description from state.",
    # Accesses ctx.session.state["pdf_description"]
)

pipeline = SequentialAgent(
    sub_agents=[preprocessor, qa_agent]
)
```

**Strengths**:
- Explicit control over what info is extracted
- Can add domain-specific preprocessing
- Description can be cached/reused

**Weaknesses**:
- Two LLM calls (higher latency/cost)
- Lossy transformation (preprocessing might miss details)


### Agent 3: Fixed RAG Pipeline
**Complexity**: ⭐⭐⭐  
**Architecture**: PDF → Chunking → Vector DB → Retrieval → Generation

```python
# Pseudocode
retriever = Agent(
    name="retriever",
    instruction="Generate search query for the user's question.",
    tools=[vector_search_tool, traditional_search_tool, hybrid_search_tool],
    output_key="relevant_chunks"
)

generator = Agent(
    name="generator",
    instruction="Answer question using relevant_chunks from state.",
    output_key="answer"
)

rag_pipeline = SequentialAgent(
    sub_agents=[retriever, generator]
)
```

**Strengths**:
- Scales to large document collections
- Explicit retrieval step (debuggable)
- Can tune retrieval strategy

**Weaknesses**:
- Fixed pipeline (always retrieves, even if unnecessary)
- Requires vector database setup
- Chunking strategy is critical


### Agent 4: Agent with Search Tools (Agentic RAG)
**Complexity**: ⭐⭐⭐⭐  
**Architecture**: LLM decides when/how to search

```python
# Pseudocode
agent = Agent(
    name="agentic_rag",
    model="gemini-2.0-flash-exp",
    tools=[
        FunctionTool(vector_search),
        FunctionTool(traditional_search),
        FunctionTool(hybrid_search)
    ],
    instruction="""Answer PDF questions.
    Use search tools when needed:
    - vector_search: semantic similarity
    - traditional_search: keyword matching
    - hybrid_search: combined approach
    
    You can call tools multiple times or not at all based on the question."""
)
```

**Strengths**:
- Adaptive (searches only when needed)
- LLM chooses best search strategy
- Can perform multi-hop reasoning

**Weaknesses**:
- Less predictable (LLM decides)
- Requires good tool descriptions
- Potential for unnecessary tool calls


### Agent 5: Gemini with PDF MCP
**Complexity**: ⭐⭐⭐⭐⭐ (Most sophisticated)  
**Architecture**: Agent ↔ MCP Server ↔ PDF operations

```python
# Pseudocode
# MCP Server provides:
# - pdf/read: Load PDF content
# - pdf/search: Search within PDF
# - pdf/extract_tables: Table extraction
# - pdf/get_metadata: Document metadata
# - state/scratchpad: Working memory

agent = Agent(
    name="mcp_agent",
    model="gemini-2.0-flash-exp",
    tools=[
        MCPTool("pdf/read"),
        MCPTool("pdf/search"),
        MCPTool("pdf/extract_tables"),
        MCPTool("pdf/get_metadata"),
        MCPTool("state/scratchpad_write"),
        MCPTool("state/scratchpad_read")
    ],
    instruction="""You have access to PDF operations via MCP.
    Use scratchpad to store intermediate findings.
    Build up your understanding incrementally."""
)
```

**Strengths**:
- Maximum flexibility (LLM orchestrates)
- Stateful reasoning (scratchpad)
- Fine-grained operations
- Protocol standardization (MCP)

**Weaknesses**:
- Complex setup (MCP server + client)
- More moving parts (higher failure surface)
- Requires careful prompt engineering


---

## Experiment Execution

### Input Cases (Test Suite)

Each test case is a JSON file with:

```json
{
  "case_id": "0_basic_extraction",
  "description": "Simple fact extraction from single document",
  "pdf_refs": ["finance_report.pdf"],
  "questions": [
    {
      "id": "q1",
      "query": "What was the total revenue in Q4?",
      "expected_answer_type": "numeric",
      "difficulty": "easy"
    },
    {
      "id": "q2",
      "query": "Who is the CFO mentioned in the report?",
      "expected_answer_type": "entity",
      "difficulty": "easy"
    }
  ],
  "eval_criteria": [
    "correctness",
    "completeness",
    "response_time"
  ]
}
```

**Question Set Categories**:
1. **Basic Extraction**: Direct facts from single doc
2. **Multi-Doc Reasoning**: Cross-reference multiple PDFs
3. **Complex Analysis**: Synthesis, comparison, trend analysis
4. **Table-Heavy**: Numeric data, calculations from tables


### Main Execution Script

```python
# main.py - High-level structure

import asyncio
from google.adk import Runner, RunConfig
from google.adk.services import DatabaseSessionService, GcsArtifactService
from agents import (
    gemini_base,
    gemini_pdf_processed,
    fixed_rag,
    agent_with_tools,
    gemini_pdf_mcp
)
from pathlib import Path
import json
from datetime import datetime

AGENTS = {
    "gemini_base": gemini_base.create_agent(),
    "gemini_pdf_processed": gemini_pdf_processed.create_agent(),
    "fixed_rag": fixed_rag.create_agent(),
    "agent_with_tools": agent_with_tools.create_agent(),
    "gemini_pdf_mcp": gemini_pdf_mcp.create_agent()
}

async def run_experiment(agent_name: str, case_id: str):
    """Run a single agent on a single test case."""
    
    # Load test case
    case_path = Path(f"data/input_cases/question_sets/{case_id}.json")
    with open(case_path) as f:
        test_case = json.load(f)
    
    # Initialize runner
    agent = AGENTS[agent_name]
    runner = Runner(
        app_name=f"pdf_experiment_{agent_name}",
        root_agent=agent,
        session_service=DatabaseSessionService(
            connection_string=os.getenv("DB_CONNECTION_STRING")
        ),
        artifact_service=GcsArtifactService(
            bucket_name=os.getenv("GCS_BUCKET")
        )
    )
    
    # Prepare PDFs as artifacts
    pdf_files = []
    for pdf_ref in test_case["pdf_refs"]:
        pdf_path = Path(f"data/pdfs/{pdf_ref}")
        with open(pdf_path, "rb") as f:
            pdf_files.append((pdf_ref, f.read()))
    
    # Run each question
    results = []
    for question in test_case["questions"]:
        session_id = f"{agent_name}_{case_id}_{question['id']}"
        
        start_time = datetime.now()
        
        # Execute
        events = []
        async for event in runner.run_async(
            user_id="experiment",
            session_id=session_id,
            new_message=question["query"],
            files=pdf_files,
            run_config=RunConfig(streaming=False)
        ):
            events.append(event)
        
        end_time = datetime.now()
        
        # Extract answer
        answer = None
        for event in reversed(events):
            if event.author == agent_name and not event.partial:
                answer = event.content.parts[0].text
                break
        
        # Store result
        result = {
            "question_id": question["id"],
            "query": question["query"],
            "answer": answer,
            "session_id": session_id,
            "duration_seconds": (end_time - start_time).total_seconds(),
            "event_count": len(events),
            "timestamp": start_time.isoformat()
        }
        results.append(result)
    
    # Save results
    results_dir = Path(f"results/runs/{datetime.now().strftime('%Y%m%d_%H%M%S')}_{agent_name}_{case_id}")
    results_dir.mkdir(parents=True, exist_ok=True)
    
    with open(results_dir / "results.json", "w") as f:
        json.dump({
            "agent_name": agent_name,
            "case_id": case_id,
            "test_case": test_case,
            "results": results
        }, f, indent=2)
    
    return results

async def run_full_experiment():
    """Run all agents on all test cases."""
    
    case_ids = ["0_basic_extraction", "1_multi_doc_reasoning", 
                "2_complex_analysis", "3_table_heavy"]
    
    for agent_name in AGENTS.keys():
        print(f"\n{'='*60}")
        print(f"Running Agent: {agent_name}")
        print(f"{'='*60}")
        
        for case_id in case_ids:
            print(f"\n  Test Case: {case_id}")
            try:
                results = await run_experiment(agent_name, case_id)
                print(f"    ✓ Completed {len(results)} questions")
            except Exception as e:
                print(f"    ✗ Error: {e}")

if __name__ == "__main__":
    asyncio.run(run_full_experiment())
```


### Result Storage Schema

Each run generates:

```
results/runs/{timestamp}_{agent}_{case}/
├── results.json          # Aggregated results
├── session.json          # Full session data
├── metadata.json         # Run configuration
└── events.jsonl          # Event stream (for debugging)
```

**results.json structure**:
```json
{
  "agent_name": "agent_with_tools",
  "case_id": "0_basic_extraction",
  "test_case": { /* full test case */ },
  "results": [
    {
      "question_id": "q1",
      "query": "What was the total revenue?",
      "answer": "Total revenue was $42.5M in Q4.",
      "session_id": "agent_with_tools_0_basic_extraction_q1",
      "duration_seconds": 3.42,
      "event_count": 8,
      "timestamp": "2024-10-09T20:15:30"
    }
  ]
}
```

---

## Evaluation Framework (Future: Step B)

### Metrics to Track

1. **Correctness**: Does answer match expected/ground truth?
2. **Completeness**: Is all relevant info included?
3. **Latency**: Time to first/final response
4. **Cost**: LLM calls, token usage
5. **Reliability**: Success rate, error handling
6. **Debuggability**: Event trace clarity

### Analysis Script

```python
# analysis.py - Pseudocode structure

def aggregate_results():
    """Load all results and compute comparative metrics."""
    
    all_runs = load_all_results_from_disk()
    
    df = pd.DataFrame(all_runs)
    
    # Aggregate by agent
    agent_summary = df.groupby('agent_name').agg({
        'duration_seconds': ['mean', 'std'],
        'event_count': 'mean',
        'correctness_score': 'mean'  # From manual/automated eval
    })
    
    # Generate comparison visualizations
    plot_latency_by_agent()
    plot_correctness_by_case_difficulty()
    plot_cost_vs_accuracy_tradeoff()
    
    # Export report
    generate_html_report(agent_summary)
```

---

## Implementation Roadmap

### Phase 1: Foundation (You are here)
- [x] Repository structure
- [x] Experiment design documentation
- [ ] Base ADK scaffolding (Runner, Session, basic Agent)
- [ ] Test data setup (3 PDFs, 1 question set)

### Phase 2: Simple Agents (Incremental)
- [ ] Agent 1: Gemini Base
- [ ] Agent 2: Gemini + Preprocessed
- [ ] Validate end-to-end flow with these 2

### Phase 3: RAG Infrastructure
- [ ] Vector search tool (Vertex AI)
- [ ] Traditional search tool
- [ ] Hybrid search tool
- [ ] Agent 3: Fixed RAG pipeline

### Phase 4: Agentic Systems
- [ ] Agent 4: Agent with tools
- [ ] Compare Agent 3 vs 4 (fixed vs agentic)

### Phase 5: MCP (Most Complex)
- [ ] MCP server implementation
- [ ] MCP client integration
- [ ] Agent 5: MCP-based agent

### Phase 6: Analysis & Demo
- [ ] Result aggregation
- [ ] Comparative analysis
- [ ] Interactive demo UI
- [ ] Client presentation materials

---

## Key Design Decisions

### Why ADK?
- **Event-driven architecture**: Clean boundaries, debuggable
- **Composability**: Easy to create variants (Sequential, Parallel, Loop)
- **Session management**: Built-in persistence
- **Tool integration**: Consistent interface for search/MCP

### Why 5 Implementations?
Shows the **spectrum of sophistication**:
1. **Baseline**: What you get "for free"
2. **+Preprocessing**: Minimal engineering lift
3. **+RAG**: Industry standard approach
4. **+Agency**: Modern agentic pattern
5. **+MCP**: Cutting-edge protocol

Helps stakeholders understand where commercial tools (Gemini, Copilot, Claude) fall:
- Gemini ≈ Agent 1-2 (native PDF understanding)
- Copilot ≈ Agent 3-4 (RAG + some agency)
- Claude ≈ Agent 4-5 (agentic + extensible)

### Why Database for Sessions?
- Enables post-hoc analysis (query all runs)
- Supports concurrent execution
- Persistent across restarts
- Real-world production pattern

---

## Success Criteria

### Technical Success
- [ ] All 5 agents successfully execute on test cases
- [ ] Results stored consistently in database
- [ ] Event streams are debuggable
- [ ] No silent failures (errors are logged/reported)

### Demo Success
- [ ] Client can interact with each agent
- [ ] Comparative results are clear and compelling
- [ ] Performance/accuracy tradeoffs are quantified
- [ ] Engineering complexity is visually demonstrated

### Learning Success
- [ ] Team understands ADK patterns (Sequential, tools, custom)
- [ ] Team can extend experiment (add agents, test cases)
- [ ] Documentation enables handoff to other engineers

---

## Next Steps for Engineer

1. **Read HELPFUL_LINKS.md** for ADK resources
2. **Set up environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   cp .env.example .env  # Fill in credentials
   ```
3. **Start with Agent 1** (gemini_base):
   - Copy ADK quickstart example
   - Adapt for PDF input
   - Test with single question
4. **Validate full loop**:
   - Question → Agent → Session → Results
   - Confirm data is persisted
5. **Iterate through agents 2-5**
6. **Reach out with questions** (this is a learning exercise!)

---

## Questions to Resolve

- [ ] **PDF Sources**: Do we have permission to use these 3 PDFs?
- [ ] **Vertex AI Access**: Credentials for vector search?
- [ ] **Evaluation**: Manual labels or automated (LLM-as-judge)?
- [ ] **Timeline**: What's the hard deadline for client demo?
- [ ] **Infrastructure**: Deploy all 5 agents or just demo locally?

---

## Appendix: Why This Matters

This experiment isn't just about comparing PDF tools—it's about **educating stakeholders on AI engineering tradeoffs**:

- **Complexity vs. Performance**: More sophisticated ≠ always better
- **Cost vs. Accuracy**: Diminishing returns at high end
- **Maintenance Burden**: Simple solutions age better
- **Flexibility vs. Predictability**: Fixed pipelines vs. agentic systems

By building all 5 implementations, you create a **reference architecture** that can guide future AI projects. Each agent becomes a reusable pattern for different use cases.
