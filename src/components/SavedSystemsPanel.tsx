import { useEffect, useState, useCallback } from "react";
import {
  listSavedGearSystems,
  loadSavedGearSystem,
  createSavedGearSystem,
  updateSavedGearSystem,
  renameSavedGearSystem,
  deleteSavedGearSystem,
  type SavedGearSystemSummary,
  PersistenceException,
} from "../persistence/gear-systems";
import { getSupabaseConfiguration } from "../lib/supabase";
import type { GearSystem } from "../simulation/gear-system";
import "./SavedSystemsPanel.css";

interface SavedSystemsPanelProps {
  readonly currentSystem: GearSystem;
  readonly activeSavedSystemId: string | null;
  readonly isDirty: boolean;
  readonly onLoadSystem: (system: GearSystem) => void;
  readonly onSaveSuccess: (system: GearSystem) => void;
  readonly onRenameSuccess: (summary: SavedGearSystemSummary) => void;
  readonly onDeleteSuccess: (deletedId: string) => void;
  readonly onRequestAuth: () => void;
  readonly isAuthed: boolean;
}

export function SavedSystemsPanel({
  currentSystem,
  activeSavedSystemId,
  isDirty,
  onLoadSystem,
  onSaveSuccess,
  onRenameSuccess,
  onDeleteSuccess,
  onRequestAuth,
  isAuthed,
}: SavedSystemsPanelProps) {
  const [systems, setSystems] = useState<SavedGearSystemSummary[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [renameInput, setRenameInput] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const config = getSupabaseConfiguration();
  const client = config.status === "ready" ? config.client : null;

  const loadList = useCallback(async () => {
    if (!client) return;
    setIsLoadingList(true);
    setErrorMsg(null);
    try {
      const list = await listSavedGearSystems(client);
      setSystems(list);
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to load systems");
    } finally {
      setIsLoadingList(false);
    }
  }, [client]);

  useEffect(() => {
    if (isAuthed && client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadList().catch(() => {});
    } else {
      setSystems([]);
    }
  }, [isAuthed, client, loadList]);

  async function handleLoad(id: string) {
    if (isDirty && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    if (!client) return;
    try {
      const sys = await loadSavedGearSystem(client, id);
      onLoadSystem(sys);
    } catch (e: unknown) {
      alert("Failed to load: " + (e instanceof Error ? e.message : "Unknown error"));
    }
  }

  async function handleSave() {
    if (!client) {
      onRequestAuth();
      return;
    }
    setIsSaving(true);
    try {
      if (activeSavedSystemId) {
        // Find expected update time
        const existing = systems.find((s) => s.id === activeSavedSystemId);
        if (!existing) {
          throw new Error("Active system not found in library list.");
        }
        try {
          const updated = await updateSavedGearSystem(
            client,
            currentSystem,
            existing.updatedAt,
          );
          onSaveSuccess(updated);
          await loadList();
        } catch (e: unknown) {
          if (e instanceof PersistenceException && e.type === "STALE_WRITE") {
            alert("Stale write: The system was updated elsewhere.");
            await loadList();
          } else {
            throw e;
          }
        }
      } else {
        const created = await createSavedGearSystem(client, currentSystem);
        onSaveSuccess(created);
        await loadList();
      }
    } catch (e: unknown) {
      alert("Failed to save: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveAsCopy() {
    if (!client) {
      onRequestAuth();
      return;
    }
    setIsSaving(true);
    try {
      const created = await createSavedGearSystem(client, currentSystem);
      onSaveSuccess(created);
      await loadList();
    } catch (e: unknown) {
      alert("Failed to save copy: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(
    id: string,
    expectedUpdatedAt: string,
    name: string,
  ) {
    if (!client) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) {
      return;
    }
    try {
      await deleteSavedGearSystem(client, id, expectedUpdatedAt);
      onDeleteSuccess(id);
      await loadList();
    } catch (e: unknown) {
      alert("Failed to delete: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!client || !renameInput) return;
    try {
      const existing = systems.find((s) => s.id === renameInput.id);
      if (!existing) throw new Error("System not found");
      const summary = await renameSavedGearSystem(
        client,
        renameInput.id,
        renameInput.name,
        existing.updatedAt,
      );
      onRenameSuccess(summary);
      setRenameInput(null);
      await loadList();
    } catch (e: unknown) {
      alert("Failed to rename: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  const saveButtonLabel = isSaving ? "Saving..." : "Save";

  return (
    <div className="saved-systems-panel">
      <div className="actions-bar">
        <button
          onClick={handleSave}
          disabled={isSaving || config.status !== "ready"}
        >
          {saveButtonLabel}
        </button>
        {activeSavedSystemId && (
          <button
            onClick={handleSaveAsCopy}
            disabled={isSaving || config.status !== "ready"}
          >
            Save as copy
          </button>
        )}
      </div>

      <div className="systems-list">
        <h3>Your Library</h3>
        {!isAuthed && config.status === "ready" && (
          <p>
            <button
              type="button"
              className="textLink"
              onClick={onRequestAuth}
            >
              Sign in
            </button>{" "}
            to view and save to your library.
          </p>
        )}
        {!isAuthed && config.status !== "ready" && (
          <p>Cloud saving is unavailable.</p>
        )}
        {isAuthed && isLoadingList && <p>Loading...</p>}
        {isAuthed && errorMsg && <p className="error">{errorMsg}</p>}
        {isAuthed && !isLoadingList && systems.length === 0 && (
          <p>No saved systems.</p>
        )}
        {isAuthed &&
          systems.map((s) => (
            <div
              key={s.id}
              className={`system-item ${s.id === activeSavedSystemId ? "active" : ""}`}
            >
              {renameInput?.id === s.id ? (
                <form onSubmit={handleRenameSubmit} className="rename-form">
                  <input
                    autoFocus
                    value={renameInput.name}
                    onChange={(e) =>
                      setRenameInput({ ...renameInput, name: e.target.value })
                    }
                  />
                  <button type="submit">OK</button>
                  <button type="button" onClick={() => setRenameInput(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <div className="system-info">
                    <strong>{s.name}</strong>
                    <span>{new Date(s.updatedAt).toLocaleString()}</span>
                  </div>
                  <div className="system-actions">
                    <button onClick={() => handleLoad(s.id)}>Load</button>
                    <button
                      onClick={() => setRenameInput({ id: s.id, name: s.name })}
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.updatedAt, s.name)}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
