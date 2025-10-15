"""
Comprehensive Test Suite for PDF Core Operations
Tests all foundational operations with various edge cases
"""

import unittest
import io
from pathlib import Path

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch

# Import our core operations
from pdf_core_operations import (
    read_full_text,
    read_pages,
    search_text,
    get_text_in_bbox,
    get_page_dimensions,
    screenshot_page,
    screenshot_bbox,
    split_pages,
    get_pdf_info,
    validate_pdf
)


# =============================================================================
# TEST PDF GENERATORS
# =============================================================================

class PDFGenerator:
    """Helper class to generate test PDFs"""
    
    @staticmethod
    def create_simple_text_pdf() -> bytes:
        """Create a simple single-page PDF with text"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # Title
        c.setFont("Helvetica-Bold", 24)
        c.drawString(100, 750, "Test Document")
        
        # Body text with searchable content
        c.setFont("Helvetica", 12)
        c.drawString(100, 700, "This is a test PDF document.")
        c.drawString(100, 680, "It contains sample text for testing.")
        c.drawString(100, 660, "The word methodology appears here: methodology.")
        c.drawString(100, 640, "This line has THE word appearing twice: THE.")
        
        # Footer
        c.setFont("Helvetica", 10)
        c.drawString(100, 50, "Page 1 of 1")
        
        c.showPage()
        c.save()
        
        return buffer.getvalue()
    
    @staticmethod
    def create_multipage_pdf(num_pages: int = 5) -> bytes:
        """Create a multi-page PDF"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        for page_num in range(1, num_pages + 1):
            c.setFont("Helvetica-Bold", 16)
            c.drawString(100, 750, f"Page {page_num}")
            
            c.setFont("Helvetica", 12)
            c.drawString(100, 700, f"This is page {page_num} content.")
            c.drawString(100, 680, f"Unique identifier: page_{page_num}_marker")
            
            if page_num == 3:
                c.drawString(100, 650, "Special text only on page 3")
            
            c.setFont("Helvetica", 10)
            c.drawString(100, 50, f"Page {page_num} of {num_pages}")
            
            c.showPage()
        
        c.save()
        return buffer.getvalue()
    
    @staticmethod
    def create_pdf_with_regions() -> bytes:
        """Create a PDF with distinct regions for bbox testing"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        
        width, height = letter
        
        # Header region (top)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(100, height - 50, "HEADER SECTION")
        
        # Left column (x: 72-288)
        c.setFont("Helvetica", 10)
        c.drawString(72, 500, "Left column text")
        c.drawString(72, 480, "More left text")
        
        # Right column (x: 324-540)
        c.drawString(324, 500, "Right column text")
        c.drawString(324, 480, "More right text")
        
        # Footer region (bottom)
        c.setFont("Helvetica-Bold", 14)
        c.drawString(100, 50, "FOOTER SECTION")
        
        # Signature block (bottom right)
        c.setFont("Helvetica", 10)
        c.drawString(400, 100, "Signature: _____________")
        c.drawString(400, 80, "Date: _____________")
        
        c.showPage()
        c.save()
        
        return buffer.getvalue()
    
    @staticmethod
    def create_empty_pdf() -> bytes:
        """Create a PDF with a blank page"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        c.showPage()
        c.save()
        return buffer.getvalue()
    
    @staticmethod
    def create_different_sizes_pdf() -> bytes:
        """Create a PDF with different page sizes"""
        buffer = io.BytesIO()
        c = canvas.Canvas(buffer)
        
        # Page 1: Letter size
        c.setPageSize(letter)
        c.drawString(100, 700, "Letter size page")
        c.showPage()
        
        # Page 2: A4 size
        c.setPageSize(A4)
        c.drawString(100, 700, "A4 size page")
        c.showPage()
        
        c.save()
        return buffer.getvalue()


# =============================================================================
# TEST CASES
# =============================================================================

