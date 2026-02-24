import { Suspense, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { NeonNexusLayout } from "../layout/NeonNexusLayout";
import { getIframeApps } from "./AppRegistry";
import { ROUTES } from "./routes";

import { LauncherPage } from "../pages/LauncherPage";
import { NotFound } from "../pages/NotFound";

import { LabAvatarCompilerPage } from "../lab/LabAvatarCompilerPage";
import { LabBrainObserverPage } from "../lab/LabBrainObserverPage";
import { LabChatPage } from "../lab/LabChatPage";
import { LabGameEnginePage } from "../lab/LabGameEnginePage";
import LabGameStudioPage from "../lab/LabGameStudioPage";
import { LabGraphicsPipelinePage } from "../lab/LabGraphicsPipelinePage";
import { LabLauncherControlPage } from "../lab/LabLauncherControlPage";
import { LabLexiconPage } from "../lab/LabLexiconPage";
import { LabNucleusObserverPage } from "../lab/LabNucleusObserverPage";
import { LabPrefabEnginePage } from "../lab/LabPrefabEnginePage";
import { LabStudioPage } from "../lab/LabStudioPage";
import { Dashboard } from "../pages/Dashboard";
import { EcosystemDashboard } from "../pages/EcosystemDashboard";
import Lab3DMathPage from "../pages/Lab3DMathPage";
import { LabAgentChatPage } from "../pages/LabAgentChatPage";
import { LabComplexPlaygroundPage } from "../pages/LabComplexPlaygroundPage";
import { LabECSArchitecturePage } from "../pages/LabECSArchitecturePage";
import { LabGraphicsGeneratorPage } from "../pages/LabGraphicsGeneratorPage";
import LabHeartTimelinePage from "../pages/LabHeartTimelinePage";
import LabIconGeneratorPage from "../pages/LabIconGeneratorPage";
import { LabLeximorphPage } from "../pages/LabLeximorphPage";
import { LabMathDependencyGraphPage } from "../pages/LabMathDependencyGraphPage";
import { LabMathEnginePage } from "../pages/LabMathEnginePage";
import LabMathWorkspacePage from "../pages/LabMathWorkspacePage";
import LabMatrixPlaygroundPage from "../pages/LabMatrixPlaygroundPage";
import { LabMemoryAllocatorsPage } from "../pages/LabMemoryAllocatorsPage";
import LabPhysicsPage from "../pages/LabPhysicsPage";
import LabSvgRenderingPage from "../pages/LabSvgRenderingPage";
import { LabTerrainErosionPage } from "../pages/LabTerrainErosionPage";
import { LabWaveFunctionCollapsePage } from "../pages/LabWaveFunctionCollapsePage";
import { LabWorldEngineBlueprintPage } from "../pages/LabWorldEngineBlueprintPage";
import PipelineResultsPage from "../pages/PipelineResultsPage";
import { SystemSettings } from "../pages/SystemSettings";
import { EvidenceViewer } from "../panels/EvidenceViewer";
import { FlowStatePanel } from "../panels/FlowStatePanel";
import { NexusPipelinePanel } from "../panels/NexusPipelinePanel";
import { WorldGraphPanel } from "../panels/WorldGraphPanel";

import { IFrameAppPage } from "../iframe/IFrameAppPage";
import { LabVectorPhysicsPage } from "../lab/LabVectorPhysicsPage";
import AvatarEditorStage from "../pages/AvatarEditorStage";

function RouteFallback() {
  return (
    <div className="glass-panel rounded-2xl p-5 max-w-3xl mx-auto">
      <div className="font-bold tracking-wide">Loading…</div>
      <div className="text-white/60 text-sm mt-1">Spinning up module</div>
    </div>
  );
}

export function WorldRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  // infer active top nav from path
  const active = useMemo(() => {
    const p = location.pathname;
    if (p.startsWith(ROUTES.labRoot)) return "system";
    if (p.startsWith(ROUTES.apps.root)) return "data";
    if (p.startsWith(ROUTES.hub)) return "home";
    return "home";
  }, [location.pathname]);

  return (
    <NeonNexusLayout
      active={active as any}
      onNav={(key) => {
        if (key === "system") navigate(ROUTES.lab.studio);
        else if (key === "data") navigate(ROUTES.lab.dashboard);
        else if (key === "store") navigate(`${ROUTES.root}?home=1`);
        else if (key === "home") navigate(`${ROUTES.root}?home=1`);
        else navigate(`${ROUTES.root}?home=1`);
      }}
    >
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Core */}
          <Route path={ROUTES.root} element={<LauncherPage />} />
          <Route path={ROUTES.hub} element={<Navigate to={`${ROUTES.root}?home=1`} replace />} />

          {/* Lab (internal apps) */}
          <Route path={ROUTES.lab.studio} element={<LabStudioPage />} />
          <Route path={ROUTES.lab.launcherControl} element={<LabLauncherControlPage />} />
          <Route path={ROUTES.lab.nucleus} element={<LabNucleusObserverPage />} />
          <Route path={ROUTES.lab.brain} element={<LabBrainObserverPage />} />
          <Route path={ROUTES.lab.avatarCompiler} element={<LabAvatarCompilerPage />} />
          <Route path={ROUTES.lab.heartTimeline} element={<LabHeartTimelinePage />} />
          <Route path={ROUTES.lab.lexicon} element={<LabLexiconPage />} />
          <Route path={ROUTES.lab.leximorph} element={<LabLeximorphPage />} />
          <Route path={ROUTES.lab.chat} element={<LabChatPage />} />
          <Route path={ROUTES.lab.gameEngine} element={<LabGameEnginePage />} />
          <Route path={ROUTES.lab.gameStudio} element={<LabGameStudioPage />} />
          <Route path={ROUTES.lab.prefabEngine} element={<LabPrefabEnginePage />} />
          <Route path={ROUTES.lab.graphics} element={<LabGraphicsPipelinePage />} />
          <Route path={ROUTES.lab.terrainErosion} element={<LabTerrainErosionPage />} />
          <Route path={ROUTES.lab.wfc} element={<LabWaveFunctionCollapsePage />} />
          <Route path={ROUTES.lab.ecsArchitecture} element={<LabECSArchitecturePage />} />
          <Route path={ROUTES.lab.memoryAllocators} element={<LabMemoryAllocatorsPage />} />
          <Route path={ROUTES.lab.worldEngineBlueprint} element={<LabWorldEngineBlueprintPage />} />
          <Route path={ROUTES.lab.mathEngine} element={<LabMathEnginePage />} />
          <Route path={ROUTES.lab.mathWorkspace} element={<LabMathWorkspacePage />} />
          <Route path={ROUTES.lab.mathDependencyGraph} element={<LabMathDependencyGraphPage />} />
          <Route path={ROUTES.lab.complexPlayground} element={<LabComplexPlaygroundPage />} />        <Route path={ROUTES.lab.matrixPlayground} element={<LabMatrixPlaygroundPage />} />        <Route path={ROUTES.lab.svgRendering} element={<LabSvgRenderingPage />} />        <Route path={ROUTES.lab.math3D} element={<Lab3DMathPage />} />          <Route path={ROUTES.lab.physics} element={<LabPhysicsPage />} />          <Route path={ROUTES.lab.vectorPhysics} element={<LabVectorPhysicsPage />} />          <Route path={ROUTES.lab.iconGenerator} element={<LabIconGeneratorPage />} />          <Route path={ROUTES.lab.agentChat} element={<LabAgentChatPage />} />
          <Route path={ROUTES.lab.graphicsGenerator} element={<LabGraphicsGeneratorPage />} />
          <Route path={ROUTES.lab.avatarEditor} element={<AvatarEditorStage />} />
          <Route path={ROUTES.lab.nexus} element={<NexusPipelinePanel />} />
          <Route path={ROUTES.lab.flowstate} element={<FlowStatePanel />} />
          <Route path={ROUTES.lab.worldGraph} element={<WorldGraphPanel />} />
          <Route path={ROUTES.lab.evidence} element={<EvidenceViewer />} />
          <Route path={ROUTES.lab.dashboard} element={<Dashboard />} />
          <Route path={ROUTES.lab.ecosystem} element={<EcosystemDashboard />} />
          <Route path={ROUTES.lab.pipelineResults} element={<PipelineResultsPage />} />

          {/* Settings */}
          <Route path={ROUTES.settings} element={<SystemSettings />} />

          {/* Iframe apps (embedded launch) */}
          {getIframeApps().map((app) => (
            <Route key={app.id} path={ROUTES.apps.byId(app.id)} element={<IFrameAppPage />} />
          ))}

          {/* Parameterized iframe route */}
          <Route path={`${ROUTES.apps.root}/:id`} element={<IFrameAppPage />} />

          {/* If someone goes to an app id directly, redirect where appropriate */}
          <Route path={ROUTES.apps.root} element={<Navigate to={ROUTES.root} replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </NeonNexusLayout>
  );
}
