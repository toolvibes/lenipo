import { getQuickJS, shouldInterruptAfterDeadline } from 'quickjs-emscripten';

const TIME_LIMIT_MS = 1_000;
const MEMORY_LIMIT = 32 * 1024 * 1024;
const RESULT_LIMIT = 100_000;

export class ScriptError extends Error {}

/**
 * Runs the JavaScript of a "Run script" action (TL-50, E-140) in QuickJS compiled to
 * WebAssembly: its own heap of 32 MB, one second, no network, files, timers or modules. The
 * input arrives as `issue`, `data` and `rule`; what the code returns must survive JSON.
 */
export async function runScript(code: string, input: Record<string, unknown>): Promise<unknown> {
  const quickJs = await getQuickJS();
  const runtime = quickJs.newRuntime();
  runtime.setMemoryLimit(MEMORY_LIMIT);
  runtime.setMaxStackSize(512 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TIME_LIMIT_MS));
  const vm = runtime.newContext();
  try {
    const source = `globalThis.input = ${JSON.stringify(input)};
JSON.stringify((function () {
  "use strict";
  const { issue, data, rule } = globalThis.input;
${code}
})() ?? null) ?? 'null';`;
    const result = vm.evalCode(source, 'script.js');
    if (result.error) {
      const error = vm.dump(result.error) as { name?: string; message?: string } | string;
      result.error.dispose();
      const message =
        typeof error === 'string' ? error : `${error.name ?? 'Error'}: ${error.message ?? ''}`;
      throw new ScriptError(
        /interrupted/i.test(message)
          ? `Das Skript lief länger als ${TIME_LIMIT_MS / 1000} s.`
          : message,
      );
    }
    const text = vm.getString(result.value);
    result.value.dispose();
    if (text.length > RESULT_LIMIT) throw new ScriptError('Das Skript gab zu viele Daten zurück.');
    return JSON.parse(text) as unknown;
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}
