# Digital Twin Cortex

**Complete runtime implementation of the Digital Twin BRAIN specialization for medical imaging reconstruction.**

## Architecture

The Digital Twin Cortex implements all 7 BRAIN layers:

| Layer | Module | Purpose |
|-------|--------|---------|
| 🔵 **RETINA** | `tools.py::ingest` | DICOM ingestion + quality validation |
| 🟢 **V-CORTEX** | `tools.py::segment` | Multi-organ segmentation with confidence |
| 🟡 **CONNECTOME** | `tools.py::build_connectome` | Vascular graph topology |
| 🔴 **BRAINSTEM** | `tools.py::simulate` | Hemodynamic simulation (cardiac cycle) |
| 🟣 **OCCIPITAL** | `tools.py::render2d` | Deterministic 2D rendering (hash-chained) |
| 🧠 **HIPPOCAMPUS** | `artifacts.py` | Immutable artifact storage (memory) |
| 🎯 **PREFRONTAL** | `cognition.py` | Workflow orchestration (control) |
| 🛡️ **IMMUNE** | `invariants.py` | Health checks + validation |

## Quick Start

### 0. Install Dependencies

```bash
# Core dependencies (required)
pip install pydicom numpy pillow

# Optional dependencies for compressed DICOM + NIfTI export
pip install pylibjpeg pylibjpeg-libjpeg pylibjpeg-openjpeg nibabel
```

### 1. Start the Brain

```bash
cd unified_nexus/digital_twin
python -m unified_nexus.digital_twin.brain_boot
```

This launches:
- EventBus (split-channel messaging)
- Nucleus (orchestration + deterministic sequencing)
- ToolRuntime (serial tool execution)
- DigitalTwinCognition (workflow orchestrator)
- InvariantsRegistry (health checks)

### 2. Trigger Reconstruction

Send a `dt.case.reconstruct` command via the EventBus:

```python
import asyncio
from unified_nexus.contracts_v1_schema import make_v1_command
from unified_nexus.event_bus import EventBus

async def trigger_reconstruction():
    bus = EventBus()
    
    cmd = make_v1_command(
        command_type="dt.case.reconstruct",
        ts_ms=1234567890,
        trace_id="trace_case_001",
        payload={
            "case_id": "case_001",
            "dicom_dir": "/path/to/dicom_series/",
            "modality": "CT",
            "quality_threshold": 0.8
        }
    )
    
    result = await bus.send_command(cmd)
    print(f"Reconstruction started: {result}")

asyncio.run(trigger_reconstruction())
```

### 3. Inspect DICOM Data (Optional)

Before running reconstruction, inspect your DICOM series:

```bash
# Inspect DICOM folder: shows series, modality, geometry
python -m unified_nexus.digital_twin.dicom_toolkit inspect /path/to/dicom_folder

# Convert to PNG slices (for visualization)
python -m unified_nexus.digital_twin.dicom_toolkit to-png /path/to/dicom_folder --out output_png --window 40 400

# Convert to NIfTI volume (for further processing)
python -m unified_nexus.digital_twin.dicom_toolkit to-nifti /path/to/dicom_folder --out volume.nii.gz

# Anonymize DICOM (remove PHI)
python -m unified_nexus.digital_twin.dicom_toolkit anonymize /path/to/dicom_folder --out anon_folder
```

### 4. Monitor Progress

The system emits progress events:

- `dt.case.ingested`: DICOM loaded, volume normalized
- `dt.segmentation.completed`: Organs segmented
- `dt.connectome.completed`: Vascular graph built
- `dt.simulation.completed`: Hemodynamics simulated
- `dt.render.frame`: Each frame rendered (hash-chained)
- `dt.case.export_ready`: Final bundle created
- `dt.health.passed/warning/failed`: Invariant checks

Subscribe to these events to track pipeline progress:

```python
async def on_progress(evt):
    print(f"[{evt.event_type}] {evt.payload}")

bus.subscribe_event("dt.case.*", on_progress)
bus.subscribe_event("dt.health.*", on_progress)
```

## Pipeline Stages

### Stage 1: Ingest (RETINA)
```
Input: DICOM directory (CT/MRI series)
Process:
  - Finds all DICOM files (.dcm, .dicom, .ima, or no extension)
  - Groups by SeriesInstanceUID
  - Selects largest series
  - Extracts geometry: ImagePositionPatient, PixelSpacing, ImageOrientationPatient
  - Sorts slices by z-coordinate (ImagePositionPatient[2])
  - Computes deterministic hash from file contents
Output: case.volume artifact with:
  - geometry: {spacing_mm, origin, direction, dims, modality, series_uid}
  - quality: {completeness, spacing_consistent, geometry_valid, confidence}
  - truth_labels: MEASURED (if geometry extracted) or INFERRED (fallback)
Validation: 
  - Confidence >= quality_threshold (default 0.8)
  - Completeness: >= 10 slices preferred
  - Geometry valid: ImagePositionPatient + PixelSpacing + ImageOrientationPatient present
```

