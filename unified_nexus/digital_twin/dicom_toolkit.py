#!/usr/bin/env python3
"""
DICOM Toolkit — inspect, convert, anonymize.

Features:
- Inspect DICOM headers + pixel stats
- Convert a Series (folder) -> PNG slices (windowed) OR NIfTI volume
- Anonymize DICOMs (remove PHI tags + private tags) into a new folder

Usage examples:
  python dicom_toolkit.py inspect /path/to/dicom_folder
  python dicom_toolkit.py to-png  /path/to/dicom_folder --out out_png --window 40 400
  python dicom_toolkit.py to-nifti /path/to/dicom_folder --out out_vol.nii.gz
  python dicom_toolkit.py anonymize /path/to/dicom_folder --out anon_folder

Notes:
- For best 3D reconstruction, DICOM slices must be from a single Series.
- Sorting is done using ImagePositionPatient (preferred) then InstanceNumber.
"""

from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

try:
    from pydicom.dataset import Dataset, FileMetaDataset
    from pydicom.uid import generate_uid
    from pydicom import dcmread  # type: ignore[attr-defined]
except ImportError as e:
    raise SystemExit("Missing dependency: pydicom. Install with: pip install pydicom") from e

try:
    from PIL import Image
except ImportError as e:
    raise SystemExit("Missing dependency: pillow. Install with: pip install pillow") from e

try:
    import nibabel as nib
    from nibabel.nifti1 import Nifti1Image
    from nibabel.loadsave import save as nib_save  # type: ignore[no-redef]
except ImportError:
    nib = None  # NIfTI export optional
    Nifti1Image = None
    nib_save = None


DICOM_EXTS = {".dcm", ".dicom", ".ima", ""}  # many DICOMs have no extension


@dataclass(frozen=True)
class SliceInfo:
    path: str
    ds: Dataset
    z: float
    instance_number: int


def _is_probably_dicom(path: str) -> bool:
    # Fast test: check extension and/or file header magic.
    ext = os.path.splitext(path)[1].lower()
    if ext not in DICOM_EXTS:
        return False

    try:
        with open(path, "rb") as f:
            pre = f.read(132)
        # classic Part 10 DICOM has "DICM" at byte 128
        return len(pre) >= 132 and pre[128:132] == b"DICM"
    except Exception:
        return False


def find_dicom_files(root: str) -> List[str]:
    files: List[str] = []
    for dirpath, _, filenames in os.walk(root):
        for fn in filenames:
            p = os.path.join(dirpath, fn)
            if _is_probably_dicom(p):
                files.append(p)
    # Some valid DICOMs won't have DICM marker; fallback attempt read if none found
    if not files:
        for dirpath, _, filenames in os.walk(root):
            for fn in filenames:
                p = os.path.join(dirpath, fn)
                ext = os.path.splitext(p)[1].lower()
                if ext in DICOM_EXTS:
                    files.append(p)
    return sorted(set(files))


def safe_read(path: str, *, stop_before_pixels: bool = False) -> Optional[Dataset]:
    try:
        return dcmread(path, stop_before_pixels=stop_before_pixels, force=True)
    except Exception:
        return None


def get_series_groups(paths: List[str]) -> Dict[str, List[str]]:
    groups: Dict[str, List[str]] = {}
    for p in paths:
        ds = safe_read(p, stop_before_pixels=True)
        if ds is None:
            continue
        sid = str(getattr(ds, "SeriesInstanceUID", "NO_SERIES_UID"))
        groups.setdefault(sid, []).append(p)
    # stable ordering
    for sid in list(groups.keys()):
        groups[sid] = sorted(groups[sid])
    return groups


def choose_largest_series(groups: Dict[str, List[str]]) -> Tuple[str, List[str]]:
    if not groups:
        raise SystemExit("No readable DICOM series found.")
    best = max(groups.items(), key=lambda kv: len(kv[1]))
    return best[0], best[1]


def _float3(v: Tuple[float, float, float] | List[float]) -> Tuple[float, float, float]:
    return (float(v[0]), float(v[1]), float(v[2]))


