"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SystemPrompt,
  createSystemPrompt,
  deleteSystemPrompt,
  listSystemPrompts,
  updateSystemPrompt,
} from "@/lib/system-prompt-store";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Loader2,
  Pencil,
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTranslation } from "@/components/i18n-provider";

const CUSTOM_PROMPT_VALUE = "__custom_prompt__";

interface SystemPromptManagerProps {
  systemPrompt: string;
  onSystemPromptChange: (value: string) => void;
  defaultPrompt: string;
}

export function SystemPromptManager({
  systemPrompt,
  onSystemPromptChange,
  defaultPrompt,
}: SystemPromptManagerProps) {
  const { t, locale } = useTranslation();
  const [systemPrompts, setSystemPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [managerOpen, setManagerOpen] = useState<boolean>(false);

  const [isSavingPrompt, setIsSavingPrompt] = useState<boolean>(false);
  const [isCreatingPrompt, setIsCreatingPrompt] = useState<boolean>(false);
  const [creatingPrompt, setCreatingPrompt] = useState<{
    name: string;
    description: string;
    content: string;
  }>({
    name: "",
    description: "",
    content: "",
  });

  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingDetails, setEditingDetails] = useState<{
    name: string;
    description: string;
  }>({ name: "", description: "" });
  const [savingDetailsId, setSavingDetailsId] = useState<string | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const selectedPromptIdRef = useRef<string | null>(null);
  // Keep the latest translator in a ref so the mount-stable fetchPrompts
  // callback reports errors in the current locale without re-running on switch.
  const tRef = useRef(t);
  tRef.current = t;

  const selectedPrompt = useMemo(
    () =>
      selectedPromptId
        ? systemPrompts.find((prompt) => prompt.id === selectedPromptId) ?? null
        : null,
    [systemPrompts, selectedPromptId]
  );

  const hasSelectedPromptChanges =
    !!selectedPrompt && selectedPrompt.content !== systemPrompt;

  const fetchPrompts = useCallback(
    async ({ autoSelect = false }: { autoSelect?: boolean } = {}) => {
      setLoading(true);
      setLoadError(null);
      try {
        const prompts = await listSystemPrompts();
        setSystemPrompts(prompts);

        if (prompts.length === 0) {
          if (selectedPromptIdRef.current !== null) {
            setSelectedPromptId(null);
            selectedPromptIdRef.current = null;
          }
          if (autoSelect) {
            onSystemPromptChange(defaultPrompt);
          }
          return;
        }

        const currentSelectedId = selectedPromptIdRef.current;

        if (currentSelectedId) {
          const existingSelection = prompts.find(
            (prompt) => prompt.id === currentSelectedId
          );

          if (existingSelection) {
            setSelectedPromptId(existingSelection.id);
            selectedPromptIdRef.current = existingSelection.id;
            if (autoSelect) {
              onSystemPromptChange(existingSelection.content);
            }
            return;
          }
        }

        if (currentSelectedId === null && !autoSelect) {
          // Custom prompt is in use; keep the current text untouched.
          return;
        }

        const [firstPrompt] = prompts;
        setSelectedPromptId(firstPrompt.id);
        selectedPromptIdRef.current = firstPrompt.id;
        onSystemPromptChange(firstPrompt.content);
      } catch (err) {
        console.error("Failed to load system prompts:", err);
        setLoadError(
          err instanceof Error ? err.message : tRef.current("systemPrompt.loadError")
        );
      } finally {
        setLoading(false);
      }
    },
    [defaultPrompt, onSystemPromptChange]
  );

  useEffect(() => {
    void fetchPrompts({ autoSelect: true });
  }, [fetchPrompts]);

  useEffect(() => {
    selectedPromptIdRef.current = selectedPromptId;
  }, [selectedPromptId]);

  const handleSelectPrompt = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;

    if (value === CUSTOM_PROMPT_VALUE) {
      setSelectedPromptId(null);
      selectedPromptIdRef.current = null;
      return;
    }

    const prompt = systemPrompts.find((item) => item.id === value);
    if (prompt) {
      setSelectedPromptId(prompt.id);
      selectedPromptIdRef.current = prompt.id;
      onSystemPromptChange(prompt.content);
    }
  };

  const handleSaveSelectedPrompt = async () => {
    if (!selectedPrompt || !hasSelectedPromptChanges) {
      return;
    }

    setIsSavingPrompt(true);
    try {
      const updated = await updateSystemPrompt(selectedPrompt.id, {
        content: systemPrompt,
      });
      setSystemPrompts((prev) =>
        prev.map((prompt) =>
          prompt.id === updated.id ? { ...prompt, ...updated } : prompt
        )
      );
      toast.success(t("systemPrompt.personaUpdated"));
    } catch (err) {
      console.error("Failed to update system prompt:", err);
      toast.error(
        err instanceof Error ? err.message : t("systemPrompt.updateFailed")
      );
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleCreatePrompt = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = creatingPrompt.name.trim();
    const trimmedContent = creatingPrompt.content.trim();

    if (!trimmedName) {
      toast.error(t("systemPrompt.nameRequired"));
      return;
    }

    if (!trimmedContent) {
      toast.error(t("systemPrompt.contentRequired"));
      return;
    }

    setIsCreatingPrompt(true);
    try {
      const created = await createSystemPrompt({
        name: trimmedName,
        description: creatingPrompt.description.trim() || undefined,
        content: trimmedContent,
      });
      setSystemPrompts((prev) => [created, ...prev]);
      setSelectedPromptId(created.id);
      selectedPromptIdRef.current = created.id;
      onSystemPromptChange(created.content);
      setCreatingPrompt({ name: "", description: "", content: "" });
      setManagerOpen(false);
      toast.success(t("systemPrompt.personaCreated"));
    } catch (err) {
      console.error("Failed to create system prompt:", err);
      toast.error(
        err instanceof Error ? err.message : t("systemPrompt.createFailed")
      );
    } finally {
      setIsCreatingPrompt(false);
    }
  };

  const handleStartEditingDetails = (prompt: SystemPrompt) => {
    setEditingPromptId(prompt.id);
    setEditingDetails({
      name: prompt.name,
      description: prompt.description ?? "",
    });
  };

  const handleSaveDetails = async () => {
    if (!editingPromptId) return;

    const trimmedName = editingDetails.name.trim();
    if (!trimmedName) {
      toast.error(t("systemPrompt.nameRequired"));
      return;
    }

    setSavingDetailsId(editingPromptId);

    try {
      const updated = await updateSystemPrompt(editingPromptId, {
        name: trimmedName,
        description: editingDetails.description.trim() || null,
      });

      setSystemPrompts((prev) =>
        prev.map((prompt) =>
          prompt.id === updated.id ? { ...prompt, ...updated } : prompt
        )
      );

      // If we updated the selected prompt, keep the latest content/state
      if (selectedPromptId === updated.id) {
        onSystemPromptChange(updated.content);
      }

      setEditingPromptId(null);
      toast.success(t("systemPrompt.detailsUpdated"));
    } catch (err) {
      console.error("Failed to update persona details:", err);
      toast.error(
        err instanceof Error ? err.message : t("systemPrompt.detailsUpdateFailed")
      );
    } finally {
      setSavingDetailsId(null);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!window.confirm(t("systemPrompt.deleteConfirm"))) {
      return;
    }

    setDeletingPromptId(promptId);

    try {
      await deleteSystemPrompt(promptId);

      setSystemPrompts((prev) => {
        const filtered = prev.filter((prompt) => prompt.id !== promptId);

        if (selectedPromptId === promptId) {
          if (filtered.length > 0) {
            const [firstPrompt] = filtered;
            setSelectedPromptId(firstPrompt.id);
            selectedPromptIdRef.current = firstPrompt.id;
            onSystemPromptChange(firstPrompt.content);
          } else {
            setSelectedPromptId(null);
            selectedPromptIdRef.current = null;
            onSystemPromptChange(defaultPrompt);
          }
        }

        return filtered;
      });

      toast.success(t("systemPrompt.personaDeleted"));
    } catch (err) {
      console.error("Failed to delete persona:", err);
      toast.error(
        err instanceof Error ? err.message : t("systemPrompt.deleteFailed")
      );
    } finally {
      setDeletingPromptId(null);
    }
  };

  const renderPromptOptions = () => {
    const options = systemPrompts.map((prompt) => (
      <option key={prompt.id} value={prompt.id}>
        {prompt.name}
      </option>
    ));

    return [
      ...options,
      <option key={CUSTOM_PROMPT_VALUE} value={CUSTOM_PROMPT_VALUE}>
        {t("systemPrompt.customPrompt")}
      </option>,
    ];
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="text-sm font-medium text-gray-700">
            {t("systemPrompt.title")}
          </label>
          <div className="flex items-center gap-2">
            <select
              value={selectedPromptId ?? CUSTOM_PROMPT_VALUE}
              onChange={handleSelectPrompt}
              disabled={loading}
              className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loading ? (
                <option>{t("systemPrompt.loadingPrompts")}</option>
              ) : systemPrompts.length > 0 ? (
                renderPromptOptions()
              ) : (
                <>
                  <option value={CUSTOM_PROMPT_VALUE}>{t("systemPrompt.customPrompt")}</option>
                </>
              )}
            </select>

            <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Settings className="h-4 w-4" />
                  {t("systemPrompt.manage")}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{t("systemPrompt.manageTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("systemPrompt.manageDescription")}
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                  {/* Active Prompt Editor */}
                  <div className="space-y-2 border border-blue-200 rounded-lg bg-blue-50/30 p-4">
                    <label className="text-sm font-semibold text-gray-800">
                      {t("systemPrompt.activePrompt")}
                    </label>
                    <textarea
                      value={systemPrompt}
                      onChange={(event) => {
                        onSystemPromptChange(event.target.value);
                      }}
                      placeholder={t("systemPrompt.activePromptPlaceholder")}
                      className="w-full px-3 py-2 text-sm text-gray-900 placeholder-gray-500 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none bg-white"
                      rows={6}
                    />
                    {!selectedPrompt && (
                      <p className="text-xs text-gray-500">
                        {t("systemPrompt.customPromptHint")}
                      </p>
                    )}
                    {selectedPrompt && !hasSelectedPromptChanges && (
                      <p className="text-xs text-gray-500">
                        {t("systemPrompt.syncedHint")}
                      </p>
                    )}
                    {selectedPrompt && hasSelectedPromptChanges && (
                      <>
                        <p className="text-xs text-amber-600 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {t("systemPrompt.unsavedChanges", { name: selectedPrompt.name })}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              onSystemPromptChange(selectedPrompt.content);
                            }}
                            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {t("systemPrompt.reset")}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveSelectedPrompt}
                            disabled={isSavingPrompt}
                            className={cn(
                              "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white",
                              isSavingPrompt
                                ? "bg-gray-400"
                                : "bg-green-600 hover:bg-green-700"
                            )}
                          >
                            {isSavingPrompt ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="h-3.5 w-3.5" />
                            )}
                            {t("systemPrompt.saveChanges")}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Create New Persona Form */}
                  <form
                    onSubmit={handleCreatePrompt}
                    className="space-y-3 border border-blue-200 rounded-lg bg-blue-50/30 p-4"
                  >
                    <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-blue-600" />
                      {t("systemPrompt.createNew")}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-1">
                        <label className="text-xs font-medium text-gray-600">
                          {t("common.name")}
                        </label>
                        <input
                          type="text"
                          value={creatingPrompt.name}
                          onChange={(event) =>
                            setCreatingPrompt((prev) => ({
                              ...prev,
                              name: event.target.value,
                            }))
                          }
                          placeholder={t("systemPrompt.namePlaceholder")}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-xs font-medium text-gray-600">
                          {t("systemPrompt.descriptionOptional")}
                        </label>
                        <input
                          type="text"
                          value={creatingPrompt.description}
                          onChange={(event) =>
                            setCreatingPrompt((prev) => ({
                              ...prev,
                              description: event.target.value,
                            }))
                          }
                          placeholder={t("systemPrompt.descriptionPlaceholder")}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600">
                        {t("systemPrompt.promptContent")}
                      </label>
                      <textarea
                        value={creatingPrompt.content}
                        onChange={(event) =>
                          setCreatingPrompt((prev) => ({
                            ...prev,
                            content: event.target.value,
                          }))
                        }
                        placeholder={t("systemPrompt.promptContentPlaceholder")}
                        rows={4}
                        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setCreatingPrompt({
                            name: "",
                            description: "",
                            content: systemPrompt,
                          })
                        }
                        className="text-xs text-gray-600 hover:text-gray-800 underline"
                      >
                        {t("systemPrompt.useActivePrompt")}
                      </button>
                      <button
                        type="submit"
                        disabled={isCreatingPrompt}
                        className={cn(
                          "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white",
                          isCreatingPrompt
                            ? "bg-gray-400"
                            : "bg-blue-600 hover:bg-blue-700"
                        )}
                      >
                        {isCreatingPrompt ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <PlusCircle className="h-4 w-4" />
                        )}
                        {t("systemPrompt.savePersona")}
                      </button>
                    </div>
                  </form>

                  {/* Existing Personas List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-purple-600" />
                        {t("systemPrompt.existingPersonas")}
                      </h3>
                      <button
                        type="button"
                        onClick={() => void fetchPrompts()}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                        title={t("systemPrompt.refreshTitle")}
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCcw className="h-3.5 w-3.5" />
                        )}
                        {t("common.refresh")}
                      </button>
                    </div>
                    {systemPrompts.length === 0 ? (
                      <p className="text-sm text-gray-500">
                        {t("systemPrompt.noPersonas")}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {systemPrompts.map((prompt) => (
                          <li
                            key={prompt.id}
                            className="rounded-lg border border-gray-200 bg-gray-50/80 p-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-800">
                                  {prompt.name}
                                </p>
                                {prompt.description && (
                                  <p className="text-xs text-gray-600">
                                    {prompt.description}
                                  </p>
                                )}
                                <p className="text-xs text-gray-500">
                                  {t("systemPrompt.updated", {
                                    date: new Date(prompt.updated_at).toLocaleString(locale),
                                  })}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedPromptId(prompt.id);
                                    onSystemPromptChange(prompt.content);
                                    setManagerOpen(false);
                                  }}
                                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                                >
                                  {t("systemPrompt.use")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleStartEditingDetails(prompt)
                                  }
                                  className="text-xs text-gray-600 hover:text-gray-800 underline"
                                >
                                  {t("systemPrompt.editDetails")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePrompt(prompt.id)}
                                  disabled={deletingPromptId === prompt.id}
                                  className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                                >
                                  {deletingPromptId === prompt.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                  {t("common.delete")}
                                </button>
                              </div>
                            </div>

                            {editingPromptId === prompt.id && (
                              <div className="mt-3 space-y-2 rounded-md border border-purple-200 bg-white p-3">
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div>
                                    <label className="text-xs font-medium text-gray-600">
                                      {t("common.name")}
                                    </label>
                                    <input
                                      type="text"
                                      value={editingDetails.name}
                                      onChange={(event) =>
                                        setEditingDetails((prev) => ({
                                          ...prev,
                                          name: event.target.value,
                                        }))
                                      }
                                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-600">
                                      {t("common.description")}
                                    </label>
                                    <input
                                      type="text"
                                      value={editingDetails.description}
                                      onChange={(event) =>
                                        setEditingDetails((prev) => ({
                                          ...prev,
                                          description: event.target.value,
                                        }))
                                      }
                                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPromptId(null)}
                                    className="text-xs text-gray-600 hover:text-gray-800 underline"
                                  >
                                    {t("common.cancel")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveDetails}
                                    disabled={savingDetailsId === prompt.id}
                                    className={cn(
                                      "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-white",
                                      savingDetailsId === prompt.id
                                        ? "bg-gray-400"
                                        : "bg-purple-600 hover:bg-purple-700"
                                    )}
                                  >
                                    {savingDetailsId === prompt.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Pencil className="h-4 w-4" />
                                    )}
                                    {t("systemPrompt.saveDetails")}
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="h-4 w-4" />
          {loadError}
        </div>
      )}
    </div>
  );
}
