// Tolerant JSON parsing that captures the precise error location. Claude Code
// itself requires strict JSON (the fixture's trailing comma is a hard error),
// so we parse strictly with JSON.parse but recover a human-readable line/column
// for the health badges and Raw Editor parse banners.

export interface ParseError {
    line: number; // 1-based
    column: number; // 1-based
    message: string;
}

export interface ParseResult<T = unknown> {
    ok: boolean;
    value?: T;
    error?: ParseError;
}

// Node ≥20 includes "(line L column C)" in JSON.parse error messages. We parse
// that when present and otherwise derive the position from "at position N".
function locate(text: string, message: string): { line: number; column: number } {
    const lc = message.match(/line (\d+) column (\d+)/i);
    if (lc) return { line: Number(lc[1]), column: Number(lc[2]) };

    const pos = message.match(/at position (\d+)/i);
    if (pos) {
        const idx = Math.min(Number(pos[1]), text.length);
        let line = 1;
        let col = 1;
        for (let i = 0; i < idx; i++) {
            if (text[i] === '\n') {
                line++;
                col = 1;
            } else {
                col++;
            }
        }
        return { line, column: col };
    }
    return { line: 1, column: 1 };
}

export function parseJson<T = unknown>(text: string): ParseResult<T> {
    try {
        return { ok: true, value: JSON.parse(text) as T };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const { line, column } = locate(text, message);
        // Trailing-comma is the most common hand-edit mistake; surface it
        // plainly when the generic message would otherwise be cryptic.
        const friendly = /Expected double-quoted property name|Unexpected token/.test(message)
            ? `Invalid JSON (likely a trailing comma or stray character) at line ${line}, column ${column}.`
            : message;
        return { ok: false, error: { line, column, message: friendly } };
    }
}