def load_series(paths: List[str]) -> List[SliceInfo]:
    slices: List[SliceInfo] = []
    for p in paths:
        ds = safe_read(p, stop_before_pixels=False)
        if ds is None:
            continue

        ipp = getattr(ds, "ImagePositionPatient", None)
        inst = int(getattr(ds, "InstanceNumber", 0) or 0)

        z = 0.0
        if ipp is not None and len(ipp) >= 3:
            z = float(ipp[2])

        slices.append(SliceInfo(path=p, ds=ds, z=z, instance_number=inst))

    if not slices:
        raise SystemExit("Series had no readable slices with pixel data.")

    # Prefer sorting by ImagePositionPatient.z; if all z are equal/missing, fallback to InstanceNumber.
    zs = [s.z for s in slices]
    if np.std(zs) > 1e-6:
        slices.sort(key=lambda s: s.z)
    else:
        slices.sort(key=lambda s: s.instance_number)

    return slices


def dicom_to_hu(ds: Dataset, arr: np.ndarray) -> np.ndarray:
    # For CT: HU = slope * pixel + intercept
    slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
    intercept = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
    out = arr.astype(np.float32) * slope + intercept
    return out


def apply_window(img: np.ndarray, center: float, width: float) -> np.ndarray:
    # Windowing to uint8 [0..255]
    lo = center - width / 2.0
    hi = center + width / 2.0
    x = np.clip(img, lo, hi)
    x = (x - lo) / max(hi - lo, 1e-6)
    x = (x * 255.0).astype(np.uint8)
    return x


def infer_window(ds: Dataset) -> Tuple[float, float]:
    wc = getattr(ds, "WindowCenter", None)
    ww = getattr(ds, "WindowWidth", None)

    # DICOM can store these as MultiValue
    def _first(v: Optional[float | list[float] | tuple[float, ...]], default: float) -> float:
        if v is None:
            return default
        if isinstance(v, (list, tuple)):
            return float(v[0])
        try:
            return float(v)
        except Exception:
            return default

    # If missing, fallback to a reasonable generic window
    return _first(wc, 40.0), _first(ww, 400.0)


def inspect_folder(root: str) -> None:
    paths = find_dicom_files(root)
    if not paths:
        raise SystemExit("No DICOM-like files found.")

    groups = get_series_groups(paths)
    print(f"Found {len(paths)} candidate files.")
    print(f"Found {len(groups)} series.\n")

    # Summarize series
    rows: List[Tuple[int, str, str, str, str]] = []
    for sid, ps in sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True):
        ds = safe_read(ps[0], stop_before_pixels=True)
        mod = str(getattr(ds, "Modality", ""))
        desc = str(getattr(ds, "SeriesDescription", ""))
        study = str(getattr(ds, "StudyDescription", ""))
        rows.append((len(ps), sid, mod, desc, study))

    print("Top series (count, modality, series desc, study desc):")
    for count, sid, mod, desc, study in rows[:10]:
        print(f"  {count:4d}  {mod:6s}  {desc[:50]:50s}  {study[:50]:50s}  {sid}")

    # Inspect the largest series pixels
    sid, series_paths = choose_largest_series(groups)
    slices = load_series(series_paths)
    ds0 = slices[0].ds

    print("\nLargest series details:")
    print(f"  SeriesInstanceUID: {sid}")
    print(f"  Slices: {len(slices)}")
    print(f"  Modality: {getattr(ds0, 'Modality', '')}")
    print(f"  Rows x Cols: {getattr(ds0, 'Rows', '?')} x {getattr(ds0, 'Columns', '?')}")
    print(f"  PixelSpacing: {getattr(ds0, 'PixelSpacing', '')}")
    print(f"  SliceThickness: {getattr(ds0, 'SliceThickness', '')}")
    print(f"  SpacingBetweenSlices: {getattr(ds0, 'SpacingBetweenSlices', '')}")
    print(f"  TransferSyntaxUID: {ds0.file_meta.TransferSyntaxUID if hasattr(ds0, 'file_meta') else ''}")

    # Pixel stats from a slice
    arr = ds0.pixel_array
    arr = dicom_to_hu(ds0, arr)
    wc, ww = infer_window(ds0)
    print(f"  WindowCenter/Width (inferred): {wc} / {ww}")
    print(f"  Pixel stats (HU if CT): min={float(arr.min()):.2f} max={float(arr.max()):.2f} mean={float(arr.mean()):.2f}")


