"""
BRAIN ARCHITECTURE: Digital Twin Cortex Module

Complete runtime implementation of the Digital Twin BRAIN specialization:
- RETINA (Perception): DICOM ingest + normalization
- V-CORTEX (Recognition): Segmentation + label fusion
- CONNECTOME (Topology): Graph building + connectivity validation
- BRAINSTEM (Simulation): Hemodynamics + cardiac cycle
- MOTOR (Biomechanics): Kinesiology + ocular motion
- OCCIPITAL (Rendering): Deterministic 2D frame generation
- HIPPOCAMPUS (Memory): Artifact store + snapshots
- PREFRONTAL (Control): Workflow orchestration
- IMMUNE (Invariants): Health checks + validation

All components produce deterministic, hash-stable artifacts with full provenance.
"""

__all__ = [
    "ArtifactStore",
    "ArtifactRef",
    "build_tools",
    "DigitalTwinCognition",
    "InvariantsRegistry",
]
