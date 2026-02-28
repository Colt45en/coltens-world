import {
    type GfxLedgerEventV1,
    type MaterialBindRequestV1,
    type SceneComposeRequestV1,
    type ViewportDefineRequestV1,
    type ViewportRenderRequestV1,
} from "../contracts/graphics-intent.v1";
import {
    materialBind,
    sceneCompose,
    viewportDefine,
    viewportRender,
} from "../graphics-intent/builders";
import { GraphicsIntentStore } from "../graphics-intent/store";

export type ToolResult<T> = {
  output: T;
  ledger_event: GfxLedgerEventV1;
};

export class GraphicsIntentToolkit {
  public readonly store: GraphicsIntentStore;

  constructor(store?: GraphicsIntentStore) {
    this.store = store ?? new GraphicsIntentStore();
  }

  scene_compose(req: SceneComposeRequestV1): ToolResult<any> {
    const { res, ledger } = sceneCompose(this.store, req);
    return { output: res, ledger_event: ledger };
  }

  material_bind(req: MaterialBindRequestV1): ToolResult<any> {
    const { res, ledger } = materialBind(this.store, req);
    return { output: res, ledger_event: ledger };
  }

  viewport_define(req: ViewportDefineRequestV1): ToolResult<any> {
    const { res, ledger } = viewportDefine(this.store, req);
    return { output: res, ledger_event: ledger };
  }

  viewport_render(req: ViewportRenderRequestV1): ToolResult<any> {
    const { res, ledger } = viewportRender(this.store, req);
    return { output: res, ledger_event: ledger };
  }
}
