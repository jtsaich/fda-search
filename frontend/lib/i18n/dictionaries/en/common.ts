/**
 * Shared, cross-feature UI strings. Owned centrally so translations stay
 * consistent. Feature namespaces should reference these for generic actions
 * (save, cancel, delete, ...) instead of redefining them.
 */
export const common = {
  "common.language": "Language",
  "common.save": "Save",
  "common.saving": "Saving...",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.deleting": "Deleting...",
  "common.edit": "Edit",
  "common.create": "Create",
  "common.update": "Update",
  "common.remove": "Remove",
  "common.confirm": "Confirm",
  "common.close": "Close",
  "common.back": "Back",
  "common.submit": "Submit",
  "common.retry": "Retry",
  "common.refresh": "Refresh",
  "common.search": "Search",
  "common.loading": "Loading...",
  "common.actions": "Actions",
  "common.yes": "Yes",
  "common.no": "No",
  "common.name": "Name",
  "common.description": "Description",
  "common.email": "Email",
  "common.error": "Something went wrong. Please try again.",
  "common.success": "Success",
  "common.none": "None",
} as const;
