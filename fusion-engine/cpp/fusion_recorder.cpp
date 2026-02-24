// cpp/fusion_recorder.cpp
// Build: C++17 (Windows). Requires ffmpeg.exe on PATH.
//
// Examples:
//   fusion_recorder.exe list-devices
//   fusion_recorder.exe record-screen --duration 10 --out out.mp4 --width 1920 --height 1080 --fps 30 --bitrate 2500
//   fusion_recorder.exe record-audio  --duration 5  --out out.m4a --mic "Microphone (Realtek(R) Audio)"
//
// Notes:
// - Screen capture uses gdigrab (Windows).
// - Audio capture uses dshow. System audio requires a capturable device (e.g., "Stereo Mix" or "virtual-audio-capturer").
// - If you pass both --mic and --sys, ffmpeg will amix them.

#include <windows.h>
#include <string>
#include <vector>
#include <sstream>
#include <iostream>
#include <algorithm>

static std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
            case '\\': out += "\\\\"; break;
            case '"':  out += "\\\""; break;
            case '\n': out += "\\n"; break;
            case '\r': out += "\\r"; break;
            case '\t': out += "\\t"; break;
            default:
                if ((unsigned char)c < 0x20) {
                    char buf[8];
                    snprintf(buf, sizeof(buf), "\\u%04x", (unsigned char)c);
                    out += buf;
                } else out += c;
        }
    }
    return out;
}

static std::wstring widen(const std::string& s) {
    if (s.empty()) return L"";
    int len = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), nullptr, 0);
    std::wstring w(len, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.c_str(), (int)s.size(), &w[0], len);
    return w;
}

static std::string quote_arg(const std::string& a) {
    // Windows commandline quoting: wrap in quotes if spaces or special characters exist.
    // This is "good enough" for ffmpeg invocations.
    bool needs = a.find_first_of(" \t\"") != std::string::npos;
    if (!needs) return a;
    std::string q = "\"";
    for (char c : a) {
        if (c == '"') q += "\\\"";
        else q += c;
    }
    q += "\"";
    return q;
}

struct ProcResult {
    int exit_code = -1;
    std::string stdout_text;
    std::string stderr_text;
};

static ProcResult run_process_capture(const std::string& cmdline_utf8) {
    ProcResult r;

    SECURITY_ATTRIBUTES sa{};
    sa.nLength = sizeof(sa);
    sa.bInheritHandle = TRUE;

    HANDLE out_read = NULL, out_write = NULL;
    HANDLE err_read = NULL, err_write = NULL;

    if (!CreatePipe(&out_read, &out_write, &sa, 0)) {
        r.stderr_text = "CreatePipe stdout failed";
        return r;
    }
    if (!CreatePipe(&err_read, &err_write, &sa, 0)) {
        CloseHandle(out_read); CloseHandle(out_write);
        r.stderr_text = "CreatePipe stderr failed";
        return r;
    }

    SetHandleInformation(out_read, HANDLE_FLAG_INHERIT, 0);
    SetHandleInformation(err_read, HANDLE_FLAG_INHERIT, 0);

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    si.dwFlags |= STARTF_USESTDHANDLES;
    si.hStdOutput = out_write;
    si.hStdError  = err_write;
    si.hStdInput  = GetStdHandle(STD_INPUT_HANDLE);

    PROCESS_INFORMATION pi{};
    std::wstring cmdw = widen(cmdline_utf8);

    // CreateProcessW requires mutable buffer
    std::vector<wchar_t> buf(cmdw.begin(), cmdw.end());
    buf.push_back(L'\0');

    BOOL ok = CreateProcessW(
        NULL,
        buf.data(),
        NULL,
        NULL,
        TRUE,
        CREATE_NO_WINDOW,
        NULL,
        NULL,
        &si,
        &pi
    );

    CloseHandle(out_write);
    CloseHandle(err_write);

    if (!ok) {
        DWORD e = GetLastError();
        std::ostringstream oss;
        oss << "CreateProcess failed: " << e;
        r.stderr_text = oss.str();
        CloseHandle(out_read);
        CloseHandle(err_read);
        return r;
    }

    auto read_all = [](HANDLE h) -> std::string {
        std::string out;
        char tmp[4096];
        DWORD read = 0;
        while (true) {
            BOOL ok = ReadFile(h, tmp, (DWORD)sizeof(tmp), &read, NULL);
            if (!ok || read == 0) break;
            out.append(tmp, tmp + read);
        }
        return out;
    };

    // Wait for completion first, then drain pipes
    WaitForSingleObject(pi.hProcess, INFINITE);

    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);
    r.exit_code = (int)exitCode;

    r.stdout_text = read_all(out_read);
    r.stderr_text = read_all(err_read);

    CloseHandle(out_read);
    CloseHandle(err_read);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return r;
}

static bool has_flag(const std::vector<std::string>& args, const std::string& f) {
    return std::find(args.begin(), args.end(), f) != args.end();
}

static std::string get_opt(const std::vector<std::string>& args, const std::string& key, const std::string& def = "") {
    for (size_t i = 0; i + 1 < args.size(); i++) {
        if (args[i] == key) return args[i + 1];
    }
    return def;
}

static int to_int(const std::string& s, int def) {
    try { return std::stoi(s); } catch (...) { return def; }
}

static void print_json_result(bool ok, const std::string& mode, const std::string& outPath,
                              int durationS, int exitCode, const std::string& stdoutTxt, const std::string& stderrTxt) {
    std::cout
      << "{"
      << "\"ok\":" << (ok ? "true" : "false") << ","
      << "\"mode\":\"" << json_escape(mode) << "\","
      << "\"out\":\"" << json_escape(outPath) << "\","
      << "\"duration_s\":" << durationS << ","
      << "\"exit_code\":" << exitCode << ","
      << "\"stdout\":\"" << json_escape(stdoutTxt) << "\","
      << "\"stderr\":\"" << json_escape(stderrTxt) << "\""
      << "}\n";
}

