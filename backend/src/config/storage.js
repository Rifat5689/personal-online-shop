import { BlobServiceClient } from "@azure/storage-blob";
import { DefaultAzureCredential } from "@azure/identity";
import ApiError from "../utils/ApiError.js";

let cached;
let cachedConfig;

// App Service uses its managed identity; local development uses az login.
export function getImageContainer() {
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const container = process.env.AZURE_STORAGE_CONTAINER;
  if (!account || !container) throw new ApiError(503, "Image storage is not configured");
  if (!/^[a-z0-9]{3,24}$/.test(account) ||
      !/^(?!.*--)[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(container)) {
    throw new ApiError(503, "Image storage configuration is invalid");
  }
  const config = `${account}/${container}`;
  if (cachedConfig === config) return cached;
  const client = new BlobServiceClient(
    `https://${account}.blob.core.windows.net`,
    new DefaultAzureCredential(),
    { retryOptions: { maxTries: 2, tryTimeoutInMs: 20000 } },
  );
  cached = client.getContainerClient(container);
  cachedConfig = config;
  return cached;
}
