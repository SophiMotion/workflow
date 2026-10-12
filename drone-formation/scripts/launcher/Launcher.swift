import AppKit

final class Launcher: NSObject, NSApplicationDelegate {
    private var starting = false
    private let page = URL(string: "http://127.0.0.1:4178/")!

    func applicationDidFinishLaunching(_ notification: Notification) { launch() }

    func application(_ application: NSApplication, open urls: [URL]) {
        // Ignore everything except our fixed launch action / 仅接受固定启动动作。
        guard urls.contains(where: {
            $0.scheme == "sophistudio-drone" && $0.host == "open" &&
            ($0.path.isEmpty || $0.path == "/") && $0.query == nil && $0.fragment == nil
        }) else { return }
        launch()
    }

    private func launch() {
        guard !starting else { return }
        starting = true
        let root = Bundle.main.bundleURL.deletingLastPathComponent()
        let settings = Bundle.main.url(forResource: "runtime", withExtension: "json")
        let savedNode = settings.flatMap { try? Data(contentsOf: $0) }
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: String] }?["node"]
        let candidates = [savedNode, "/opt/homebrew/bin/node", "/usr/local/bin/node",
                          NSHomeDirectory() + "/.local/bin/node"].compactMap { $0 }
        guard let node = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) else {
            fail("找不到 Node.js。请安装 Node.js 22 或更新版本，或重新生成启动器。")
            return
        }
        guard FileManager.default.fileExists(atPath: root.appendingPathComponent("scripts/launch-service.mjs").path) else {
            fail("请把启动器放回「drone-formation」项目文件夹，或从 Dock 使用原位置的启动器。")
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let process = Process()
            process.executableURL = URL(fileURLWithPath: node)
            process.arguments = [root.appendingPathComponent("scripts/launch-service.mjs").path]
            process.currentDirectoryURL = root
            process.standardInput = FileHandle.nullDevice
            let output = Pipe()
            process.standardOutput = output
            process.standardError = output
            do {
                try process.run()
                let data = output.fileHandleForReading.readDataToEndOfFile()
                process.waitUntilExit()
                let message = String(data: data, encoding: .utf8) ?? "未知启动错误"
                DispatchQueue.main.async {
                    guard process.terminationStatus == 0 else { self.fail(message); return }
                    if !NSWorkspace.shared.open(self.page) {
                        self.fail("服务已启动。请在浏览器打开 http://127.0.0.1:4178/")
                        return
                    }
                    NSApp.terminate(nil)
                }
            } catch {
                DispatchQueue.main.async { self.fail(error.localizedDescription) }
            }
        }
    }

    private func fail(_ message: String) {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "点阵飞行启动提示"
        alert.informativeText = message
        alert.addButton(withTitle: "好")
        alert.runModal()
        NSApp.terminate(nil)
    }
}

let application = NSApplication.shared
let delegate = Launcher()
application.delegate = delegate
application.setActivationPolicy(.accessory)
application.run()
