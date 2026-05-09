import { PrivyUser } from "@privy-io/public-api";

type MetadataValue = string | number | boolean;
type MetadataRecord = Record<string, MetadataValue>;
type VerificationRecord = {
  status?: string;
  verified?: boolean;
  isVerified?: boolean;
  providerStatus?: string;
  sumsubStatus?: string;
};
type IdentityVerificationSource = {
  custom_metadata?: MetadataRecord;
  customMetadata?: MetadataRecord;
  identityVerification?: VerificationRecord | null;
};

export type IdentityVerificationStatus = "verified" | "pending" | "unverified";

const VERIFIED_BOOLEAN_KEYS = [
  "identity_verified",
  "identity_verification_verified",
  "identity_verification_complete",
  "kyc_verified",
  "kyc_complete",
  "sumsub_verified",
  "sumsub_approved",
  "sumsub_complete",
] as const;

const STATUS_KEYS = [
  "identity_verification_status",
  "verification_status",
  "kyc_status",
  "sumsub_status",
  "sumsub_review_status",
] as const;

const VERIFIED_STATUS_VALUES = new Set([
  "approved",
  "complete",
  "completed",
  "verified",
  "success",
  "successful",
  "active",
]);

const PENDING_STATUS_VALUES = new Set([
  "pending",
  "queued",
  "initiated",
  "started",
  "processing",
  "in_progress",
  "in-progress",
  "in review",
  "in_review",
  "review_pending",
  "on_hold",
  "on-hold",
]);

function normalizeMetadataString(value: MetadataValue | undefined): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value).trim().toLowerCase();
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return "";
}

function isTruthyMetadataValue(value: MetadataValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;

  const normalized = normalizeMetadataString(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

function getStatusFromVerificationRecord(
  record: VerificationRecord | null | undefined
): IdentityVerificationStatus | null {
  if (!record || typeof record !== "object") {
    return null;
  }

  if (record.verified === true || record.isVerified === true) {
    return "verified";
  }

  const candidates = [
    record.status,
    record.providerStatus,
    record.sumsubStatus,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeMetadataString(candidate);
    if (!normalized) continue;

    if (VERIFIED_STATUS_VALUES.has(normalized)) {
      return "verified";
    }

    if (PENDING_STATUS_VALUES.has(normalized)) {
      return "pending";
    }

    return "unverified";
  }

  return null;
}

export function getIdentityVerificationMetadata(
  user: (PrivyUser & IdentityVerificationSource) | IdentityVerificationSource | null | undefined
): MetadataRecord {
  const metadata = (
    user as
      | {
          custom_metadata?: MetadataRecord;
          customMetadata?: MetadataRecord;
        }
      | null
      | undefined
  )?.custom_metadata ??
    (
      user as
        | {
            custom_metadata?: MetadataRecord;
            customMetadata?: MetadataRecord;
          }
        | null
        | undefined
    )?.customMetadata;

  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata;
}

export function getIdentityVerificationStatus(
  user: (PrivyUser & IdentityVerificationSource) | IdentityVerificationSource | null | undefined
): IdentityVerificationStatus {
  const metadata = getIdentityVerificationMetadata(user);
  const recordStatus = getStatusFromVerificationRecord(user?.identityVerification);
  const metadataStatuses: IdentityVerificationStatus[] = [];

  for (const key of VERIFIED_BOOLEAN_KEYS) {
    if (!(key in metadata)) continue;
    metadataStatuses.push(
      isTruthyMetadataValue(metadata[key]) ? "verified" : "unverified"
    );
  }

  for (const key of STATUS_KEYS) {
    if (!(key in metadata)) continue;

    const normalized = normalizeMetadataString(metadata[key]);
    if (!normalized) continue;

    if (VERIFIED_STATUS_VALUES.has(normalized)) {
      metadataStatuses.push("verified");
      continue;
    }

    if (PENDING_STATUS_VALUES.has(normalized)) {
      metadataStatuses.push("pending");
      continue;
    }

    metadataStatuses.push("unverified");
  }

  const statuses = recordStatus ? [recordStatus, ...metadataStatuses] : metadataStatuses;
  if (statuses.includes("verified")) {
    return "verified";
  }

  if (statuses.includes("pending")) {
    return "pending";
  }

  return "unverified";
}

export function getIdentityVerificationLabel(
  status: IdentityVerificationStatus
): string {
  if (status === "verified") {
    return "Verified";
  }

  if (status === "pending") {
    return "In review";
  }

  return "Verify now";
}