class TestReadFullText(unittest.TestCase):
    """Test full text extraction"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
        self.multipage_pdf = PDFGenerator.create_multipage_pdf(5)
        self.empty_pdf = PDFGenerator.create_empty_pdf()
    
    def test_simple_text_extraction(self):
        """Test extracting text from simple PDF"""
        text = read_full_text(self.simple_pdf)
        
        self.assertIn("Test Document", text)
        self.assertIn("methodology", text)
        self.assertIn("=== Page 1 ===", text)
    
    def test_multipage_extraction(self):
        """Test extracting text from multi-page PDF"""
        text = read_full_text(self.multipage_pdf)
        
        # Check all pages are present
        for i in range(1, 6):
            self.assertIn(f"=== Page {i} ===", text)
            self.assertIn(f"page_{i}_marker", text)
    
    def test_empty_page_extraction(self):
        """Test extracting from empty PDF"""
        text = read_full_text(self.empty_pdf)
        
        # Should handle gracefully
        self.assertIn("=== Page 1 ===", text)
    
    def test_invalid_pdf(self):
        """Test with invalid PDF data"""
        with self.assertRaises(ValueError):
            read_full_text(b"not a pdf")


class TestReadPages(unittest.TestCase):
    """Test selective page extraction"""
    
    def setUp(self):
        self.multipage_pdf = PDFGenerator.create_multipage_pdf(5)
    
    def test_read_valid_pages(self):
        """Test reading valid page numbers"""
        results = read_pages(self.multipage_pdf, [1, 3, 5])
        
        self.assertEqual(len(results), 3)
        self.assertIn("Page 1", results[1])
        self.assertIn("page_3_marker", results[3])
        self.assertIn("Page 5", results[5])
    
    def test_read_invalid_pages(self):
        """Test reading invalid page numbers"""
        results = read_pages(self.multipage_pdf, [1, 10, 100])
        
        self.assertIn("Page 1", results[1])
        self.assertIn("Error", results[10])
        self.assertIn("out of range", results[10].lower())
        self.assertIn("Error", results[100])
    
    def test_read_negative_page(self):
        """Test reading negative page number"""
        results = read_pages(self.multipage_pdf, [-1, 1])
        
        self.assertIn("Error", results[-1])
        self.assertIn("Page 1", results[1])
    
    def test_read_unordered_pages(self):
        """Test reading pages in non-sequential order"""
        results = read_pages(self.multipage_pdf, [5, 2, 4, 1])
        
        self.assertEqual(len(results), 4)
        self.assertIn("Page 5", results[5])
        self.assertIn("Page 2", results[2])


class TestSearchText(unittest.TestCase):
    """Test text search functionality"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
        self.multipage_pdf = PDFGenerator.create_multipage_pdf(5)
    
    def test_case_insensitive_search(self):
        """Test case-insensitive search"""
        results = search_text(self.simple_pdf, "test", case_sensitive=False)
        
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["page"], 1)
    
    def test_case_sensitive_search(self):
        """Test case-sensitive search"""
        # Search for "THE" (uppercase)
        results = search_text(self.simple_pdf, "THE", case_sensitive=True)
        
        # Should find exactly 2 occurrences
        self.assertEqual(len(results), 2)
        
        # Search for "the" (lowercase) - should find different occurrences
        results_lower = search_text(self.simple_pdf, "the", case_sensitive=True)
        self.assertNotEqual(len(results), len(results_lower))
    
    def test_multipage_search(self):
        """Test searching across multiple pages"""
        results = search_text(self.multipage_pdf, "page_", case_sensitive=False)
        
        # Should find marker on each page
        self.assertEqual(len(results), 5)
        
        # Check pages are correct
        pages = [r["page"] for r in results]
        self.assertEqual(sorted(pages), [1, 2, 3, 4, 5])
    
    def test_search_context(self):
        """Test that context is provided"""
        results = search_text(self.simple_pdf, "methodology")
        
        self.assertGreater(len(results), 0)
        self.assertIn("context", results[0])
        self.assertIn("methodology", results[0]["context"])
    
    def test_search_not_found(self):
        """Test search with no results"""
        results = search_text(self.simple_pdf, "xyznonexistent")
        
        self.assertEqual(len(results), 0)
    
    def test_empty_query(self):
        """Test search with empty query"""
        results = search_text(self.simple_pdf, "")
        
        self.assertEqual(len(results), 0)


