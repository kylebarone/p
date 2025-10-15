got it — here’s a tight “map” for **PDF1** based on the GeneReview repo setup, scoped for a **40-minute** sprint. it’s a single markdown you can drop into the repo as `PDF1_EXECUTION_MAP.md`.

---

# PDF1 — GeneReview ADK Experiment (40-min Sprint Map)

## Goal

Stand up **scaffolding** (not full impl) for multiple agent implementations, their tool components, a global + per-agent README structure, and a **main driver** wired to the **ADK runner** to execute all experiments.

---

## Repo Layout (proposed)

```
gene-review/
├─ README.md                     # Global README (high-level)
├─ pdf1/
│  ├─ README.md                  # PDF1-specific overview + run guide
│  ├─ main.py                    # ADK runner entrypoint (runs all agents)
│  ├─ adk_runner_config.yaml     # Experiment/run matrix (scaffold)
│  ├─ agents/
│  │  ├─ base.py                 # Base interfaces, types, hooks
│  │  ├─ agent_rule_based/
│  │  │  ├─ README.md
│  │  │  └─ impl.py              # stub
│  │  ├─ agent_rag/
│  │  │  ├─ README.md
│  │  │  └─ impl.py              # stub
│  │  ├─ agent_programmatic/
│  │  │  ├─ README.md
│  │  │  └─ impl.py              # stub
│  │  └─ __init__.py
│  ├─ tools/
│  │  ├─ pdf_loader.py           # stub
│  │  ├─ chunker.py              # stub
│  │  ├─ retriever.py            # stub
│  │  ├─ evaluator.py            # stub (scoring hooks)
│  │  └─ __init__.py
│  ├─ data/
│  │  ├─ samples/                # tiny sample PDFs / json fixtures (optional)
│  │  └─ cache/.gitkeep
│  ├─ results/
│  │  └─ .gitkeep
│  └─ tests/
│     ├─ test_contracts.py       # smoke/contract tests (scaffold)
│     └─ __init__.py
└─ ...
```

---

## Global README (top-level)

* **What**: Brief of GeneReview + how `pdf1/` slots into it.
* **Quickstart**: `cd pdf1 && python main.py --config adk_runner_config.yaml`
* **Notes**: This is scaffolding; implementations are stubs for future PRs.

---

## `pdf1/README.md` (content outline)

* **Objective**: Close out PDF work with reproducible experiment skeleton.
* **Agents included**: rule_based, rag, programmatic (names TBD).
* **Tools**: loader, chunker, retriever, evaluator (interfaces only).
* **How to run** (dry-run mode supported):

  ```bash
  cd pdf1
  python main.py --config adk_runner_config.yaml --dry-run
  ```
* **Outputs**: `results/` directory, run logs, and evaluation artifacts (when filled in).
* **Next steps**: Fill in `impl.py` stubs and tool internals; expand config matrix.

---

## ADK Runner Entrypoint (`pdf1/main.py`) — stub

```python
# main.py
import argparse
from agents import base
from agents.agent_rule_based.impl import RuleBasedAgent
from agents.agent_rag.impl import RagAgent
from agents.agent_programmatic.impl import ProgrammaticAgent
# from adk import Runner  # placeholder: adjust import to your ADK

def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--config", default="adk_runner_config.yaml")
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()

def get_agents():
    return [
        RuleBasedAgent(name="rule_based"),
        RagAgent(name="rag"),
        ProgrammaticAgent(name="programmatic"),
    ]

def main():
    args = parse_args()
    agents = get_agents()
    # runner = Runner(config_path=args.config)  # wire actual ADK runner
    # runner.register_agents(agents)
    # runner.run(dry_run=args.dry_run)
    print("[scaffold] would run agents:", [a.name for a in agents])
    print("[scaffold] config:", args.config, "dry_run:", args.dry_run)

if __name__ == "__main__":
    main()
```

---

## Agent Base + Stubs

### `pdf1/agents/base.py`

```python
# base.py
from typing import Protocol, Any, Dict

class Agent(Protocol):
    name: str
    def setup(self, tools: Dict[str, Any]) -> None: ...
    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]: ...
    def evaluate(self, outputs: Dict[str, Any]) -> Dict[str, Any]: ...
```

### `pdf1/agents/agent_rule_based/impl.py`