**Real DICOM geometry extraction:**
- **Spacing**: From PixelSpacing (row, col) + SliceThickness or computed from consecutive ImagePositionPatient
- **Origin**: From first slice's ImagePositionPatient (x, y, z in mm)
- **Direction**: From ImageOrientationPatient (row/col vectors) → slice direction via cross product
- **Dims**: [Rows, Columns, NumSlices]

**Deterministic hash:**
```
SHA-256(canonical_json({
  "entries": sorted_relative_paths,
  "file_hashes": per_file_sha256_list
}))
```

### Stage 2: Segment (V-CORTEX)
```
Input: case.volume
Output: labels.anatomy (label_map + confidence scores)
Truth Labels: 🔵 MEASURED (from imaging contrast)
```

### Stage 3: Build Connectome (CONNECTOME)
```
Input: labels.anatomy
Output: vascular.graph (nodes + edges + topology)
Validation: Graph connectivity (1 component expected)
```

### Stage 4: Simulate (BRAINSTEM)
```
Input: vascular.graph
Output: sim.timeline (pressure/flow/radius over cardiac cycle)
Truth Labels: 🟠 INFERRED (hemodynamic solver estimates)
```

### Stage 5: Render (OCCIPITAL)
```
Input: vascular.graph + sim.timeline
Output: render.frame.svg (hash-chained per frame)
Features: Orthographic projection, overlays, deterministic SVG
```

### Stage 6: Export
```
Input: All artifacts for case_id
Output: bundle.<hash>.zip (deterministic bundle)
Location: runtime/artifacts/<case_id>/bundle/
```

## File Structure

```
unified_nexus/digital_twin/
├── __init__.py              # Module exports
├── artifacts.py             # HIPPOCAMPUS: deterministic storage
├── tools.py                 # All tool implementations (6 tools) + DICOM integration
├── cognition.py             # PREFRONTAL: workflow orchestrator
├── invariants.py            # IMMUNE: health checks
├── brain_boot.py            # Bootstrap + main entry point
├── dicom_toolkit.py         # DICOM utilities (inspect/convert/anonymize)
└── README.md               # This file

Output structure:
runtime/artifacts/
└── <case_id>/
    ├── case.volume/
    │   └── sha256:<hash>.json
    ├── labels.anatomy/
    │   └── sha256:<hash>.json
    ├── vascular.graph/
    │   └── sha256:<hash>.json
    ├── sim.timeline/
    │   └── sha256:<hash>.json
    ├── render.frame.svg/
    │   ├── sha256:<hash_0>.svg
    │   ├── sha256:<hash_1>.svg
    │   └── ...
    ├── render.frame.meta/
    │   └── sha256:<hash>.json
    └── bundle/
        └── sha256:<hash>.zip
```

## DICOM Integration

### Supported Modalities
- **CT (Computed Tomography)**: Full support with Hounsfield unit conversion
- **MRI (Magnetic Resonance)**: Geometry extraction, no HU conversion
- **Ultrasound, X-ray, PET**: Basic geometry extraction

### DICOM Hierarchy
```
Patient
└── Study (one visit/exam)
    └── Series (one acquisition protocol)
        └── Instance (one slice/file)
```

The ingest tool automatically:
1. Finds all DICOM files in directory (recursively)
2. Groups by `SeriesInstanceUID`  
3. Selects largest series (most slices)
4. Sorts slices by `ImagePositionPatient[2]` (z-coordinate)
5. Extracts geometry from DICOM tags

### Required DICOM Tags
For full geometry extraction:
- `ImagePositionPatient (0020,0032)`: Origin (x, y, z)
- `PixelSpacing (0028,0030)`: Row/column spacing
- `ImageOrientationPatient (0020,0037)`: Direction cosines
- `Rows (0028,0010)`, `Columns (0028,0011)`: Dimensions
- `SliceThickness (0018,0050)` or computed from consecutive slices

### Fallback Behavior
If DICOM toolkit unavailable or read fails:
- Uses generic 1mm isotropic spacing
- Identity direction matrix
- Confidence < 0.8 (triggers warning)
- Truth labels: INFERRED instead of MEASURED

### Privacy & PHI
**⚠️ IMPORTANT**: DICOM files contain Protected Health Information (PHI).

Use the anonymization tool before sharing:
```bash
python -m unified_nexus.digital_twin.dicom_toolkit anonymize /path/to/dicom --out anon_dicom
```

