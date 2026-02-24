export interface DevPipelineStep {
  id: string;
  name: string;
  purpose: string;
}

export interface DevVerifyBlock {
  id: "java" | "node-ts" | "python";
  label: string;
  commands: string[];
}

export const WINDOWS_DEV_PIPELINE_STEPS: DevPipelineStep[] = [
  {
    id: "01",
    name: "System Update & Developer Mode",
    purpose: "Prepare Windows for SDKs, debugging, and secure development features.",
  },
  {
    id: "02",
    name: "Terminal & Package Manager",
    purpose: "Use Windows Terminal + winget for repeatable, scriptable tool installs.",
  },
  {
    id: "03",
    name: "Version Control",
    purpose: "Install Git for branching, commit history, and team collaboration workflows.",
  },
  {
    id: "04",
    name: "Java Toolchain",
    purpose: "Install JDK, configure JAVA_HOME/PATH, and validate javac/java runtime availability.",
  },
  {
    id: "05",
    name: "Node.js + TypeScript",
    purpose: "Install Node LTS, initialize TS projects, and enable compile/watch/debug loops.",
  },
  {
    id: "06",
    name: "Python Environment",
    purpose: "Install Python, create virtual environments, and isolate sidecar dependencies safely.",
  },
  {
    id: "07",
    name: "Editor & IDE Integration",
    purpose: "Use VS Code extensions for Java, TS, and Python with linting + debugging support.",
  },
  {
    id: "08",
    name: "WSL2 (Optional)",
    purpose: "Add Linux-native tooling for bash/apt workflows while keeping Windows host workflow.",
  },
  {
    id: "09",
    name: "Verification Gate",
    purpose: "Run java/node/tsc/python version checks before entering pipeline build stages.",
  },
];

export const WINDOWS_DEV_VERIFY_COMMANDS = [
  "java -version",
  "javac -version",
  "node -v",
  "npm -v",
  "tsc --version",
  "python --version",
];

export const WINDOWS_DEV_VERIFY_BLOCKS: DevVerifyBlock[] = [
  {
    id: "java",
    label: "Java Verify",
    commands: ["java -version", "javac -version"],
  },
  {
    id: "node-ts",
    label: "Node/TS Verify",
    commands: ["node -v", "npm -v", "tsc --version"],
  },
  {
    id: "python",
    label: "Python Verify",
    commands: ["python --version"],
  },
];
