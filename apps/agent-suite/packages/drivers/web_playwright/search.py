from __future__ import annotations

from dataclasses import dataclass
from typing import List
from urllib.parse import quote_plus

from playwright.async_api import async_playwright, Page

from ...core.policy import PolicyConfig, assert_domain_allowed
from ...core.utils import domain_of


@dataclass
class SearchHit:
    title: str
    url: str
    snippet: str


@dataclass
class WebSearchResult:
    engine: str
    query: str
    hits: List[SearchHit]


async def _inner_text_safe(page: Page, selector: str, timeout_ms: int = 1500) -> str:
    try:
        loc = page.locator(selector).first
        if await loc.count():
            return (await loc.inner_text(timeout=timeout_ms)).strip()
    except Exception:
        pass
    return ""


async def duckduckgo_search(
    policy: PolicyConfig, query: str, headless: bool = True, timeout_ms: int = 25_000
) -> WebSearchResult:
    base = "https://duckduckgo.com/"
    assert_domain_allowed(policy, domain_of(base))
    url = base + "?q=" + quote_plus(query)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        page = await browser.new_page()
        page.set_default_timeout(timeout_ms)

        await page.goto(url, wait_until="domcontentloaded")
        await page.wait_for_timeout(800)

        # Try modern DDG selectors first, then fall back
        hits: List[SearchHit] = []

        # Modern DDG: result cards
        # title links: a[data-testid="result-title-a"]
        try:
            title_links = page.locator('a[data-testid="result-title-a"]')
            n = await title_links.count()
            if n:
                for i in range(min(5, n)):
                    a = title_links.nth(i)
                    title = (await a.inner_text()).strip()
                    href = (await a.get_attribute("href")) or ""
                    # Snippet often in sibling divs
                    card = a.locator("xpath=ancestor::article[1]")
                    snippet = ""
                    try:
                        snippet = (
                            await card.locator(
                                'div[data-testid="result-snippet"]'
                            ).first.inner_text()
                        ).strip()
                    except Exception:
                        snippet = ""
                    hits.append(SearchHit(title=title, url=href, snippet=snippet))
        except Exception:
            hits = []

        # Legacy fallback
        if not hits:
            try:
                title_links = page.locator("a.result__a")
                n = await title_links.count()
                for i in range(min(5, n)):
                    a = title_links.nth(i)
                    title = (await a.inner_text()).strip()
                    href = (await a.get_attribute("href")) or ""
                    snippet = ""
                    try:
                        snippet = (
                            await a.locator(
                                "xpath=ancestor::div[contains(@class,'result')]"
                            )
                            .locator(".result__snippet")
                            .first.inner_text()
                        ).strip()
                    except Exception:
                        snippet = ""
                    hits.append(SearchHit(title=title, url=href, snippet=snippet))
            except Exception:
                hits = []

        await browser.close()
        return WebSearchResult(engine="duckduckgo", query=query, hits=hits)