def export_png(root: str, out_dir: str, window: Optional[Tuple[float, float]]) -> None:
    os.makedirs(out_dir, exist_ok=True)

    paths = find_dicom_files(root)
    groups = get_series_groups(paths)
    sid, series_paths = choose_largest_series(groups)
    slices = load_series(series_paths)

    ds0 = slices[0].ds
    if window is None:
        wc, ww = infer_window(ds0)
    else:
        wc, ww = window

    print(f"Exporting PNGs from series {sid} ({len(slices)} slices) -> {out_dir}")
    print(f"Using window center/width: {wc} / {ww}")

    for i, s in enumerate(slices):
        arr = s.ds.pixel_array
        arr = dicom_to_hu(s.ds, arr)
        img8 = apply_window(arr, wc, ww)
        im = Image.fromarray(img8)
        fn = os.path.join(out_dir, f"slice_{i:04d}.png")
        im.save(fn)

    print("Done.")


def build_affine(ds0: Dataset, ds1: Optional[Dataset]) -> np.ndarray:
    """
    Build a NIfTI-style affine using DICOM geometry if present.
    affine maps voxel indices (i,j,k) to patient/world coordinates (x,y,z) in mm.

    Uses:
    - ImagePositionPatient (origin)
    - ImageOrientationPatient (row/col directions)
    - PixelSpacing (row/col)
    - slice spacing inferred from ds1 if possible, else SliceThickness/SpacingBetweenSlices
    """
    ipp = getattr(ds0, "ImagePositionPatient", None)
    iop = getattr(ds0, "ImageOrientationPatient", None)
    ps = getattr(ds0, "PixelSpacing", None)

    if ipp is None or iop is None or ps is None:
        # fallback affine: identity with 1mm voxels
        return np.eye(4, dtype=np.float32)

    origin = np.array(_float3(ipp), dtype=np.float32)
    iop = np.array([float(x) for x in iop], dtype=np.float32)
    row_dir = iop[:3]
    col_dir = iop[3:]
    row_spacing = float(ps[0])
    col_spacing = float(ps[1])

    # slice direction is cross product
    slice_dir = np.cross(row_dir, col_dir)

    # slice spacing: prefer distance between consecutive IPPs
    slice_spacing = None
    if ds1 is not None:
        ipp1 = getattr(ds1, "ImagePositionPatient", None)
        if ipp1 is not None and len(ipp1) >= 3:
            origin1 = np.array(_float3(ipp1), dtype=np.float32)
            slice_spacing = float(np.linalg.norm(origin1 - origin))

    if slice_spacing is None or slice_spacing <= 0:
        sbs = getattr(ds0, "SpacingBetweenSlices", None)
        if sbs is not None:
            slice_spacing = float(sbs)
        else:
            slice_spacing = float(getattr(ds0, "SliceThickness", 1.0) or 1.0)

    # Columns in affine are direction vectors scaled by spacing:
    # Note: DICOM row/col is often (y,x) relative to array indices; here we map:
    # i -> row, j -> col, k -> slice
    affine = np.eye(4, dtype=np.float32)
    affine[:3, 0] = row_dir * row_spacing
    affine[:3, 1] = col_dir * col_spacing
    affine[:3, 2] = slice_dir * slice_spacing
    affine[:3, 3] = origin
    return affine


def export_nifti(root: str, out_path: str) -> None:
    if nib is None or Nifti1Image is None or nib_save is None:
        raise SystemExit("Missing dependency: nibabel. Install with: pip install nibabel")

    paths = find_dicom_files(root)
    groups = get_series_groups(paths)
    sid, series_paths = choose_largest_series(groups)
    slices = load_series(series_paths)

    print(f"Exporting NIfTI from series {sid} ({len(slices)} slices) -> {out_path}")

    # Stack into volume (k, i, j) then transpose to (i, j, k) commonly used in NIfTI
    vol_slices: List[np.ndarray] = []
    for s in slices:
        arr = s.ds.pixel_array
        arr = dicom_to_hu(s.ds, arr)
        vol_slices.append(arr.astype(np.float32))

    vol_kij = np.stack(vol_slices, axis=0)  # (k, i, j)
    vol_ijk = np.transpose(vol_kij, (1, 2, 0))  # (i, j, k)

    ds0 = slices[0].ds
    ds1 = slices[1].ds if len(slices) > 1 else None
    affine = build_affine(ds0, ds1)

    nii = Nifti1Image(vol_ijk, affine)  # type: ignore
    nib_save(nii, out_path)  # type: ignore
    print("Done.")


