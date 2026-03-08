package com.vinesight

import android.app.Activity
import android.content.Intent
import android.content.IntentSender
import android.content.pm.PackageManager
import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import com.google.android.gms.auth.api.identity.GetPhoneNumberHintIntentRequest
import com.google.android.gms.auth.api.identity.Identity
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability

class PhoneNumberHintPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(PhoneNumberHintModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}

class PhoneNumberHintModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  private var pendingPromise: Promise? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != PHONE_NUMBER_HINT_REQUEST_CODE) return

      val promise = pendingPromise ?: return
      pendingPromise = null

      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.resolve(null)
        return
      }

      try {
        val phoneNumber = Identity.getSignInClient(activity).getPhoneNumberFromIntent(data)
        promise.resolve(phoneNumber)
      } catch (error: Exception) {
        promise.resolve(null)
      }
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "PhoneNumberHintBridge"

  override fun invalidate() {
    reactContext.removeActivityEventListener(activityEventListener)
    pendingPromise?.reject("MODULE_INVALIDATED", "PhoneNumberHintModule has been invalidated")
    pendingPromise = null
    super.invalidate()
  }

  @ReactMethod
  fun isSupported(promise: Promise) {
    try {
      promise.resolve(isPhoneNumberHintSupported())
    } catch (error: Exception) {
      Log.e(TAG, "isSupported check failed", error)
      promise.resolve(false)
    }
  }

  @ReactMethod
  fun requestPhoneNumberHint(promise: Promise) {
    if (pendingPromise != null) {
      promise.reject("IN_PROGRESS", "Phone number hint request already in progress.")
      return
    }

    val activity = reactApplicationContext.currentActivity
    if (activity == null || !isPhoneNumberHintSupported()) {
      promise.resolve(null)
      return
    }

    pendingPromise = promise

    val request = GetPhoneNumberHintIntentRequest.builder().build()

    Identity.getSignInClient(activity)
      .getPhoneNumberHintIntent(request)
      .addOnSuccessListener { pendingIntent ->
        try {
          activity.startIntentSenderForResult(
            pendingIntent.intentSender,
            PHONE_NUMBER_HINT_REQUEST_CODE,
            null,
            0,
            0,
            0,
          )
        } catch (error: IntentSender.SendIntentException) {
          resolvePendingPromise(null)
        } catch (error: Exception) {
          resolvePendingPromise(null)
        }
      }
      .addOnFailureListener {
        resolvePendingPromise(null)
      }
  }

  private fun resolvePendingPromise(value: String?) {
    pendingPromise?.resolve(value)
    pendingPromise = null
  }

  private fun isPhoneNumberHintSupported(): Boolean {
    val googlePlayServicesStatus = GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(reactContext)
    val hasTelephony = reactContext.packageManager.hasSystemFeature(PackageManager.FEATURE_TELEPHONY)
    return googlePlayServicesStatus == ConnectionResult.SUCCESS && hasTelephony
  }

  companion object {
    private const val PHONE_NUMBER_HINT_REQUEST_CODE = 19031
    private const val TAG = "PhoneNumberHintPackage"
  }
}
