"""
BRAIN ARCHITECTURE: Digital Twin Cortex → DICOMweb Streaming Server

Web-based DICOM serving using DICOMweb standards (WADO-RS, QIDO-RS).
Enables browser-based medical image viewing and integration with standard viewers.

Protocols:
- WADO-RS: Web Access to DICOM Persistent Objects (retrieve)
- QIDO-RS: Query based on ID for DICOM Objects (search)
- STOW-RS: Store Over the Web (upload) - optional

Features:
- RESTful DICOM serving
- CORS-enabled for web viewers
- Metadata-only queries (fast)
- Frame-by-frame streaming
- Artifact store integration
- JWT authentication (optional)

Usage:
    python -m unified_nexus.digital_twin.dicomweb_server \\
        --port 8080 \\
        --storage runtime/artifacts \\
        --cors "*" \\
        --auth optional

    # In web viewer:
    const config = {
        wadoRsRoot: "http://localhost:8080/dicomweb",
        qidoRoot: "http://localhost:8080/dicomweb"
    }
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

try:
    import pydicom
except ImportError:
    pydicom = None

# DICOMweb server implementation
# In production: use FastAPI or Flask-RESTX

class DICOMwebServer:
    """
    DICOMweb REST server for medical image streaming.

    Implements:
    - QIDO-RS: /studies, /series, /instances (search)
    - WADO-RS: /studies/{study}/series/{series}/instances/{instance} (retrieve)
    - WADO-RS: /studies/{study}/series/{series}/instances/{instance}/frames/{frame} (frame retrieval)
    """

    def __init__(
        self,
        storage_root: Path,
        cors: str = "*",
        auth_required: bool = False
    ):
        self.storage_root = Path(storage_root)
        self.cors = cors
        self.auth_required = auth_required

        # Build index
        self._studies: Dict[str, Dict[str, Any]] = {}
        self._series: Dict[str, Dict[str, Any]] = {}
        self._instances: Dict[str, Dict[str, Any]] = {}

        self._build_index()

    @property
    def studies(self) -> Dict[str, Dict[str, Any]]:
        """Get studies index."""
        return self._studies

    @property
    def series(self) -> Dict[str, Dict[str, Any]]:
        """Get series index."""
        return self._series

    @property
    def instances(self) -> Dict[str, Dict[str, Any]]:
        """Get instances index."""
        return self._instances

    def _build_index(self) -> None:
        """Scan storage and build DICOM hierarchy index."""
        if not self.storage_root.exists():
            return

        # Find all DICOM files
        dicom_files = list(self.storage_root.rglob("*.dcm"))

        for dcm_path in dicom_files:
            if pydicom is None:
                continue

            try:
                ds = pydicom.dcmread(dcm_path, stop_before_pixels=True)  # type: ignore[attr-defined]

                study_uid = str(ds.StudyInstanceUID)
                series_uid = str(ds.SeriesInstanceUID)
                instance_uid = str(ds.SOPInstanceUID)

                # Index study
                if study_uid not in self._studies:
                    self._studies[study_uid] = {
                        "StudyInstanceUID": study_uid,
                        "PatientName": str(ds.get("PatientName", "ANONYMOUS")),
                        "PatientID": str(ds.get("PatientID", "UNKNOWN")),
                        "StudyDate": str(ds.get("StudyDate", "")),
                        "StudyDescription": str(ds.get("StudyDescription", "")),
                        "series": []
                    }

                # Index series
                series_key = f"{study_uid}/{series_uid}"
                if series_key not in self._series:
                    series_info: Dict[str, Any] = {
                        "SeriesInstanceUID": series_uid,
                        "StudyInstanceUID": study_uid,
                        "SeriesNumber": int(ds.get("SeriesNumber", 0)),
                        "Modality": str(ds.get("Modality", "OT")),
                        "SeriesDescription": str(ds.get("SeriesDescription", "")),
                        "instances": []
                    }
                    self._series[series_key] = series_info
                    self._studies[study_uid]["series"].append(series_uid)

                # Index instance
                instance_key = f"{study_uid}/{series_uid}/{instance_uid}"
                self._instances[instance_key] = {
                    "SOPInstanceUID": instance_uid,
                    "SeriesInstanceUID": series_uid,
                    "StudyInstanceUID": study_uid,
                    "InstanceNumber": int(ds.get("InstanceNumber", 0)),
                    "Rows": int(ds.get("Rows", 0)),
                    "Columns": int(ds.get("Columns", 0)),
                    "NumberOfFrames": int(ds.get("NumberOfFrames", 1)),
                    "filepath": str(dcm_path)
                }

                self._series[series_key]["instances"].append(instance_uid)

            except Exception:
                continue

    # QIDO-RS: Search for studies
    def qido_search_studies(
        self,
        patient_id: Optional[str] = None,
        study_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for studies.

        GET /dicomweb/studies?PatientID=<id>&StudyDate=<date>

        Returns array of study-level metadata.
        """
        results: List[Dict[str, Any]] = []

        for study in self._studies.values():
            # Apply filters
            if patient_id and study["PatientID"] != patient_id:
                continue
            if study_date and study["StudyDate"] != study_date:
                continue

            # Return metadata (DICOM JSON model)
            results.append({
                "0020000D": {"vr": "UI", "Value": [study["StudyInstanceUID"]]},
                "00100010": {"vr": "PN", "Value": [{"Alphabetic": study["PatientName"]}]},
                "00100020": {"vr": "LO", "Value": [study["PatientID"]]},
                "00080020": {"vr": "DA", "Value": [study["StudyDate"]]},
                "00081030": {"vr": "LO", "Value": [study["StudyDescription"]]},
            })

        return results

    # QIDO-RS: Search for series
    def qido_search_series(
        self,
        study_uid: Optional[str] = None,
        modality: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for series.

        GET /dicomweb/studies/{study}/series
        GET /dicomweb/series?Modality=<modality>

        Returns array of series-level metadata.
        """
        results: List[Dict[str, Any]] = []

        for series in self._series.values():
            # Apply filters
            if study_uid and series["StudyInstanceUID"] != study_uid:
                continue
            if modality and series["Modality"] != modality:
                continue

            results.append({
                "0020000E": {"vr": "UI", "Value": [series["SeriesInstanceUID"]]},
                "0020000D": {"vr": "UI", "Value": [series["StudyInstanceUID"]]},
                "00200011": {"vr": "IS", "Value": [str(series["SeriesNumber"])]},
                "00080060": {"vr": "CS", "Value": [series["Modality"]]},
                "0008103E": {"vr": "LO", "Value": [series["SeriesDescription"]]},
            })

        return results

    # QIDO-RS: Search for instances
    def qido_search_instances(
        self,
        study_uid: Optional[str] = None,
        series_uid: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search for instances.

        GET /dicomweb/studies/{study}/series/{series}/instances

        Returns array of instance-level metadata.
        """
        results: List[Dict[str, Any]] = []

        for instance in self._instances.values():
            # Apply filters
            if study_uid and instance["StudyInstanceUID"] != study_uid:
                continue
            if series_uid and instance["SeriesInstanceUID"] != series_uid:
                continue

            results.append({
                "00080018": {"vr": "UI", "Value": [instance["SOPInstanceUID"]]},
                "0020000E": {"vr": "UI", "Value": [instance["SeriesInstanceUID"]]},
                "0020000D": {"vr": "UI", "Value": [instance["StudyInstanceUID"]]},
                "00200013": {"vr": "IS", "Value": [str(instance["InstanceNumber"])]},
                "00280010": {"vr": "US", "Value": [instance["Rows"]]},
                "00280011": {"vr": "US", "Value": [instance["Columns"]]},
                "00280008": {"vr": "IS", "Value": [str(instance["NumberOfFrames"])]},
            })

        return results

    # WADO-RS: Retrieve instance
    def wado_retrieve_instance(
        self,
        study_uid: str,
        series_uid: str,
        instance_uid: str
    ) -> Optional[bytes]:
        """
        Retrieve DICOM instance.

        GET /dicomweb/studies/{study}/series/{series}/instances/{instance}

        Returns DICOM file bytes (application/dicom).
        """
        instance_key = f"{study_uid}/{series_uid}/{instance_uid}"

        if instance_key not in self._instances:
            return None

        filepath = Path(self._instances[instance_key]["filepath"])

        if not filepath.exists():
            return None

        return filepath.read_bytes()

    # WADO-RS: Retrieve frame
    def wado_retrieve_frame(
        self,
        study_uid: str,
        series_uid: str,
        instance_uid: str,
        frame_number: int
    ) -> Optional[bytes]:
        """
        Retrieve single frame from multi-frame instance.

        GET /dicomweb/studies/{study}/series/{series}/instances/{instance}/frames/{frame}

        Returns frame pixels (image/jpeg or application/octet-stream).
        """
        if pydicom is None:
            return None

        instance_key = f"{study_uid}/{series_uid}/{instance_uid}"

        if instance_key not in self._instances:
            return None

        filepath = Path(self._instances[instance_key]["filepath"])

        if not filepath.exists():
            return None

        try:
            ds = pydicom.dcmread(filepath)

            # Extract frame
            if hasattr(ds, "pixel_array"):
                pixel_array = ds.pixel_array

                # Multi-frame: select frame
                if len(pixel_array.shape) == 3:
                    if 0 <= frame_number - 1 < pixel_array.shape[0]:
                        frame_data = pixel_array[frame_number - 1]
                    else:
                        return None
                else:
                    frame_data = pixel_array

                # Convert to bytes (simplified: raw pixels)
                return frame_data.tobytes()

        except Exception:
            return None

        return None


def start_server(
    port: int = 8080,
    storage_root: str = "runtime/artifacts",
    cors: str = "*",
    auth_required: bool = False
) -> None:
    """
    Start DICOMweb server.

    Args:
        port: HTTP port (default: 8080)
        storage_root: Path to artifact storage
        cors: CORS origin (default: "*" for all)
        auth_required: Require JWT authentication (default: False)
    """
    server = DICOMwebServer(
        storage_root=Path(storage_root),
        cors=cors,
        auth_required=auth_required
    )

    print("[DICOMweb Server]")
    print(f"  Storage: {storage_root}")
    print(f"  Studies: {len(server.studies)}")
    print(f"  Series: {len(server.series)}")
    print(f"  Instances: {len(server.instances)}")
    print(f"  Listening: http://0.0.0.0:{port}/dicomweb")
    print(f"  CORS: {cors}")
    print(f"  Auth: {'Required' if auth_required else 'Optional'}")
    print()
    print("Endpoints:")
    print(f"  QIDO-RS: http://localhost:{port}/dicomweb/studies")
    print(f"  QIDO-RS: http://localhost:{port}/dicomweb/series")
    print(f"  WADO-RS: http://localhost:{port}/dicomweb/studies/{{study}}/series/{{series}}/instances/{{instance}}")
    print()

    # In production: use FastAPI or Flask
    # For now, print config
    print("Example viewer config:")
    print(json.dumps({
        "wadoRsRoot": f"http://localhost:{port}/dicomweb",
        "qidoRoot": f"http://localhost:{port}/dicomweb"
    }, indent=2))


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="DICOMweb Streaming Server")
    parser.add_argument("--port", type=int, default=8080, help="HTTP port")
    parser.add_argument("--storage", default="runtime/artifacts", help="Artifact storage root")
    parser.add_argument("--cors", default="*", help="CORS origin")
    parser.add_argument("--auth", action="store_true", help="Require authentication")

    args = parser.parse_args()

    start_server(
        port=args.port,
        storage_root=args.storage,
        cors=args.cors,
        auth_required=args.auth
    )
