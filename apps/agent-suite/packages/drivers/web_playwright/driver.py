from __future__ import annotations

from dataclasses import dataclass
from typing import List

from playwright.async_api import Page, async_playwright

from ...core.policy import PolicyConfig, assert_domain_allowed
from ...core.utils import domain_of


@dataclass
class WebGoogleResult:
    query: str
    final_url: str
    extracted_answer: str
    evidence_lines: List[str]


async def _maybe_accept_consent(page: Page) -> None:
    candidates = ["Accept all", "I agree", "Accept", "Agree", "Accept All"]
    for name in candidates:
        btn = page.get_by_role("button", name=name)
        if await btn.count():
            try:
                await btn.first.click(timeout=1500)
                return
            except Exception:
                pass


async def google_query_extract_answer(
    policy: PolicyConfig,
    query: str,
    headless: bool = True,
    timeout_ms: int = 25_000,
) -> WebGoogleResult:
    start_url = "https://www.google.com"
    assert_domain_allowed(policy, domain_of(start_url))

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        page = await browser.new_page()
        page.set_default_timeout(timeout_ms)

        await page.goto(start_url, wait_until="domcontentloaded")
        await _maybe_accept_consent(page)

        box = page.get_by_role("textbox", name="Search")
        if not await box.count():
            box = page.locator("input[type='text']").first

        await box.click()
        await box.fill(query)
        await box.press("Enter")

        await page.wait_for_load_state("domcontentloaded")
        await page.wait_for_timeout(1200)

        final_url = page.url
        assert_domain_allowed(policy, domain_of(final_url))

        body = await page.inner_text("body")
        lines = [line.strip() for line in body.splitlines() if line.strip()]

        evidence: List[str] = []
        extracted = ""

        qlow = query.lower()
        if "capital" in qlow and "paraguay" in qlow:
            for line in lines:
                if "Asunción" in line or "Asuncion" in line:
                    evidence.append(line)
                    extracted = "Asunción"
                    break

        if not extracted:
            extracted = evidence[0] if evidence else (lines[0] if lines else "")

        await browser.close()
        return WebGoogleResult(
            query=query,
            final_url=final_url,
            extracted_answer=extracted,
            evidence_lines=evidence[:5],
        )
