function getErrorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  return "";
}

export function isDuplicateSessionSignerError(error: unknown): boolean {
  return getErrorText(error).includes("Duplicate signer");
}

export function isGaslessAuthorizationRequiredError(error: unknown): boolean {
  return getErrorText(error).includes(
    "Wallet is not authorized for gasless signing yet"
  );
}
