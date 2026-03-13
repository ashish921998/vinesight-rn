package com.vinesight

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import java.util.concurrent.atomic.AtomicReference
import java.util.regex.Pattern

class AndroidSmsRetrieverPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(AndroidSmsRetrieverModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}

class AndroidSmsRetrieverModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private val pendingPromise = AtomicReference<Promise?>(null)
  private var smsBroadcastReceiver: BroadcastReceiver? = null

  override fun getName(): String = "AndroidSmsRetrieverBridge"

  override fun invalidate() {
    cleanupReceiver()
    pendingPromise.getAndSet(null)?.reject("MODULE_INVALIDATED", "AndroidSmsRetrieverModule invalidated.")
    super.invalidate()
  }

  @ReactMethod
  fun isSupported(promise: Promise) {
    try {
      promise.resolve(isSmsRetrieverSupported())
    } catch (error: Exception) {
      Log.e(TAG, "isSupported check failed", error)
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun startListening(promise: Promise) {
    if (!pendingPromise.compareAndSet(null, promise)) {
      promise.reject("IN_PROGRESS", "SMS Retriever is already listening.")
      return
    }

    if (!isSmsRetrieverSupported()) {
      resolvePendingPromise(null)
      return
    }

    cleanupReceiver()
    smsBroadcastReceiver = createSmsReceiver()
    registerReceiver(smsBroadcastReceiver!!)

    SmsRetriever.getClient(reactContext)
      .startSmsRetriever()
      .addOnSuccessListener {
        Log.d(TAG, "SMS Retriever started")
      }
      .addOnFailureListener { error ->
        Log.w(TAG, "Failed to start SMS Retriever", error)
        cleanupReceiver()
        resolvePendingPromise(null)
      }
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    cleanupReceiver()
    pendingPromise.getAndSet(null)?.resolve(null)
    promise.resolve(null)
  }

  private fun createSmsReceiver(): BroadcastReceiver {
    return object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        if (intent?.action != SmsRetriever.SMS_RETRIEVED_ACTION) return

        val extras = intent.extras ?: run {
          cleanupReceiver()
          resolvePendingPromise(null)
          return
        }

        val status = extras.get(SmsRetriever.EXTRA_STATUS) as? Status
        when (status?.statusCode) {
          CommonStatusCodes.SUCCESS -> {
            val message = extras.getString(SmsRetriever.EXTRA_SMS_MESSAGE)
            val code = extractOtpCode(message)
            cleanupReceiver()
            resolvePendingPromise(code)
          }
          CommonStatusCodes.TIMEOUT -> {
            cleanupReceiver()
            resolvePendingPromise(null)
          }
          else -> {
            cleanupReceiver()
            resolvePendingPromise(null)
          }
        }
      }
    }
  }

  private fun registerReceiver(receiver: BroadcastReceiver) {
    val intentFilter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      reactContext.registerReceiver(receiver, intentFilter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("DEPRECATION")
      reactContext.registerReceiver(receiver, intentFilter)
    }
  }

  private fun cleanupReceiver() {
    val receiver = smsBroadcastReceiver ?: return
    try {
      reactContext.unregisterReceiver(receiver)
    } catch (_: IllegalArgumentException) {
      // Receiver already removed.
    } finally {
      smsBroadcastReceiver = null
    }
  }

  private fun resolvePendingPromise(value: String?) {
    pendingPromise.getAndSet(null)?.resolve(value)
  }

  private fun extractOtpCode(message: String?): String? {
    if (message.isNullOrBlank()) return null
    val matcher = OTP_PATTERN.matcher(message)
    return if (matcher.find()) matcher.group(1) else null
  }

  private fun isSmsRetrieverSupported(): Boolean {
    val googlePlayServicesStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactContext)
    val hasTelephony = reactContext.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    return googlePlayServicesStatus == ConnectionResult.SUCCESS && hasTelephony
  }

  companion object {
    private const val TAG = "AndroidSmsRetriever"
    private val OTP_PATTERN: Pattern = Pattern.compile("\\b(\\d{6})\\b")
  }
}
