import ctypes
import json
import sys


MAXCOMLEN = 16
PROC_PIDTBSDINFO = 3


class ProcBsdInfo(ctypes.Structure):
    _fields_ = [
        ("pbi_flags", ctypes.c_uint32),
        ("pbi_status", ctypes.c_uint32),
        ("pbi_xstatus", ctypes.c_uint32),
        ("pbi_pid", ctypes.c_uint32),
        ("pbi_ppid", ctypes.c_uint32),
        ("pbi_uid", ctypes.c_uint32),
        ("pbi_gid", ctypes.c_uint32),
        ("pbi_ruid", ctypes.c_uint32),
        ("pbi_rgid", ctypes.c_uint32),
        ("pbi_svuid", ctypes.c_uint32),
        ("pbi_svgid", ctypes.c_uint32),
        ("rfu_1", ctypes.c_uint32),
        ("pbi_comm", ctypes.c_char * MAXCOMLEN),
        ("pbi_name", ctypes.c_char * (2 * MAXCOMLEN)),
        ("pbi_nfiles", ctypes.c_uint32),
        ("pbi_pgid", ctypes.c_uint32),
        ("pbi_pjobc", ctypes.c_uint32),
        ("e_tdev", ctypes.c_uint32),
        ("e_tpgid", ctypes.c_uint32),
        ("pbi_nice", ctypes.c_int32),
        ("pbi_start_tvsec", ctypes.c_uint64),
        ("pbi_start_tvusec", ctypes.c_uint64),
    ]


def main():
    libproc = ctypes.CDLL("/usr/lib/libproc.dylib")
    libproc.proc_pidinfo.argtypes = [
        ctypes.c_int,
        ctypes.c_int,
        ctypes.c_uint64,
        ctypes.c_void_p,
        ctypes.c_int,
    ]
    libproc.proc_pidinfo.restype = ctypes.c_int
    result = {}
    for raw_pid in sys.argv[1:]:
        if not raw_pid.isdecimal() or int(raw_pid) <= 0:
            raise ValueError("process identity requires positive decimal PIDs")
        pid = int(raw_pid)
        info = ProcBsdInfo()
        size = libproc.proc_pidinfo(
            pid,
            PROC_PIDTBSDINFO,
            0,
            ctypes.byref(info),
            ctypes.sizeof(info),
        )
        if size != ctypes.sizeof(info):
            continue
        result[raw_pid] = {
            "birthIdentity": (
                f"darwin:{info.pbi_start_tvsec}:{info.pbi_start_tvusec}"
            ),
            "pgid": info.pbi_pgid,
            "pid": info.pbi_pid,
            "ppid": info.pbi_ppid,
            "status": info.pbi_status,
        }
    print(json.dumps(result, separators=(",", ":")))


if __name__ == "__main__":
    main()
