package com.modi.decisionjournal.reminders

import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

/**
 * Alarm and broadcast entry points can start a fresh process before Firebase
 * has restored the saved session. Wait for the first non-null auth state.
 */
suspend fun awaitUid(timeoutMillis: Long = 10_000): String? {
    val auth = FirebaseAuth.getInstance()
    auth.currentUser?.uid?.let { return it }

    return withTimeoutOrNull(timeoutMillis) {
        suspendCancellableCoroutine { continuation ->
            var listener: FirebaseAuth.AuthStateListener? = null
            listener = FirebaseAuth.AuthStateListener { firebaseAuth ->
                val user = firebaseAuth.currentUser
                if (user != null) {
                    listener?.let(firebaseAuth::removeAuthStateListener)
                    if (continuation.isActive) {
                        continuation.resume(user.uid)
                    }
                }
            }
            auth.addAuthStateListener(listener)
            continuation.invokeOnCancellation {
                listener?.let(auth::removeAuthStateListener)
            }
        }
    }
}
