/**
 * PocketBase `settings` collection schema helpers.
 *
 * The collection is owned by the frontend: it is created on demand from the
 * Settings page when missing, and individual fields can be added to existing
 * collections without redeploying the backend.
 */

export const IMAGE_COMPRESSION_FIELD = {
  hidden: false,
  maxSize: 2000,
  name: 'image_compression',
  presentable: false,
  required: false,
  system: false,
  type: 'json',
};

interface CollectionField {
  name: string;
  type: string;
  [key: string]: unknown;
}

interface PocketBaseCollection {
  id: string;
  name: string;
  fields: CollectionField[];
  [key: string]: unknown;
}

async function fetchSettingsCollection(
  pocketbaseUrl: string,
  authToken: string
): Promise<PocketBaseCollection> {
  const response = await fetch(`${pocketbaseUrl}/api/collections/settings`, {
    headers: { Authorization: authToken },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch settings collection: HTTP ${response.status}`);
  }
  return response.json();
}

export async function hasImageCompressionField(
  pocketbaseUrl: string,
  authToken: string
): Promise<boolean> {
  try {
    const collection = await fetchSettingsCollection(pocketbaseUrl, authToken);
    return collection.fields.some((f) => f.name === 'image_compression');
  } catch (e) {
    // Non-superusers can't read collection schemas — they get 401/403.
    // Treat that as "field present" so we don't surface a migration
    // banner they couldn't act on. Other errors (network, 5xx) fall
    // through and show the banner so a real admin can investigate.
    const msg = e instanceof Error ? e.message : '';
    if (/HTTP 40[13]/.test(msg)) return true;
    return false;
  }
}

export async function addImageCompressionField(
  pocketbaseUrl: string,
  authToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const collection = await fetchSettingsCollection(pocketbaseUrl, authToken);

    if (collection.fields.some((f) => f.name === 'image_compression')) {
      return { success: true };
    }

    const updated = {
      ...collection,
      fields: [...collection.fields, IMAGE_COMPRESSION_FIELD],
    };

    const response = await fetch(`${pocketbaseUrl}/api/collections/${collection.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authToken,
      },
      body: JSON.stringify(updated),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}