static std::string build_ffmpeg_list_devices_cmd() {
    // ffmpeg prints device listing to stderr.
    return "ffmpeg -hide_banner -list_devices true -f dshow -i dummy";
}

static std::string build_ffmpeg_record_audio_cmd(int durationS, const std::string& outPath, const std::string& micDevice) {
    std::ostringstream cmd;
    cmd << "ffmpeg -y -hide_banner ";
    if (!micDevice.empty()) {
        cmd << "-f dshow -i " << quote_arg("audio=" + micDevice) << " ";
    } else {
        // default input (may fail if no default)
        cmd << "-f dshow -i audio=" << quote_arg("default") << " ";
    }
    cmd << "-t " << durationS << " "
        << "-c:a aac -b:a 192k "
        << quote_arg(outPath);
    return cmd.str();
}

static std::string build_ffmpeg_record_screen_cmd(
    int durationS, const std::string& outPath, int width, int height, int fps, int bitrateK,
    const std::string& micDevice, const std::string& sysDevice
) {
    std::ostringstream cmd;
    cmd << "ffmpeg -y -hide_banner ";

    // Video (desktop)
    cmd << "-f gdigrab "
        << "-framerate " << fps << " "
        << "-video_size " << width << "x" << height << " "
        << "-i desktop ";

    int audioInputs = 0;
    if (!sysDevice.empty()) {
        cmd << "-f dshow -i " << quote_arg("audio=" + sysDevice) << " ";
        audioInputs++;
    }
    if (!micDevice.empty()) {
        cmd << "-f dshow -i " << quote_arg("audio=" + micDevice) << " ";
        audioInputs++;
    }

    // Encoding
    cmd << "-t " << durationS << " ";

    if (audioInputs == 0) {
        cmd << "-c:v libx264 -preset veryfast -pix_fmt yuv420p "
            << "-b:v " << bitrateK << "k "
            << "-an ";
        cmd << quote_arg(outPath);
        return cmd.str();
    }

    if (audioInputs == 1) {
        cmd << "-c:v libx264 -preset veryfast -pix_fmt yuv420p "
            << "-b:v " << bitrateK << "k "
            << "-c:a aac -b:a 192k ";
        cmd << quote_arg(outPath);
        return cmd.str();
    }

    // audioInputs == 2: amix
    // Input indexes:
    // 0:v = desktop
    // 1:a = sys OR mic (depending on order)
    // 2:a = mic OR sys
    cmd << "-filter_complex " << quote_arg("[1:a][2:a]amix=inputs=2:duration=longest[aout]") << " "
        << "-map 0:v -map [aout] "
        << "-c:v libx264 -preset veryfast -pix_fmt yuv420p "
        << "-b:v " << bitrateK << "k "
        << "-c:a aac -b:a 192k "
        << quote_arg(outPath);

    return cmd.str();
}

int main(int argc, char** argv) {
    std::vector<std::string> args;
    args.reserve((size_t)argc);
    for (int i = 0; i < argc; i++) args.push_back(argv[i]);

    if (argc < 2) {
        std::cerr << "Usage:\n"
                  << "  fusion_recorder list-devices\n"
                  << "  fusion_recorder record-audio  --duration <sec> --out <file> [--mic <dshow name>]\n"
                  << "  fusion_recorder record-screen --duration <sec> --out <file> [--width N --height N --fps N --bitrate K] [--mic <name>] [--sys <name>]\n";
        return 2;
    }

    std::string cmd = args[1];

    if (cmd == "list-devices") {
        auto pr = run_process_capture(build_ffmpeg_list_devices_cmd());
        // device list is in stderr; print it raw for user convenience
        std::cout << pr.stderr_text << "\n";
        return pr.exit_code == 0 ? 0 : 1;
    }

    if (cmd == "record-audio") {
        int durationS = to_int(get_opt(args, "--duration", "5"), 5);
        std::string outPath = get_opt(args, "--out", "audio.m4a");
        std::string mic = get_opt(args, "--mic", "");

        std::string ff = build_ffmpeg_record_audio_cmd(durationS, outPath, mic);
        auto pr = run_process_capture(ff);
        bool ok = (pr.exit_code == 0);
        print_json_result(ok, "audio", outPath, durationS, pr.exit_code, pr.stdout_text, pr.stderr_text);
        return ok ? 0 : 1;
    }

    if (cmd == "record-screen") {
        int durationS = to_int(get_opt(args, "--duration", "10"), 10);
        std::string outPath = get_opt(args, "--out", "screen.mp4");
        int width = to_int(get_opt(args, "--width", "1920"), 1920);
        int height = to_int(get_opt(args, "--height", "1080"), 1080);
        int fps = to_int(get_opt(args, "--fps", "30"), 30);
        int bitrateK = to_int(get_opt(args, "--bitrate", "2500"), 2500);
        std::string mic = get_opt(args, "--mic", "");
        std::string sys = get_opt(args, "--sys", "");

        std::string ff = build_ffmpeg_record_screen_cmd(durationS, outPath, width, height, fps, bitrateK, mic, sys);
        auto pr = run_process_capture(ff);
        bool ok = (pr.exit_code == 0);
        print_json_result(ok, "screen", outPath, durationS, pr.exit_code, pr.stdout_text, pr.stderr_text);
        return ok ? 0 : 1;
    }

    std::cerr << "Unknown command: " << cmd << "\n";
    return 2;
}
