import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getViewableApps, type ViewableWorldApp } from "../world/AppRegistry";
import { ROUTES } from "../world/routes";

type WorldAppLauncherButtonsProps = {
  title?: string;
  subtitle?: string;
  groups?: Array<ViewableWorldApp["group"]>;
  excludeIds?: string[];
  compact?: boolean;
  maxItems?: number;
};

function launchViewableApp(navigate: ReturnType<typeof useNavigate>, app: ViewableWorldApp) {
  if (app.kind === "route") {
    navigate(app.path);
    return;
  }
  navigate(ROUTES.apps.byId(app.id));
}

export function WorldAppLauncherButtons(props: WorldAppLauncherButtonsProps) {
  const navigate = useNavigate();
  const {
    title = "Viewable Applications",
    subtitle = "Router-powered launchers generated from WORLD_APPS registry.",
    groups,
    excludeIds = [],
    compact = false,
    maxItems,
  } = props;

  const apps = useMemo(() => {
    const excluded = new Set(excludeIds);
    let items = getViewableApps().filter((app) => !excluded.has(app.id));
    if (groups && groups.length > 0) {
      const allowed = new Set(groups);
      items = items.filter((app) => (app.group ? allowed.has(app.group) : false));
    }
    items = [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (typeof maxItems === "number" && maxItems > 0) {
      items = items.slice(0, maxItems);
    }
    return items;
  }, [excludeIds, groups, maxItems]);

  return (
    <section style={styles.section}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>{title}</div>
          <div style={styles.subtitle}>{subtitle}</div>
        </div>
        <div style={styles.countBadge}>{apps.length} apps</div>
      </div>

      <div
        style={{
          ...styles.grid,
          gridTemplateColumns: compact
            ? "repeat(auto-fit, minmax(140px, 1fr))"
            : "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        {apps.map((app) => (
          <button
            key={app.id}
            type="button"
            onClick={() => launchViewableApp(navigate, app)}
            style={compact ? styles.cardCompact : styles.card}
            title={app.description}
          >
            <div style={styles.icon}>{app.icon}</div>
            <div style={styles.name}>{app.name}</div>
            {!compact ? <div style={styles.description}>{app.description}</div> : null}
            <div style={styles.metaRow}>
              <span style={styles.metaPill}>{app.kind}</span>
              {app.group ? <span style={styles.metaPillMuted}>{app.group}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    background: "rgba(20, 30, 60, 0.45)",
    border: "1px solid rgba(100, 255, 218, 0.16)",
    borderRadius: 8,
    padding: 12,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 12,
    letterSpacing: 1,
    color: "#64ffda",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 11,
    color: "rgba(230,241,255,0.6)",
  },
  countBadge: {
    fontSize: 10,
    color: "rgba(230,241,255,0.75)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "4px 8px",
    whiteSpace: "nowrap",
  },
  grid: {
    display: "grid",
    gap: 10,
  },
  card: {
    textAlign: "left",
    background: "rgba(0,0,0,0.22)",
    border: "1px solid rgba(100, 255, 218, 0.12)",
    borderRadius: 8,
    padding: 10,
    color: "#e6f1ff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  cardCompact: {
    textAlign: "left",
    background: "rgba(0,0,0,0.2)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    padding: 10,
    color: "#e6f1ff",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minHeight: 88,
  },
  icon: {
    fontSize: 22,
    lineHeight: 1,
  },
  name: {
    fontSize: 12,
    fontWeight: 700,
    color: "#e6f1ff",
  },
  description: {
    fontSize: 10,
    color: "rgba(230,241,255,0.6)",
    lineHeight: 1.35,
    minHeight: 26,
  },
  metaRow: {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginTop: "auto",
  },
  metaPill: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#64ffda",
    border: "1px solid rgba(100,255,218,0.2)",
    background: "rgba(100,255,218,0.08)",
    borderRadius: 999,
    padding: "2px 6px",
  },
  metaPillMuted: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "rgba(230,241,255,0.65)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 999,
    padding: "2px 6px",
  },
};

export default WorldAppLauncherButtons;
