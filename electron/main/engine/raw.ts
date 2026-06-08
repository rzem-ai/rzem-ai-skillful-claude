// Raw Editor model. Turns each on-disk config file into a syntax-aware line
// list with the same semantic lint annotations the rest of the engine knows
// about: wrong-file keys, unreachable allow rules, masked secrets, parse
// errors, and folded sensitive sections in ~/.claude.json.

import type { PermissionsModel, RawFile, RawLine, RawModel, RawTreeGroup, ScopeId } from '../../shared/contract.js';
import { GLOBAL_CONFIG_KEYS } from './keys.js';
import { looksSecret, maskValue } from './secrets.js';
import type { DiscoveredSources, SourceFile } from './sources.js';

const FOLD_KEYS = ['oauthAccount', 'oauthCache', 'cachedChangelog', 'tipsHistory'];

export function resolveRaw(src: DiscoveredSources, perms: PermissionsModel): RawModel {
    const files: RawFile[] = [];
    const idFor = new Map<SourceFile, string>();
    let dropinSeq = 0;

    const include: SourceFile[] = [];
    for (const f of src.files) {
        if (f.role === 'managed-mcp') continue;
        if (!f.exists) continue;
        include.push(f);
    }

    for (const f of include) {
        let id: string;
        switch (f.role) {
            case 'managed':
                id = 'mgmt';
                break;
            case 'managed-dropin':
                id = `mgmt-d${dropinSeq++}`;
                break;
            case 'local':
                id = 'local';
                break;
            case 'project':
                id = 'proj';
                break;
            case 'project-mcp':
                id = 'pmcp';
                break;
            case 'global':
                id = 'global';
                break;
            default:
                id = 'user';
        }
        idFor.set(f, id);
        files.push(buildRawFile(id, f, perms));
    }

    // Tree grouped by scope, preserving managed → local → project → user order.
    const order: ScopeId[] = ['managed', 'local', 'project', 'user'];
    const tree: RawTreeGroup[] = [];
    for (const scope of order) {
        const ids = files.filter((rf) => rf.scope === scope).map((rf) => rf.id);
        if (ids.length) tree.push({ scope, ids });
    }

    return { files, tree };
}

function buildRawFile(id: string, f: SourceFile, perms: PermissionsModel): RawFile {
    const locked = !f.writable;
    const isGlobal = f.role === 'global';
    const lines = buildLines(f, perms, isGlobal);

    const health: RawFile['health'] = f.health === 'err' ? 'err' : f.health === 'warn' ? 'warn' : lines.some((l) => l.g === 'warn') ? 'warn' : 'ok';

    const rf: RawFile = {
        id,
        scope: f.scope,
        realPath: f.writable ? f.path : '',
        path: f.display,
        label: labelOf(f),
        health,
        committed: f.committed,
        gitignore: f.gitignore,
        locked,
        dragons: isGlobal,
        content: f.text,
        lines,
    };
    if (f.parseErr) rf.parseErr = { line: f.parseErr.line, msg: `${f.parseErr.message} File excluded from resolution.` };
    return rf;
}

function labelOf(f: SourceFile): string {
    const segs = f.display.split('/');
    return segs[segs.length - 1] || f.display;
}

const UNREACHABLE_NOTE = (note: string) => note;

function buildLines(f: SourceFile, perms: PermissionsModel, isGlobal: boolean): RawLine[] {
    const rawLines = f.text.split('\n');
    const unreachableSpecs = perms.rules.filter((r) => r.unreachable).map((r) => ({ spec: r.spec, note: r.unreachable! }));

    return rawLines.map((text) => {
        const line: RawLine = { t: text };

        // Folded sensitive sections in ~/.claude.json.
        if (isGlobal && FOLD_KEYS.some((k) => text.includes(`"${k}"`))) {
            line.folded = true;
            return line;
        }

        // defaultMode lines drive the hero side-by-side.
        if (/"defaultMode"\s*:/.test(text)) {
            line.key = 'defaultMode';
            if (f.role === 'project') line.hi = true;
            if (f.role === 'local' && /"auto"/.test(text)) {
                line.g = 'warn';
                line.lint = { type: 'warn', msg: 'Ignored — “auto” mode can only be set in user settings (since v2.1.142).', action: 'Move to user' };
            }
        }

        // Wrong-file (global-config) keys.
        for (const k of GLOBAL_CONFIG_KEYS) {
            if (f.role !== 'global' && new RegExp(`"${k}"\\s*:`).test(text)) {
                line.g = 'warn';
                line.lint = { type: 'warn', msg: `Wrong file — ${k} belongs in ~/.claude.json or it is ignored.`, action: 'Move it' };
            }
        }

        // Unreachable allow rules.
        for (const u of unreachableSpecs) {
            if (text.includes(u.spec) && /allow|"allow"/.test(text)) {
                line.g = 'warn';
                line.lint = { type: 'warn', msg: UNREACHABLE_NOTE(u.note), action: 'Explain' };
            }
        }

        // Parse-error line.
        if (f.parseErr && rawLines.indexOf(text) + 1 === f.parseErr.line) {
            line.g = 'err';
            line.lint = { type: 'err', msg: f.parseErr.message, action: 'Open docs' };
        }

        // Secret masking + reveal lint.
        const sec = text.match(/"([A-Za-z0-9_]+)"\s*:\s*"([^"]+)"/);
        if (sec && looksSecret(sec[1], sec[2])) {
            line.t = text.replace(sec[2], maskValue(sec[2]));
            line.g = 'warn';
            line.lint = { type: 'warn', msg: 'Secret detected — masked by default. Reveal per-field; never written to diffs.', action: 'Reveal' };
        }

        return line;
    });
}