This removes:
- Patient name, ID, birthdate
- Institution, physician names
- Study/series dates
- Private tags (major PHI source)
- Generates new UIDs

**Note**: Does NOT remove burned-in pixel text (requires image-based redaction).

## Determinism Guarantees

### Artifact Storage (HIPPOCAMPUS)
- **Canonical JSON**: `sort_keys=True, separators=(",", ":")`
- **SHA-256 hashing**: `sha256:<hex>`
- **Immutability**: Same content → same hash → same path
- **Deduplication**: Automatic (hash-based storage)

### Tool Execution
- **Deterministic RNG**: Seeded from input hashes
- **Hash-chained frames**: `prev_hash` passed to next render call
- **Serial execution**: ToolRuntime uses PriorityQueue by `evt.seq`
- **Full provenance**: Every artifact includes source hashes

### Event Ordering
- **Nucleus lock**: `_emit_lock` serializes seq allocation
- **Event log**: Hash-chained NDJSON append log
- **SQLite mirror**: All events stored with seq/event_id
- **Tool correlation**: `call_id` → Future → result

## Truth Label System

Every artifact includes truth labels indicating data provenance:

| Label | Symbol | Meaning | Example |
|-------|--------|---------|---------|
| **MEASURED** | 🔵 | Directly from imaging | Vessel centerlines, organ boundaries |
| **INFERRED** | 🟠 | Model estimates | Flow rates, pressure distribution |
| **SYNTHESIZED** | 🟣 | Template-based | Capillary density, neural routing |

Truth labels are enforced at artifact creation time and validated by the IMMUNE system.

## Health Checks (IMMUNE)

The InvariantsRegistry validates all tool outputs:

### Connectivity Invariants
- Graph must have 1 connected component
- All edges must reference valid nodes
- Node/edge counts must match expectations

### Simulation Invariants
- No NaN/Inf values in state arrays
- Pressure within physiological bounds (0-200 mmHg)
- Flow conservation at bifurcations

### Render Invariants
- Frame hash must be present (sha256:...)
- Frame metadata must include time_ms, frame_id
- Hash chain integrity (prev_hash → frame_hash)

### Artifact Invariants
- All artifacts must have provenance metadata
- Truth labels required (MEASURED/INFERRED/SYNTHESIZED)
- Confidence scores >= thresholds

Health events emitted:
- `dt.health.passed`: All checks passed
- `dt.health.warning`: Non-critical violation (logged, continues)
- `dt.health.failed`: Critical violation (blocks progression)

## Integration with World Engine

### EventBus Integration
- All tools registered with ToolRuntime
- Commands routed via `nucleus.tool_call` events
- Results returned via `nucleus.tool_result` commands
- Cognition waits for `dt.tool.result` events by `call_id`

### Nucleus Integration
- Deterministic event sequencing (`_emit_lock`)
- Tool call correlation (`_pending_tool_results`)
- Backpressure management (watermarks)
- Event log + SQLite mirror

### Memory Integration
- DeterministicEventLog: hash-chained NDJSON
- SQLiteImprintStore: event mirror (seq, event_id, payload)
- ArtifactStore: immutable content-addressed storage

## Performance Targets

- **Ingest**: < 2s for typical CT series (500 slices)
- **Segment**: < 5s for multi-organ (deterministic RNG)
- **Connectome**: < 3s for vascular graph (1000 nodes)
- **Simulate**: < 10s for cardiac cycle (60 frames @ 60 Hz)
- **Render**: < 0.5s per frame (SVG generation)
- **Export**: < 1s for bundle creation

Total pipeline: **< 30s** for complete reconstruction

## Testing

### Unit Tests
```bash
# Test individual tools
pytest unified_nexus/digital_twin/test_tools.py -v

# Test artifact storage
pytest unified_nexus/digital_twin/test_artifacts.py -v

# Test cognition workflow
pytest unified_nexus/digital_twin/test_cognition.py -v
```

### Integration Tests
```bash
# Test complete pipeline
pytest unified_nexus/digital_twin/test_integration.py -v
```

### Determinism Verification
```bash
# Run pipeline twice, verify identical hashes
python scripts/verify_determinism.py case_001
```

### Automated Pipeline Testing

The **test_runner.py** module provides automated E2E pipeline testing with progress monitoring:

```bash
# Run complete reconstruction test
python -m unified_nexus.digital_twin.test_runner \
    /path/to/dicom \
    case_001 \
    --quality-threshold 0.8 \
    --timeout 300 \
    --export-png \
    --export-nifti volume.nii.gz
```

**Features**:
- Monitors all pipeline stages (ingest, segment, connectome, simulate, export)
- Tracks health warnings and errors
- Configurable timeout (default: 300s)
- Optional PNG/NIfTI exports
- Returns 0 if test passed, 1 if failed

