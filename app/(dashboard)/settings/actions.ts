"use server"

import { cookies } from "next/headers"

/**
 * PocketBase collection schema for the settings collection
 * Matches the official migration format
 */
const SETTINGS_COLLECTION_SCHEMA = {
  id: "pbc_settings_001",
  name: "settings",
  type: "base",
  system: false,
  fields: [
    {
      autogeneratePattern: "[a-z0-9]{15}",
      hidden: false,
      id: "text3208210256",
      max: 15,
      min: 15,
      name: "id",
      pattern: "^[a-z0-9]+$",
      presentable: false,
      primaryKey: true,
      required: true,
      system: true,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text1847291650",
      max: 0,
      min: 0,
      name: "app_name",
      pattern: "",
      presentable: true,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text2938475610",
      max: 0,
      min: 0,
      name: "tagline",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "file4829371056",
      maxSelect: 1,
      maxSize: 2097152,
      mimeTypes: ["image/png", "image/svg+xml", "image/jpeg"],
      name: "logo",
      presentable: false,
      protected: false,
      required: false,
      system: false,
      thumbs: [],
      type: "file"
    },
    {
      hidden: false,
      id: "file5938271640",
      maxSelect: 1,
      maxSize: 2097152,
      mimeTypes: ["image/png", "image/svg+xml", "image/x-icon", "image/vnd.microsoft.icon"],
      name: "favicon",
      presentable: false,
      protected: false,
      required: false,
      system: false,
      thumbs: [],
      type: "file"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text6019384752",
      max: 0,
      min: 0,
      name: "copyright_holder",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "bool7120495863",
      name: "show_powered_by",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text8231506974",
      max: 0,
      min: 0,
      name: "primary_color",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      autogeneratePattern: "",
      hidden: false,
      id: "text9342618085",
      max: 0,
      min: 0,
      name: "id_format",
      pattern: "",
      presentable: false,
      primaryKey: false,
      required: false,
      system: false,
      type: "text"
    },
    {
      hidden: false,
      id: "number1053729196",
      max: null,
      min: 0,
      name: "id_padding",
      onlyInt: true,
      presentable: false,
      required: false,
      system: false,
      type: "number"
    },
    {
      hidden: false,
      id: "bool2164830207",
      name: "reservations_enabled",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      hidden: false,
      id: "bool3275941318",
      name: "setup_complete",
      presentable: false,
      required: false,
      system: false,
      type: "bool"
    },
    {
      hidden: false,
      id: "autodate2990389176",
      name: "created",
      onCreate: true,
      onUpdate: false,
      presentable: false,
      system: false,
      type: "autodate"
    },
    {
      hidden: false,
      id: "autodate3332085495",
      name: "updated",
      onCreate: true,
      onUpdate: true,
      presentable: false,
      system: false,
      type: "autodate"
    }
  ],
  indexes: [],
  listRule: "",
  viewRule: "",
  createRule: null,
  updateRule: null,
  deleteRule: null
}

/**
 * Server action to create the settings collection in PocketBase
 * This runs server-side to protect the auth token
 */
export async function createSettingsCollection(pocketbaseUrl: string, authToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Ensure proper Authorization header format
    // PocketBase accepts tokens with or without Bearer prefix
    const authHeader = authToken.startsWith('Bearer ') ? authToken : authToken

    const response = await fetch(`${pocketbaseUrl}/api/collections`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify(SETTINGS_COLLECTION_SCHEMA),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: errorData.message || `HTTP ${response.status}`
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Failed to create settings collection:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unbekannter Fehler"
    }
  }
}
