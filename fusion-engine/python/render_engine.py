# python/render_engine.py
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, Union, Type
from abc import ABC, abstractmethod
from types import TracebackType

from playwright.async_api import async_playwright
import base64

class RenderEngine(ABC):
    """Abstract base class for rendering engines"""
    @abstractmethod
    async def __aenter__(self) -> "RenderEngine":
        """Async context manager entry"""
        pass

    @abstractmethod
    async def __aexit__(self, exc_type: Optional[Type[BaseException]], exc_val: Optional[BaseException], exc_tb: Optional[TracebackType]) -> None:
        """Async context manager exit"""
        pass

    @abstractmethod
    async def render_html(self, html: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Render HTML content and return result"""
        pass

    @abstractmethod
    async def render_file(self, file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Render HTML file and return result"""
        pass

class PlaywrightRenderer(RenderEngine):
    """Headless browser renderer using Playwright"""

    def __init__(self):
        self._playwright = None
        self._browser: Optional[Any] = None

    async def __aenter__(self) -> "PlaywrightRenderer":
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--single-process',  # Helps with memory
                '--disable-gpu'
            ]
        )
        return self

    async def __aexit__(self, exc_type: Optional[Type[BaseException]], exc_val: Optional[BaseException], exc_tb: Optional[TracebackType]) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()

    async def render_html(self, html: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Render HTML string to PNG/PDF"""
        options = options or {}
        width = options.get('width', 1920)
        height = options.get('height', 1080)
        format_type = options.get('format', 'png')  # png, pdf, jpeg
        quality = options.get('quality', 90)

        if self._browser is None:
            raise RuntimeError("Browser not initialized. Use 'async with PlaywrightRenderer()' context manager.")
        page = await self._browser.new_page()
        try:
            await page.set_viewport_size({'width': width, 'height': height})
            await page.set_content(html, wait_until='networkidle')

            # Wait a bit for any dynamic content
            await asyncio.sleep(0.1)

            if format_type == 'pdf':
                pdf_bytes = await page.pdf(format='A4')
                return {
                    'format': 'pdf',
                    'data': base64.b64encode(pdf_bytes).decode(),
                    'content_type': 'application/pdf'
                }
            else:
                screenshot = await page.screenshot(
                    type=format_type if format_type != 'png' else 'png',
                    quality=quality if format_type == 'jpeg' else None,
                    full_page=options.get('full_page', True)
                )
                return {
                    'format': format_type,
                    'data': base64.b64encode(screenshot).decode(),
                    'content_type': f'image/{format_type}',
                    'width': width,
                    'height': height
                }
        finally:
            await page.close()

    async def render_file(self, file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Render HTML file to image/PDF"""
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
        return await self.render_html(html, options)

class HtmlRenderer:
    """Main renderer that can use different engines"""

    def __init__(self) -> None:
        self._engines: Dict[str, Type[RenderEngine]] = {}

    def register_engine(self, name: str, engine_class: Type[RenderEngine]) -> None:
        """Register a rendering engine"""
        self._engines[name] = engine_class

    async def render(self, content: Union[str, Path], engine: str = 'playwright',
                    options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Render content using specified engine"""

        if engine not in self._engines:
            raise ValueError(f"Engine '{engine}' not registered")

        engine_class = self._engines[engine]

        async with engine_class() as renderer:
            if Path(content).exists():
                return await renderer.render_file(str(content), options)
            else:
                return await renderer.render_html(str(content), options)

# Global renderer instance
html_renderer = HtmlRenderer()
html_renderer.register_engine('playwright', PlaywrightRenderer)

async def render_html_content(html: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Convenience function to render HTML content"""
    return await html_renderer.render(html, 'playwright', options)

async def render_html_file(file_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Convenience function to render HTML file"""
    return await html_renderer.render(file_path, 'playwright', options)

# Example usage for testing
async def test_renderer():
    """Test the renderer with a simple HTML page"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Render</title>
        <style>
            body { font-family: Arial; padding: 20px; }
            .header { color: #333; border-bottom: 2px solid #06b6d4; padding-bottom: 10px; }
            .content { margin: 20px 0; }
        </style>
    </head>
    <body>
        <h1 class="header">Fusion Engine Render Test</h1>
        <div class="content">
            <p>This HTML was rendered locally without internet access!</p>
            <p>Timestamp: <span id="timestamp"></span></p>
        </div>
        <script>
            document.getElementById('timestamp').textContent = new Date().toLocaleString();
        </script>
    </body>
    </html>
    """

    result = await render_html_content(html, {
        'width': 1200,
        'height': 800,
        'format': 'png'
    })

    # Save the result
    output_dir = Path(__file__).parent / "data" / "renders"
    output_dir.mkdir(parents=True, exist_ok=True)

    if result['format'] == 'pdf':
        output_path = output_dir / "test_render.pdf"
        with open(output_path, 'wb') as f:
            f.write(base64.b64decode(result['data']))
    else:
        output_path = output_dir / f"test_render.{result['format']}"
        with open(output_path, 'wb') as f:
            f.write(base64.b64decode(result['data']))

    print(f"Rendered to: {output_path}")
    return result

if __name__ == "__main__":
    asyncio.run(test_renderer())