**Progress Tracking**:
- `dt.case.ingested` → Ingest complete
- `dt.segmentation.completed` → Segmentation complete
- `dt.connectome.completed` → Graph topology complete
- `dt.simulation.completed` → Hemodynamics complete
- `dt.case.export_ready` → Bundle ready

## Advanced Features

### 3D Mesh Export

The **mesh_export.py** module generates 3D surface meshes from segmented anatomy using marching cubes:

```python
from unified_nexus.digital_twin.mesh_export import export_mesh

# Export heart mesh as OBJ
result = await export_mesh({
    "case_id": "case_001",
    "labels_ref": labels_artifact,
    "target_organ": "heart",
    "format": "obj",
    "smooth": True,
    "decimate_factor": 0.8
})

# result = {
#     "mesh_files": [{"organ": "heart", "path": "runtime/meshes/case_001/heart.obj", ...}],
#     "total_vertices": 15234,
#     "total_triangles": 30468
# }
```

**Supported Formats**:
- **OBJ**: Wavefront (general 3D software)
- **STL**: Binary STL (3D printing, medical planning)
- **PLY**: Stanford format (research, point cloud)

**Options**:
- `target_organ`: Specific organ or "all" for all organs
- `smooth`: Apply Laplacian smoothing (reduces jagged edges)
- `decimate_factor`: Reduce triangle count (0.5 = 50% triangles)

**Use Cases**:
- 3D printing for surgical planning
- VR/AR visualization
- Biomechanical simulation meshes
- Patient-specific implant design

### DICOMweb Streaming Server

The **dicomweb_server.py** module implements standard DICOMweb protocols for web-based medical image viewing:

```bash
# Start DICOMweb server
python -m unified_nexus.digital_twin.dicomweb_server \
    --port 8080 \
    --storage runtime/artifacts \
    --cors "*"
```

**Protocols Supported**:
- **QIDO-RS**: Query for studies/series/instances
- **WADO-RS**: Retrieve DICOM instances and frames
- **STOW-RS**: Upload (optional, future)

**Endpoints**:
```http
# Search for studies
GET /dicomweb/studies?PatientID=12345

# Search for series in study
GET /dicomweb/studies/{study}/series

# Retrieve instance
GET /dicomweb/studies/{study}/series/{series}/instances/{instance}

# Retrieve single frame
GET /dicomweb/studies/{study}/series/{series}/instances/{instance}/frames/{frame}
```

**Web Viewer Integration**:
```javascript
// OHIF Viewer, Cornerstone.js, etc.
const config = {
    wadoRsRoot: "http://localhost:8080/dicomweb",
    qidoRoot: "http://localhost:8080/dicomweb"
}
```

**Features**:
- CORS-enabled for browser access
- Metadata-only queries (fast, no pixel data)
- Frame-by-frame streaming (reduces bandwidth)
- Integrates with Digital Twin artifact store
- Standards-compliant (DICOMweb spec)

**Authentication** (optional):
```bash
# Require JWT tokens
python -m unified_nexus.digital_twin.dicomweb_server --auth
```

## Troubleshooting

### Issue: Queue overflow
**Symptom**: `Tool queue overflow: 1000/1000`  
**Fix**: Increase `max_queue` in ToolRuntime initialization or add backpressure

### Issue: Graph disconnected
**Symptom**: `dt.health.warning: graph_connectivity, components=3`  
**Fix**: Check segmentation quality, adjust connectivity threshold in build_connectome

### Issue: Render frames out of order
**Symptom**: Hash chain broken  
**Fix**: Verify ToolRuntime uses PriorityQueue by `evt.seq`, not plain Queue

### Issue: Tool timeout
**Symptom**: `asyncio.TimeoutError` in call_tool()  
**Fix**: Increase `tool_timeout_s` in NucleusConfig (default: 30s)

## Development

See [AGENTS.md](../../AGENTS.md) for comprehensive development guide covering:
- Adding new tools
- Modifying cognition workflows
- Testing strategies
- PR guidelines

## References

- **Specification**: [docs/PHYSIOLOGY_SIMULATION.md](../../docs/PHYSIOLOGY_SIMULATION.md)
- **Architecture**: [docs/BRAIN_CHAT_ARCHITECTURE.md](../../docs/BRAIN_CHAT_ARCHITECTURE.md)
- **Dev Guide**: [AGENTS.md](../../AGENTS.md)
- **Tool Runtime**: [unified_nexus/tool_runtime.py](../tool_runtime.py)
- **Nucleus**: [unified_nexus/nucleus/nucleus.py](../nucleus/nucleus.py)

---

**Status**: ✅ Implementation Complete  
**Version**: 1.0.0  
**Last Updated**: 2024  
**License**: Proprietary (World Engine)
