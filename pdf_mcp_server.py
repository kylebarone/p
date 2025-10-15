"""
PDF Processing MCP Server
A comprehensive PDF processing toolkit exposed via Model Context Protocol (MCP)

Dependencies:
pip install mcp PyPDF2 pdf2image pillow pytesseract pdfplumber layoutparser torch torchvision opencv-python
"""

import asyncio
import base64
import io
import json
import os
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
from pathlib import Path

# PDF Processing Libraries
import PyPDF2
from pdf2image import convert_from_path, convert_from_bytes
from PIL import Image
import pdfplumber
import cv2
import numpy as np

# MCP SDK
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent, ImageContent

# Layout Detection (optional - requires layoutparser)
try:
    import layoutparser as lp
    LAYOUT_AVAILABLE = True
except ImportError:
    LAYOUT_AVAILABLE = False


@dataclass
class PDFArtifact:
    """Represents a PDF artifact stored in memory"""
    artifact_id: str
    content: bytes
    filename: str
    num_pages: int
    metadata: Dict[str, Any]


class PDFProcessor:
    """Core PDF processing functionality"""
    
    def __init__(self):
        self.artifacts: Dict[str, PDFArtifact] = {}
        if LAYOUT_AVAILABLE:
            self.layout_model = lp.Detectron2LayoutModel(
                'lp://PubLayNet/faster_rcnn_R_50_FPN_3x/config',
                extra_config=["MODEL.ROI_HEADS.SCORE_THRESH_TEST", 0.8],
                label_map={0: "Text", 1: "Title", 2: "List", 3: "Table", 4: "Figure"}
            )
    
    def register_artifact(self, artifact_id: str, pdf_bytes: bytes, filename: str) -> PDFArtifact:
        """Register a PDF artifact for processing"""
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        num_pages = len(reader.pages)
        
        # Extract metadata
        metadata = {
            "title": reader.metadata.get('/Title', '') if reader.metadata else '',
            "author": reader.metadata.get('/Author', '') if reader.metadata else '',
            "subject": reader.metadata.get('/Subject', '') if reader.metadata else '',
            "creator": reader.metadata.get('/Creator', '') if reader.metadata else '',
        }
        
        artifact = PDFArtifact(
            artifact_id=artifact_id,
            content=pdf_bytes,
            filename=filename,
            num_pages=num_pages,
            metadata=metadata
        )
        
        self.artifacts[artifact_id] = artifact
        return artifact
    
    def read_full_text(self, artifact_id: str) -> str:
        """Extract all text from PDF"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        text_parts = []
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                text_parts.append(f"=== Page {i} ===\n{page_text}\n")
        
        return "\n".join(text_parts)
    
    def read_pages(self, artifact_id: str, page_numbers: List[int]) -> Dict[int, str]:
        """Extract text from specific pages"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        results = {}
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            for page_num in page_numbers:
                if 1 <= page_num <= len(pdf.pages):
                    page = pdf.pages[page_num - 1]
                    results[page_num] = page.extract_text() or ""
                else:
                    results[page_num] = f"Error: Page {page_num} out of range"
        
        return results
    
    def split_pages(self, artifact_id: str, page_ranges: List[Tuple[int, int]]) -> Dict[str, bytes]:
        """Split PDF into separate documents by page ranges"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        reader = PyPDF2.PdfReader(io.BytesIO(artifact.content))
        results = {}
        
        for start, end in page_ranges:
            writer = PyPDF2.PdfWriter()
            
            for page_num in range(start - 1, min(end, len(reader.pages))):
                writer.add_page(reader.pages[page_num])
            
            output = io.BytesIO()
            writer.write(output)
            results[f"pages_{start}_to_{end}"] = output.getvalue()
        
        return results
    
    def get_text_in_bbox(self, artifact_id: str, page_num: int, 
                         x0: float, y0: float, x1: float, y1: float) -> str:
        """Extract text within a bounding box (coordinates in points)"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            if page_num < 1 or page_num > len(pdf.pages):
                return f"Error: Page {page_num} out of range"
            
            page = pdf.pages[page_num - 1]
            bbox = (x0, y0, x1, y1)
            cropped = page.within_bbox(bbox)
            return cropped.extract_text() or ""
    
    def search_text(self, artifact_id: str, query: str, 
                    case_sensitive: bool = False) -> List[Dict[str, Any]]:
        """Search for text across all pages"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        results = []
        search_query = query if case_sensitive else query.lower()
        
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            for i, page in enumerate(pdf.pages, 1):
                page_text = page.extract_text() or ""
                search_text = page_text if case_sensitive else page_text.lower()
                
                if search_query in search_text:
                    # Find all occurrences
                    start = 0
                    while True:
                        pos = search_text.find(search_query, start)
                        if pos == -1:
                            break
                        
                        # Extract context (50 chars before and after)
                        context_start = max(0, pos - 50)
                        context_end = min(len(page_text), pos + len(query) + 50)
                        context = page_text[context_start:context_end]
                        
                        results.append({
                            "page": i,
                            "position": pos,
                            "context": context,
                            "matched_text": page_text[pos:pos + len(query)]
                        })
                        
                        start = pos + 1
        
        return results
    
    def screenshot_page(self, artifact_id: str, page_num: int, 
                       dpi: int = 200) -> bytes:
        """Generate a screenshot of a specific page"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        images = convert_from_bytes(
            artifact.content,
            first_page=page_num,
            last_page=page_num,
            dpi=dpi
        )
        
        if not images:
            raise ValueError(f"Could not convert page {page_num}")
        
        img_byte_arr = io.BytesIO()
        images[0].save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()
    
    def screenshot_bbox(self, artifact_id: str, page_num: int,
                       x0: float, y0: float, x1: float, y1: float,
                       dpi: int = 200) -> bytes:
        """Screenshot a specific region of a page"""
        # First get full page screenshot
        full_image_bytes = self.screenshot_page(artifact_id, page_num, dpi)
        image = Image.open(io.BytesIO(full_image_bytes))
        
        # PDF coordinates are in points (1/72 inch), convert to pixels
        scale = dpi / 72
        pixel_x0 = int(x0 * scale)
        pixel_y0 = int(y0 * scale)
        pixel_x1 = int(x1 * scale)
        pixel_y1 = int(y1 * scale)
        
        # Crop the image
        cropped = image.crop((pixel_x0, pixel_y0, pixel_x1, pixel_y1))
        
        img_byte_arr = io.BytesIO()
        cropped.save(img_byte_arr, format='PNG')
        return img_byte_arr.getvalue()
    
    def infer_layout(self, artifact_id: str, page_num: int) -> Dict[str, Any]:
        """Detect layout elements using ML model"""
        if not LAYOUT_AVAILABLE:
            return {"error": "Layout detection not available. Install layoutparser."}
        
        # Get page as image
        image_bytes = self.screenshot_page(artifact_id, page_num, dpi=150)
        image = Image.open(io.BytesIO(image_bytes))
        image_np = np.array(image)
        
        # Detect layout
        layout = self.layout_model.detect(image_np)
        
        # Convert to serializable format
        elements = []
        for block in layout:
            elements.append({
                "type": block.type,
                "bbox": {
                    "x0": float(block.block.x_1),
                    "y0": float(block.block.y_1),
                    "x1": float(block.block.x_2),
                    "y1": float(block.block.y_2)
                },
                "confidence": float(block.score)
            })
        
        return {
            "page": page_num,
            "elements": elements,
            "num_elements": len(elements)
        }
    
    def extract_tables(self, artifact_id: str, page_num: int) -> List[List[List[str]]]:
        """Extract tables from a page"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            if page_num < 1 or page_num > len(pdf.pages):
                return []
            
            page = pdf.pages[page_num - 1]
            tables = page.extract_tables()
            return tables or []
    
    def get_page_dimensions(self, artifact_id: str, page_num: int) -> Dict[str, float]:
        """Get page dimensions in points"""
        artifact = self.artifacts.get(artifact_id)
        if not artifact:
            raise ValueError(f"Artifact {artifact_id} not found")
        
        with pdfplumber.open(io.BytesIO(artifact.content)) as pdf:
            if page_num < 1 or page_num > len(pdf.pages):
                return {"error": f"Page {page_num} out of range"}
            
            page = pdf.pages[page_num - 1]
            return {
                "width": float(page.width),
                "height": float(page.height)
            }


# Initialize MCP Server
app = Server("pdf-processor")
processor = PDFProcessor()


@app.list_tools()
async def list_tools() -> List[Tool]:
    """List all available PDF processing tools"""
    return [
        Tool(
            name="register_pdf",
            description="Register a PDF artifact for processing. Provide artifact_id and base64-encoded PDF content.",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "pdf_base64": {"type": "string"},
                    "filename": {"type": "string"}
                },
                "required": ["artifact_id", "pdf_base64", "filename"]
            }
        ),
        Tool(
            name="read_full_text",
            description="Extract all text from the PDF",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"}
                },
                "required": ["artifact_id"]
            }
        ),
        Tool(
            name="read_pages",
            description="Extract text from specific page numbers",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_numbers": {
                        "type": "array",
                        "items": {"type": "integer"}
                    }
                },
                "required": ["artifact_id", "page_numbers"]
            }
        ),
        Tool(
            name="search_text",
            description="Search for text across all pages",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "query": {"type": "string"},
                    "case_sensitive": {"type": "boolean"}
                },
                "required": ["artifact_id", "query"]
            }
        ),
        Tool(
            name="get_text_in_bbox",
            description="Extract text within bounding box (x0, y0, x1, y1) in points",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"},
                    "x0": {"type": "number"},
                    "y0": {"type": "number"},
                    "x1": {"type": "number"},
                    "y1": {"type": "number"}
                },
                "required": ["artifact_id", "page_num", "x0", "y0", "x1", "y1"]
            }
        ),
        Tool(
            name="screenshot_page",
            description="Generate screenshot of entire page",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"},
                    "dpi": {"type": "integer"}
                },
                "required": ["artifact_id", "page_num"]
            }
        ),
        Tool(
            name="screenshot_bbox",
            description="Screenshot specific region (x0, y0, x1, y1) in points",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"},
                    "x0": {"type": "number"},
                    "y0": {"type": "number"},
                    "x1": {"type": "number"},
                    "y1": {"type": "number"},
                    "dpi": {"type": "integer"}
                },
                "required": ["artifact_id", "page_num", "x0", "y0", "x1", "y1"]
            }
        ),
        Tool(
            name="split_pages",
            description="Split PDF into separate documents by page ranges",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_ranges": {
                        "type": "array",
                        "items": {
                            "type": "array",
                            "items": {"type": "integer"},
                            "minItems": 2,
                            "maxItems": 2
                        }
                    }
                },
                "required": ["artifact_id", "page_ranges"]
            }
        ),
        Tool(
            name="infer_layout",
            description="Detect layout elements (text, title, table, figure) using ML",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"}
                },
                "required": ["artifact_id", "page_num"]
            }
        ),
        Tool(
            name="extract_tables",
            description="Extract tables from a specific page",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"}
                },
                "required": ["artifact_id", "page_num"]
            }
        ),
        Tool(
            name="get_page_dimensions",
            description="Get page dimensions in points",
            inputSchema={
                "type": "object",
                "properties": {
                    "artifact_id": {"type": "string"},
                    "page_num": {"type": "integer"}
                },
                "required": ["artifact_id", "page_num"]
            }
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: Any) -> List[TextContent | ImageContent]:
    """Handle tool calls"""
    
    try:
        if name == "register_pdf":
            pdf_bytes = base64.b64decode(arguments["pdf_base64"])
            artifact = processor.register_artifact(
                arguments["artifact_id"],
                pdf_bytes,
                arguments["filename"]
            )
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "success",
                    "artifact_id": artifact.artifact_id,
                    "num_pages": artifact.num_pages,
                    "metadata": artifact.metadata
                }, indent=2)
            )]
        
        elif name == "read_full_text":
            text = processor.read_full_text(arguments["artifact_id"])
            return [TextContent(type="text", text=text)]
        
        elif name == "read_pages":
            results = processor.read_pages(
                arguments["artifact_id"],
                arguments["page_numbers"]
            )
            return [TextContent(
                type="text",
                text=json.dumps(results, indent=2)
            )]
        
        elif name == "search_text":
            results = processor.search_text(
                arguments["artifact_id"],
                arguments["query"],
                arguments.get("case_sensitive", False)
            )
            return [TextContent(
                type="text",
                text=json.dumps(results, indent=2)
            )]
        
        elif name == "get_text_in_bbox":
            text = processor.get_text_in_bbox(
                arguments["artifact_id"],
                arguments["page_num"],
                arguments["x0"],
                arguments["y0"],
                arguments["x1"],
                arguments["y1"]
            )
            return [TextContent(type="text", text=text)]
        
        elif name == "screenshot_page":
            img_bytes = processor.screenshot_page(
                arguments["artifact_id"],
                arguments["page_num"],
                arguments.get("dpi", 200)
            )
            return [ImageContent(
                type="image",
                data=base64.b64encode(img_bytes).decode(),
                mimeType="image/png"
            )]
        
        elif name == "screenshot_bbox":
            img_bytes = processor.screenshot_bbox(
                arguments["artifact_id"],
                arguments["page_num"],
                arguments["x0"],
                arguments["y0"],
                arguments["x1"],
                arguments["y1"],
                arguments.get("dpi", 200)
            )
            return [ImageContent(
                type="image",
                data=base64.b64encode(img_bytes).decode(),
                mimeType="image/png"
            )]
        
        elif name == "split_pages":
            results = processor.split_pages(
                arguments["artifact_id"],
                arguments["page_ranges"]
            )
            # Return base64 encoded PDFs
            output = {}
            for key, pdf_bytes in results.items():
                output[key] = base64.b64encode(pdf_bytes).decode()
            return [TextContent(
                type="text",
                text=json.dumps(output, indent=2)
            )]
        
        elif name == "infer_layout":
            layout = processor.infer_layout(
                arguments["artifact_id"],
                arguments["page_num"]
            )
            return [TextContent(
                type="text",
                text=json.dumps(layout, indent=2)
            )]
        
        elif name == "extract_tables":
            tables = processor.extract_tables(
                arguments["artifact_id"],
                arguments["page_num"]
            )
            return [TextContent(
                type="text",
                text=json.dumps(tables, indent=2)
            )]
        
        elif name == "get_page_dimensions":
            dims = processor.get_page_dimensions(
                arguments["artifact_id"],
                arguments["page_num"]
            )
            return [TextContent(
                type="text",
                text=json.dumps(dims, indent=2)
            )]
        
        else:
            return [TextContent(
                type="text",
                text=f"Unknown tool: {name}"
            )]
    
    except Exception as e:
        return [TextContent(
            type="text",
            text=f"Error: {str(e)}"
        )]


async def main():
    """Run the MCP server"""
    async with stdio_server() as (read_stream, write_stream):
        await app.run(
            read_stream,
            write_stream,
            app.create_initialization_options()
        )


if __name__ == "__main__":
    asyncio.run(main())
