package dev.paisora.sms

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class KharchaSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KharchaSms")

    AsyncFunction("listMessages") { senders: List<String>, since: Double ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")

      if (ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS)
          != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("SMS permission has not been granted")
      }

      val allowed = senders
        .map { normalizeSender(it) }
        .filter { it.isNotEmpty() }
        .toSet()

      if (allowed.isEmpty()) return@AsyncFunction emptyList<Map<String, Any>>()

      val output = mutableListOf<Map<String, Any>>()
      val uri = Uri.parse("content://sms/inbox")
      val projection = arrayOf("address", "body", "date")

      context.contentResolver.query(
        uri,
        projection,
        "date >= ?",
        arrayOf(since.toLong().toString()),
        "date DESC",
      )?.use { cursor ->
        val addressIndex = cursor.getColumnIndexOrThrow("address")
        val bodyIndex = cursor.getColumnIndexOrThrow("body")
        val dateIndex = cursor.getColumnIndexOrThrow("date")

        while (cursor.moveToNext()) {
          val sender = cursor.getString(addressIndex) ?: continue
          if (normalizeSender(sender) !in allowed) continue

          val body = cursor.getString(bodyIndex) ?: continue
          if (body.length > 4000) continue

          output.add(
            mapOf(
              "sender" to sender,
              "body" to body,
              "receivedAt" to cursor.getLong(dateIndex),
            )
          )
        }
      }

      output
    }
  }

  /**
   * Normalizes SMS sender IDs so allowlist matching is robust.
   *
   * Strips:
   *   - Leading 2-letter routing prefix:  VM-, VK-, AD-, AX-, JD-, ...
   *   - Trailing single-letter/segment suffix:  -T, -S, -P, ...
   *
   * Examples:
   *   "VM-HDFCBK-T"  -> "HDFCBK"
   *   "VK-SBIINB"    -> "SBIINB"
   *   "AX-ICICIB"    -> "ICICIB"
   *   "HDFCBK"       -> "HDFCBK"
   *   "+919876543210" -> "+919876543210"  (numeric senders unchanged)
   */
  private fun normalizeSender(value: String): String {
    val trimmed = value.trim().uppercase()
    // Skip normalization for phone numbers (start with + or digit)
    if (trimmed.isEmpty() || trimmed[0].isDigit() || trimmed[0] == '+') return trimmed
    return trimmed
      .replace(Regex("^[A-Z]{2}-"), "")   // strip leading "XX-"
      .replace(Regex("-[A-Z]$"), "")       // strip trailing "-X"
  }
}