class TestGetTextInBbox(unittest.TestCase):
    """Test bounding box text extraction"""
    
    def setUp(self):
        self.region_pdf = PDFGenerator.create_pdf_with_regions()
    
    def test_extract_header(self):
        """Test extracting header region"""
        text = get_text_in_bbox(
            self.region_pdf, 1,
            x0=0, y0=0, x1=612, y1=100
        )
        
        self.assertIn("HEADER", text)
    
    def test_extract_footer(self):
        """Test extracting footer region"""
        text = get_text_in_bbox(
            self.region_pdf, 1,
            x0=0, y0=692, x1=612, y1=792
        )
        
        self.assertIn("FOOTER", text)
    
    def test_extract_left_column(self):
        """Test extracting left column"""
        text = get_text_in_bbox(
            self.region_pdf, 1,
            x0=72, y0=400, x1=288, y1=600
        )
        
        self.assertIn("Left column", text)
        self.assertNotIn("Right column", text)
    
    def test_extract_signature_block(self):
        """Test extracting signature region"""
        text = get_text_in_bbox(
            self.region_pdf, 1,
            x0=350, y0=50, x1=550, y1=150
        )
        
        self.assertIn("Signature", text)
        self.assertIn("Date", text)
    
    def test_invalid_bbox(self):
        """Test with invalid bounding box"""
        with self.assertRaises(ValueError):
            get_text_in_bbox(
                self.region_pdf, 1,
                x0=100, y0=100, x1=50, y1=200  # x0 > x1
            )
    
    def test_invalid_page(self):
        """Test with invalid page number"""
        with self.assertRaises(ValueError):
            get_text_in_bbox(
                self.region_pdf, 100,
                x0=0, y0=0, x1=100, y1=100
            )


class TestGetPageDimensions(unittest.TestCase):
    """Test page dimension retrieval"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
        self.different_sizes = PDFGenerator.create_different_sizes_pdf()
    
    def test_letter_size(self):
        """Test getting dimensions of letter-size page"""
        dims = get_page_dimensions(self.simple_pdf, 1)
        
        # Letter size is 612 x 792 points
        self.assertEqual(dims["width"], 612.0)
        self.assertEqual(dims["height"], 792.0)
    
    def test_different_page_sizes(self):
        """Test PDF with different page sizes"""
        # Page 1: Letter
        dims1 = get_page_dimensions(self.different_sizes, 1)
        self.assertEqual(dims1["width"], 612.0)
        
        # Page 2: A4
        dims2 = get_page_dimensions(self.different_sizes, 2)
        self.assertAlmostEqual(dims2["width"], 595.0, delta=1.0)
    
    def test_invalid_page(self):
        """Test with invalid page number"""
        with self.assertRaises(ValueError):
            get_page_dimensions(self.simple_pdf, 100)


class TestScreenshotPage(unittest.TestCase):
    """Test page screenshot generation"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
    
    def test_screenshot_default_dpi(self):
        """Test screenshot with default DPI"""
        img_bytes = screenshot_page(self.simple_pdf, 1)
        
        self.assertIsInstance(img_bytes, bytes)
        self.assertGreater(len(img_bytes), 1000)  # Should be substantial
        
        # Verify it's PNG
        self.assertTrue(img_bytes.startswith(b'\x89PNG'))
    
    def test_screenshot_high_dpi(self):
        """Test screenshot with high DPI"""
        img_bytes = screenshot_page(self.simple_pdf, 1, dpi=300)
        
        # Higher DPI should produce larger file
        img_bytes_low = screenshot_page(self.simple_pdf, 1, dpi=100)
        self.assertGreater(len(img_bytes), len(img_bytes_low))
    
    def test_screenshot_invalid_page(self):
        """Test screenshot of invalid page"""
        with self.assertRaises(ValueError):
            screenshot_page(self.simple_pdf, 100)
    
    def test_screenshot_invalid_dpi(self):
        """Test screenshot with invalid DPI"""
        with self.assertRaises(ValueError):
            screenshot_page(self.simple_pdf, 1, dpi=10)  # Too low
        
        with self.assertRaises(ValueError):
            screenshot_page(self.simple_pdf, 1, dpi=1000)  # Too high


