/**
 * Graphics Routes Configuration
 *
 * Add these routes to your main router (e.g., vite-router, react-router-dom).
 *
 * Usage in your main app router:
 * ```tsx
 * import { graphicsRoutes } from "@/routes/graphics-routes";
 *
 * const router = createBrowserRouter([
 *   { path: "/dashboard", element: <Dashboard /> },
 *   ...graphicsRoutes,  // Add graphics routes
 * ]);
 * ```
 */
import React from "react";
import type { RouteObject } from "react-router-dom";
import { GraphicsMenu } from "../pages/GraphicsMenu";
import { LabGraphicsLabPage } from "../pages/LabGraphicsLabPage";
import { LabGraphicsGeneratorPage } from "../pages/LabGraphicsGeneratorPage";

type ExtendedRouteObject = RouteObject & {
  meta?: {
    title: string;
    description: string;
  };
};

export const graphicsRoutes: ExtendedRouteObject[] = [
  {
    path: "/graphics",
    element: <GraphicsMenu />,
    meta: {
      title: "Graphics Platform",
      description: "Central hub for graphics tools and utilities",
    },
  },
  {
    path: "/lab/graphics-lab",
    element: <LabGraphicsLabPage />,
    meta: {
      title: "Graphics Lab",
      description: "Unified workbench for heightfield, spin capture, and geometry queries",
    },
  },
  {
    path: "/lab/graphics-generator",
    element: <LabGraphicsGeneratorPage />,
    meta: {
      title: "Graphics Generator",
      description: "Real-time lattice animation with quaternion rotation and camera controls",
    }
  },
];

/**
 * Navigation links for sidebar/menu integration
 */
export const graphicsNavigation = [
  {
    label: "Graphics Platform",
    path: "/graphics",
    icon: "🎨",
    description: "Graphics tools hub",
  },
  {
    label: "Graphics Lab",
    path: "/lab/graphics-lab",
    icon: "🧰",
    description: "Workbench",
  },
  {
    label: "Graphics Generator",
    path: "/lab/graphics-generator",
    icon: "🌀",
    description: "Lattice animation",
  },
];