```python
# impl.py
from typing import Dict, Any
from ..base import Agent

class RuleBasedAgent:
    def __init__(self, name: str):
        self.name = name
        self.tools = {}

    def setup(self, tools: Dict[str, Any]) -> None:
        self.tools = tools

    def run(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        # TODO: call pdf_loader/chunker deterministically
        return {"status": "ok", "agent": self.name, "outputs": {}}

    def evaluate(self, outputs: Dict[str, Any]) -> Dict[str, Any]:
        # TODO: plug evaluator scoring
        return {"score": None, "notes": "scaffold"}
```

> Duplicate the same scaffold pattern for `agent_rag/impl.py` and `agent_programmatic/impl.py` with TODOs indicating where retriever/prompting/programmatic logic would go.

---

## Tool Stubs

### `pdf1/tools/pdf_loader.py`

```python
def load_pdf(path: str):
    # TODO: implement PDF text extraction strategy
    return {"path": path, "pages": [], "meta": {}}
```

### `pdf1/tools/chunker.py`

```python
def chunk(text: str, strategy: str = "pages"):
    # TODO: naive split by pages/length
    return []
```

### `pdf1/tools/retriever.py`

```python
def retrieve(query: str, index):
    # TODO: vector or keyword retrieval
    return []
```

### `pdf1/tools/evaluator.py`

```python
def evaluate(run_outputs, criteria=None):
    # TODO: placeholder for scoring/metrics
    return {"metrics": {}, "artifacts": {}}
```

---

## Runner Config (`pdf1/adk_runner_config.yaml`) — scaffold

```yaml
experiment: PDF1-GeneReview
output_dir: ./results
seed: 7

datasets:
  - name: gene_pdf_samples
    path: ./data/samples
    loader: pdf_loader.load_pdf

agents:
  - name: rule_based
    module: agents.agent_rule_based.impl:RuleBasedAgent
  - name: rag
    module: agents.agent_rag.impl:RagAgent
  - name: programmatic
    module: agents.agent_programmatic.impl:ProgrammaticAgent

tools:
  pdf_loader: tools.pdf_loader:load_pdf
  chunker: tools.chunker:chunk
  retriever: tools.retriever:retrieve
  evaluator: tools.evaluator:evaluate

run_matrix:
  - agent: rule_based
    dataset: gene_pdf_samples
    params: {chunk_strategy: pages}
  - agent: rag
    dataset: gene_pdf_samples
    params: {retrieval: "bm25"}  # placeholder
  - agent: programmatic
    dataset: gene_pdf_samples
    params: {pipeline: "custom"}
```

---

## Tests (scaffold)

`pdf1/tests/test_contracts.py`

```python
def test_agent_contract():
    from pdf1.agents.agent_rule_based.impl import RuleBasedAgent
    a = RuleBasedAgent(name="rule_based")
    a.setup({})
    out = a.run({"doc": None})
    assert "status" in out and "agent" in out
```

---

## 40-Minute Timebox Plan

**00–05 min — Repo hygiene**

* `pdf1/` folder and subdirs
* `.gitkeep` where needed
* Copy this map as `pdf1/README.md` + create `PDF1_EXECUTION_MAP.md` if you want both

**05–15 min — Files & stubs**

* Create `agents/base.py`, `tools/*`, `adk_runner_config.yaml`
* Add `impl.py` in each agent subfolder
* Add `tests/test_contracts.py`

**15–25 min — Main + wiring**

* Implement `main.py` arg parsing and agent registration (scaffold)
* Ensure imports resolve
* `python main.py --dry-run` prints agent list

**25–35 min — READMEs**

* Fill `pdf1/README.md` quickstart + notes
* Confirm global `README.md` links to `pdf1/`

**35–40 min — Smoke check + commit**

```bash
python -m pytest pdf1/tests -q   # quick contract test
python pdf1/main.py --config pdf1/adk_runner_config.yaml --dry-run
git add pdf1
git commit -m "PDF1: scaffold agents/tools + ADK runner wiring (dry-run)"
```

---

## Definition of Done (for this sprint)

* [ ] Directory structure created and committed
* [ ] `main.py` runs with `--dry-run` and lists agents
* [ ] Three agent stubs present with consistent interface
* [ ] Tool stubs in place and importable
* [ ] `adk_runner_config.yaml` present and referenced by `main.py`
* [ ] `pdf1/README.md` documents how to run + extend
* [ ] Minimal test passes locally

---

## Next Up (after scaffolding)

* Implement tool internals (loader/chunker/retriever) with tiny fixtures
* Add evaluator metrics and result serialization into `results/`
* Expand run matrix (ablation flags, seeds, chunking strategies)

---

want me to drop this into a zip-able skeleton (files laid out with these stubs) so you can paste directly into the repo?
