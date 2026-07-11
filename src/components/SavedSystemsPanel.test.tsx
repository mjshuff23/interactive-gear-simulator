/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SavedSystemsPanel } from "./SavedSystemsPanel";
import * as gearSystemsLib from "../persistence/gear-systems";
import * as supabaseLib from "../lib/supabase";

vi.mock("../persistence/gear-systems", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../persistence/gear-systems")>();
  return {
    ...actual,
    listSavedGearSystems: vi.fn(),
    loadSavedGearSystem: vi.fn(),
    createSavedGearSystem: vi.fn(),
    updateSavedGearSystem: vi.fn(),
    renameSavedGearSystem: vi.fn(),
    deleteSavedGearSystem: vi.fn(),
  };
});
vi.mock("../lib/supabase");

describe("SavedSystemsPanel", () => {
  const defaultProps = {
    currentSystem: {
      id: "sys-1",
      name: "Test System",
      gears: [],
      connections: [],
    } as any,
    activeSavedSystemId: null,
    isDirty: true,
    onLoadSystem: vi.fn(),
    onSaveSuccess: vi.fn(),
    onRenameSuccess: vi.fn(),
    onDeleteSuccess: vi.fn(),
    onRequestAuth: vi.fn(),
    isAuthed: true,
  };

  const mockClient = {};

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabaseLib.getSupabaseConfiguration).mockReturnValue({
      status: "ready",
      client: mockClient as any,
    });
    vi.mocked(gearSystemsLib.listSavedGearSystems).mockResolvedValue([]);

    // Auto-confirm window dialogs
    window.confirm = vi.fn().mockReturnValue(true);
  });

  it("routes anonymous save attempts to auth modal", async () => {
    const user = userEvent.setup();
    const onRequestAuth = vi.fn();

    render(
      <SavedSystemsPanel
        {...defaultProps}
        isAuthed={false}
        onRequestAuth={onRequestAuth}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onRequestAuth).toHaveBeenCalledTimes(1);
    expect(gearSystemsLib.createSavedGearSystem).not.toHaveBeenCalled();
  });

  it("handles successful save (creation) when authed", async () => {
    const user = userEvent.setup();
    const onSaveSuccess = vi.fn();
    vi.mocked(gearSystemsLib.createSavedGearSystem).mockResolvedValue({
      id: "sys-new",
    } as any);

    render(
      <SavedSystemsPanel {...defaultProps} onSaveSuccess={onSaveSuccess} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(gearSystemsLib.createSavedGearSystem).toHaveBeenCalledWith(
      mockClient,
      defaultProps.currentSystem,
    );
    expect(onSaveSuccess).toHaveBeenCalledWith({ id: "sys-new" });
  });

  it("handles save errors with inline text", async () => {
    const user = userEvent.setup();
    vi.mocked(gearSystemsLib.createSavedGearSystem).mockRejectedValue(
      new Error("Network Error"),
    );

    render(<SavedSystemsPanel {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to save: Network Error");
  });

  it("intercepts STALE_WRITE on update and triggers loadList", async () => {
    const user = userEvent.setup();

    vi.mocked(gearSystemsLib.listSavedGearSystems).mockResolvedValue([
      { id: "sys-1", name: "Existing", updatedAt: "2023-01-01" } as any,
    ]);

    render(<SavedSystemsPanel {...defaultProps} activeSavedSystemId="sys-1" />);

    // Wait for list to load
    await waitFor(() => {
      expect(gearSystemsLib.listSavedGearSystems).toHaveBeenCalledTimes(1);
    });

    const error = new gearSystemsLib.PersistenceException(
      "STALE_WRITE",
      "Stale write",
    );
    vi.mocked(gearSystemsLib.updateSavedGearSystem).mockRejectedValue(error);

    await user.click(screen.getByRole("button", { name: "Save" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Stale write: The system was updated elsewhere.",
    );

    // loadList should have been called again to refresh
    expect(gearSystemsLib.listSavedGearSystems).toHaveBeenCalledTimes(2);
  });

  it("prompts for delete confirmation and handles success", async () => {
    const user = userEvent.setup();
    const onDeleteSuccess = vi.fn();

    vi.mocked(gearSystemsLib.listSavedGearSystems).mockResolvedValue([
      { id: "sys-del", name: "To Delete", updatedAt: "2023-01-01" } as any,
    ]);

    render(
      <SavedSystemsPanel {...defaultProps} onDeleteSuccess={onDeleteSuccess} />,
    );

    await waitFor(() => {
      expect(screen.getByText("To Delete")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete "To Delete"?',
    );
    expect(gearSystemsLib.deleteSavedGearSystem).toHaveBeenCalledWith(
      mockClient,
      "sys-del",
      "2023-01-01",
    );

    await waitFor(() => {
      expect(onDeleteSuccess).toHaveBeenCalledWith("sys-del");
    });
  });

  it("aborts delete if confirmation is cancelled", async () => {
    window.confirm = vi.fn().mockReturnValue(false);
    const user = userEvent.setup();

    vi.mocked(gearSystemsLib.listSavedGearSystems).mockResolvedValue([
      { id: "sys-del", name: "To Delete", updatedAt: "2023-01-01" } as any,
    ]);

    render(<SavedSystemsPanel {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("To Delete")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(gearSystemsLib.deleteSavedGearSystem).not.toHaveBeenCalled();
  });
});
