import "server-only";

import {MetaImportValidationError} from "./meta-evidence-contract";
import {AdminError} from "../server/admin-error-response";

export function mapMetaImportPreviewError(error: unknown) {
  if (!(error instanceof MetaImportValidationError)) return error;

  return new AdminError(error.message, {
    code: error.code,
    retryable: false,
    status: error.status
  });
}
