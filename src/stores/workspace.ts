import { defineStore } from "pinia";
import { ref } from "vue";
import { scanWorkspace, type WorkspaceEntry, type WorkspaceScan } from "@/composables/useTauriFs";

export type Scope = "workspace" | "global";

export const useWorkspaceStore = defineStore("workspace", () => {
  const scope = ref<Scope>("workspace");
  const root = ref<string | null>(null);
  const entries = ref<WorkspaceEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function loadWorkspace(path: string) {
    loading.value = true;
    error.value = null;
    try {
      const result: WorkspaceScan = await scanWorkspace(path);
      root.value = result.root;
      entries.value = result.entries;
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err);
    } finally {
      loading.value = false;
    }
  }

  function setScope(next: Scope) {
    scope.value = next;
  }

  return {
    scope,
    root,
    entries,
    loading,
    error,
    loadWorkspace,
    setScope,
  };
});
