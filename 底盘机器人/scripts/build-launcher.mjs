import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'darwin') throw new Error('此启动器仅用于 macOS。');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = path.join(root, 'SkateChassis 工作台.app');
const contents = path.join(bundle, 'Contents');
fs.copyFileSync(path.join(root, 'public/打开工作台.html'), path.join(root, '打开工作台.html'));
fs.mkdirSync(path.join(contents, 'MacOS'), { recursive: true });
fs.mkdirSync(path.join(contents, 'Resources'), { recursive: true });
const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'skate-swift-'));
try {
  execFileSync('/usr/bin/xcrun', ['swiftc', '-O', '-module-cache-path', cache,
    path.join(root, 'scripts/launcher/Launcher.swift'), '-o', path.join(contents, 'MacOS/SkateChassisLauncher')], { stdio: 'inherit' });
} finally { fs.rmSync(cache, { recursive: true, force: true }); }
fs.writeFileSync(path.join(contents, 'Resources/runtime.json'), JSON.stringify({ node: process.execPath }, null, 2));
fs.writeFileSync(path.join(contents, 'PkgInfo'), 'APPL????');
fs.writeFileSync(path.join(contents, 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>SkateChassisLauncher</string>
<key>CFBundleIdentifier</key><string>com.sophistudio.skatechassis.launcher</string>
<key>CFBundleName</key><string>SkateChassis 工作台</string>
<key>CFBundleDisplayName</key><string>SkateChassis 工作台</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>CFBundleShortVersionString</key><string>1.0.0</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
<key>LSUIElement</key><true/>
<key>CFBundleURLTypes</key><array><dict>
<key>CFBundleURLName</key><string>SophiStudio SkateChassis</string>
<key>CFBundleTypeRole</key><string>Viewer</string>
<key>CFBundleURLSchemes</key><array><string>sophistudio-skate</string></array>
</dict></array>
</dict></plist>`);
execFileSync('/usr/bin/codesign', ['--force', '--sign', '-', bundle], { stdio: 'inherit' });
console.log('启动器已生成：' + bundle);
