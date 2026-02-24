import React, { useMemo, useState } from "react";
import type { LexiconIndex } from "../lexicon/lexiconIndex.schema";
import { useLexiconIndex } from "./hooks/useLexiconIndex";
import "./LexiconBrowser.css";

interface LexiconBrowserProps {
  indexFilePath?: string;
  onLoadIndex?: (_path: string) => Promise<LexiconIndex>;
}

export const LexiconBrowser: React.FC<LexiconBrowserProps> = ({
  indexFilePath = "docs/lexicon/lexicon.index.json",
  onLoadIndex,
}: LexiconBrowserProps) => {
  const [searchText, setSearchText] = useState("");
  const [filterOperatorClass, setFilterOperatorClass] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");

  const lexiconHook = useLexiconIndex(indexFilePath, {
    ...(onLoadIndex && { onLoadIndex }),
  });

  const operatorClasses = useMemo(() => {
    if (!lexiconHook.index) return [];
    return Array.from(
      new Set(lexiconHook.index.entries.map((e) => e.operator_class).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [lexiconHook.index]);

  const types = useMemo(() => {
    if (!lexiconHook.index) return [];
    return Array.from(
      new Set(lexiconHook.index.entries.map((e) => e.type).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));
  }, [lexiconHook.index]);

  const filtered = useMemo(() => {
    if (!lexiconHook.index) return [];

    const query = searchText.toLowerCase();

    return lexiconHook.index.entries.filter((entry: { term: string; canonical_term: string; process_tag: string; operator_class: string; type: string; }) => {
      const matchesText =
        query === "" ||
        entry.term.toLowerCase().includes(query) ||
        entry.canonical_term.toLowerCase().includes(query) ||
        entry.process_tag.toLowerCase().includes(query);

      const matchesOperator = !filterOperatorClass || entry.operator_class === filterOperatorClass;
      const matchesType = !filterType || entry.type === filterType;

      return matchesText && matchesOperator && matchesType;
    });
  }, [lexiconHook.index, searchText, filterOperatorClass, filterType]);

  return (
    <div className="lexicon-browser">
      <h2 className="lexicon-browser__title">Lexicon Browser</h2>

      {lexiconHook.loading && <p className="lexicon-browser__loading">Loading lexicon...</p>}
      {lexiconHook.error && <p className="lexicon-browser__error">Error: {lexiconHook.error?.toString()}</p>}

      {lexiconHook.index && (
        <div>
          {/* Stats */}
          <div className="lexicon-browser__stats">
            <strong>Total entries:</strong> {lexiconHook.index.entries.length} |{" "}
            <strong>Generated:</strong>{" "}
            {new Date(lexiconHook.index.generatedAt).toLocaleDateString()} |{" "}
            <strong>Showing:</strong> {filtered.length}
          </div>

          {/* Filters */}
          <div className="lexicon-browser__filters">
            <div className="lexicon-browser__filter-group">
              <label htmlFor="search-input" className="lexicon-browser__label">
                Search
              </label>
              <input
                id="search-input"
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="term, tag, or process_tag"
                className="lexicon-browser__input"
              />
            </div>
            <div className="lexicon-browser__filter-group">
              <label htmlFor="operator-class-select" className="lexicon-browser__label">
                Operator Class
              </label>
              <select
                id="operator-class-select"
                value={filterOperatorClass}
                onChange={(e) => setFilterOperatorClass(e.target.value)}
                className="lexicon-browser__select"
                aria-label="Filter by operator class"
              >
                <option value="">All classes</option>
                {operatorClasses.map((oc: string) => (
                  <option key={oc} value={oc}>
                    {oc}
                  </option>
                ))}
              </select>
            </div>
            <div className="lexicon-browser__filter-group">
              <label htmlFor="type-select" className="lexicon-browser__label">
                Type
              </label>
              <select
                id="type-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="lexicon-browser__select"
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                {types.map((t: string) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Table */}
          {filtered.length > 0 ? (
            <div className="lexicon-browser__table-container">
              <table className="lexicon-browser__table">
                <thead>
                  <tr className="lexicon-browser__table-header">
                    <th className="lexicon-browser__table-header-cell">Term</th>
                    <th className="lexicon-browser__table-header-cell">Process Tag</th>
                    <th className="lexicon-browser__table-header-cell">Type</th>
                    <th className="lexicon-browser__table-header-cell">Operator Class</th>
                    <th className="lexicon-browser__table-header-cell">File</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry: typeof filtered[number], idx: number) => (
                    <tr
                      key={`${entry.term}-${entry.process_tag}`}
                      className={`lexicon-browser__table-row ${
                        idx % 2 === 0
                          ? "lexicon-browser__table-row--even"
                          : "lexicon-browser__table-row--odd"
                      }`}
                    >
                      <td className="lexicon-browser__table-cell">
                        <strong>{entry.term}</strong>
                        <br />
                        <span className="lexicon-browser__term-canonical">
                          {entry.canonical_term}
                        </span>
                      </td>
                      <td className="lexicon-browser__table-cell lexicon-browser__process-tag">
                        <code className="lexicon-browser__process-tag-code">
                          {entry.process_tag}
                        </code>
                      </td>
                      <td className="lexicon-browser__table-cell">
                        <span className="lexicon-browser__type-badge">
                          {entry.type}
                        </span>
                      </td>
                      <td className="lexicon-browser__table-cell">
                        <span className="lexicon-browser__operator-class">
                          {entry.operator_class}
                        </span>
                      </td>
                      <td className="lexicon-browser__table-cell lexicon-browser__file">
                        {entry.file.split("/").at(-1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="lexicon-browser__no-results">No entries match your filters.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LexiconBrowser;
