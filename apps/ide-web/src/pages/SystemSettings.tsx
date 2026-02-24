/**
 * SystemSettings - Global IDE configuration and preferences
 */

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel, NeonButton, NeonTitle } from "../ui/neon";
import { TabPanel, type Tab } from "../ui/TabPanel";
import {
  Settings,
  Palette,
  Zap,
  Bell,
  Shield,
  Database,
  Monitor,
  Save,
} from "lucide-react";
import { AdvancedMetricsCard } from "../ui/AdvancedMetricsCard";
import styles from "./SystemSettings.module.css";

interface SystemPreferences {
  theme: "dark" | "neon" | "light";
  performanceMode: boolean;
  showFx: boolean;
  autoSave: boolean;
  notifications: boolean;
  compactMode: boolean;
  analyticsEnabled: boolean;
  maxHistorySize: number;
}

const DEFAULT_PREFERENCES: SystemPreferences = {
  theme: "neon",
  performanceMode: false,
  showFx: true,
  autoSave: true,
  notifications: true,
  compactMode: false,
  analyticsEnabled: true,
  maxHistorySize: 100,
};

export function SystemSettings() {
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState<SystemPreferences>(() => {
    const stored = localStorage.getItem("world-engine.preferences");
    return stored ? { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) } : DEFAULT_PREFERENCES;
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem("world-engine.preferences", JSON.stringify(preferences));
  }, [preferences]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (confirm("Reset all settings to defaults?")) {
      setPreferences(DEFAULT_PREFERENCES);
      handleSave();
    }
  };

  const updatePreference = <K extends keyof SystemPreferences>(
    key: K,
    value: SystemPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const appearanceTab: Tab = {
    id: "appearance",
    label: "Appearance",
    icon: <Palette size={14} />,
    content: (
      <div className={styles.tabContent}>
        <h3 className={styles.heading3}>
          Visual Preferences
        </h3>

        <SettingRow label="Theme" description="Choose the UI color scheme">
          <select
            title="Theme selection"
            value={preferences.theme}
            onChange={(e) => updatePreference("theme", e.target.value as any)}
            className={styles.select}
          >
            <option value="neon">Neon (Default)</option>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </SettingRow>

        <SettingRow
          label="Visual Effects"
          description="Enable animated backgrounds and particles"
        >
          <ToggleSwitch
            checked={preferences.showFx}
            onChange={(checked) => updatePreference("showFx", checked)}
          />
        </SettingRow>

        <SettingRow
          label="Compact Mode"
          description="Reduce spacing and padding for more content"
        >
          <ToggleSwitch
            checked={preferences.compactMode}
            onChange={(checked) => updatePreference("compactMode", checked)}
          />
        </SettingRow>
      </div>
    ),
  };

  const performanceTab: Tab = {
    id: "performance",
    label: "Performance",
    icon: <Zap size={14} />,
    content: (
      <div className={styles.tabContent}>
        <h3 className={styles.heading3}>
          Performance Optimization
        </h3>

        <SettingRow
          label="Performance Mode"
          description="Disable heavy features for better speed"
        >
          <ToggleSwitch
            checked={preferences.performanceMode}
            onChange={(checked) => updatePreference("performanceMode", checked)}
          />
        </SettingRow>

        <SettingRow
          label="Max History Size"
          description="Maximum number of events/metrics to store"
        >
          <input
            type="number"
            title="Max History Size"
            placeholder="100"
            value={preferences.maxHistorySize}
            onChange={(e) => updatePreference("maxHistorySize", parseInt(e.target.value))}
            min={10}
            max={1000}
            className={styles.input}
          />
        </SettingRow>

        <div className={styles.tipsBox}>
          <h4 className={styles.tipsHeading}>
            Performance Tips
          </h4>
          <ul className={styles.tipsList}>
            <li>Enable Performance Mode for low-end devices</li>
            <li>Disable Visual Effects if experiencing lag</li>
            <li>Reduce Max History Size to save memory</li>
            <li>Close unused lab pages and panels</li>
          </ul>
        </div>
      </div>
    ),
  };

  const behaviorTab: Tab = {
    id: "behavior",
    label: "Behavior",
    icon: <Settings size={14} />,
    content: (
      <div className={styles.tabContent}>
        <h3 className={styles.heading3}>
          System Behavior
        </h3>

        <SettingRow label="Auto Save" description="Automatically save changes">
          <ToggleSwitch
            checked={preferences.autoSave}
            onChange={(checked) => updatePreference("autoSave", checked)}
          />
        </SettingRow>

        <SettingRow
          label="Notifications"
          description="Show system notifications and alerts"
        >
          <ToggleSwitch
            checked={preferences.notifications}
            onChange={(checked) => updatePreference("notifications", checked)}
          />
        </SettingRow>

        <SettingRow
          label="Analytics"
          description="Send anonymous usage data to improve the system"
        >
          <ToggleSwitch
            checked={preferences.analyticsEnabled}
            onChange={(checked) => updatePreference("analyticsEnabled", checked)}
          />
        </SettingRow>
      </div>
    ),
  };

  const aboutTab: Tab = {
    id: "about",
    label: "About",
    icon: <Monitor size={14} />,
    content: (
      <div className={styles.tabContent}>
        <h3 className={styles.heading3}>
          World Engine IDE
        </h3>

        <div className={styles.infoText}>
          <p><strong>Version:</strong> 3.0.0-alpha</p>
          <p><strong>Build:</strong> 2026.02.21</p>
          <p><strong>Runtime:</strong> React 18.2.0</p>
          <p><strong>Protocol:</strong> @world-engine/protocol v1.0</p>
        </div>

        <h4 className={styles.heading4}>
          System Components
        </h4>

        <div className={styles.componentGrid}>
          {[
            { name: "Nucleus", version: "1.0.0" },
            { name: "Brain", version: "1.0.0" },
            { name: "FlowState", version: "2.1.0" },
            { name: "Lexicon", version: "1.0.0" },
            { name: "Sidecar", version: "1.0.0" },
          ].map(comp => (
            <div
              key={comp.name}
              className={styles.componentCard}
            >
              <div className={styles.componentName}>
                {comp.name}
              </div>
              <div className={styles.componentVersion}>
                v{comp.version}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  };

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <GlassPanel className="rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <NeonTitle as="h2" className="text-2xl flex items-center gap-2">
              <Settings className="text-cyan-400" size={28} />
              System Settings
            </NeonTitle>
            <p className="text-white/60 mt-3">
              Configure your World Engine IDE preferences, performance options, and system behavior.
            </p>
          </div>
          <div className="flex gap-2">
            <NeonButton
              onClick={handleSave}
              className={styles.saveButton}
              title="Save settings"
            >
              <Save size={16} />
              {saved ? "Saved!" : "Save"}
            </NeonButton>
            <NeonButton variant="ghost" onClick={handleReset} title="Reset settings">
              Reset
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate("/")} title="Go back">
              Back
            </NeonButton>
          </div>
        </div>
      </GlassPanel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AdvancedMetricsCard
          label="Auto Save"
          value={preferences.autoSave ? "ON" : "OFF"}
          icon={<Database size={20} />}
          color={preferences.autoSave ? "#64c896" : "#ff6b6b"}
        />
        <AdvancedMetricsCard
          label="Visual FX"
          value={preferences.showFx ? "ENABLED" : "DISABLED"}
          icon={<Zap size={20} />}
          color={preferences.showFx ? "#64ffda" : "#666"}
        />
        <AdvancedMetricsCard
          label="Performance"
          value={preferences.performanceMode ? "HIGH" : "NORMAL"}
          icon={<Shield size={20} />}
          color={preferences.performanceMode ? "#ffa500" : "#6495ed"}
        />
      </div>

      <GlassPanel className="rounded-2xl" style={{}}>
        <TabPanel
          tabs={[appearanceTab, performanceTab, behaviorTab, aboutTab]}
          defaultTab="appearance"
        />
      </GlassPanel>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className={styles.settingRow}>
      <div className={styles.settingLabel}>
        <div className={styles.settingLabelText}>
          {label}
        </div>
        <div className={styles.settingDescription}>
          {description}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSwitch({ checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      title={checked ? "Toggle off" : "Toggle on"}
      onClick={() => onChange(!checked)}
      className={`${styles.toggleButton} ${checked ? styles.checked : ""}`}
    >
      <div
        className={`${styles.toggleDot} ${checked ? styles.checked : styles.unchecked}`}
      />
    </button>
  );
}

