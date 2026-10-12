export type DestinationResult<T> = {value: T; error?: never} | {value?: never; error: string};

// A provider failure must never prevent the other provider from being attempted.
export async function attemptBackupDestinations<B, D>(blob: () => Promise<B>, drive: () => Promise<D>) {
  const attempt = async <T>(name: string, action: () => Promise<T>): Promise<DestinationResult<T>> => {
    try {
      return {value: await action()};
    } catch {
      // Provider exceptions can contain request URLs or credentials.
      return {error: `${name} backup unavailable; check storage capacity and credentials.`};
    }
  };
  const [blobResult, driveResult] = await Promise.all([
    attempt("Blob", blob), attempt("Google Drive", drive)
  ]);
  return {blob: blobResult, drive: driveResult};
}