PHI_KEYWORDS = {
    # Common direct identifiers
    "PatientName",
    "PatientID",
    "PatientBirthDate",
    "PatientSex",
    "PatientAddress",
    "PatientTelephoneNumbers",
    "OtherPatientIDs",
    "OtherPatientNames",
    "AccessionNumber",
    "InstitutionName",
    "InstitutionAddress",
    "ReferringPhysicianName",
    "PerformingPhysicianName",
    "OperatorsName",
    "StudyID",
    "StudyDate",
    "StudyTime",
    "SeriesDate",
    "SeriesTime",
    "AcquisitionDate",
    "AcquisitionTime",
    "ContentDate",
    "ContentTime",
    "DeviceSerialNumber",
    "StationName",
    "ProtocolName",
    "StudyDescription",
    "SeriesDescription",
}


def anonymize_folder(root: str, out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    paths = find_dicom_files(root)
    if not paths:
        raise SystemExit("No DICOM-like files found.")

    print(f"Anonymizing {len(paths)} files -> {out_dir}")
    removed = 0

    for p in paths:
        ds = safe_read(p, stop_before_pixels=False)
        if ds is None:
            continue

        # Remove private tags (huge source of hidden identifiers)
        try:
            ds.remove_private_tags()
        except Exception:
            pass

        # Remove known PHI keywords if present
        for key in list(PHI_KEYWORDS):
            if hasattr(ds, key):
                try:
                    delattr(ds, key)
                    removed += 1
                except Exception:
                    pass

        # Overwrite core UIDs with new ones (optional, but helps unlink datasets)
        # Comment out if you need to keep linkage.
        ds.StudyInstanceUID = generate_uid()
        ds.SeriesInstanceUID = generate_uid()
        ds.SOPInstanceUID = generate_uid()

        # Save in mirrored structure
        rel = os.path.relpath(p, root)
        out_path = os.path.join(out_dir, rel)
        os.makedirs(os.path.dirname(out_path), exist_ok=True)

        # Ensure file meta exists
        if not hasattr(ds, "file_meta"):
            ds.file_meta = FileMetaDataset()

        ds.save_as(out_path)

    print(f"Done. Removed/blanked approx {removed} PHI fields (plus private tags).")
    print("Reminder: This does NOT remove burned-in pixel text. That requires image-based redaction.")


def main(argv: List[str]) -> int:
    ap = argparse.ArgumentParser(prog="dicom_toolkit", description="Inspect / convert / anonymize DICOM data.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ins = sub.add_parser("inspect", help="Inspect DICOM folder (series summary + pixel stats).")
    p_ins.add_argument("root", help="Folder containing DICOM files")

    p_png = sub.add_parser("to-png", help="Convert the largest series in folder to PNG slices.")
    p_png.add_argument("root", help="Folder containing DICOM files")
    p_png.add_argument("--out", required=True, help="Output folder for PNGs")
    p_png.add_argument("--window", nargs=2, type=float, metavar=("CENTER", "WIDTH"), help="Window center and width")

    p_nii = sub.add_parser("to-nifti", help="Convert the largest series in folder to a NIfTI volume.")
    p_nii.add_argument("root", help="Folder containing DICOM files")
    p_nii.add_argument("--out", required=True, help="Output .nii or .nii.gz path")

    p_anon = sub.add_parser("anonymize", help="Anonymize DICOM folder into a new output folder.")
    p_anon.add_argument("root", help="Folder containing DICOM files")
    p_anon.add_argument("--out", required=True, help="Output folder for anonymized DICOMs")

    args = ap.parse_args(argv)

    if args.cmd == "inspect":
        inspect_folder(args.root)
        return 0
    if args.cmd == "to-png":
        export_png(args.root, args.out, tuple(args.window) if args.window else None)
        return 0
    if args.cmd == "to-nifti":
        export_nifti(args.root, args.out)
        return 0
    if args.cmd == "to-anonymize":
        anonymize_folder(args.root, args.out)
        return 0

    return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
