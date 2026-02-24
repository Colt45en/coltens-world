from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List

from .utils import ensure_dir, is_subpath, normalize_domains


@dataclass(frozen=True)
class PolicyConfig:
    allowed_roots: List[Path]
    allowed_domains: set[str]
    allow_destructive: bool = False


def default_policy(repo_root: Path) -> PolicyConfig:
    """
    Safe-by-default:
    - filesystem: only repo_root/sandbox
    - network: only google.com (you can extend with --allow-domain)
    """
    sandbox = (repo_root / "sandbox").resolve()
    ensure_dir(sandbox)
    return PolicyConfig(
        allowed_roots=[sandbox],
        allowed_domains=normalize_domains({"google.com", "www.google.com"}),
        allow_destructive=False,
    )


def add_allowed_roots(cfg: PolicyConfig, roots: Iterable[Path]) -> PolicyConfig:
    merged = list(cfg.allowed_roots)
    for r in roots:
        rr = r.expanduser().resolve()
        if rr not in merged:
            merged.append(rr)
    return PolicyConfig(allowed_roots=merged, allowed_domains=set(cfg.allowed_domains), allow_destructive=cfg.allow_destructive)


def add_allowed_domains(cfg: PolicyConfig, domains: Iterable[str]) -> PolicyConfig:
    merged = set(cfg.allowed_domains)
    merged |= normalize_domains(domains)
    return PolicyConfig(allowed_roots=list(cfg.allowed_roots), allowed_domains=merged, allow_destructive=cfg.allow_destructive)


def assert_path_allowed(cfg: PolicyConfig, path: Path) -> Path:
    path = path.expanduser().resolve()
    for root in cfg.allowed_roots:
        if is_subpath(path, root):
            return path
    allowed_str = ", ".join(str(r) for r in cfg.allowed_roots)
    raise PermissionError(f"Path not allowed by policy: {path} (allowed_roots={allowed_str})")


def assert_domain_allowed(cfg: PolicyConfig, domain: str) -> None:
    domain = (domain or "").lower().strip()
    if not domain:
        raise PermissionError("Empty domain not allowed")
    for allowed in cfg.allowed_domains:
        if domain == allowed or domain.endswith("." + allowed):
            return
    raise PermissionError(f"Domain not allowed by policy: {domain} (allowed={sorted(cfg.allowed_domains)})")