class TestScreenshotBbox(unittest.TestCase):
    """Test region screenshot generation"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
    
    def test_screenshot_small_region(self):
        """Test screenshotting a small region"""
        img_bytes = screenshot_bbox(
            self.simple_pdf, 1,
            x0=100, y0=100, x1=300, y1=300
        )
        
        self.assertIsInstance(img_bytes, bytes)
        self.assertGreater(len(img_bytes), 100)
    
    def test_region_smaller_than_full(self):
        """Test that region screenshot is smaller than full page"""
        full_img = screenshot_page(self.simple_pdf, 1)
        region_img = screenshot_bbox(
            self.simple_pdf, 1,
            x0=100, y0=100, x1=200, y1=200
        )
        
        self.assertLess(len(region_img), len(full_img))
    
    def test_invalid_bbox(self):
        """Test with invalid bounding box"""
        with self.assertRaises(ValueError):
            screenshot_bbox(
                self.simple_pdf, 1,
                x0=200, y0=200, x1=100, y1=100  # Invalid
            )


class TestSplitPages(unittest.TestCase):
    """Test PDF splitting"""
    
    def setUp(self):
        self.multipage_pdf = PDFGenerator.create_multipage_pdf(10)
    
    def test_split_into_chunks(self):
        """Test splitting PDF into chunks"""
        splits = split_pages(self.multipage_pdf, [
            (1, 3),
            (4, 7),
            (8, 10)
        ])
        
        self.assertEqual(len(splits), 3)
        self.assertIn("pages_1_to_3", splits)
        self.assertIn("pages_4_to_7", splits)
        self.assertIn("pages_8_to_10", splits)
        
        # Verify each split is valid PDF
        for split_bytes in splits.values():
            if split_bytes:
                self.assertTrue(validate_pdf(split_bytes))
    
    def test_split_single_pages(self):
        """Test splitting into individual pages"""
        splits = split_pages(self.multipage_pdf, [
            (1, 1),
            (2, 2),
            (3, 3)
        ])
        
        self.assertEqual(len(splits), 3)
    
    def test_split_overlapping_ranges(self):
        """Test splitting with overlapping ranges"""
        splits = split_pages(self.multipage_pdf, [
            (1, 5),
            (3, 8)
        ])
        
        # Should handle overlap gracefully
        self.assertEqual(len(splits), 2)
    
    def test_split_out_of_range(self):
        """Test splitting with out of range pages"""
        splits = split_pages(self.multipage_pdf, [
            (1, 5),
            (50, 100)  # Out of range
        ])
        
        # First split should work
        self.assertIn("pages_1_to_5", splits)
        self.assertIsNotNone(splits["pages_1_to_5"])
    
    def test_empty_ranges(self):
        """Test with empty range list"""
        with self.assertRaises(ValueError):
            split_pages(self.multipage_pdf, [])


class TestUtilityFunctions(unittest.TestCase):
    """Test utility functions"""
    
    def setUp(self):
        self.simple_pdf = PDFGenerator.create_simple_text_pdf()
        self.multipage_pdf = PDFGenerator.create_multipage_pdf(5)
    
    def test_get_pdf_info(self):
        """Test getting PDF info"""
        info = get_pdf_info(self.multipage_pdf)
        
        self.assertIn("num_pages", info)
        self.assertEqual(info["num_pages"], 5)
        self.assertIn("metadata", info)
    
    def test_validate_valid_pdf(self):
        """Test validating valid PDF"""
        self.assertTrue(validate_pdf(self.simple_pdf))
    
    def test_validate_invalid_pdf(self):
        """Test validating invalid PDF"""
        self.assertFalse(validate_pdf(b"not a pdf"))
        self.assertFalse(validate_pdf(b""))


# =============================================================================
# TEST RUNNER
# =============================================================================

def run_tests():
    """Run all tests with detailed output"""
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add all test classes
    test_classes = [
        TestReadFullText,
        TestReadPages,
        TestSearchText,
        TestGetTextInBbox,
        TestGetPageDimensions,
        TestScreenshotPage,
        TestScreenshotBbox,
        TestSplitPages,
        TestUtilityFunctions
    ]
    
    for test_class in test_classes:
        tests = loader.loadTestsFromTestCase(test_class)
        suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    print(f"Tests run: {result.testsRun}")
    print(f"Successes: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {(result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100:.1f}%")
    print("=" * 70)
    
    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    exit(0 if success else 1)
