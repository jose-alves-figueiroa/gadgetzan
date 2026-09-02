"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "../session";
import { validateImportCsvs } from "./validate";
import { commitImport } from "./commit";
import { undoImportBatch } from "./undo";
import type { ImportFilesInput } from "./types";

export async function validateImport(files: ImportFilesInput) {
  const userId = await requireUserId();
  return validateImportCsvs(userId, files);
}

export async function confirmImport(files: ImportFilesInput, label: string) {
  const userId = await requireUserId();
  const result = await commitImport(userId, files, label);

  revalidatePath("/imports");
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/cards");
  revalidatePath("/investments");
  revalidatePath("/goals");
  revalidatePath("/");

  return result;
}

export async function undoImport(batchId: string) {
  const userId = await requireUserId();
  const result = await undoImportBatch(userId, batchId);

  revalidatePath("/imports");
  revalidatePath(`/imports/${batchId}`);
  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/cards");
  revalidatePath("/investments");
  revalidatePath("/goals");
  revalidatePath("/");

  return result;
}
